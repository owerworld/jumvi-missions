#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
 * import-approved-missions.mjs — approved-batch importer for the mission
 * catalog, built on top of the "dynamic mission catalog" hardening (data.js's
 * missions.length / missionsInPack() are the single source of truth for every
 * total; see tools/check-mission-growth-fixture.mjs).
 *
 * WHAT THIS IS
 * A reusable pipeline that takes an ALREADY-APPROVED batch (Lab -> Auditor
 * output matching data/approved-mission-batch.schema.json) and integrates it
 * into data.js using the exact current mission model — nothing new is
 * designed or rendered; new missions ride the same generic mission-card
 * pipeline every existing mission already uses.
 *
 * WHAT THIS IS NOT
 * - Not a mission designer: it never invents mission content. Every field
 *   comes from the batch; the importer only assigns ids and formats them
 *   into data.js's m(...) call shape.
 * - Not a new-pack tool: every candidate's "pack" must already exist in
 *   data.js's PACKS. See docs/AUTONOMOUS_MISSION_IMPORTER.md for what a
 *   genuinely new pack additionally needs (art, worker.js PACK_KEYS/
 *   BADGE_IDS, jumvi-hub-app.js ZONE_THEMES, ...) — out of scope here.
 * - Not an auto-merge / auto-deploy tool. This script only ever touches the
 *   working tree it's pointed at. It never runs git, never opens a PR, never
 *   deploys. Committing, pushing and merging stay explicit human actions.
 *
 * SAFETY MODEL
 * Two modes, DRY_RUN (default) and APPLY:
 *   - DRY_RUN reads data.js, src/worker.js and the batch, and prints a full
 *     report (counts, proposed ids, pack deltas, files that would change,
 *     validation failures, test plan). It NEVER writes a file.
 *   - APPLY requires two explicit, human-authored flags on top of --mode=apply:
 *     --approved-by="<name>"   (non-empty — a record of who signed off)
 *     --approved-count=<N>     (must equal the exact number of missions the
 *                                plan would import — forces the human to have
 *                                actually looked at the DRY_RUN count first;
 *                                a stale/guessed number refuses to apply)
 *     Missing or mismatched -> refuse, exit 1, no repo write, no PR, no
 *     merge, no deploy. This is the mandatory human approval gate.
 *
 * REPO-ROOT OVERRIDE
 * --repo-root=<dir> points every file this script touches (data.js,
 * data/missions-meta.json, service-worker.js, index.html) at a different
 * root — defaults to this repo. This is what lets
 * tools/check-mission-importer.mjs exercise the real APPLY write path
 * end-to-end against a throwaway sandbox copy, never the real repo files.
 *
 * USAGE
 *   node tools/import-approved-missions.mjs <batch.json>
 *   node tools/import-approved-missions.mjs <batch.json> --json
 *   node tools/import-approved-missions.mjs <batch.json> \
 *     --mode=apply --approved-by="Jane Auditor" --approved-count=3
 * ═══════════════════════════════════════════════════════════════════════════ */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import vm from "node:vm";
import { execFileSync } from "node:child_process";
import { buildMeta, serialiseMeta } from "./derive-missions-meta.mjs";

const SCRIPT_DIR = fileURLToPath(new URL(".", import.meta.url));
const DEFAULT_REPO_ROOT = path.resolve(SCRIPT_DIR, "..");

/* ── tiny arg parser (no dependency — matches the repo's zero-dependency
 *    tools/*.mjs style) ──────────────────────────────────────────────────── */
export function parseArgs(argv) {
  const out = { _: [] };
  for (const raw of argv) {
    if (raw.startsWith("--")) {
      const eq = raw.indexOf("=");
      if (eq === -1) out[raw.slice(2)] = true;
      else out[raw.slice(2, eq)] = raw.slice(eq + 1);
    } else {
      out._.push(raw);
    }
  }
  return out;
}

/* ── reading the current mission model ───────────────────────────────────── */
export function loadCurrentData(root = DEFAULT_REPO_ROOT) {
  const dataJsPath = path.join(root, "data.js");
  const source = readFileSync(dataJsPath, "utf8");
  const wrapped = `${source}\n;({ missions, PACKS, BADGES });`;
  const context = vm.createContext({});
  const { missions, PACKS, BADGES } = vm.runInContext(wrapped, context, { filename: dataJsPath });
  if (!Array.isArray(missions) || !missions.length) {
    throw new Error(`${dataJsPath} evaluated but exposed no missions array`);
  }
  return { missions, PACKS, BADGES, source, dataJsPath };
}

// Read straight from src/worker.js's own source rather than hardcoding a
// second copy of these numbers/sets here — same "derive, don't duplicate"
// principle as missions-meta.json. If worker.js's shape ever changes these
// regexes stop matching and the importer fails loudly instead of silently
// checking against a stale copy.
export function readMissionIdMax(root = DEFAULT_REPO_ROOT) {
  const workerPath = path.join(root, "src/worker.js");
  const src = readFileSync(workerPath, "utf8");
  const match = src.match(/const\s+MISSION_ID_MAX\s*=\s*(\d+)\s*;/);
  if (!match) throw new Error(`could not find MISSION_ID_MAX in ${workerPath}`);
  return Number(match[1]);
}

export function readWorkerPackKeys(root = DEFAULT_REPO_ROOT) {
  const workerPath = path.join(root, "src/worker.js");
  const src = readFileSync(workerPath, "utf8");
  const start = src.indexOf("const PACK_KEYS = new Set([");
  if (start === -1) throw new Error(`could not find PACK_KEYS in ${workerPath}`);
  const end = src.indexOf("]);", start);
  const body = src.slice(start, end);
  const keys = [...body.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  return new Set(keys);
}

/* ── batch-shape validation (JS mirror of
 *    data/approved-mission-batch.schema.json — the schema file is the
 *    documented contract; this is the enforcement, since the repo carries no
 *    JSON-Schema validator dependency) ───────────────────────────────────── */
const VERDICTS = new Set(["APPROVED", "REJECTED", "NEEDS_REVISION"]);
const REQUIRED_FIELDS = [
  "title", "pack", "difficulty", "players", "time", "age",
  "equipment", "steps", "win", "safety", "tip", "auditor_verdict",
];

export function validateBatchShape(batch) {
  if (!Array.isArray(batch)) {
    return { valid: false, errors: ["batch is not a JSON array"] };
  }
  return { valid: true, errors: [] };
}

// Per-candidate structural validation — the SAME field rules
// tools/check-mission-schema.mjs enforces on data.js itself, applied before a
// candidate is allowed to become a real mission.
export function validateCandidateShape(candidate, index) {
  const errors = [];
  const label = `batch[${index}]${candidate && candidate.title ? ` ("${candidate.title}")` : ""}`;

  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    return [`${label}: not an object`];
  }

  for (const field of REQUIRED_FIELDS) {
    if (candidate[field] === undefined || candidate[field] === null) {
      errors.push(`${label}: missing "${field}"`);
    }
  }
  if (errors.length) return errors; // no point checking shapes on absent fields

  if (typeof candidate.title !== "string" || !candidate.title.trim()) {
    errors.push(`${label}: "title" is empty`);
  }
  if (typeof candidate.pack !== "string" || !candidate.pack.trim()) {
    errors.push(`${label}: "pack" is empty`);
  }
  if (![1, 2, 3].includes(candidate.difficulty)) {
    errors.push(`${label}: difficulty ${JSON.stringify(candidate.difficulty)} outside 1-3`);
  }
  if (!/^\d+(–\d+)?$/.test(String(candidate.players))) {
    errors.push(`${label}: players "${candidate.players}" is not "N" or "N–M" (en dash)`);
  }
  if (!/^\d+s$/.test(String(candidate.time))) {
    errors.push(`${label}: time "${candidate.time}" is not "Ns"`);
  }
  if (!/^\d+\+$/.test(String(candidate.age))) {
    errors.push(`${label}: age "${candidate.age}" is not "N+"`);
  }

  if (!Array.isArray(candidate.steps)) {
    errors.push(`${label}: "steps" is not an array`);
  } else {
    if (candidate.steps.length < 1 || candidate.steps.length > 3) {
      errors.push(`${label}: ${candidate.steps.length} steps — the sheet shows at most 3`);
    }
    candidate.steps.forEach((s, i) => {
      if (typeof s !== "string" || !s.trim()) errors.push(`${label}: step ${i + 1} is empty`);
    });
  }

  for (const field of ["win", "safety", "tip"]) {
    if (typeof candidate[field] !== "string" || !candidate[field].trim()) {
      errors.push(`${label}: "${field}" is empty`);
    }
  }

  const eq = candidate.equipment;
  if (!eq || typeof eq !== "object" || Array.isArray(eq)) {
    errors.push(`${label}: "equipment" is not an object`);
  } else {
    const maxPlayers = Number(String(candidate.players).split("–").pop());
    const maxPaddles = Array.isArray(eq.paddles) ? eq.paddles[eq.paddles.length - 1] : eq.paddles;
    if (!Number.isInteger(maxPaddles) || maxPaddles < 1) {
      errors.push(`${label}: equipment.paddles "${JSON.stringify(eq.paddles)}" is not a positive count`);
    } else if (Number.isFinite(maxPlayers) && maxPaddles < maxPlayers) {
      errors.push(`${label}: ${maxPlayers} players but only ${maxPaddles} paddles`);
    }
    if (!Number.isInteger(eq.balls) || eq.balls < 1) {
      errors.push(`${label}: equipment.balls "${eq.balls}" is not a positive count`);
    }
  }

  if (!VERDICTS.has(candidate.auditor_verdict)) {
    errors.push(`${label}: auditor_verdict "${candidate.auditor_verdict}" is not one of ${[...VERDICTS].join(", ")}`);
  }

  if (candidate.suggested_id !== undefined) {
    if (!Number.isInteger(candidate.suggested_id) || candidate.suggested_id < 1) {
      errors.push(`${label}: suggested_id "${candidate.suggested_id}" is not a positive integer`);
    }
  }

  return errors;
}

/* ── the import plan: what WOULD happen, computed once and shared by both
 *    DRY_RUN and APPLY so the two modes can never disagree ─────────────────── */
export function planImport(batch, current, root = DEFAULT_REPO_ROOT) {
  const shape = validateBatchShape(batch);
  if (!shape.valid) {
    return { fatal: shape.errors, notApproved: [], invalid: [], toImport: [] };
  }

  const existingTitles = new Set(current.missions.map((m) => m.title.toLowerCase()));
  const existingIds = new Set(current.missions.map((m) => m.id));
  const packKeys = new Set(current.PACKS.map((p) => p.key).filter((k) => k !== "all"));
  const currentMaxId = current.missions.reduce((max, m) => Math.max(max, m.id), 0);
  const missionIdMax = readMissionIdMax(root);
  const workerPackKeys = readWorkerPackKeys(root);

  const notApproved = [];
  const invalid = [];

  // Pass 1: shape + verdict only. Splits the batch into shape-invalid,
  // not-approved, and "everything else" without yet knowing about
  // collisions — a collision needs to see the WHOLE batch first.
  const approvedShapeValid = [];
  batch.forEach((candidate, index) => {
    const shapeErrors = validateCandidateShape(candidate, index);
    if (shapeErrors.length) {
      invalid.push({ index, candidate, errors: shapeErrors });
      return;
    }
    if (candidate.auditor_verdict !== "APPROVED") {
      notApproved.push({ index, candidate });
      return;
    }
    approvedShapeValid.push({ index, candidate });
  });

  // Pass 2: count in-batch collisions across ALL approved+shape-valid
  // candidates first, so pass 3 can flag EVERY occurrence of a collision —
  // not just the second one seen, which would silently let the first
  // through as if it were unique.
  const titleCounts = new Map();
  const suggestedIdCounts = new Map();
  for (const { candidate } of approvedShapeValid) {
    const titleKey = candidate.title.toLowerCase();
    titleCounts.set(titleKey, (titleCounts.get(titleKey) || 0) + 1);
    if (candidate.suggested_id !== undefined) {
      suggestedIdCounts.set(candidate.suggested_id, (suggestedIdCounts.get(candidate.suggested_id) || 0) + 1);
    }
  }

  // Pass 3: per-candidate validation using the collision counts above.
  const candidatesToPlace = [];
  for (const { index, candidate } of approvedShapeValid) {
    const errors = [];
    const titleKey = candidate.title.toLowerCase();
    if (existingTitles.has(titleKey)) {
      errors.push(`duplicate title "${candidate.title}" — already exists in data.js`);
    }
    if (titleCounts.get(titleKey) > 1) {
      errors.push(`duplicate title "${candidate.title}" — appears ${titleCounts.get(titleKey)} times in this batch`);
    }

    if (!packKeys.has(candidate.pack)) {
      errors.push(`pack "${candidate.pack}" does not exist in data.js's PACKS — this importer does not create new packs`);
    } else if (!workerPackKeys.has(candidate.pack)) {
      // Should never happen if data.js and src/worker.js's allowlist are in
      // lockstep, but it is exactly the kind of drift this importer exists
      // to catch loudly instead of shipping analytics that silently drop.
      errors.push(`pack "${candidate.pack}" exists in data.js but is missing from src/worker.js's PACK_KEYS allowlist — analytics for these missions would be dropped`);
    }

    if (candidate.suggested_id !== undefined) {
      if (existingIds.has(candidate.suggested_id)) {
        errors.push(`suggested_id ${candidate.suggested_id} collides with an existing mission id`);
      }
      if (suggestedIdCounts.get(candidate.suggested_id) > 1) {
        errors.push(`suggested_id ${candidate.suggested_id} appears ${suggestedIdCounts.get(candidate.suggested_id)} times in this batch`);
      }
    }

    if (errors.length) {
      invalid.push({ index, candidate, errors });
    } else {
      candidatesToPlace.push({ index, candidate });
    }
  }

  // Ids are assigned only to candidates that passed EVERY check above, in
  // batch order, strictly after the current highest id. An id that would
  // exceed MISSION_ID_MAX demotes that one candidate to invalid rather than
  // silently truncating the batch.
  const toImport = [];
  let nextId = currentMaxId + 1;
  for (const { index, candidate } of candidatesToPlace) {
    if (nextId > missionIdMax) {
      invalid.push({
        index,
        candidate,
        errors: [`assigning id ${nextId} would exceed MISSION_ID_MAX (${missionIdMax}) from src/worker.js`],
      });
      continue;
    }
    toImport.push({ index, candidate, id: nextId });
    nextId += 1;
  }

  // Defensive invariant: the ids we are about to write must be unique and
  // strictly above everything that already exists. A script that writes
  // mission data asserts this rather than trusting its own arithmetic.
  const assignedIds = toImport.map((x) => x.id);
  if (new Set(assignedIds).size !== assignedIds.length) {
    throw new Error("internal error: planImport produced duplicate ids — refusing to continue");
  }
  if (assignedIds.some((id) => existingIds.has(id))) {
    throw new Error("internal error: planImport produced an id that already exists — refusing to continue");
  }

  const packCountsBefore = {};
  const packCountsAfter = {};
  for (const key of packKeys) {
    packCountsBefore[key] = current.missions.filter((m) => m.pack === key).length;
    packCountsAfter[key] = packCountsBefore[key];
  }
  for (const { candidate } of toImport) {
    packCountsAfter[candidate.pack] = (packCountsAfter[candidate.pack] || 0) + 1;
  }

  const totalBefore = current.missions.length;
  const totalAfter = totalBefore + toImport.length;

  const filesThatWouldChange = toImport.length === 0 ? [] : [
    "data.js (new mission entries appended)",
    "data/missions-meta.json (regenerated from the new data.js)",
    "service-worker.js (CACHE_NAME bump — data.js content changed)",
    "tools/core-assets.lock (regenerated for the CACHE_NAME bump)",
    "index.html (data.js/app.js cache-busting ?v= query strings)",
  ];

  const testPlan = [
    "node tools/check-mission-schema.mjs",
    "node tools/derive-missions-meta.mjs --check",
    "node tools/check-mission-growth-fixture.mjs",
    "./tools/check-core-assets.sh (after the CACHE_NAME bump, run with --update)",
  ];

  return {
    fatal: null,
    currentMaxId,
    missionIdMax,
    totalBefore,
    totalAfter,
    packCountsBefore,
    packCountsAfter,
    notApproved,
    invalid,
    toImport,
    filesThatWouldChange,
    testPlan,
  };
}

/* ── rendering new missions into data.js's exact m(...) shape ────────────── */
function jsString(value) {
  return JSON.stringify(value);
}
function jsEquipment(eq) {
  const paddles = Array.isArray(eq.paddles) ? `[${eq.paddles.join(",")}]` : String(eq.paddles);
  return `{ paddles:${paddles}, balls:${eq.balls} }`;
}
function jsSteps(steps) {
  return `[${steps.map(jsString).join(",")}]`;
}

export function renderMissionEntries(toImport) {
  return toImport.map(({ candidate, id }) =>
    `  m(${id},${jsString(candidate.pack)},${jsString(candidate.title)},${candidate.difficulty},` +
    `${jsString(candidate.players)},${jsString(candidate.time)},${jsString(candidate.age)},\n` +
    `    ${jsSteps(candidate.steps)},\n` +
    `    ${jsString(candidate.win)},\n` +
    `    ${jsString(candidate.safety)},\n` +
    `    ${jsString(candidate.tip)}, ${jsEquipment(candidate.equipment)}),`
  ).join("\n");
}

// Pure string transform: real data.js source in, new data.js source out.
// Locates the missions array's closing "];" STRUCTURALLY (first standalone
// "];" line after "const missions = ["), the same technique
// tools/check-mission-growth-fixture.mjs uses — never by matching nearby
// comment text, so this can't be broken by reformatting elsewhere.
export function applyToDataJsSource(dataJsSource, toImport, meta = {}) {
  const arrayStart = dataJsSource.indexOf("const missions = [");
  if (arrayStart === -1) throw new Error('could not find "const missions = [" in data.js source');
  const closeRe = /\n\];\r?\n/g;
  closeRe.lastIndex = arrayStart;
  const closeMatch = closeRe.exec(dataJsSource);
  if (!closeMatch) throw new Error('could not find the missions array\'s closing "];" in data.js source');

  const stamp = meta.timestamp || new Date().toISOString().slice(0, 10);
  const by = meta.approvedBy ? ` — approved by ${meta.approvedBy}` : "";
  const header =
    `\n  // ── Imported ${stamp}${by} via tools/import-approved-missions.mjs ──` +
    `\n  // Batch-approved missions. Same model as every mission above; ids assigned\n` +
    `  // sequentially after the previous highest id.`;

  const insertAt = closeMatch.index + 1; // right after the preceding "\n", before "];"
  const block = `${header}\n${renderMissionEntries(toImport)}\n`;
  return dataJsSource.slice(0, insertAt) + block + dataJsSource.slice(insertAt);
}

/* ── cache/version bump helpers (pure — take a string, return a string) ──── */
export function bumpCacheName(current) {
  const match = current.match(/^(.*-v)(\d+)$/);
  if (!match) throw new Error(`CACHE_NAME "${current}" doesn't match the expected "...-vNNN" shape`);
  return `${match[1]}${Number(match[2]) + 1}`;
}

export function bumpQueryVersion(current, today /* "YYYYMMDD" */) {
  const match = current.match(/^(\d{8})-(\d+)$/);
  if (match && match[1] === today) {
    return `${today}-${Number(match[2]) + 1}`;
  }
  return `${today}-1`;
}

function todayStamp() {
  const d = new Date();
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
}

/* ── report formatting ────────────────────────────────────────────────────── */
export function formatDryRunReport(plan, { mode = "dry-run" } = {}) {
  if (plan.fatal) {
    return [`❌ Batch is unusable:`, ...plan.fatal.map((e) => `  · ${e}`)].join("\n");
  }

  const lines = [];
  lines.push(`Approved-mission-batch import plan (${mode.toUpperCase()})`);
  lines.push("");
  lines.push(`  current mission count   ${plan.totalBefore}`);
  lines.push(`  proposed mission count  ${plan.totalAfter} (+${plan.toImport.length})`);
  lines.push(`  mission id ceiling      ${plan.missionIdMax} (src/worker.js MISSION_ID_MAX)`);
  lines.push("");

  lines.push(`  proposed new mission ids:`);
  if (plan.toImport.length === 0) {
    lines.push(`    (none)`);
  } else {
    for (const { id, candidate } of plan.toImport) {
      lines.push(`    ${id}  [${candidate.pack}]  ${candidate.title}`);
    }
  }
  lines.push("");

  lines.push(`  target packs / resulting pack counts:`);
  const touchedPacks = new Set(plan.toImport.map((x) => x.candidate.pack));
  const packKeysToShow = touchedPacks.size
    ? [...touchedPacks]
    : Object.keys(plan.packCountsBefore);
  for (const key of packKeysToShow) {
    const before = plan.packCountsBefore[key] ?? 0;
    const after = plan.packCountsAfter[key] ?? before;
    const delta = after - before;
    lines.push(`    ${key.padEnd(16)} ${before} -> ${after}${delta ? ` (+${delta})` : ""}`);
  }
  lines.push("");

  lines.push(`  files that WOULD change:`);
  if (plan.filesThatWouldChange.length === 0) {
    lines.push(`    (none — nothing approved+valid to import)`);
  } else {
    for (const f of plan.filesThatWouldChange) lines.push(`    ${f}`);
  }
  lines.push("");

  lines.push(`  validation:`);
  lines.push(`    approved+valid   ${plan.toImport.length}`);
  lines.push(`    not APPROVED     ${plan.notApproved.length}${plan.notApproved.length ? "  (skipped, not an error)" : ""}`);
  for (const { index, candidate } of plan.notApproved) {
    lines.push(`      batch[${index}] "${candidate.title}" — verdict: ${candidate.auditor_verdict}`);
  }
  lines.push(`    invalid          ${plan.invalid.length}${plan.invalid.length ? "  (BLOCKS those candidates only)" : ""}`);
  for (const { index, candidate, errors } of plan.invalid) {
    const label = candidate && candidate.title ? `"${candidate.title}"` : "(unreadable)";
    lines.push(`      batch[${index}] ${label}:`);
    for (const e of errors) lines.push(`        - ${e}`);
  }
  lines.push("");

  lines.push(`  test plan (run after a real APPLY):`);
  for (const t of plan.testPlan) lines.push(`    ${t}`);

  return lines.join("\n");
}

/* ── APPLY: the only place that writes files ─────────────────────────────── */
export function writeApply({
  root = DEFAULT_REPO_ROOT,
  plan,
  current,
  approvedBy,
  skipMetaRegen = false,
  skipCacheBump = false,
  skipTests = false,
} = {}) {
  if (!approvedBy || !String(approvedBy).trim()) {
    throw new Error("writeApply requires a non-empty approvedBy — this is the approval gate, not a formality");
  }
  if (plan.toImport.length === 0) {
    return { written: false, reason: "nothing approved+valid to import — no-op, no files touched", testResults: [] };
  }

  const dataJsPath = path.join(root, "data.js");
  const newDataJs = applyToDataJsSource(current.source, plan.toImport, {
    approvedBy,
    timestamp: new Date().toISOString().slice(0, 10),
  });
  writeFileSync(dataJsPath, newDataJs);

  const changed = ["data.js"];

  if (!skipMetaRegen) {
    const metaPath = path.join(root, "data/missions-meta.json");
    const meta = buildMeta(dataJsPath);
    writeFileSync(metaPath, serialiseMeta(meta));
    changed.push("data/missions-meta.json");
  }

  if (!skipCacheBump) {
    const swPath = path.join(root, "service-worker.js");
    if (existsSync(swPath)) {
      const swSrc = readFileSync(swPath, "utf8");
      const nameMatch = swSrc.match(/const CACHE_NAME = "([^"]+)";/);
      if (nameMatch) {
        const bumped = bumpCacheName(nameMatch[1]);
        writeFileSync(swPath, swSrc.replace(nameMatch[0], `const CACHE_NAME = "${bumped}";`));
        changed.push("service-worker.js");
      }
    }

    const indexPath = path.join(root, "index.html");
    if (existsSync(indexPath)) {
      let indexSrc = readFileSync(indexPath, "utf8");
      const today = todayStamp();
      let touched = false;
      for (const file of ["data.js", "app.js"]) {
        const re = new RegExp(`(${file}\\?v=)(\\d{8}-\\d+)`);
        const m = indexSrc.match(re);
        if (m) {
          indexSrc = indexSrc.replace(re, `$1${bumpQueryVersion(m[2], today)}`);
          touched = true;
        }
      }
      if (touched) {
        writeFileSync(indexPath, indexSrc);
        changed.push("index.html");
      }
    }

    const lockScript = path.join(root, "tools/check-core-assets.sh");
    if (existsSync(lockScript) && existsSync(swPath)) {
      try {
        execFileSync("bash", [lockScript, "--update"], { cwd: root, stdio: "pipe" });
        changed.push("tools/core-assets.lock");
      } catch (e) {
        // Reported, not swallowed — but does not undo the writes above.
        // eslint-disable-next-line no-console
        console.error(`  ! tools/core-assets.lock could not be regenerated: ${e.message}`);
      }
    }
  }

  const testResults = [];
  if (!skipTests) {
    const tests = [
      ["tools/check-mission-schema.mjs", []],
      ["tools/derive-missions-meta.mjs", ["--check"]],
      ["tools/check-mission-growth-fixture.mjs", []],
    ];
    for (const [rel, args] of tests) {
      const scriptPath = path.join(root, rel);
      if (!existsSync(scriptPath)) {
        testResults.push({ name: rel, status: "skipped", detail: "not present in this root" });
        continue;
      }
      try {
        execFileSync("node", [scriptPath, ...args], { cwd: root, stdio: "pipe" });
        testResults.push({ name: rel, status: "pass" });
      } catch (e) {
        testResults.push({ name: rel, status: "fail", detail: e.stdout ? e.stdout.toString() : e.message });
      }
    }
  }

  return { written: true, changed, testResults };
}

/* ── CLI ───────────────────────────────────────────────────────────────── */
async function main() {
  const args = parseArgs(process.argv.slice(2));
  const batchPath = args._[0];
  if (!batchPath) {
    console.error("Usage: node tools/import-approved-missions.mjs <batch.json> [--mode=dry-run|apply] [--approved-by=NAME] [--approved-count=N] [--repo-root=DIR] [--json]");
    process.exit(1);
  }

  const mode = args.mode || "dry-run";
  if (mode !== "dry-run" && mode !== "apply") {
    console.error(`Unknown --mode "${mode}" — must be "dry-run" or "apply". Defaulting away from apply is deliberate: dry-run is the default.`);
    process.exit(1);
  }

  const root = args["repo-root"] ? path.resolve(args["repo-root"]) : DEFAULT_REPO_ROOT;

  let batch;
  try {
    batch = JSON.parse(readFileSync(path.resolve(batchPath), "utf8"));
  } catch (e) {
    console.error(`❌ Could not read/parse batch file "${batchPath}": ${e.message}`);
    process.exit(1);
  }

  const current = loadCurrentData(root);
  const plan = planImport(batch, current, root);

  if (plan.fatal) {
    console.log(args.json ? JSON.stringify({ fatal: plan.fatal }, null, 2) : formatDryRunReport(plan, { mode }));
    process.exit(1);
  }

  if (args.json) {
    console.log(JSON.stringify(plan, null, 2));
  } else {
    console.log(formatDryRunReport(plan, { mode }));
  }

  if (mode === "dry-run") {
    console.log("\nDRY_RUN complete — no files were modified.");
    if (plan.toImport.length > 0) {
      console.log(
        `To apply exactly this plan: --mode=apply --approved-by="<your name>" --approved-count=${plan.toImport.length}`
      );
    }
    process.exit(0);
  }

  // mode === "apply" — the mandatory human approval gate.
  const approvedBy = args["approved-by"];
  const approvedCountRaw = args["approved-count"];
  if (!approvedBy || typeof approvedBy !== "string" || !approvedBy.trim()) {
    console.error("\n❌ APPLY refused: --approved-by=\"<name>\" is required and was not provided.");
    console.error("   No repo write. No PR. No merge. No deployment.");
    process.exit(1);
  }
  const approvedCount = Number(approvedCountRaw);
  if (!Number.isInteger(approvedCount) || approvedCount !== plan.toImport.length) {
    console.error(
      `\n❌ APPLY refused: --approved-count=${JSON.stringify(approvedCountRaw)} does not match the plan's ${plan.toImport.length} approved+valid mission(s).`
    );
    console.error("   Re-read the DRY_RUN report above, then pass the exact count you are approving.");
    console.error("   No repo write. No PR. No merge. No deployment.");
    process.exit(1);
  }

  console.log(`\n✅ Approval gate satisfied — approved by "${approvedBy}" for ${approvedCount} mission(s). Writing...`);
  const result = writeApply({
    root,
    plan,
    current,
    approvedBy,
    skipMetaRegen: !!args["skip-meta-regen"],
    skipCacheBump: !!args["skip-cache-bump"],
    skipTests: !!args["skip-tests"],
  });

  if (!result.written) {
    console.log(`Nothing written: ${result.reason}`);
    process.exit(0);
  }

  console.log(`\nFiles changed:`);
  for (const f of result.changed) console.log(`  ${f}`);

  if (result.testResults.length) {
    console.log(`\nPost-apply tests:`);
    let anyFail = false;
    for (const t of result.testResults) {
      console.log(`  ${t.status === "pass" ? "ok  " : t.status === "skipped" ? "skip" : "FAIL"} ${t.name}`);
      if (t.status === "fail") {
        anyFail = true;
        console.log(`       ${t.detail.split("\n").slice(-5).join("\n       ")}`);
      }
    }
    if (anyFail) {
      console.error("\n❌ One or more post-apply tests failed. Review the writes above before committing.");
      process.exit(1);
    }
  }

  console.log("\n✅ Import applied and verified. This script did not commit, push, open a PR, merge, or deploy — those stay explicit human steps.");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}

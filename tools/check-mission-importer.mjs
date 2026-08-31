#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
 * check-mission-importer.mjs — regression suite for
 * tools/import-approved-missions.mjs.
 *
 * Everything here either (a) calls the importer's exported pure functions
 * directly and reads real data.js/src/worker.js (read-only, safe), or
 * (b) runs the importer's real CLI --mode=apply write path against a
 * throwaway temp sandbox created under the OS temp dir and destroyed at the
 * end of the run. NOTHING in this file ever writes to the real repo's
 * data.js, data/missions-meta.json, service-worker.js, index.html, or
 * tools/core-assets.lock. The final check re-reads the real data.js and
 * asserts it is byte-identical to what this script started with.
 *
 *   node tools/check-mission-importer.mjs
 *
 * Exit 1 on any contract violation.
 * ══════════════════════════════════════════════════════════════════════════*/
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import { execFileSync } from "node:child_process";

import {
  validateCandidateShape,
  planImport,
  loadCurrentData,
  applyToDataJsSource,
  bumpCacheName,
  bumpQueryVersion,
} from "./import-approved-missions.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const IMPORTER = path.join(ROOT, "tools/import-approved-missions.mjs");

let failures = 0;
function check(label, condition, detail = "") {
  if (condition) { console.log(`  ok   ${label}`); return; }
  failures++;
  console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
}

console.log("Mission importer contract\n");

const VALID_CANDIDATE = Object.freeze({
  title: "Regression Test Mission",
  pack: "Aim Master",
  difficulty: 2,
  players: "2",
  time: "90s",
  age: "5+",
  equipment: { paddles: 2, balls: 1 },
  steps: ["Step one", "Step two"],
  win: "Win text",
  safety: "Safety text",
  tip: "Tip text",
  auditor_verdict: "APPROVED",
});

const current = loadCurrentData(ROOT);
const currentMaxId = current.missions.reduce((mx, m) => Math.max(mx, m.id), 0);

/* ── 1. missing required field ───────────────────────────────────────────── */
{
  const { safety, ...missingSafety } = VALID_CANDIDATE;
  const errors = validateCandidateShape(missingSafety, 0);
  check("missing required field is rejected", errors.some((e) => e.includes('missing "safety"')), errors.join("; "));
}

/* ── 2. invalid pack ──────────────────────────────────────────────────────── */
{
  const plan = planImport([{ ...VALID_CANDIDATE, title: "Invalid Pack Mission", pack: "Not A Real Pack" }], current, ROOT);
  check("invalid pack blocks the candidate, not the whole batch", plan.invalid.length === 1 && plan.toImport.length === 0, JSON.stringify(plan.invalid));
  check("invalid pack error names the pack", (plan.invalid[0]?.errors || []).some((e) => e.includes("does not exist in data.js's PACKS")));
}

/* ── 3. non-approved auditor verdict ─────────────────────────────────────── */
{
  const plan = planImport([{ ...VALID_CANDIDATE, title: "Needs Revision Mission", auditor_verdict: "NEEDS_REVISION" }], current, ROOT);
  check("non-APPROVED verdict is skipped, not imported", plan.notApproved.length === 1 && plan.toImport.length === 0);
  check("non-APPROVED verdict is not counted as invalid (it isn't an error)", plan.invalid.length === 0);
}
{
  const errors = validateCandidateShape({ ...VALID_CANDIDATE, auditor_verdict: "MAYBE" }, 0);
  check("an unrecognised verdict string fails shape validation", errors.some((e) => e.includes("auditor_verdict")));
}

/* ── 4. duplicate ids ─────────────────────────────────────────────────────── */
{
  const existingId = current.missions[0].id;
  const plan = planImport([{ ...VALID_CANDIDATE, title: "Colliding Id Mission", suggested_id: existingId }], current, ROOT);
  check("suggested_id colliding with an existing mission id is rejected", plan.invalid.length === 1 && plan.toImport.length === 0, JSON.stringify(plan.invalid));
}
{
  const plan = planImport([
    { ...VALID_CANDIDATE, title: "Dup Id A", suggested_id: 9001 },
    { ...VALID_CANDIDATE, title: "Dup Id B", pack: "Focus Control", suggested_id: 9001 },
  ], current, ROOT);
  check("two candidates sharing a suggested_id are both rejected", plan.invalid.length === 2 && plan.toImport.length === 0);
}
{
  const plan = planImport([
    { ...VALID_CANDIDATE, title: "Sequential Id A" },
    { ...VALID_CANDIDATE, title: "Sequential Id B", pack: "Focus Control" },
  ], current, ROOT);
  const ids = plan.toImport.map((x) => x.id);
  check(
    "assigned ids are sequential, strictly above the current max, and unique",
    ids.length === 2 && ids[0] === currentMaxId + 1 && ids[1] === currentMaxId + 2 && new Set(ids).size === 2
  );
}

/* ── 5. duplicate titles ──────────────────────────────────────────────────── */
{
  const existingTitle = current.missions[0].title;
  const plan = planImport([{ ...VALID_CANDIDATE, title: existingTitle }], current, ROOT);
  check("duplicate title against an existing mission is rejected", plan.invalid.length === 1 && plan.toImport.length === 0);
}
{
  const plan = planImport([
    { ...VALID_CANDIDATE, title: "Same Title Twice" },
    { ...VALID_CANDIDATE, title: "Same Title Twice", pack: "Focus Control" },
  ], current, ROOT);
  check("duplicate title within the batch rejects both occurrences", plan.invalid.length === 2 && plan.toImport.length === 0);
}

/* ── 6. mission id ceiling (src/worker.js MISSION_ID_MAX) ────────────────── */
{
  const nearCeiling = {
    ...current,
    missions: [...current.missions, { ...current.missions[0], id: 200, title: "zzz ceiling filler" }],
  };
  const plan = planImport([{ ...VALID_CANDIDATE, title: "Over The Ceiling Mission" }], nearCeiling, ROOT);
  check(
    "assigning an id past MISSION_ID_MAX demotes the candidate to invalid instead of wrapping",
    plan.toImport.length === 0 && plan.invalid.length === 1,
    JSON.stringify(plan.invalid)
  );
}

/* ── 7. dynamic mission count after a HYPOTHETICAL import ────────────────
 * The real payoff: render the importer's own output, eval it in a fresh VM,
 * and prove the REAL (unmodified) BADGES check functions require the NEW
 * totals — the same technique tools/check-mission-growth-fixture.mjs uses
 * for a hand-written fixture, run here through the actual importer code. */
{
  const plan = planImport([
    { ...VALID_CANDIDATE, title: "Growth Fixture A" },
    { ...VALID_CANDIDATE, title: "Growth Fixture B" },
    { ...VALID_CANDIDATE, title: "Growth Fixture C" },
  ], current, ROOT);
  check("setup: 3 valid candidates all planned for import", plan.toImport.length === 3, JSON.stringify(plan.invalid));

  const grownSource = applyToDataJsSource(current.source, plan.toImport, { approvedBy: "regression test" });
  const grown = vm.runInContext(
    `${grownSource}\n;({ missions, PACKS, BADGES });`,
    vm.createContext({}),
    { filename: "grown-data.js" }
  );

  check("hypothetical import increases missions.length by exactly the batch size", grown.missions.length === current.missions.length + 3);

  const packBadge = grown.BADGES.find((b) => b.pack === "Aim Master");
  const packIds = grown.missions.filter((m) => m.pack === "Aim Master").map((m) => m.id);
  const allButOnePack = new Set(packIds.slice(0, -1));
  const allPack = new Set(packIds);
  check(
    "grown pack badge requires the NEW pack total (old total is not enough)",
    !packBadge.check(allButOnePack) && packBadge.check(allPack)
  );

  const champBadge = grown.BADGES.find((b) => b.id === "champ");
  const allIds = new Set(grown.missions.map((m) => m.id));
  const allButOneOverall = new Set([...allIds].slice(0, -1));
  check(
    "grown champion badge requires the NEW total (old 36 is not enough)",
    !champBadge.check(allButOneOverall) && champBadge.check(allIds)
  );

  check("no functional /36-style hardcoding crept back in: champ req text mentions the new total", champBadge.req.includes(String(grown.missions.length)));
}

/* ── 8. cache/version bump helpers are correct pure functions ────────────── */
check("bumpCacheName increments the trailing version", bumpCacheName("jumvi-missions-v246") === "jumvi-missions-v247");
check("bumpQueryVersion increments a same-day suffix", bumpQueryVersion("20260831-1", "20260831") === "20260831-2");
check("bumpQueryVersion resets to -1 on a new day", bumpQueryVersion("20260831-3", "20260901") === "20260901-1");

/* ── 9. APPLY write path + mandatory approval gate, fully sandboxed ──────── */
{
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "jumvi-importer-test-"));
  const realDataJsBefore = fs.readFileSync(path.join(ROOT, "data.js"), "utf8");
  try {
    fs.mkdirSync(path.join(sandbox, "src"));
    fs.mkdirSync(path.join(sandbox, "data"));
    fs.copyFileSync(path.join(ROOT, "data.js"), path.join(sandbox, "data.js"));
    fs.copyFileSync(path.join(ROOT, "src/worker.js"), path.join(sandbox, "src/worker.js"));
    // Deliberately NOT copying service-worker.js / index.html / core-assets
    // tooling -- writeApply's existsSync guards must skip them cleanly, and
    // it does not touch anything outside data.js + data/missions-meta.json.

    const batchPath = path.join(sandbox, "batch.json");
    fs.writeFileSync(batchPath, JSON.stringify([{ ...VALID_CANDIDATE, title: "Sandbox Apply Mission" }], null, 2));

    let refusedNoApprover = false;
    try {
      execFileSync("node", [IMPORTER, batchPath, `--repo-root=${sandbox}`, "--mode=apply", "--approved-count=1"], { stdio: "pipe" });
    } catch (e) {
      refusedNoApprover = e.status === 1;
    }
    const untouchedAfterRefusal = fs.readFileSync(path.join(sandbox, "data.js"), "utf8") === fs.readFileSync(path.join(ROOT, "data.js"), "utf8");
    check("APPLY without --approved-by is refused and writes nothing", refusedNoApprover && untouchedAfterRefusal);

    let refusedBadCount = false;
    try {
      execFileSync("node", [IMPORTER, batchPath, `--repo-root=${sandbox}`, "--mode=apply", "--approved-by=Test", "--approved-count=99"], { stdio: "pipe" });
    } catch (e) {
      refusedBadCount = e.status === 1;
    }
    const untouchedAfterBadCount = fs.readFileSync(path.join(sandbox, "data.js"), "utf8") === fs.readFileSync(path.join(ROOT, "data.js"), "utf8");
    check("APPLY with a mismatched --approved-count is refused and writes nothing", refusedBadCount && untouchedAfterBadCount);

    execFileSync(
      "node",
      [IMPORTER, batchPath, `--repo-root=${sandbox}`, "--mode=apply", "--approved-by=Test Approver", "--approved-count=1"],
      { stdio: "pipe" }
    );

    const sandboxSource = fs.readFileSync(path.join(sandbox, "data.js"), "utf8");
    check("a correctly-approved APPLY wrote the new mission into the sandbox data.js", sandboxSource.includes("Sandbox Apply Mission"));

    const sandboxData = vm.runInContext(
      `${sandboxSource}\n;({ missions, PACKS, BADGES });`,
      vm.createContext({}),
      { filename: "sandbox-data.js" }
    );
    check(
      "sandbox data.js is still syntactically valid after APPLY, with the right count",
      sandboxData.missions.length === current.missions.length + 1
    );

    const metaPath = path.join(sandbox, "data/missions-meta.json");
    check("APPLY regenerated data/missions-meta.json in the sandbox", fs.existsSync(metaPath));
    if (fs.existsSync(metaPath)) {
      const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
      check("regenerated meta's mission_count matches the sandbox data.js", meta.mission_count === sandboxData.missions.length);
    }
  } finally {
    fs.rmSync(sandbox, { recursive: true, force: true });
  }

  const realDataJsAfter = fs.readFileSync(path.join(ROOT, "data.js"), "utf8");
  check("the REAL repo's data.js was never touched by any sandboxed run in this test", realDataJsAfter === realDataJsBefore);
}

/* ── 10. DRY_RUN against the real repo never writes anything ─────────────── */
{
  const before = fs.statSync(path.join(ROOT, "data.js")).mtimeMs;
  execFileSync("node", [IMPORTER, path.join(ROOT, "tools/fixtures/approved-mission-batch.example.json")], { stdio: "pipe" });
  const after = fs.statSync(path.join(ROOT, "data.js")).mtimeMs;
  check("DRY_RUN against the real repo does not modify data.js (mtime unchanged)", before === after);
}

if (failures) {
  console.log(`\n❌ ${failures} mission importer contract failure(s).`);
  process.exit(1);
}
console.log("\n✅ Validation, id-assignment, dynamic-count-scaling, and the APPLY approval gate all behave correctly.");

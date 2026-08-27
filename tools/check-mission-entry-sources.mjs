#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
 * mission_entry source-map guard — Locked v1 review follow-up.
 *
 * A previous version of this feature let an unclassified openMission() call
 * silently read as "browse", which would have quietly inflated the Browse
 * tab's numbers with every call site nobody had gotten around to labeling.
 * This file makes that impossible to reintroduce:
 *
 *   1. Every openMission() call in the actual production code (app.js,
 *      jumvi-hub-app.js) — not the function definition itself — must pass an
 *      explicit second argument. A call with only one argument fails this
 *      check, by design: a new call site MUST make a deliberate source
 *      decision before it ships, not inherit a default silently.
 *   2. The runtime default (when app.js's own fallback logic is reached) is
 *      "unknown", never "browse" — checked directly against the source text
 *      of openMission()'s fallback line.
 *   3. src/worker.js rejects any mission_entry payload whose source isn't in
 *      the closed 9-value enum (no free text, no typo silently becoming a
 *      new "source").
 *   4. A valid mission_entry payload's id and source land in the exact WAE
 *      columns the frozen schema expects (double1 = id, blob2 = source).
 *   5. generate-weekly-snapshot.mjs's mission × source cross-tab (see
 *      tools/generate-weekly-snapshot.mjs's applyMissionEntryRows) folds a
 *      synthetic row set into the exact expected per-mission breakdown.
 *   6. openMission()'s trackEntry gate — reused internally to refresh/
 *      re-render the SAME already-open mission (undo, un-mark done,
 *      post-completion redraw) — is wired at the exact 3 call sites that
 *      must not double-count a re-render as a new mission_entry, and the
 *      Family Board tile (a real entry, just a distinct surface) uses its
 *      own "family" source rather than "unknown".
 *
 * Run: node tools/check-mission-entry-sources.mjs
 * ═══════════════════════════════════════════════════════════════════════════ */
import { readFileSync } from "node:fs";
import { buildDataPoint } from "../src/worker.js";
import { applyMissionEntryRows } from "./generate-weekly-snapshot.mjs";

let failures = 0;
function check(label, condition, detail = "") {
  if (condition) { console.log(`  ok    ${label}`); return; }
  failures++;
  console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
}
/** Final review follow-up: check() takes a boolean condition. Several
 *  assertions below used to call check(label, actual, expected) instead —
 *  since `actual` is truthy for any non-zero/non-empty value, that silently
 *  passed regardless of whether `actual` matched `expected` at all (e.g. a
 *  cross-tab count of 2 would still PASS a check written to expect 3). Real
 *  actual-vs-expected assertions must go through this instead. */
function checkEqual(label, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  check(label, a === e, `expected ${e}, actual ${a}`);
}

const MISSION_ENTRY_SOURCES = [
  "today", "browse", "random", "resume", "coach", "island", "next", "family", "unknown",
];

console.log("1 — every production openMission() call carries an explicit source\n");

/** Strips // and /* *\/ comments so a doc comment that merely MENTIONS
 *  "openMission()" (no args, by name, as prose) can't be mistaken for a real
 *  zero-argument call. */
function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^[ \t]*\/\/.*$/gm, "")
    .replace(/([^:"'])\/\/.*$/gm, "$1");
}

/**
 * Finds every `openMission(` call expression in a source file and returns
 * each one's top-level argument count. Manual balanced-paren scan, not a
 * regex — `openMission(Number(t.dataset.mission), "unknown")` nests a call
 * inside the first argument, which a non-greedy `[^)]*` regex cuts off at
 * the WRONG closing paren. Robust enough for this codebase's call style
 * (no string literal ever contains an unbalanced paren at a call site), and
 * a false failure here is cheap to fix by hand, unlike a silent "browse".
 */
function findOpenMissionCalls(source, file) {
  const clean = stripComments(source);
  const calls = [];
  const marker = "openMission(";
  let searchFrom = 0;
  for (;;) {
    const start = clean.indexOf(marker, searchFrom);
    if (start === -1) break;
    searchFrom = start + marker.length;
    // Skip the function's own definition: "function openMission(id, source)".
    const before = clean.slice(Math.max(0, start - 10), start);
    if (/function\s+$/.test(before)) continue;

    // Balanced-paren scan from just after "openMission(" to its matching ")".
    let depth = 1;
    let i = searchFrom;
    let inString = null;
    for (; i < clean.length && depth > 0; i++) {
      const ch = clean[i];
      if (inString) {
        if (ch === "\\") { i++; continue; }
        if (ch === inString) inString = null;
        continue;
      }
      if (ch === '"' || ch === "'" || ch === "`") { inString = ch; continue; }
      if (ch === "(") depth++;
      else if (ch === ")") depth--;
    }
    const argsText = clean.slice(searchFrom, i - 1);
    const line = clean.slice(0, start).split("\n").length;

    // Split on top-level commas only (depth-aware, so a nested call's own
    // comma-separated arguments never get mistaken for a second top-level one).
    let topLevelCommas = 0;
    let d = 0;
    let str = null;
    for (const ch of argsText) {
      if (str) { if (ch === str) str = null; continue; }
      if (ch === '"' || ch === "'" || ch === "`") { str = ch; continue; }
      if (ch === "(" || ch === "[" || ch === "{") d++;
      else if (ch === ")" || ch === "]" || ch === "}") d--;
      else if (ch === "," && d === 0) topLevelCommas++;
    }
    const argCount = argsText.trim() === "" ? 0 : topLevelCommas + 1;
    calls.push({ file, line, argCount, text: `openMission(${argsText})` });
  }
  return calls;
}

const appJs = readFileSync("app.js", "utf8");
const hubJs = readFileSync("jumvi-hub-app.js", "utf8");
const calls = [...findOpenMissionCalls(appJs, "app.js"), ...findOpenMissionCalls(hubJs, "jumvi-hub-app.js")];

check(`found production openMission() call sites (expected at least 20, saw ${calls.length})`, calls.length >= 20);

const missingSource = calls.filter((c) => c.argCount < 2);
check("every call site passes an explicit second (source) argument", missingSource.length === 0,
  missingSource.length
    ? missingSource.map((c) => `${c.file}:${c.line} — ${c.text}`).join("; ")
    : "");

console.log("\n2 — the runtime default is \"unknown\", never \"browse\"\n");
const fallbackLine = appJs.match(/const entrySource = MISSION_ENTRY_SOURCES\.includes\(source\) \? source : "([a-z]+)";/);
check("openMission()'s unclassified-source fallback exists", !!fallbackLine);
if (fallbackLine) {
  check(`fallback is "unknown" (found "${fallbackLine[1]}")`, fallbackLine[1] === "unknown");
}

console.log("\n3 — Worker rejects anything outside the 9-value enum\n");
for (const s of MISSION_ENTRY_SOURCES) {
  check(`accepts source "${s}"`, buildDataPoint({ e: "mission_entry", id: 1, source: s }) !== null);
}
for (const bad of ["Browse", "browse ", "search_engine", "", null, undefined, 123]) {
  check(`rejects source ${JSON.stringify(bad)}`, buildDataPoint({ e: "mission_entry", id: 1, source: bad }) === null);
}

console.log("\n4 — valid mission_entry lands in the exact frozen columns\n");
checkEqual("id -> double1, source -> blob2",
  buildDataPoint({ e: "mission_entry", id: 17, source: "today" }),
  { blobs: ["mission_entry", "today"], doubles: [17], indexes: ["mission_entry"] });

console.log("\n5 — mission x source cross-tab folds synthetic rows correctly\n");
// The exact fixture from the review request: mission 1 gets 3 "today" + 2
// "coach"; mission 2 gets 4 "browse" + 1 "random".
const rows = [
  { source: "today", mission: 1, n: 3 },
  { source: "coach", mission: 1, n: 2 },
  { source: "browse", mission: 2, n: 4 },
  { source: "random", mission: 2, n: 1 },
];
const missions = new Map();
const totals = Object.fromEntries(MISSION_ENTRY_SOURCES.map((s) => [s, 0]));
applyMissionEntryRows(rows, missions, totals);

const m1 = missions.get("1");
const m2 = missions.get("2");
check("mission 1 exists after folding", !!m1);
checkEqual("mission 1: today = 3", m1?.entry_sources?.today, 3);
checkEqual("mission 1: coach = 2", m1?.entry_sources?.coach, 2);
const m1OtherSources = m1 && Object.fromEntries(
  Object.entries(m1.entry_sources).filter(([k]) => k !== "today" && k !== "coach"));
const m1OtherExpected = m1 && Object.fromEntries(
  MISSION_ENTRY_SOURCES.filter((s) => s !== "today" && s !== "coach").map((s) => [s, 0]));
checkEqual("mission 1: every other source is zero-filled (not missing)", m1OtherSources, m1OtherExpected);
check("mission 2 exists after folding", !!m2);
checkEqual("mission 2: browse = 4", m2?.entry_sources?.browse, 4);
checkEqual("mission 2: random = 1", m2?.entry_sources?.random, 1);
checkEqual("overall total: today = 3", totals.today, 3);
checkEqual("overall total: coach = 2", totals.coach, 2);
checkEqual("overall total: browse = 4", totals.browse, 4);
checkEqual("overall total: random = 1", totals.random, 1);
const untouchedTotals = Object.fromEntries(["resume", "island", "next", "family", "unknown"].map((s) => [s, totals[s]]));
checkEqual("overall total: sources never touched stay 0", untouchedTotals,
  { resume: 0, island: 0, next: 0, family: 0, unknown: 0 });

// An unknown source in the raw data (should be unreachable through the
// Worker's own allowlist, but the fold function must not silently accept it
// as a new bucket if it ever happens — e.g. replayed/malformed rows).
const missionsWithBad = new Map();
const totalsWithBad = Object.fromEntries(MISSION_ENTRY_SOURCES.map((s) => [s, 0]));
applyMissionEntryRows([{ source: "totally-made-up", mission: 5, n: 9 }], missionsWithBad, totalsWithBad);
check("a source outside the enum is not silently added as a new bucket",
  !("totally-made-up" in totalsWithBad) && !missionsWithBad.has("5"));

console.log("\n6 — internal re-renders never double-count as a new mission_entry\n");
// openMission() is reused internally to refresh the SAME already-open sheet
// (un-mark done, post-completion redraw). Those 2 sites must pass
// { trackEntry: false } as a 3rd argument — a review follow-up correction
// after an earlier version of this feature let them fire a full
// mission_entry (just labeled "unknown"), which double-counted a re-render
// as a new discovery event.
const trackEntryGate = appJs.match(/const trackEntry = (.+);/);
check("openMission() computes a trackEntry gate", !!trackEntryGate);
if (trackEntryGate) {
  check("gate defaults to true when opts is absent/doesn't say otherwise",
    trackEntryGate[1].includes("opts") && trackEntryGate[1].includes("trackEntry"));
}
const trackEntryBlock = appJs.match(/if\(trackEntry\)\{([\s\S]{0,1200}?)\n {2}\}/);
check("mission_entry beacon call is inside the trackEntry-gated block",
  !!trackEntryBlock && trackEntryBlock[1].includes('beacon("mission_entry"'));
check("_missionExitBeaconed reset is inside the trackEntry-gated block, not unconditional",
  !!trackEntryBlock && trackEntryBlock[1].includes("_missionExitBeaconed = false;"));

const refreshSites = [
  { label: "post-completion non-hub refresh", pattern: /not a new discovery event, so mission_entry must not fire again\.\s*\n\s*openMission\(id, "unknown", \{ trackEntry: false \}\);/ },
  { label: "toggle-done un-mark-done reopen", pattern: /openMission\(lastOpenedId, "unknown", \{ trackEntry: false \}\);/ },
];
for (const site of refreshSites) {
  check(`${site.label} passes { trackEntry: false }`, site.pattern.test(appJs));
}
check(`exactly ${refreshSites.length} call sites pass trackEntry: false (no more, no fewer)`,
  (appJs.match(/openMission\([^)]*\{ trackEntry: false \}\)/g) || []).length === refreshSites.length);

console.log("\n7 — Family Board tile is a real entry with its own \"family\" source\n");
check("Family Board tile tap uses source \"family\", not \"unknown\"",
  /openMission\(Number\(t\.dataset\.mission\), "family"\)/.test(appJs));
check("Worker accepts source \"family\"",
  buildDataPoint({ e: "mission_entry", id: 1, source: "family" }) !== null);

if (failures) {
  console.log(`\n❌ ${failures} mission_entry source-map failure(s).`);
  process.exit(1);
}
console.log("\n✅ Every production call site is explicit, the fallback is honest, and the cross-tab folds correctly.");

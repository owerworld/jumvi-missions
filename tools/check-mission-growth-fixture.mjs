#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
 * check-mission-growth-fixture.mjs — proves growth needs no manual totals.
 *
 * WHY THIS EXISTS
 * The Dynamic Mission Catalog hardening removed every hardcoded "36" /
 * "/6" assumption from data.js and app.js in favor of deriving totals from
 * missions.length and per-pack missions.filter(...).length. This test is the
 * regression guard for that promise: it never edits data.js on disk. Instead
 * it takes the REAL source, injects a handful of fixture missions into an
 * EXISTING pack purely in memory, and asserts that the REAL (unmodified)
 * BADGES check functions and the mission total both scale automatically.
 *
 * If a future change reintroduces a hardcoded total (in data.js or in a
 * check function this script exercises), this fails without anyone having
 * to remember to update a magic number by hand.
 *
 *   node tools/check-mission-growth-fixture.mjs
 *
 * Exit 1 on any contract violation.
 * ══════════════════════════════════════════════════════════════════════════*/
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const ROOT = path.resolve(import.meta.dirname, "..");
const DATA_JS = path.join(ROOT, "data.js");
const src = fs.readFileSync(DATA_JS, "utf8");

const problems = [];
const fail = (msg) => problems.push(msg);

function evalDataJs(source, label) {
  const ctx = vm.createContext({});
  const wrapped = `${source}\n;({ missions, PACKS, BADGES });`;
  return vm.runInContext(wrapped, ctx, { filename: label });
}

/* ── baseline: the real, unmodified data.js ──────────────────────────────── */
const baseline = evalDataJs(src, "data.js (baseline)");
if (!Array.isArray(baseline.missions) || !baseline.missions.length) {
  fail("baseline data.js evaluated but exposed no missions array");
}

const GROWTH_PACK = "Beach/Park";
const FIXTURE_COUNT = 3; // enough to cross a pack size no existing pack has (6 -> 9)

const baselineTotal = baseline.missions.length;
const baselinePackTotal = baseline.missions.filter((m) => m.pack === GROWTH_PACK).length;
if (baselinePackTotal === 0) fail(`fixture pack "${GROWTH_PACK}" has no missions in the real data.js`);

/* ── build the fixture source: real data.js + N extra missions in an
 *    existing pack, injected right before the missions array's closing
 *    bracket. Found structurally (first "];" line after "const missions =
 *    ["), not by matching nearby comment text, so reformatting elsewhere in
 *    the file can't silently break this test. ─────────────────────────────── */
const arrayStart = src.indexOf("const missions = [");
if (arrayStart === -1) fail('could not find "const missions = [" in data.js');

const closeRe = /\n\];\r?\n/g;
closeRe.lastIndex = arrayStart;
const closeMatch = arrayStart === -1 ? null : closeRe.exec(src);
if (!closeMatch) fail('could not find the missions array\'s closing "];" in data.js');

if (problems.length) {
  console.log(`\n❌ ${problems.length} setup problem(s) — cannot build the fixture:\n`);
  for (const p of problems) console.log(`  · ${p}`);
  process.exit(1);
}

const nextId = Math.max(...baseline.missions.map((m) => m.id)) + 1;
const fixtureLines = [];
for (let i = 0; i < FIXTURE_COUNT; i++) {
  const id = nextId + i;
  fixtureLines.push(
    `  m(${id},"${GROWTH_PACK}","Fixture Mission ${id}",1,"2","60s","4+",` +
    `["Fixture step one","Fixture step two","Fixture step three"],` +
    `"Fixture win condition.","Fixture safety line.","Fixture tip.",{ paddles:2, balls:1 }),`
  );
}
const insertAt = closeMatch.index + 1; // right after the preceding "\n", before "];"
const fixtureSrc =
  src.slice(0, insertAt) + fixtureLines.join("\n") + "\n" + src.slice(insertAt);

const grown = evalDataJs(fixtureSrc, "data.js (growth fixture)");

/* ── assertions on the grown fixture, using the REAL BADGES check functions
 *    from data.js — nothing here reimplements badge logic. ───────────────── */
const grownTotal = grown.missions.length;
const grownPackTotal = grown.missions.filter((m) => m.pack === GROWTH_PACK).length;

if (grownTotal !== baselineTotal + FIXTURE_COUNT) {
  fail(`expected ${baselineTotal + FIXTURE_COUNT} missions after injecting the fixture, got ${grownTotal}`);
}
if (grownPackTotal !== baselinePackTotal + FIXTURE_COUNT) {
  fail(`expected ${baselinePackTotal + FIXTURE_COUNT} "${GROWTH_PACK}" missions after injecting the fixture, got ${grownPackTotal}`);
}

const champBadge = grown.BADGES.find((b) => b.id === "champ");
const packBadge = grown.BADGES.find((b) => b.pack === GROWTH_PACK);
if (!champBadge) fail('BADGES has no "champ" badge to test');
if (!packBadge) fail(`BADGES has no pack badge for "${GROWTH_PACK}" to test`);

if (champBadge && packBadge) {
  const allGrownIds = new Set(grown.missions.map((m) => m.id));
  const allButOneGrownIds = new Set(allGrownIds);
  allButOneGrownIds.delete([...allGrownIds].sort((a, b) => a - b).pop());

  const packIds = new Set(grown.missions.filter((m) => m.pack === GROWTH_PACK).map((m) => m.id));
  const packMinusOneIds = new Set(packIds);
  packMinusOneIds.delete([...packIds].sort((a, b) => a - b).pop());

  // Champion badge must require every one of the NEW, larger total — not the
  // old hardcoded 36 — so completing everything except the newest fixture
  // mission must NOT unlock it, and completing literally everything must.
  if (champBadge.check(allButOneGrownIds)) {
    fail(`"champ" badge unlocked with ${allButOneGrownIds.size}/${grownTotal} done — it must require all ${grownTotal}`);
  }
  if (!champBadge.check(allGrownIds)) {
    fail(`"champ" badge did NOT unlock with all ${grownTotal} missions done — it should require exactly missions.length`);
  }

  // Pack badge must require every mission in the now-9-mission pack — not
  // the old hardcoded 6 — so 8/9 must stay locked and 9/9 must unlock.
  if (packBadge.check(packMinusOneIds)) {
    fail(`"${packBadge.id}" pack badge unlocked with ${packMinusOneIds.size}/${grownPackTotal} in "${GROWTH_PACK}" done — it must require all ${grownPackTotal}`);
  }
  if (!packBadge.check(packIds)) {
    fail(`"${packBadge.id}" pack badge did NOT unlock with all ${grownPackTotal} "${GROWTH_PACK}" missions done`);
  }

  // And the badge that unlocked at the OLD pack size (6) must not still be
  // satisfied by only the old 6 out of the new 9 — that would mean the check
  // is still silently anchored to the old count.
  const oldPackIds = new Set([...packIds].sort((a, b) => a - b).slice(0, baselinePackTotal));
  if (packBadge.check(oldPackIds)) {
    fail(`"${packBadge.id}" pack badge unlocked with only the original ${baselinePackTotal} "${GROWTH_PACK}" missions done, ignoring the ${FIXTURE_COUNT} added ones`);
  }
}

/* ── report ────────────────────────────────────────────────────────────── */
console.log("Mission growth fixture\n");
console.log(`  baseline missions       ${baselineTotal}`);
console.log(`  baseline "${GROWTH_PACK}"  ${baselinePackTotal}`);
console.log(`  + fixture missions      ${FIXTURE_COUNT} (added in-memory only, data.js on disk untouched)`);
console.log(`  grown missions          ${grownTotal}`);
console.log(`  grown "${GROWTH_PACK}"     ${grownPackTotal}`);

if (problems.length) {
  console.log(`\n❌ ${problems.length} contract violation(s):\n`);
  for (const p of problems) console.log(`  · ${p}`);
  process.exit(1);
}
console.log(
  "\n✅ champion + pack badge logic, and the mission total, scale to a grown pack with zero code changes."
);

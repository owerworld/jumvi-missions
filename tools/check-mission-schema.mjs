#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
 * check-mission-schema.mjs — the data contract behind the missions array.
 *
 * Every screen in JUMVI is a projection of this array. A mission missing
 * `safety` renders a sheet with an empty safety band; a duplicate id silently
 * overwrites another mission's progress in localStorage. Neither shows up as
 * an error at runtime — the sheet just looks a little emptier than it should.
 * This is the check that makes those loud.
 *
 * Reads data.js directly (no bundler, no DOM): the file is plain script-scope
 * `const`, so it is evaluated in a throwaway VM context and the globals are
 * read back out.
 *
 *   node tools/check-mission-schema.mjs
 *
 * Exit 1 on any contract violation.
 * ══════════════════════════════════════════════════════════════════════════*/
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const ROOT = path.resolve(import.meta.dirname, "..");
const src = fs.readFileSync(path.join(ROOT, "data.js"), "utf8");

const ctx = vm.createContext({ console });
vm.runInContext(src + "\n;globalThis.__out = { missions, PACKS, BADGES };", ctx, { filename: "data.js" });
const { missions, PACKS } = ctx.__out;

const REQUIRED = ["id", "title", "pack", "difficulty", "age", "players", "time", "equipment", "steps", "win", "tip", "safety"];

const problems = [];
const fail = (msg) => problems.push(msg);

/* ── count ─────────────────────────────────────────────────────────────── *
 * No fixed EXPECTED_COUNT here on purpose: missions.length IS the count —
 * the schema contract is about shape (required fields, unique ids, every
 * mission in a declared pack), not a number that has to be hand-bumped
 * every time a mission is added. */
if (missions.length < 1) fail("missions array is empty");

/* ── required fields, per mission ──────────────────────────────────────── */
for (const mission of missions) {
  const label = `mission ${mission.id} (${mission.title || "untitled"})`;
  for (const field of REQUIRED) {
    const v = mission[field];
    if (v === undefined || v === null) { fail(`${label}: missing "${field}"`); continue; }
    if (typeof v === "string" && !v.trim()) fail(`${label}: "${field}" is empty`);
    if (Array.isArray(v) && v.length === 0) fail(`${label}: "${field}" is an empty array`);
  }

  /* steps: the sheet renders at most three; more than three means the fourth
     is written but never shown to anyone. */
  if (Array.isArray(mission.steps)) {
    if (mission.steps.length > 3) fail(`${label}: ${mission.steps.length} steps — the sheet shows 3`);
    mission.steps.forEach((s, i) => { if (!String(s).trim()) fail(`${label}: step ${i + 1} is empty`); });
  } else fail(`${label}: "steps" is not an array`);

  /* ids and difficulty are numeric contracts, not display strings */
  if (!Number.isInteger(mission.id)) fail(`${label}: id is not an integer`);
  if (![1, 2, 3].includes(mission.difficulty)) fail(`${label}: difficulty ${mission.difficulty} outside 1–3`);

  /* age / players / time formats — these are read by parents at a glance and
     by the card metadata builder, so the shapes have to be predictable */
  if (!/^\d+\+$/.test(String(mission.age))) fail(`${label}: age "${mission.age}" is not the "N+" form`);
  if (!/^\d+(–\d+)?$/.test(String(mission.players))) fail(`${label}: players "${mission.players}" is not "N" or "N–M"`);
  if (!/^\d+s$/.test(String(mission.time))) fail(`${label}: time "${mission.time}" is not "Ns"`);

  /* equipment: paddle count must cover the player count, or a family shows up
     to a mission they physically cannot run */
  const eq = mission.equipment;
  if (!eq || typeof eq !== "object") { fail(`${label}: equipment is not an object`); continue; }
  const maxPlayers = Number(String(mission.players).split("–").pop());
  const maxPaddles = Array.isArray(eq.paddles) ? eq.paddles[eq.paddles.length - 1] : eq.paddles;
  if (!Number.isInteger(maxPaddles) || maxPaddles < 1) fail(`${label}: paddles "${JSON.stringify(eq.paddles)}" is not a positive count`);
  else if (maxPaddles < maxPlayers) fail(`${label}: ${maxPlayers} players but only ${maxPaddles} paddles`);
  if (!Number.isInteger(eq.balls) || eq.balls < 1) fail(`${label}: balls "${eq.balls}" is not a positive count`);
}

/* ── unique ids ────────────────────────────────────────────────────────── */
const byId = new Map();
for (const mission of missions) {
  if (byId.has(mission.id)) fail(`duplicate mission id ${mission.id}: "${byId.get(mission.id)}" and "${mission.title}"`);
  else byId.set(mission.id, mission.title);
}

/* ── unique titles (a repeated title is a copy bug, not a data bug, but it
      reaches the child as two identical cards) ──────────────────────────── */
const byTitle = new Map();
for (const mission of missions) {
  const key = mission.title.toLowerCase();
  if (byTitle.has(key)) fail(`duplicate title "${mission.title}" on missions ${byTitle.get(key)} and ${mission.id}`);
  else byTitle.set(key, mission.id);
}

/* ── packs: every mission belongs to a declared pack, every pack is used ── */
const packKeys = new Set(PACKS.map((p) => p.key).filter((k) => k !== "all"));
const packCounts = new Map([...packKeys].map((k) => [k, 0]));
for (const mission of missions) {
  if (!packKeys.has(mission.pack)) fail(`mission ${mission.id}: pack "${mission.pack}" is not in PACKS`);
  else packCounts.set(mission.pack, packCounts.get(mission.pack) + 1);
}
for (const [key, n] of packCounts) if (n === 0) fail(`pack "${key}" has no missions`);

/* ── report ────────────────────────────────────────────────────────────── */
console.log("Mission data contract\n");
console.log(`  missions          ${missions.length}`);
console.log(`  unique ids        ${byId.size}`);
console.log(`  required fields   ${REQUIRED.join(", ")}`);
console.log("\n  per pack:");
for (const [key, n] of packCounts) {
  const name = PACKS.find((p) => p.key === key)?.name || key;
  console.log(`    ${String(n).padStart(2)}  ${key}${name !== key ? ` (${name})` : ""}`);
}

if (problems.length) {
  console.log(`\n❌ ${problems.length} contract violation(s):\n`);
  for (const p of problems) console.log(`  · ${p}`);
  process.exit(1);
}
console.log(`\n✅ ${missions.length}/${missions.length} missions satisfy the schema; ids, titles and packs are consistent.`);

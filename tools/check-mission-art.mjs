#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
 * check-mission-art.mjs — the discovery artwork must be art of THIS mission.
 *
 * Two different pictures represent a mission:
 *
 *   the detail sheet  MISSION_ICONS[id] in jumvi-mission-icons.js — inline SVG,
 *                     keyed by id, redrawn whenever the mission is redrawn.
 *   everywhere else   assets/ui/missions/NN-slug.webp — the product render on
 *                     the card, on Today's mission and in the browse list,
 *                     resolved through MISSION_SLUGS in jumvi-art.js.
 *
 * Because the second one is keyed by id and only NAMED after the title, a
 * mission can be replaced and keep the old picture with nothing broken enough
 * to notice: no 404, no missing image, correct alt text — just the wrong game
 * on the card. That is exactly what happened on 2026-08-27, when mission 21
 * stopped being "Captain Says" and became "Middle Defender": the SVG diagram
 * was redrawn, the render was not, and for nine days the card showed a
 * star-badged "captain" paddle pointing at a target.
 *
 * So this asserts the naming actually tracks the catalogue — every slug is
 * "<zero-padded id>-<slugified title>" and the file behind it exists. A
 * renamed mission then fails here on the same commit that renames it, instead
 * of quietly shipping a picture of a game that no longer exists.
 *
 *   node tools/check-mission-art.mjs
 * Exit 1 on any mismatch.
 * ══════════════════════════════════════════════════════════════════════════*/
import fs from "node:fs";
import vm from "node:vm";
import path from "node:path";

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const read = (rel) => fs.readFileSync(path.join(REPO, rel), "utf8");

/* ── Known-stale artwork ───────────────────────────────────────────────────
 * An entry here says: "we know this render shows the wrong game, a new one is
 * owed, and until it lands the mismatch is recorded rather than silent."
 * Delete the entry the moment the artwork is replaced — that is the point of
 * it being a list of one rather than a tolerance in the rule. */
const ART_PENDING = {
  // Empty, and that is the goal state. Mission 21 lived here between
  // 2026-08-27 and 2026-09-05, when its render was finally redrawn as
  // Middle Defender and the file renamed to match.
};

let failures = 0;
const check = (label, condition, detail = "") => {
  if (condition) { console.log(`  ok   ${label}`); return; }
  failures++;
  console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
};

const context = vm.createContext({ window: {} });
vm.runInContext(read("data.js") + "\n;__out={missions};", context);
const { missions } = context.__out;

const slugSource = read("jumvi-art.js").match(/const MISSION_SLUGS = \[([\s\S]*?)\];/);
if (!slugSource) {
  console.error("could not find MISSION_SLUGS in jumvi-art.js");
  process.exit(1);
}
// Index 0 is a literal `null` placeholder so ids index directly.
const slugs = [...slugSource[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);

/** "1 — 2 — 3 — GO!" -> "1-2-3-go", "2v2 Squad Count" -> "2v2-squad-count" */
const slugify = (title) =>
  String(title).toLowerCase().normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

console.log("Mission artwork registry");
check("every mission has a slug", slugs.length === missions.length,
  `${slugs.length} slug(s) for ${missions.length} mission(s)`);

const wrongName = [];
const pendingSeen = [];
for (const [index, mission] of missions.entries()) {
  const expected = `${String(mission.id).padStart(2, "0")}-${slugify(mission.title)}`;
  const actual = slugs[index];
  const pending = ART_PENDING[mission.id];
  if (actual === expected) continue;
  if (pending && pending.slug === actual) { pendingSeen.push(mission.id); continue; }
  wrongName.push(`#${mission.id} "${mission.title}" wants ${expected}, registry says ${actual}`);
}
check("every slug is <id>-<title>, so the card cannot outlive its mission",
  wrongName.length === 0, wrongName.join("; "));

const missingFile = slugs
  .filter(Boolean)
  .map((slug) => `assets/ui/missions/${slug}.webp`)
  .filter((rel) => !fs.existsSync(path.join(REPO, rel)));
check("every registered slug has a file on disk", missingFile.length === 0, missingFile.join(", "));

/* A pending entry for a mission whose artwork HAS been fixed is itself a bug:
 * it would silence a future mismatch on that id. */
const staleExceptions = Object.keys(ART_PENDING)
  .map(Number)
  .filter((id) => !pendingSeen.includes(id));
check("no exception outlives the problem it records",
  staleExceptions.length === 0,
  staleExceptions.map((id) => `#${id} is listed in ART_PENDING but its slug is correct now`).join(", "));

if (pendingSeen.length) {
  console.log("\nArtwork owed (recorded, not ignored):");
  for (const id of pendingSeen) {
    const { since, why } = ART_PENDING[id];
    console.log(`  ⚠️  #${id}  stale since ${since}`);
    console.log(`      ${why}`);
  }
}

if (failures) {
  console.log(`\n❌ ${failures} mission artwork check(s) failed.`);
  process.exit(1);
}
console.log(`\n✅ ${missions.length} missions, artwork registry consistent` +
  (pendingSeen.length ? ` (${pendingSeen.length} render owed — see above).` : "."));

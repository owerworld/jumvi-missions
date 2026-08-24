#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
 * Event coverage / drift guard — Locked v1 R&D dashboard follow-up.
 *
 * WHY THIS EXISTS
 * generate-weekly-snapshot.mjs shipped for months only knowing the original
 * Faz 1/2 event set. Meanwhile src/worker.js's allowlist grew by seven more
 * events (welcome_complete, quickplay_start, team_create, team_switch,
 * profile_delete, mission_undo, level_up) — every one of them live in
 * Analytics Engine, and every one of them silently NOT being preserved
 * before WAE's 90-day window closed. That is not a bug this file can catch
 * after the fact (the rows are already gone); it is a class of bug this file
 * exists to make impossible to repeat.
 *
 * WHAT IT CHECKS
 *   1. src/worker.js's allowlist and app.js's BEACON_EVENTS mirror exactly —
 *      a name in one but not the other means either a dead client event
 *      (harmless) or, worse, a client sending something the server silently
 *      drops (invisible data loss with no error anywhere).
 *   2. Every event in that allowlist has an explicit decision recorded below:
 *      either it's in SNAPSHOT_HANDLED (generate-weekly-snapshot.mjs
 *      preserves it into the weekly JSON) or in LEGACY_EVENTS (the Worker
 *      still accepts it — append-only contract — but nothing in the current
 *      product emits it, and generate-weekly-snapshot.mjs still queries it
 *      under `legacy`, not `features`, so a stray/replayed row is still
 *      counted rather than silently lost).
 *      A brand-new event that is neither is exactly the mistake this file
 *      exists to catch: it fails loudly, at commit time, not 90 days later.
 *   3. SNAPSHOT_HANDLED / LEGACY_EVENTS below don't list an event that no
 *      longer exists in the allowlist (keeps this file from silently going
 *      stale in the other direction).
 *
 * MAINTENANCE — when you add a new beacon event:
 *   - Add it to src/worker.js's buildDataPoint() switch AND app.js's
 *     BEACON_EVENTS (both, always — check 1 enforces this).
 *   - Decide where generate-weekly-snapshot.mjs preserves it, implement that,
 *     then add its name to SNAPSHOT_HANDLED below with the field it lands in.
 *   - If you are deliberately retiring an event instead (Worker still
 *     accepts it, nothing emits it), move it to LEGACY_EVENTS instead and
 *     make sure generate-weekly-snapshot.mjs still queries it into `legacy`.
 * ═══════════════════════════════════════════════════════════════════════════ */
import { readFileSync } from "node:fs";

let failures = 0;
function check(label, condition, detail = "") {
  if (condition) { console.log(`  ok    ${label}`); return; }
  failures++;
  console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
}

/** Every event this repo has made an explicit snapshot-handling decision for,
 *  mapped to the generate-weekly-snapshot.mjs field it lands in. Update this
 *  alongside that file — see the maintenance note above. */
const SNAPSHOT_HANDLED = {
  app_open: "counts.app_open",
  mission_start: "missions[id].starts",
  mission_complete: "missions[id].completes",
  help_open: "help_opens",
  player_count: "player_count",
  pack_view: "packs[key].views",
  pack_complete: "packs[key].completed_pack",
  badge_earned: "features.badge_earned",
  daily_pick_tap: "features.daily_pick_tap",
  certificate_made: "features.certificate_made",
  share_tap: "features.share_tap",
  speak_on: "features.speak_on",
  timer_start: "features.timer_start",
  score_saved: "features.score_saved",
  dashboard_open: "features.dashboard_open",
  missionbook_get: "features.missionbook_get",
  profile_add: "features.profile_add",
  progress_reset: "features.progress_reset",
  hub3d: "hub3d",
  app_first_open: "counts.app_first_open",
  return_visit: "return_visits",
  // Schema v3 additions.
  welcome_complete: "activation_milestones.welcome_complete",
  team_create: "family.team_create",
  team_switch: "family.team_switch",
  profile_delete: "family.profile_delete",
  mission_undo: "family.mission_undo",
  level_up: "family.level_up",
  mission_entry: "mission_entry_sources",
  mission_unfinished_exit: "missions[id].exits",
  product_care_open: "product_care_topics",
  home_add_tap: "activation_milestones.home_add_tap",
  standalone_open: "activation_milestones.standalone_open",
  first_mission_start: "activation_milestones.first_mission_start",
  first_mission_complete: "activation_milestones.first_mission_complete",
};

/** Accepted by the Worker (append-only contract) but nothing in the current
 *  product emits these any more. Still queried by generate-weekly-snapshot.mjs
 *  (into `legacy`), just not presented as a live feature. */
const LEGACY_EVENTS = new Set(["quickplay_start"]);

function extractWorkerEvents(source) {
  const names = new Set();
  for (const m of source.matchAll(/case\s+"([a-z0-9_]+)"\s*:/g)) names.add(m[1]);
  return names;
}

function extractBeaconEventsSet(source) {
  const m = /const BEACON_EVENTS = new Set\(\[([\s\S]*?)\]\);/.exec(source);
  if (!m) throw new Error("could not find BEACON_EVENTS in app.js");
  const names = new Set();
  for (const s of m[1].matchAll(/"([a-z0-9_]+)"/g)) names.add(s[1]);
  return names;
}

const workerSource = readFileSync("src/worker.js", "utf8");
const appSource = readFileSync("app.js", "utf8");

const workerEvents = extractWorkerEvents(workerSource);
const appEvents = extractBeaconEventsSet(appSource);

console.log("Event coverage / drift guard");
console.log(`  src/worker.js allowlist: ${workerEvents.size} events`);
console.log(`  app.js BEACON_EVENTS:    ${appEvents.size} events`);

// 1 — server and client allowlists mirror exactly.
const onlyInWorker = [...workerEvents].filter((e) => !appEvents.has(e)).sort();
const onlyInApp = [...appEvents].filter((e) => !workerEvents.has(e)).sort();
check("every Worker event is also in app.js's client allowlist", onlyInWorker.length === 0,
  `worker-only: ${JSON.stringify(onlyInWorker)}`);
check("every app.js event is also in the Worker's allowlist", onlyInApp.length === 0,
  `app-only: ${JSON.stringify(onlyInApp)}`);

// 2 — every accepted event has an explicit snapshot decision (handled or legacy).
const decided = new Set([...Object.keys(SNAPSHOT_HANDLED), ...LEGACY_EVENTS]);
const undecided = [...workerEvents].filter((e) => !decided.has(e)).sort();
check("every accepted event has an explicit snapshot decision", undecided.length === 0,
  undecided.length
    ? `${JSON.stringify(undecided)} — add to SNAPSHOT_HANDLED (and implement in ` +
      `generate-weekly-snapshot.mjs) or to LEGACY_EVENTS in this file`
    : "");

// 3 — no stale decisions for events that no longer exist.
const staleHandled = Object.keys(SNAPSHOT_HANDLED).filter((e) => !workerEvents.has(e)).sort();
const staleLegacy = [...LEGACY_EVENTS].filter((e) => !workerEvents.has(e)).sort();
check("SNAPSHOT_HANDLED lists no event outside the current allowlist", staleHandled.length === 0,
  JSON.stringify(staleHandled));
check("LEGACY_EVENTS lists no event outside the current allowlist", staleLegacy.length === 0,
  JSON.stringify(staleLegacy));

// 4 — an event cannot be both actively handled and legacy at once — that
// would mean generate-weekly-snapshot.mjs has to guess which bucket wins.
const both = [...LEGACY_EVENTS].filter((e) => e in SNAPSHOT_HANDLED).sort();
check("no event is listed as both handled and legacy", both.length === 0, JSON.stringify(both));

if (failures) {
  console.log(`\n❌ ${failures} event coverage failure(s).`);
  process.exit(1);
}
console.log("\n✅ Every accepted event has an explicit, current snapshot-handling decision.");

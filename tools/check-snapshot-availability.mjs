#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
 * Historical backfill semantics guard.
 *
 * generate-weekly-snapshot.mjs can now be pointed at a week that predates an
 * event's own production cutoff (see its INSTRUMENTATION registry). Before
 * this file existed, a week like that queried WAE, got an empty result set,
 * and wrote the ordinary Number(0) for fields such as mission_entry_sources
 * — indistinguishable from "this was live and nobody used it." This test
 * proves the fix: a genuinely uncollected field is `null`, a partially
 * collected one keeps its real (partial) number with an explicit
 * `available_from`, and nothing that WAS live the whole time (mission_start,
 * help_open's own count, ...) is ever touched.
 *
 * Run: node tools/check-snapshot-availability.mjs
 * ═══════════════════════════════════════════════════════════════════════════ */
import { readFileSync } from "node:fs";
import vm from "node:vm";
import {
  buildSnapshot, availabilityStatus, EVENT_CUTOFF, ATTRIBUTION_CUTOFF, INSTRUMENTATION,
  mondayOfIsoWeek, DAY_MS,
  FEATURE_EVENTS, HUB3D_STEPS, RETURN_VISIT_STEPS, ACTIVATION_MILESTONE_EVENTS,
  TEAM_KINDS, XP_LEVEL_VALUES, LEGACY_EVENTS, MISSION_ENTRY_SOURCES,
  PRODUCT_CARE_TOPICS, HELP_REASONS, PLAYER_COUNTS,
} from "./generate-weekly-snapshot.mjs";

let failures = 0;
function check(label, condition, detail = "") {
  if (condition) { console.log(`  ok    ${label}`); return; }
  failures++;
  console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
}
function checkEqual(label, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  check(label, a === e, `expected ${e}, actual ${a}`);
}

// ── Fixture builders ─────────────────────────────────────────────────────

function makeEmptyData() {
  return {
    counts: { app_open: 0, mission_start: 0, mission_complete: 0, app_first_open: 0 },
    helpOpens: Object.fromEntries(HELP_REASONS.map((r) => [r, 0])),
    playerCount: Object.fromEntries(PLAYER_COUNTS.map((n) => [String(n), 0])),
    missions: new Map(),
    features: Object.fromEntries(FEATURE_EVENTS.map((e) => [e, 0])),
    hub3d: Object.fromEntries(HUB3D_STEPS.map((k) => [k, 0])),
    returnVisits: Object.fromEntries(RETURN_VISIT_STEPS.map((n) => [String(n), 0])),
    packViews: new Map(),
    packCompletes: new Map(),
    activationMilestones: Object.fromEntries(ACTIVATION_MILESTONE_EVENTS.map((e) => [e, 0])),
    legacy: Object.fromEntries(LEGACY_EVENTS.map((e) => [e, 0])),
    family: {
      team_create: Object.fromEntries(TEAM_KINDS.map((k) => [k, 0])),
      team_switch: 0, profile_delete: 0, mission_undo: 0,
      level_up: Object.fromEntries(XP_LEVEL_VALUES.map((n) => [String(n), 0])),
    },
    missionEntrySources: Object.fromEntries(MISSION_ENTRY_SOURCES.map((s) => [s, 0])),
    productCareTopics: Object.fromEntries(PRODUCT_CARE_TOPICS.map((t) => [t, 0])),
    helpOpenAttribution: { attributed: 0, unattributed: 0 },
    missionUndoAttribution: { attributed: 0, unattributed: 0 },
  };
}

const META = {
  pack_keys: ["Reflex Rush"],
  missions: {
    1: { pack: "Reflex Rush", age: "5+", difficulty: "easy", players: "2", duration: "5", setting: "indoor" },
  },
};

/** Builds a full snapshot for a synthetic ISO week, with `dataOverrides`
 *  merged shallowly over an all-zero fixture (deep-merged one level for
 *  `counts`/`family`/`helpOpenAttribution`/`missionUndoAttribution`). */
function snapshotForWeek(year, week, dataOverrides = {}) {
  const monday = mondayOfIsoWeek(year, week);
  const base = makeEmptyData();
  const data = {
    ...base, ...dataOverrides,
    counts: { ...base.counts, ...(dataOverrides.counts || {}) },
    helpOpenAttribution: { ...base.helpOpenAttribution, ...(dataOverrides.helpOpenAttribution || {}) },
    missionUndoAttribution: { ...base.missionUndoAttribution, ...(dataOverrides.missionUndoAttribution || {}) },
  };
  const weekId = `${year}-${String(week).padStart(2, "0")}`;
  return buildSnapshot({
    weekId,
    mondayMs: monday,
    data,
    generatedAt: new Date(monday + 8 * DAY_MS).toISOString(),
    excludedBefore: null,
    meta: META,
  });
}

function missionWith(fields) {
  const m = new Map();
  m.set("1", { starts: 10, completes: 8, exits: 0, ...fields });
  return m;
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("1 — historical week entirely before the Locked v1 cutoff (2026-33)\n");
// 2026-33 = 2026-08-10 → 2026-08-16, entirely before LOCKED_V1 (2026-08-25)
// but AFTER FAZ1/FAZ2, and it straddles FAZ2B (welcome_complete, 08-15).
{
  const snap = snapshotForWeek(2026, 33, {
    counts: { app_open: 183, mission_start: 635, mission_complete: 530 },
    helpOpens: { ...Object.fromEntries(HELP_REASONS.map((r) => [r, 0])), ball_stuck: 12 },
    missions: missionWith({
      starts: 40, completes: 30, exits: 5,
      entry_sources: Object.fromEntries(MISSION_ENTRY_SOURCES.map((s) => [s, s === "browse" ? 9 : 0])),
      help_opens: 3, undos: 1, timer_starts: 20,
    }),
    missionEntrySources: Object.fromEntries(MISSION_ENTRY_SOURCES.map((s) => [s, s === "browse" ? 9 : 0])),
    productCareTopics: Object.fromEntries(PRODUCT_CARE_TOPICS.map((t) => [t, 0])),
    activationMilestones: { welcome_complete: 7, first_mission_start: 0, first_mission_complete: 0, home_add_tap: 0, standalone_open: 0 },
    helpOpenAttribution: { attributed: 0, unattributed: 12 },
    missionUndoAttribution: { attributed: 0, unattributed: 0 },
  });

  check("mission_entry_sources is null (LOCKED_V1 not_collected)", snap.mission_entry_sources === null);
  check("product_care_topics is null (LOCKED_V1 not_collected)", snap.product_care_topics === null);
  check("family is null (FAZ2F not_collected — cutoff is 08-17, after this week ends)", snap.family === null);
  check("attribution.help_open is null (LOCKED_V1 not_collected)", snap.attribution.help_open === null);
  check("attribution.mission_undo is null (LOCKED_V1 not_collected)", snap.attribution.mission_undo === null);
  check("missions[1].entry_sources is null", snap.missions["1"].entry_sources === null);
  check("missions[1].exits is null (mission_unfinished_exit not_collected)", snap.missions["1"].exits === null);
  check("missions[1].help_opens is null (attribution not_collected)", snap.missions["1"].help_opens === null);
  check("missions[1].undos is null (attribution not_collected)", snap.missions["1"].undos === null);
  checkEqual("missions[1].timer_starts stays numeric (timer_start always had a mission id)", snap.missions["1"].timer_starts, 20);

  // Genuinely historical fields that DID exist — must stay real numbers.
  checkEqual("app_opens stays the real WAE total", snap.app_opens, 183);
  checkEqual("mission_starts stays the real WAE total", snap.mission_starts, 635);
  checkEqual("mission_completes stays the real WAE total", snap.mission_completes, 530);
  checkEqual("recorded_completion_ratio computed from the real totals", snap.recorded_completion_ratio, 0.83);
  checkEqual("help_opens (global, by reason) stays real — help_open existed since FAZ1", snap.help_opens.ball_stuck, 12);

  // welcome_complete's cutoff (FAZ2B, 08-15 14:26) falls INSIDE this week —
  // partial, not not_collected, and the real partial count is kept.
  checkEqual("activation_milestones.welcome_complete stays numeric (partial week)", snap.activation_milestones.welcome_complete, 7);
  check("availability.welcome_complete is status=partial", snap.availability.welcome_complete?.status === "partial");
  checkEqual("availability.welcome_complete.available_from is the FAZ2B instant", snap.availability.welcome_complete?.available_from, INSTRUMENTATION.FAZ2B);
  // The four genuinely-new Locked v1 milestones are fully not_collected.
  for (const ev of ["first_mission_start", "first_mission_complete", "home_add_tap", "standalone_open"]) {
    check(`activation_milestones.${ev} is null`, snap.activation_milestones[ev] === null);
    check(`availability.${ev} is status=not_collected`, snap.availability[ev]?.status === "not_collected");
  }
}

console.log("\n2 — current/future week, fully after every cutoff (2026-36)\n");
{
  const snap = snapshotForWeek(2026, 36, {
    counts: { app_open: 50, mission_start: 40, mission_complete: 0 }, // true zero completes
    missions: missionWith({ starts: 5, completes: 0, exits: 0, entry_sources: Object.fromEntries(MISSION_ENTRY_SOURCES.map((s) => [s, 0])), help_opens: 0, undos: 0, timer_starts: 0 }),
  });
  checkEqual("availability is empty — nothing is gated this far after Locked v1", snap.availability, {});
  check("mission_entry_sources is the real (zero-filled) object, not null", snap.mission_entry_sources !== null);
  check("family is the real object, not null", snap.family !== null);
  check("attribution.help_open is the real object, not null", snap.attribution.help_open !== null);
  checkEqual("a true zero stays Number(0), not null", snap.mission_completes, 0);
  checkEqual("missions[1].exits true zero stays Number(0)", snap.missions["1"].exits, 0);
  checkEqual("missions[1].entry_sources.browse true zero stays Number(0)", snap.missions["1"].entry_sources.browse, 0);
}

console.log("\n3 — partial week spanning the Locked v1 cutoff (2026-35, 08-24 → 08-30)\n");
{
  const snap = snapshotForWeek(2026, 35, {
    missionEntrySources: Object.fromEntries(MISSION_ENTRY_SOURCES.map((s) => [s, s === "today" ? 4 : 0])),
    productCareTopics: Object.fromEntries(PRODUCT_CARE_TOPICS.map((t) => [t, t === "strap_fit" ? 2 : 0])),
    activationMilestones: { welcome_complete: 0, first_mission_start: 3, first_mission_complete: 1, home_add_tap: 0, standalone_open: 0 },
  });
  check("mission_entry status is partial", snap.availability.mission_entry?.status === "partial");
  checkEqual("mission_entry.available_from is the exact LOCKED_V1 instant", snap.availability.mission_entry?.available_from, INSTRUMENTATION.LOCKED_V1);
  check("mission_entry_sources keeps its real (partial-week) count, not null", snap.mission_entry_sources !== null);
  checkEqual("mission_entry_sources.today is the real partial count", snap.mission_entry_sources.today, 4);
  check("product_care_open status is partial", snap.availability.product_care_open?.status === "partial");
  checkEqual("product_care_topics keeps its real partial count", snap.product_care_topics.strap_fit, 2);
  check("first_mission_start status is partial, not not_collected", snap.availability.first_mission_start?.status === "partial");
  checkEqual("activation_milestones.first_mission_start keeps its real partial count", snap.activation_milestones.first_mission_start, 3);
  // welcome_complete (FAZ2B) is long past by this week — fully available.
  check("welcome_complete has no availability entry (fully available by 2026-35)", !("welcome_complete" in snap.availability));
}

console.log("\n4 — historical help_open: global count real, mission attribution unavailable\n");
{
  const snap = snapshotForWeek(2026, 33, {
    helpOpens: { ball_stuck: 5, ball_hard_to_remove: 2, strap_uncomfortable: 0, need_more_space: 0, instructions_unclear: 1, mission_too_hard: 0 },
    helpOpenAttribution: { attributed: 0, unattributed: 8 },
    missions: missionWith({ help_opens: 0 }),
  });
  checkEqual("help_opens (by reason) preserves the real historical total", snap.help_opens.ball_stuck, 5);
  checkEqual("help_opens.instructions_unclear preserves its real historical count", snap.help_opens.instructions_unclear, 1);
  check("attribution.help_open is null — mission-id attribution did not exist in 2026-33", snap.attribution.help_open === null);
  check("missions[1].help_opens is null — same attribution gap", snap.missions["1"].help_opens === null);
}

console.log("\n5 — historical mission_undo: partial global event, unavailable attribution (2026-34)\n");
{
  // 2026-34 = 08-17 → 08-23. FAZ2F (mission_undo the EVENT) cutoff is
  // 08-17T08:11:29Z — inside this week: partial, real count kept. LOCKED_V1
  // (mission-id attribution) is 08-25 — after this week ends: not_collected.
  const snap = snapshotForWeek(2026, 34, {
    counts: { app_open: 238, mission_start: 356, mission_complete: 34 },
    family: { team_create: { adult: 1, sibling: 0 }, team_switch: 2, profile_delete: 0, mission_undo: 9, level_up: { 2: 1, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 } },
    missionUndoAttribution: { attributed: 0, unattributed: 9 },
    missions: missionWith({ undos: 0 }),
  });
  check("family status is partial (FAZ2F cutoff falls inside this week)", snap.availability.family?.status === "partial");
  checkEqual("family.available_from is the exact FAZ2F instant", snap.availability.family?.available_from, INSTRUMENTATION.FAZ2F);
  check("family is the real object (not null) — partial, not unavailable", snap.family !== null);
  checkEqual("family.mission_undo keeps its real partial-week count", snap.family.mission_undo, 9);
  check("mission_undo_attribution status is not_collected (LOCKED_V1 is after this week ends)", snap.availability.mission_undo_attribution?.status === "not_collected");
  check("attribution.mission_undo is null — id attribution did not exist yet in 2026-34", snap.attribution.mission_undo === null);
  check("missions[1].undos is null — same attribution gap", snap.missions["1"].undos === null);
  // The real, unmodified WAE totals the review specified must not be altered.
  checkEqual("app_opens matches the real WAE total for 2026-34", snap.app_opens, 238);
  checkEqual("mission_starts matches the real WAE total for 2026-34", snap.mission_starts, 356);
  checkEqual("mission_completes matches the real WAE total for 2026-34", snap.mission_completes, 34);
  checkEqual("recorded_completion_ratio reflects the real (low) completion rate — not normalized", snap.recorded_completion_ratio, 0.1);
}

console.log("\n7 — existing v2 snapshot on disk is untouched\n");
{
  const raw = JSON.parse(readFileSync(new URL("../data/snapshots/2026-32.json", import.meta.url)));
  checkEqual("committed v2 snapshot's schema is still 2", raw.snapshot_schema, 2);
  check("v2 snapshot has no availability block (this feature postdates it — expected)", !("availability" in raw));
}

console.log("\n8 — 2026-33 / 2026-34 real fixture behavior (from the review's own totals)\n");
{
  const w33 = snapshotForWeek(2026, 33, { counts: { app_open: 183, mission_start: 635, mission_complete: 530 } });
  checkEqual("2026-33 app_opens unchanged", w33.app_opens, 183);
  checkEqual("2026-33 mission_starts unchanged", w33.mission_starts, 635);
  checkEqual("2026-33 mission_completes unchanged", w33.mission_completes, 530);
  checkEqual("2026-33 recorded_completion_ratio unchanged (0.83, not normalized)", w33.recorded_completion_ratio, 0.83);
  check("2026-33 mission_entry_sources is null, not a fabricated zero object", w33.mission_entry_sources === null);
  check("2026-33 product_care_topics is null, not a fabricated zero object", w33.product_care_topics === null);

  const w34 = snapshotForWeek(2026, 34, { counts: { app_open: 238, mission_start: 356, mission_complete: 34 } });
  checkEqual("2026-34 app_opens unchanged", w34.app_opens, 238);
  checkEqual("2026-34 mission_starts unchanged", w34.mission_starts, 356);
  checkEqual("2026-34 mission_completes unchanged", w34.mission_completes, 34);
  checkEqual("2026-34 recorded_completion_ratio unchanged (0.10 — a real anomaly, not fixed here)", w34.recorded_completion_ratio, 0.1);
  check("2026-34 mission_entry_sources is null, not a fabricated zero object", w34.mission_entry_sources === null);
  check("2026-34 attribution.help_open is null", w34.attribution.help_open === null);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n6 — /analiz renders unavailable as a message, true zero as 0, never NaN/null text\n");
{
  const html = readFileSync(new URL("../assets/analiz/index.html", import.meta.url), "utf8");
  const scriptMatch = html.match(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/);
  if (!scriptMatch) {
    check("assets/analiz/index.html has an inline <script> to test", false);
  } else {
    // A minimal DOM: every element is a plain object whose innerHTML we can
    // read back; unknown ids get a fresh element on first access instead of
    // throwing, since render functions touch several ids per call.
    const elements = new Map();
    const fakeDocument = {
      getElementById(id) {
        if (!elements.has(id)) {
          elements.set(id, { id, innerHTML: "", hidden: false, classList: { add() {}, remove() {}, contains: () => false }, style: {}, scrollIntoView() {}, querySelectorAll: () => [] });
        }
        return elements.get(id);
      },
    };
    const sandbox = {
      document: fakeDocument,
      window: {},
      console,
      fetch: () => Promise.reject(new Error("no network in this test")),
      URLSearchParams,
      Date,
      Math,
      JSON,
      Object,
      Array,
      Number,
      String,
    };
    sandbox.window = sandbox;
    const ctx = vm.createContext(sandbox);
    vm.runInContext(scriptMatch[1], ctx, { filename: "analiz-inline.js" });
    // index.html declares `let META` at its top level. A vm context's
    // top-level `let`/`const` bindings live in a separate lexical
    // environment from the sandbox object — `ctx.META = ...` merely adds an
    // unrelated own-property to the sandbox and never touches the script's
    // actual `META` binding, so a later read back inside the script (e.g.
    // renderMissionDetail) still sees whatever `boot()`'s own rejected fetch
    // last assigned. Assigning through a second vm.runInContext call (a
    // plain `=`, not a re-declaration) resolves against that SAME lexical
    // environment and genuinely mutates it.
    const setGlobal = (name, value) => {
      ctx.__inject__ = value;
      vm.runInContext(`${name} = __inject__;`, ctx);
      delete ctx.__inject__;
    };
    const missionMeta = {
      pack_keys: ["Reflex Rush"],
      pack_labels: { "Reflex Rush": "Reflex Rush" },
      missions: { 1: { pack: "Reflex Rush" } },
    };
    setGlobal("META", missionMeta);

    const NOT_COLLECTED_TEXT = "henüz";
    const hasBareNull = (s) => /(^|[^a-zA-Z])null([^a-zA-Z]|$)/.test(s);
    const hasNaN = (s) => s.includes("NaN");

    // (a) unavailable renders as a message, not 0 / 0% / raw null.
    ctx.hasV3 = ctx.hasV3; // no-op, just documents it's already defined
    const snapUnavailable = { snapshot_schema: 3, product_care_topics: null, mission_entry_sources: null, family: null };
    ctx.renderProductSignals(snapUnavailable);
    check("renderProductSignals shows the unavailable message for null product_care_topics",
      ctx.document.getElementById("productSignals").innerHTML.includes(NOT_COLLECTED_TEXT));
    ctx.renderEntrySources(snapUnavailable);
    check("renderEntrySources shows the unavailable message for null mission_entry_sources",
      ctx.document.getElementById("entrySources").innerHTML.includes(NOT_COLLECTED_TEXT));
    ctx.renderFamily(snapUnavailable);
    check("renderFamily shows the unavailable message for null family",
      ctx.document.getElementById("family").innerHTML.includes(NOT_COLLECTED_TEXT));
    for (const [id, html_] of [
      ["productSignals", ctx.document.getElementById("productSignals").innerHTML],
      ["entrySources", ctx.document.getElementById("entrySources").innerHTML],
      ["family", ctx.document.getElementById("family").innerHTML],
    ]) {
      check(`${id}: no bare "null" leaked into rendered HTML`, !hasBareNull(html_), html_);
      check(`${id}: no "NaN" leaked into rendered HTML`, !hasNaN(html_), html_);
    }

    // (b) a real numeric zero (available capability) still renders as 0.
    const snapAvailableZero = {
      snapshot_schema: 3,
      product_care_topics: Object.fromEntries(PRODUCT_CARE_TOPICS.map((t) => [t, 0])),
      mission_entry_sources: Object.fromEntries(MISSION_ENTRY_SOURCES.map((s) => [s, 0])),
      family: { team_create: { adult: 0, sibling: 0 }, team_switch: 0, profile_delete: 0, mission_undo: 0, level_up: {} },
      features: { badge_earned: 0, profile_add: 0, progress_reset: 0 },
    };
    ctx.renderProductSignals(snapAvailableZero);
    const psHtml = ctx.document.getElementById("productSignals").innerHTML;
    check("renderProductSignals shows a real numeric 0 (not the unavailable message)", !psHtml.includes(NOT_COLLECTED_TEXT));
    check("renderProductSignals's zero still contains a literal 0", /\b0\b/.test(psHtml));
    ctx.renderFamily(snapAvailableZero);
    const famHtml = ctx.document.getElementById("family").innerHTML;
    check("renderFamily shows real numeric zeros (not the unavailable message)", !famHtml.includes(NOT_COLLECTED_TEXT));

    // (c) mission-detail: availability is a SNAPSHOT-WIDE decision, never
    // inferred from one mission's row. Regression coverage for the
    // absent-mission bug: an earlier version of renderMissionDetail decided
    // "unavailable" purely from `m.<field> === null`, which missed a mission
    // that never appears in `snap.missions` at all (`m` = `{}`,
    // `m.<field>` = `undefined`) — that silently fell through to a
    // fabricated "0 ölçüldü" instead of the honest unavailable message.
    const notCollectedAvailability = {
      mission_entry: { status: "not_collected", available_from: INSTRUMENTATION.LOCKED_V1 },
      mission_unfinished_exit: { status: "not_collected", available_from: INSTRUMENTATION.LOCKED_V1 },
      help_open_attribution: { status: "not_collected", available_from: INSTRUMENTATION.LOCKED_V1 },
      mission_undo_attribution: { status: "not_collected", available_from: INSTRUMENTATION.LOCKED_V1 },
    };

    // (A) historical v3, the selected mission DOES have a row this week
    // (real starts/completes), but its Locked-v1-only fields are null.
    const snapHistoricalPresent = {
      snapshot_schema: 3,
      availability: notCollectedAvailability,
      missions: { 1: { starts: 5, completes: 2, exits: null, entry_sources: null, timer_starts: null, help_opens: null, undos: null } },
    };
    setGlobal("META", missionMeta);
    ctx.renderMissionDetail(snapHistoricalPresent, "1");
    const mdA = ctx.document.getElementById("missionDetail").innerHTML;
    check("(A) present mission, historical week: unavailable marker shown", mdA.includes("notavail"));
    check("(A) no bare \"null\" leaked into rendered HTML", !hasBareNull(mdA), mdA);
    check("(A) no \"NaN\" leaked into rendered HTML", !hasNaN(mdA), mdA);

    // (B) historical v3, the selected mission has NO row at all this week —
    // absent from snap.missions entirely. This is the regression case: it
    // must still show unavailable, never a fabricated 0.
    const snapHistoricalAbsent = {
      snapshot_schema: 3,
      availability: notCollectedAvailability,
      missions: { 1: { starts: 5, completes: 2, exits: null, entry_sources: null, timer_starts: null, help_opens: null, undos: null } },
    };
    setGlobal("META", missionMeta);
    ctx.renderMissionDetail(snapHistoricalAbsent, "2");
    const mdB = ctx.document.getElementById("missionDetail").innerHTML;
    check("(B) absent mission, historical week: unavailable marker shown (not a fabricated 0)", mdB.includes("notavail"));
    check("(B) absent mission, historical week: entry-source table shows the unavailable message, not a zeroed table", mdB.includes(NOT_COLLECTED_TEXT));
    check("(B) no bare \"null\" leaked into rendered HTML", !hasBareNull(mdB), mdB);
    check("(B) no \"NaN\" leaked into rendered HTML", !hasNaN(mdB), mdB);

    // (C) post-cutoff v3 (empty availability — everything fully measured),
    // the selected mission has NO row this week: a genuine, legitimate 0.
    const snapPostCutoffAbsent = {
      snapshot_schema: 3,
      availability: {},
      missions: { 1: { starts: 5, completes: 2, exits: 0, entry_sources: Object.fromEntries(MISSION_ENTRY_SOURCES.map((s) => [s, 0])), timer_starts: 0, help_opens: 0, undos: 0 } },
    };
    setGlobal("META", missionMeta);
    ctx.renderMissionDetail(snapPostCutoffAbsent, "2");
    const mdC = ctx.document.getElementById("missionDetail").innerHTML;
    check("(C) absent mission, post-cutoff week: shows a real numeric 0, not the unavailable message", mdC.includes(">0<") && !mdC.includes("notavail"));

    // True-zero-with-a-present-mission still renders as 0 (unchanged from
    // before this fix).
    const snapMissionZero = {
      snapshot_schema: 3,
      availability: {},
      missions: { 1: { starts: 5, completes: 2, exits: 0, entry_sources: Object.fromEntries(MISSION_ENTRY_SOURCES.map((s) => [s, 0])), timer_starts: 0, help_opens: 0, undos: 0 } },
    };
    setGlobal("META", missionMeta);
    ctx.renderMissionDetail(snapMissionZero, "1");
    const mdHtml2 = ctx.document.getElementById("missionDetail").innerHTML;
    check("renderMissionDetail shows a real numeric 0 for a true-zero per-mission field", mdHtml2.includes(">0<"));
  }
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n9 — pre-FAZ1 week: every field EVENT_CUTOFF actually claims to gate is null\n");
// Review follow-up: EVENT_CUTOFF/ATTRIBUTION_CUTOFF were claiming coverage
// buildSnapshot did not enforce (e.g. app_open/mission_start/help_open/
// timer_start/hub3d/... would still have reported Number(0) for a week
// entirely before the product existed). 2026-31 (07-27 → 08-02) is fully
// before EVERY registered cutoff, including FAZ1 itself.
{
  const preAll = snapshotForWeek(2026, 31, { missions: missionWith({ exits: 3, timer_starts: 2, help_opens: 1, undos: 1 }) });

  // One extractor per EVENT_CUTOFF key — several genuinely share an
  // extractor (the 11 FEATURE_EVENTS all live in one `features` object,
  // gated as one unit; the 5 family-layer events all live in `family`).
  const eventOutputs = {
    app_open: (s) => s.app_opens,
    mission_start: (s) => s.mission_starts,
    mission_complete: (s) => s.mission_completes,
    help_open: (s) => s.help_opens,
    player_count: (s) => s.player_count,
    app_first_open: (s) => s.app_first_opens,
    pack_view: (s) => s.packs["Reflex Rush"].views,
    pack_complete: (s) => s.packs["Reflex Rush"].completed_pack,
    timer_start: (s) => s.features,
    return_visit: (s) => s.return_visits,
    hub3d: (s) => s.hub3d,
    dashboard_open: (s) => s.features,
    missionbook_get: (s) => s.features,
    profile_add: (s) => s.features,
    progress_reset: (s) => s.features,
    badge_earned: (s) => s.features,
    certificate_made: (s) => s.features,
    score_saved: (s) => s.features,
    share_tap: (s) => s.features,
    daily_pick_tap: (s) => s.features,
    speak_on: (s) => s.features,
    welcome_complete: (s) => s.activation_milestones.welcome_complete,
    quickplay_start: (s) => s.legacy,
    team_create: (s) => s.family,
    team_switch: (s) => s.family,
    profile_delete: (s) => s.family,
    mission_undo: (s) => s.family,
    level_up: (s) => s.family,
    mission_entry: (s) => s.mission_entry_sources,
    mission_unfinished_exit: (s) => s.missions["1"]?.exits,
    product_care_open: (s) => s.product_care_topics,
    home_add_tap: (s) => s.activation_milestones.home_add_tap,
    standalone_open: (s) => s.activation_milestones.standalone_open,
    first_mission_start: (s) => s.activation_milestones.first_mission_start,
    first_mission_complete: (s) => s.activation_milestones.first_mission_complete,
  };

  for (const key of Object.keys(EVENT_CUTOFF)) {
    check(`EVENT_CUTOFF.${key} has a mapped output decision in this test`, key in eventOutputs);
  }
  for (const key of Object.keys(eventOutputs)) {
    check(`eventOutputs.${key} corresponds to a real EVENT_CUTOFF entry (no stale test mapping)`, key in EVENT_CUTOFF);
  }
  for (const [key, extract] of Object.entries(eventOutputs)) {
    check(`EVENT_CUTOFF.${key}: pre-FAZ1 week nulls its output field`, extract(preAll) === null,
      `cutoff=${EVENT_CUTOFF[key]} got=${JSON.stringify(extract(preAll))}`);
  }

  const postAll = snapshotForWeek(2026, 36, { missions: missionWith({ exits: 3, timer_starts: 2, help_opens: 1, undos: 1 }) });
  for (const [key, extract] of Object.entries(eventOutputs)) {
    check(`EVENT_CUTOFF.${key}: fully post-cutoff week keeps its real (non-null) value`, extract(postAll) !== null);
  }
}

console.log("\n10 — registry consistency: every ATTRIBUTION_CUTOFF key has an enforced output decision\n");
{
  const attributionOutputs = {
    timer_start: (s) => s.missions["1"]?.timer_starts,
    mission_entry: (s) => s.missions["1"]?.entry_sources,
    help_open: (s) => s.missions["1"]?.help_opens,
    mission_undo: (s) => s.missions["1"]?.undos,
  };
  for (const key of Object.keys(ATTRIBUTION_CUTOFF)) {
    check(`ATTRIBUTION_CUTOFF.${key} has a mapped output decision in this test`, key in attributionOutputs);
  }

  // Pre-timer-attribution week behavior: 2026-31 is before FAZ2 (timer_start's
  // own cutoff, and therefore its attribution's too — the two are identical,
  // "carried a mission id from day one"), so a mission WITH a real row must
  // still show timer_starts as null, not the row's real number.
  const preTimerAttribution = snapshotForWeek(2026, 31, { missions: missionWith({ timer_starts: 7 }) });
  check("pre-FAZ2 week: missions[1].timer_starts is null even though the mission has a row",
    preTimerAttribution.missions["1"].timer_starts === null);

  const preAllAttribution = snapshotForWeek(2026, 31, {
    missions: missionWith({ timer_starts: 5, entry_sources: Object.fromEntries(MISSION_ENTRY_SOURCES.map((s) => [s, 1])), help_opens: 2, undos: 1 }),
  });
  for (const [key, extract] of Object.entries(attributionOutputs)) {
    check(`ATTRIBUTION_CUTOFF.${key}: fully pre-cutoff week nulls its output field`, extract(preAllAttribution) === null,
      `cutoff=${ATTRIBUTION_CUTOFF[key]} got=${JSON.stringify(extract(preAllAttribution))}`);
  }
  const postAllAttribution = snapshotForWeek(2026, 36, {
    missions: missionWith({ timer_starts: 5, entry_sources: Object.fromEntries(MISSION_ENTRY_SOURCES.map((s) => [s, 1])), help_opens: 2, undos: 1 }),
  });
  for (const [key, extract] of Object.entries(attributionOutputs)) {
    check(`ATTRIBUTION_CUTOFF.${key}: fully post-cutoff week keeps its real (non-null) value`, extract(postAllAttribution) !== null);
  }
}

console.log("\n11 — one week, two different partial cutoffs (2026-32, straddles FAZ1 AND FAZ2)\n");
{
  // 2026-32 = 08-03 → 08-09. FAZ1 (08-07T00:03:48Z) and FAZ2
  // (08-07T23:55:47Z) both fall inside this single week, ~24h apart —
  // proof that two distinct registered cutoffs can each be independently
  // "partial" for the same week with two different available_from instants.
  const snap = snapshotForWeek(2026, 32, {
    counts: { app_open: 9, mission_start: 6, mission_complete: 4, app_first_open: 3 },
  });
  check("FAZ1-gated app_open is partial", snap.availability.app_open?.status === "partial");
  checkEqual("app_open.available_from is the FAZ1 instant", snap.availability.app_open?.available_from, INSTRUMENTATION.FAZ1);
  check("FAZ2-gated app_first_open is partial", snap.availability.app_first_open?.status === "partial");
  checkEqual("app_first_open.available_from is the FAZ2 instant (later than FAZ1, same week)", snap.availability.app_first_open?.available_from, INSTRUMENTATION.FAZ2);
  checkEqual("app_opens keeps its real partial-week count", snap.app_opens, 9);
  checkEqual("app_first_opens keeps its real partial-week count", snap.app_first_opens, 3);
}

if (failures) {
  console.log(`\n❌ ${failures} historical-backfill-semantics failure(s).`);
  process.exit(1);
}
console.log("\n✅ Historical fields are null, not fabricated zeros; partial weeks keep real numbers with an honest cutoff; true zeros are untouched.");

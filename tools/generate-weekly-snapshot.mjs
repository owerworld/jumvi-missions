#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
 * JUMVI weekly snapshot generator — Faz 1, Görev 1.3 + Faz 2, Görev 2.2
 *
 * WHY THIS EXISTS
 * Workers Analytics Engine has a three-month retention window (Cloudflare
 * documents this as a rolling retention period, not a guaranteed exact day
 * count). Everything that must outlive that window — exit diligence, R&D,
 * marketing — has to be aggregated and committed to git BEFORE the source
 * rows expire. This script is that aggregation step. It reads WAE via the
 * SQL API and writes one JSON file per ISO week under data/snapshots/.
 *
 * A number that is not in a snapshot is gone forever once that retention
 * window closes on the event. That is the reason the mission-level breakdown
 * is captured here even though nothing reads it yet.
 *
 * FAZ 2 adds the sixteen content/feature events, and five cross-reads that
 * need no extra event at all: mission ids are joined against the labels each
 * mission already carries (age, difficulty, players, duration, pack setting)
 * via data/missions-meta.json, which is DERIVED from data.js and re-verified
 * on every run — see loadMissionsMeta().
 *
 * SCHEMA v3 (Locked v1 R&D dashboard follow-up) fixed a real gap this file's
 * own opening paragraph warns about: the Worker's allowlist had grown to 27
 * events (welcome_complete, quickplay_start, team_create, team_switch,
 * profile_delete, mission_undo, level_up) while this generator still only
 * knew the original Faz 1/2 set — every one of those seven was live in WAE
 * and silently NOT being preserved before its retention window closed. v3 adds
 * those seven plus the seven brand-new Locked v1 events (mission_entry,
 * mission_unfinished_exit, product_care_open, home_add_tap, standalone_open,
 * first_mission_start, first_mission_complete), and — the actual fix, not
 * just a one-time backfill — tools/check-event-coverage.mjs now fails CI
 * whenever a new active event is added to src/worker.js without a matching
 * decision here. quickplay_start is queried but reported under `legacy`,
 * not `features`: play-modes.js was removed from the product (see app.js's
 * own comment above BEACON_EVENTS) and nothing emits it any more, but the
 * Worker still accepts it — an append-only contract — so a stray/replayed
 * row must still be counted, just not presented as a live feature.
 *
 * v2 snapshots on disk are untouched and still load: this file only adds
 * fields, never renames or removes one, and the panel (assets/analiz/
 * index.html) shows "not available in this snapshot schema" rather than a
 * fabricated zero for a v3-only field on an older file.
 *
 * MANUAL ONLY — Faz 1 spec is explicit that this must not run on a schedule
 * in this phase. There is no workflow, no cron, no hook. A human runs it.
 * (Superseded, deliberately, by .github/workflows/weekly-analytics-snapshot.yml
 * — see that file's header for why and what stays a human-gated PR merge.)
 *
 * PRIVACY: this script can only ever see what the beacon wrote, and the
 * beacon writes no identity of any kind (see docs/audits/faz1-beacon.md).
 * Every query below is an aggregate GROUP BY — no raw row ever reaches disk.
 *
 * Usage:
 *   node tools/generate-weekly-snapshot.mjs                 # last complete ISO week
 *   node tools/generate-weekly-snapshot.mjs --week 2026-32
 *   node tools/generate-weekly-snapshot.mjs --week 2026-32 --dry-run
 *
 * A week is queried over its own Monday–Sunday range and nothing else. There
 * is deliberately no "real data starts here" constant in this file: a weekly
 * tool should not carry a permanent exception that belongs to one week. When
 * a specific run has to drop rows — the launch week held beacon test traffic
 * — pass --since for that run. The instant lands in the snapshot's
 * excluded_before field, so the file records how it was made.
 *
 * Credentials, in order of preference:
 *   CLOUDFLARE_API_TOKEN   (needs Account Analytics: Read)
 *   the local `wrangler login` OAuth token, if the env var is unset
 *   CLOUDFLARE_ACCOUNT_ID  (optional — discovered from the API when unset)
 * Neither the token nor the account id is ever written to a file or printed.
 * This repo is public; keep it that way.
 * ═══════════════════════════════════════════════════════════════════════════ */

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildMeta, serialiseMeta } from "./derive-missions-meta.mjs";

const DATASET = "jumvi_events_v1";
const SNAPSHOT_SCHEMA = 3;

/* Feature events: a flat count each, no props to break down. Order is the
 * order the panel reads them in. */
export const FEATURE_EVENTS = [
  "daily_pick_tap", "speak_on", "timer_start", "badge_earned",
  "certificate_made", "share_tap", "score_saved", "dashboard_open",
  "missionbook_get", "profile_add", "progress_reset",
];

/** The hub funnel, in order. Frozen with the event (src/worker.js). */
export const HUB3D_STEPS = ["shown", "entered", "ready", "moved", "mission", "failed", "escaped"];

/** Only these visit numbers are ever reported (app.js). */
export const RETURN_VISIT_STEPS = [2, 3, 5, 10];

/* ── Schema v3 — the seven events this file was previously silently
 * dropping (see the header note above). Flat counts, same shape as
 * FEATURE_EVENTS, but reported under `activation_milestones` / `family`
 * instead of `features` — they answer a different kind of question than
 * "is this feature alive", so they get their own section in the panel. */
export const ACTIVATION_MILESTONE_EVENTS = [
  "welcome_complete", "first_mission_start", "first_mission_complete",
  "home_add_tap", "standalone_open",
];
export const TEAM_KINDS = ["adult", "sibling"];
export const XP_LEVEL_VALUES = [2, 3, 4, 5, 6, 7];
/** Accepted by the Worker (append-only contract) but nothing in the current
 *  product emits these any more — see app.js's own comment above
 *  BEACON_EVENTS. Queried and preserved, reported under `legacy`, never
 *  presented as a live feature. */
export const LEGACY_EVENTS = ["quickplay_start"];

/* ── Schema v3 — Locked v1 R&D dashboard follow-up (new events) ──────────── */
/** Mirrors MISSION_ENTRY_SOURCES in src/worker.js / app.js. "next" is the
 *  in-sheet Next button; "family" is the Family Board tile tap; "unknown" is
 *  the explicit, honest fallback for a real call site that isn't one of the
 *  other eight — see docs/analytics/locked-v1.md §9b for the full
 *  call-site mapping. */
export const MISSION_ENTRY_SOURCES = ["today", "browse", "random", "resume", "coach", "island", "next", "family", "unknown"];
/** Mirrors PRODUCT_CARE_TOPICS in src/worker.js / app.js — the real, current
 *  "Product Care & Quick Help" accordion in Grown-ups, not an invented list. */
export const PRODUCT_CARE_TOPICS = [
  "ball_not_sticking", "ball_hard_to_remove", "strap_fit", "missing_catches",
  "indoor_play", "cleaning_storage", "damaged_missing",
];

/* ═══════════════════════════════════════════════════════════════════════════
 * HISTORICAL BACKFILL SEMANTICS — availability vs. true zero
 *
 * This generator can now be pointed at any past ISO week (--week), including
 * one that predates an event's own existence. Before this section existed,
 * every field this file didn't know about yet queried WAE, got an empty
 * result set, and reported the totally ordinary Number(0) — indistinguishable
 * from "this was live and nobody triggered it." For product/R&D that
 * distinction is not cosmetic: a historical week showing
 * mission_entry_sources: {today:0, browse:0, ...} looks like a dead feature,
 * when the honest answer is "mission_entry did not exist yet."
 *
 * Every cutoff below is the exact PRODUCTION deploy instant — the commit that
 * actually reached main, not a PR branch's own authored timestamp (a PR sits
 * on a branch, possibly for days, before anything downstream of its commits
 * is live) — verified with `git log -S"<event name>" -- src/worker.js`:
 *
 *   FAZ1      2026-08-07T00:03:48Z  43d7283  "feat(analytics): minimal
 *             5-event beacon on Workers Analytics Engine (Faz 1 / 1.2)"
 *             → app_open, mission_start, mission_complete, help_open,
 *               player_count
 *   FAZ2      2026-08-07T23:55:47Z  91eb42a  Faz 2 sixteen-event batch
 *             → app_first_open, pack_view, pack_complete, badge_earned,
 *               timer_start (WITH a mission id from day one — no separate
 *               attribution gap for this one), return_visit, dashboard_open,
 *               missionbook_get, profile_add, progress_reset, hub3d,
 *               certificate_made, score_saved, share_tap, daily_pick_tap,
 *               speak_on
 *   FAZ2B     2026-08-15T14:26:03Z  50c5e99  welcome_complete added
 *             (quickplay_start also lands here — already legacy today, but
 *             its historical rows are just as real before this instant)
 *   FAZ2F     2026-08-17T08:11:29Z  3b876f5  "fix(play): gate completion on
 *             real play..." — the family layer's events themselves:
 *             team_create, team_switch, profile_delete, mission_undo
 *             (EVENT only — see LOCKED_V1 below for its mission-id
 *             attribution, added much later), level_up
 *   LOCKED_V1 2026-08-25T13:03:32Z  0d95331  PR #37's MERGE commit (the
 *             branch's own commits are dated 2026-08-24; nothing on that
 *             branch was live in production until this merge deployed) —
 *             mission_entry, mission_unfinished_exit, product_care_open,
 *             home_add_tap, standalone_open, first_mission_start,
 *             first_mission_complete, AND the help_open / mission_undo
 *             mission-id ATTRIBUTION (both events themselves pre-date this
 *             by weeks — only the id column is new)
 *
 * A week entirely before a cutoff: "not_collected" — the generator writes
 * `null`, never a fabricated 0, for every field that cutoff gates, and
 * records the reason in the snapshot's `availability` block.
 * A week straddling a cutoff: "partial" — the real WAE number IS trustworthy
 * (an event that didn't exist yet simply has no rows before the cutoff, so
 * there is no over- or under-counting risk), but reporting it bare would
 * silently imply the whole week was measured. `availability` marks it
 * "partial" with the exact `available_from` instant instead.
 * A week entirely after every relevant cutoff: "available" — ordinary,
 * un-annotated numbers, exactly like today. Nothing needed 2026-08-07's
  * events marked unavailable in a week from last month, and nothing here
 * does that — see EVENT_CUTOFF below; only fields with a REAL historical
 * gap ever get an entry.
 * ═══════════════════════════════════════════════════════════════════════════ */
export const INSTRUMENTATION = {
  FAZ1: "2026-08-07T00:03:48Z",
  FAZ2: "2026-08-07T23:55:47Z",
  FAZ2B: "2026-08-15T14:26:03Z",
  FAZ2F: "2026-08-17T08:11:29Z",
  LOCKED_V1: "2026-08-25T13:03:32Z",
};

/** When each EVENT itself first went live in production. Does not imply
 *  anything about per-mission attribution — see ATTRIBUTION_CUTOFF. */
export const EVENT_CUTOFF = {
  app_open: INSTRUMENTATION.FAZ1,
  mission_start: INSTRUMENTATION.FAZ1,
  mission_complete: INSTRUMENTATION.FAZ1,
  help_open: INSTRUMENTATION.FAZ1,
  player_count: INSTRUMENTATION.FAZ1,

  app_first_open: INSTRUMENTATION.FAZ2,
  pack_view: INSTRUMENTATION.FAZ2,
  pack_complete: INSTRUMENTATION.FAZ2,
  timer_start: INSTRUMENTATION.FAZ2,
  return_visit: INSTRUMENTATION.FAZ2,
  hub3d: INSTRUMENTATION.FAZ2,
  dashboard_open: INSTRUMENTATION.FAZ2,
  missionbook_get: INSTRUMENTATION.FAZ2,
  profile_add: INSTRUMENTATION.FAZ2,
  progress_reset: INSTRUMENTATION.FAZ2,
  badge_earned: INSTRUMENTATION.FAZ2,
  certificate_made: INSTRUMENTATION.FAZ2,
  score_saved: INSTRUMENTATION.FAZ2,
  share_tap: INSTRUMENTATION.FAZ2,
  daily_pick_tap: INSTRUMENTATION.FAZ2,
  speak_on: INSTRUMENTATION.FAZ2,

  welcome_complete: INSTRUMENTATION.FAZ2B,
  quickplay_start: INSTRUMENTATION.FAZ2B,

  team_create: INSTRUMENTATION.FAZ2F,
  team_switch: INSTRUMENTATION.FAZ2F,
  profile_delete: INSTRUMENTATION.FAZ2F,
  mission_undo: INSTRUMENTATION.FAZ2F,
  level_up: INSTRUMENTATION.FAZ2F,

  mission_entry: INSTRUMENTATION.LOCKED_V1,
  mission_unfinished_exit: INSTRUMENTATION.LOCKED_V1,
  product_care_open: INSTRUMENTATION.LOCKED_V1,
  home_add_tap: INSTRUMENTATION.LOCKED_V1,
  standalone_open: INSTRUMENTATION.LOCKED_V1,
  first_mission_start: INSTRUMENTATION.LOCKED_V1,
  first_mission_complete: INSTRUMENTATION.LOCKED_V1,
};

/** When a mission id became attachable to an event that ALREADY existed —
 *  only listed when it differs from EVENT_CUTOFF. A historical week can
 *  therefore have a fully real global count (help_opens by reason,
 *  family.mission_undo) while its PER-MISSION breakdown is "not_collected",
 *  because the two capabilities went live on different dates. */
export const ATTRIBUTION_CUTOFF = {
  timer_start: EVENT_CUTOFF.timer_start, // carried a mission id from day one — no gap
  mission_entry: EVENT_CUTOFF.mission_entry, // id + source are one atomic row — no gap
  help_open: INSTRUMENTATION.LOCKED_V1, // event: FAZ1 — mission id: LOCKED_V1
  mission_undo: INSTRUMENTATION.LOCKED_V1, // event: FAZ2F — mission id: LOCKED_V1
};

/** "available" (cutoff at/before the week starts), "not_collected" (cutoff
 *  at/after the week ends), or "partial" (cutoff falls inside the week —
 *  the queried number is real, just not a full-week measurement). */
export function availabilityStatus(cutoffIso, mondayMs, weekEndMs) {
  const cutoffMs = Date.parse(cutoffIso);
  if (cutoffMs <= mondayMs) return "available";
  if (cutoffMs >= weekEndMs) return "not_collected";
  return "partial";
}

/**
 * Records one field's availability for this week and returns its status.
 * Only ever writes an entry for a status other than "available" — an
 * always-live field (nearly everything, for any real-world week) never
 * appears in `availability` at all, keeping the block bounded to genuine
 * historical gaps instead of restating what's already normal.
 */
function trackAvailability(availability, key, cutoffIso, mondayMs, weekEndMs) {
  const status = availabilityStatus(cutoffIso, mondayMs, weekEndMs);
  if (status !== "available") {
    availability[key] = { status, available_from: cutoffIso };
  }
  return status;
}

/** A fresh, zero-filled { source: 0, ... } object — every mission that ever
 *  appears in the snapshot's `missions` map gets one of these, even a
 *  mission with zero mission_entry rows, so a reader sees "0 for every
 *  source" rather than a missing key. */
function zeroEntrySources() {
  return Object.fromEntries(MISSION_ENTRY_SOURCES.map((s) => [s, 0]));
}

/**
 * Pure, unit-testable fold: turns `SELECT source, mission, n` rows into both
 * the overall total-by-source (mutates `missionEntrySources`) and a
 * per-mission cross-tab (mutates each entry in `missions`, creating one if a
 * mission_entry row exists for an id with no other activity yet — should not
 * happen in practice, since mission_start always fires alongside
 * mission_entry, but this must not silently drop a real row if it ever does).
 *
 * Exported so tools/check-mission-entry-sources.mjs can assert the exact
 * cross-tab shape against a synthetic fixture, without a live WAE query.
 *
 * @param {{source: string, mission: number|string, n: number|string}[]} rows
 * @param {Map<string, {starts:number, completes:number, exits:number, entry_sources?: object}>} missions
 * @param {Record<string, number>} missionEntrySources
 */
export function applyMissionEntryRows(rows, missions, missionEntrySources) {
  for (const row of rows) {
    if (!(row.source in missionEntrySources)) {
      console.error(`⚠️  unknown mission_entry source in dataset: ${JSON.stringify(row.source)}`);
      continue;
    }
    const n = Number(row.n);
    const missionKey = String(Number(row.mission));
    missionEntrySources[row.source] = (missionEntrySources[row.source] ?? 0) + n;
    const entry = missions.get(missionKey) ?? { starts: 0, completes: 0, exits: 0 };
    if (!entry.entry_sources) entry.entry_sources = zeroEntrySources();
    entry.entry_sources[row.source] = (entry.entry_sources[row.source] ?? 0) + n;
    missions.set(missionKey, entry);
  }
}

/**
 * Pure, unit-testable fold for a `{mission, n}` row set into a single named
 * per-mission field (e.g. `timer_starts`). Every mission id here is real —
 * timer_start has carried it in double1 since Faz 1, no attribution gap.
 */
export function applyPerMissionCount(rows, missions, field) {
  for (const row of rows) {
    const key = String(Number(row.mission));
    const n = Number(row.n);
    const entry = missions.get(key) ?? { starts: 0, completes: 0, exits: 0 };
    entry[field] = (entry[field] ?? 0) + n;
    missions.set(key, entry);
  }
}

/**
 * Same shape as applyPerMissionCount, but for events where the mission id is
 * a NEW, OPTIONAL addition (help_open, mission_undo — see src/worker.js's
 * Locked v1 review follow-up comment on both). Real mission ids start at 1,
 * so a row's `mission` of 0 is unambiguous: it's either an older row from
 * before this field existed, or a live client that genuinely had no open
 * mission when the event fired — either way, "not attributable", never
 * silently folded into mission 0 (which doesn't exist) or dropped.
 *
 * @param {{mission: number|string, n: number|string}[]} rows
 * @param {Map<string, object>} missions
 * @param {string} field   e.g. "help_opens" or "undos"
 * @param {{attributed: number, unattributed: number}} attribution  mutated in place
 */
export function applyAttributedPerMissionCount(rows, missions, field, attribution) {
  for (const row of rows) {
    const missionNum = Number(row.mission);
    const n = Number(row.n);
    if (missionNum === 0) {
      attribution.unattributed += n;
      continue;
    }
    attribution.attributed += n;
    const key = String(missionNum);
    const entry = missions.get(key) ?? { starts: 0, completes: 0, exits: 0 };
    entry[field] = (entry[field] ?? 0) + n;
    missions.set(key, entry);
  }
}

/** The five cross-reads, and which mission label each one groups by. */
const CROSS_READS = {
  by_age: "age",
  by_difficulty: "difficulty",
  by_players: "players",
  by_duration: "duration",
  by_setting: "setting",
};

/** Frozen by the beacon allowlist (src/worker.js). Order matches the spec. */
export const HELP_REASONS = [
  "ball_stuck",
  "ball_hard_to_remove",
  "strap_uncomfortable",
  "need_more_space",
  "instructions_unclear",
  "mission_too_hard",
];

export const PLAYER_COUNTS = [2, 3, 4];

/* Mission labels, derived from data.js — never hand-written. See
 * tools/derive-missions-meta.mjs for why, and re-run it after editing data.js
 * (--check fails loudly when this file has drifted). */
function loadMissionsMeta() {
  const path = fileURLToPath(new URL("../data/missions-meta.json", import.meta.url));
  let raw;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    throw new Error(
      "data/missions-meta.json is missing. Run: node tools/derive-missions-meta.mjs",
    );
  }
  // Re-derive and compare, every run. A stale meta file does not crash — it
  // quietly files missions under the wrong age band and produces a breakdown
  // that looks perfectly reasonable. Nothing downstream could catch that, and
  // the snapshot is permanent.
  if (raw !== serialiseMeta(buildMeta())) {
    throw new Error(
      "data/missions-meta.json no longer matches data.js — the cross-reads would be wrong.\n" +
        "  Re-run: node tools/derive-missions-meta.mjs",
    );
  }
  return JSON.parse(raw);
}

/* The note travels inside every snapshot file. A number in a git repo outlives
 * the person who can explain it; this is that explanation, attached. */
const METHODOLOGY = [
  "QR Activation Proxy — metodoloji notu:",
  "Bu sayılar KİMLİKSİZ olay/sinyal toplamlarıdır: kalıcı bir sunucu taraflı",
  "kimlik hiçbir zaman üretilmez. Ne benzersiz müşteri sayısıdır, ne",
  'doğrulanmış cihaz sayısıdır — bunlar birer OLAY SAYIMIDIR. "app_opens"',
  "toplam app_open olayı/kullanım sinyalidir (oturum sayısı, kişi sayısı",
  'değil). "app_first_opens" yaklaşık ilk açılış sinyali sayısıdır:',
  "tarayıcı verisi (localStorage) temizlenirse aynı cihaz yeniden \"ilk",
  'açılış" sinyali üretir, bir hanedeki birden fazla tarayıcı/cihaz birden',
  "çok sinyal üretebilir, tek cihazı paylaşan birden fazla kişi tek sinyal",
  "üretir. Hiçbiri kesin kullanıcı/cihaz sayısı değildir, yönsel",
  "(directional) bir göstergedir.",
  "",
  "Üç sayı üç ayrı soruyu cevaplar ve birbirinin yerine kullanılamaz:",
  '"app_first_opens" yaklaşık kaç ilk açılış sinyali görüldüğü (erişim),',
  '"app_opens" toplam kullanım sinyali (kullanım), "return_visits"',
  "localStorage tabanlı dönüş milestone olayları (tutundurma) — 2., 3., 5.",
  "ve 10. ziyarette bir kez kaydedilir, aradaki ziyaretler hiç gönderilmez",
  "ve hiçbirinde cihaz kimliği üretilmez.",
  "",
  'by_* kırılımları mission_start payıdır (toplamları 1.0). Kova başına',
  '"kaçı bitirildi" oranı burada hazır durmaz ama türetilebilir: "missions"',
  "her görevin start/complete sayısını, data/missions-meta.json her görevin",
  "etiketlerini tutar.",
  "",
  "Sayımlar count() değil sum(_sample_interval) ile hesaplanır; Analytics",
  "Engine örneklemeye başlarsa bu, ham satır sayısı yerine örneklemeye göre",
  "düzeltilmiş tahmini verir.",
  "",
  '"excluded_before" null ise haftanın tamamı sayılmıştır; doluysa o andan',
  "önceki satırlar sayıma girmemiştir ve gerekçesi aşağıda yazılıdır.",
  "",
  "generated_at, period_end'den önceyse hafta o an henüz kapanmamıştı ve",
  "sayılar kısmi haftaya aittir.",
  "",
  '"availability" alanı, bu haftada HANGİ sinyallerin henüz toplanmıyor',
  '("not_collected") ya da hafta ortasında başladığını ("partial",',
  "available_from ile) açıkça işaretler. Orada bir alan YOKSA o sinyal bu",
  "hafta için tam ölçülüyordu demektir. \"not_collected\" bir alan snapshot'ta",
  "null'dur — sıfır DEĞİLDİR: sıfır \"ölçüldü ve kimse tetiklemedi\" demek,",
  'null "bu dönemde henüz ölçülmüyordu" demektir. Bkz.',
  "docs/analytics/locked-v1.md, tarihsel geriye-doldurma semantiği bölümü.",
];

/** Appended only on a run that used --since, with the reason spelled out. */
const exclusionNote = (isoInstant) => [
  "",
  `Bu snapshot ${isoInstant} öncesindeki satırları hariç tutarak üretildi.`,
  "Beacon'ın canlıya çıktığı hafta olduğu için haftanın başındaki satırlar",
  "kurulum ve production geçiş testlerinden gelir, gerçek kullanıcı verisi",
  "değildir. Gerçek launch verisi bu andan itibaren başlar.",
];

// ── ISO week arithmetic (UTC, Monday–Sunday — matches the spec's examples) ──

export const DAY_MS = 86400000;

/** Monday 00:00 UTC of the given ISO week. Jan 4 is always in ISO week 1. */
export function mondayOfIsoWeek(year, week) {
  const jan4 = Date.UTC(year, 0, 4);
  const jan4Dow = (new Date(jan4).getUTCDay() + 6) % 7; // Mon = 0
  return jan4 - jan4Dow * DAY_MS + (week - 1) * 7 * DAY_MS;
}

/** The ISO week containing `ms`, as { year, week }. */
function isoWeekOf(ms) {
  const dow = (new Date(ms).getUTCDay() + 6) % 7;
  const monday = Date.UTC(
    new Date(ms).getUTCFullYear(),
    new Date(ms).getUTCMonth(),
    new Date(ms).getUTCDate(),
  ) - dow * DAY_MS;
  // The ISO year is the calendar year of that week's Thursday.
  const year = new Date(monday + 3 * DAY_MS).getUTCFullYear();
  const week = Math.round((monday - mondayOfIsoWeek(year, 1)) / (7 * DAY_MS)) + 1;
  return { year, week };
}

const formatWeekId = (year, week) => `${year}-${String(week).padStart(2, "0")}`;

const isoDate = (ms) => new Date(ms).toISOString().slice(0, 10);

/** 'YYYY-MM-DD HH:MM:SS' — the only datetime literal WAE SQL accepts. */
const sqlDateTime = (ms) => new Date(ms).toISOString().slice(0, 19).replace("T", " ");

/**
 * Parse a --week argument. Round-tripping through the ISO calendar is the
 * validation: it rejects week 00, week 54, and week 53 of a 52-week year
 * without a table of exceptions.
 */
function parseWeekId(raw) {
  const m = /^(\d{4})-(\d{2})$/.exec(raw);
  if (!m) throw new Error(`--week must look like 2026-32, got "${raw}"`);
  const year = Number(m[1]);
  const week = Number(m[2]);
  const monday = mondayOfIsoWeek(year, week);
  const back = isoWeekOf(monday);
  if (back.year !== year || back.week !== week) {
    throw new Error(`ISO week ${raw} does not exist`);
  }
  return { year, week, monday };
}

// ── Credentials ─────────────────────────────────────────────────────────────

/** Where `wrangler login` parks its OAuth token, per platform. */
function wranglerConfigPaths() {
  const home = homedir();
  return [
    process.env.WRANGLER_HOME && join(process.env.WRANGLER_HOME, "config/default.toml"),
    join(home, "Library/Preferences/.wrangler/config/default.toml"), // macOS
    join(home, ".config/.wrangler/config/default.toml"), // Linux / XDG
    join(home, ".wrangler/config/default.toml"), // older wrangler
  ].filter(Boolean);
}

function wranglerOauthToken() {
  for (const path of wranglerConfigPaths()) {
    let toml;
    try {
      toml = readFileSync(path, "utf8");
    } catch {
      continue;
    }
    const m = /^\s*oauth_token\s*=\s*"([^"]+)"/m.exec(toml);
    if (m) return m[1];
  }
  return null;
}

function resolveToken() {
  if (process.env.CLOUDFLARE_API_TOKEN) {
    return { token: process.env.CLOUDFLARE_API_TOKEN, source: "CLOUDFLARE_API_TOKEN" };
  }
  const token = wranglerOauthToken();
  if (token) return { token, source: "wrangler OAuth token (wrangler login)" };
  throw new Error(
    "No credentials. Set CLOUDFLARE_API_TOKEN (Account Analytics: Read), or run `npx wrangler login`.",
  );
}

const API = "https://api.cloudflare.com/client/v4";

async function resolveAccountId(token) {
  if (process.env.CLOUDFLARE_ACCOUNT_ID) return process.env.CLOUDFLARE_ACCOUNT_ID;

  const res = await fetch(`${API}/accounts?per_page=50`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.success) {
    throw new Error(
      `Could not list accounts (HTTP ${res.status}). Set CLOUDFLARE_ACCOUNT_ID explicitly.`,
    );
  }
  const accounts = body.result ?? [];
  if (accounts.length !== 1) {
    throw new Error(
      `Expected exactly one account, found ${accounts.length}. Set CLOUDFLARE_ACCOUNT_ID explicitly.`,
    );
  }
  return accounts[0].id;
}

// ── WAE SQL ─────────────────────────────────────────────────────────────────

/**
 * Run one SQL statement against the Analytics Engine SQL API.
 *
 * Two dialect rules learned the hard way in 1.2 (docs/audits/faz1-beacon.md):
 *   • GROUP BY / ORDER BY must use the SELECT alias, never the raw column —
 *     `SELECT blob1 AS event ... ORDER BY blob1` fails to resolve the type.
 *   • An empty result set comes back as an empty body, not as `[]`.
 * Counts arrive as strings (UInt64), hence the Number() at the call sites.
 */
async function sql(ctx, statement) {
  const res = await fetch(`${API}/accounts/${ctx.accountId}/analytics_engine/sql`, {
    method: "POST",
    headers: { Authorization: `Bearer ${ctx.token}` },
    body: `${statement} FORMAT JSONEachRow`,
  });
  const text = await res.text();
  if (!res.ok) {
    const hint =
      res.status === 401 || res.status === 403
        ? "\n  The token lacks 'Account Analytics: Read', or the wrangler login has expired (`npx wrangler login`)."
        : "";
    throw new Error(`WAE SQL HTTP ${res.status}: ${text.trim()}${hint}`);
  }
  return text
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => JSON.parse(line));
}

/**
 * Query every aggregate for one window and fold it into the snapshot body.
 *
 * The window is [startMs, endMs) — the week's own Monday–Sunday range, with
 * the floor raised only when the caller passed --since.
 */
async function collect(ctx, startMs, endMs) {
  const counts = { app_open: 0, mission_start: 0, mission_complete: 0, app_first_open: 0 };
  const helpOpens = Object.fromEntries(HELP_REASONS.map((r) => [r, 0]));
  const playerCount = Object.fromEntries(PLAYER_COUNTS.map((n) => [String(n), 0]));
  const missions = new Map();
  const features = Object.fromEntries(FEATURE_EVENTS.map((e) => [e, 0]));
  const hub3d = Object.fromEntries(HUB3D_STEPS.map((k) => [k, 0]));
  const returnVisits = Object.fromEntries(RETURN_VISIT_STEPS.map((n) => [String(n), 0]));
  const packViews = new Map();
  const packCompletes = new Map();

  // ── Schema v3 ────────────────────────────────────────────────────────────
  const activationMilestones = Object.fromEntries(ACTIVATION_MILESTONE_EVENTS.map((e) => [e, 0]));
  const legacy = Object.fromEntries(LEGACY_EVENTS.map((e) => [e, 0]));
  const family = {
    team_create: Object.fromEntries(TEAM_KINDS.map((k) => [k, 0])),
    team_switch: 0,
    profile_delete: 0,
    mission_undo: 0,
    level_up: Object.fromEntries(XP_LEVEL_VALUES.map((n) => [String(n), 0])),
  };
  const missionEntrySources = Object.fromEntries(MISSION_ENTRY_SOURCES.map((s) => [s, 0]));
  const productCareTopics = Object.fromEntries(PRODUCT_CARE_TOPICS.map((t) => [t, 0]));
  // help_open/mission_undo mission attribution is new (Locked v1 review
  // follow-up) — see applyAttributedPerMissionCount's own comment for why
  // "attributed vs unattributed" is tracked explicitly rather than silently
  // reading older rows as "zero for every mission".
  const helpOpenAttribution = { attributed: 0, unattributed: 0 };
  const missionUndoAttribution = { attributed: 0, unattributed: 0 };

  const where =
    `WHERE timestamp >= toDateTime('${sqlDateTime(startMs)}') ` +
    `AND timestamp < toDateTime('${sqlDateTime(endMs)}')`;

  // 1 — funnel totals.
  for (const row of await sql(
    ctx,
    `SELECT blob1 AS event, sum(_sample_interval) AS n FROM ${DATASET} ${where} ` +
      `AND blob1 IN ('app_open','mission_start','mission_complete') GROUP BY event`,
  )) {
    counts[row.event] = Number(row.n);
  }

  // 2 — help_open broken down by reason. This breakdown is the whole reason
  // 1.2 stored props in plain columns instead of a JSON string.
  for (const row of await sql(
    ctx,
    `SELECT blob2 AS reason, sum(_sample_interval) AS n FROM ${DATASET} ${where} ` +
      `AND blob1 = 'help_open' GROUP BY reason`,
  )) {
    if (!(row.reason in helpOpens)) {
      // Unreachable through the Worker's allowlist. If it ever happens the
      // number is still real, so keep it and make the noise loud.
      console.error(`⚠️  unknown help_open reason in dataset: ${JSON.stringify(row.reason)}`);
    }
    helpOpens[row.reason] = (helpOpens[row.reason] ?? 0) + Number(row.n);
  }

  // 3 — player_count. double1 is ALWAYS read behind a blob1 filter: events
  // with no numeric prop report double1 = 0, which is indistinguishable from
  // a real zero (docs/audits/faz1-beacon.md, note 3).
  for (const row of await sql(
    ctx,
    `SELECT double1 AS players, sum(_sample_interval) AS n FROM ${DATASET} ${where} ` +
      `AND blob1 = 'player_count' GROUP BY players`,
  )) {
    const key = String(Number(row.players));
    if (!(key in playerCount)) {
      console.error(`⚠️  unknown player_count value in dataset: ${key}`);
    }
    playerCount[key] = (playerCount[key] ?? 0) + Number(row.n);
  }

  // 4 — per-mission starts/completes. Not in the spec's example body; added
  // because WAE drops the source rows once retention closes and "which
  // mission gets abandoned" is not recoverable after that.
  for (const row of await sql(
    ctx,
    `SELECT blob2 AS mission, blob1 AS event, sum(_sample_interval) AS n FROM ${DATASET} ${where} ` +
      `AND blob1 IN ('mission_start','mission_complete') GROUP BY mission, event`,
  )) {
    const entry = missions.get(row.mission) ?? { starts: 0, completes: 0, exits: 0 };
    if (row.event === "mission_start") entry.starts += Number(row.n);
    else entry.completes += Number(row.n);
    missions.set(row.mission, entry);
  }

  // 4b — Schema v3: mission_unfinished_exit per mission. mission_start carries
  // the id in blob2; this event (like timer_start) carries it in double1 —
  // cast to a string so it joins the same `missions` map keys.
  for (const row of await sql(
    ctx,
    `SELECT double1 AS mission, sum(_sample_interval) AS n FROM ${DATASET} ${where} ` +
      `AND blob1 = 'mission_unfinished_exit' GROUP BY mission`,
  )) {
    const key = String(Number(row.mission));
    const entry = missions.get(key) ?? { starts: 0, completes: 0, exits: 0 };
    entry.exits = (entry.exits ?? 0) + Number(row.n);
    missions.set(key, entry);
  }

  /* ── Faz 2 ─────────────────────────────────────────────────────────────── */

  // 5 — feature counts, plus app_first_open. One GROUP BY: every one of these
  // is a bare count with no prop to break down.
  for (const row of await sql(
    ctx,
    `SELECT blob1 AS event, sum(_sample_interval) AS n FROM ${DATASET} ${where} ` +
      `AND blob1 IN (${[...FEATURE_EVENTS, "app_first_open"].map((e) => `'${e}'`).join(",")}) ` +
      `GROUP BY event`,
  )) {
    if (row.event === "app_first_open") counts.app_first_open = Number(row.n);
    else features[row.event] = Number(row.n);
  }

  // 6 — pack_view / pack_complete, both keyed by pack.
  for (const row of await sql(
    ctx,
    `SELECT blob1 AS event, blob2 AS pack, sum(_sample_interval) AS n FROM ${DATASET} ${where} ` +
      `AND blob1 IN ('pack_view','pack_complete') GROUP BY event, pack`,
  )) {
    const target = row.event === "pack_view" ? packViews : packCompletes;
    target.set(row.pack, (target.get(row.pack) ?? 0) + Number(row.n));
  }

  // 7 — the hub funnel, step by step.
  for (const row of await sql(
    ctx,
    `SELECT blob2 AS step, sum(_sample_interval) AS n FROM ${DATASET} ${where} ` +
      `AND blob1 = 'hub3d' GROUP BY step`,
  )) {
    if (!(row.step in hub3d)) console.error(`⚠️  unknown hub3d step in dataset: ${row.step}`);
    hub3d[row.step] = (hub3d[row.step] ?? 0) + Number(row.n);
  }

  // 8 — retention. double1 behind a blob1 filter, same rule as player_count:
  // an event with no numeric prop reports 0, not "absent".
  for (const row of await sql(
    ctx,
    `SELECT double1 AS visit, sum(_sample_interval) AS n FROM ${DATASET} ${where} ` +
      `AND blob1 = 'return_visit' GROUP BY visit`,
  )) {
    const key = String(Number(row.visit));
    if (!(key in returnVisits)) console.error(`⚠️  off-threshold return_visit in dataset: ${key}`);
    returnVisits[key] = (returnVisits[key] ?? 0) + Number(row.n);
  }

  // ── Schema v3 ────────────────────────────────────────────────────────────

  // 9 — activation milestones + legacy events: flat counts, one batched query,
  // same shape as step 5.
  for (const row of await sql(
    ctx,
    `SELECT blob1 AS event, sum(_sample_interval) AS n FROM ${DATASET} ${where} ` +
      `AND blob1 IN (${[...ACTIVATION_MILESTONE_EVENTS, ...LEGACY_EVENTS].map((e) => `'${e}'`).join(",")}) ` +
      `GROUP BY event`,
  )) {
    if (row.event in activationMilestones) activationMilestones[row.event] = Number(row.n);
    else legacy[row.event] = Number(row.n);
  }

  // 10 — the family layer. team_create by kind, level_up by level, the rest
  // are flat counts.
  for (const row of await sql(
    ctx,
    `SELECT blob2 AS kind, sum(_sample_interval) AS n FROM ${DATASET} ${where} ` +
      `AND blob1 = 'team_create' GROUP BY kind`,
  )) {
    if (!(row.kind in family.team_create)) console.error(`⚠️  unknown team_create kind in dataset: ${row.kind}`);
    family.team_create[row.kind] = (family.team_create[row.kind] ?? 0) + Number(row.n);
  }
  for (const row of await sql(
    ctx,
    `SELECT blob1 AS event, sum(_sample_interval) AS n FROM ${DATASET} ${where} ` +
      `AND blob1 IN ('team_switch','profile_delete','mission_undo') GROUP BY event`,
  )) {
    family[row.event] = Number(row.n);
  }
  for (const row of await sql(
    ctx,
    `SELECT double1 AS level, sum(_sample_interval) AS n FROM ${DATASET} ${where} ` +
      `AND blob1 = 'level_up' GROUP BY level`,
  )) {
    const key = String(Number(row.level));
    if (!(key in family.level_up)) console.error(`⚠️  off-ladder level_up value in dataset: ${key}`);
    family.level_up[key] = (family.level_up[key] ?? 0) + Number(row.n);
  }

  // 11 — mission_entry: BOTH the overall total-by-source (kept for the
  // dashboard overview) AND a per-mission × source cross-tab — "which
  // mission gets found how" is exactly the kind of question this snapshot
  // exists to answer before the raw rows expire. Grouped on both dimensions
  // in one query since blob2 (source) and double1 (mission id) are both
  // already indexed columns on every mission_entry row.
  applyMissionEntryRows(
    await sql(
      ctx,
      `SELECT blob2 AS source, double1 AS mission, sum(_sample_interval) AS n FROM ${DATASET} ${where} ` +
        `AND blob1 = 'mission_entry' GROUP BY source, mission`,
    ),
    missions,
    missionEntrySources,
  );

  // 12 — product_care_open, by topic.
  for (const row of await sql(
    ctx,
    `SELECT blob2 AS topic, sum(_sample_interval) AS n FROM ${DATASET} ${where} ` +
      `AND blob1 = 'product_care_open' GROUP BY topic`,
  )) {
    if (!(row.topic in productCareTopics)) console.error(`⚠️  unknown product_care_open topic in dataset: ${row.topic}`);
    productCareTopics[row.topic] = (productCareTopics[row.topic] ?? 0) + Number(row.n);
  }

  // 13 — Locked v1 review follow-up: per-mission timer_start count. Every row
  // has a real mission id (Faz 1 shape, no attribution gap).
  applyPerMissionCount(
    await sql(
      ctx,
      `SELECT double1 AS mission, sum(_sample_interval) AS n FROM ${DATASET} ${where} ` +
        `AND blob1 = 'timer_start' GROUP BY mission`,
    ),
    missions,
    "timer_starts",
  );

  // 14 — per-mission help_open. mission id is a new, optional column (see
  // src/worker.js) — split attributed/unattributed explicitly.
  applyAttributedPerMissionCount(
    await sql(
      ctx,
      `SELECT double1 AS mission, sum(_sample_interval) AS n FROM ${DATASET} ${where} ` +
        `AND blob1 = 'help_open' GROUP BY mission`,
    ),
    missions,
    "help_opens",
    helpOpenAttribution,
  );

  // 15 — per-mission mission_undo. Same new-optional-column treatment.
  applyAttributedPerMissionCount(
    await sql(
      ctx,
      `SELECT double1 AS mission, sum(_sample_interval) AS n FROM ${DATASET} ${where} ` +
        `AND blob1 = 'mission_undo' GROUP BY mission`,
    ),
    missions,
    "undos",
    missionUndoAttribution,
  );

  return {
    counts, helpOpens, playerCount, missions,
    features, hub3d, returnVisits, packViews, packCompletes,
    activationMilestones, legacy, family, missionEntrySources, productCareTopics,
    helpOpenAttribution, missionUndoAttribution,
  };
}

// ── Snapshot body ───────────────────────────────────────────────────────────

/**
 * Roll mission-level starts up into whatever label the meta file carries —
 * age band, difficulty, players, duration, setting.
 *
 * The bucket keys come from the DATA, not from a list written here. The
 * spec's example assumed three age bands and three difficulties; the real
 * missions carry four age bands and only two difficulties. A hardcoded list
 * would have silently dropped the 5+ band into nothing.
 *
 * Each value is that bucket's share of mission_starts, 2dp. Completion per
 * bucket is deliberately not precomputed: `missions` keeps starts AND
 * completes per id, and missions-meta.json keeps every label, so any ratio
 * the panel wants can be derived from the snapshot without another query.
 */
function crossRead(missions, meta, field) {
  const totals = new Map();
  let grand = 0;
  for (const [id, entry] of missions) {
    const labels = meta.missions[id];
    if (!labels) {
      console.error(`⚠️  mission ${id} is in the dataset but not in missions-meta.json`);
      continue;
    }
    const key = String(labels[field]);
    totals.set(key, (totals.get(key) ?? 0) + entry.starts);
    grand += entry.starts;
  }
  // Every bucket the catalogue has, so a zero reads as "nobody played this"
  // rather than as a missing key.
  const out = {};
  for (const labels of Object.values(meta.missions)) out[String(labels[field])] = 0;
  for (const [key, n] of totals) out[key] = grand > 0 ? Math.round((n / grand) * 100) / 100 : 0;
  return Object.fromEntries(Object.entries(out).sort((a, b) => a[0].localeCompare(b[0], "en", { numeric: true })));
}

export function buildSnapshot({ weekId, mondayMs, data, generatedAt, excludedBefore, meta }) {
  const { counts, helpOpens, playerCount, missions,
          features, hub3d, returnVisits, packViews, packCompletes,
          activationMilestones, legacy, family, missionEntrySources, productCareTopics,
          helpOpenAttribution, missionUndoAttribution } = data;

  // Historical backfill semantics — see the INSTRUMENTATION block up top.
  // Every field tracked here gets `null`, never Number(0), for the portion
  // of a week before its capability existed in production.
  const weekEndMs = mondayMs + 7 * DAY_MS;
  const availability = {};
  const track = (key, cutoffIso) => trackAvailability(availability, key, cutoffIso, mondayMs, weekEndMs);

  const missionEntryStatus = track("mission_entry", EVENT_CUTOFF.mission_entry);
  const exitStatus = track("mission_unfinished_exit", EVENT_CUTOFF.mission_unfinished_exit);
  const productCareStatus = track("product_care_open", EVENT_CUTOFF.product_care_open);
  const familyStatus = track("family", INSTRUMENTATION.FAZ2F);
  const helpAttrStatus = track("help_open_attribution", ATTRIBUTION_CUTOFF.help_open);
  const undoAttrStatus = track("mission_undo_attribution", ATTRIBUTION_CUTOFF.mission_undo);
  track("timer_start_attribution", ATTRIBUTION_CUTOFF.timer_start);
  // activation_milestones mixes two different cutoffs in ONE object —
  // welcome_complete (FAZ2B) vs. the four genuinely-new Locked v1 milestones
  // — so every key is tracked and gated independently instead of treating
  // the whole object as one all-or-nothing field.
  const activationStatus = {};
  for (const ev of ACTIVATION_MILESTONE_EVENTS) {
    activationStatus[ev] = track(ev, EVENT_CUTOFF[ev]);
  }

  // Every mission gets a zero-filled entry_sources/exits/timer_starts/
  // help_opens/undos even with zero rows for that field — a reader should
  // see an explicit 0, never a missing key — UNLESS the whole capability
  // did not exist yet this week, in which case the field is `null` instead
  // of a fabricated zero.
  for (const entry of missions.values()) {
    if (!entry.entry_sources) entry.entry_sources = zeroEntrySources();
    if (entry.exits == null) entry.exits = 0;
    if (entry.timer_starts == null) entry.timer_starts = 0;
    if (entry.help_opens == null) entry.help_opens = 0;
    if (entry.undos == null) entry.undos = 0;
    if (missionEntryStatus === "not_collected") entry.entry_sources = null;
    if (exitStatus === "not_collected") entry.exits = null;
    if (helpAttrStatus === "not_collected") entry.help_opens = null;
    if (undoAttrStatus === "not_collected") entry.undos = null;
  }

  // Mission ids are numeric strings; sort them as numbers so 9 precedes 10.
  const missionsSorted = Object.fromEntries(
    [...missions.entries()].sort((a, b) => Number(a[0]) - Number(b[0])),
  );

  // Pack rollup: views and completed_pack come straight off their events,
  // starts/completes are summed from the missions that belong to the pack.
  const packs = {};
  for (const key of meta.pack_keys) {
    packs[key] = {
      views: packViews.get(key) ?? 0,
      starts: 0,
      completes: 0,
      completed_pack: packCompletes.get(key) ?? 0,
    };
  }
  for (const [id, entry] of missions) {
    const labels = meta.missions[id];
    if (!labels || !packs[labels.pack]) continue;
    packs[labels.pack].starts += entry.starts;
    packs[labels.pack].completes += entry.completes;
  }

  const crossReads = Object.fromEntries(
    Object.entries(CROSS_READS).map(([out, field]) => [out, crossRead(missions, meta, field)]),
  );

  return {
    week: weekId,
    period_start: isoDate(mondayMs),
    period_end: isoDate(mondayMs + 6 * DAY_MS),
    app_opens: counts.app_open,
    mission_starts: counts.mission_start,
    mission_completes: counts.mission_complete,
    // null, not 0: with no starts there is no ratio to report, and 0 would
    // read as "nobody finished anything".
    recorded_completion_ratio:
      counts.mission_start > 0
        ? Math.round((counts.mission_complete / counts.mission_start) * 100) / 100
        : null,
    help_opens: helpOpens,
    player_count: playerCount,

    // Reach and retention — the two numbers app_opens alone cannot give.
    // See the methodology note: app_first_opens is directional, not a headcount.
    app_first_opens: counts.app_first_open,
    return_visits: returnVisits,

    packs,
    missions: missionsSorted,
    ...crossReads,
    features,
    hub3d,

    // Schema v3 — Locked v1 R&D dashboard follow-up. Each field below is
    // `null`, not the real object, when `availability` (further down) marks
    // it "not_collected" for this week — see the INSTRUMENTATION block.
    activation_milestones: Object.fromEntries(
      ACTIVATION_MILESTONE_EVENTS.map((ev) => [
        ev,
        activationStatus[ev] === "not_collected" ? null : activationMilestones[ev],
      ]),
    ),
    family: familyStatus === "not_collected" ? null : family,
    mission_entry_sources: missionEntryStatus === "not_collected" ? null : missionEntrySources,
    product_care_topics: productCareStatus === "not_collected" ? null : productCareTopics,
    legacy,
    // How much of this week's help_open/mission_undo could be tied to a
    // mission (src/worker.js only started accepting the id in the Locked v1
    // review follow-up). A `null` sub-object below means the CAPABILITY
    // itself did not exist yet this week — not "0 could be attributed",
    // which would misread as a measured, poor attribution rate. "partial"
    // weeks keep the real counted split; see docs/analytics/locked-v1.md.
    attribution: {
      help_open: helpAttrStatus === "not_collected" ? null : { ...helpOpenAttribution },
      mission_undo: undoAttrStatus === "not_collected" ? null : { ...missionUndoAttribution },
    },
    // Historical backfill semantics: present only for fields with a REAL
    // gap for THIS week (see INSTRUMENTATION above) — absent entirely means
    // every field was fully live for the whole week, same as any ordinary
    // snapshot. "not_collected" fields are `null` above, never Number(0).
    // "partial" fields keep their real (necessarily partial-week) count and
    // name the exact instant collection began.
    availability,

    generated_at: generatedAt,
    dataset: DATASET,
    snapshot_schema: SNAPSHOT_SCHEMA,
    // null on a normal run: the week's own range is the only filter.
    excluded_before: excludedBefore ?? null,
    methodology: excludedBefore
      ? [...METHODOLOGY, ...exclusionNote(excludedBefore)]
      : METHODOLOGY,
  };
}

// ── Entry point ─────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const opts = { week: null, since: null, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--dry-run") opts.dryRun = true;
    else if (arg === "--week") opts.week = argv[++i];
    else if (arg.startsWith("--week=")) opts.week = arg.slice("--week=".length);
    else if (arg === "--since") opts.since = argv[++i];
    else if (arg.startsWith("--since=")) opts.since = arg.slice("--since=".length);
    else if (arg === "--help" || arg === "-h") opts.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return opts;
}

const USAGE = `Usage: node tools/generate-weekly-snapshot.mjs [--week YYYY-WW] [--since INSTANT] [--dry-run]

  --week YYYY-WW   ISO week to snapshot (default: the last complete week)
  --since INSTANT  drop rows before this UTC instant (ISO 8601), e.g.
                   2026-08-08T00:00:00Z — for weeks that contain test traffic.
                   Recorded in the snapshot as excluded_before.
  --dry-run        print the JSON, write nothing`;

/** Parse --since into ms. Must be a real instant inside the target week. */
function parseSince(raw, mondayMs, weekEndMs) {
  const ms = Date.parse(raw);
  if (Number.isNaN(ms)) {
    throw new Error(`--since must be an ISO 8601 instant, got "${raw}"`);
  }
  if (ms <= mondayMs) {
    throw new Error(
      `--since ${raw} is at or before the week's start — it would filter nothing. Drop the flag.`,
    );
  }
  if (ms >= weekEndMs) {
    throw new Error(`--since ${raw} is at or after the week's end — it would filter everything.`);
  }
  return ms;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log(USAGE);
    return;
  }

  const now = Date.now();
  const target = opts.week
    ? parseWeekId(opts.week)
    : (({ year, week }) => ({ year, week, monday: mondayOfIsoWeek(year, week) }))(
        isoWeekOf(now - 7 * DAY_MS),
      );

  const weekId = formatWeekId(target.year, target.week);
  const weekEnd = target.monday + 7 * DAY_MS;

  // The week's own range is the query window. --since raises the floor for
  // this run only; nothing about it is remembered between runs.
  const sinceMs = opts.since ? parseSince(opts.since, target.monday, weekEnd) : null;
  const queryStart = sinceMs ?? target.monday;
  const excludedBefore = sinceMs ? new Date(sinceMs).toISOString().replace(/\.\d{3}Z$/, "Z") : null;

  const { token, source } = resolveToken();
  const accountId = await resolveAccountId(token);

  console.error(`week ${weekId}  ${isoDate(target.monday)} → ${isoDate(weekEnd - DAY_MS)}`);
  console.error(`auth ${source}`);
  if (excludedBefore) {
    console.error(`note --since given: rows before ${excludedBefore} are excluded`);
  }
  if (now < weekEnd) {
    console.error("note this week has not closed yet — the snapshot is partial");
  }

  const meta = loadMissionsMeta();
  const data = await collect({ token, accountId }, queryStart, weekEnd);
  const snapshot = buildSnapshot({
    weekId,
    mondayMs: target.monday,
    data,
    generatedAt: new Date(now).toISOString().replace(/\.\d{3}Z$/, "Z"),
    excludedBefore,
    meta,
  });

  const json = `${JSON.stringify(snapshot, null, 2)}\n`;

  if (opts.dryRun) {
    process.stdout.write(json);
    console.error("dry run — nothing written");
    return;
  }

  const dir = fileURLToPath(new URL("../data/snapshots/", import.meta.url));
  mkdirSync(dir, { recursive: true });
  const out = join(dir, `${weekId}.json`);
  writeFileSync(out, json);
  console.error(`wrote ${out}`);

  // The panel is a static page: it cannot list a directory, so the directory
  // lists itself. Rebuilt from what is actually on disk, not appended to, so
  // a deleted snapshot disappears from the index too.
  const weeks = readdirSync(dir)
    .filter((f) => /^\d{4}-\d{2}\.json$/.test(f))
    .map((f) => f.replace(/\.json$/, ""))
    .sort();
  const indexPath = join(dir, "index.json");
  writeFileSync(indexPath, `${JSON.stringify({ weeks }, null, 2)}\n`);
  console.error(`wrote ${indexPath} — ${weeks.length} week(s)`);
}

// Only auto-run when executed directly (`node tools/generate-weekly-snapshot.mjs`),
// never when imported — tools/check-mission-entry-sources.mjs and friends
// import applyMissionEntryRows/applyPerMissionCount/etc. for unit testing
// without a live Cloudflare credential, and must not trigger a real run.
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(`\n✗ ${err.message}`);
    process.exit(1);
  });
}

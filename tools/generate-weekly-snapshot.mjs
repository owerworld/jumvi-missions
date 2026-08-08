#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
 * JUMVI weekly snapshot generator — Faz 1, Görev 1.3 + Faz 2, Görev 2.2
 *
 * WHY THIS EXISTS
 * Workers Analytics Engine deletes rows after 90 days. Everything that must
 * outlive that window — exit diligence, R&D, marketing — has to be aggregated
 * and committed to git BEFORE the source rows expire. This script is that
 * aggregation step. It reads WAE via the SQL API and writes one JSON file per
 * ISO week under data/snapshots/.
 *
 * A number that is not in a snapshot is gone forever 90 days after the event.
 * That is the reason the mission-level breakdown is captured here even though
 * nothing reads it yet.
 *
 * FAZ 2 adds the sixteen content/feature events, and five cross-reads that
 * need no extra event at all: mission ids are joined against the labels each
 * mission already carries (age, difficulty, players, duration, pack setting)
 * via data/missions-meta.json, which is DERIVED from data.js and re-verified
 * on every run — see loadMissionsMeta().
 *
 * MANUAL ONLY — Faz 1 spec is explicit that this must not run on a schedule
 * in this phase. There is no workflow, no cron, no hook. A human runs it.
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

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildMeta, serialiseMeta } from "./derive-missions-meta.mjs";

const DATASET = "jumvi_events_v1";
const SNAPSHOT_SCHEMA = 2;

/* Feature events: a flat count each, no props to break down. Order is the
 * order the panel reads them in. */
const FEATURE_EVENTS = [
  "daily_pick_tap", "speak_on", "timer_start", "badge_earned",
  "certificate_made", "share_tap", "score_saved", "dashboard_open",
  "missionbook_get", "profile_add", "progress_reset",
];

/** The hub funnel, in order. Frozen with the event (src/worker.js). */
const HUB3D_STEPS = ["shown", "entered", "ready", "moved", "mission", "failed", "escaped"];

/** Only these visit numbers are ever reported (app.js). */
const RETURN_VISIT_STEPS = [2, 3, 5, 10];

/** The five cross-reads, and which mission label each one groups by. */
const CROSS_READS = {
  by_age: "age",
  by_difficulty: "difficulty",
  by_players: "players",
  by_duration: "duration",
  by_setting: "setting",
};

/** Frozen by the beacon allowlist (src/worker.js). Order matches the spec. */
const HELP_REASONS = [
  "ball_stuck",
  "ball_hard_to_remove",
  "strap_uncomfortable",
  "need_more_space",
  "instructions_unclear",
  "mission_too_hard",
];

const PLAYER_COUNTS = [2, 3, 4];

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
  'Bu sayılar cihaz/kullanıcı kimliği içermez. "app_opens" ilk tarayıcı',
  "açılışlarının tahmini sayısıdır; hane başına birden fazla cihaz veya",
  "tarayıcı verisi temizleme nedeniyle olduğundan az/çok sayılabilir.",
  "Kesin kullanıcı sayısı değil, yönsel (directional) bir göstergedir.",
  "",
  "Üç sayı üç ayrı soruyu cevaplar ve birbirinin yerine kullanılamaz:",
  '"app_first_opens" kaç farklı cihazın hiç ulaştığı (erişim), "app_opens"',
  'toplam oturum (kullanım), "return_visits" kaç cihazın geri döndüğü',
  "(tutundurma). app_first_opens de KESİN KULLANICI SAYISI DEĞİL, yönsel",
  "tahmindir: tarayıcı verisi temizlenirse aynı cihaz yeniden sayılır, iki",
  "telefonlu hane iki sayılır, tek telefonu paylaşan iki çocuk bir sayılır.",
  "return_visits yalnızca 2., 3., 5. ve 10. ziyaretlerde kaydedilir; aradaki",
  "ziyaretler hiç gönderilmez ve cihaz kimliği hiçbir zaman üretilmez.",
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

const DAY_MS = 86400000;

/** Monday 00:00 UTC of the given ISO week. Jan 4 is always in ISO week 1. */
function mondayOfIsoWeek(year, week) {
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
  // because WAE drops the source rows at 90 days and "which mission gets
  // abandoned" is not recoverable after that.
  for (const row of await sql(
    ctx,
    `SELECT blob2 AS mission, blob1 AS event, sum(_sample_interval) AS n FROM ${DATASET} ${where} ` +
      `AND blob1 IN ('mission_start','mission_complete') GROUP BY mission, event`,
  )) {
    const entry = missions.get(row.mission) ?? { starts: 0, completes: 0 };
    if (row.event === "mission_start") entry.starts += Number(row.n);
    else entry.completes += Number(row.n);
    missions.set(row.mission, entry);
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

  return {
    counts, helpOpens, playerCount, missions,
    features, hub3d, returnVisits, packViews, packCompletes,
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

function buildSnapshot({ weekId, mondayMs, data, generatedAt, excludedBefore, meta }) {
  const { counts, helpOpens, playerCount, missions,
          features, hub3d, returnVisits, packViews, packCompletes } = data;

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
}

main().catch((err) => {
  console.error(`\n✗ ${err.message}`);
  process.exit(1);
});

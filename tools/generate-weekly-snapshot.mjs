#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
 * JUMVI weekly snapshot generator — Faz 1, Görev 1.3
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

const DATASET = "jumvi_events_v1";
const SNAPSHOT_SCHEMA = 1;

/* ── The cutoff ──────────────────────────────────────────────────────────────
 * Everything in the dataset before this instant is instrumentation test
 * traffic, not real users: the 1.2 preview smoke tests and the production
 * cut-over checks, all on 2026-08-07 (16 rows, 20:13:09–21:20:09 UTC).
 * Verified at the time of writing: the first query at or after this instant
 * returns zero rows.
 *
 * A single cutoff is used rather than a list of excluded windows on purpose.
 * The window list that existed in the notes was already missing a row
 * (20:42:01) — one instant cannot be missing anything.
 *
 * This constant is load-bearing for every past snapshot. Moving it later
 * silently changes what "week one" meant. Don't. */
const DATA_START = Date.UTC(2026, 7, 8, 0, 0, 0); // 2026-08-08T00:00:00Z

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

/* The note travels inside every snapshot file. A number in a git repo outlives
 * the person who can explain it; this is that explanation, attached. */
const METHODOLOGY = [
  "QR Activation Proxy — metodoloji notu:",
  'Bu sayılar cihaz/kullanıcı kimliği içermez. "app_opens" ilk tarayıcı',
  "açılışlarının tahmini sayısıdır; hane başına birden fazla cihaz veya",
  "tarayıcı verisi temizleme nedeniyle olduğundan az/çok sayılabilir.",
  "Kesin kullanıcı sayısı değil, yönsel (directional) bir göstergedir.",
  "",
  '"excluded_before" alanındaki andan önceki tüm veri sayımdan çıkarılmıştır:',
  "dataset'in ilk satırları (2026-08-07) beacon'ın kurulum ve production",
  "geçiş testlerinden gelir, gerçek kullanıcı verisi değildir.",
  "",
  "Sayımlar count() değil sum(_sample_interval) ile hesaplanır; Analytics",
  "Engine örneklemeye başlarsa bu, ham satır sayısı yerine örneklemeye göre",
  "düzeltilmiş tahmini verir.",
  "",
  "generated_at, period_end'den önceyse hafta o an henüz kapanmamıştı ve",
  "sayılar kısmi haftaya aittir.",
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
 * Query every aggregate for one week and fold it into the snapshot body.
 *
 * `window` is already clamped to DATA_START by the caller. When the clamped
 * window is empty (a week entirely before the cutoff) no query runs at all —
 * the zero-filled skeleton is the correct answer.
 */
async function collect(ctx, startMs, endMs) {
  const counts = { app_open: 0, mission_start: 0, mission_complete: 0 };
  const helpOpens = Object.fromEntries(HELP_REASONS.map((r) => [r, 0]));
  const playerCount = Object.fromEntries(PLAYER_COUNTS.map((n) => [String(n), 0]));
  const missions = new Map();

  if (startMs < endMs) {
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
  }

  return { counts, helpOpens, playerCount, missions };
}

// ── Snapshot body ───────────────────────────────────────────────────────────

function buildSnapshot({ weekId, mondayMs, data, generatedAt }) {
  const { counts, helpOpens, playerCount, missions } = data;

  // Mission ids are numeric strings; sort them as numbers so 9 precedes 10.
  const missionsSorted = Object.fromEntries(
    [...missions.entries()].sort((a, b) => Number(a[0]) - Number(b[0])),
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
    missions: missionsSorted,
    generated_at: generatedAt,
    dataset: DATASET,
    snapshot_schema: SNAPSHOT_SCHEMA,
    excluded_before: new Date(DATA_START).toISOString().replace(".000", ""),
    methodology: METHODOLOGY,
  };
}

// ── Entry point ─────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const opts = { week: null, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--dry-run") opts.dryRun = true;
    else if (arg === "--week") opts.week = argv[++i];
    else if (arg.startsWith("--week=")) opts.week = arg.slice("--week=".length);
    else if (arg === "--help" || arg === "-h") opts.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return opts;
}

const USAGE = `Usage: node tools/generate-weekly-snapshot.mjs [--week YYYY-WW] [--dry-run]

  --week YYYY-WW   ISO week to snapshot (default: the last complete week)
  --dry-run        print the JSON, write nothing`;

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
  const queryStart = Math.max(target.monday, DATA_START);

  const { token, source } = resolveToken();
  const accountId = await resolveAccountId(token);

  console.error(`week ${weekId}  ${isoDate(target.monday)} → ${isoDate(weekEnd - DAY_MS)}`);
  console.error(`auth ${source}`);
  if (queryStart > target.monday) {
    console.error(`note query clamped to excluded_before: ${sqlDateTime(queryStart)} UTC`);
  }
  if (now < weekEnd) {
    console.error("note this week has not closed yet — the snapshot is partial");
  }

  const data = await collect({ token, accountId }, queryStart, Math.min(weekEnd, now));
  const snapshot = buildSnapshot({
    weekId,
    mondayMs: target.monday,
    data,
    generatedAt: new Date(now).toISOString().replace(/\.\d{3}Z$/, "Z"),
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

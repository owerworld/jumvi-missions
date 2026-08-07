/* ═══════════════════════════════════════════════════════════════════════════
 * JUMVI minimal beacon — Faz 1, Görev 1.2
 *
 * THE RULE: this Worker writes EXACTLY five event names and nothing else.
 * Anything not on the allowlist below is dropped silently (204, no write).
 * The endpoint is public, so the allowlist is the only thing standing between
 * a bored stranger and a polluted dataset — treat it as load-bearing.
 *
 * PRIVACY INVARIANT (Faz 1 spec, rule 3): no user or device identity is ever
 * recorded. This file must never read request.cf, CF-Connecting-IP,
 * User-Agent, Referer, or cookies. There is no code path here that touches
 * them, and docs/audits/faz1-beacon.md carries the grep proving it. If you
 * add one, you have broken the promise the privacy policy makes.
 *
 * WAE SCHEMA — FROZEN. Renaming a column or an event splits historical data,
 * and Analytics Engine cannot backfill. See docs/audits/faz1-beacon.md.
 *
 *   blob1   = event name
 *   blob2   = string prop  ("" when the event has none)
 *   double1 = numeric prop (absent when the event has none)
 *   index1  = event name   (sampling key — keep cardinality at 5)
 * ═══════════════════════════════════════════════════════════════════════════ */

const BEACON_PATH = "/api/beacon";

/** Bodies are tiny by construction; anything larger is not ours. */
const MAX_BODY_BYTES = 512;

const HELP_REASONS = new Set([
  "ball_stuck",
  "ball_hard_to_remove",
  "strap_uncomfortable",
  "need_more_space",
  "instructions_unclear",
  "mission_too_hard",
]);

const PLAYER_COUNTS = new Set([2, 3, 4]);

/** Mission ids are integers 1..36 (data.js). The ceiling is deliberately
 *  generous for future packs but bounded — an unbounded id would let anyone
 *  blow up blob2 cardinality. */
const MISSION_ID_MAX = 200;

function isMissionId(v) {
  return Number.isInteger(v) && v >= 1 && v <= MISSION_ID_MAX;
}

/**
 * Validate one beacon payload and turn it into a writeDataPoint argument.
 * Pure — no I/O, no env — so the smoke test can assert exact column layout
 * without a running Worker. Returns null for anything invalid.
 *
 * @param {unknown} payload  parsed JSON body, untrusted
 * @returns {{blobs: string[], doubles: number[], indexes: string[]}|null}
 */
export function buildDataPoint(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;

  const name = payload.e;
  const point = (blob2, doubles) => ({
    blobs: [name, blob2],
    doubles,
    indexes: [name],
  });

  switch (name) {
    case "app_open":
      return point("", []);

    case "mission_start":
    case "mission_complete":
      return isMissionId(payload.id) ? point(String(payload.id), []) : null;

    case "help_open":
      return HELP_REASONS.has(payload.reason) ? point(payload.reason, []) : null;

    case "player_count":
      return PLAYER_COUNTS.has(payload.n) ? point("", [payload.n]) : null;

    default:
      return null;
  }
}

/** Always 204: the client is fire-and-forget (sendBeacon) and must never be
 *  able to tell a rejected event from an accepted one. Nothing to probe. */
const NO_CONTENT = () => new Response(null, { status: 204 });

async function handleBeacon(request, env) {
  if (request.method !== "POST") {
    return new Response(null, { status: 405, headers: { Allow: "POST" } });
  }

  let payload;
  try {
    const body = await request.text();
    if (body.length > MAX_BODY_BYTES) return NO_CONTENT();
    payload = JSON.parse(body);
  } catch (_) {
    return NO_CONTENT();
  }

  const dataPoint = buildDataPoint(payload);
  if (!dataPoint) return NO_CONTENT();

  // Note the absence: no timestamp is written. Analytics Engine stamps every
  // row itself, and a client clock is not something to build a funnel on.
  try {
    env.JUMVI_ANALYTICS.writeDataPoint(dataPoint);
  } catch (_) {
    // A dropped metric must never surface as a broken app.
  }

  return NO_CONTENT();
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname === BEACON_PATH) return handleBeacon(request, env);

    // Everything else is the static site, exactly as before this Worker
    // existed. Assets that match are served by the platform without reaching
    // us at all; this covers the misses so 404 behaviour is unchanged.
    return env.ASSETS.fetch(request);
  },
};

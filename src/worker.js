/* ═══════════════════════════════════════════════════════════════════════════
 * JUMVI beacon — Faz 1, Görev 1.2 (5 events) + Faz 2, Görev 2.1 (16 more)
 *                + activation/Quick Play follow-up (2 more)
 *
 * THE RULE: this Worker writes EXACTLY twenty-three event names and nothing else.
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

/* ═══════════════════════════════════════════════════════════════════════════
 * /analiz — password-gated Ar-Ge panel, Faz 2 follow-up.
 *
 * Lives on the SAME Worker/domain as the children's app. That was a
 * deliberate, discussed trade-off, not an oversight: it needed zero
 * Cloudflare dashboard work (no new DNS/subdomain), at the cost of the panel
 * now sharing blast radius with qr.jumvi.co. The mitigation is that this
 * block is small, self-contained, and touches nothing the beacon or asset
 * fall-through paths use.
 *
 * data/ used to be excluded in .assetsignore (Faz 1: "product domain and
 * git archive are different things"). It no longer is — the panel's own
 * client-side JS fetches data/snapshots/*.json and data/missions-meta.json
 * directly, and .assetsignore has no notion of "servable but only with a
 * password". So instead: data/ ships as a normal asset, and every request
 * under /data/ is gated by the SAME Basic Auth check as /analiz itself,
 * enforced here before ASSETS.fetch ever runs. This also means a plain
 * `git push` after `generate-weekly-snapshot.mjs` is still the entire
 * update path — no separate panel deploy step.
 *
 * The data itself was never secret (data/snapshots/*.json sits in this
 * public GitHub repo already). The password's job is to keep it from being
 * casually stumbled on at the product domain, not to protect something that
 * would otherwise be hidden.
 * ═══════════════════════════════════════════════════════════════════════════ */
const ANALIZ_PATH = "/analiz";
const DATA_PREFIX = "/data/";
/** The panel's own HTML lives here as a normal asset — must be gated exactly
 *  like /data/, or a direct request bypasses /analiz's check entirely. */
const ANALIZ_ASSET_PREFIX = "/assets/analiz/";
const ANALIZ_REALM = "jumvi-analiz";

/** Every branch takes the same time regardless of where a/b first differ —
 *  a plain === would let an attacker time out the correct password
 *  character by character. Overkill for a low-stakes internal password,
 *  but free to get right. */
function safeEqual(a, b) {
  const len = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

/** Username is not checked — only the shared secret matters. Set with
 *  `wrangler secret put ANALIZ_PASSWORD` (never in wrangler.jsonc or here). */
function isAuthorized(request, env) {
  if (!env.ANALIZ_PASSWORD) return false; // secret not set → nobody gets in
  const header = request.headers.get("Authorization") || "";
  if (!header.startsWith("Basic ")) return false;
  let decoded;
  try {
    decoded = atob(header.slice(6));
  } catch (_) {
    return false;
  }
  const password = decoded.slice(decoded.indexOf(":") + 1);
  return safeEqual(password, env.ANALIZ_PASSWORD);
}

const UNAUTHORIZED = () =>
  new Response("Authentication required.", {
    status: 401,
    headers: {
      "WWW-Authenticate": `Basic realm="${ANALIZ_REALM}"`,
      "X-Robots-Tag": "noindex",
    },
  });

/** True for exactly /analiz, /analiz/, and anything under /data/. */
function isGatedPath(pathname) {
  return pathname === ANALIZ_PATH || pathname === `${ANALIZ_PATH}/` ||
    pathname.startsWith(DATA_PREFIX) || pathname.startsWith(ANALIZ_ASSET_PREFIX);
}
const TR_APP_PATHS = new Set(["/tr", "/tr/", "/tr/index.html"]);

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

/* ── Faz 2 enums — every one of these is frozen ────────────────────────────
 * blob2 is a fixed enum or a number, never free text. A typo'd value here
 * does not fail loudly; it silently becomes a category nobody notices is
 * wrong, forever. Keep these in sync with data.js (PACKS / BADGES). */

/** PACKS in data.js, minus the "all" pseudo-pack. */
const PACK_KEYS = new Set([
  "Aim Master",
  "Focus Control",
  "Team Duo",
  "Indoor Compact",
  "Beach/Park",
  "Reflex Rush",
]);

/** BADGES ids in data.js. */
const BADGE_IDS = new Set([
  "first", "aim", "zen", "team", "indoor", "outdoor", "reflex",
  "streak3", "streak7", "champ", "zippy",
]);

const SHARE_CHANNELS = new Set(["whatsapp", "native", "copy"]);

/** The hub funnel, in order: offered → opened → loaded → walked → played.
 *  failed/escaped are the two ways out of the loading screen. */
const HUB3D_STEPS = new Set([
  "shown", "entered", "ready", "moved", "mission", "failed", "escaped",
]);

/** Only these visit numbers are ever reported. See app.js for why the ones
 *  in between stay on the device. */
const RETURN_VISITS = new Set([2, 3, 5, 10]);

/** JUMVI_PLAY_MODES ids in play-modes.js. Nine, fixed, and deliberately the
 *  only dimension quickplay_start carries: each mode already belongs to one
 *  player group (solo / duo / group), so the group breakdown is derivable
 *  offline and does not need a second column. Keep in sync with play-modes.js;
 *  tools/check-play-modes.mjs asserts the count there. */
const PLAY_MODE_IDS = new Set([
  "pop-and-stick", "quick-drop", "floor-target-four",
  "free-rally", "copycat-pops", "four-ball-round",
  "sync-pop", "loop-rally", "twin-lane-rally",
]);

/** Mission ids are integers 1..36 (data.js). The ceiling is deliberately
 *  generous for future packs but bounded — an unbounded id would let anyone
 *  blow up blob2 cardinality. */
/* Faz 2F — the family layer. TEAM_KINDS carries the SHAPE of a pairing, never
 * the pairing itself: "adult" covers dad/mom/grandma/grandpa/friend, "sibling"
 * covers a named second child. Neither the relationship, the child names, the
 * profile ids nor the team id ever leave the device. XP_LEVEL_VALUES mirrors
 * XP_LEVELS in app.js — level 1 is the floor everyone starts on, so only 2..7
 * can ever be crossed INTO. */
const TEAM_KINDS = new Set(["adult", "sibling"]);
const XP_LEVEL_VALUES = new Set([2, 3, 4, 5, 6, 7]);

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

    /* ── Faz 2 ─────────────────────────────────────────────────────────── */

    case "pack_view":
    case "pack_complete":
      return PACK_KEYS.has(payload.pack) ? point(payload.pack, []) : null;

    case "badge_earned":
      return BADGE_IDS.has(payload.badge) ? point(payload.badge, []) : null;

    case "share_tap":
      return SHARE_CHANNELS.has(payload.channel) ? point(payload.channel, []) : null;

    case "hub3d":
      return HUB3D_STEPS.has(payload.step) ? point(payload.step, []) : null;

    // The mission id goes in double1 here, not blob2 as mission_start does.
    // Deliberate, and it means a timer query must read double1 behind a
    // blob1 = 'timer_start' filter — never bare.
    case "timer_start":
      return isMissionId(payload.id) ? point("", [payload.id]) : null;

    case "return_visit":
      return RETURN_VISITS.has(payload.n) ? point("", [payload.n]) : null;

    /* ── Activation funnel + Quick Play ────────────────────────────────────
     * welcome_complete closes the gap between app_first_open ("a device
     * arrived") and timer_start ("play actually began"): without it there is
     * no way to tell a family who bounced off the welcome screen from one who
     * never scanned at all. Carries no prop — it is a milestone, not a
     * measurement, and the age band chosen on that screen is deliberately NOT
     * sent (that is a separate, unapproved decision).
     *
     * quickplay_start carries the mode id so we can see WHICH repeatable game
     * a family reaches for. It is emitted by the Quick Play runtime, which
     * writes no mission progress — the two funnels stay separate on purpose. */
    case "welcome_complete":
      return point("", []);

    case "quickplay_start":
      return PLAY_MODE_IDS.has(payload.mode) ? point(payload.mode, []) : null;

    // Events with no prop at all. Anything extra the client sends is dropped
    // on the floor here — the column layout is built from this file, not from
    // the payload.
    case "team_create":
      return TEAM_KINDS.has(payload.kind) ? point(payload.kind, []) : null;

    case "level_up":
      return XP_LEVEL_VALUES.has(payload.level) ? point("", [payload.level]) : null;

    case "daily_pick_tap":
    case "certificate_made":
    case "speak_on":
    case "score_saved":
    case "dashboard_open":
    case "missionbook_get":
    case "profile_add":
    case "progress_reset":
    case "app_first_open":
    case "team_switch":
    case "profile_delete":
    case "mission_undo":
      return point("", []);

    default:
      return null;
  }
}

/** Always 204: the client is fire-and-forget (sendBeacon) and must never be
 *  able to tell a rejected event from an accepted one. Nothing to probe. */
const NO_CONTENT = () => new Response(null, { status: 204 });

/**
 * /tr is not a fork of index.html. It is the current root shell with one
 * locale layer injected after data.js and before app.js. That guarantees
 * design, features and internal progress IDs stay in lockstep with English.
 */
async function handleTurkishApp(request, env) {
  const rootUrl = new URL(request.url);
  rootUrl.pathname = "/index.html";
  rootUrl.search = "";

  const rootRequest = new Request(rootUrl.toString(), {
    method: "GET",
    headers: request.headers,
  });
  const upstream = await env.ASSETS.fetch(rootRequest);
  if (!upstream.ok) return upstream;

  let html = await upstream.text();

  // Relative URLs on the root shell must keep resolving from /, not /tr/.
  html = html.replace(/<html\s+lang=["']en["']>/i, '<html lang="tr">');
  // Comments are prose and must never be able to switch off a load-bearing
  // injection. A code comment in index.html that merely MENTIONED a base tag
  // once satisfied this guard, and /tr shipped with no base element at all —
  // which silently breaks every relative URL on /tr/ and /tr/index.html.
  // Strip comments before deciding whether a real one is already present.
  if (!/<base\s/i.test(html.replace(/<!--[\s\S]*?-->/g, ""))) {
    html = html.replace(/<head>/i, '<head>\n  <base href="/">');
  }

  // Server-visible locale metadata (JS repeats this client-side as a guard).
  html = html
    .replace(/<title>[\s\S]*?<\/title>/i,
      '<title>JUMVI Görevleri — Oyna, Yakala, Devam Et</title>')
    .replace(/<meta\s+name=["']description["'][^>]*>/i,
      '<meta name="description" content="JUMVI Toss & Catch için 36 eğlenceli görev. İlerlemeyi takip et, rozetleri kazan ve Koç Leo’nun 3D macerasını keşfet. Kayıt, hesap ve reklam yok." />')
    .replace(/<link\s+rel=["']canonical["'][^>]*>/i,
      '<link rel="canonical" href="https://qr.jumvi.co/tr" />\n' +
      '  <link rel="alternate" hreflang="en" href="https://qr.jumvi.co/" />\n' +
      '  <link rel="alternate" hreflang="tr" href="https://qr.jumvi.co/tr" />\n' +
      '  <link rel="alternate" hreflang="x-default" href="https://qr.jumvi.co/" />')
    .replace(/<meta\s+property=["']og:url["'][^>]*>/i,
      '<meta property="og:url" content="https://qr.jumvi.co/tr" />')
    .replace(/<meta\s+property=["']og:title["'][^>]*>/i,
      '<meta property="og:title" content="JUMVI Görevleri — Çocuklar için 36 Toss & Catch Oyunu" />')
    .replace(/<meta\s+property=["']og:description["'][^>]*>/i,
      '<meta property="og:description" content="36 JUMVI görevi, ilerleme, rozetler ve Koç Leo’nun 3D macerası." />')
    .replace(/<meta\s+name=["']twitter:url["'][^>]*>/i,
      '<meta name="twitter:url" content="https://qr.jumvi.co/tr" />')
    .replace(/<meta\s+name=["']twitter:title["'][^>]*>/i,
      '<meta name="twitter:title" content="JUMVI Görevleri — Çocuklar için Aktif Oyunlar" />')
    .replace(/<meta\s+name=["']twitter:description["'][^>]*>/i,
      '<meta name="twitter:description" content="Kısa ve hareketli Toss & Catch görevleri. Kuralları oku, telefonu bırak ve oyna." />')
    .replace(/<link\s+rel=["']manifest["'][^>]*>/i,
      '<link rel="manifest" href="/tr/manifest.json" />')
    // Structured data. Left English, this hands search engines an English
    // name and a "url" pointing at "/" for a page whose canonical is "/tr" —
    // the two would contradict each other. Only the localizable fields and
    // the url change; @type, offers, audience and publisher are identical in
    // both languages and stay byte-for-byte as the English page has them.
    .replace(/"name": "JUMVI Missions"/, '"name": "JUMVI Görevleri"')
    .replace(/"url": "https:\/\/qr\.jumvi\.co\/"/, '"url": "https://qr.jumvi.co/tr"')
    .replace(/"description": "36 quick, active toss & catch missions for the JUMVI Paddle Set\."/,
      '"description": "JUMVI Toss & Catch Raket Seti için 36 kısa ve hareketli görev."')
    .replace(/("@type": "WebApplication",)/, '$1\n    "inLanguage": "tr-TR",');

  // Deferred scripts preserve source order. data.js defines mission/pack data;
  // locale layer mutates display strings; app.js then renders Turkish.
  const localeScript = '<script src="/tr/i18n.js?v=20260815-2" defer></script>';
  if (!html.includes('/tr/i18n.js')) {
    const dataTag = /(<script\s+src=["']data\.js[^"']*["'][^>]*><\/script>)/i;
    if (dataTag.test(html)) {
      html = html.replace(dataTag, `$1\n${localeScript}`);
    } else {
      const appTag = /(<script\s+src=["']app\.js[^"']*["'][^>]*><\/script>)/i;
      if (!appTag.test(html)) {
        return new Response("JUMVI TR injection marker missing", { status: 500 });
      }
      html = html.replace(appTag, `${localeScript}\n$1`);
    }
  }

  const headers = new Headers(upstream.headers);
  headers.delete("content-length");
  headers.delete("etag");
  headers.set("content-type", "text/html; charset=utf-8");
  headers.set("content-language", "tr");

  return new Response(html, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers,
  });
}

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
    if (TR_APP_PATHS.has(pathname)) return handleTurkishApp(request, env);

    if (isGatedPath(pathname)) {
      if (!isAuthorized(request, env)) return UNAUTHORIZED();
      if (pathname === ANALIZ_PATH || pathname === `${ANALIZ_PATH}/`) {
        // The real file lives at /assets/analiz/index.html (a normal,
        // servable asset) — /analiz is just the gate in front of it. Ask for
        // the directory form, not .../index.html directly: the asset layer
        // 307-redirects the literal filename to its clean-URL form, and
        // that redirect would otherwise go straight to the client instead
        // of being followed.
        const panelUrl = new URL(request.url);
        panelUrl.pathname = "/assets/analiz/";
        return env.ASSETS.fetch(new Request(panelUrl, request));
      }
      // /data/* and direct /assets/analiz/* requests — authorized, fall
      // through to the normal asset fetch below; the request URL already
      // matches the real path.
    }

    // Everything else is the static site, exactly as before this Worker
    // existed. Assets that match are served by the platform without reaching
    // us at all (except the run_worker_first paths above, which always land
    // here first) — this covers the misses so 404 behaviour is unchanged.
    return env.ASSETS.fetch(request);
  },
};

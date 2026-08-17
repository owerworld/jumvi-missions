/* ═══════════════════════════════════════════════════════════════════════════
 * THE RULE: change any file in CORE_ASSETS  →  bump CACHE_NAME. Always.
 *
 * Why it matters more than it looks: CORE_ASSETS paths are deliberately
 * UNVERSIONED (no ?v=) so the precache can match them literally. This worker
 * serves them cache-first and NEVER refetches a precached file until
 * CACHE_NAME changes. So editing, say, /style.css or a Leo sprite without
 * bumping CACHE_NAME means every returning visitor keeps the OLD file
 * indefinitely — and nothing anywhere reports it. (Coach Leo's 3D model
 * shipped stale for exactly this class of reason; _headers had the same flaw
 * one layer up, where "immutable" on an unversioned path stopped the browser
 * from ever revalidating.)
 *
 * This is enforced, not just documented:
 *     ./tools/check-core-assets.sh            → fails if an asset changed
 *                                               without a CACHE_NAME bump
 *     ./tools/check-core-assets.sh --update   → re-lock after bumping
 * Run it before every deploy.
 * ═══════════════════════════════════════════════════════════════════════════ */
const CACHE_NAME = "jumvi-missions-v213";
const CORE_ASSETS = [
  "/",
  "/index.html",
  // The Turkish navigation shell, precached for the same reason as
  // /index.html above. Without it the two languages are not equal offline:
  // the English shell is on the device from the install step, but /tr only
  // reaches the cache once a navigation is INTERCEPTED, and the very first
  // visit happens before this worker controls the page. A family whose first
  // ever visit is /tr would then have nothing to fall back to offline, while
  // an English-first family would. Served by the Worker (TR_APP_PATHS), so
  // addAll resolves it.
  "/tr/index.html",
  "/tr/manifest.json",
  "/style.css",
  "/warm-toy.css",
  "/app.js",
  "/data.js",
  "/play-modes.js",
  "/mission-coaching.js",
  "/play-mode-icons.js",
  "/jumvi-mission-icons.js",
  "/jumvi-art.js",
  "/assets/ui/missions/01-speed-demon.webp",
  "/assets/ui/missions/02-red-light-green-light.webp",
  "/assets/ui/missions/03-quick-slap.webp",
  "/assets/ui/missions/04-switcharoo.webp",
  "/assets/ui/missions/05-statue-mode.webp",
  "/assets/ui/missions/06-number-echo.webp",
  "/assets/ui/missions/07-rainbow-throws.webp",
  "/assets/ui/missions/08-the-landing-pad.webp",
  "/assets/ui/missions/09-step-back-challenge.webp",
  "/assets/ui/missions/10-power-step.webp",
  "/assets/ui/missions/11-sky-floater.webp",
  "/assets/ui/missions/12-heart-high.webp",
  "/assets/ui/missions/13-silent-mode.webp",
  "/assets/ui/missions/14-tempo-master.webp",
  "/assets/ui/missions/15-spotlight-eyes.webp",
  "/assets/ui/missions/16-1-2-3-go.webp",
  "/assets/ui/missions/17-mirror-mode.webp",
  "/assets/ui/missions/18-count-to-10.webp",
  "/assets/ui/missions/19-round-robin.webp",
  "/assets/ui/missions/20-crab-walk-relay.webp",
  "/assets/ui/missions/21-captain-says.webp",
  "/assets/ui/missions/22-spin-squad.webp",
  "/assets/ui/missions/23-mix-it-up.webp",
  "/assets/ui/missions/24-2v2-squad-count.webp",
  "/assets/ui/missions/25-chill-catch.webp",
  "/assets/ui/missions/26-tiny-space.webp",
  "/assets/ui/missions/27-secret-signal.webp",
  "/assets/ui/missions/28-mind-reader.webp",
  "/assets/ui/missions/29-stuck-foot-catch.webp",
  "/assets/ui/missions/30-left-or-right.webp",
  "/assets/ui/missions/31-cloud-chaser.webp",
  "/assets/ui/missions/32-home-base.webp",
  "/assets/ui/missions/33-how-far-can-you-throw.webp",
  "/assets/ui/missions/34-chase-the-ball.webp",
  "/assets/ui/missions/35-sky-high-jump.webp",
  "/assets/ui/missions/36-marathon-rally.webp",
  "/assets/ui/packs/aim-master.webp",
  "/assets/ui/packs/focus-control.webp",
  "/assets/ui/packs/team-duo.webp",
  "/assets/ui/packs/indoor-compact.webp",
  "/assets/ui/packs/beach-park.webp",
  "/assets/ui/packs/reflex-rush.webp",
  "/assets/ui/badges/first.webp",
  "/assets/ui/badges/aim.webp",
  "/assets/ui/badges/zen.webp",
  "/assets/ui/badges/team.webp",
  "/assets/ui/badges/indoor.webp",
  "/assets/ui/badges/outdoor.webp",
  "/assets/ui/badges/reflex.webp",
  "/assets/ui/badges/streak3.webp",
  "/assets/ui/badges/streak7.webp",
  "/assets/ui/badges/champ.webp",
  "/assets/ui/badges/zippy.webp",
  "/assets/ui/badges/unlocked.webp",
  "/assets/ui/avatars/monkey.webp",
  "/assets/ui/avatars/dog.webp",
  "/assets/ui/avatars/dinosaur.webp",
  "/assets/ui/avatars/unicorn.webp",
  "/assets/ui/avatars/alien.webp",
  "/assets/ui/avatars/robot.webp",
  "/assets/ui/avatars/fox.webp",
  "/assets/ui/avatars/panda.webp",
  "/assets/ui/avatars/tiger.webp",
  "/assets/ui/avatars/koala.webp",
  "/assets/ui/avatars/frog.webp",
  "/assets/ui/avatars/butterfly.webp",
  "/assets/ui/special/ages-3-5.webp",
  "/assets/ui/special/ages-6-8.webp",
  "/assets/ui/special/ages-8-up.webp",
  "/assets/ui/special/leo-island.webp",
  "/assets/ui/special/streak.webp",
  "/assets/ui/special/celebration.webp",
  "/assets/ui/hero/home-hero-light.webp",
  "/assets/ui/hero/home-hero-dark.webp",
  "/assets/equipment/jumvi-paddle-128.png",
  "/assets/equipment/jumvi-ball-128.png",
  "/assets/equipment/jumvi-paddle-real.webp",
  "/assets/equipment/jumvi-paddle-back-real.webp",
  "/assets/equipment/jumvi-ball-real.webp",
  "/confetti.min.js",
  "/jumvi-icons.css",
  "/leo-tour.css",
  "/leo-tour.js",
  "/jumvi-redlight.js",
  "/coach-leo-audio.js",
  // §7 — ambient music system. world-ambience precedes music-scheduler so the
  // dependency it looks up at start() (window.JumviWorldAmbience) exists.
  // The opus/mp3 music fragments themselves are deliberately NOT precached
  // here — same call as Coach Leo's narration mp3s below: they're fetched
  // and cache-filled on first real use via the generic fetch handler, so a
  // fresh install never blocks on ~1.3MB of audio nobody has heard yet.
  "/jumvi-world-ambience.js",
  "/jumvi-music-scheduler.js",
  "/jumvi-sonic-cues.js",
  "/manifest.json",
  // §2.4 — logo derivatives (originals moved to assets/logo/source/, off the critical path)
  "/assets/logo/jumvi_logo_dark-96.webp",
  "/assets/logo/jumvi_logo_dark-192.webp",
  "/assets/logo/jumvi_logo_light-96.webp",
  "/assets/logo/jumvi_logo_light-192.webp",
  // §2.1 Coach Leo sprites — precached so the greeting/welcome/tour render offline
  "/assets/leo/leo-face-64.webp",
  "/assets/leo/leo-face-64@2x.webp",
  "/assets/leo/leo-wave-240.webp",
  "/assets/leo/leo-wave-240@2x.webp",
  "/assets/leo/leo-point-160.webp",
  "/assets/leo/leo-point-160@2x.webp",
  // §6 — display typeface. Unversioned paths on purpose (precache matches
  // literally); _headers gives /assets/* a 1-day max-age + SWR, not immutable.
  "/assets/fonts/fredoka-var-latin-1.woff2",
  "/assets/fonts/fredoka-var-latin-ext-1.woff2",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-512-maskable.png",
  "/icons/apple-touch-icon.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

const LARGE_ASSETS = new Set([
  "/certificate-template.webp",
  // Same treatment for the Turkish template: it is the same kind of asset,
  // fetched on demand when a child opens the certificate, and blocking the
  // first paint on it would be a /tr-only regression.
  "/tr/certificate-template.webp"
]);

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Cross-origin (CDN: three.js, Tabler icons, Plausible) — don't proxy
  // through the SW at all. A fetch() made INSIDE the SW is governed by the
  // SW's own CSP (connect-src), which broke ES-module imports of three.js
  // on production; left alone, the request is governed by the page's CSP
  // (script-src, which allows these CDNs) and the browser's HTTP cache.
  if (url.origin !== self.location.origin) return;

  // Network-first for HTML/navigation.
  // IMPORTANT: /tr must never overwrite the English /index.html cache.
  if (req.mode === "navigate" || (req.headers.get("accept") || "").includes("text/html")) {
    const navCacheKey = /^\/tr(?:\/|$)/.test(url.pathname)
      ? "/tr/index.html"
      : "/index.html";
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(navCacheKey, copy));
          return res;
        })
        .catch(() => caches.match(navCacheKey))
    );
    return;
  }

  // Cache-first for static assets.
  //
  // Runtime-filled entries (Coach Leo's narration mp3s, the music fragments —
  // everything deliberately left out of CORE_ASSETS) land in this SAME cache,
  // keyed by CACHE_NAME. That is what makes replacing an audio file in place,
  // at the same URL, safe: `activate` above deletes every cache whose key is
  // not the current CACHE_NAME, so a version bump evicts the runtime-cached
  // audio along with the precache and the next play refetches it. A returning
  // iPhone cannot sit on a stale clip across a release — but only because the
  // bump happens. Without it, cache-first means forever, for audio too.
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      // For large assets, avoid blocking UI on first load
      if(LARGE_ASSETS.has(url.pathname)){
        return fetch(req);
      }
      return fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
        return res;
      });
    })
  );
});

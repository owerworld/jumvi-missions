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
const CACHE_NAME = "jumvi-missions-v144";
const CORE_ASSETS = [
  "/",
  "/index.html",
  "/style.css",
  "/app.js",
  "/data.js",
  "/confetti.min.js",
  "/jumvi-icons.css",
  "/leo-tour.css",
  "/leo-tour.js",
  "/jumvi-mission-icons.js",
  "/jumvi-redlight.js",
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
  "/certificate-template.webp"
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

  // Network-first for HTML/navigation
  if (req.mode === "navigate" || (req.headers.get("accept") || "").includes("text/html")) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put("/index.html", copy));
          return res;
        })
        .catch(() => caches.match("/index.html"))
    );
    return;
  }

  // Cache-first for static assets
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

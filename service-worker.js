const CACHE_NAME = "jumvi-missions-v114";
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
  "/jumvi_logo_dark.webp",
  "/jumvi_logo_light.webp",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
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

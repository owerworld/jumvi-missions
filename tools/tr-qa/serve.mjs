/* Runs the REAL src/worker.js over a local HTTP server, with env.ASSETS
 * shimmed to read the repo from disk exactly as Cloudflare's asset binding
 * would (including the "asset match wins before the Worker runs" rule).
 * Nothing about the /tr logic is reimplemented here — that is the point. */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = process.argv[2] || process.cwd();
const PORT = Number(process.argv[3] || 8787);

const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".webmanifest": "application/manifest+json",
  ".png": "image/png", ".webp": "image/webp", ".jpg": "image/jpeg", ".svg": "image/svg+xml",
  ".woff2": "font/woff2", ".glb": "model/gltf-binary", ".pdf": "application/pdf",
};

// Mirrors .assetsignore — these are never uploaded as assets.
const IGNORED = [".git/", ".claude/", "prototypes/", "tools/", "src/", "data/", "docs/", "node_modules/", ".wrangler/"];

function resolveAsset(pathname) {
  let rel = decodeURIComponent(pathname).replace(/^\/+/, "");
  if (rel === "") rel = "index.html";
  if (IGNORED.some((p) => rel === p.slice(0, -1) || rel.startsWith(p))) return null;
  const abs = path.join(REPO, rel);
  if (!abs.startsWith(REPO)) return null;
  if (fs.existsSync(abs) && fs.statSync(abs).isFile()) return abs;
  // html_handling: auto-trailing-slash → /foo → foo/index.html, foo.html
  for (const cand of [path.join(abs, "index.html"), abs + ".html"]) {
    if (fs.existsSync(cand) && fs.statSync(cand).isFile()) return cand;
  }
  return null;
}

const ASSETS = {
  async fetch(req) {
    const { pathname } = new URL(req.url);
    const file = resolveAsset(pathname);
    if (!file) return new Response("Not Found", { status: 404 });
    return new Response(fs.readFileSync(file), {
      status: 200,
      headers: { "content-type": MIME[path.extname(file)] || "application/octet-stream" },
    });
  },
};

const worker = (await import(path.join(REPO, "src/worker.js"))).default;
const env = { ASSETS, JUMVI_ANALYTICS: { writeDataPoint() {} } };

http.createServer(async (req, res) => {
  const url = `http://localhost:${PORT}${req.url}`;
  const body = ["GET", "HEAD"].includes(req.method) ? undefined
    : await new Promise((r) => { const c = []; req.on("data", (d) => c.push(d)); req.on("end", () => r(Buffer.concat(c))); });
  const request = new Request(url, { method: req.method, headers: req.headers, body });

  // Cloudflare serves a matching static asset WITHOUT invoking the Worker.
  // /tr matches no asset (there is no tr/index.html), so the Worker runs.
  const { pathname } = new URL(url);
  let out;
  if (pathname !== "/api/beacon" && resolveAsset(pathname) && pathname !== "/" && pathname !== "/index.html") {
    out = await ASSETS.fetch(request);
  } else {
    out = await worker.fetch(request, env);
  }

  res.writeHead(out.status, Object.fromEntries(out.headers));
  res.end(Buffer.from(await out.arrayBuffer()));
}).listen(PORT, () => console.log(`ready on ${PORT} serving ${REPO}`));

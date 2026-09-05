/* Runs the REAL src/worker.js over a local HTTP server, with env.ASSETS
 * shimmed to read the repo from disk exactly as Cloudflare's asset binding
 * would (including the "asset match wins before the Worker runs" rule).
 * Nothing about the /tr logic is reimplemented here — that is the point.
 *
 * Fidelity matters here more than it looks: every browser-driven check in
 * tools/ runs against THIS server, so anything it models wrongly becomes a
 * check that quietly tests the wrong app. Three things were modelled wrongly
 * and each produced a false result:
 *
 *   .assetsignore   was hand-copied into a literal list that had drifted, so
 *                   CLAUDE.md, generate_mission_book.py and wrangler.jsonc
 *                   were served locally that production 404s — while /data/
 *                   was ignored locally though production ships it.
 *   run_worker_first was not modelled at all, so /assets/analiz/ answered 200
 *                   with no password locally while production answers 401.
 *                   The gate looked broken-open in exactly the tool you would
 *                   use to check it.
 *   audio + Range   .mp3/.opus were absent from the MIME table (served as
 *                   application/octet-stream) and ranged requests were
 *                   unsupported, so Chromium rejected every Coach Leo clip and
 *                   check-mission-play-state reported a network failure that
 *                   does not exist in production.
 *
 * All three now come from the same files Cloudflare reads — .assetsignore and
 * wrangler.jsonc — rather than from a copy kept in step by hand. */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const REPO = process.argv[2] || process.cwd();
const PORT = Number(process.argv[3] || 8787);

const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".webmanifest": "application/manifest+json",
  ".map": "application/json; charset=utf-8", ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8", ".csv": "text/csv; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".png": "image/png", ".webp": "image/webp", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".gif": "image/gif", ".avif": "image/avif", ".ico": "image/x-icon", ".svg": "image/svg+xml",
  // Coach Leo's narration and the music beds. Without these the browser gets
  // application/octet-stream and refuses to decode a perfectly good clip.
  ".mp3": "audio/mpeg", ".opus": "audio/ogg", ".ogg": "audio/ogg", ".oga": "audio/ogg",
  ".m4a": "audio/mp4", ".aac": "audio/aac", ".wav": "audio/wav",
  ".mp4": "video/mp4", ".webm": "video/webm",
  ".woff2": "font/woff2", ".woff": "font/woff", ".ttf": "font/ttf", ".otf": "font/otf",
  ".glb": "model/gltf-binary", ".pdf": "application/pdf", ".wasm": "application/wasm",
};

/* ── .assetsignore, read rather than remembered ───────────────────────────── */
const readAssetsIgnore = () => {
  const file = path.join(REPO, ".assetsignore");
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
};
const IGNORED = readAssetsIgnore();

/* ── run_worker_first, read from wrangler.jsonc ───────────────────────────── */
/** Strips // and /* *​/ comments without touching the same characters inside
 *  a JSON string (wrangler.jsonc's comments are full of URLs). */
function stripJsonComments(text) {
  let out = "";
  let inString = false, inLine = false, inBlock = false, escaped = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i], next = text[i + 1];
    if (inLine) { if (c === "\n") { inLine = false; out += c; } continue; }
    if (inBlock) { if (c === "*" && next === "/") { inBlock = false; i++; } continue; }
    if (inString) {
      out += c;
      if (escaped) escaped = false;
      else if (c === "\\") escaped = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') { inString = true; out += c; continue; }
    if (c === "/" && next === "/") { inLine = true; i++; continue; }
    if (c === "/" && next === "*") { inBlock = true; i++; continue; }
    out += c;
  }
  return out;
}

const readWorkerFirst = () => {
  const file = path.join(REPO, "wrangler.jsonc");
  if (!fs.existsSync(file)) return [];
  try {
    const config = JSON.parse(stripJsonComments(fs.readFileSync(file, "utf8")));
    const rules = config?.assets?.run_worker_first;
    return Array.isArray(rules) ? rules : [];
  } catch (err) {
    console.error(`could not read run_worker_first from wrangler.jsonc: ${err.message}`);
    return [];
  }
};
const WORKER_FIRST = readWorkerFirst();

/** Cloudflare's run_worker_first patterns: a literal path, or a /prefix/* glob. */
const runsWorkerFirst = (pathname) =>
  WORKER_FIRST.some((rule) =>
    rule.endsWith("/*") ? pathname.startsWith(rule.slice(0, -1)) : pathname === rule);

function resolveAsset(pathname) {
  let rel = decodeURIComponent(pathname).replace(/^\/+/, "");
  if (rel === "") rel = "index.html";
  if (IGNORED.some((p) => (p.endsWith("/") ? rel === p.slice(0, -1) || rel.startsWith(p) : rel === p))) return null;
  const abs = path.join(REPO, rel);
  if (!abs.startsWith(REPO)) return null;
  if (fs.existsSync(abs) && fs.statSync(abs).isFile()) return abs;
  // html_handling: auto-trailing-slash → /foo → foo/index.html, foo.html
  for (const cand of [path.join(abs, "index.html"), abs + ".html"]) {
    if (fs.existsSync(cand) && fs.statSync(cand).isFile()) return cand;
  }
  return null;
}

/** "bytes=0-" / "bytes=100-199" / "bytes=-500" against a known size. */
function parseRange(header, size) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(String(header || "").trim());
  if (!match) return null;
  const [, rawStart, rawEnd] = match;
  let start, end;
  if (rawStart === "") {
    if (rawEnd === "") return null;
    start = Math.max(0, size - Number(rawEnd));
    end = size - 1;
  } else {
    start = Number(rawStart);
    end = rawEnd === "" ? size - 1 : Math.min(Number(rawEnd), size - 1);
  }
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= size) return null;
  return { start, end };
}

const ASSETS = {
  async fetch(req) {
    const { pathname } = new URL(req.url);
    const file = resolveAsset(pathname);
    if (!file) return new Response("Not Found", { status: 404 });

    const bytes = fs.readFileSync(file);
    const headers = {
      "content-type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream",
      // Media elements will not stream a resource that cannot be ranged.
      "accept-ranges": "bytes",
    };

    const range = parseRange(req.headers.get("range"), bytes.length);
    if (range) {
      const slice = bytes.subarray(range.start, range.end + 1);
      return new Response(slice, {
        status: 206,
        headers: {
          ...headers,
          "content-range": `bytes ${range.start}-${range.end}/${bytes.length}`,
          "content-length": String(slice.length),
        },
      });
    }
    return new Response(bytes, {
      status: 200,
      headers: { ...headers, "content-length": String(bytes.length) },
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

  // Cloudflare serves a matching static asset WITHOUT invoking the Worker —
  // except under run_worker_first, which is the only thing standing between an
  // unauthenticated request and /data/ or the Ar-Ge panel's own HTML.
  // /tr matches no asset (there is no tr/index.html), so the Worker runs.
  const { pathname } = new URL(url);
  const servedByAssets = pathname !== "/api/beacon" && !runsWorkerFirst(pathname) &&
    pathname !== "/" && pathname !== "/index.html" && resolveAsset(pathname);

  const out = servedByAssets ? await ASSETS.fetch(request) : await worker.fetch(request, env);

  res.writeHead(out.status, Object.fromEntries(out.headers));
  res.end(req.method === "HEAD" ? undefined : Buffer.from(await out.arrayBuffer()));
}).listen(PORT, () => {
  console.log(`ready on ${PORT} serving ${REPO}`);
  console.log(`  .assetsignore: ${IGNORED.length} rule(s) · run_worker_first: ${WORKER_FIRST.join(", ") || "none"}`);
});

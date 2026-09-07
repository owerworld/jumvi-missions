#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
 * check-versioned-assets.mjs
 *
 * THE RULE: change a file that is referenced with ?v=  →  bump that ?v=. Always.
 *
 * This is the sibling of tools/check-core-assets.sh, one layer up. That script
 * guards the files the service worker precaches UNVERSIONED (bump CACHE_NAME).
 * This one guards the files the page requests WITH a ?v= stamp, which _headers
 * marks `max-age=31536000, immutable`:
 *
 *     /*.js   Cache-Control: public, max-age=31536000, immutable
 *     /*.css  Cache-Control: public, max-age=31536000, immutable
 *
 * "immutable" means a browser that has fetched app.js?v=20260831-1 will not
 * ask about it again for a year. So shipping new bytes under the SAME stamp
 * strands every returning visitor on the old file — silently, and for far
 * longer than any deploy takes to notice.
 *
 * A CACHE_NAME bump does NOT rescue this. The precache key is the bare
 * "/app.js"; the page asks for "app.js?v=…". caches.match() does not ignore
 * the query string, so the precached copy never matches, the request falls
 * through to fetch(), and fetch() is answered by the browser's own immutable
 * HTTP cache. This is exactly how app.js changed on 2026-09-02 (the iOS
 * dead-end fix) while index.html still asked for ?v=20260831-1, and how
 * jumvi-icons.css shipped its WCAG contrast fixes on 2026-08-24 under a
 * 2026-08-21 stamp.
 *
 * How it works: every literal "<path>?v=<stamp>" reference in the shipped
 * HTML/JS/CSS is hashed and compared against tools/versioned-assets.lock. A
 * changed file under an unchanged stamp fails. Deterministic and offline —
 * it reads only files already in the repo.
 *
 *     node tools/check-versioned-assets.mjs             → verify
 *     node tools/check-versioned-assets.mjs --update    → re-lock after bumping
 *
 * NOT covered, deliberately: the Coach Leo 2D sprites, whose stamp comes from
 * the shared LEO_ASSET_V constant in app.js rather than from literal per-file
 * references. They live under /assets/*, which _headers gives
 * `max-age=86400, stale-while-revalidate` — one day, not one year — so a stale
 * stamp there corrects itself and does not need this guard.
 *
 * Exit 1 on any mismatch.
 * ══════════════════════════════════════════════════════════════════════════*/
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const LOCK = path.join(REPO, "tools", "versioned-assets.lock");
const UPDATE = process.argv.includes("--update");

/* Where a ?v= reference can be written. Everything the site actually ships as
 * text; the directories below are either not uploaded (.assetsignore) or are
 * third-party bytes we never edit. */
const SKIP_DIRS = new Set([
  ".git", ".claude", ".wrangler", "node_modules",
  "vendor", "prototypes", "tools", "docs", "assets", "icons", "artifacts", "data",
]);
const SCAN_EXT = new Set([".html", ".js", ".mjs", ".css"]);

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      yield* walk(path.join(dir, entry.name));
    } else if (SCAN_EXT.has(path.extname(entry.name))) {
      yield path.join(dir, entry.name);
    }
  }
}

/* "app.js?v=20260831-1", "./jumvi-hub-app.js?v=…", "/tr/i18n.js?v=…" */
const REFERENCE = /([A-Za-z0-9_./-]+)\?v=([0-9]{8}-[0-9]+)/g;

/** Repo-relative path for a reference, or null when it escapes the repo. */
function resolveReference(sourceFile, ref) {
  const cleaned = ref.replace(/^\.\//, "");
  const abs = cleaned.startsWith("/")
    ? path.join(REPO, cleaned)
    : path.resolve(path.dirname(sourceFile), cleaned);
  if (!abs.startsWith(REPO + path.sep)) return null;
  return path.relative(REPO, abs).split(path.sep).join("/");
}

const references = new Map(); // "path?v=stamp" -> Set of source files
for (const file of walk(REPO)) {
  const text = fs.readFileSync(file, "utf8");
  for (const [, ref, stamp] of text.matchAll(REFERENCE)) {
    const rel = resolveReference(file, ref);
    if (rel === null) continue;
    const key = `${rel}?v=${stamp}`;
    if (!references.has(key)) references.set(key, new Set());
    references.get(key).add(path.relative(REPO, file));
  }
}

const sha256 = (file) =>
  crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");

const missing = [];
const current = new Map(); // "path?v=stamp" -> sha256
for (const key of [...references.keys()].sort()) {
  const file = path.join(REPO, key.split("?v=")[0]);
  if (!fs.existsSync(file)) { missing.push(key); continue; }
  current.set(key, sha256(file));
}

if (UPDATE) {
  const body = [...current.entries()].map(([key, hash]) => `${hash}  ${key}`).join("\n");
  fs.writeFileSync(LOCK, body + "\n");
  console.log(`Re-locked ${current.size} versioned reference(s) → tools/versioned-assets.lock`);
  if (missing.length) {
    console.error(`\nStill broken — these references point at nothing:`);
    for (const key of missing) console.error(`  ${key}`);
    process.exit(1);
  }
  process.exit(0);
}

if (!fs.existsSync(LOCK)) {
  console.error("tools/versioned-assets.lock is missing. Create it with:\n  node tools/check-versioned-assets.mjs --update");
  process.exit(1);
}

const locked = new Map(
  fs.readFileSync(LOCK, "utf8")
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => {
      const [hash, ...rest] = line.trim().split(/\s+/);
      return [rest.join(" "), hash];
    })
);

const stale = [];   // same stamp, different bytes — the bug this guard exists for
const added = [];   // a new stamp the lock has not seen
for (const [key, hash] of current) {
  if (!locked.has(key)) added.push(key);
  else if (locked.get(key) !== hash) stale.push(key);
}
const removed = [...locked.keys()].filter((key) => !current.has(key));

console.log(`Versioned references: ${current.size} across ${new Set([...references.values()].flatMap((s) => [...s])).size} source file(s)`);

if (missing.length) {
  console.error("\n❌ Reference points at a file that does not exist:");
  for (const key of missing) {
    console.error(`  ${key}  (referenced by ${[...references.get(key)].join(", ")})`);
  }
}

if (stale.length) {
  console.error("\n❌ File changed but its ?v= did NOT — returning visitors keep the old bytes for a year:");
  for (const key of stale) {
    const [file, stamp] = key.split("?v=");
    console.error(`  ${file}  still stamped ?v=${stamp}  (referenced by ${[...references.get(key)].join(", ")})`);
  }
  console.error("\n  Fix: bump the ?v= stamp where it is referenced, then re-lock:");
  console.error("    node tools/check-versioned-assets.mjs --update");
}

if (added.length || removed.length) {
  console.error("\n❌ The lock is out of date:");
  for (const key of added) console.error(`  + ${key}  (new stamp, not in the lock)`);
  for (const key of removed) console.error(`  - ${key}  (in the lock, no longer referenced)`);
  console.error("\n  Fix: node tools/check-versioned-assets.mjs --update");
}

if (missing.length || stale.length || added.length || removed.length) process.exit(1);
console.log("✅ every ?v= stamp matches the bytes it is supposed to be pinning.");

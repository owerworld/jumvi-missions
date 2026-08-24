#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
 * Analytics compliance guard — Locked v1 R&D dashboard follow-up.
 *
 * This is a STATIC guard: it scans the executable analytics code paths
 * (src/worker.js, app.js's beacon plumbing, jumvi-hub-app.js's track()
 * bridge, tools/generate-weekly-snapshot.mjs, assets/analiz/index.html) for
 * patterns that would mean the privacy/Amazon-safety invariants had been
 * broken — an identity column, a review-solicitation flow, a third-party
 * ad/behavioral tracker.
 *
 * It is deliberately dumb about WHERE it looks: comments in this very file,
 * in src/worker.js's own privacy-invariant header, and in docs/ all mention
 * these forbidden words on purpose, to explain why they're forbidden. So
 * this only scans FILES that are actual executable analytics code, and only
 * checks that the forbidden identifiers never appear as real property names
 * (`.something`, `payload.something`, `env.something`) or literal event
 * names — not as prose inside a comment or string. False positives are
 * cheap to fix by hand; a silent identity leak is not.
 *
 * Run: node tools/check-analytics-compliance.mjs
 * ═══════════════════════════════════════════════════════════════════════════ */
import { readFileSync } from "node:fs";

let failures = 0;
function check(label, condition, detail = "") {
  if (condition) { console.log(`  ok    ${label}`); return; }
  failures++;
  console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
}

/** Strip //, /* *\/ and HTML comments so a comment merely explaining why a
 *  word is forbidden can't trip a scan for that word. Crude but sufficient —
 *  this repo doesn't have URLs or regexes containing "//" inside analytics
 *  code paths that would confuse the JS comment strip. */
function stripComments(source, ext) {
  let s = source;
  if (ext === "html") {
    s = s.replace(/<!--[\s\S]*?-->/g, "");
  }
  s = s.replace(/\/\*[\s\S]*?\*\//g, "");
  s = s.replace(/^[ \t]*\/\/.*$/gm, "");
  return s;
}

const ANALYTICS_FILES = [
  { path: "src/worker.js", ext: "js" },
  { path: "app.js", ext: "js" },
  { path: "jumvi-hub-app.js", ext: "js" },
  { path: "tools/generate-weekly-snapshot.mjs", ext: "js" },
  { path: "assets/analiz/index.html", ext: "html" },
];

const files = ANALYTICS_FILES.map((f) => ({
  ...f,
  raw: readFileSync(f.path, "utf8"),
}));
const scanned = files.map((f) => ({ ...f, code: stripComments(f.raw, f.ext) }));

console.log("Analytics compliance guard\n");

console.log("No identity-shaped columns or props:");
/* Matched as a real identifier reference — a property access, a payload key,
 * or a literal blob/index value — not as a comment explaining the ban. `\b`
 * on both sides so "device_id" doesn't also flag "some_device_id_thing". */
const FORBIDDEN_IDENTIFIERS = [
  "order_id", "orderid", "buyer_id", "buyerid", "customer_id", "customerid",
  "device_id", "deviceid", "advertising_id", "advertisingid", "idfa", "gaid",
  "review_rating", "review_prompt", "review_request", "five_star",
  "happy_customer",
];
for (const id of FORBIDDEN_IDENTIFIERS) {
  const re = new RegExp(`\\b${id}\\b`, "i");
  for (const f of scanned) {
    check(`${f.path}: no "${id}"`, !re.test(f.code));
  }
}

console.log("\nNo raw UUID literals (a minted identifier would look like this):");
// A real 8-4-4-4-12 hex UUID pattern. Mission ids, badge ids, pack keys and
// snapshot week ids never look like this, so any match is worth a look.
const UUID_RE = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i;
for (const f of scanned) {
  check(`${f.path}: no UUID literal`, !UUID_RE.test(f.code));
}

console.log("\nNo review-solicitation flow anywhere in the app:");
const REVIEW_PATTERNS = [
  /review_prompt_shown/i, /\breviewGate\b/i, /\bfiveStarSplit\b/i,
  /leave\s+a\s+review/i, /rate\s+us\s+on\s+amazon/i,
];
for (const f of files) { // full raw text — a review flow would not hide in a comment either
  for (const re of REVIEW_PATTERNS) {
    check(`${f.path}: no ${re}`, !re.test(f.raw));
  }
}

console.log("\nNo third-party ad/behavioral trackers loaded anywhere in the shipped app:");
const TRACKER_PATTERNS = [
  /connect\.facebook\.net/i, /fbq\s*\(/i, /googletagmanager\.com/i,
  /google-analytics\.com/i, /gtag\s*\(/i, /analytics\.tiktok\.com/i,
  /ttq\.(load|track)/i, /static\.hotjar\.com/i, /plausible\.io\/js/i,
];
const shippedFiles = [
  { path: "index.html", raw: readFileSync("index.html", "utf8") },
  { path: "app.js", raw: readFileSync("app.js", "utf8") },
  { path: "jumvi-hub-app.js", raw: readFileSync("jumvi-hub-app.js", "utf8") },
];
for (const f of shippedFiles) {
  for (const re of TRACKER_PATTERNS) {
    check(`${f.path}: no ${re}`, !re.test(f.raw));
  }
}

console.log("\nWorker never reads request/network identity signals:");
// The privacy-invariant header in src/worker.js already asserts this in
// prose; this re-checks it against actual code, not the promise, and
// specifically against the code AFTER comments are stripped so the header's
// own explanation of the rule can't satisfy the rule about itself.
const workerCode = scanned.find((f) => f.path === "src/worker.js").code;
const IDENTITY_SIGNALS = [
  /request\.cf\b/, /CF-Connecting-IP/i, /\.headers\.get\(\s*["']user-agent["']/i,
  /\.headers\.get\(\s*["']referer["']/i, /\.headers\.get\(\s*["']cookie["']/i,
];
for (const re of IDENTITY_SIGNALS) {
  check(`src/worker.js: no ${re}`, !re.test(workerCode));
}
// The one legitimate header read in this file is Authorization, for the
// /analiz password gate — confirm it's still the only header this file
// touches, so a future addition doesn't slip past the checks above.
const headerReads = [...workerCode.matchAll(/\.headers\.get\(\s*["']([^"']+)["']/gi)].map((m) => m[1].toLowerCase());
check("src/worker.js only ever reads the Authorization header",
  headerReads.every((h) => h === "authorization"),
  JSON.stringify([...new Set(headerReads)]));

console.log("\nNo persistent analytics identifier is ever minted client-side:");
// A generated/stored id used for ANALYTICS. This deliberately does not flag
// jumvi_seen/jumvi_visits (booleans/counters, not identifiers) or profile
// avatars/ids that stay local and are never sent to the beacon — only a
// pattern that looks like minting a random token specifically for tracking.
const MINTED_ID_PATTERNS = [
  /crypto\.randomUUID\s*\(\s*\)/, /Math\.random\(\).*toString\(36\).*(?:analytics|track|beacon)/i,
];
const appCode = scanned.find((f) => f.path === "app.js").code;
for (const re of MINTED_ID_PATTERNS) {
  check(`app.js: no ${re}`, !re.test(appCode));
}

if (failures) {
  console.log(`\n❌ ${failures} compliance failure(s).`);
  process.exit(1);
}
console.log("\n✅ No PII, no review solicitation, no third-party trackers, no identity reads.");

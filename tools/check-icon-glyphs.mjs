#!/usr/bin/env node
/* ────────────────────────────────────────────────────────────────────────────
 * Icon glyph coverage guard.
 *
 * WHY THIS EXISTS
 * Both icon sets in this repo are CSS masks painted with currentColor:
 *     i.jic  { background-color:currentColor; mask-image:var(--jic); }
 *     .ico   { background-color:currentColor; mask-image:var(--m);   }
 * If the modifier class (jic-loop, i-play, …) has no rule defining that custom
 * property, `var()` is invalid at computed-value time, mask-image computes to
 * `none`, and the element paints its FULL 1em box — a solid square in the
 * button's text colour. It never throws, never 404s, and never shows up in the
 * console; it just looks like a broken font glyph on a real phone.
 *
 * "Play Again" on the Picked-for-You card shipped exactly that way (jic-loop
 * was used in app.js but never defined in jumvi-icons.css). This check makes
 * the next one a failed run instead of a customer screenshot.
 *
 *   node tools/check-icon-glyphs.mjs
 * ──────────────────────────────────────────────────────────────────────────── */
import fs from "node:fs";

const SOURCES = ["index.html", "app.js", "jumvi-hub-app.js", "leo-tour.js", "play-modes.js", "jumvi-redlight.js"];

const iconsCss = fs.readFileSync("jumvi-icons.css", "utf8");
const styleCss = fs.readFileSync("style.css", "utf8");

// Definitions: `i.jic-foo{ --jic:… }` and `.i-foo{ --m:… }`
const definedJic = new Set([...iconsCss.matchAll(/i\.(jic-[a-z0-9-]+)\s*\{[^}]*--jic\s*:/g)].map((m) => m[1]));
const definedIco = new Set([...styleCss.matchAll(/\.(i-[a-z0-9-]+)\s*\{[^}]*--m\s*:/g)].map((m) => m[1]));

// Usage: only inside a class attribute that also carries the base class, so an
// unrelated identifier containing "i-" is never mistaken for an icon.
const usedJic = new Map();
const usedIco = new Map();
for (const file of SOURCES) {
  if (!fs.existsSync(file)) continue;
  const src = fs.readFileSync(file, "utf8");
  for (const m of src.matchAll(/class=["'`]([^"'`]*\bjic\b[^"'`]*)["'`]/g)) {
    for (const cls of m[1].split(/\s+/)) if (/^jic-/.test(cls)) (usedJic.get(cls) || usedJic.set(cls, new Set()).get(cls)).add(file);
  }
  for (const m of src.matchAll(/class=["'`]([^"'`]*\bico\b[^"'`]*)["'`]/g)) {
    for (const cls of m[1].split(/\s+/)) if (/^i-/.test(cls)) (usedIco.get(cls) || usedIco.set(cls, new Set()).get(cls)).add(file);
  }
}

let failures = 0;
function report(label, used, defined) {
  console.log(`\n${label} — ${used.size} class(es) used, ${defined.size} defined`);
  let missing = 0;
  for (const [cls, files] of [...used].sort()) {
    if (defined.has(cls)) continue;
    missing++;
    console.log(`  FAIL ${cls} has no glyph definition (used in ${[...files].join(", ")}) — renders as a solid square`);
  }
  if (!missing) console.log("  ok   every used class resolves to a mask");
  failures += missing;
}

console.log("Icon glyph coverage");
report(".jic (jumvi-icons.css)", usedJic, definedJic);
report(".ico (style.css)", usedIco, definedIco);

if (failures) {
  console.log(`\n❌ ${failures} icon class(es) would render as solid squares.`);
  process.exit(1);
}
console.log("\n✅ Every icon class used in markup has a mask definition.");

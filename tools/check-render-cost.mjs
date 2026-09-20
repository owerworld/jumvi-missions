#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
 * check-render-cost.mjs — paint work the phone does and nobody can see.
 *
 * This is the guard for a class of bug that is invisible by construction, so
 * no screenshot test and no reviewer will ever catch it: an effect that still
 * costs the GPU a pass, over a surface that hides its result.
 *
 * Both of the rules below are here because the app had shipped the bug:
 *
 *   opaque backdrop-filter   style.css gave the glass surfaces
 *                            `backdrop-filter: blur(18–24px)` while they were
 *                            translucent. warm-toy.css later repainted them
 *                            with SOLID backgrounds and left the blur behind.
 *                            Safari kept sampling and blurring the region
 *                            behind #sheet — the whole viewport, on every
 *                            mission tap — and then painted an opaque card
 *                            over every pixel of the result.
 *
 *   sub-1% overlay           a full-size ::before on .hero, .card, .badge,
 *                            .sheet and six more, painting a
 *                            repeating-radial-gradient with a 3px period at
 *                            rgba(255,255,255,0.04) and opacity .22. Effective
 *                            alpha 0.0088 — at most 2/255 on this skin — for
 *                            an extra generated box per card and a gradient
 *                            Safari re-rasterises at 3× device scale.
 *
 * Why a browser and not a stylesheet grep: both bugs live in the CASCADE, not
 * in any one rule. The blur and the background that hides it were declared in
 * different files, and reading either alone shows nothing wrong. Only the
 * computed style knows.
 *
 * Both themes are checked, because a surface can be opaque in one and
 * translucent in the other — #certSheet and #toast are exactly that, and they
 * are why the rule is "opaque in BOTH themes" rather than "opaque here".
 *
 *   node tools/check-render-cost.mjs
 *   node tools/check-render-cost.mjs --base=URL
 *
 * Exit 1 on any effect that cannot reach the screen.
 * ══════════════════════════════════════════════════════════════════════════*/
import { createRequire } from "node:module";

const require_ = createRequire(import.meta.url);
const loadWebkit = () => {
  const spec = process.env.JUMVI_PW_WEBKIT || process.env.JUMVI_PW || "playwright";
  try { return require_(spec).webkit; }
  catch { console.error(`Playwright not found (tried "${spec}"). Set JUMVI_PW.`); process.exit(2); }
};
const args = process.argv.slice(2);
const argVal = (n, d) => { const h = args.find((a) => a.startsWith(`--${n}=`)); return h ? h.slice(n.length + 3) : d; };
const BASE = argVal("base", "http://localhost:8910/index.html");

/* An overlay under this much effective alpha is not a design decision anyone
 * can act on — it is under one part in 128 of the surface it sits on. */
const ALPHA_FLOOR = 0.015;

/* Surfaces whose own background genuinely lets the blur through. Each entry
 * records the alpha that earns it, so a surface that later turns opaque stops
 * matching and gets reported rather than silently keeping a dead blur. */
const TRANSLUCENT_BY_DESIGN = {
  backdrop: "rgba(2,6,23,.45) — the modal scrim, 55% of the blur is visible",
  badgeUnlockModal: "rgba(10,22,40,.7) — 30%",
  timerCountdown: "rgba(10,22,40,.85) — 15%",
  certSheet: "rgba(15,23,42,.9) in dark — 10%",
  toast: "rgba(15,23,42,.92) in dark — 8%",
  seasonalCard: "transparent in light",
};

const PROBE = `() => {
  const alphaOf = (c) => {
    const m = /rgba?\\(([^)]+)\\)/.exec(c || "");
    if (!m) return c === "transparent" ? 0 : 1;
    const p = m[1].split(",").map(parseFloat);
    return p.length > 3 ? p[3] : 1;
  };
  /* The smallest alpha any colour stop in a background-image carries. A
   * gradient that is transparent anywhere lets the backdrop through there. */
  const minStopAlpha = (image) => {
    if (!image || image === "none") return 1;
    let lowest = 1;
    for (const m of image.matchAll(/rgba?\\(([^)]+)\\)/g)) {
      const p = m[1].split(",").map(parseFloat);
      lowest = Math.min(lowest, p.length > 3 ? p[3] : 1);
    }
    return lowest;
  };
  const name = (el) =>
    el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") +
    (typeof el.className === "string" && el.className.trim()
      ? "." + el.className.trim().split(/\\s+/).slice(0, 2).join(".") : "");

  const blurs = [];
  const overlays = [];
  for (const el of document.querySelectorAll("*")) {
    const s = getComputedStyle(el);

    const bf = s.backdropFilter || s.webkitBackdropFilter;
    if (bf && bf !== "none") {
      const r = el.getBoundingClientRect();
      blurs.push({
        id: el.id || "", name: name(el), filter: bf,
        alpha: Math.min(alphaOf(s.backgroundColor), minStopAlpha(s.backgroundImage)),
        area: Math.round(r.width * r.height),
      });
    }

    /* A decorative overlay: a generated box that covers its originator and
     * paints something. Its visible strength is its own alpha times every
     * opacity between it and the page. */
    for (const pseudo of ["::before", "::after"]) {
      const ps = getComputedStyle(el, pseudo);
      if (ps.content === "none" || ps.display === "none") continue;
      if (ps.position !== "absolute" && ps.position !== "fixed") continue;
      const paints = (ps.backgroundImage && ps.backgroundImage !== "none") ||
                     alphaOf(ps.backgroundColor) > 0;
      if (!paints) continue;
      /* "Covers its originator" has to be read from the insets, not from
       * width: inset:0 leaves the computed width as "auto", which an earlier
       * version of this check mistook for "not full size" and let the very
       * overlay it exists for slip through. */
      const stretched = ["top", "right", "bottom", "left"].every((s) => ps[s] === "0px");
      const wide = parseFloat(ps.width) >= el.getBoundingClientRect().width * 0.8;
      if (!stretched && !wide) continue;

      let opacity = parseFloat(ps.opacity);
      for (let a = el; a && a !== document.documentElement; a = a.parentElement) {
        opacity *= parseFloat(getComputedStyle(a).opacity);
      }
      /* The strongest colour the overlay paints anywhere. A gradient whose
       * boldest stop is still faint is faint everywhere. */
      const strongestStop = (image) => Math.max(0,
        ...[...String(image).matchAll(/rgba?\\(([^)]+)\\)/g)]
          .map((m) => { const p = m[1].split(",").map(parseFloat); return p.length > 3 ? p[3] : 1; }));
      const paintAlpha = ps.backgroundImage !== "none"
        ? strongestStop(ps.backgroundImage)
        : alphaOf(ps.backgroundColor);

      overlays.push({
        name: name(el) + pseudo,
        effective: +(paintAlpha * opacity).toFixed(4),
        background: String(ps.backgroundImage !== "none" ? ps.backgroundImage : ps.backgroundColor).slice(0, 60),
      });
    }
  }
  return { blurs, overlays };
}`;

const webkit = loadWebkit();
const browser = await webkit.launch();

const readTheme = async (theme) => {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
    hasTouch: true, serviceWorkers: "block", colorScheme: theme,
  });
  const page = await ctx.newPage();
  await page.addInitScript((t) => {
    localStorage.setItem("jumvi_onboarded_v2", "1");
    localStorage.setItem("jumvi_theme_v1", t);
  }, theme);
  await page.goto(BASE, { waitUntil: "load" });
  await page.waitForTimeout(2000);
  for (let i = 0; i < 4; i++) {
    if (!(await page.evaluate(() => document.body.classList.contains("modalOpen")))) break;
    await page.keyboard.press("Escape"); await page.waitForTimeout(250);
  }
  const out = await page.evaluate(`(${PROBE})()`);
  await ctx.close();
  return out;
};

const light = await readTheme("light");
const dark = await readTheme("dark");
await browser.close();

let failures = 0;
const check = (label, ok, detail = "") => {
  if (ok) { console.log(`  ok   ${label}`); return; }
  failures++;
  console.log(`  FAIL ${label}${detail ? `\n       ${detail}` : ""}`);
};

/* ── 1. A blur nobody can see ──────────────────────────────────────────────
 * Keyed by id, because that is what survives across the two page loads. An
 * element with no id cannot be matched between themes, so it is judged on the
 * theme it appears in — which is the safe direction: it can only be reported
 * when it is opaque there. */
console.log("Backdrop blurs vs the background painted over them");
const byId = new Map();
for (const [theme, set] of [["light", light], ["dark", dark]]) {
  for (const b of set.blurs) {
    const key = b.id || `${b.name}@${theme}`;
    const prev = byId.get(key) || { name: b.name, filter: b.filter, area: b.area, alphas: {} };
    prev.alphas[theme] = b.alpha;
    prev.area = Math.max(prev.area, b.area);
    byId.set(key, prev);
  }
}
const deadBlurs = [];
for (const [key, e] of byId) {
  const seen = Object.values(e.alphas);
  if (!seen.every((a) => a >= 0.995)) continue;
  if (TRANSLUCENT_BY_DESIGN[key]) continue;
  deadBlurs.push(`${e.name} — ${e.filter} behind an opaque background` +
    (e.area ? ` over ${e.area}px²` : ""));
}
check(`${byId.size} backdrop-filter surface(s), none of them opaque`,
  deadBlurs.length === 0, deadBlurs.join("\n       "));

/* An entry that no longer describes a translucent surface would silence a
 * real finding, so it has to fail on its own. */
const staleExceptions = Object.keys(TRANSLUCENT_BY_DESIGN).filter((id) => {
  const e = byId.get(id);
  return e && Object.values(e.alphas).every((a) => a >= 0.995);
});
check("no exception outlives the translucency that earned it",
  staleExceptions.length === 0,
  staleExceptions.map((id) => `#${id} is opaque in every theme now — drop it from TRANSLUCENT_BY_DESIGN and the blur with it`).join("\n       "));

/* ── 2. An overlay nobody can see ──────────────────────────────────────────*/
console.log("\nFull-size decorative overlays vs what they contribute");
const faint = [...light.overlays, ...dark.overlays]
  .filter((o) => o.effective > 0 && o.effective < ALPHA_FLOOR);
const uniqueFaint = [...new Map(faint.map((o) => [o.name, o])).values()];
check(`${new Set([...light.overlays, ...dark.overlays].map((o) => o.name)).size} overlay(s), none under ${ALPHA_FLOOR * 100}% effective alpha`,
  uniqueFaint.length === 0,
  uniqueFaint.map((o) => `${o.name} — ${(o.effective * 100).toFixed(2)}% effective (${Math.round(o.effective * 255)}/255 at most): ${o.background}`).join("\n       "));

if (failures) {
  console.log(`\n❌ ${failures} render-cost check(s) failed — the phone is painting this and the screen is not showing it.`);
  process.exit(1);
}
console.log("\n✅ every blur and overlay that costs a paint pass can actually be seen.");

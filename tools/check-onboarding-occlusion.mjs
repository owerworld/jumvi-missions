#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
 * check-onboarding-occlusion.mjs — nothing on the first screen hides behind
 * the Start button.
 *
 * The bug this exists to prevent: the first-run CTA was position:sticky, so
 * when the panel was taller than the phone it pinned to the bottom of the
 * viewport and painted over whatever content was there — the "36 games
 * included" line on an iPhone 12-class screen, the level labels on a small
 * phone and in landscape. A parent scanning the screen for how many games
 * they get simply could not see the answer.
 *
 * WHY THIS DOES NOT JUST COMPARE RECTANGLES. getBoundingClientRect() reports
 * an element's full box even when a scroll container clips most of it, so a
 * naive rect-vs-rect test flags content that is scrolled out of sight and
 * never painted. This asks the renderer instead: for each text element that
 * geometrically meets the CTA, sample points inside the shared region and use
 * elementFromPoint. If the CTA (or one of its children) answers, the text is
 * genuinely covered. If the scroller answers, the text is clipped, not hidden.
 *
 * Also asserts, per viewport:
 *   · CTA is at least 48 CSS px tall (WCAG 2.2 target size floor).
 *   · CTA is fully inside the viewport — never partly off-screen.
 *   · A real, measurable gap between the last helper line and the CTA.
 *   · Every focusable control in the overlay can be scrolled into view.
 *
 *   node tools/check-onboarding-occlusion.mjs
 *   node tools/check-onboarding-occlusion.mjs --shots=DIR   → also write PNGs
 *   node tools/check-onboarding-occlusion.mjs --base=URL
 *
 * Exit 1 on any occlusion or geometry failure.
 * ══════════════════════════════════════════════════════════════════════════*/
import { createRequire } from "node:module";
import fs from "node:fs";

const require_ = createRequire(import.meta.url);
const loadChromium = () => {
  const spec = process.env.JUMVI_PW || "playwright";
  try { return require_(spec).chromium; }
  catch { console.error(`Playwright not found (tried "${spec}"). Set JUMVI_PW.`); process.exit(2); }
};

const args = process.argv.slice(2);
const argVal = (n, d) => { const h = args.find((a) => a.startsWith(`--${n}=`)); return h ? h.slice(n.length + 3) : d; };
const BASE = argVal("base", "http://localhost:8910/index.html");
const SHOTS = argVal("shots", "");
const EXE = process.env.JUMVI_EXE_CHROMIUM || undefined;

const MIN_CTA_HEIGHT = 48;   // WCAG 2.2 SC 2.5.8 target size (minimum)
const MIN_GAP = 4;           // px between the last helper line and the CTA

const VIEWPORTS = [
  { w: 320, h: 568,  label: "small phone",        orientation: "portrait" },
  { w: 390, h: 844,  label: "iPhone 12/13/14",    orientation: "portrait" },
  { w: 430, h: 932,  label: "iPhone Pro Max",     orientation: "portrait" },
  { w: 568, h: 320,  label: "small phone",        orientation: "landscape" },
  { w: 844, h: 390,  label: "iPhone 12/13/14",    orientation: "landscape" },
  { w: 768, h: 1024, label: "tablet",             orientation: "portrait" },
];

/* Both states matter: the count line is rewritten when a level is picked, and
   the rewritten string is a different length. */
const PHASES = ["default", "level picked"];

const probe = () => {
  const cta = document.getElementById("btnWelcomeStart");
  if (!cta) return { error: "no #btnWelcomeStart" };
  const c = cta.getBoundingClientRect();

  /* The visible part of an element: its own box intersected with every
     ancestor that clips. A line scrolled out of the level list still reports a
     full-size rect, and comparing THAT to the CTA is what produces phantom
     failures — the pixels were never painted. */
  const visibleRect = (el) => {
    let r = el.getBoundingClientRect();
    let n = el.parentElement;
    while (n && n.nodeType === 1) {
      const cs = getComputedStyle(n);
      if (cs.overflow !== "visible" || cs.overflowY !== "visible" || cs.overflowX !== "visible") {
        const b = n.getBoundingClientRect();
        const left = Math.max(r.left, b.left), right = Math.min(r.right, b.right);
        const top = Math.max(r.top, b.top), bottom = Math.min(r.bottom, b.bottom);
        if (right <= left || bottom <= top) return null;
        r = { left, right, top, bottom, width: right - left, height: bottom - top };
      }
      n = n.parentElement;
    }
    return r.width > 0.5 && r.height > 0.5 ? r : null;
  };

  /* Of the pixels that ARE painted, ask the renderer who is on top. */
  const covered = (el) => {
    const rect = visibleRect(el);
    if (!rect) return 0;
    const x0 = Math.max(rect.left, c.left), x1 = Math.min(rect.right, c.right);
    const y0 = Math.max(rect.top, c.top),   y1 = Math.min(rect.bottom, c.bottom);
    if (x1 <= x0 || y1 <= y0) return 0;
    let hits = 0;
    for (const fx of [0.2, 0.5, 0.8]) {
      for (const fy of [0.25, 0.5, 0.75]) {
        const x = x0 + (x1 - x0) * fx, y = y0 + (y1 - y0) * fy;
        if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) continue;
        const top = document.elementFromPoint(x, y);
        if (top && (top === cta || cta.contains(top))) hits++;
      }
    }
    return hits;
  };

  const occluded = [];
  const seen = new Set();
  const walker = document.createTreeWalker(document.getElementById("welcomeOverlay"), NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode, el = node.parentElement;
    if (!el || el === cta || cta.contains(el)) continue;
    const text = node.nodeValue.replace(/\s+/g, " ").trim();
    if (!text) continue;
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden" || parseFloat(cs.opacity) === 0) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    const key = el.className + "|" + text.slice(0, 20);
    if (seen.has(key)) continue;
    const hits = covered(el);
    if (hits > 0) { seen.add(key); occluded.push({ text: text.slice(0, 40), cls: String(el.className || el.tagName).slice(0, 30), hits }); }
  }

  /* Gap between the last helper line and the CTA, measured with the list
     scrolled to its end — that is where the count line actually sits when a
     parent has read down to it, and it is the only offset where the two are
     adjacent. On a screen tall enough for everything, this is a no-op. */
  const scroller = document.getElementById("welcomeScroll");
  if (scroller) scroller.scrollTop = scroller.scrollHeight;
  const count = document.getElementById("welcomeMissionCount");
  let gap = null, countVisible = null;
  if (count) {
    const vr = visibleRect(count);
    countVisible = !!vr && vr.height >= count.getBoundingClientRect().height - 1;
    gap = Math.round(c.top - count.getBoundingClientRect().bottom);
  }

  /* Is every control reachable? A control inside a scroller is reachable if
     scrollIntoView can bring it into the scroller's visible band. */
  const controls = [...document.querySelectorAll("#welcomeOverlay button")];
  const unreachable = [];
  for (const btn of controls) {
    btn.scrollIntoView({ block: "nearest" });
    const b = btn.getBoundingClientRect();
    if (b.bottom <= 0 || b.top >= innerHeight || b.width < 1 || b.height < 1) {
      unreachable.push((btn.id || btn.textContent || "?").trim().slice(0, 30));
    }
  }

  return {
    cta: { top: Math.round(c.top), bottom: Math.round(c.bottom), height: Math.round(c.height), position: getComputedStyle(cta).position },
    viewportH: innerHeight,
    ctaInsideViewport: c.top >= -0.5 && c.bottom <= innerHeight + 0.5,
    gap, countVisible, occluded, unreachable,
    countText: (count?.textContent || "").trim().slice(0, 44),
  };
};

const chromium = loadChromium();
const browser = await chromium.launch({ executablePath: EXE });
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });

let failures = 0;
console.log("Onboarding — content above the Start CTA\n");

for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on("pageerror", () => {});
  await page.goto(BASE, { waitUntil: "networkidle" }).catch(() => {});
  await page.waitForTimeout(1400);

  for (const phase of PHASES) {
    if (phase === "level picked") {
      await page.evaluate(() => [...document.querySelectorAll("#welcomeOverlay button.ageBtn")]
        .find((b) => /some practice/i.test(b.textContent || ""))?.click());
      await page.waitForTimeout(600);
    }
    const r = await page.evaluate(probe);
    if (r.error) { console.log(`  ${vp.w}×${vp.h} — ${r.error}`); failures++; continue; }

    const problems = [];
    if (r.occluded.length) problems.push(`${r.occluded.length} element(s) painted over by the CTA`);
    if (r.cta.height < MIN_CTA_HEIGHT) problems.push(`CTA is ${r.cta.height}px, floor is ${MIN_CTA_HEIGHT}px`);
    if (!r.ctaInsideViewport) problems.push(`CTA runs outside the viewport (${r.cta.top}–${r.cta.bottom} of ${r.viewportH})`);
    if (r.countVisible === false) problems.push("the mission count line cannot be scrolled fully into view");
    if (r.gap !== null && r.gap < MIN_GAP) problems.push(`only ${r.gap}px between the count line and the CTA once scrolled to the end`);
    if (r.unreachable.length) problems.push(`unreachable control(s): ${r.unreachable.join(", ")}`);

    const tag = `${String(vp.w).padStart(4)}×${String(vp.h).padEnd(4)} ${vp.orientation.padEnd(9)} ${phase.padEnd(12)}`;
    if (problems.length) {
      failures += problems.length;
      console.log(`  ❌ ${tag} ${problems.join("; ")}`);
      for (const o of r.occluded) console.log(`        covered: .${o.cls} "${o.text}"`);
    } else {
      console.log(`  ✅ ${tag} CTA ${r.cta.height}px ${r.cta.position}, gap ${r.gap}px, "${r.countText}"`);
    }

    if (SHOTS) {
      const name = `${SHOTS}/onboarding-${vp.w}x${vp.h}-${vp.orientation}-${phase.replace(/\s+/g, "-")}.png`;
      await page.screenshot({ path: name });
    }
  }
  await ctx.close();
}

await browser.close();
if (failures) { console.log(`\n❌ ${failures} onboarding layout failure(s).`); process.exit(1); }
console.log("\n✅ Nothing above the CTA is covered, at any tested size or orientation.");

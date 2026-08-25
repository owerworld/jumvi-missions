#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
 * check-undo-next-layout.mjs — "Undo" and "Next" are two controls that mean
 * opposite things, so on the completion screen they must be two separate,
 * fully visible, separately tappable boxes. At every viewport.
 *
 * This is the check that a single `bottom` value could never satisfy. With the
 * undo bar as a viewport-fixed overlay the numbers were:
 *
 *   320x568   Next 419-475   bar 436-496   69% of Next covered
 *   568x320   actions run to 361 on a 320px-tall screen
 *   844x390   actions run to 396 on a 390px-tall screen
 *
 * Moving the bar down collided on landscape, moving it up collided on portrait.
 * So the test asserts three things that together cannot be satisfied by tuning
 * a number — only by a layout that gives each control its own box:
 *
 *   1. zero geometric overlap
 *   2. BOTH fully inside the viewport (no partly-scrolled-off control)
 *   3. both hit-testable at their own centre, unscrolled
 *
 *   node tools/check-undo-next-layout.mjs
 * Exit 1 on any FAIL.
 * ══════════════════════════════════════════════════════════════════════════*/
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";

const require_ = createRequire(import.meta.url);
const chromium = (() => {
  const spec = process.env.JUMVI_PW || "playwright";
  try { return require_(spec).chromium; }
  catch { console.error(`Playwright not found (tried "${spec}"). Set JUMVI_PW.`); process.exit(2); }
})();
const args = process.argv.slice(2);
const argVal = (n, d) => { const h = args.find((a) => a.startsWith(`--${n}=`)); return h ? h.slice(n.length + 3) : d; };
const BASE = argVal("base", "http://localhost:8910/index.html");
const SHOTS = argVal("shots", "docs/audits/screens/faz7");
const EXE = process.env.JUMVI_EXE_CHROMIUM || undefined;
mkdirSync(SHOTS, { recursive: true });

const VIEWPORTS = [
  { w: 320, h: 568, o: "portrait" },
  { w: 390, h: 844, o: "portrait" },
  { w: 430, h: 932, o: "portrait" },
  { w: 568, h: 320, o: "landscape" },
  { w: 844, h: 390, o: "landscape" },
];

const results = [];
const record = (id, name, status, detail) => {
  results.push({ id, name, status, detail });
  console.log(`  ${status === "PASS" ? "✅" : "❌"} ${id}  ${name}${detail ? "\n         " + detail : ""}`);
};

const browser = await chromium.launch({
  executablePath: EXE,
  args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});

console.log("Undo vs Next on the completion screen — separate, visible, tappable\n");

for (const vp of VIEWPORTS) {
  const tag = `${vp.w}x${vp.h}`;
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("   [pageerror]", String(e.message).slice(0, 100)));
  await page.addInitScript(() => localStorage.setItem("jumvi_onboarded_v2", "1"));
  await page.goto(BASE, { waitUntil: "networkidle" }).catch(() => {});
  await page.waitForTimeout(1500);
  for (let i = 0; i < 5; i++) {
    if (!(await page.evaluate(() => document.body.classList.contains("modalOpen")))) break;
    await page.keyboard.press("Escape"); await page.waitForTimeout(280);
  }
  await page.evaluate(() => switchTab("browse"));
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    const el = [...document.querySelectorAll("[data-mission-id]")].find(e => e.getClientRects().length);
    el?.scrollIntoView({ block: "center" }); el?.click();
  });
  await page.waitForTimeout(1000);
  for (let i = 0; i < 4; i++) {
    await page.evaluate(() => document.getElementById("btnStartTimer")?.click());
    await page.waitForTimeout(1400);
    if ((await page.evaluate(() => window.__jumviPlayProbe?.()?.timerState)) === "running") break;
  }
  await page.evaluate(() => { missionOpenedAt = Date.now() - 90000; });
  await page.waitForTimeout(1200);
  await page.evaluate(() => document.getElementById("btnToggleDone")?.click());
  await page.waitForTimeout(1500);

  /* Deliberately UNSCROLLED. Scrolling a target into view before hit-testing is
     how an earlier harness manufactured overlaps that the real layout did not
     have — the completion screen is what the family is looking at, so measure
     that. */
  const m = await page.evaluate(() => {
    const box = (el) => { const r = el.getBoundingClientRect();
      return { t: Math.round(r.top), b: Math.round(r.bottom), l: Math.round(r.left), r: Math.round(r.right), h: Math.round(r.height) }; };
    const hit = (el) => {
      const r = el.getBoundingClientRect();
      const x = r.left + r.width / 2, y = r.top + r.height / 2;
      const h = document.elementFromPoint(x, y);
      return { ok: !!h && (el === h || el.contains(h)),
        by: h ? (h.id || String(h.className).split(" ")[0] || h.tagName) : "nothing" };
    };
    const bar = document.getElementById("undoBar");
    const undoBtn = document.getElementById("undoBtn");
    const next = document.getElementById("btnNext");
    if (!bar || bar.hidden || !next) return { missing: true, barHidden: bar ? bar.hidden : "no bar" };
    const ub = box(bar), nb = box(next);
    return {
      undo: ub, next: nb,
      undoBtn: box(undoBtn), undoBtnHit: hit(undoBtn), nextHit: hit(next),
      overlapPx: Math.max(0, Math.min(ub.b, nb.b) - Math.max(ub.t, nb.t)),
      vh: innerHeight, vw: innerWidth,
      undoPosition: getComputedStyle(bar).position,
      undoInSheet: !!bar.closest("#sheet"),
    };
  });
  await page.screenshot({ path: `${SHOTS}/${tag}-undo-next.png` });
  await ctx.close();

  if (m.missing) {
    record(tag, `${tag} ${vp.o}: completion screen`, "FAIL", `undo bar not shown (${m.barHidden})`);
    continue;
  }
  const undoVisible = m.undo.t >= 0 && m.undo.b <= m.vh && m.undo.l >= 0 && m.undo.r <= m.vw;
  const nextVisible = m.next.t >= 0 && m.next.b <= m.vh && m.next.l >= 0 && m.next.r <= m.vw;
  const ok = m.overlapPx === 0 && undoVisible && nextVisible && m.undoBtnHit.ok && m.nextHit.ok;
  record(tag, `${tag} ${vp.o}: Undo and Next separate, fully visible, both tappable`,
    ok ? "PASS" : "FAIL",
    `undo bar [${m.undo.t},${m.undo.b}] fullyVisible=${undoVisible} · Next [${m.next.t},${m.next.b}] fullyVisible=${nextVisible}` +
    `\n         overlap=${m.overlapPx}px · "Undo" tappable=${m.undoBtnHit.ok}${m.undoBtnHit.ok ? "" : " (blocked by " + m.undoBtnHit.by + ")"}` +
    ` · "Next" tappable=${m.nextHit.ok}${m.nextHit.ok ? "" : " (blocked by " + m.nextHit.by + ")"}` +
    `\n         bar position=${m.undoPosition} docked inside #sheet=${m.undoInSheet} (viewport ${m.vw}x${m.vh})`);
}

await browser.close();
const pass = results.filter(r => r.status === "PASS").length;
const fail = results.filter(r => r.status === "FAIL").length;
console.log(`\n${pass} pass, ${fail} fail, of ${results.length} viewports.`);
console.log(`screenshots → ${SHOTS}/`);
process.exit(fail > 0 ? 1 : 0);

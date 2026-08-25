#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
 * check-zoom-textresize.mjs — Faz 6A.3. Can a parent who needs bigger text
 * still use JUMVI?
 *
 * Two different WCAG 2.2 requirements get conflated constantly, so they are
 * measured separately here:
 *
 *   SC 1.4.4 Resize text  — text must reach 200% without loss of content or
 *   functionality. Driven the way a browser's own text-size setting does it:
 *   the root font-size goes 16px → 32px. Anything sized in px rather than a
 *   relative unit will NOT grow, and that is exactly what this catches.
 *
 *   SC 1.4.10 Reflow — content must work at 320 CSS px wide with no
 *   two-dimensional scrolling. 400% zoom on a 1280px window IS a 320px
 *   viewport, so that is how it is emulated.
 *
 * Plus the things that silently forbid zoom in the first place: a
 * maximum-scale/user-scalable viewport, a gesture guard, touch-action:none on
 * the document, and inputs under 16px (which make iOS Safari zoom the whole
 * page on focus and never zoom back).
 *
 *   node tools/check-zoom-textresize.mjs
 * Exit 1 on any FAIL.
 * ══════════════════════════════════════════════════════════════════════════*/
import { createRequire } from "node:module";

const require_ = createRequire(import.meta.url);
const chromium = (() => {
  const spec = process.env.JUMVI_PW || "playwright";
  try { return require_(spec).chromium; }
  catch { console.error(`Playwright not found (tried "${spec}"). Set JUMVI_PW.`); process.exit(2); }
})();
const args = process.argv.slice(2);
const argVal = (n, d) => { const h = args.find((a) => a.startsWith(`--${n}=`)); return h ? h.slice(n.length + 3) : d; };
const BASE = argVal("base", "http://localhost:8910/index.html");
const SHOTS = argVal("shots", "docs/audits/screens/faz6");
const EXE = process.env.JUMVI_EXE_CHROMIUM || undefined;

const results = [];
const record = (id, name, status, detail) => {
  results.push({ id, name, status, detail });
  const mark = { PASS: "✅", FAIL: "❌", INFO: "⚠️ ", SKIP: "⏭️ " }[status] || "•";
  console.log(`  ${mark} ${id}  ${name}${detail ? "\n         " + detail : ""}`);
};

const browser = await chromium.launch({
  executablePath: EXE,
  args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});

async function session(viewport = { width: 390, height: 844 }) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  page.on("pageerror", () => {});
  await page.addInitScript(() => localStorage.setItem("jumvi_onboarded_v2", "1"));
  await page.goto(BASE, { waitUntil: "networkidle" }).catch(() => {});
  await page.waitForTimeout(1400);
  for (let i = 0; i < 5; i++) {
    if (!(await page.evaluate(() => document.body.classList.contains("modalOpen")))) break;
    await page.keyboard.press("Escape"); await page.waitForTimeout(300);
  }
  return { ctx, page };
}

/* Text that no longer fits its own box. Deliberate single-line ellipsis is
   reported apart from hard clipping: a nav label that ellipsises is a design
   choice, a button whose label is cut with no ellipsis is lost information. */
const clippedText = (page) => page.evaluate(() => {
  const out = [];
  const walk = document.querySelectorAll("body *");
  for (const el of walk) {
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden") continue;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    // only elements that render their own text
    const own = [...el.childNodes].filter(n => n.nodeType === 3 && n.textContent.trim()).map(n => n.textContent.trim()).join(" ");
    if (!own) continue;
    const hidesX = /hidden|clip/.test(cs.overflowX);
    const hidesY = /hidden|clip/.test(cs.overflowY);
    const overX = el.scrollWidth - el.clientWidth;
    const overY = el.scrollHeight - el.clientHeight;
    if ((hidesX && overX > 2) || (hidesY && overY > 2)) {
      out.push({
        sel: (el.id ? "#" + el.id : el.tagName.toLowerCase() + "." + String(el.className).split(" ")[0]).slice(0, 40),
        text: own.slice(0, 34),
        overX: hidesX ? overX : 0,
        overY: hidesY ? overY : 0,
        ellipsis: cs.textOverflow === "ellipsis" && cs.whiteSpace === "nowrap",
      });
    }
  }
  return out;
});

/* Do the controls a family needs still not sit on top of each other? */
const overlaps = (page, sels) => page.evaluate((list) => {
  const boxes = [];
  for (const sel of list) {
    for (const el of document.querySelectorAll(sel)) {
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden") continue;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      // Skip anything living inside a fixed layer. The bottom nav floats OVER
      // scrolling content by design, so a box intersection with it is not an
      // overlap bug — whether it blocks anything is a hit test, done in Z06.
      let fixed = false;
      for (let p = el; p && p !== document.body; p = p.parentElement) {
        if (getComputedStyle(p).position === "fixed") { fixed = true; break; }
      }
      if (fixed) continue;
      boxes.push({ sel, r: { t: r.top, l: r.left, b: r.bottom, rt: r.right },
        label: (el.textContent || el.getAttribute("aria-label") || "?").replace(/\s+/g, " ").trim().slice(0, 22) });
    }
  }
  const hits = [];
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const a = boxes[i].r, b = boxes[j].r;
    const ox = Math.min(a.rt, b.rt) - Math.max(a.l, b.l);
    const oy = Math.min(a.b, b.b) - Math.max(a.t, b.t);
    if (ox > 4 && oy > 4) hits.push(`"${boxes[i].label}" ∩ "${boxes[j].label}" (${Math.round(ox)}x${Math.round(oy)}px)`);
  }
  return hits;
}, sels);

const CTA_SELECTORS = [
  ".navTab", "#btnDailyPlay", ".familyPickMission", "#btnFamilyAddPlayer",
  "#btnStartTimer", "#btnToggleDone", "#btnNext", "#btnClose", ".profileQuickLink",
];

console.log("Zoom, text resize and reflow — Faz 6A.3\n");

/* ── Z01 the viewport meta must not forbid zoom ─────────────────────────── */
{
  const { ctx, page } = await session();
  const meta = await page.evaluate(() =>
    document.querySelector('meta[name="viewport"]')?.getAttribute("content") || "");
  const guards = await page.evaluate(() => {
    const doc = getComputedStyle(document.documentElement).touchAction;
    const body = getComputedStyle(document.body).touchAction;
    // a gesture guard would have to cancel these to block pinch
    let blocked = false;
    for (const t of ["gesturestart", "gesturechange"]) {
      const ev = new Event(t, { cancelable: true, bubbles: true });
      document.dispatchEvent(ev);
      if (ev.defaultPrevented) blocked = true;
    }
    const tev = new Event("touchmove", { cancelable: true, bubbles: true });
    document.dispatchEvent(tev);
    return { htmlTouchAction: doc, bodyTouchAction: body, gestureBlocked: blocked, touchmoveBlocked: tev.defaultPrevented };
  });
  await ctx.close();
  const bad = /maximum-scale|user-scalable\s*=\s*(no|0)/i.test(meta);
  const taBad = /none/.test(guards.htmlTouchAction) || /none/.test(guards.bodyTouchAction);
  const ok = !bad && !taBad && !guards.gestureBlocked && !guards.touchmoveBlocked;
  record("Z01", "nothing forbids pinch zoom", ok ? "PASS" : "FAIL",
    `viewport="${meta}"\n         touch-action html=${guards.htmlTouchAction} body=${guards.bodyTouchAction} · ` +
    `gesture preventDefault=${guards.gestureBlocked} · touchmove preventDefault=${guards.touchmoveBlocked}`);
}

/* ── Z02 inputs at 16px+ so iOS does not zoom on focus and stay zoomed ──── */
{
  const { ctx, page } = await session();
  /* The three inputs in this app live behind two surfaces, so both are opened
     before measuring — an earlier run reported "0 inputs checked · none under
     16px", which is a pass that proves nothing. */
  await page.evaluate(() => { try { switchTab("today"); document.getElementById("avatarBtn")?.click(); } catch (_) {} });
  await page.waitForTimeout(800);
  await page.evaluate(() => { try { openProfileSheet?.(getActiveProfileId?.()); } catch (_) {} });
  await page.waitForTimeout(600);
  await page.evaluate(() => { try { openCertificate(); } catch (_) {} });
  await page.waitForTimeout(800);
  const small = await page.evaluate(() =>
    [...document.querySelectorAll("input, select, textarea")]
      .filter(el => el.getClientRects().length)
      .map(el => ({ id: el.id || el.name || el.type, fs: parseFloat(getComputedStyle(el).fontSize) }))
      .filter(x => x.fs < 16));
  const all = await page.evaluate(() =>
    [...document.querySelectorAll("input, select, textarea")].filter(el => el.getClientRects().length).length);
  await ctx.close();
  const measured = all > 0;
  record("Z02", "visible inputs are ≥16px, so focusing one does not zoom the page",
    !measured ? "FAIL" : (small.length === 0 ? "PASS" : "FAIL"),
    `${all} visible inputs checked` +
    (!measured ? " — none were reachable, so this proves nothing and is NOT a pass"
      : (small.length ? ` · under 16px: ${small.map(s => `${s.id}=${s.fs}px`).join(", ")}` : " · none under 16px")));
}

/* ── Z03 SC 1.4.4 — 200% text resize on the four tabs ───────────────────── */
for (const tab of ["today", "browse", "modes", "profile"]) {
  const { ctx, page } = await session();
  await page.evaluate((t) => { try { switchTab(t); } catch (_) {} }, tab);
  await page.waitForTimeout(600);
  // this is what a browser's "text size: 200%" does
  await page.evaluate(() => { document.documentElement.style.fontSize = "32px"; });
  await page.waitForTimeout(700);
  const clipped = (await clippedText(page)).filter(c => !c.ellipsis);
  const ell = (await clippedText(page)).filter(c => c.ellipsis);
  const ov = await overlaps(page, CTA_SELECTORS);
  const hscroll = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth > 2);
  await page.screenshot({ path: `${SHOTS}/text200-${tab}.png`, fullPage: false });
  await ctx.close();
  const ok = clipped.length === 0 && ov.length === 0 && !hscroll;
  record(`Z03.${tab}`, `200% text resize on ${tab}: nothing clipped, nothing overlapping`,
    ok ? "PASS" : "FAIL",
    `hard-clipped=${clipped.length}${clipped.length ? " → " + clipped.slice(0, 4).map(c => `${c.sel}"${c.text}"(+${c.overX || c.overY}px)`).join(", ") : ""}` +
    `\n         ellipsis-by-design=${ell.length}${ell.length ? " (" + ell.slice(0, 3).map(c => c.sel).join(", ") + ")" : ""}` +
    ` · CTA overlaps=${ov.length}${ov.length ? " → " + ov.slice(0, 3).join("; ") : ""} · horizontal page scroll=${hscroll}`);
}

/* ── Z04 SC 1.4.4 inside the mission sheet, where play actually happens ─── */
{
  const { ctx, page } = await session();
  await page.evaluate(() => { try { switchTab("browse"); } catch (_) {} });
  await page.waitForTimeout(600);
  await page.evaluate(() => { document.documentElement.style.fontSize = "32px"; });
  await page.waitForTimeout(400);
  await page.evaluate(() => [...document.querySelectorAll("[data-mission-id]")].find(e => e.getClientRects().length)?.click());
  await page.waitForTimeout(900);
  const clipped = (await clippedText(page)).filter(c => !c.ellipsis);
  const reach = await page.evaluate(() => {
    const out = {};
    for (const id of ["btnStartTimer", "btnToggleDone", "btnNext", "btnClose"]) {
      const el = document.getElementById(id);
      if (!el || !el.getClientRects().length) { out[id] = "absent"; continue; }
      el.scrollIntoView({ block: "center" });
      const r = el.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      out[id] = (el === hit || el.contains(hit)) ? "reachable" : "BLOCKED by " + (hit ? (hit.id || hit.className || hit.tagName) : "nothing");
    }
    return out;
  });
  await page.screenshot({ path: `${SHOTS}/text200-mission-sheet.png` });
  await ctx.close();
  const blocked = Object.entries(reach).filter(([, v]) => v.startsWith("BLOCKED"));
  const ok = clipped.length === 0 && blocked.length === 0;
  record("Z04", "200% text: mission sheet controls stay reachable", ok ? "PASS" : "FAIL",
    Object.entries(reach).map(([k, v]) => `${k}=${v}`).join(" · ") +
    `\n         hard-clipped=${clipped.length}${clipped.length ? " → " + clipped.slice(0, 4).map(c => `${c.sel}"${c.text}"`).join(", ") : ""}`);
}

/* ── Z06 the sticky nav must not make anything UNREACHABLE at 200% text ─── */
/* The right question for a floating bottom nav is not "do boxes intersect"
   (they always will) but "after scrolling to it, can the control be tapped".
   That is a hit test, so that is what this does. */
for (const tab of ["today", "modes", "profile"]) {
  const { ctx, page } = await session();
  await page.evaluate((t) => { try { switchTab(t); } catch (_) {} }, tab);
  await page.waitForTimeout(600);
  await page.evaluate(() => { document.documentElement.style.fontSize = "32px"; });
  await page.waitForTimeout(700);
  const reach = await page.evaluate(() => {
    const sels = [".navTab", "#btnDailyPlay", ".familyPickMission", "#btnFamilyAddPlayer",
      "#btnCheckUpdate", "#btnReset", "#privacyLink", "#helpSupportLink"];
    const out = [];
    for (const sel of sels) for (const el of document.querySelectorAll(sel)) {
      if (!el.getClientRects().length) continue;
      el.scrollIntoView({ block: "center" });
      let r = el.getBoundingClientRect();
      let hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      if (!(el === hit || el.contains(hit))) {
        // these screens deliberately keep the nav on screen; scroll to the end
        // and try once more before calling it blocked
        window.scrollTo(0, document.documentElement.scrollHeight);
        r = el.getBoundingClientRect();
        hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      }
      const label = (el.textContent || el.getAttribute("aria-label") || "?").replace(/\s+/g, " ").trim().slice(0, 20);
      out.push({ label, ok: el === hit || el.contains(hit),
        by: hit ? (hit.id || String(hit.className).split(" ")[0] || hit.tagName) : "nothing" });
    }
    return out;
  });
  await ctx.close();
  const blocked = reach.filter(r => !r.ok);
  record(`Z06.${tab}`, `200% text on ${tab}: every primary control is still hit-testable`,
    blocked.length === 0 ? "PASS" : "FAIL",
    `${reach.length} controls hit-tested` +
    (blocked.length ? ` · BLOCKED: ${blocked.map(b => `"${b.label}" by ${b.by}`).join(", ")}` : " · none blocked"));
}

/* ── Z05 SC 1.4.10 reflow — 400% zoom is a 320px viewport ───────────────── */
for (const tab of ["today", "browse", "modes", "profile"]) {
  const { ctx, page } = await session({ width: 320, height: 512 });
  await page.evaluate((t) => { try { switchTab(t); } catch (_) {} }, tab);
  await page.waitForTimeout(700);
  const hscroll = await page.evaluate(() => ({
    over: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    widest: (() => {
      let worst = null;
      for (const el of document.querySelectorAll("body *")) {
        const cs = getComputedStyle(el);
        if (cs.display === "none" || cs.position === "fixed") continue;
        const r = el.getBoundingClientRect();
        if (r.right > innerWidth + 2 && (!worst || r.right > worst.right)) {
          worst = { right: Math.round(r.right), sel: el.id ? "#" + el.id : el.tagName.toLowerCase() + "." + String(el.className).split(" ")[0] };
        }
      }
      return worst;
    })(),
  }));
  if (tab === "today") await page.screenshot({ path: `${SHOTS}/reflow320-${tab}.png` });
  await ctx.close();
  const ok = hscroll.over <= 2;
  record(`Z05.${tab}`, `reflow at 320px (≈400% zoom) on ${tab}: no two-dimensional scrolling`,
    ok ? "PASS" : "FAIL",
    `horizontal overflow=${hscroll.over}px` + (hscroll.widest ? ` · widest offender ${hscroll.widest.sel} right=${hscroll.widest.right}` : ""));
}

await browser.close();
const pass = results.filter(r => r.status === "PASS").length;
const fail = results.filter(r => r.status === "FAIL").length;
console.log(`\n${pass} pass, ${fail} fail, of ${results.length} checks.`);
process.exit(fail > 0 ? 1 : 0);

#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
 * check-a11y-controls.mjs — the checks a screen reader user runs into first.
 *
 * Five things, measured on the live DOM at each surface:
 *
 *   names      Every VISIBLE button/link has an accessible name. An icon-only
 *              control with no name is announced as "button" — the user is
 *              told a control exists and nothing about what it does.
 *   labels     Every visible input has a real label or aria-labelledby.
 *              A placeholder is not a label: it disappears on focus, and
 *              several screen readers never announce it at all.
 *   duplicate  Duplicate ids break label/for, aria-labelledby and
 *   ids        getElementById alike, and they do it silently.
 *   targets    Visible controls smaller than the WCAG 2.2 SC 2.5.8 floor.
 *              Reported with the measured size, not a pass/fail guess.
 *   zoom       The viewport meta must not pin scale (SC 1.4.4).
 *
 * Names are resolved the way a browser does, in order: aria-labelledby,
 * aria-label, own text, title, then an alt/aria-label on a child image — NOT
 * just textContent, which would mark a perfectly-labelled icon button as
 * broken and hide the real ones in the noise.
 *
 *   node tools/check-a11y-controls.mjs
 *   node tools/check-a11y-controls.mjs --base=URL
 *
 * Exit 1 on any unnamed control, unlabelled input, or duplicate id.
 * ══════════════════════════════════════════════════════════════════════════*/
import { createRequire } from "node:module";

const require_ = createRequire(import.meta.url);
const loadChromium = () => {
  const spec = process.env.JUMVI_PW || "playwright";
  try { return require_(spec).chromium; }
  catch { console.error(`Playwright not found (tried "${spec}"). Set JUMVI_PW.`); process.exit(2); }
};
const args = process.argv.slice(2);
const argVal = (n, d) => { const h = args.find((a) => a.startsWith(`--${n}=`)); return h ? h.slice(n.length + 3) : d; };
const BASE = argVal("base", "http://localhost:8910/index.html");
const EXE = process.env.JUMVI_EXE_CHROMIUM || undefined;
const MIN_TARGET = 24;   // SC 2.5.8 minimum; 44 is the AAA/",preferred" size
const PREF_TARGET = 44;

const audit = ({ MIN_TARGET, PREF_TARGET }) => {
  const visible = (el) => {
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden" || parseFloat(cs.opacity) === 0) return false;
    if (el.hasAttribute("hidden") || el.closest("[hidden]")) return false;
    if (el.closest("[inert]") || el.closest('[aria-hidden="true"]')) return false;
    const r = el.getBoundingClientRect();
    return r.width >= 1 && r.height >= 1;
  };

  const nameOf = (el) => {
    const byIds = (v) => (v || "").split(/\s+/).map((id) => document.getElementById(id)?.textContent || "").join(" ").trim();
    const lb = el.getAttribute("aria-labelledby");
    if (lb && byIds(lb)) return byIds(lb);
    const al = (el.getAttribute("aria-label") || "").trim();
    if (al) return al;
    const own = (el.textContent || "").replace(/\s+/g, " ").trim();
    if (own) return own;
    const title = (el.getAttribute("title") || "").trim();
    if (title) return title;
    for (const img of el.querySelectorAll("img,svg,[role=img]")) {
      const t = (img.getAttribute("alt") || img.getAttribute("aria-label") || "").trim();
      if (t) return t;
    }
    return "";
  };

  const describe = (el) => {
    const bits = [el.tagName.toLowerCase()];
    if (el.id) bits.push("#" + el.id);
    if (el.className && typeof el.className === "string") bits.push("." + el.className.trim().split(/\s+/).slice(0, 2).join("."));
    return bits.join("").slice(0, 60);
  };

  /* ── unnamed visible controls ─────────────────────────────────────────── */
  const unnamed = [];
  for (const el of document.querySelectorAll('button, a[href], [role="button"], summary')) {
    if (!visible(el)) continue;
    if (el.getAttribute("aria-hidden") === "true") continue;
    if (!nameOf(el)) unnamed.push(describe(el));
  }

  /* ── unlabelled visible inputs ────────────────────────────────────────── */
  const unlabelled = [];
  for (const el of document.querySelectorAll("input, textarea, select")) {
    if (el.type === "hidden") continue;
    if (!visible(el)) continue;
    const lb = el.getAttribute("aria-labelledby");
    const hasLb = lb && lb.split(/\s+/).some((id) => document.getElementById(id));
    const hasAl = (el.getAttribute("aria-label") || "").trim().length > 0;
    const hasFor = el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
    const wrapped = el.closest("label");
    if (!hasLb && !hasAl && !hasFor && !wrapped) {
      unlabelled.push(describe(el) + (el.placeholder ? ` (placeholder-only: "${el.placeholder.slice(0, 30)}")` : ""));
    }
  }

  /* ── duplicate ids (whole document, not just visible) ─────────────────── */
  const idCounts = new Map();
  for (const el of document.querySelectorAll("[id]")) idCounts.set(el.id, (idCounts.get(el.id) || 0) + 1);
  const dupIds = [...idCounts].filter(([, n]) => n > 1).map(([id, n]) => `${id} ×${n}`);

  /* ── small targets ────────────────────────────────────────────────────── */
  /* SC 2.5.8 exempts a target whose size is constrained by the line-height of
     the sentence it sits in ("Inline"). A mailto: link in the middle of a
     support paragraph cannot be 44px tall without breaking the paragraph, and
     flagging it would bury a real finding under a rule that does not apply. */
  const isInline = (el) => {
    if (getComputedStyle(el).display !== "inline") return false;
    const parent = el.parentElement;
    if (!parent) return false;
    for (const n of parent.childNodes) {
      if (n.nodeType === 3 && n.nodeValue.trim()) return true;   // prose beside it
    }
    return false;
  };

  const small = [];
  for (const el of document.querySelectorAll('button, a[href], [role="button"], input[type=checkbox], input[type=radio]')) {
    if (!visible(el)) continue;
    const r = el.getBoundingClientRect();
    const w = Math.round(r.width), h = Math.round(r.height);
    if (w < PREF_TARGET || h < PREF_TARGET) {
      const inline = isInline(el);
      small.push({ el: describe(el), w, h, name: nameOf(el).slice(0, 26), inline,
                   belowMin: !inline && (w < MIN_TARGET || h < MIN_TARGET) });
    }
  }

  return { unnamed, unlabelled, dupIds, small };
};

const chromium = loadChromium();
const browser = await chromium.launch({ executablePath: EXE });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
page.on("pageerror", () => {});
await page.goto(BASE, { waitUntil: "networkidle" }).catch(() => {});
await page.waitForTimeout(1500);

const settle = (ms) => page.waitForTimeout(ms);
const closeModals = async () => {
  for (let i = 0; i < 5; i++) {
    if (!(await page.evaluate(() => document.body.classList.contains("modalOpen")))) break;
    await page.keyboard.press("Escape"); await settle(400);
  }
};

const results = [];
const run = async (label) => {
  const r = await page.evaluate(audit, { MIN_TARGET, PREF_TARGET });
  results.push({ label, ...r });
};

await run("Welcome overlay");
await page.evaluate(() => [...document.querySelectorAll("#welcomeOverlay button.ageBtn")].find((b) => /some practice/i.test(b.textContent || ""))?.click());
await settle(250);
await page.evaluate(() => document.getElementById("btnWelcomeStart")?.click());
await settle(1400);
await closeModals();

for (const [tab, label] of [["today", "Play"], ["browse", "Missions"], ["modes", "Family"], ["profile", "Grown-ups"]]) {
  await page.evaluate((t) => document.querySelector(`.navTab[data-tab="${t}"]`)?.click(), tab);
  await settle(800);
  if (tab === "browse") { await page.evaluate(() => document.querySelectorAll('.pathSectionHeader[aria-expanded="false"]').forEach((b) => b.click())); await settle(600); }
  await run(label);
}

await page.evaluate(() => document.querySelector(".navTab[data-tab='browse']")?.click());
await settle(600);
await page.evaluate(() => document.querySelector('[data-mission-id="1"]')?.click());
await settle(900);
await run("Mission sheet");
await closeModals();

for (const [id, label] of [["badgesBackdrop", "Badges"], ["privacyBackdrop", "Privacy"], ["helpBackdrop", "Help"],
                            ["certBackdrop", "Certificate"], ["profileBackdrop", "Profile"], ["fallbackBackdrop", "3D fallback"]]) {
  await page.evaluate((i) => document.getElementById(i)?.classList.add("show"), id);
  await settle(600);
  await run(label + " dialog");
  await page.evaluate((i) => document.getElementById(i)?.classList.remove("show"), id);
  await settle(300);
}

/* viewport meta */
const viewportMeta = await page.evaluate(() => document.querySelector('meta[name="viewport"]')?.content || "");
await browser.close();

/* ── report ────────────────────────────────────────────────────────────── */
const dedupe = (arr) => [...new Set(arr)];
const allUnnamed = dedupe(results.flatMap((r) => r.unnamed));
const allUnlabelled = dedupe(results.flatMap((r) => r.unlabelled));
const allDupIds = dedupe(results.flatMap((r) => r.dupIds));
const smallMap = new Map();
for (const r of results) for (const s of r.small) if (!smallMap.has(s.el)) smallMap.set(s.el, s);
const allSmall = [...smallMap.values()];
const belowMin = allSmall.filter((s) => s.belowMin);

console.log("WCAG control audit — 390×844, 12 surfaces\n");
console.log(`  viewport meta   ${viewportMeta}`);
const zoomBlocked = /user-scalable\s*=\s*no|maximum-scale\s*=\s*(1|0?\.\d)/i.test(viewportMeta);
console.log(`  zoom            ${zoomBlocked ? "❌ pinned by the viewport meta" : "✅ not pinned"}`);
console.log(`  unnamed buttons ${allUnnamed.length === 0 ? "✅ 0" : "❌ " + allUnnamed.length}`);
for (const u of allUnnamed) console.log(`      · ${u}`);
console.log(`  unlabelled inputs ${allUnlabelled.length === 0 ? "✅ 0" : "❌ " + allUnlabelled.length}`);
for (const u of allUnlabelled) console.log(`      · ${u}`);
console.log(`  duplicate ids   ${allDupIds.length === 0 ? "✅ 0" : "❌ " + allDupIds.length}`);
for (const d of allDupIds) console.log(`      · ${d}`);
console.log(`  targets < ${PREF_TARGET}px  ${allSmall.length} (of which < ${MIN_TARGET}px, the SC 2.5.8 floor: ${belowMin.length})`);
for (const s of allSmall.slice(0, 20)) console.log(`      ${s.belowMin ? "❌" : "·"} ${s.w}×${s.h}  ${s.el}  "${s.name}"${s.inline ? "  [inline — SC 2.5.8 exempt]" : ""}`);
if (allSmall.length > 20) console.log(`      … ${allSmall.length - 20} more`);

const hard = allUnnamed.length + allUnlabelled.length + allDupIds.length + belowMin.length + (zoomBlocked ? 1 : 0);
if (hard) { console.log(`\n❌ ${hard} blocking accessibility failure(s).`); process.exit(1); }
console.log("\n✅ Every visible control is named, every input labelled, ids unique, zoom available.");

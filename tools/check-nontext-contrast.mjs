#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
 * check-nontext-contrast.mjs — WCAG 2.2 SC 1.4.11, the half of contrast that
 * text auditors do not see.
 *
 * contrast-audit.js walks text nodes. It cannot tell you that the border
 * around an unselected filter chip is invisible, that a carousel dot vanishes
 * against its card, or that a focus ring is the same colour as the button it
 * surrounds. SC 1.4.11 wants 3:1 for exactly those: the parts of a control
 * that tell you the control is there and what state it is in.
 *
 * WHAT COUNTS. The criterion is deliberately narrow: it applies to the visual
 * information REQUIRED to identify a component and its state, not to every
 * edge on screen. A button with a text label is already identified by that
 * label, and the label is governed by 1.4.3, which the text sweep covers — so
 * a faint border around it is not a 1.4.11 failure. What this measures is the
 * information that has no text behind it:
 *
 *   identity   For a control with NO text of its own — an icon-only close, a
 *              carousel arrow, an input field — the thing that says "a control
 *              is here". That is the icon's own colour where there is an icon,
 *              otherwise the border, otherwise the fill. Controls that do carry
 *              a text label are measured too, but reported as notes.
 *   state      Selected vs unselected, active tab vs inactive. Measured
 *              between the two states' identifying colours — and the
 *              identifying colour is whichever channel actually differs, which
 *              for the tab bar is the icon and label colour, not the
 *              background (both tabs are transparent; an early version of this
 *              tool compared those and reported a meaningless 1:1).
 *   focus      The focus indicator against the surface it sits on. A ring
 *              nobody can see is not an indicator (1.4.11 with 2.4.11).
 *
 * Backgrounds are resolved by compositing the ancestor stack the same way
 * contrast-audit.js does — alpha and gradient stops included — because a
 * border drawn over a translucent card is not on the colour the token says.
 *
 *   node tools/check-nontext-contrast.mjs
 *   node tools/check-nontext-contrast.mjs --base=URL
 *
 * Exit 1 if any REQUIRED indicator is under 3:1. Decorative shortfalls are
 * printed as notes, never as failures — a dot that repeats information the
 * shape already carries is not a 1.4.11 violation, and calling it one buries
 * the findings that are.
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
const THRESHOLD = 3.0;

/* Injected into the page: colour maths + effective-background resolution. */
const KIT = `
window.__nt = (function(){
  function toRGBA(s){ if(!s||s==='transparent'||s==='none') return null;
    var m=s.match(/rgba?\\(([^)]+)\\)/); if(!m) return null;
    var p=m[1].split(',').map(parseFloat);
    return {r:p[0],g:p[1],b:p[2],a:p.length>3?p[3]:1}; }
  function over(f,b){ var a=f.a; return {r:f.r*a+b.r*(1-a),g:f.g*a+b.g*(1-a),b:f.b*a+b.b*(1-a),a:1}; }
  function lum(c){ var a=[c.r,c.g,c.b].map(function(v){v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4);});
    return 0.2126*a[0]+0.7152*a[1]+0.0722*a[2]; }
  function ratio(f,b){ var L1=lum(f),L2=lum(b),hi=Math.max(L1,L2),lo=Math.min(L1,L2); return (hi+0.05)/(lo+0.05); }
  function stops(img){ var out=[],re=/rgba?\\([^)]+\\)/g,m; while((m=re.exec(img))) out.push(toRGBA(m[0])); return out; }
  // Composite every ancestor background over the page base, expanding gradients.
  function behind(el, skipSelf){
    var base=toRGBA(getComputedStyle(document.documentElement).backgroundColor)||{r:255,g:255,b:255,a:1};
    if(base.a<1) base=over(base,{r:255,g:255,b:255,a:1});
    var chain=[],n=skipSelf?el.parentElement:el;
    while(n&&n.nodeType===1){ chain.push(n); n=n.parentElement; }
    chain.push(document.documentElement); chain.reverse();
    var acc=[{r:base.r,g:base.g,b:base.b,a:1}];
    for(var i=0;i<chain.length;i++){
      var cs=getComputedStyle(chain[i]);
      var bc=toRGBA(cs.backgroundColor);
      var img=cs.backgroundImage||'';
      var grad=img.indexOf('gradient')>=0?stops(img):[];
      if(bc) acc=acc.map(function(b){ return bc.a>=1?{r:bc.r,g:bc.g,b:bc.b,a:1}:over(bc,b); });
      if(grad.length){ var next=[]; acc.forEach(function(b){ grad.forEach(function(s){ if(s) next.push(s.a>=1?{r:s.r,g:s.g,b:s.b,a:1}:over(s,b)); }); }); if(next.length) acc=next; }
    }
    return acc;
  }
  function worst(fg, bgs){ var w=99; bgs.forEach(function(b){ var r=ratio(fg,b); if(r<w) w=r; }); return w; }
  function px(s){ return toRGBA(s); }
  function rgbStr(c){ return c?('rgb('+[c.r,c.g,c.b].map(Math.round).join(',')+')'):'?'; }
  // Does this control carry its own visible text? If so its identity is that
  // text, which SC 1.4.3 already governs.
  function ownText(el){
    var t='';
    el.childNodes.forEach(function(n){ if(n.nodeType===3) t+=n.nodeValue; });
    for (var i=0;i<el.children.length;i++){
      var c=el.children[i], cs=getComputedStyle(c);
      if(cs.display==='none'||cs.visibility==='hidden') continue;
      if(c.classList.contains('sr-only')) continue;
      t += c.textContent||'';
    }
    return t.replace(/\s+/g,' ').trim();
  }
  // The mask-image icons in this app paint the glyph with background-color and
  // keep color in sync; either channel is the glyph's colour.
  function iconOf(el){
    var ic = el.querySelector('.ico, .jic, svg, [class*="icon"]');
    if(!ic) return null;
    var cs = getComputedStyle(ic);
    var r = ic.getBoundingClientRect();
    if(r.width < 2 || r.height < 2) return null;
    var c = toRGBA(cs.backgroundColor);
    if(!c || c.a < 0.05) c = toRGBA(cs.color);
    return (c && c.a > 0.05) ? c : null;
  }
  // What visually says "this control exists", in the order a browser paints it.
  function identity(el){
    var behindEl = behind(el, true);
    var ic = iconOf(el);
    // An icon INSIDE a filled button is adjacent to that button's fill, not to
    // the page behind it. Reading the outer background here is what made a
    // white glyph on a blue button report as white-on-white.
    if(ic){ var onEl = behind(el, false);
      return { color: ic.a>=1?ic:over(ic,onEl[0]), via:'icon', behind:onEl }; }
    var cs = getComputedStyle(el);
    var bw = Math.max(parseFloat(cs.borderTopWidth)||0, parseFloat(cs.borderLeftWidth)||0);
    if(bw>=1){ var bc=toRGBA(cs.borderTopColor);
      if(bc && bc.a>0.05) return { color: bc.a>=1?bc:over(bc,behindEl[0]), via:'border', behind:behindEl }; }
    var own = toRGBA(cs.backgroundColor);
    if(own && own.a>0.05) return { color: own.a>=1?own:over(own,behindEl[0]), via:'fill', behind:behindEl };
    var tc = toRGBA(cs.color);
    if(tc && tc.a>0.05) return { color: tc.a>=1?tc:over(tc,behindEl[0]), via:'text', behind:behindEl };
    return null;
  }
  return { toRGBA:px, behind:behind, worst:worst, ratio:ratio, over:over, rgb:rgbStr,
           ownText:ownText, iconOf:iconOf, identity:identity };
})();
`;

/* Runs in the page. One row per visible control. */
const measure = (sel) => {
  const K = window.__nt;
  const out = [];
  const visible = (el) => {
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden" || parseFloat(cs.opacity) === 0) return false;
    if (el.closest("[hidden]") || el.closest("[inert]")) return false;
    const r = el.getBoundingClientRect();
    return r.width >= 2 && r.height >= 2;
  };
  const describe = (el) => {
    let s = el.tagName.toLowerCase();
    if (el.id) s += "#" + el.id;
    if (typeof el.className === "string" && el.className.trim()) s += "." + el.className.trim().split(/\s+/).slice(0, 2).join(".");
    return s.slice(0, 52);
  };

  for (const el of document.querySelectorAll(sel)) {
    if (!visible(el)) continue;
    const id = K.identity(el);
    if (!id) { out.push({ el: describe(el), ratio: null, via: "nothing drawn", bg: "?", labelled: !!K.ownText(el) }); continue; }
    out.push({
      el: describe(el),
      ratio: Math.round(K.worst(id.color, id.behind) * 100) / 100,
      via: id.via + " " + K.rgb(id.color),
      bg: K.rgb(id.behind[0]),
      /* A control with its own visible text is identified by that text, which
         SC 1.4.3 governs and the text sweep already checks. Its border is a
         note here, not a 1.4.11 failure. */
      labelled: !!K.ownText(el),
    });
  }
  return out;
};

/* Selected vs unselected.
   SC 1.4.11 asks for 3:1 "against adjacent color(s)" — so what must pass is
   the state indicator against the surface it is drawn on, NOT the two states
   against each other. Both numbers are produced here because they answer
   different questions: `indicator` is the conformance test, `betweenStates` is
   how easy the two are to tell apart, which is a usability signal and is
   reported without failing the run. Measured on whichever channel carries the
   state — for the tab bar both backgrounds are transparent and it is the icon
   colour, which an earlier cut of this tool missed by reading backgrounds and
   reporting a meaningless 1:1. */
const measurePairs = (pairs) => {
  const K = window.__nt;
  const out = [];
  const vis = (el) => { const cs = getComputedStyle(el); const r = el.getBoundingClientRect();
    return cs.display !== "none" && cs.visibility !== "hidden" && r.width >= 2 && r.height >= 2; };
  for (const { label, on, off } of pairs) {
    const a = document.querySelector(on), b = document.querySelector(off);
    if (!a || !b || !vis(a) || !vis(b)) { out.push({ label, missing: true }); continue; }
    const ia = K.identity(a), ib = K.identity(b);
    if (!ia || !ib) { out.push({ label, missing: true }); continue; }
    out.push({
      label,
      indicator: Math.round(K.worst(ia.color, ia.behind) * 100) / 100,
      betweenStates: Math.round(K.ratio(ia.color, ib.color) * 100) / 100,
      on: ia.via + " " + K.rgb(ia.color), off: ib.via + " " + K.rgb(ib.color),
      onBg: K.rgb(ia.behind[0]),
    });
  }
  return out;
};

const chromium = loadChromium();
const browser = await chromium.launch({ executablePath: EXE });

const REQUIRED_SELECTORS = [
  'button.navTab',                       // tab bar — identify + state
  '#welcomeOverlay .ageBtn',             // level cards — identify + state
  '.btn', 'button.close',                // buttons and icon-only closes
  'input', 'select', 'textarea',         // field boundaries
  '.pathSectionHeader',                  // pack accordions
  '.jvCarNav',                           // carousel arrows
];
const DECORATIVE_SELECTORS = ['.jvCarDot', '.packDot'];  // shape carries the state too

const results = { light: null, dark: null };

for (const theme of ["light", "dark"]) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: theme });
  const page = await ctx.newPage();
  page.on("pageerror", () => {});
  await page.goto(BASE, { waitUntil: "networkidle" }).catch(() => {});
  await page.waitForTimeout(1400);
  await page.evaluate((t) => {
    document.documentElement.classList.remove("theme--light", "theme--dark");
    document.documentElement.classList.add("theme--" + t);
  }, theme);
  await page.waitForTimeout(700);   // let the theme transition settle
  await page.addScriptTag({ content: KIT });

  const rows = { required: [], decorative: [], pairs: [], focus: [] };

  /* Welcome surface first — the level cards only exist here. */
  rows.required.push(...await page.evaluate(measure, REQUIRED_SELECTORS.join(",")));
  rows.pairs.push(...await page.evaluate(measurePairs, [
    { label: "level card selected vs unselected", on: "#welcomeOverlay .ageBtn.selected", off: "#welcomeOverlay .ageBtn:not(.selected)" },
  ]));

  /* Into the app. */
  await page.evaluate(() => [...document.querySelectorAll("#welcomeOverlay button.ageBtn")].find((b) => /some practice/i.test(b.textContent || ""))?.click());
  await page.waitForTimeout(250);
  await page.evaluate(() => document.getElementById("btnWelcomeStart")?.click());
  await page.waitForTimeout(1400);
  for (let i = 0; i < 5; i++) {
    if (!(await page.evaluate(() => document.body.classList.contains("modalOpen")))) break;
    await page.keyboard.press("Escape"); await page.waitForTimeout(400);
  }

  for (const [tab] of [["today"], ["browse"], ["modes"], ["profile"]]) {
    await page.evaluate((t) => document.querySelector(`.navTab[data-tab="${t}"]`)?.click(), tab);
    await page.waitForTimeout(800);
    if (tab === "browse") { await page.evaluate(() => document.querySelectorAll('.pathSectionHeader[aria-expanded="false"]').forEach((b) => b.click())); await page.waitForTimeout(600); }
    await page.addScriptTag({ content: KIT });
    rows.required.push(...await page.evaluate(measure, REQUIRED_SELECTORS.join(",")));
    rows.decorative.push(...await page.evaluate(measure, DECORATIVE_SELECTORS.join(",")));
  }

  rows.pairs.push(...await page.evaluate(measurePairs, [
    { label: "active tab vs inactive tab", on: ".navTab.active", off: ".navTab:not(.active)" },
  ]));

  /* Mission sheet: carousel arrows and the sheet's own controls. */
  await page.evaluate(() => document.querySelector(".navTab[data-tab='browse']")?.click());
  await page.waitForTimeout(600);
  await page.evaluate(() => document.querySelector('[data-mission-id="28"]')?.click());
  await page.waitForTimeout(900);
  await page.addScriptTag({ content: KIT });
  rows.required.push(...await page.evaluate(measure, REQUIRED_SELECTORS.join(",")));
  rows.decorative.push(...await page.evaluate(measure, DECORATIVE_SELECTORS.join(",")));

  /* Focus indicator, on more than one kind of surface: a ring that reads on a
     white card can vanish on the dark mission sheet, and vice versa. */
  await page.addScriptTag({ content: KIT });
  const focusRows = await page.evaluate(() => {
    const K = window.__nt;
    const targets = ["#btnStartTimer", "#btnToggleDone", ".navTab", ".sheetActions .btn", "#btnClose"];
    const out = [];
    for (const sel of targets) {
      const btn = document.querySelector(sel);
      if (!btn) continue;
      const r = btn.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      btn.focus();
      const cs = getComputedStyle(btn);
      const behind = K.behind(btn, true);
      const ow = parseFloat(cs.outlineWidth) || 0;
      const oc = K.toRGBA(cs.outlineColor);
      let ring = null, how = null;
      if (ow >= 1 && oc && oc.a > 0.05 && cs.outlineStyle !== "none") {
        const solid = oc.a >= 1 ? oc : K.over(oc, behind[0]);
        ring = K.worst(solid, behind); how = `outline ${Math.round(ow)}px ${K.rgb(solid)}`;
      }
      /* A halo drawn as box-shadow counts too; take the best of the two,
         because either one being visible is enough to see the focus. */
      const shadow = cs.boxShadow || "";
      const m = shadow.match(/rgba?\([^)]+\)/g) || [];
      for (const raw of m) {
        const c = K.toRGBA(raw);
        if (!c || c.a <= 0.05) continue;
        const solid = c.a >= 1 ? c : K.over(c, behind[0]);
        const rr = K.worst(solid, behind);
        if (ring === null || rr > ring) { ring = rr; how = `box-shadow ${K.rgb(solid)}`; }
      }
      btn.blur();
      out.push({ el: sel, ring: ring === null ? null : Math.round(ring * 100) / 100, how, bg: K.rgb(behind[0]) });
    }
    return out;
  });
  rows.focus.push(...focusRows);

  results[theme] = rows;
  await ctx.close();
}
await browser.close();

/* ── report ────────────────────────────────────────────────────────────── */
const dedupe = (rows) => { const m = new Map(); for (const r of rows) if (!m.has(r.el)) m.set(r.el, r); return [...m.values()]; };

let failures = 0;
console.log(`WCAG 2.2 SC 1.4.11 — non-text contrast (threshold ${THRESHOLD}:1)\n`);

for (const theme of ["light", "dark"]) {
  const r = results[theme];
  const all = dedupe(r.required);
  const dec = dedupe(r.decorative);
  /* Required: controls with no text of their own. Their icon/border/fill IS
     the only thing telling a user the control is there. */
  const required = all.filter((x) => !x.labelled && x.ratio !== null);
  const labelled = all.filter((x) => x.labelled && x.ratio !== null);
  const bad = required.filter((x) => x.ratio < THRESHOLD);
  const noteworthy = labelled.filter((x) => x.ratio < THRESHOLD);

  console.log(`── ${theme} ──`);
  console.log(`  identity, no text label   ${required.length} measured, ${bad.length} under ${THRESHOLD}:1`);
  for (const b of bad) console.log(`      ❌ ${b.ratio}:1  ${b.el}  (${b.via} on ${b.bg})`);
  console.log(`  identity, text-labelled   ${labelled.length} measured, ${noteworthy.length} with a faint edge — identified by their label, not a 1.4.11 failure`);
  for (const n of noteworthy.slice(0, 6)) console.log(`      · ${n.ratio}:1  ${n.el}  (${n.via} on ${n.bg})`);

  for (const p of r.pairs) {
    if (p.missing) { console.log(`  state indicator           · ${p.label}: one state not present here`); continue; }
    const ok = p.indicator >= THRESHOLD;
    if (!ok) failures++;
    console.log(`  state indicator           ${ok ? "✅" : "❌"} ${p.indicator}:1  ${p.label} — ${p.on} on ${p.onBg}`);
    const tellApart = p.betweenStates >= THRESHOLD;
    console.log(`                            ${tellApart ? "·" : "⚠"} ${p.betweenStates}:1 between the two states (${p.off} when off)${tellApart ? "" : " — passes 1.4.11, but the two are close; noted, not failed"}`);
  }

  for (const f of r.focus) {
    if (f.ring === null) { console.log(`  focus indicator           ❌ no outline or ring drawn on ${f.el}`); failures++; continue; }
    const ok = f.ring >= THRESHOLD;
    if (!ok) failures++;
    console.log(`  focus indicator           ${ok ? "✅" : "❌"} ${f.ring}:1  ${f.el}  (${f.how} on ${f.bg})`);
  }

  const decBad = dec.filter((x) => x.ratio !== null && x.ratio < THRESHOLD);
  console.log(`  decorative (not 1.4.11)   ${dec.length} measured, ${decBad.length} under ${THRESHOLD}:1 — reported, not failed`);
  for (const d of decBad) console.log(`      · ${d.ratio}:1  ${d.el}  (${d.via} on ${d.bg})`);
  failures += bad.length;
  console.log("");
}

if (failures) { console.log(`❌ ${failures} required non-text indicator(s) under ${THRESHOLD}:1.`); process.exit(1); }
console.log(`✅ Every required component boundary, state difference and focus ring is at least ${THRESHOLD}:1.`);

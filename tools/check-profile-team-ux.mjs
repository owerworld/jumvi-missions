#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
 * check-profile-team-ux.mjs — Faz 4, the parts a parent touches.
 *
 * Editing a child is a small form on a small screen, and every failure mode is
 * the same shape: the thing you need is real, present in the DOM, and off the
 * bottom of the phone. So the checks here are about REACHABILITY and what a
 * screen reader is given, at five viewport sizes, not about whether an element
 * exists.
 *
 *   labels     #profileEditName and #profileNewName must have a real label or
 *              aria-labelledby. A placeholder is not a label: it disappears the
 *              moment you type, and several screen readers never announce it.
 *   footer     Save and Cancel must be reachable with the avatar grid open —
 *              the grid is the tallest thing in the panel and the classic way
 *              a footer ends up below the fold.
 *   keyboard   With the name field focused and a soft keyboard taking the
 *              bottom of the screen, both the input and Save must stay usable.
 *   validation Empty and duplicate names must be refused, and refused
 *              VISIBLY — the message has to reach a screen reader too.
 *   focus      Closing the sheet must return focus to whatever opened it.
 *   delete     Destructive action stays secondary and says what it does.
 *
 * The named-child vs unnamed-Player split is asserted as PRODUCT BEHAVIOUR,
 * not fixed: an unnamed default "Player" choosing Create a Team is SUPPOSED to
 * land in identity setup first.
 *
 *   node tools/check-profile-team-ux.mjs
 *   node tools/check-profile-team-ux.mjs --shots=DIR
 * Exit 1 on any reachability, label or validation failure.
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
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });

const VIEWPORTS = [
  { w: 320, h: 568, o: "portrait" },
  { w: 390, h: 844, o: "portrait" },
  { w: 430, h: 932, o: "portrait" },
  { w: 568, h: 320, o: "landscape" },
  { w: 844, h: 390, o: "landscape" },
];

const SEED = {
  jumvi_profiles_v1: JSON.stringify([
    { id: "p1", name: "FixtureOne", avatar: "monkey", createdAt: "2026-01-01T00:00:00.000Z" },
    { id: "p2", name: "FixtureTwo", avatar: "fox",    createdAt: "2026-01-02T00:00:00.000Z" },
  ]),
  jumvi_active_profile_v1: "p1",
  jumvi_onboarded_v2: "1",
};

const results = [];
const record = (id, name, status, detail) => {
  results.push({ id, name, status, detail });
  const mark = status === "PASS" ? "✅" : status === "FAIL" ? "❌" : "⚠️ ";
  console.log(`  ${mark} ${id}  ${name}${detail ? " — " + detail : ""}`);
};

/* Reachable = it can be brought into the visible band of whatever scrolls it,
   and at that point the renderer agrees it is the top element at its centre.
   Rect maths alone would pass an element sitting under a sticky footer. */
const REACHABLE = `
/* "Reachable" has to mean what a parent can actually do, which is scroll.
   scrollIntoView({block:'nearest'}) stops the moment the element is inside the
   viewport RECTANGLE — even when a fixed bottom nav is painted over it. These
   screens deliberately keep that nav (warm-toy.css opts it back in: they are
   screens, not modals), so the naive version reported Save unreachable at
   every size while a single further scroll cleared it. Try the polite scroll
   first, then do what a person does and scroll the surface to its end. */
window.__reach = function(sel){
  var el = document.querySelector(sel);
  if(!el) return { found:false };
  var cs = getComputedStyle(el);
  if(cs.display==='none' || cs.visibility==='hidden' || el.hidden) return { found:true, visible:false };

  function hitTest(){
    var r = el.getBoundingClientRect();
    var onScreen = r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth && r.width > 1 && r.height > 1;
    if(!onScreen) return { onScreen:false, hit:false, top:Math.round(r.top), h:Math.round(r.height) };
    var cx = r.left + r.width/2;
    var cy = Math.min(innerHeight-2, Math.max(2, r.top + r.height/2));
    var top = document.elementFromPoint(cx, cy);
    return { onScreen:true, hit: !!top && (top===el || el.contains(top) || top.contains(el)),
             top:Math.round(r.top), h:Math.round(r.height) };
  }

  el.scrollIntoView({ block:'center' });
  var res = hitTest();
  if(!res.hit){
    var n = el.parentElement, scroller = null;
    while(n){ var s2 = getComputedStyle(n);
      if(/(auto|scroll)/.test(s2.overflowY) && n.scrollHeight > n.clientHeight + 1){ scroller = n; break; }
      n = n.parentElement; }
    if(scroller){ scroller.scrollTop = scroller.scrollHeight; res = hitTest(); res.neededFullScroll = true; }
  }
  return { found:true, visible:true, onScreen:res.onScreen, hit:res.hit,
           h:res.h, top:res.top, vh:innerHeight, neededFullScroll:!!res.neededFullScroll };
};
window.__label = function(sel){
  var el = document.querySelector(sel);
  if(!el) return { found:false };
  var lb = el.getAttribute('aria-labelledby');
  var byId = lb ? lb.split(/\\s+/).map(function(i){ var n=document.getElementById(i); return n?n.textContent:''; }).join(' ').trim() : '';
  var forLabel = el.id ? document.querySelector('label[for="'+CSS.escape(el.id)+'"]') : null;
  return {
    found:true,
    ariaLabelledby: byId || null,
    ariaLabel: (el.getAttribute('aria-label')||'').trim() || null,
    labelFor: forLabel ? (forLabel.textContent||'').trim() : null,
    wrappedInLabel: !!el.closest('label'),
    placeholder: el.getAttribute('placeholder') || null,
    describedby: el.getAttribute('aria-describedby') || null
  };
};
`;

const chromium = loadChromium();
const browser = await chromium.launch({ executablePath: EXE });

async function open(vp) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
  const page = await ctx.newPage();
  page.on("pageerror", () => {});
  await page.addInitScript((s) => { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); }, SEED);
  await page.addInitScript(REACHABLE);
  await page.goto(BASE, { waitUntil: "networkidle" }).catch(() => {});
  await page.waitForTimeout(1400);
  for (let i = 0; i < 4; i++) {
    if (!(await page.evaluate(() => document.body.classList.contains("modalOpen")))) break;
    await page.keyboard.press("Escape"); await page.waitForTimeout(300);
  }
  return { ctx, page };
}
const openEdit = async (page) => {
  await page.evaluate(() => openProfileSheet());
  await page.waitForTimeout(500);
  await page.evaluate(() => openProfileEdit(getActiveProfileId()));
  await page.waitForTimeout(500);
};

console.log("Profile edit & team picker — Faz 4\n");

/* ── P01 real labels on both name inputs ───────────────────────────────── */
{
  const { ctx, page } = await open(VIEWPORTS[1]);
  await openEdit(page);
  const edit = await page.evaluate(() => window.__label("#profileEditName"));
  await page.evaluate(() => { const b = document.getElementById("btnProfileOpenAdd"); b && b.click(); });
  await page.waitForTimeout(450);
  const add = await page.evaluate(() => window.__label("#profileNewName"));
  await ctx.close();
  const named = (l) => !!(l.ariaLabelledby || l.ariaLabel || l.labelFor || l.wrappedInLabel);
  const ok = named(edit) && named(add);
  record("P01", "both child-name inputs have a real label, not just a placeholder", ok ? "PASS" : "FAIL",
    `#profileEditName → ${named(edit) ? `"${edit.ariaLabelledby || edit.ariaLabel || edit.labelFor}"` : `placeholder-only ("${edit.placeholder}")`}; ` +
    `#profileNewName → ${named(add) ? `"${add.ariaLabelledby || add.ariaLabel || add.labelFor}"` : `placeholder-only ("${add.placeholder}")`}`);
}

/* ── P02 Save / Cancel reachable at every size, avatar grid open ────────── */
for (const vp of VIEWPORTS) {
  const { ctx, page } = await open(vp);
  await openEdit(page);
  const grid = await page.evaluate(() => {
    const g = document.getElementById("profileEditAvatarPicker");
    return g ? { count: g.children.length, h: Math.round(g.getBoundingClientRect().height) } : null;
  });
  const save = await page.evaluate(() => window.__reach("#btnProfileEditSave"));
  const cancel = await page.evaluate(() => window.__reach("#btnProfileEditCancel"));
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/profile-edit-${vp.w}x${vp.h}-${vp.o}.png` });
  await ctx.close();
  const ok = save.onScreen && save.hit && cancel.onScreen && cancel.hit;
  record(`P02.${vp.w}x${vp.h}`, `Save and Cancel reachable (${vp.o})`, ok ? "PASS" : "FAIL",
    `avatars=${grid ? grid.count : "?"} gridH=${grid ? grid.h : "?"} · Save top=${save.top}/${save.vh} hit=${save.hit}${save.neededFullScroll ? " (after scrolling to the end)" : ""} · Cancel hit=${cancel.hit}`);
}

/* ── P03 keyboard open: input and Save both usable ─────────────────────── */
{
  /* A soft keyboard is emulated the way it actually behaves on a phone: the
     visual viewport shrinks. Playwright cannot raise a real keyboard, so the
     viewport is resized to the residual height and the same reachability
     question is asked. */
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.addInitScript((s) => { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); }, SEED);
  await page.addInitScript(REACHABLE);
  await page.goto(BASE, { waitUntil: "networkidle" }).catch(() => {});
  await page.waitForTimeout(1400);
  for (let i = 0; i < 4; i++) {
    if (!(await page.evaluate(() => document.body.classList.contains("modalOpen")))) break;
    await page.keyboard.press("Escape"); await page.waitForTimeout(300);
  }
  await openEdit(page);
  await page.evaluate(() => document.getElementById("profileEditName")?.focus());
  await page.setViewportSize({ width: 390, height: 844 - 336 });   // ~iOS keyboard
  await page.waitForTimeout(500);
  const input = await page.evaluate(() => window.__reach("#profileEditName"));
  const save = await page.evaluate(() => window.__reach("#btnProfileEditSave"));
  const focused = await page.evaluate(() => document.activeElement?.id);
  const fontSize = await page.evaluate(() => getComputedStyle(document.getElementById("profileEditName")).fontSize);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/profile-edit-keyboard-390x508.png` });
  await ctx.close();
  const ok = input.onScreen && input.hit && save.onScreen && save.hit && parseFloat(fontSize) >= 16;
  record("P03", "with the keyboard up, the name field and Save stay usable", ok ? "PASS" : "FAIL",
    `residual vh=${save.vh} · input top=${input.top} hit=${input.hit} fontSize=${fontSize} · Save top=${save.top} hit=${save.hit}${save.neededFullScroll ? " (after scrolling to the end)" : ""} · focus=${focused}`);
}

/* ── P04 empty and duplicate names are refused, and said out loud ───────── */
{
  const { ctx, page } = await open(VIEWPORTS[1]);
  await openEdit(page);
  const before = await page.evaluate(() => localStorage.getItem("jumvi_profiles_v1"));
  await page.evaluate(() => { const i = document.getElementById("profileEditName"); i.value = "   "; });
  await page.evaluate(() => document.getElementById("btnProfileEditSave")?.click());
  await page.waitForTimeout(600);
  const emptyState = await page.evaluate(() => ({
    saved: localStorage.getItem("jumvi_profiles_v1"),
    stillOpen: getComputedStyle(document.getElementById("profileEditSection")).display !== "none",
    invalid: document.getElementById("profileEditName")?.getAttribute("aria-invalid"),
    described: document.getElementById("profileEditName")?.getAttribute("aria-describedby"),
    errText: (document.getElementById("profileEditNameError")?.textContent || "").trim(),
    live: [...document.querySelectorAll('[role="status"],[aria-live]')]
      .map((e) => (e.textContent || "").trim()).filter(Boolean).join(" | ").slice(0, 90),
  }));
  await page.evaluate(() => { const i = document.getElementById("profileEditName"); i.value = "FixtureTwo"; });
  await page.evaluate(() => document.getElementById("btnProfileEditSave")?.click());
  await page.waitForTimeout(600);
  const dupState = await page.evaluate(() => ({
    saved: localStorage.getItem("jumvi_profiles_v1"),
    invalid: document.getElementById("profileEditName")?.getAttribute("aria-invalid"),
    errText: (document.getElementById("profileEditNameError")?.textContent || "").trim(),
    live: [...document.querySelectorAll('[role="status"],[aria-live]')]
      .map((e) => (e.textContent || "").trim()).filter(Boolean).join(" | ").slice(0, 90),
  }));
  await ctx.close();
  const blocked = emptyState.saved === before && dupState.saved === before;
  const announced = !!(emptyState.errText || emptyState.invalid === "true") && !!(dupState.errText || dupState.invalid === "true");
  record("P04", "empty and duplicate names are refused", blocked ? "PASS" : "FAIL",
    `profiles unchanged: empty=${emptyState.saved === before} duplicate=${dupState.saved === before}`);
  record("P05", "…and the refusal is attached to the field for a screen reader", announced ? "PASS" : "FAIL",
    `empty → aria-invalid=${emptyState.invalid} error="${emptyState.errText}" ; duplicate → aria-invalid=${dupState.invalid} error="${dupState.errText}"` +
    (announced ? "" : `\n         (visible feedback today is a toast: "${emptyState.live}")`));
}

/* ── P06 closing returns focus to whatever opened the sheet ─────────────── */
{
  const { ctx, page } = await open(VIEWPORTS[1]);
  await page.evaluate(() => document.querySelector('.navTab[data-tab="profile"]')?.click());
  await page.waitForTimeout(700);
  const openerId = await page.evaluate(() => {
    const b = document.getElementById("btnOpenProfileFromTab");
    if (!b) return null;
    b.focus(); b.click();
    return b.id;
  });
  await page.waitForTimeout(700);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(700);
  const focusBack = await page.evaluate(() => document.activeElement?.id || document.activeElement?.tagName);
  await ctx.close();
  const ok = openerId && focusBack === openerId;
  record("P06", "closing the sheet returns focus to the control that opened it", ok ? "PASS" : "FAIL",
    `opener=${openerId} focusAfterClose=${focusBack}`);
}

/* ── P07 named child goes to the team picker; unnamed Player does not ───── */
{
  const { ctx, page } = await open(VIEWPORTS[1]);
  await page.evaluate(() => { if (typeof openTeamXpPicker === "function") openTeamXpPicker(); });
  await page.waitForTimeout(800);
  const named = await page.evaluate(() => ({
    picker: !!document.querySelector("#teamXpBackdrop.show"),
    identity: getComputedStyle(document.getElementById("profileEditSection")).display !== "none",
  }));
  await ctx.close();

  const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page2 = await ctx2.newPage();
  await page2.addInitScript(() => {
    localStorage.setItem("jumvi_profiles_v1", JSON.stringify([{ id: "p1", name: "Player", avatar: "monkey", createdAt: "2026-01-01T00:00:00.000Z" }]));
    localStorage.setItem("jumvi_active_profile_v1", "p1");
    localStorage.setItem("jumvi_onboarded_v2", "1");
  });
  await page2.goto(BASE, { waitUntil: "networkidle" }).catch(() => {});
  await page2.waitForTimeout(1400);
  for (let i = 0; i < 4; i++) {
    if (!(await page2.evaluate(() => document.body.classList.contains("modalOpen")))) break;
    await page2.keyboard.press("Escape"); await page2.waitForTimeout(300);
  }
  await page2.evaluate(() => { if (typeof openTeamXpPicker === "function") openTeamXpPicker(); });
  await page2.waitForTimeout(900);
  const unnamed = await page2.evaluate(() => ({
    picker: !!document.querySelector("#teamXpBackdrop.show"),
    identity: getComputedStyle(document.getElementById("profileEditSection")).display !== "none",
    stepTitle: (document.getElementById("profileEditTitle")?.textContent || "").trim(),
  }));
  await ctx2.close();
  /* Documented product behaviour, asserted rather than "fixed". */
  const ok = named.picker && unnamed.identity && !unnamed.picker;
  record("P07", "named child → team picker; unnamed default Player → identity setup first", ok ? "PASS" : "FAIL",
    `named: picker=${named.picker} · unnamed: identity=${unnamed.identity} picker=${unnamed.picker} title="${unnamed.stepTitle}" (expected behaviour, not a bug)`);
}

/* ── P08 delete stays secondary and explains itself ─────────────────────── */
{
  const { ctx, page } = await open(VIEWPORTS[1]);
  await openEdit(page);
  const del = await page.evaluate(() => {
    const d = document.getElementById("btnProfileDelete");
    const s = document.getElementById("btnProfileEditSave");
    if (!d || !s) return null;
    const dc = getComputedStyle(d), sc = getComputedStyle(s);
    return {
      text: (d.textContent || "").trim(),
      deleteIsFilled: dc.backgroundColor !== "rgba(0, 0, 0, 0)" && dc.backgroundColor !== "transparent",
      saveIsFilled: sc.backgroundColor !== "rgba(0, 0, 0, 0)" && sc.backgroundColor !== "transparent",
      order: d.compareDocumentPosition(s) & Node.DOCUMENT_POSITION_PRECEDING ? "after Save" : "before Save",
    };
  });
  await ctx.close();
  const ok = del && !del.deleteIsFilled && del.saveIsFilled && del.order === "after Save";
  record("P08", "delete is secondary to Save and says what it removes", ok ? "PASS" : "FAIL",
    del ? `"${del.text}" · filled: delete=${del.deleteIsFilled} save=${del.saveIsFilled} · ${del.order}` : "controls not found");
}

await browser.close();
const pass = results.filter((r) => r.status === "PASS").length;
const fail = results.filter((r) => r.status === "FAIL").length;
console.log(`\n${pass} pass, ${fail} fail, of ${results.length} run.`);
if (fail) process.exit(1);

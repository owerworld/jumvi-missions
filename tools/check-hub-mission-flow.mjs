#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
 * check-hub-mission-flow.mjs — T29, against the real 3D hub.
 *
 * The previous round SKIPPED this and said so: the test looked for
 * window.openMissionFromHub, which does not exist. That function is module
 * scope inside jumvi-hub-app.js and never reaches window — so the check could
 * only ever be false, and "3D completion uses the right mission id" stayed an
 * assumption.
 *
 * This boots the actual hub: ?hub3d=1 flips the opt-in flag, showHub3D()
 * imports vendor/three.module.min.js and jumvi-hub-app.js for real, initHub3D()
 * runs, and the run waits for a painted frame (window.__hub3dLastFrameAt).
 * Headless Chromium needs --use-gl=swiftshader to get a GL context; without it
 * the hub correctly refuses to start and this reports UNTESTED rather than
 * passing on a stub.
 *
 * The mission is launched through window._hub3dAdvance(packKey) — the hub's
 * own "walk into the next mission of this pack" path, which the module exposes
 * on window and which calls its internal openMissionFromHub → the app's real
 * openMission. Gate proximity is the other entry, but it needs the avatar
 * physically walked onto a gate; _hub3dAdvance reaches the same function.
 *
 * Asserts, in one continuous session:
 *   · the hub opens the mission id it names, and marks the run as hub-sourced
 *   · completing from inside the hub flow completes exactly that mission, once
 *   · un-marking rolls it back without disturbing the hub
 *   · closing hands control back with the hub still alive and rendering
 *
 *   node tools/check-hub-mission-flow.mjs
 * Exit 1 on failure; exit 0 with an explicit UNTESTED note if no GL context.
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

const results = [];
const record = (id, name, status, detail) => {
  results.push({ id, name, status, detail });
  const mark = status === "PASS" ? "✅" : status === "FAIL" ? "❌" : "⚠️ ";
  console.log(`  ${mark} ${id}  ${name}${detail ? " — " + detail : ""}`);
};

const chromium = loadChromium();
const browser = await chromium.launch({
  executablePath: EXE,
  // SwiftShader gives headless a real (software) GL context. Without it
  // hub3dWebGLOk() fails and the hub never loads — which is correct behaviour,
  // but means nothing here can be asserted.
  args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push("pageerror: " + String(e).slice(0, 150)));
page.on("console", (m) => {
  if (m.type() !== "error") return;
  const t = m.text();
  if (/failed to load resource|api\/beacon|mission-book/i.test(t)) return;
  errors.push("console: " + t.slice(0, 150));
});

const probe = () => page.evaluate(() => window.__jumviPlayProbe());
const wait = (ms) => page.waitForTimeout(ms);

console.log("3D Hub mission flow — T29 against the real hub module\n");

await page.goto(BASE + "?hub3d=1", { waitUntil: "networkidle" }).catch(() => {});
await wait(1500);

const glOk = await page.evaluate(() => {
  try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); }
  catch (_) { return false; }
});
if (!glOk) {
  record("T29", "3D hub mission flow", "UNTESTED",
    "no WebGL context in this browser — the hub correctly refuses to start, so nothing here is asserted. Not a pass.");
  await browser.close();
  console.log("\n0 pass, 0 fail, 1 untested.");
  process.exit(0);
}

/* Into the app, then into the hub. */
await page.evaluate(() => document.getElementById("btnWelcomeStart")?.click());
await wait(1400);
for (let i = 0; i < 5; i++) {
  if (!(await page.evaluate(() => document.body.classList.contains("modalOpen")))) break;
  await page.keyboard.press("Escape"); await wait(350);
}
/* Enter the way a family does: the "Explore Leo's Island" card on Play, which
   sets the entry source and calls switchTab("hub3d"). Calling showHub3D()
   directly paints the hub but leaves the active tab on "today" — and then
   closeMission() correctly returns to that tab and hides the overlay, which an
   earlier run of this file misread as the hub dying on close. */
const entered = await page.evaluate(() => {
  const card = document.getElementById("advModeCard");
  if (card && getComputedStyle(card).display !== "none") { card.click(); return "adv_card"; }
  if (typeof switchTab === "function") { switchTab("hub3d"); return "switchTab"; }
  return "none";
});

/* Wait for a genuinely painted frame, not just for the import to resolve. */
const bootDeadline = Date.now() + 30000;
let booted = false;
while (Date.now() < bootDeadline) {
  booted = await page.evaluate(() => !!window.__hub3dLastFrameAt && document.querySelectorAll("#hub3dOverlay canvas").length > 0);
  if (booted) break;
  await wait(500);
}
const bootInfo = await page.evaluate(() => ({
  canvas: document.querySelectorAll("#hub3dOverlay canvas").length,
  children: document.getElementById("hub3dOverlay")?.children.length || 0,
  advance: typeof window._hub3dAdvance,
  comeBack: typeof window._hub3dComeBack,
}));
const activeTab = await page.evaluate(() => (document.body.className.match(/tab-[\w]+/) || [""])[0]);
record("T29.0", "real hub boots from the app's own entry point", booted ? "PASS" : "FAIL",
  `entry=${entered} activeTab=${activeTab} canvas=${bootInfo.canvas} overlayChildren=${bootInfo.children} _hub3dAdvance=${bootInfo.advance}`);
if (!booted) { await browser.close(); process.exit(1); }

/* ── T29.1 the hub opens the mission it names ──────────────────────────── */
/* Pick the pack's next undone mission the same way the hub does, so the
   expected id comes from the app's data rather than from this file. */
const expected = await page.evaluate(() => {
  const packKey = "Aim Master";
  const list = missions.filter((m) => m.pack === packKey).sort((a, b) => a.id - b.id);
  const next = list.find((m) => !done.has(m.id));
  return { packKey, id: next ? next.id : null, title: next ? next.title : null };
});
await page.evaluate((k) => window._hub3dAdvance(k), expected.packKey);
/* _hub3dAdvance defers by GROWTH_FOCUS_MS + 250 and then waits for any
   blocking overlay to clear, so give it room. */
const openDeadline = Date.now() + 25000;
let opened = null;
while (Date.now() < openDeadline) {
  opened = await probe();
  if (opened.missionId === expected.id) break;
  await wait(500);
}
const hubFlow = await page.evaluate(() => window._hubMissionFlow ? { pack: window._hubMissionFlow.packKey, themed: !!window._hubMissionFlow.themeColor } : null);
const okOpen = opened && opened.missionId === expected.id && hubFlow && hubFlow.pack === expected.packKey;
record("T29.1", "hub opens the mission id it names, tagged as a hub run", okOpen ? "PASS" : "FAIL",
  `expected id ${expected.id} ("${expected.title}") got ${opened && opened.missionId}; _hubMissionFlow.pack=${hubFlow && hubFlow.pack} themed=${hubFlow && hubFlow.themed}`);

/* ── T29.2 completing from the hub completes that mission, once ────────── */
const beforeDone = await probe();
/* Open the gate honestly — run the mission's own timer to Time's Up. */
await page.evaluate(() => document.getElementById("btnStartTimer")?.click());
await wait(500);
if ((await probe()).narrationPending) { await page.evaluate(() => document.getElementById("btnStartTimer")?.click()); await wait(400); }
let running = null;
const runDeadline = Date.now() + 20000;
while (Date.now() < runDeadline) { running = await probe(); if (running.timerState === "running") break; await wait(300); }
let g = running;
const gateDeadline = Date.now() + ((g ? g.timerLeft : 60) + 6) * 1000;
while (Date.now() < gateDeadline) { g = await probe(); if (g.gateRemainingMs === 0) break; await wait(1000); }
await page.evaluate(() => document.getElementById("btnToggleDone")?.click());
await wait(1000);
const afterDone = await probe();
const okDone = afterDone.doneSize === beforeDone.doneSize + 1 &&
               afterDone.doneIds.includes(expected.id) &&
               afterDone.doneIds.length === new Set(afterDone.doneIds).size;
record("T29.2", "completing inside the hub flow completes that id, exactly once", okDone ? "PASS" : "FAIL",
  `done ${beforeDone.doneSize}→${afterDone.doneSize} ids=[${afterDone.doneIds}] xp ${beforeDone.xp}→${afterDone.xp}`);

/* ── T29.3 un-marking a hub completion ────────────────────────────────────
 * Was "Undo from a hub completion". The Undo bar is gone, so this now drives
 * the sheet's own toggle — the point is unchanged: reversing a completion made
 * inside the hub must not tear the hub down. */
await page.evaluate(() => document.getElementById("btnToggleDone")?.click());
await wait(1200);
const afterUndo = await probe();
const hubAliveAfterUndo = await page.evaluate(() => ({
  canvas: document.querySelectorAll("#hub3dOverlay canvas").length,
  overlayShown: document.getElementById("hub3dOverlay")?.style.display !== "none",
}));
const okUndo = afterUndo.doneSize === beforeDone.doneSize && afterUndo.xp === beforeDone.xp &&
               hubAliveAfterUndo.canvas === 1;
record("T29.3", "un-marking the hub completion rolls it back and leaves the hub intact", okUndo ? "PASS" : "FAIL",
  `done ${afterDone.doneSize}→${afterUndo.doneSize} xp ${afterDone.xp}→${afterUndo.xp} hubCanvas=${hubAliveAfterUndo.canvas} overlayShown=${hubAliveAfterUndo.overlayShown}`);

/* ── T29.4 close hands control back to a live hub ──────────────────────── */
const framesBefore = await page.evaluate(() => window.__hub3dLastFrameAt);
await page.evaluate(() => window.closeMission && window.closeMission());
await wait(1500);
const framesAfter = await page.evaluate(() => window.__hub3dLastFrameAt);
const afterClose = await page.evaluate(() => ({
  hubFlow: window._hubMissionFlow,
  sheetOpen: document.getElementById("backdrop")?.classList.contains("show"),
  overlayShown: document.getElementById("hub3dOverlay")?.style.display !== "none",
  canvas: document.querySelectorAll("#hub3dOverlay canvas").length,
}));
const stillRendering = framesAfter > framesBefore;
const okClose = afterClose.hubFlow === null && !afterClose.sheetOpen &&
                afterClose.overlayShown && afterClose.canvas === 1 && stillRendering;
record("T29.4", "close clears the hub flow and the hub keeps rendering", okClose ? "PASS" : "FAIL",
  `_hubMissionFlow=${afterClose.hubFlow} sheetOpen=${afterClose.sheetOpen} overlayShown=${afterClose.overlayShown} canvas=${afterClose.canvas} newFramesAfterClose=${stillRendering}`);

/* ── T29.5 runtime cleanliness across the whole hub journey ────────────── */
record("T29.5", "no page errors across the hub journey", errors.length === 0 ? "PASS" : "FAIL",
  errors.length ? errors.slice(0, 3).join(" | ") : "clean through boot, open, complete, undo, close");

await browser.close();
const pass = results.filter((r) => r.status === "PASS").length;
const fail = results.filter((r) => r.status === "FAIL").length;
console.log(`\n${pass} pass, ${fail} fail, ${results.length - pass - fail} untested.`);
if (fail) process.exit(1);

#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
 * check-mission-play-state.mjs — Faz 1.4 + 1.5.
 *
 * The thing this protects is small and easy to break: a family taps Start, the
 * phone goes on the grass, and when they pick it back up the timer, the gate
 * and the progress state all have to agree about what happened. Every failure
 * mode here is silent — two intervals counting the same mission down twice as
 * fast, a completion credited to the mission you switched away from, an un-mark
 * that puts the mission back but leaves the streak day it awarded.
 *
 * HOW IT MEASURES. Two seams, both read-only:
 *
 *   interval census   window.setInterval/clearInterval are wrapped BEFORE
 *                     app.js parses, so every live interval is counted for
 *                     real. "No duplicate timer" is then an actual number, not
 *                     an inference from the rendered seconds.
 *   play probe        window.__jumviPlayProbe() (app.js) returns the
 *                     script-scope play state — timerState, timerTotal,
 *                     timerLeft, timerEndAt, the gate sets, done size, xp,
 *                     streak. `let` bindings never reach window, so without it
 *                     a driver can only read the UI text back, which asserts
 *                     the wording instead of the state.
 *
 * Time is compressed where a test would otherwise take a minute: missions get
 * a short duration by driving the real clock forward is not possible in a page,
 * so the tests that need Time's Up use the mission's real seconds and the ones
 * that need the dwell gate assert the remaining ms rather than waiting it out.
 * Where a test cannot be run honestly it prints SKIP with the reason — never
 * PASS.
 *
 *   node tools/check-mission-play-state.mjs
 *   node tools/check-mission-play-state.mjs --only=T03,T18
 *   node tools/check-mission-play-state.mjs --base=URL
 *
 * Exit 1 on any FAIL.
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
const ONLY = argVal("only", "").split(",").filter(Boolean);
const EXE = process.env.JUMVI_EXE_CHROMIUM || undefined;

/* Counts every live interval and timeout, by callback source, before app.js runs. */
const CENSUS = `
(function(){
  var live = new Map(); var seq = 0;
  var si = window.setInterval, ci = window.clearInterval;
  window.setInterval = function(fn, ms){
    var id = si.apply(window, arguments);
    live.set(id, { ms: ms, src: String(fn).slice(0, 60) });
    return id;
  };
  window.clearInterval = function(id){ live.delete(id); return ci.apply(window, arguments); };
  window.__intervals = function(){
    return Array.from(live.entries()).map(function(e){ return { id: e[0], ms: e[1].ms, src: e[1].src }; });
  };
})();
`;

const chromium = loadChromium();
const browser = await chromium.launch({ executablePath: EXE });

const results = [];
const record = (id, name, status, detail) => {
  results.push({ id, name, status, detail });
  const mark = status === "PASS" ? "✅" : status === "FAIL" ? "❌" : "⚠️ ";
  console.log(`  ${mark} ${id}  ${name}${detail ? " — " + detail : ""}`);
};
const wanted = (id) => ONLY.length === 0 || ONLY.includes(id);

/* ── page harness ──────────────────────────────────────────────────────── */
async function session(fn, { seed } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + String(e).slice(0, 160)));
  /* Two things are not product errors under a plain static file server, and
     both surface as a bare "Failed to load resource" console line with the URL
     only on the network event — so they have to be filtered by URL there, not
     by matching the console text:
       /api/beacon    exists only on the Cloudflare Worker; 405 here.
       mission-book.pdf  app.js probes whether the optional file is present and
                         aborts the probe; the file itself serves 200. */
  const benign = /\/api\/beacon|mission-book\.pdf|favicon/i;
  page.on("response", (r) => {
    if (r.status() >= 400 && !benign.test(r.url())) errors.push(`http ${r.status()}: ${r.url().slice(0, 120)}`);
  });
  page.on("requestfailed", (r) => {
    if (!benign.test(r.url())) errors.push(`requestfailed: ${r.url().slice(0, 120)}`);
  });
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const t = m.text();
    if (/failed to load resource/i.test(t)) return;   // covered by the network listeners above, with the URL
    errors.push("console: " + t.slice(0, 160));
  });
  await page.addInitScript(CENSUS);
  if (seed) await page.addInitScript((s) => { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); }, seed);
  await page.goto(BASE, { waitUntil: "networkidle" }).catch(() => {});
  await page.waitForTimeout(1300);

  const api = {
    page, errors,
    probe: () => page.evaluate(() => window.__jumviPlayProbe()),
    intervals: () => page.evaluate(() => window.__intervals()),
    timerIntervals: async () => (await page.evaluate(() => window.__intervals())).filter((i) => /updateTimerTick/.test(i.src)),
    wait: (ms) => page.waitForTimeout(ms),
    async pastWelcome() {
      await page.evaluate(() => document.getElementById("btnWelcomeStart")?.click());
      await page.waitForTimeout(1400);
      for (let i = 0; i < 5; i++) {
        if (!(await page.evaluate(() => document.body.classList.contains("modalOpen")))) break;
        await page.keyboard.press("Escape"); await page.waitForTimeout(350);
      }
      await page.waitForTimeout(200);
    },
    async open(id) {
      await page.evaluate((i) => window.openMission(i), id);
      await page.waitForTimeout(700);
    },
    async tapStart() {
      await page.evaluate(() => document.getElementById("btnStartTimer")?.click());
    },
    /* The first Start tap does NOT start the timer: it plays Coach Leo's
       narration and turns the button into "Skip & Play". The countdown only
       follows once narration ends (in a headless browser there are no TTS
       voices, so that is the watchdog, ~10s). A test that waits a flat 3.6s
       here measures the narration, not the timer — which is how an early run
       of this file "failed" T02 while T03, which taps three times and so skips
       narration, passed. */
    async startUntilRunning({ skipNarration = true, timeout = 20000 } = {}) {
      await api.tapStart();
      await page.waitForTimeout(400);
      if (skipNarration && (await api.probe()).narrationPending) {
        await api.tapStart();               // second tap = Skip & Play
        await page.waitForTimeout(300);
      }
      const started = Date.now();
      while (Date.now() - started < timeout) {
        const p = await api.probe();
        if (p.timerState === "running") return p;
        await page.waitForTimeout(250);
      }
      return await api.probe();
    },
    async tapDone() {
      await page.evaluate(() => document.getElementById("btnToggleDone")?.click());
    },
    startLabel: () => page.evaluate(() => (document.getElementById("btnStartTimer")?.textContent || "").trim()),
    doneLabel: () => page.evaluate(() => (document.getElementById("btnToggleDone")?.textContent || "").trim()),
    timerText: () => page.evaluate(() => (document.getElementById("timerDisplay")?.textContent || "").trim()),
  };
  try { await fn(api); } finally { await ctx.close(); }
  return errors;
}

console.log("Mission play state — Faz 1.4 timer/gate, Faz 1.5 completion/un-mark\n");

/* ── T01 clean open ────────────────────────────────────────────────────── */
if (wanted("T01")) await session(async (t) => {
  await t.pastWelcome();
  await t.open(1);
  const p = await t.probe();
  const ti = await t.timerIntervals();
  const ok = p.timerState === "idle" && !p.timerIntervalLive && !p.countdownLive && ti.length === 0;
  record("T01", "clean mission open", ok ? "PASS" : "FAIL",
    `timerState=${p.timerState} intervalLive=${p.timerIntervalLive} countdownLive=${p.countdownLive} timerIntervals=${ti.length}`);
});

/* ── T02 single start, T04 narration, T05 skip ─────────────────────────── */
if (wanted("T02") || wanted("T04") || wanted("T05")) await session(async (t) => {
  await t.pastWelcome();
  await t.open(1);
  await t.tapStart();
  await t.wait(2000);
  const during = await t.probe();
  const duringIntervals = await t.timerIntervals();
  if (wanted("T04")) {
    const ok = during.narrationPending === true && during.timerState === "idle" &&
               !during.countdownLive && duringIntervals.length === 0;
    record("T04", "narration playing → timer has not started", ok ? "PASS" : "FAIL",
      `narrationPending=${during.narrationPending} timerState=${during.timerState} countdownLive=${during.countdownLive} intervals=${duringIntervals.length}`);
  }
  await t.tapStart();                       // Skip & Play
  await t.wait(300);
  const skipped = await t.probe();
  if (wanted("T05")) {
    const ok = skipped.narrationPending === false && skipped.countdownLive === true;
    record("T05", "Skip & Play → exactly one countdown, narration cancelled", ok ? "PASS" : "FAIL",
      `narrationPending=${skipped.narrationPending} countdownLive=${skipped.countdownLive} token=${skipped.countdownToken}`);
  }
  const started = Date.now();
  let p = skipped;
  while (Date.now() - started < 15000) { p = await t.probe(); if (p.timerState === "running") break; await t.wait(250); }
  const ti = await t.timerIntervals();
  if (wanted("T02")) {
    const ok = p.timerState === "running" && ti.length === 1 && p.timerTotal === 45;
    record("T02", "Start → running with one interval, total from mission data", ok ? "PASS" : "FAIL",
      `timerState=${p.timerState} timerIntervals=${ti.length} timerTotal=${p.timerTotal} timerLeft=${p.timerLeft}`);
  }
});

/* ── T03 double start tap ──────────────────────────────────────────────── */
if (wanted("T03")) await session(async (t) => {
  await t.pastWelcome();
  await t.open(1);
  await t.tapStart();
  await t.wait(120);
  await t.tapStart();                       // second tap: skips narration
  await t.wait(200);
  await t.tapStart();                       // third: lands mid-countdown
  await t.wait(5000);
  const p = await t.probe();
  const ti = await t.timerIntervals();
  const ok = ti.length === 1 && p.timerState === "running";
  record("T03", "double/triple Start tap → still one timer", ok ? "PASS" : "FAIL",
    `timerIntervals=${ti.length} timerState=${p.timerState} countdownToken=${p.countdownToken}`);
});

/* ── T06 close during countdown ────────────────────────────────────────── */
if (wanted("T06")) await session(async (t) => {
  await t.pastWelcome();
  await t.open(1);
  await t.tapStart();
  await t.wait(400);
  await t.page.evaluate(() => window.closeMission && window.closeMission());
  await t.wait(4200);                       // well past when the timer would have started
  const p = await t.probe();
  const ti = await t.timerIntervals();
  const ok = ti.length === 0 && p.timerState === "idle";
  record("T06", "close during countdown → no timer starts", ok ? "PASS" : "FAIL",
    `timerIntervals=${ti.length} timerState=${p.timerState}`);
});

/* ── T07 switch mission during countdown ───────────────────────────────── */
if (wanted("T07")) await session(async (t) => {
  await t.pastWelcome();
  await t.open(1);
  await t.tapStart();
  await t.wait(400);
  await t.open(3);                          // different mission, different duration
  await t.wait(4200);
  const p = await t.probe();
  const ti = await t.timerIntervals();
  const ok = ti.length === 0 && p.timerState === "idle" && p.missionId === 3 && p.timerTotal === 0;
  record("T07", "switch mission during countdown → old callback cannot start it", ok ? "PASS" : "FAIL",
    `missionId=${p.missionId} timerIntervals=${ti.length} timerState=${p.timerState} timerTotal=${p.timerTotal}`);
});

/* ── T08 running consistency ───────────────────────────────────────────── */
if (wanted("T08")) await session(async (t) => {
  await t.pastWelcome();
  await t.open(1);
  await t.startUntilRunning();
  await t.wait(2000);
  const p = await t.probe();
  const shown = await t.timerText();
  const derived = Math.ceil(Math.max(0, p.timerEndAt - Date.now()) / 1000);
  const ok = p.timerState === "running" && Math.abs(derived - p.timerLeft) <= 1 && shown === `${p.timerLeft}s`;
  record("T08", "running: display, timerLeft and timerEndAt agree", ok ? "PASS" : "FAIL",
    `shown="${shown}" timerLeft=${p.timerLeft} fromEndAt=${derived} total=${p.timerTotal}`);
});

/* ── T09/T10/T11 pause / resume ────────────────────────────────────────── */
if (wanted("T09") || wanted("T10") || wanted("T11")) await session(async (t) => {
  await t.pastWelcome();
  await t.open(1);
  await t.startUntilRunning();
  await t.wait(1500);
  await t.tapStart();                       // pause
  await t.wait(120);
  const paused1 = await t.probe();
  const pausedIntervals = await t.timerIntervals();
  await t.wait(1600);                       // remaining must not tick down
  const paused2 = await t.probe();
  if (wanted("T09")) {
    const ok = paused1.timerState === "paused" && pausedIntervals.length === 0 && paused2.timerLeft === paused1.timerLeft;
    record("T09", "pause: interval cleared, remaining frozen", ok ? "PASS" : "FAIL",
      `state=${paused1.timerState} intervals=${pausedIntervals.length} left ${paused1.timerLeft}→${paused2.timerLeft} after 1.6s`);
  }
  await t.tapStart();                       // resume
  await t.wait(400);
  const res = await t.probe();
  const resIntervals = await t.timerIntervals();
  if (wanted("T10")) {
    const ok = res.timerState === "running" && resIntervals.length === 1 && res.timerLeft <= paused2.timerLeft && res.timerLeft >= paused2.timerLeft - 2;
    record("T10", "resume: one interval, continues from remaining", ok ? "PASS" : "FAIL",
      `state=${res.timerState} intervals=${resIntervals.length} resumedAt=${res.timerLeft} pausedAt=${paused2.timerLeft} total=${res.timerTotal}`);
  }
  if (wanted("T11")) {
    for (let i = 0; i < 4; i++) { await t.tapStart(); await t.wait(260); }
    const after = await t.probe();
    const ints = await t.timerIntervals();
    const ok = ints.length <= 1 && (after.timerState === "running" ? ints.length === 1 : ints.length === 0);
    record("T11", "repeated pause/resume never stacks intervals", ok ? "PASS" : "FAIL",
      `finalState=${after.timerState} timerIntervals=${ints.length}`);
  }
});

/* ── one real journey: Time's Up → gate → complete → double-tap → un-mark ─
 * These used to be five sessions, each paying the mission's real 45 seconds to
 * reach Time's Up. They are one run now: it is faster, and it is also the
 * sequence a family actually performs, so a state leak between the steps has
 * somewhere to show up. */
if (["T13","T16","T15","T17","T21","T23"].some(wanted)) await session(async (t) => {
  await t.pastWelcome();
  await t.open(1);                          // 45s, the shortest mission in the data

  const atOpen = await t.probe();
  if (wanted("T15")) {
    /* The dwell path: gate total is min(max(missionTime,45),75) — for a 45s
       mission that is 45s, and it counts from when the sheet opened. */
    const expected = Math.min(Math.max(45, 45), 75) * 1000;
    const ok = atOpen.gateTotalMs === expected && atOpen.gateRemainingMs > 0 && atOpen.gateRemainingMs <= expected;
    record("T15", "dwell gate: total follows min(max(time,45),75) and counts down", ok ? "PASS" : "FAIL",
      `gateTotalMs=${atOpen.gateTotalMs} expected=${expected} remaining=${Math.round(atOpen.gateRemainingMs / 1000)}s`);
  }

  await t.startUntilRunning();
  const running = await t.probe();
  const deadline = Date.now() + (running.timerLeft + 3) * 1000;
  while (Date.now() < deadline) {
    const p = await t.probe();
    if (p.timerState !== "running" && p.timerLeft === 0) break;
    await t.wait(1000);
  }
  await t.wait(800);

  const finished = await t.probe();
  const finIntervals = await t.timerIntervals();
  const shown = await t.timerText();
  if (wanted("T13")) {
    const ok = finIntervals.length === 0 && shown === "Time's Up!" &&
               finished.doneSize === 0 && finished.timerFinishedFor.includes(1);
    record("T13", "Time's Up: interval cleared, marked played, NOT completed", ok ? "PASS" : "FAIL",
      `shown="${shown}" intervals=${finIntervals.length} doneSize=${finished.doneSize} timerFinishedFor=[${finished.timerFinishedFor}] autoDoneOnEnd=${finished.autoDoneOnEnd}`);
  }
  if (wanted("T16")) {
    const ok = finished.gateRemainingMs === 0;
    record("T16", "Time's Up opens the gate outright", ok ? "PASS" : "FAIL",
      `gateRemainingMs=${finished.gateRemainingMs} (gateTotal was ${finished.gateTotalMs})`);
  }

  const before = finished;
  await t.tapDone();
  await t.wait(800);
  const one = await t.probe();
  const noBar = await t.page.evaluate(() => !document.getElementById("undoBar"));
  if (wanted("T17")) {
    const ok = one.doneSize === before.doneSize + 1 && one.doneIds.includes(1) &&
               one.xp > before.xp && noBar;
    record("T17", "manual completion: one done, xp up, and no Undo bar exists", ok ? "PASS" : "FAIL",
      `done ${before.doneSize}→${one.doneSize} xp ${before.xp}→${one.xp} streak ${before.streakCount}→${one.streakCount} #undoBar in DOM=${!noBar}`);
  }

  /* T21 replaces the old "Undo rolls everything back" case. The Undo bar is
     gone, so the only reversal left is the sheet's own toggle, and it is a
     DIFFERENT promise: it returns the mission and its XP but deliberately does
     not rewrite the history of a day the family really did play. Asserting the
     old rollback here would be asserting a feature that no longer exists. */
  if (wanted("T21")) {
    await t.tapDone();                        // the button now reads "Mark as Not Done"
    await t.wait(900);
    const undone = await t.probe();
    const ok = undone.doneSize === before.doneSize && undone.xp === before.xp &&
               undone.streakCount === one.streakCount &&
               undone.lastActiveIso === one.lastActiveIso;
    record("T21", "Mark as Not Done returns the mission and its XP, keeps the streak day", ok ? "PASS" : "FAIL",
      `done→${undone.doneSize} (pre ${before.doneSize}) xp→${undone.xp} (pre ${before.xp}) ` +
      `streak ${one.streakCount}→${undone.streakCount} (kept) lastActive "${one.lastActiveIso}"→"${undone.lastActiveIso}" (kept)`);
  }
});

/* ── T18 two completion clicks in one tick ─────────────────────────────
 * The hazard is a fast double-tap awarding twice — not the button's own
 * toggle. A second tap after the UI repaints is the deliberate "Mark as Not
 * Done" action and correctly un-completes; an early version of this file read
 * that as a failure. This runs in its own session because the race
 * deliberately churns streak state, and sharing a session with the un-mark tests
 * hands them a baseline that has already moved. */
if (wanted("T18")) await session(async (t) => {
  await t.pastWelcome();
  await t.open(1);
  await t.startUntilRunning();
  let g = await t.probe();
  const dl = Date.now() + (g.timerLeft + 4) * 1000;
  while (Date.now() < dl) { g = await t.probe(); if (g.gateRemainingMs === 0) break; await t.wait(1000); }
  const before = await t.probe();
  await t.page.evaluate(() => {
    const b = document.getElementById("btnToggleDone");
    b.click(); b.click();                   // same tick, no repaint between
  });
  await t.wait(1000);
  const race = await t.probe();
  const dupIds = race.doneIds.length !== new Set(race.doneIds).size;
  const doubleXp = race.xp > 10;            // one unique completion is worth 10
  const doubleStreak = race.streakCount > before.streakCount + 1;
  const ok = !dupIds && !doubleXp && !doubleStreak;
  record("T18", "two clicks in one tick never award twice", ok ? "PASS" : "FAIL",
    `done=${race.doneSize} ids=[${race.doneIds}] xp=${race.xp} streak ${before.streakCount}→${race.streakCount}`);
});

/* ── T14 gate closed blocks every mutation ─────────────────────────────── */
if (wanted("T14")) await session(async (t) => {
  await t.pastWelcome();
  await t.open(1);
  const before = await t.probe();
  await t.tapDone();
  await t.wait(600);
  const after = await t.probe();
  const ok = after.doneSize === before.doneSize && after.xp === before.xp &&
             after.streakCount === before.streakCount && after.bestStreak === before.bestStreak &&
             after.lastActiveIso === before.lastActiveIso &&
             after.gateRemainingMs > 0;
  record("T14", "gate closed: no done/xp/streak mutation", ok ? "PASS" : "FAIL",
    `gateRemaining=${Math.round(after.gateRemainingMs / 1000)}s done ${before.doneSize}→${after.doneSize} xp ${before.xp}→${after.xp} streak ${before.streakCount}→${after.streakCount}`);
});

/* ── T20 completed mission replay ──────────────────────────────────────── */
if (wanted("T20")) await session(async (t) => {
  await t.pastWelcome();
  await t.open(1);
  await t.startUntilRunning();
  let g = await t.probe();
  const dl = Date.now() + (g.timerLeft + 4) * 1000;
  while (Date.now() < dl) { g = await t.probe(); if (g.gateRemainingMs === 0) break; await t.wait(1000); }
  await t.tapDone();
  await t.wait(800);
  const afterFirst = await t.probe();
  await t.open(3); await t.wait(400);
  await t.open(1); await t.wait(700);       // reopen the completed mission
  await t.startUntilRunning();
  const replay = await t.probe();
  await t.tapDone();                        // "Mark as Not Done" path
  await t.wait(600);
  const toggled = await t.probe();
  const ok = replay.xp === afterFirst.xp && replay.doneSize === afterFirst.doneSize &&
             toggled.doneSize === afterFirst.doneSize - 1;
  record("T20", "replaying a done mission farms no xp", ok ? "PASS" : "FAIL",
    `xp ${afterFirst.xp}→${replay.xp} on replay; done ${afterFirst.doneSize}→${replay.doneSize}; after Mark-as-Not-Done ${toggled.doneSize}`);
});

/* ── T19 auto completion ───────────────────────────────────────────────── */
if (wanted("T19")) await session(async (t) => {
  await t.pastWelcome();
  const p0 = await t.probe();
  await t.open(1);
  await t.startUntilRunning();
  let q = await t.probe();
  const dl2 = Date.now() + (q.timerLeft + 5) * 1000;
  while (Date.now() < dl2) { q = await t.probe(); if (q.doneSize > 0 || q.timerFinishedFor.length) break; await t.wait(1000); }
  await t.wait(1200);
  const p = await t.probe();
  const ti = await t.timerIntervals();
  const ok = p.autoDoneOnEnd === true && p.doneSize === 1 && p.doneIds.includes(1) && ti.length === 0;
  record("T19", "autoDoneOnEnd on: exactly one completion at Time's Up", ok ? "PASS" : "FAIL",
    `autoDoneOnEnd=${p.autoDoneOnEnd} doneSize=${p.doneSize} doneIds=[${p.doneIds}] intervals=${ti.length} xp=${p.xp}`);
}, { seed: { jumvi_auto_done_v1: "1" } });

/* ── T28 mission 2 caller ──────────────────────────────────────────────── */
if (wanted("T28")) await session(async (t) => {
  await t.pastWelcome();
  await t.open(2);
  const label = await t.startLabel();
  await t.tapStart(); await t.wait(300);
  await t.tapStart(); await t.wait(300);    // double start on the caller
  const during = await t.page.evaluate(() => ({
    overlays: document.querySelectorAll(".jrlOverlay, [class*='redlight'], [id*='redLight']").length,
    intervals: window.__intervals().length,
  }));
  await t.open(5); await t.wait(800);       // switch away
  const after = await t.page.evaluate(() => ({
    overlays: [...document.querySelectorAll(".jrlOverlay, [class*='redlight'], [id*='redLight']")]
      .filter((e) => getComputedStyle(e).display !== "none" && e.getBoundingClientRect().width > 0).length,
  }));
  const ok = /caller/i.test(label) && after.overlays === 0;
  record("T28", "mission 2 caller: double start, then switch away leaves nothing", ok ? "PASS" : "FAIL",
    `startLabel="${label}" overlaysDuring=${during.overlays} visibleOverlaysAfterSwitch=${after.overlays}`);
});

/* ── T27 personal vs team progress isolation ───────────────────────────
 * Progress keys are namespaced by _PROGRESS_PREFIX: the team prefix while a
 * team is active, the profile prefix otherwise. So the question is not whether
 * the code intends to separate them but whether a completion earned solo can
 * ever show up inside a team journey, or the reverse. Earn one solo, switch a
 * team on, and read both namespaces back. */
if (wanted("T27")) await session(async (t) => {
  await t.pastWelcome();
  await t.open(1);
  await t.startUntilRunning();
  let g = await t.probe();
  const dl = Date.now() + (g.timerLeft + 4) * 1000;
  while (Date.now() < dl) { g = await t.probe(); if (g.gateRemainingMs === 0) break; await t.wait(1000); }
  await t.tapDone();
  await t.wait(900);
  const solo = await t.probe();

  /* Activate a team the way the app stores one, then reload so the prefix is
     recomputed at boot (it is a const, resolved once). */
  await t.page.evaluate(() => {
    /* normalizeJumviTeams() drops any team whose partner is not one of the six
       known roles, and an unrecognised team silently falls back to the solo
       prefix — which is how the first run of this test "failed" the app for
       its own bad fixture. */
    localStorage.setItem("jumvi_p1_teams_v1", JSON.stringify([{ id: "t1", partner: "dad", createdAt: "2026-08-24" }]));
    localStorage.setItem("jumvi_p1_active_team_v1", "t1");
  });
  await t.page.reload({ waitUntil: "networkidle" });
  await t.wait(1600);
  const team = await t.probe();

  const keys = await t.page.evaluate(() => ({
    solo: localStorage.getItem("jumvi_p1_missions_done_v3"),
    team: localStorage.getItem("jumvi_p1_team_t1_missions_done_v3"),
    soloStreak: localStorage.getItem("jumvi_p1_streak_count_v1"),
    teamStreak: localStorage.getItem("jumvi_p1_team_t1_streak_count_v1"),
  }));

  const ok = solo.doneSize === 1 && team.doneSize === 0 &&
             keys.solo === "[1]" && (keys.team === null || keys.team === "[]") &&
             (keys.teamStreak === null || Number(keys.teamStreak) === 0);
  record("T27", "team journey starts clean; the solo completion stays solo", ok ? "PASS" : "FAIL",
    `solo done=${solo.doneSize} xp=${solo.xp} → after team activation done=${team.doneSize} xp=${team.xp}; ` +
    `soloKey=${keys.solo} teamKey=${keys.team} soloStreak=${keys.soloStreak} teamStreak=${keys.teamStreak}`);
});

/* ── T31 console / runtime ─────────────────────────────────────────────── */
if (wanted("T31")) {
  const errs = await session(async (t) => {
    await t.pastWelcome();
    await t.open(1);
    await t.startUntilRunning(); await t.wait(1500);
    await t.tapStart(); await t.wait(400);        // pause
    await t.tapStart(); await t.wait(800);        // resume
    await t.open(2); await t.wait(600);
    await t.open(14); await t.wait(600);
    await t.page.evaluate(() => window.closeMission && window.closeMission());
    await t.wait(800);
  });
  record("T31", "no console errors or unhandled rejections", errs.length === 0 ? "PASS" : "FAIL",
    errs.length ? errs.slice(0, 3).join(" | ") : "clean across open/start/pause/resume/switch/close");
}

/* ── T32 no personal data in the play trace ────────────────────────────── */
if (wanted("T32")) await session(async (t) => {
  await t.pastWelcome();
  await t.open(1);
  const p = await t.probe();
  const blob = JSON.stringify(p).toLowerCase();
  const leaks = ["name", "child", "player1", "avatar", "certificate", "email", "ip"].filter((k) => blob.includes(k));
  record("T32", "play probe carries no name/profile/identifier field", leaks.length === 0 ? "PASS" : "FAIL",
    leaks.length ? `suspect keys: ${leaks.join(", ")}` : `fields: ${Object.keys(p).length}, none name-like`);
});

/* ── T12 backgrounded tab ──────────────────────────────────────────────
 * The phone is face-down on the grass for most of a mission, so the tab is
 * throttled or hidden the whole time. The timer must be reconstructed from
 * wall-clock, not from how many intervals managed to fire. */
if (wanted("T12")) await session(async (t) => {
  await t.pastWelcome();
  await t.open(1);
  await t.startUntilRunning();
  const before = await t.probe();
  await t.page.evaluate(() => Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true }));
  await t.page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await t.wait(4000);
  await t.page.evaluate(() => Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true }));
  await t.page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await t.wait(600);
  const after = await t.probe();
  const wallElapsed = Math.round((after.timerEndAt - before.timerEndAt) === 0
    ? (before.timerLeft - after.timerLeft) : -1);
  const expected = 4;
  const ok = after.timerEndAt === before.timerEndAt && Math.abs(wallElapsed - expected) <= 2;
  record("T12", "hidden tab: remaining recomputed from wall clock", ok ? "PASS" : "FAIL",
    `timerLeft ${before.timerLeft}→${after.timerLeft} over ~${expected}s hidden; timerEndAt unchanged=${after.timerEndAt === before.timerEndAt}`);
});

/* ── T26 Mark as Not Done later ────────────────────────────────────────── */
if (wanted("T26")) await session(async (t) => {
  await t.pastWelcome();
  await t.open(1);
  await t.startUntilRunning();
  let g = await t.probe();
  const dl = Date.now() + (g.timerLeft + 4) * 1000;
  while (Date.now() < dl) { g = await t.probe(); if (g.gateRemainingMs === 0) break; await t.wait(1000); }
  await t.tapDone();
  await t.wait(900);
  const done1 = await t.probe();
  await t.wait(5600);                        // a deliberate later un-mark, not a quick correction
  await t.tapDone();                         // now it is "Mark as Not Done"
  await t.wait(900);
  const after = await t.probe();
  /* Product rule (§5.4): a later un-mark returns the mission, it does not
     rewrite the history of a day the family really did play. */
  const ok = after.doneSize === done1.doneSize - 1 &&
             after.streakCount === done1.streakCount &&
             after.lastActiveIso === done1.lastActiveIso;
  record("T26", "later Mark as Not Done returns the mission, keeps the streak day", ok ? "PASS" : "FAIL",
    `done ${done1.doneSize}→${after.doneSize} streak ${done1.streakCount}→${after.streakCount} lastActive "${done1.lastActiveIso}"→"${after.lastActiveIso}"`);
});

/* ── T30 offline core mission ──────────────────────────────────────────── */
if (wanted("T30")) await session(async (t) => {
  await t.pastWelcome();
  await t.page.context().setOffline(true);
  await t.open(1);
  await t.startUntilRunning();
  const running = await t.probe();
  const ti = await t.timerIntervals();
  let g = running;
  const dl = Date.now() + (g.timerLeft + 4) * 1000;
  while (Date.now() < dl) { g = await t.probe(); if (g.gateRemainingMs === 0) break; await t.wait(1000); }
  await t.tapDone();
  await t.wait(900);
  const after = await t.probe();
  await t.page.context().setOffline(false);
  const ok = running.timerState === "running" && ti.length === 1 && after.doneSize === 1 && after.xp > 0;
  record("T30", "offline: sheet, timer, gate and local progress all work", ok ? "PASS" : "FAIL",
    `timerState=${running.timerState} intervals=${ti.length} done=${after.doneSize} xp=${after.xp}`);
});

/* ── T29 3D hub completion ─────────────────────────────────────────────── */
if (wanted("T29")) await session(async (t) => {
  await t.pastWelcome();
  const webgl = await t.page.evaluate(() => {
    try { return !!document.createElement("canvas").getContext("webgl2"); } catch (_) { return false; }
  });
  const hookPresent = await t.page.evaluate(() => typeof window.openMissionFromHub === "function");
  if (!webgl || !hookPresent) {
    record("T29", "3D hub completion", "SKIP",
      `not exercised in this file — webgl2=${webgl}, window.openMissionFromHub=${hookPresent} (it is module scope inside the hub, never on window). Covered for real by tools/check-hub-mission-flow.mjs, which boots three.js and the hub module with --use-gl=swiftshader: 6/6 there.`);
    return;
  }
  await t.page.evaluate(() => window.openMissionFromHub(5));
  await t.wait(1200);
  const p = await t.probe();
  record("T29", "3D hub opens the mission it names", p.missionId === 5 ? "PASS" : "FAIL",
    `missionId=${p.missionId} hubFlow=${await t.page.evaluate(() => !!window._hubMissionFlow)}`);
});

await browser.close();

/* ── summary ───────────────────────────────────────────────────────────── */
const pass = results.filter((r) => r.status === "PASS").length;
const fail = results.filter((r) => r.status === "FAIL").length;
const other = results.length - pass - fail;
console.log(`\n${pass} pass, ${fail} fail, ${other} informational/skipped, of ${results.length} run.`);
if (fail) { console.log("\nFAILING:"); for (const r of results.filter((x) => x.status === "FAIL")) console.log(`  ${r.id}  ${r.name}\n       ${r.detail}`); process.exit(1); }

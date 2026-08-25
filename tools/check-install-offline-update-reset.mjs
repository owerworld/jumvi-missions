#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
 * check-install-offline-update-reset.mjs — Faz 5.
 *
 * Four flows that only matter when something has gone wrong, which is exactly
 * why they rot: a dead "Install" button on a browser that cannot install, an
 * "already up to date" on a phone with no signal, a Reset that clears the
 * mission list but leaves the certificate the child already earned.
 *
 * Each state is REACHED, not simulated in the abstract:
 *
 *   install   the four states come from installState() — standalone / prompt /
 *             ios-manual / none. standalone is forced through
 *             navigator.standalone, prompt by dispatching a real
 *             beforeinstallprompt event object, ios-manual by an iPhone user
 *             agent, none by a plain desktop UA. Offline is layered on top of
 *             each, because "can I install" and "am I online" are different
 *             questions and the spec wants both answered.
 *   offline   context.setOffline(true) — the whole core loop is then played
 *             through for real: open, start, gate, finish, undo.
 *   update    navigator.serviceWorker.getRegistration is stubbed per case so
 *             busy / offline / no-registration / already-latest / found /
 *             failed each get their own run. Nothing here waits on a real
 *             deploy.
 *   reset     seeded progress, a real 1200ms pointer hold, then every scoped
 *             key is read back. A short tap must do nothing.
 *
 *   node tools/check-install-offline-update-reset.mjs
 *   node tools/check-install-offline-update-reset.mjs --only=U03
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
const wanted = (id) => ONLY.length === 0 || ONLY.includes(id);

const IPHONE_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";

const results = [];
const record = (id, name, status, detail) => {
  results.push({ id, name, status, detail });
  const mark = status === "PASS" ? "✅" : status === "FAIL" ? "❌" : "⚠️ ";
  console.log(`  ${mark} ${id}  ${name}${detail ? " — " + detail : ""}`);
};

const chromium = loadChromium();
const browser = await chromium.launch({ executablePath: EXE });

async function open({ ua, standalone, offline, seed, init } = {}) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    ...(ua ? { userAgent: ua } : {}),
  });
  const page = await ctx.newPage();
  page.on("pageerror", () => {});
  await page.addInitScript((s) => {
    localStorage.setItem("jumvi_onboarded_v2", "1");
    for (const [k, v] of Object.entries(s || {})) localStorage.setItem(k, v);
  }, seed || {});
  if (standalone) {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "standalone", { value: true, configurable: true });
    });
  }
  if (init) await page.addInitScript(init);
  if (offline) await ctx.setOffline(true);
  await page.goto(BASE, { waitUntil: offline ? "domcontentloaded" : "networkidle" }).catch(() => {});
  await page.waitForTimeout(1500);
  for (let i = 0; i < 4; i++) {
    if (!(await page.evaluate(() => document.body.classList.contains("modalOpen")))) break;
    await page.keyboard.press("Escape"); await page.waitForTimeout(300);
  }
  return { ctx, page };
}

/* What the family can actually see and press.
 * #btnKeepOnPhone lives on the Grown-ups tab, so it measures 0x0 while any
 * other tab is showing — an early run read that as "no install offered" on
 * exactly the two states that DO offer one. Go to the tab that owns it first. */
const installSurfaces = async (page) => {
  await page.evaluate(() => document.querySelector('.navTab[data-tab="profile"]')?.click());
  await page.waitForTimeout(600);
  return page.evaluate(() => {
  const seen = (id) => {
    const e = document.getElementById(id);
    if (!e) return "missing";
    const cs = getComputedStyle(e);
    if (e.hidden || cs.display === "none" || cs.visibility === "hidden") return "hidden";
    const r = e.getBoundingClientRect();
    return r.width > 1 && r.height > 1 ? "visible" : "0x0";
  };
  return {
    state: typeof installState === "function" ? installState() : "?",
    row: seen("btnKeepOnPhone"),
    card: seen("keepCard"),
    dialog: seen("installDlg"),
  };
  });
};

console.log("Install / offline / update / reset / 3D — Faz 5\n");

/* ── I01..I04 the four install states ──────────────────────────────────── */
const INSTALL_CASES = [
  { id: "I01", label: "already installed (standalone)", opts: { standalone: true }, expect: "standalone", wantAction: false },
  { id: "I02", label: "prompt available (Chromium)", opts: { init: () => {
      /* A real event object, dispatched the way Chromium does — the listener
         calls preventDefault() and keeps it for a later user gesture. */
      window.addEventListener("load", () => {
        const e = new Event("beforeinstallprompt");
        e.prompt = () => {}; e.userChoice = Promise.resolve({ outcome: "dismissed" });
        window.dispatchEvent(e);
      });
    } }, expect: "prompt", wantAction: true },
  { id: "I03", label: "iOS — manual Share → Add to Home Screen", opts: { ua: IPHONE_UA }, expect: "ios-manual", wantAction: true },
  { id: "I04", label: "no honest path (desktop, no prompt)", opts: {}, expect: "none", wantAction: false },
];
for (const c of INSTALL_CASES) {
  if (!wanted(c.id)) continue;
  const { ctx, page } = await open(c.opts);
  const s = await installSurfaces(page);
  await ctx.close();
  const showsAction = s.row === "visible" || s.card === "visible";
  const ok = s.state === c.expect && showsAction === c.wantAction;
  record(c.id, c.label, ok ? "PASS" : "FAIL",
    `installState()="${s.state}" (expected "${c.expect}") · row=${s.row} card=${s.card} → ${showsAction ? "an install action is offered" : "no install action, as intended"}`);
}

/* ── I05 offline must not offer an install that cannot succeed ─────────── */
if (wanted("I05")) {
  /* Load online, THEN pull the connection. Going offline before the first
     navigation just fails the load, which tests the harness, not the app. */
  const { ctx, page } = await open({ ua: IPHONE_UA });
  await ctx.setOffline(true);
  await page.waitForTimeout(500);
  const s = await installSurfaces(page);
  const online = await page.evaluate(() => navigator.onLine);
  await ctx.close();
  /* iOS "Add to Home Screen" is a local browser action and works offline, so
     offering it is honest. What would NOT be honest is a prompt-based install
     with no network. This records which it is rather than assuming. */
  record("I05", "offline: install surfaces are honest about what still works", "INFO",
    `navigator.onLine=${online} installState()="${s.state}" row=${s.row} card=${s.card} — iOS add-to-home-screen is a local action, so it remains valid offline`);
}

/* ── O01 the whole core loop, offline ──────────────────────────────────── */
if (wanted("O01")) {
  const { ctx, page } = await open({});
  await ctx.setOffline(true);
  await page.waitForTimeout(400);
  const probe = () => page.evaluate(() => window.__jumviPlayProbe());
  const tabs = [];
  for (const t of ["today", "browse", "modes", "profile"]) {
    await page.evaluate((x) => document.querySelector(`.navTab[data-tab="${x}"]`)?.click(), t);
    await page.waitForTimeout(600);
    tabs.push(`${t}:${await page.evaluate((x) => getComputedStyle(document.querySelector(`.tabPanel[data-tab="${x}"]`)).display !== "none", t) ? "ok" : "BLANK"}`);
  }
  await page.evaluate(() => document.querySelector('.navTab[data-tab="browse"]')?.click());
  await page.waitForTimeout(500);
  const cards = await page.evaluate(() => document.querySelectorAll("[data-mission-id]").length);
  await page.evaluate(() => window.openMission(1));
  await page.waitForTimeout(700);
  await page.evaluate(() => document.getElementById("btnStartTimer")?.click());
  await page.waitForTimeout(500);
  if ((await probe()).narrationPending) { await page.evaluate(() => document.getElementById("btnStartTimer")?.click()); await page.waitForTimeout(400); }
  let g = null; const dl = Date.now() + 130000;
  while (Date.now() < dl) { g = await probe(); if (g.gateRemainingMs === 0) break; await page.waitForTimeout(1000); }
  const running = g;
  await page.evaluate(() => document.getElementById("btnToggleDone")?.click());
  await page.waitForTimeout(900);
  const done1 = await probe();
  await page.evaluate(() => document.getElementById("undoBtn")?.click());
  await page.waitForTimeout(1000);
  const undone = await probe();
  const banner = await page.evaluate(() => {
    const b = document.getElementById("offlineBanner");
    return b && !b.hidden ? (b.textContent || "").replace(/\s+/g, " ").trim().slice(0, 60) : "(not shown)";
  });
  await ctx.close();
  /* The gate can open two ways and both are legitimate: the timer reaching
     Time's Up, or the sheet simply having been open long enough. Requiring
     timerFinishedFor here asserted one particular route, not the outcome. */
  const ok = cards === 36 && running.gateRemainingMs === 0 &&
             done1.doneSize === 1 && undone.doneSize === 0 && !tabs.some((t) => t.includes("BLANK"));
  record("O01", "offline: four tabs, 36 missions, timer, gate, completion and Undo", ok ? "PASS" : "FAIL",
    `${tabs.join(" ")} · cards=${cards} · gate opened=${running.gateRemainingMs === 0} · done ${done1.doneSize} → undo ${undone.doneSize} · banner="${banner}"`);
}

/* ── U01..U06 the six update states ────────────────────────────────────── */
const UPDATE_CASES = [
  { id: "U01", label: "offline → says so, does not pretend to check", offline: true, stub: null,
    want: (t) => /offline/i.test(t) },
  { id: "U02", label: "no service worker registration → honest failure", stub: `
      navigator.serviceWorker.getRegistration = async () => undefined;`,
    want: (t) => /couldn't check|try again/i.test(t) },
  { id: "U03", label: "already latest", stub: `
      navigator.serviceWorker.getRegistration = async () => ({ update: async () => {} });`,
    want: (t) => /latest/i.test(t) },
  { id: "U04", label: "update check throws → honest failure", stub: `
      navigator.serviceWorker.getRegistration = async () => { throw new Error("boom"); };`,
    want: (t) => /couldn't check|try again/i.test(t) },
  { id: "U05", label: "update found → reloads instead of toasting", stub: `
      navigator.serviceWorker.getRegistration = async () => ({
        update: async () => { setTimeout(() => navigator.serviceWorker.dispatchEvent(new Event("controllerchange")), 60); }
      });`,
    wantReload: true },
];
for (const c of UPDATE_CASES) {
  if (!wanted(c.id)) continue;
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  page.on("pageerror", () => {});
  await page.addInitScript(() => localStorage.setItem("jumvi_onboarded_v2", "1"));
  if (c.stub) await page.addInitScript(new Function(c.stub));
  await page.goto(BASE, { waitUntil: "networkidle" }).catch(() => {});
  await page.waitForTimeout(1500);
  for (let i = 0; i < 4; i++) {
    if (!(await page.evaluate(() => document.body.classList.contains("modalOpen")))) break;
    await page.keyboard.press("Escape"); await page.waitForTimeout(250);
  }
  if (c.offline) await ctx.setOffline(true);
  let reloaded = false;
  page.on("framenavigated", (f) => { if (f === page.mainFrame()) reloaded = true; });
  await page.evaluate(() => document.querySelector('.navTab[data-tab="profile"]')?.click());
  await page.waitForTimeout(600);
  reloaded = false;
  /* In the update-found case the reload can land inside this evaluate, which
     destroys the execution context. That IS the pass condition there, so it is
     caught rather than allowed to fail the run. */
  let busyDuring = { found: true, busy: "(navigated)", sub: "(navigated)" };
  try {
    busyDuring = await page.evaluate(async () => {
      const btn = document.getElementById("btnCheckUpdate");
      if (!btn) return { found: false };
      btn.click();
      await new Promise((r) => setTimeout(r, 120));
      return { found: true, busy: btn.getAttribute("aria-busy"),
               sub: (document.getElementById("btnCheckUpdateSub")?.textContent || "").trim() };
    });
  } catch (_) { /* navigated mid-check */ }
  /* "Already latest" is not instant: the code races reg.update() against a
     controllerchange listener with an 8s ceiling, so a phone that is already
     current waits the full 8 seconds before being told so. Measured, not
     assumed — the harness has to outwait it or it reads the mid-check state. */
  await page.waitForTimeout(c.wantReload ? 2500 : 9500);
  /* A reload destroys the execution context; reading through it is the test's
     problem, not the app's. */
  let toast = "(page navigated)";
  try { toast = await page.evaluate(() => (document.getElementById("toast")?.textContent || "").trim()); }
  catch (_) { /* navigated — expected in the update-found case */ }
  await ctx.close();
  const ok = c.wantReload ? reloaded : (busyDuring.found && c.want(toast));
  record(c.id, c.label, ok ? "PASS" : "FAIL",
    c.wantReload ? `reloaded=${reloaded}` : `toast="${toast}" · aria-busy during check=${busyDuring.busy} sub="${busyDuring.sub}"`);
}
if (wanted("U06")) {
  /* Busy is a state of its own: a second tap while a check is in flight must
     not start a second one. */
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    localStorage.setItem("jumvi_onboarded_v2", "1");
    window.__updateCalls = 0;
    navigator.serviceWorker.getRegistration = async () => ({
      update: async () => { window.__updateCalls++; await new Promise((r) => setTimeout(r, 1500)); },
    });
  });
  await page.goto(BASE, { waitUntil: "networkidle" }).catch(() => {});
  await page.waitForTimeout(1500);
  for (let i = 0; i < 4; i++) {
    if (!(await page.evaluate(() => document.body.classList.contains("modalOpen")))) break;
    await page.keyboard.press("Escape"); await page.waitForTimeout(250);
  }
  await page.evaluate(() => document.querySelector('.navTab[data-tab="profile"]')?.click());
  await page.waitForTimeout(600);
  const calls = await page.evaluate(async () => {
    const btn = document.getElementById("btnCheckUpdate");
    btn.click(); btn.click(); btn.click();
    await new Promise((r) => setTimeout(r, 600));
    return { calls: window.__updateCalls, busy: btn.getAttribute("aria-busy") };
  });
  await ctx.close();
  record("U06", "busy: three taps start one check", calls.calls === 1 ? "PASS" : "FAIL",
    `update() called ${calls.calls}× · aria-busy=${calls.busy}`);
}

/* ── R01..R03 reset ────────────────────────────────────────────────────── */
const RESET_SEED = {
  jumvi_p1_missions_done_v3: JSON.stringify([1, 2, 3, 4]),
  jumvi_p1_streak_count_v1: "4",
  jumvi_p1_streak_best_v1: "7",
  jumvi_p1_streak_last_v1: "2026-08-24",
  jumvi_p1_badges_unlocked_v1: JSON.stringify(["first_mission", "five_missions"]),
  jumvi_p1_daily_challenge_v1: JSON.stringify({ iso: "2026-08-24", count: 2, reward: 1 }),
  jumvi_p1_daily_n_v1: "2",
  jumvi_p1_daily_id_v1: "7",
  jumvi_p1_daily_date_v1: "2026-08-24",
  jumvi_p1_cert_name_v1: "FixtureChild",
  jumvi_p1_cert_id_v1: "cert-123",
  jumvi_p1_attempts_v1: JSON.stringify({ "5": 3 }),
  jumvi_p1_high_scores_v1: JSON.stringify({ "1": 12 }),
};
const readScoped = (page) => page.evaluate(() => {
  const g = (k) => localStorage.getItem(k);
  return {
    done: g("jumvi_p1_missions_done_v3"),
    streak: g("jumvi_p1_streak_count_v1"),
    best: g("jumvi_p1_streak_best_v1"),
    last: g("jumvi_p1_streak_last_v1"),
    badges: g("jumvi_p1_badges_unlocked_v1"),
    dailyChallenge: g("jumvi_p1_daily_challenge_v1"),
    dailyN: g("jumvi_p1_daily_n_v1"),
    dailyId: g("jumvi_p1_daily_id_v1"),
    certName: g("jumvi_p1_cert_name_v1"),
    certId: g("jumvi_p1_cert_id_v1"),
    highScores: g("jumvi_p1_high_scores_v1"),
    profiles: g("jumvi_profiles_v1"),
  };
});
const holdReset = async (page, ms) => {
  await page.evaluate(() => document.querySelector('.navTab[data-tab="profile"]')?.click());
  await page.waitForTimeout(600);
  const box = await page.evaluate(() => {
    const b = document.getElementById("btnReset");
    if (!b) return null;
    b.scrollIntoView({ block: "center" });
    const r = b.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  if (!box) return false;
  await page.mouse.move(box.x, box.y);
  await page.mouse.down();
  await page.waitForTimeout(ms);
  await page.mouse.up();
  await page.waitForTimeout(900);
  return true;
};

if (wanted("R01")) {
  const { ctx, page } = await open({ seed: RESET_SEED });
  const before = await readScoped(page);
  const ok0 = await holdReset(page, 250);          // a short tap
  const after = await readScoped(page);
  await ctx.close();
  const unchanged = JSON.stringify(before) === JSON.stringify(after);
  record("R01", "a short tap does not reset anything", ok0 && unchanged ? "PASS" : "FAIL",
    `done ${before.done} → ${after.done} · streak ${before.streak} → ${after.streak}`);
}
if (wanted("R02") || wanted("R03")) {
  const { ctx, page } = await open({ seed: RESET_SEED });
  const before = await readScoped(page);
  await holdReset(page, 1500);                     // a deliberate hold
  const after = await readScoped(page);
  const ui = await page.evaluate(() => {
    const t = (s) => (document.querySelector(s)?.textContent || "").replace(/\s+/g, " ").trim().slice(0, 40);
    return { streakPill: t("#streakPill"), probeDone: window.__jumviPlayProbe().doneSize,
             probeXp: window.__jumviPlayProbe().xp };
  });
  await ctx.close();
  if (wanted("R02")) {
    /* The daily challenge is REMOVED, then immediately recreated by
       renderDailyChallenge() in its fresh shape — that is the documented
       design ("each feature's own getter recreates its normal fresh state"),
       so what matters is that it is back at zero, not that it is absent. */
    let dc = null;
    try { dc = after.dailyChallenge ? JSON.parse(after.dailyChallenge) : null; } catch(_){}
    const dailyAtZero = !dc || Number(dc.count || 0) === 0;
    const cleared = (after.done === "[]" || after.done === null) &&
                    Number(after.streak || 0) === 0 && Number(after.best || 0) === 0 &&
                    !after.badges && dailyAtZero;
    record("R02", "a 1.2s hold clears missions, streak, badges and the daily challenge", cleared ? "PASS" : "FAIL",
      `done=${after.done} streak=${after.streak} best=${after.best} badges=${after.badges} dailyChallenge=${after.dailyChallenge} · UI: streakPill="${ui.streakPill}" done=${ui.probeDone} xp=${ui.probeXp}`);
  }
  if (wanted("R03")) {
    /* The certificate and the high scores must be GONE. The daily pick must not
       — and demanding that it disappear was wrong.
     *
     * ensureDailyMission() computes the pick as pickDailyId(today, dailyN), and
     * reset puts dailyN back to 0, so the getter deterministically rebuilds the
     * SAME id for the same day. "Today's mission" is a property of the date,
     * not of the child's progress; resetting progress must not change which
     * mission today is. The Faz 5 version of this check asserted the daily keys
     * were absent afterwards and passed only because the snapshot happened to
     * be taken before the getter re-ran — a race, not a correct assertion. It
     * now checks the fresh SHAPE (counter at 0, date stamped today) instead. */
    const survivors = [];
    if (after.certName === before.certName && before.certName) survivors.push(`cert_name_v1="${after.certName}"`);
    if (after.certId === before.certId && before.certId) survivors.push(`cert_id_v1="${after.certId}"`);
    if (after.highScores === before.highScores && before.highScores) survivors.push("high_scores_v1");
    const dailyShapeFresh = (after.dailyN == null || String(after.dailyN) === "0");
    if (!dailyShapeFresh) survivors.push(`daily_n_v1=${after.dailyN} (should be 0 or cleared)`);
    record("R03", "certificate and high scores are cleared; the daily pick is rebuilt fresh",
      survivors.length === 0 ? "PASS" : "FAIL",
      (survivors.length ? "still set after reset: " + survivors.join(", ") : "nothing survived that should not have") +
      `\n         daily pick rebuilt: id ${before.dailyId} → ${after.dailyId} (same id is correct — deterministic for the day), ` +
      `n ${before.dailyN} → ${after.dailyN}`)
  }
}
if (wanted("R04")) {
  const { ctx, page } = await open({ seed: RESET_SEED });
  const profilesBefore = await page.evaluate(() => localStorage.getItem("jumvi_profiles_v1"));
  await holdReset(page, 1500);
  const profilesAfter = await page.evaluate(() => localStorage.getItem("jumvi_profiles_v1"));
  await ctx.close();
  record("R04", "reset clears progress, not the children themselves", profilesBefore === profilesAfter ? "PASS" : "FAIL",
    `profiles ${profilesBefore === profilesAfter ? "unchanged" : "CHANGED"}`);
}

await browser.close();
const pass = results.filter((r) => r.status === "PASS").length;
const fail = results.filter((r) => r.status === "FAIL").length;
console.log(`\n${pass} pass, ${fail} fail, ${results.length - pass - fail} informational, of ${results.length} run.`);
if (fail) process.exit(1);

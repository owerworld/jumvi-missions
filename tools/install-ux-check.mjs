#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
 * install-ux-check.mjs — "Keep JUMVI on this phone" across install states.
 *
 * The Add-to-Home-Screen path is the one feature whose behaviour depends on
 * things a browser will not hand you on demand: whether beforeinstallprompt
 * fires, whether the app is already standalone, whether the platform can
 * install at all. So each state is constructed deterministically — a synthetic
 * BeforeInstallPromptEvent, an emulated display-mode, a spoofed iOS platform —
 * and the two surfaces are asserted against it.
 *
 * What it is really guarding is a promise: JUMVI never shows a dead install
 * button, never nags a family that has not played yet, and never contradicts
 * "No app · No account · No ads".
 *
 *   node tools/install-ux-check.mjs [--base=URL]
 *
 * Exit 1 if any case fails.
 * ═══════════════════════════════════════════════════════════════════════════ */
import { createRequire } from "node:module";
const require_ = createRequire(import.meta.url);
const loadPw = () => {
  const spec = process.env.JUMVI_PW_CHROMIUM || process.env.JUMVI_PW || "playwright";
  try { return require_(spec).chromium; }
  catch { console.error(`Playwright not found (tried "${spec}"). Set JUMVI_PW.`); process.exit(2); }
};
const argVal = (n, d) => {
  const hit = process.argv.slice(2).find(a => a.startsWith(`--${n}=`));
  return hit ? hit.slice(n.length + 3) : d;
};
const BASE = argVal("base", "http://localhost:8911");

const chromium = loadPw();
const browser = await chromium.launch();
let FAILED = 0;

/* A real BeforeInstallPromptEvent cannot be summoned in a test, so this stands
 * in for one: same shape, same single-use contract, and it records whether the
 * app called prompt() so "no auto-trigger" can actually be asserted. */
const FAKE_PROMPT = (outcome) => `
  window.__promptCalls = 0;
  const e = new Event("beforeinstallprompt");
  e.prompt = () => { window.__promptCalls++; return Promise.resolve(); };
  e.userChoice = Promise.resolve({ outcome: ${JSON.stringify(outcome)}, platform: "web" });
  window.__fireInstallPrompt = () => window.dispatchEvent(e);
`;

async function scenario(name, opts, assertions) {
  const {
    standalone = false, iosPlatform = false, promptAvailable = false,
    promptOutcome = "accepted", missionsDone = 0, nudgeDismissed = false,
    theme = "light",
  } = opts;

  const ctx = await browser.newContext({
    viewport: { width: 393, height: 852 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
    userAgent: iosPlatform
      ? "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0 Mobile/15E148 Safari/604.1"
      : undefined,
  });

  await ctx.addInitScript(([iosP, sa, dism, dones, th, promptSrc]) => {
    try {
      localStorage.setItem("jumvi_theme_v1", th);
      localStorage.setItem("jumvi_onboarded_v2", "1");
      localStorage.setItem("jumvi_profiles_v1", JSON.stringify([{ id: "p1", name: "Ali", avatar: "monkey", createdAt: new Date().toISOString() }]));
      localStorage.setItem("jumvi_active_profile_v1", "p1");
      if (dones.length) localStorage.setItem("jumvi_p1_missions_done_v3", JSON.stringify(dones));
      if (dism) localStorage.setItem("jumvi_a2hs_dismiss_v1", "1");
    } catch (_) {}
    if (iosP) {
      // iPadOS-style identification, so the platform branch is exercised
      // without relying on the UA string alone.
      Object.defineProperty(navigator, "maxTouchPoints", { get: () => 5, configurable: true });
    }
    if (sa) Object.defineProperty(navigator, "standalone", { get: () => true, configurable: true });
    if (promptSrc) eval(promptSrc);
  }, [iosPlatform, standalone, nudgeDismissed, Array.from({ length: missionsDone }, (_, i) => i + 1), theme,
      promptAvailable ? FAKE_PROMPT(promptOutcome) : ""]);

  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(String(e.message).slice(0, 100)));
  await page.route("**/api/beacon", r => r.fulfill({ status: 204, body: "" }));

  if (standalone) {
    const cdp = await ctx.newCDPSession(page);
    await cdp.send("Emulation.setEmulatedMedia", { media: "screen", features: [{ name: "display-mode", value: "standalone" }] });
  }

  await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1400);
  if (promptAvailable) {
    await page.evaluate(() => window.__fireInstallPrompt());
    await page.waitForTimeout(250);
  }

  const api = {
    page,
    /* RENDERED visibility, not the `hidden` property.
     *
     * The property was all this asserted originally, and it passed 12/12 while
     * both surfaces were in fact laid out on screen: `hidden` is a UA-level
     * display:none, and .keepCard / .profileQuickLink each set an author-level
     * display:flex that beats it. The attribute was correct and the pixels
     * disagreed. Anything that claims a surface is hidden or shown now has to
     * survive computed style and a real box.
     *
     * A hidden ancestor counts too — an element inside a display:none tab
     * panel is not visible to a family, whatever its own styles say. */
    async state() {
      return page.evaluate(() => {
        const rendered = (el) => {
          if (!el) return false;
          if (!el.getClientRects().length) return false;      // covers hidden ancestors
          const cs = getComputedStyle(el);
          const r = el.getBoundingClientRect();
          return r.width > 1 && r.height > 1 &&
                 cs.display !== "none" && cs.visibility !== "hidden" && parseFloat(cs.opacity) > 0.05;
        };
        const detail = (el) => {
          if (!el) return { exists: false };
          const cs = getComputedStyle(el);
          const r = el.getBoundingClientRect();
          return { exists: true, hiddenProp: el.hidden, display: cs.display, visibility: cs.visibility,
                   opacity: cs.opacity, w: Math.round(r.width), h: Math.round(r.height), rendered: rendered(el) };
        };
        const row = document.getElementById("btnKeepOnPhone");
        const card = document.getElementById("keepCard");
        const dlg = document.getElementById("installDlg");
        return {
          installState: typeof installState === "function" ? installState() : "(missing)",
          adultsRowVisible: rendered(row),
          nudgeVisible: rendered(card),
          dialogOpen: rendered(dlg),
          rowDetail: detail(row), cardDetail: detail(card),
          promptCalls: window.__promptCalls || 0,
          dismissFlag: localStorage.getItem("jumvi_a2hs_dismiss_v1"),
        };
      });
    },
    /* The Adults row lives inside #tabProfile, which is display:none while the
     * family is on Play — so its visibility can only honestly be judged from
     * that tab. Measuring it from Today reports "not rendered" for every state
     * and proves nothing. */
    async rowStateOnAdultsTab() {
      await page.evaluate(() => document.querySelector('.navTab[data-tab="profile"]')?.click());
      await page.waitForTimeout(650);
      const s = await api.state();
      await page.evaluate(() => document.querySelector('.navTab[data-tab="today"]')?.click());
      await page.waitForTimeout(500);
      return s;
    },
    goTab: async (t) => { await page.evaluate(x => document.querySelector(`.navTab[data-tab="${x}"]`)?.click(), t); await page.waitForTimeout(600); },
    tapAdultsRow: async () => { await page.evaluate(() => document.getElementById("btnKeepOnPhone")?.click()); await page.waitForTimeout(700); },
    tapNudgeAdd: async () => { await page.evaluate(() => document.getElementById("btnKeepAdd")?.click()); await page.waitForTimeout(700); },
    tapNudgeLater: async () => { await page.evaluate(() => document.getElementById("btnKeepLater")?.click()); await page.waitForTimeout(400); },
    /* Completes through the app's own state transition. Tapping #btnToggleDone
     * is not usable here: the button is gated behind the real play timer, so a
     * synthetic click is correctly ignored and nothing would be marked done. */
    completeMission: async (id) => {
      await page.evaluate(i => window.openMission(i), id);
      await page.waitForTimeout(600);
      await page.evaluate(i => markMissionDone(i, "manual"), id);
      await page.waitForTimeout(900);
      await page.evaluate(() => document.getElementById("btnClose")?.click());
      await page.waitForTimeout(900);
      // The completion moment owns badge/reward modals; dismiss anything still
      // up so the assertion is about a normal screen, as a family would see.
      await page.evaluate(() => {
        document.querySelectorAll(".backdrop.show").forEach(b => b.classList.remove("show"));
        document.body.classList.remove("modalOpen");
        if (typeof renderInstallSurfaces === "function") renderInstallSurfaces();
      });
      await page.waitForTimeout(300);
    },
    fireAppInstalled: async () => { await page.evaluate(() => window.dispatchEvent(new Event("appinstalled"))); await page.waitForTimeout(300); },
  };

  const results = [];
  const expect = (label, ok, detail) => { results.push({ label, ok, detail }); if (!ok) FAILED++; };
  await assertions(api, expect);

  if (errors.length) expect("no console errors", false, errors[0]);
  console.log(`\n${name}`);
  results.forEach(r => console.log(`   ${r.ok ? "PASS" : "FAIL"}  ${r.label}${r.detail !== undefined ? "   " + r.detail : ""}`));
  await ctx.close();
}

/* ── A · iPhone Safari, not installed, nothing played ─────────────────────── */
await scenario("A · iOS, not installed, no mission finished", { iosPlatform: true }, async (t, expect) => {
  const s = await t.state();
  const a = await t.rowStateOnAdultsTab();
  expect("classified as ios-manual", s.installState === "ios-manual", s.installState);
  expect("Adults row RENDERS on Adults", a.adultsRowVisible, JSON.stringify(a.rowDetail));
  expect("no nudge before a first completion", !s.nudgeVisible, JSON.stringify(s.cardDetail));
});

/* ── B · already installed ────────────────────────────────────────────────── */
await scenario("B · iOS standalone (already installed)", { iosPlatform: true, standalone: true, missionsDone: 3 }, async (t, expect) => {
  const s = await t.state();
  const a = await t.rowStateOnAdultsTab();
  expect("classified as standalone", s.installState === "standalone", s.installState);
  expect("Adults row NOT rendered even on Adults", !a.adultsRowVisible, JSON.stringify(a.rowDetail));
  expect("nudge NOT rendered", !s.nudgeVisible, JSON.stringify(s.cardDetail));
});

/* ── C · iOS non-Safari browser still gets guidance ───────────────────────── */
await scenario("C · iOS Chrome-family UA — guidance, not silence", { iosPlatform: true, missionsDone: 1 }, async (t, expect) => {
  const s = await t.state();
  const a = await t.rowStateOnAdultsTab();
  expect("still classified ios-manual (not Safari-gated)", s.installState === "ios-manual", s.installState);
  expect("Adults row RENDERS on Adults", a.adultsRowVisible, JSON.stringify(a.rowDetail));
  await t.tapAdultsRow();
  const after = await t.state();
  expect("tapping opens the guidance dialog", after.dialogOpen);
  expect("no native prompt was faked on iOS", after.promptCalls === 0);
});

/* ── D · Android with beforeinstallprompt ─────────────────────────────────── */
await scenario("D · Android, beforeinstallprompt available", { promptAvailable: true }, async (t, expect) => {
  const s = await t.state();
  const a = await t.rowStateOnAdultsTab();
  expect("classified as prompt", s.installState === "prompt", s.installState);
  expect("Adults row RENDERS on Adults", a.adultsRowVisible, JSON.stringify(a.rowDetail));
  expect("prompt NOT auto-triggered on load", s.promptCalls === 0);
});

/* ── E · prompt accepted ──────────────────────────────────────────────────── */
await scenario("E · Android, user accepts the prompt", { promptAvailable: true, promptOutcome: "accepted" }, async (t, expect) => {
  await t.tapAdultsRow();
  const s = await t.state();
  expect("prompt() called exactly once, from the tap", s.promptCalls === 1, `calls=${s.promptCalls}`);
  const a = await t.rowStateOnAdultsTab();
  expect("surfaces NOT rendered after acceptance", !a.adultsRowVisible && !s.nudgeVisible, JSON.stringify(a.rowDetail));
  expect("state is standalone", s.installState === "standalone", s.installState);
});

/* ── F · prompt dismissed ─────────────────────────────────────────────────── */
await scenario("F · Android, user dismisses the prompt", { promptAvailable: true, promptOutcome: "dismissed" }, async (t, expect) => {
  await t.tapAdultsRow();
  const s = await t.state();
  expect("prompt() called once", s.promptCalls === 1, `calls=${s.promptCalls}`);
  expect("no dead button left behind (event is single-use)", s.installState === "none", s.installState);
  const a = await t.rowStateOnAdultsTab();
  expect("Adults row NOT rendered rather than dead", !a.adultsRowVisible, JSON.stringify(a.rowDetail));
});

/* ── G · appinstalled ─────────────────────────────────────────────────────── */
await scenario("G · appinstalled fires", { promptAvailable: true, missionsDone: 1 }, async (t, expect) => {
  await t.fireAppInstalled();
  const s = await t.state();
  const a = await t.rowStateOnAdultsTab();
  expect("both surfaces stop rendering without a reload", !a.adultsRowVisible && !s.nudgeVisible, JSON.stringify(a.rowDetail));
  expect("state is standalone", s.installState === "standalone", s.installState);
});

/* ── H · no install path at all ───────────────────────────────────────────── */
await scenario("H · desktop/other, no prompt and not iOS", { missionsDone: 2 }, async (t, expect) => {
  const s = await t.state();
  const a = await t.rowStateOnAdultsTab();
  expect("classified as none", s.installState === "none", s.installState);
  expect("Adults row NOT rendered (no dead CTA)", !a.adultsRowVisible, JSON.stringify(a.rowDetail));
  expect("no nudge rendered", !s.nudgeVisible, JSON.stringify(s.cardDetail));
});

/* ── I · nudge previously dismissed ───────────────────────────────────────── */
await scenario("I · nudge dismissed earlier", { iosPlatform: true, missionsDone: 2, nudgeDismissed: true }, async (t, expect) => {
  const s = await t.state();
  const a = await t.rowStateOnAdultsTab();
  expect("nudge stays away", !s.nudgeVisible, JSON.stringify(s.cardDetail));
  expect("Adults row STILL renders", a.adultsRowVisible, JSON.stringify(a.rowDetail));
});

/* ── J+K · the engagement gate ────────────────────────────────────────────── */
await scenario("J+K · first completion unlocks the nudge", { iosPlatform: true, missionsDone: 0 }, async (t, expect) => {
  let s = await t.state();
  expect("J · nudge NOT RENDERED before playing", !s.nudgeVisible, JSON.stringify(s.cardDetail));
  await t.completeMission(18);
  s = await t.state();
  expect("K · nudge RENDERS after the first completion", s.nudgeVisible, JSON.stringify(s.cardDetail));
  expect("it is inline, not fixed/overlaying", await t.page.evaluate(() => {
    const c = document.getElementById("keepCard");
    return getComputedStyle(c).position === "static";
  }));
  expect("it sits BELOW the play CTA on the page", await t.page.evaluate(() => {
    const c = document.getElementById("keepCard").getBoundingClientRect();
    const play = document.getElementById("btnDailyPlay");
    return !play || c.top > play.getBoundingClientRect().top;
  }));
  await t.tapNudgeLater();
  s = await t.state();
  expect("'Maybe later' stops it rendering and records the choice", !s.nudgeVisible && s.dismissFlag === "1", JSON.stringify(s.cardDetail));
  await t.goTab("browse"); await t.goTab("today");
  s = await t.state();
  expect("it does not come back on its own", !s.nudgeVisible, JSON.stringify(s.cardDetail));
  const a = await t.rowStateOnAdultsTab();
  expect("Adults row still RENDERS afterwards", a.adultsRowVisible, JSON.stringify(a.rowDetail));
});

/* ── L · nudge is never shown over a modal ────────────────────────────────── */
await scenario("L · nudge suppressed while a mission sheet is open", { iosPlatform: true, missionsDone: 1 }, async (t, expect) => {
  await t.page.evaluate(() => window.openMission(18));
  await t.page.waitForTimeout(700);
  const s = await t.state();
  expect("not rendered while the sheet is open", !s.nudgeVisible, JSON.stringify(s.cardDetail));
  await t.page.evaluate(() => document.getElementById("btnClose")?.click());
  await t.page.waitForTimeout(800);
  const after = await t.state();
  expect("renders again once back on a normal screen", after.nudgeVisible, JSON.stringify(after.cardDetail));
});

/* ── dark theme ───────────────────────────────────────────────────────────── */
await scenario("M · dark theme surfaces render", { iosPlatform: true, missionsDone: 1, theme: "dark" }, async (t, expect) => {
  const s = await t.state();
  expect("nudge renders in dark", s.nudgeVisible, JSON.stringify(s.cardDetail));
  await t.tapAdultsRow();
  const contrast = await t.page.evaluate(() => {
    const dlg = document.getElementById("installDlg");
    if (!dlg || dlg.hidden) return null;
    const title = dlg.querySelector(".installDlgTitle");
    const panel = dlg.querySelector(".installDlgPanel");
    return { titleColor: getComputedStyle(title).color, panelBg: getComputedStyle(panel).backgroundColor };
  });
  expect("guidance dialog opens and is painted in dark", !!contrast && contrast.panelBg !== "rgba(0, 0, 0, 0)", JSON.stringify(contrast));
});

console.log(FAILED ? `\n${FAILED} ASSERTION(S) FAILED` : "\nINSTALL UX: ALL CASES PASS");
await browser.close();
process.exit(FAILED ? 1 : 0);

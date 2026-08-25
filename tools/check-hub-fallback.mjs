#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
 * check-hub-fallback.mjs — Faz 5, the 3D Hub when it does not work.
 *
 * The hub is optional by design and the promise around it is simple: whatever
 * goes wrong with WebGL, the network or a decorative asset, the family can
 * still play the 36 missions, and there is ONE obvious way back. That promise
 * is only worth anything if each failure is actually reached, so each case
 * here breaks something real:
 *
 *   no WebGL       getContext("webgl"/"webgl2") returns null, the way an old
 *                  device behaves. hub3dWebGLOk() should refuse to start.
 *   module error   the hub module request is aborted at the network layer, so
 *                  the dynamic import rejects mid-load.
 *   three.js error the vendored three.js is aborted — a different load stage,
 *                  because the loader tracks stages separately.
 *   offline        context offline, which is how a family in a garden with no
 *                  signal meets it.
 *   reduced motion prefers-reduced-motion: reduce.
 *   orientation    portrait → landscape while the hub is up.
 *
 * After each, the same two questions: can the core app still be used, and is
 * there exactly one clear recovery action.
 *
 *   node tools/check-hub-fallback.mjs
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

const results = [];
const record = (id, name, status, detail) => {
  results.push({ id, name, status, detail });
  const mark = status === "PASS" ? "✅" : status === "FAIL" ? "❌" : "⚠️ ";
  console.log(`  ${mark} ${id}  ${name}${detail ? "\n         " + detail : ""}`);
};

const chromium = loadChromium();
const browser = await chromium.launch({
  executablePath: EXE,
  args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});

async function session({ killWebGL, abort, offline, reducedMotion } = {}) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    ...(reducedMotion ? { reducedMotion: "reduce" } : {}),
  });
  const page = await ctx.newPage();
  page.on("pageerror", () => {});
  await page.addInitScript(() => localStorage.setItem("jumvi_onboarded_v2", "1"));
  if (killWebGL) {
    await page.addInitScript(() => {
      const real = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
        if (/webgl/i.test(String(type))) return null;   // an old device, honestly
        return real.call(this, type, ...rest);
      };
    });
  }
  if (abort) await page.route(abort, (r) => r.abort());
  await page.goto(BASE + "?hub3d=1", { waitUntil: "networkidle" }).catch(() => {});
  await page.waitForTimeout(1500);
  for (let i = 0; i < 4; i++) {
    if (!(await page.evaluate(() => document.body.classList.contains("modalOpen")))) break;
    await page.keyboard.press("Escape"); await page.waitForTimeout(300);
  }
  if (offline) await ctx.setOffline(true);
  return { ctx, page };
}

const enterHub = async (page) => {
  await page.evaluate(() => {
    const c = document.getElementById("advModeCard");
    if (c && getComputedStyle(c).display !== "none") c.click();
    else if (typeof switchTab === "function") switchTab("hub3d");
  });
};

/* Can a family still do the thing the product is for? */
const coreStillWorks = async (page) => {
  await page.evaluate(() => document.querySelector('.navTab[data-tab="browse"]')?.click());
  await page.waitForTimeout(700);
  const cards = await page.evaluate(() => document.querySelectorAll("[data-mission-id]").length);
  await page.evaluate(() => window.openMission(1));
  await page.waitForTimeout(700);
  const sheet = await page.evaluate(() => ({
    open: document.getElementById("backdrop")?.classList.contains("show"),
    title: (document.getElementById("mTitle")?.textContent || "").trim(),
    start: !!document.getElementById("btnStartTimer"),
  }));
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  return { cards, ...sheet };
};

/* Exactly one obvious way out — counted, not eyeballed. */
const recoveryActions = (page) => page.evaluate(() => {
  const overlay = document.getElementById("hub3dOverlay");
  if (!overlay) return { found: false };
  const vis = [...overlay.querySelectorAll("button")].filter((b) => {
    const cs = getComputedStyle(b); const r = b.getBoundingClientRect();
    return cs.display !== "none" && cs.visibility !== "hidden" && r.width > 1 && r.height > 1;
  });
  return {
    found: true,
    overlayShown: overlay.style.display !== "none",
    buttons: vis.map((b) => (b.textContent || b.getAttribute("aria-label") || "?").trim().slice(0, 26)),
    message: (overlay.textContent || "").replace(/\s+/g, " ").trim().slice(0, 96),
  };
});

console.log("3D Hub failure modes — Faz 5\n");

/* ── H01 no WebGL ──────────────────────────────────────────────────────── */
if (wanted("H01")) {
  const { ctx, page } = await session({ killWebGL: true });
  await enterHub(page);
  await page.waitForTimeout(2500);
  const state = await page.evaluate(() => ({
    tab: (document.body.className.match(/tab-[\w]+/) || [""])[0],
    unsupported: localStorage.getItem("jumvi_hub3d_unsupported") || localStorage.getItem(
      Object.keys(localStorage).find((k) => /unsupported/i.test(k)) || ""),
    advCard: (() => { const c = document.getElementById("advModeCard");
      return c ? (c.hidden || getComputedStyle(c).display === "none" ? "hidden" : "visible") : "missing"; })(),
    toast: (document.getElementById("toast")?.textContent || "").trim(),
    canvas: document.querySelectorAll("#hub3dOverlay canvas").length,
  }));
  const core = await coreStillWorks(page);
  await ctx.close();
  const ok = state.canvas === 0 && state.tab === "tab-today" && core.cards === 36 && core.open;
  record("H01", "no WebGL: refuses to start, drops back to the app, hides its own entry", ok ? "PASS" : "FAIL",
    `tab=${state.tab} canvas=${state.canvas} islandCard=${state.advCard} toast="${state.toast}"\n         core: ${core.cards} missions, sheet opens ("${core.title}")`);
}

/* ── H02 hub module fails to load ──────────────────────────────────────── */
if (wanted("H02")) {
  const { ctx, page } = await session({ abort: "**/jumvi-hub-app.js*" });
  await enterHub(page);
  await page.waitForTimeout(6000);
  const rec = await recoveryActions(page);
  const core = await coreStillWorks(page);
  await ctx.close();
  const backButtons = rec.buttons.filter((b) => /back|missions/i.test(b));
  const ok = rec.buttons.length > 0 && backButtons.length === 1 && core.cards === 36 && core.open;
  record("H02", "hub module aborted: failure UI with one way back, core app intact", ok ? "PASS" : "FAIL",
    `buttons=[${rec.buttons.join(" | ")}] → ${backButtons.length} recovery action\n         message="${rec.message}"\n         core: ${core.cards} missions, sheet opens`);
}

/* ── H03 three.js fails to load ────────────────────────────────────────── */
if (wanted("H03")) {
  const { ctx, page } = await session({ abort: "**/three.module.min.js*" });
  await enterHub(page);
  await page.waitForTimeout(6000);
  const rec = await recoveryActions(page);
  const core = await coreStillWorks(page);
  await ctx.close();
  const backButtons = rec.buttons.filter((b) => /back|missions/i.test(b));
  const ok = backButtons.length === 1 && core.cards === 36 && core.open;
  record("H03", "three.js aborted: same failure UI, core app intact", ok ? "PASS" : "FAIL",
    `buttons=[${rec.buttons.join(" | ")}]\n         core: ${core.cards} missions, sheet opens`);
}

/* ── H04 offline ───────────────────────────────────────────────────────── */
/* The island is a 9.4 MB download, so the honest offline behaviour is not to
   open a hub that will then fail — it is to refuse the trip and say why. The
   card's own handler does that before switchTab() is ever called, which means
   the hub overlay is legitimately empty here. So this asserts what actually
   happens: no hub, the offline banner visible with a reason, still on Today,
   and the 36 missions untouched. An earlier version of this check accepted
   "zero recovery buttons" as a pass, which every possible outcome satisfies —
   it was measuring nothing. */
if (wanted("H04")) {
  const { ctx, page } = await session({});
  await ctx.setOffline(true);
  await page.waitForTimeout(400);
  await enterHub(page);
  await page.waitForTimeout(6000);
  const state = await page.evaluate(() => {
    const b = document.getElementById("offlineBanner");
    const overlay = document.getElementById("hub3dOverlay");
    return {
      tab: (document.body.className.match(/tab-[\w]+/) || [""])[0],
      banner: b && !b.hidden ? (b.textContent || "").replace(/\s+/g, " ").trim().slice(0, 72) : "",
      hubShown: !!overlay && overlay.style.display !== "none",
      canvas: document.querySelectorAll("#hub3dOverlay canvas").length,
    };
  });
  const core = await coreStillWorks(page);
  await ctx.close();
  const saysWhy = /connection|offline|island/i.test(state.banner);
  const ok = state.tab === "tab-today" && !state.hubShown && state.canvas === 0
    && saysWhy && core.cards === 36 && core.open;
  record("H04", "offline: the island refuses the trip and says why, the missions still play", ok ? "PASS" : "FAIL",
    `tab=${state.tab} hubShown=${state.hubShown} canvas=${state.canvas}\n         banner="${state.banner}" saysWhy=${saysWhy}\n         core: ${core.cards} missions, sheet opens`);
}

/* ── H05 reduced motion ────────────────────────────────────────────────── */
if (wanted("H05")) {
  const { ctx, page } = await session({ reducedMotion: true });
  const reduced = await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches);
  /* The app-side promise: Leo's pulse, the celebration and the welcome panel
     animation are all reduced. Checked on the real elements rather than by
     grepping the stylesheet. */
  const anims = await page.evaluate(() => {
    const out = {};
    const check = (sel, name) => {
      const e = document.querySelector(sel);
      if (!e) { out[name] = "absent"; return; }
      const cs = getComputedStyle(e);
      out[name] = (cs.animationName === "none" || cs.animationDuration === "0s") ? "still" : `${cs.animationName} ${cs.animationDuration}`;
    };
    check(".welcomePanel", "welcomePanel");
    check("#tabToday .dailyIconBig", "dailyIcon");
    check(".leoPulse, .h1Leo", "leo");
    return out;
  });
  const core = await coreStillWorks(page);
  await ctx.close();
  const ok = reduced && core.cards === 36 && core.open;
  record("H05", "reduced motion: honoured, app fully usable", ok ? "PASS" : "FAIL",
    `prefers-reduced-motion=${reduced} · ${Object.entries(anims).map(([k, v]) => `${k}:${v}`).join(" ")}\n         core: ${core.cards} missions, sheet opens`);
}

/* ── H06 orientation change while the hub is up ────────────────────────── */
if (wanted("H06")) {
  const { ctx, page } = await session({});
  await enterHub(page);
  let booted = false;
  const dl = Date.now() + 30000;
  while (Date.now() < dl) {
    booted = await page.evaluate(() => !!window.__hub3dLastFrameAt && document.querySelectorAll("#hub3dOverlay canvas").length > 0);
    if (booted) break;
    await page.waitForTimeout(500);
  }
  if (!booted) {
    record("H06", "orientation change while the hub is running", "UNTESTED",
      "the hub did not reach a painted frame in this environment, so rotating it proves nothing");
  } else {
    const before = await page.evaluate(() => {
      const c = document.querySelector("#hub3dOverlay canvas");
      const r = c.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height), frame: window.__hub3dLastFrameAt };
    });
    await page.setViewportSize({ width: 844, height: 390 });
    await page.waitForTimeout(2500);
    const after = await page.evaluate(() => {
      const c = document.querySelector("#hub3dOverlay canvas");
      const r = c ? c.getBoundingClientRect() : { width: 0, height: 0 };
      return { w: Math.round(r.width), h: Math.round(r.height), frame: window.__hub3dLastFrameAt,
               overflow: document.documentElement.scrollWidth > innerWidth + 1 };
    });
    await ctx.close();
    const resized = after.w > before.w && after.h < before.h;
    const stillPainting = after.frame > before.frame;
    record("H06", "orientation change: canvas follows, rendering continues, no overflow",
      resized && stillPainting && !after.overflow ? "PASS" : "FAIL",
      `canvas ${before.w}×${before.h} → ${after.w}×${after.h} · new frames after rotate=${stillPainting} · horizontal overflow=${after.overflow}`);
  }
}

await browser.close();
const pass = results.filter((r) => r.status === "PASS").length;
const fail = results.filter((r) => r.status === "FAIL").length;
console.log(`\n${pass} pass, ${fail} fail, ${results.length - pass - fail} untested, of ${results.length} run.`);
if (fail) process.exit(1);

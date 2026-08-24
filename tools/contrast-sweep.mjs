#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
 * contrast-sweep.mjs — drives tools/contrast-audit.js over the whole app.
 *
 * contrast-audit.js is the measuring instrument: paste it into a page and it
 * reports every text node below WCAG AA. This is the thing that decides WHICH
 * pages to point it at, because a JUMVI contrast bug is almost never on the
 * first screen — it is on the certificate sheet, or the score pad inside a
 * mission, or one of the 36 illustrations, in dark mode only.
 *
 * Three sweeps, all at 390×844 unless stated:
 *   surfaces  4 tabs, welcome, mission sheets, every dialog        light+dark
 *   missions  all 36 mission sheets opened one by one              light+dark
 *   states    search open, playing, score pad, undo, install …     light+dark
 *             × 320 / 390 / 430 (surface tint can change with layout)
 *
 *   node tools/contrast-sweep.mjs                  → all three sweeps
 *   node tools/contrast-sweep.mjs --sweep=missions
 *   node tools/contrast-sweep.mjs --base=URL       → default localhost:8910
 *   node tools/contrast-sweep.mjs --json=OUT.json
 *
 * Serve the repo root first (npx http-server -p 8910 -c-1). Exits 1 if any
 * text fails AA, so it can gate a palette change.
 * ═══════════════════════════════════════════════════════════════════════════ */
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

const require_ = createRequire(import.meta.url);
const loadChromium = () => {
  const spec = process.env.JUMVI_PW || "playwright";
  try { return require_(spec).chromium; }
  catch {
    console.error(`Playwright not found (tried "${spec}"). Set JUMVI_PW to an install that has it.`);
    process.exit(2);
  }
};

const args = process.argv.slice(2);
const argVal = (n, d) => { const h = args.find(a => a.startsWith(`--${n}=`)); return h ? h.slice(n.length + 3) : d; };
const BASE = argVal("base", "http://localhost:8910/index.html");
const ONLY = argVal("sweep", "");
const JSON_OUT = argVal("json", "");
const EXE = process.env.JUMVI_EXE_CHROMIUM || undefined;

const AUDIT = fs.readFileSync(path.join(import.meta.dirname, "contrast-audit.js"), "utf8");

/* ── shared navigation ─────────────────────────────────────────────────── */
const settle = (p, ms) => p.waitForTimeout(ms);
const closeModals = async (p) => {
  for (let i = 0; i < 5; i++) {
    if (!(await p.evaluate(() => document.body.classList.contains("modalOpen")))) break;
    await p.keyboard.press("Escape");
    await settle(p, 400);
  }
};
const pastWelcome = async (p) => {
  await p.evaluate(() => [...document.querySelectorAll("#welcomeOverlay button")]
    .find((b) => /some practice/i.test(b.textContent || ""))?.click());
  await settle(p, 250);
  await p.evaluate(() => document.getElementById("btnWelcomeStart")?.click());
  await settle(p, 1400);
  await closeModals(p);
  await settle(p, 300);
};
const tab = async (p, n) => {
  await p.evaluate((x) => document.querySelector(`.navTab[data-tab="${x}"]`)?.click(), n);
  await settle(p, 900);
};
const expandPacks = async (p) => {
  await p.evaluate(() => document.querySelectorAll('.pathSectionHeader[aria-expanded="false"]').forEach((b) => b.click()));
  await settle(p, 700);
};
const showBackdrop = async (p, id) => {
  await p.evaluate((i) => document.getElementById(i)?.classList.add("show"), id);
  await settle(p, 600);
};
const openMission = async (p, id) => {
  await p.evaluate((i) => document.querySelector(`[data-mission-id="${i}"]`)?.click(), id);
  await settle(p, 900);
};

const boot = async (ctx, theme) => {
  const p = await ctx.newPage();
  p.on("pageerror", () => {});
  await p.goto(BASE, { waitUntil: "networkidle" }).catch(() => {});
  await settle(p, 1400);
  await p.evaluate((t) => {
    document.documentElement.classList.remove("theme--light", "theme--dark");
    document.documentElement.classList.add("theme--" + t);
  }, theme);
  /* Flipping the theme class starts a background-color transition on every
     themed surface. Measuring inside it reads a half-blended colour and
     reports failures that never appear on screen (the welcome level cards
     came back as 2.02:1 mid-blend and 15:1 once settled), so wait it out. */
  await settle(p, 700);
  return p;
};

/* ── sweep 1: every named surface ──────────────────────────────────────── */
const SURFACES = [
  ["Welcome overlay",      async () => {}],
  ["Play (today)",         async (p) => { await pastWelcome(p); await tab(p, "today"); }],
  ["Missions (all packs)", async (p) => { await pastWelcome(p); await tab(p, "browse"); await expandPacks(p); }],
  ["Family (modes)",       async (p) => { await pastWelcome(p); await tab(p, "modes"); }],
  ["Grown-ups",            async (p) => { await pastWelcome(p); await tab(p, "profile"); }],
  ["Badges dialog",        async (p) => { await pastWelcome(p); await showBackdrop(p, "badgesBackdrop"); }],
  ["Privacy dialog",       async (p) => { await pastWelcome(p); await showBackdrop(p, "privacyBackdrop"); }],
  ["Help dialog",          async (p) => { await pastWelcome(p); await showBackdrop(p, "helpBackdrop"); }],
  ["Certificate dialog",   async (p) => { await pastWelcome(p); await showBackdrop(p, "certBackdrop"); }],
  ["Profile dialog",       async (p) => { await pastWelcome(p); await showBackdrop(p, "profileBackdrop"); }],
  ["Team XP dialog",       async (p) => { await pastWelcome(p); await showBackdrop(p, "teamXpBackdrop"); }],
  ["Seasonal dialog",      async (p) => { await pastWelcome(p); await showBackdrop(p, "seasonalBackdrop"); }],
  ["3D fallback",          async (p) => { await pastWelcome(p); await showBackdrop(p, "fallbackBackdrop"); }],
];

/* ── sweep 3: states that only exist mid-interaction ───────────────────── */
const STATES = [
  ["Missions + search open", async (p) => {
    await pastWelcome(p); await tab(p, "browse");
    await p.evaluate(() => document.getElementById("searchToggleBtn")?.click()); await settle(p, 500);
    await p.evaluate(() => document.getElementById("btnToggleFilters")?.click()); await settle(p, 600);
  }],
  ["Mission sheet playing", async (p) => {
    await pastWelcome(p); await tab(p, "browse"); await expandPacks(p); await openMission(p, 1);
    await p.evaluate(() => document.getElementById("btnStartTimer")?.click()); await settle(p, 2500);
  }],
  ["Score tracker", async (p) => {
    await pastWelcome(p); await tab(p, "browse"); await expandPacks(p); await openMission(p, 1);
    await p.evaluate(() => { const e = document.getElementById("scoreTracker"); if (e) { e.hidden = false; e.style.display = ""; } });
    await settle(p, 500);
  }],
  ["Undo bar", async (p) => {
    await pastWelcome(p);
    await p.evaluate(() => { const e = document.getElementById("undoBar"); if (e) { e.hidden = false; e.classList.add("show"); e.style.display = ""; } });
    await settle(p, 500);
  }],
  ["Tutorial overlay", async (p) => { await pastWelcome(p); await showBackdrop(p, "tutorialOverlay"); }],
  ["Badge unlock",     async (p) => { await pastWelcome(p); await p.evaluate(() => { const e = document.getElementById("badgeUnlockModal"); if (e) { e.classList.add("show"); e.hidden = false; } }); await settle(p, 600); }],
  ["3D hub overlay",   async (p) => { await pastWelcome(p); await p.evaluate(() => { const e = document.getElementById("hub3dOverlay"); if (e) { e.classList.add("show"); e.hidden = false; } }); await settle(p, 900); }],
];

/* ── runner ────────────────────────────────────────────────────────────── */
const results = [];
const record = (row, res) => {
  results.push({ ...row, checked: res.checked, failCount: res.failCount, fails: res.fails });
  const head = `[${row.theme}${row.width ? " " + row.width : ""}] ${row.surface}`;
  if (res.failCount) {
    console.log(`${head}: ${res.failCount} fail(s) of ${res.checked} checked`);
    for (const f of res.fails) {
      console.log(`   ${String(f.ratio).padStart(5)}:1  ${f.px}px${f.large ? " (large)" : ""}  ${f.fg} on ${f.bg}  .${f.cls}  "${f.txt}"`);
    }
  } else {
    console.log(`${head}: ok (${res.checked} checked)`);
  }
};

const chromium = loadChromium();
const browser = await chromium.launch({ executablePath: EXE });
const run = (name) => !ONLY || ONLY === name;

if (run("surfaces")) {
  console.log("\n── sweep: surfaces ──");
  for (const theme of ["light", "dark"]) {
    for (const [surface, act] of SURFACES) {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: theme });
      const p = await boot(ctx, theme);
      try { await act(p); } catch (e) { console.log(`   ! ${surface}: ${String(e).slice(0, 70)}`); }
      await p.addScriptTag({ content: AUDIT });
      record({ theme, surface }, await p.evaluate(() => window.__contrastAudit()));
      await ctx.close();
    }
  }
}

if (run("missions")) {
  console.log("\n── sweep: 36 mission sheets ──");
  for (const theme of ["light", "dark"]) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: theme });
    const p = await boot(ctx, theme);
    await pastWelcome(p);
    await tab(p, "browse");
    await expandPacks(p);
    await p.addScriptTag({ content: AUDIT });
    for (let id = 1; id <= 36; id++) {
      const opened = await p.evaluate((i) => { const el = document.querySelector(`[data-mission-id="${i}"]`); if (!el) return false; el.click(); return true; }, id);
      if (!opened) { console.log(`[${theme}] mission ${id}: card not found`); continue; }
      await settle(p, 650);
      const res = await p.evaluate(() => window.__contrastAudit());
      results.push({ theme, surface: `mission ${id}`, checked: res.checked, failCount: res.failCount, fails: res.fails });
      if (res.failCount) {
        console.log(`[${theme}] mission ${id}: ${res.failCount} fail(s)`);
        for (const f of res.fails) console.log(`   ${f.ratio}:1  ${f.px}px  ${f.fg} on ${f.bg}  .${f.cls}  "${f.txt}"`);
      }
      await p.keyboard.press("Escape");
      await settle(p, 450);
      await closeModals(p);
    }
    console.log(`[${theme}] 36 sheets swept`);
    await ctx.close();
  }
}

if (run("states")) {
  console.log("\n── sweep: interaction states ──");
  for (const theme of ["light", "dark"]) {
    for (const width of [320, 390, 430]) {
      for (const [surface, act] of STATES) {
        const ctx = await browser.newContext({ viewport: { width, height: width === 320 ? 568 : 844 }, colorScheme: theme });
        const p = await boot(ctx, theme);
        try { await act(p); } catch (e) { console.log(`   ! ${surface}: ${String(e).slice(0, 70)}`); }
        await p.addScriptTag({ content: AUDIT });
        record({ theme, width, surface }, await p.evaluate(() => window.__contrastAudit()));
        await ctx.close();
      }
    }
  }
}

await browser.close();

const total = results.reduce((a, r) => a + r.failCount, 0);
const checked = results.reduce((a, r) => a + r.checked, 0);
if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify(results, null, 2));
console.log(`\n${results.length} surface passes, ${checked} text nodes measured, ${total} below WCAG AA.`);
process.exit(total ? 1 : 0);

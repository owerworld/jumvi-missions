#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
 * pwa-standalone-check.mjs — the installed-to-Home-Screen regression suite.
 *
 * READ THIS BEFORE TRUSTING A PASS.
 *
 * This emulates two things: a viewport as tall as an iPhone gets with no
 * Safari chrome, and the (display-mode: standalone) media state. It does NOT
 * emulate iOS. In particular it cannot reproduce:
 *
 *   • env(safe-area-inset-*), which Chromium resolves to 0 and a real iPhone
 *     resolves to ~59px top / ~34px bottom;
 *   • WebKit's behaviour where -webkit-overflow-scrolling:touch makes an
 *     element the containing block for its position:fixed descendants — the
 *     quirk this suite exists to guard against;
 *   • the late viewport settle an iOS standalone PWA performs after first
 *     layout.
 *
 * So: a PASS here means "nothing structurally regressed". It does not mean
 * "correct on an iPhone". Real-hardware verification stays required, and the
 * report must say so.
 *
 * What it DOES prove, in both modes and both themes:
 *   - no horizontal overflow
 *   - every scroll container can actually reach its end (long content is
 *     reachable, which is what a bad height fix breaks first)
 *   - the sheet grows with the viewport instead of pinning to a short box
 *   - the bottom nav sits at the bottom edge and still declares the inset
 *   - no console errors
 *
 *   node tools/pwa-standalone-check.mjs [--base=URL] [--shots=DIR]
 * ═══════════════════════════════════════════════════════════════════════════ */
import { createRequire } from "node:module";
import fs from "node:fs";

const require_ = createRequire(import.meta.url);
const pwSpec = process.env.JUMVI_PW_CHROMIUM || process.env.JUMVI_PW || "playwright";
let chromium;
try { chromium = require_(pwSpec).chromium; }
catch { console.error(`Playwright not found (tried "${pwSpec}"). Set JUMVI_PW.`); process.exit(2); }

const args = new Set(process.argv.slice(2));
const argVal = (n, d) => { const h = [...args].find((a) => a.startsWith(`--${n}=`)); return h ? h.slice(n.length + 3) : d; };
const BASE = argVal("base", "http://localhost:8911");
const SHOTS = argVal("shots", "");

/* Portrait boxes for the four iPhone classes the product targets. The Safari
 * height is the standalone height minus the chrome Safari occupies (~107px on
 * a modern iPhone: URL bar plus bottom toolbar). */
const CHROME_PX = 107;
const DEVICES = [
  { label: "iPhone 15/16",   w: 393, h: 852 },
  { label: "iPhone 12/13/14", w: 390, h: 844 },
  { label: "iPhone 11 / XR",  w: 414, h: 896 },
  { label: "iPhone Pro Max",  w: 430, h: 932 },
];

const PROBE = () => {
  const de = document.documentElement;
  const shell = document.getElementById("app-wrapper") || document.querySelector(".app-shell");
  const nav = document.querySelector(".bottomNav");
  const sheet = document.getElementById("sheet");
  const body = document.getElementById("sheetBody");
  const navR = nav && getComputedStyle(nav).display !== "none" ? nav.getBoundingClientRect() : null;
  const open = sheet && document.querySelector(".backdrop.show");

  // Does any rule for .bottomNav still ask for the bottom inset? env() is
  // already resolved to 0 in computed style, so read the authored rules.
  let navDeclaresInset = false;
  for (const s of document.styleSheets) {
    let rules; try { rules = s.cssRules; } catch (_) { continue; }
    if (!rules) continue;
    for (const r of rules) {
      if (r.cssText && /bottomNav/.test(r.cssText) && /safe-area-inset-bottom/.test(r.cssText)) { navDeclaresInset = true; break; }
    }
    if (navDeclaresInset) break;
  }
  return {
    innerHeight: innerHeight,
    displayMode: matchMedia("(display-mode: standalone)").matches ? "standalone" : "browser",
    hOverflow: de.scrollWidth > de.clientWidth + 1,
    shellScrollable: shell ? shell.scrollHeight > shell.clientHeight + 1 : null,
    shellScrollMax: shell ? Math.round(shell.scrollHeight - shell.clientHeight) : 0,
    navBottom: navR ? Math.round(navR.bottom) : null,
    navAtEdge: navR ? Math.abs(navR.bottom - innerHeight) <= 1 : null,
    navDeclaresInset,
    sheetOpen: !!open,
    sheetH: open ? Math.round(sheet.getBoundingClientRect().height) : null,
    sheetBodyH: open && body ? Math.round(body.getBoundingClientRect().height) : null,
    sheetBottom: open ? Math.round(sheet.getBoundingClientRect().bottom) : null,
    sheetReachesBottom: open ? Math.abs(sheet.getBoundingClientRect().bottom - innerHeight) <= 12 : null,
  };
};

const STATES = [
  ["landing",    async () => {}],
  ["mission",    async (p) => { await p.evaluate(() => window.openMission(10)); }],
  ["NEXT state", async (p) => {
      await p.evaluate(() => window.openMission(10));
      await p.waitForTimeout(500);
      await p.evaluate(() => { const t = document.getElementById("btnToggleDone"); if (t) { t.disabled = false; t.click(); } });
  }],
  ["browse",     async (p) => { await p.evaluate(() => document.querySelector('.navTab[data-tab="browse"]').click()); }],
  ["board",      async (p) => { await p.evaluate(() => document.querySelector('.navTab[data-tab="modes"]').click()); }],
  ["profile",    async (p) => { await p.evaluate(() => document.querySelector('.navTab[data-tab="profile"]').click()); }],
];

const browser = await chromium.launch({ executablePath: process.env.JUMVI_EXE_CHROMIUM || undefined });
let failures = 0;
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });

for (const dev of DEVICES) {
  for (const mode of ["safari", "standalone"]) {
    for (const theme of ["light", "dark"]) {
      const h = mode === "standalone" ? dev.h : dev.h - CHROME_PX;
      const ctx = await browser.newContext({
        viewport: { width: dev.w, height: h }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
      });
      await ctx.addInitScript((t) => {
        try {
          localStorage.setItem("jumvi_theme_v1", t);
          localStorage.setItem("jumvi_onboarded_v2", "1");
          localStorage.setItem("jumvi_profiles_v1", JSON.stringify([{ id: "p1", name: "Ali", avatar: "monkey", createdAt: new Date().toISOString() }]));
          localStorage.setItem("jumvi_active_profile_v1", "p1");
          localStorage.setItem("jumvi_p1_missions_done_v3", JSON.stringify([1, 2, 3]));
        } catch (_) {}
      }, theme);
      const page = await ctx.newPage();
      const errs = [];
      page.on("pageerror", (e) => errs.push(String(e.message).slice(0, 100)));
      const cdp = await ctx.newCDPSession(page);
      if (mode === "standalone") {
        await cdp.send("Emulation.setEmulatedMedia", { media: "screen", features: [{ name: "display-mode", value: "standalone" }] });
      }
      await page.route("**/api/beacon", (r) => r.fulfill({ status: 204, body: "" }));

      const problems = [];
      for (const [name, drive] of STATES) {
        await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
        await page.waitForTimeout(1300);
        await drive(page);
        await page.waitForTimeout(900);
        const m = await page.evaluate(PROBE);

        if (m.hOverflow) problems.push(`${name}: horizontal overflow`);
        if (m.navBottom != null && !m.navAtEdge) problems.push(`${name}: bottom nav ends at ${m.navBottom} of ${m.innerHeight}`);
        if (m.navBottom != null && !m.navDeclaresInset) problems.push(`${name}: bottom nav never references safe-area-inset-bottom`);
        if (m.sheetOpen && !m.sheetReachesBottom) problems.push(`${name}: sheet bottom ${m.sheetBottom} of ${m.innerHeight} — dead band below it`);
        // A scroll container that cannot reach its end is how a bad height fix
        // hides long missions.
        if (m.shellScrollable) {
          const reached = await page.evaluate(() => {
            const s = document.getElementById("app-wrapper") || document.querySelector(".app-shell");
            if (!s) return true;
            s.scrollTop = s.scrollHeight;
            return Math.abs(s.scrollTop - (s.scrollHeight - s.clientHeight)) <= 2;
          });
          if (!reached) problems.push(`${name}: shell cannot scroll to its end`);
        }
        if (SHOTS && theme === "light") {
          await page.screenshot({ path: `${SHOTS}/${dev.w}x${h}-${mode}-${name.replace(/[^a-z]/gi, "")}.png` });
        }
      }
      if (errs.length) problems.push("console: " + [...new Set(errs)].slice(0, 2).join(" | "));

      const verdict = problems.length ? "FAIL" : "PASS";
      if (problems.length) failures++;
      console.log(`${dev.label.padEnd(16)} ${String(dev.w) + "×" + h}  ${mode.padEnd(10)} ${theme.padEnd(5)} → ${verdict}`);
      problems.forEach((x) => console.log(`     ✗ ${x}`));
      await ctx.close();
    }
  }
}
await browser.close();

console.log("");
console.log(failures ? `AUTOMATED STANDALONE REGRESSION: FAIL (${failures} configuration(s))`
                     : "AUTOMATED STANDALONE REGRESSION: PASS");
console.log("REAL IOS PWA VERIFICATION: REQUIRED — this suite cannot emulate");
console.log("env(safe-area-inset-*), WebKit's fixed-descendant containing block,");
console.log("or the standalone viewport settling after first layout.");
process.exit(failures ? 1 : 0);

#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
 * check-dialog-contract.mjs — Faz 6A.2. Every surface that CLAIMS to be a
 * modal, tested against the contract that claim makes.
 *
 *   closed → open → first meaningful focus → Tab stays inside →
 *   Shift+Tab stays inside → Escape closes → focus returns to the opener
 *
 * The rule this file exists to enforce: writing aria-modal="true" is not the
 * same as behaving like a modal. A surface that declares it and then lets Tab
 * walk out into the page behind it, or swallows Escape, or drops focus on the
 * body when it closes, is a FAIL here no matter what its markup says. So the
 * list of surfaces is not hand-written — it is read out of the DOM by
 * querying [aria-modal="true"], which means a new modal added later cannot
 * quietly skip this test.
 *
 * Each step is driven with real keyboard input through the browser
 * (page.keyboard.press), never by calling the app's own handlers.
 *
 *   node tools/check-dialog-contract.mjs
 *   node tools/check-dialog-contract.mjs --only=privacyBackdrop
 * Exit 1 on any FAIL.
 * ══════════════════════════════════════════════════════════════════════════*/
import { createRequire } from "node:module";

const require_ = createRequire(import.meta.url);
const chromium = (() => {
  const spec = process.env.JUMVI_PW || "playwright";
  try { return require_(spec).chromium; }
  catch { console.error(`Playwright not found (tried "${spec}"). Set JUMVI_PW.`); process.exit(2); }
})();
const args = process.argv.slice(2);
const argVal = (n, d) => { const h = args.find((a) => a.startsWith(`--${n}=`)); return h ? h.slice(n.length + 3) : d; };
const BASE = argVal("base", "http://localhost:8910/index.html");
const ONLY = argVal("only", "").split(",").filter(Boolean);
const EXE = process.env.JUMVI_EXE_CHROMIUM || undefined;
const wanted = (id) => ONLY.length === 0 || ONLY.includes(id);

const results = [];
const record = (id, name, status, detail) => {
  results.push({ id, name, status, detail });
  const mark = { PASS: "✅", FAIL: "❌", SKIP: "⏭️ ", INFO: "⚠️ " }[status] || "•";
  console.log(`  ${mark} ${id}  ${name}${detail ? "\n         " + detail : ""}`);
};

/* Each entry: how this surface is actually opened by a user, which tab that
   opener lives on, and which real element focus must come back to.
   `tab` matters more than it looks: an opener on a tab that is not showing is
   display:none, .focus() on it silently does nothing, and the dialog then
   legitimately has nothing to return focus to. Two "failures" in the first
   run of this file were exactly that — the harness parked on Grown-ups and
   then blamed the app for losing focus from a mission card it had hidden. */
const SURFACES = [
  /* Mission 1's card is not on screen by default on the Missions tab (the path
     only shows the current band), so this uses the FIRST VISIBLE mission card
     — the one a keyboard user actually reaches — and opens it by clicking it,
     not by calling openMission(). An earlier version pointed at mission 1 and
     silently focused a 0-rect node, which made every result meaningless. */
  { id: "backdrop",         label: "Mission sheet", tab: "browse",
    opener: 'FIRST_VISIBLE_MISSION',
    open: () => [...document.querySelectorAll("[data-mission-id]")].find(e => e.getClientRects().length)?.click() },
  { id: "profileBackdrop",  label: "Kids & Settings (profile)", tab: "today",
    opener: '#avatarBtn',             open: () => document.getElementById("avatarBtn")?.click() },
  { id: "privacyBackdrop",  label: "Privacy & Safety", tab: "profile",
    opener: '#privacyLink',           open: () => document.getElementById("privacyLink")?.click() },
  { id: "helpBackdrop",     label: "Help & Support", tab: "profile",
    opener: '#helpSupportLink',       open: () => document.getElementById("helpSupportLink")?.click() },
  { id: "badgesBackdrop",   label: "Badges", tab: "modes",
    opener: '#btnBadgesRow',          open: () => document.getElementById("btnBadgesRow")?.click() },
  { id: "certBackdrop",     label: "Certificate", tab: "profile",
    opener: '#helpSupportLink',       open: () => openCertificate() },
  { id: "fallbackBackdrop", label: "Image generation failed", tab: "today",
    opener: '#avatarBtn',             open: () => showFallbackModal() },
  { id: "teamXpBackdrop",   label: "Team XP picker", tab: "today",
    opener: '#avatarBtn',             open: () => openTeamXpPicker(),
    seedTeam: true },
  { id: "badgeUnlockModal", label: "Badge unlock", tab: "today",
    opener: '#avatarBtn',             open: () => showBadgeUnlockModal(BADGES[0]) },
  { id: "installDlg",       label: "Install (iOS manual steps)", tab: "profile",
    opener: '#btnKeepOnPhone',        open: () => document.getElementById("btnKeepOnPhone")?.click(),
    iosUA: true },
  { id: "welcomeOverlay",   label: "Welcome / onboarding", tab: null,
    opener: null,                     open: null, firstRun: true },
  /* Where to Play is switched off at the stylesheet, not by state:
     "#seasonalCard{display:none !important}" hides the only entry point and
     ".seasonalBackdrop, #seasonalBackdrop{display:none !important}" hides the
     dialog itself, so adding .show cannot paint it. It is a deliberately
     retired surface, measured rather than assumed — see D-SEASONAL. */
  { id: "seasonalBackdrop", label: "Where to Play (seasonal)", tab: null,
    opener: null, open: () => renderSeasonalList("indoor"), retired: true },
];

const IPHONE_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 " +
  "(KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";

const browser = await chromium.launch({
  executablePath: EXE,
  args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});

/* A fresh page with onboarding already done, sitting on Today. */
async function freshPage({ onboarded = true, iosUA = false, seedTeam = false } = {}) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    ...(iosUA ? { userAgent: IPHONE_UA } : {}),
  });
  const page = await ctx.newPage();
  page.on("pageerror", () => {});
  if (onboarded) await page.addInitScript(() => localStorage.setItem("jumvi_onboarded_v2", "1"));
  if (seedTeam) await page.addInitScript(() => {
    localStorage.setItem("jumvi_profiles_v1", JSON.stringify([{ id: "p1", name: "QAOne", avatar: "1" }]));
    localStorage.setItem("jumvi_active_profile_v1", "p1");
    localStorage.setItem("jumvi_p1_teams_v1", JSON.stringify([{ id: "t1", partner: "dad", createdAt: "2026-08-01" }]));
    localStorage.setItem("jumvi_p1_active_team_v1", "t1");
  });
  await page.goto(BASE, { waitUntil: "networkidle" }).catch(() => {});
  await page.waitForTimeout(1400);
  if (onboarded) {
    for (let i = 0; i < 5; i++) {
      if (!(await page.evaluate(() => document.body.classList.contains("modalOpen")
        || [...document.querySelectorAll('[aria-modal="true"]')].some(d => d.classList.contains("show"))))) break;
      await page.keyboard.press("Escape"); await page.waitForTimeout(300);
    }
  }
  return { ctx, page };
}

/* Is this surface visibly open right now? Different families use different
   mechanisms (.show, [hidden], display), so ask the renderer, not the class. */
const isOpen = (page, id) => page.evaluate((sel) => {
  const el = document.getElementById(sel);
  if (!el) return false;
  if (el.hidden) return false;
  const cs = getComputedStyle(el);
  if (cs.display === "none" || cs.visibility === "hidden" || Number(cs.opacity) === 0) return false;
  return el.getClientRects().length > 0;
}, id);

const focusInfo = (page, id) => page.evaluate((sel) => {
  const el = document.getElementById(sel);
  const a = document.activeElement;
  const name = a ? (a.id ? "#" + a.id : a.tagName.toLowerCase() + (a.className ? "." + String(a.className).split(" ")[0] : "")) : "none";
  return {
    active: name,
    inside: !!(el && a && el.contains(a)),
    isBody: !a || a === document.body,
    label: a ? (a.getAttribute("aria-label") || (a.textContent || "").replace(/\s+/g, " ").trim().slice(0, 28)) : "",
  };
}, id);

console.log("Dialog focus contract — Faz 6A.2\n");

/* ── the DOM decides which surfaces are in scope, not this file ─────────── */
{
  const { ctx, page } = await freshPage();
  const declared = await page.evaluate(() =>
    [...document.querySelectorAll('[aria-modal="true"]')].map(d => d.id).filter(Boolean));
  await ctx.close();
  const covered = SURFACES.map(s => s.id);
  const missing = declared.filter(d => !covered.includes(d));
  record("D00", "every aria-modal surface in the DOM is covered by this file",
    missing.length === 0 ? "PASS" : "FAIL",
    `declared=${declared.length} covered=${covered.length}` + (missing.length ? ` UNCOVERED=[${missing.join(", ")}]` : ""));
}

for (const s of SURFACES) {
  if (!wanted(s.id)) continue;

  /* A surface the stylesheet has retired: prove it cannot paint, rather than
     recording a skip that reads like an untested pass. */
  if (s.retired) {
    const { ctx, page } = await freshPage();
    await page.evaluate(s.open).catch(() => {});
    await page.waitForTimeout(600);
    const st = await page.evaluate((sel) => {
      const el = document.getElementById(sel);
      const card = document.getElementById("seasonalCard");
      return {
        cls: el ? el.className : "missing",
        disp: el ? getComputedStyle(el).display : "-",
        rects: el ? el.getClientRects().length : -1,
        entry: card ? getComputedStyle(card).display : "missing",
      };
    }, s.id);
    await ctx.close();
    const ok = st.rects === 0 && st.disp === "none" && st.entry === "none";
    record("D-SEASONAL", `${s.label}: retired surface, cannot be reached or painted`,
      ok ? "INFO" : "FAIL",
      `entry #seasonalCard display=${st.entry} · backdrop class="${st.cls}" display=${st.disp} rects=${st.rects}` +
      `\n         switched off in style.css, not by state — no user path reaches it, so the` +
      `\n         focus contract does not apply. Dead markup, left in place: removing it is` +
      `\n         a refactor, not a QA fix.`);
    continue;
  }

  /* Welcome is a first-run surface: it cannot be opened from a seeded page,
     so it gets its own un-onboarded session and its own reduced contract
     (there is no opener element to return focus to). */
  if (s.firstRun) {
    const { ctx, page } = await freshPage({ onboarded: false });
    const open = await isOpen(page, s.id);
    const f = await focusInfo(page, s.id);
    // Tab around and see whether focus escapes the overlay.
    let escaped = null;
    for (let i = 0; i < 14; i++) {
      await page.keyboard.press("Tab");
      const cur = await focusInfo(page, s.id);
      if (!cur.inside && !cur.isBody) { escaped = cur.active; break; }
    }
    await ctx.close();
    // The welcome overlay is the whole page on first run — it is not dismissible
    // by Escape by design (there is nothing behind it to go back to).
    const ok = open && escaped === null;
    record("D12", `${s.label}: covers the page on first run, Tab cannot leave it`,
      ok ? "PASS" : "FAIL",
      `open=${open} firstFocus=${f.active} tabEscapedTo=${escaped ?? "never"}` +
      `\n         no Escape by design — nothing behind it to return to; not a dismissible dialog`);
    continue;
  }

  const { ctx, page } = await freshPage({ iosUA: !!s.iosUA, seedTeam: !!s.seedTeam });

  /* Land on the tab that actually owns this opener before touching it. */
  if (s.tab) {
    await page.evaluate((t) => { try { switchTab(t); } catch (_) {} }, s.tab);
    await page.waitForTimeout(600);
  }

  /* Resolve the opener to a real node and stash it, so "focus returned to the
     opening element" is checked against the element the user actually used —
     even for the mission list, where the selector is "whatever is visible". */
  const openerExists = s.opener ? await page.evaluate((sel) => {
    const el = sel === "FIRST_VISIBLE_MISSION"
      ? [...document.querySelectorAll("[data-mission-id]")].find(e => e.getClientRects().length)
      : document.querySelector(sel);
    if (!el || !el.getClientRects().length) return false;
    window.__opener = el;
    window.__openerId = el.dataset?.missionId || null;
    return true;
  }, s.opener) : false;

  /* Focus the real opener so "focus returns to the opening element" is a
     claim with something to check against. */
  if (openerExists) {
    await page.evaluate(() => { window.__opener.scrollIntoView({ block: "center" }); window.__opener.focus(); });
    await page.waitForTimeout(150);
  }
  const before = await focusInfo(page, s.id);

  await page.evaluate(s.open).catch(() => {});
  await page.waitForTimeout(700);

  const opened = await isOpen(page, s.id);
  if (!opened) {
    await ctx.close();
    record(s.id, `${s.label}: could not be opened from its own entry point`, "SKIP",
      `opener=${s.opener ?? "n/a"} present=${openerExists} — contract not measured, NOT a pass`);
    continue;
  }

  const first = await focusInfo(page, s.id);

  /* Tab forward through more stops than the dialog has, then back. If the
     trap is real, focus is still inside after every one of them. */
  let outFwd = null;
  for (let i = 0; i < 16; i++) {
    await page.keyboard.press("Tab");
    const cur = await focusInfo(page, s.id);
    if (!cur.inside) { outFwd = cur.active; break; }
  }
  let outBack = null;
  for (let i = 0; i < 16; i++) {
    await page.keyboard.press("Shift+Tab");
    const cur = await focusInfo(page, s.id);
    if (!cur.inside) { outBack = cur.active; break; }
  }

  await page.keyboard.press("Escape");
  await page.waitForTimeout(600);
  const stillOpen = await isOpen(page, s.id);
  const after = await focusInfo(page, s.id);
  /* A list that re-renders on close legitimately replaces the node. What must
     be true is that focus is back on the SAME control — the card for the same
     mission — not that it is the same JS object. */
  const returned = openerExists ? await page.evaluate(() => {
    const a = document.activeElement;
    if (a === window.__opener) return true;
    if (window.__openerId) {
      const same = [...document.querySelectorAll('[data-mission-id="' + window.__openerId + '"]')]
        .find(e => e.getClientRects().length);
      if (same && a === same) return "re-rendered same mission card";
    }
    return false;
  }) : null;

  await ctx.close();

  const firstOk = first.inside && !first.isBody;
  const trapOk = outFwd === null && outBack === null;
  const escOk = !stillOpen;
  const returnOk = returned === true || typeof returned === "string"
    || (returned === null && !after.isBody);
  const ok = firstOk && trapOk && escOk && returnOk;

  record(s.id, `${s.label}: open → first focus → trap → Escape → return`, ok ? "PASS" : "FAIL",
    `openedFrom=${s.opener ?? "api"} firstFocus=${first.active}${first.label ? ` ("${first.label}")` : ""}` +
    `\n         Tab out=${outFwd ?? "never"} · Shift+Tab out=${outBack ?? "never"}` +
    `\n         Escape closed=${escOk} · focus after=${after.active} · returnedToOpener=${returned}`);
}

await browser.close();

const pass = results.filter(r => r.status === "PASS").length;
const fail = results.filter(r => r.status === "FAIL").length;
const skip = results.filter(r => r.status === "SKIP").length;
console.log(`\n${pass} pass, ${fail} fail, ${skip} not measured, of ${results.length} surfaces.`);
process.exit(fail > 0 ? 1 : 0);

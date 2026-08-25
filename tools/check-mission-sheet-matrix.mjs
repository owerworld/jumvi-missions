#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
 * check-mission-sheet-matrix.mjs — the same sheet, 36 times.
 *
 * A family reads one mission sheet and learns where things are; the 36th
 * should not move them. This opens every mission and records, per mission:
 * the presence and DOM ORDER of each section, whether the metadata came from
 * that mission's own data, and — the part that actually matters — whether the
 * always-visible safety band says something about THIS game or the same
 * sentence as the other 35.
 *
 * Order is checked as a subsequence, not an exact list: a mission with no
 * caller hint or no role card should not "fail order" for the sections it
 * legitimately does not have.
 *
 *   node tools/check-mission-sheet-matrix.mjs
 *   node tools/check-mission-sheet-matrix.mjs --csv=OUT.csv
 * Exit 1 if any mission is missing a required section, renders placeholder
 * copy, or shows a safety band shared with a different mission.
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
const CSV = argVal("csv", "");
const EXE = process.env.JUMVI_EXE_CHROMIUM || undefined;

/* The order the sheet promises. Anything absent is skipped, not failed. */
const ORDER = [
  ["title",     "#mTitle"],
  ["metadata",  "#mMeta"],
  ["art",       "#mArt, #missionIconWrap, .missionIconWrap"],
  ["steps",     "#mSteps"],
  ["win",       "#mWin"],
  ["safety",    ".missionSafetyLine"],
  /* "Playing with 2/3/4" comes first because the role card answers a question
     that only makes sense once you know how many of you there are. */
  ["players",   "#playerCount"],
  ["roles",     "#missionRoleCard"],
  ["more",      ".moreInfoDetails"],
  ["start",     "#btnStartTimer"],
];

const chromium = loadChromium();
const browser = await chromium.launch({ executablePath: EXE });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
page.on("pageerror", () => {});
await page.goto(BASE, { waitUntil: "networkidle" }).catch(() => {});
await page.waitForTimeout(1400);
await page.evaluate(() => document.getElementById("btnWelcomeStart")?.click());
await page.waitForTimeout(1400);
for (let i = 0; i < 5; i++) {
  if (!(await page.evaluate(() => document.body.classList.contains("modalOpen")))) break;
  await page.keyboard.press("Escape"); await page.waitForTimeout(350);
}

const rows = [];
for (let id = 1; id <= 36; id++) {
  await page.evaluate((i) => window.openMission(i), id);
  await page.waitForTimeout(420);
  const row = await page.evaluate(({ id, ORDER }) => {
    const ms = missions.find((m) => m.id === id);
    const sheet = document.getElementById("sheet") || document.getElementById("backdrop");
    const txt = (sel) => { const e = sheet.querySelector(sel); return e ? (e.textContent || "").replace(/\s+/g, " ").trim() : null; };
    const seen = [];
    const pos = {};
    for (const [name, sel] of ORDER) {
      const el = sheet.querySelector(sel);
      if (!el) { pos[name] = null; continue; }
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden" || el.hidden) { pos[name] = null; continue; }
      /* documentPosition gives real DOM order regardless of layout. */
      pos[name] = seen.push(el) - 1;
    }
    /* Convert to DOM order by comparing nodes pairwise. */
    const present = ORDER.map(([n]) => n).filter((n) => pos[n] !== null);
    const nodes = present.map((n) => sheet.querySelector(ORDER.find((o) => o[0] === n)[1]));
    const inOrder = nodes.every((n, i) => i === 0 || (nodes[i - 1].compareDocumentPosition(n) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0);

    const meta = txt("#mMeta") || "";
    return {
      id,
      title: txt("#mTitle"),
      dataTitle: ms.title,
      present,
      inOrder,
      metaHasTime: meta.includes(ms.time),
      metaHasPlayers: meta.includes(ms.players),
      metaHasAge: meta.includes(ms.age),
      stepCount: sheet.querySelectorAll("#mSteps .missionStepsList li").length,
      dataSteps: ms.steps.length,
      win: txt("#mWin"),
      dataWin: ms.win,
      safetyBand: txt(".missionSafetyLine"),
      dataSafety: ms.safety,
      accordionSafety: txt("#mSafety"),
      parentTip: (txt("#mTip") || "").slice(0, 40),
      kidsTip: (txt("#mKidsTip") || "").slice(0, 40),
      roleCard: txt("#missionRoleCard"),
      players: ms.players,
      placeholder: /coming soon/i.test((txt("#mSteps") || "") + (txt("#mWin") || "")),
    };
  }, { id, ORDER });
  rows.push(row);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(280);
  for (let i = 0; i < 3; i++) {
    if (!(await page.evaluate(() => document.body.classList.contains("modalOpen")))) break;
    await page.keyboard.press("Escape"); await page.waitForTimeout(250);
  }
}
await browser.close();

/* ── report ────────────────────────────────────────────────────────────── */
const REQUIRED = ["title", "metadata", "steps", "win", "safety", "more", "start"];
const bandCounts = new Map();
for (const r of rows) bandCounts.set(r.safetyBand, (bandCounts.get(r.safetyBand) || 0) + 1);

let fails = 0;
console.log("Mission sheet matrix — 36 missions\n");
console.log(" id  title                    order  meta        steps  win  safety band");
console.log(" ──  ───────────────────────  ─────  ──────────  ─────  ───  ───────────────────────────────");
for (const r of rows) {
  const missing = REQUIRED.filter((s) => !r.present.includes(s));
  const metaOk = r.metaHasTime && r.metaHasPlayers && r.metaHasAge;
  const stepsOk = r.stepCount === r.dataSteps && r.stepCount > 0 && r.stepCount <= 3;
  const winOk = !!r.win && r.win.includes(r.dataWin.slice(0, 24));
  const shared = bandCounts.get(r.safetyBand) > 1;
  const specific = r.safetyBand && r.dataSafety &&
    r.safetyBand.toLowerCase().includes(r.dataSafety.toLowerCase().slice(0, 18));
  const bad = missing.length || !r.inOrder || !metaOk || !stepsOk || !winOk || r.placeholder || !specific;
  if (bad) fails++;
  console.log(
    ` ${String(r.id).padStart(2)}  ${(r.title || "?").slice(0, 23).padEnd(23)}  ` +
    `${r.inOrder && !missing.length ? "  ok " : " ❌  "}  ` +
    `${metaOk ? "ok" : "MISSING"}`.padEnd(12) +
    `${stepsOk ? `${r.stepCount}/${r.dataSteps}  ` : `❌${r.stepCount}/${r.dataSteps} `}  ` +
    `${winOk ? "ok " : "❌ "}  ` +
    `${specific ? "own" : shared ? `SHARED×${bandCounts.get(r.safetyBand)}` : "generic"}`
  );
  if (missing.length) console.log(`      missing sections: ${missing.join(", ")}`);
}

console.log("\nsafety band distinct strings across 36 missions:");
for (const [band, n] of [...bandCounts].sort((a, b) => b[1] - a[1])) {
  console.log(`  ×${String(n).padStart(2)}  ${(band || "(none)").slice(0, 96)}`);
}

const multi = rows.filter((r) => r.players !== "2");
console.log(`\nmissions needing 3+ players: ${multi.length} (${multi.map((r) => r.id).join(", ")})`);
console.log(`  with a role card rendered: ${multi.filter((r) => r.roleCard).length}`);
console.log(`missions that are solo (1 player): ${rows.filter((r) => r.players === "1").length}`);

if (CSV) {
  const head = "id,title,inOrder,metaOk,steps,dataSteps,winOk,safetyBand,dataSafety,players,roleCard\n";
  const body = rows.map((r) => [r.id, JSON.stringify(r.title), r.inOrder,
    r.metaHasTime && r.metaHasPlayers && r.metaHasAge, r.stepCount, r.dataSteps,
    !!r.win, JSON.stringify(r.safetyBand), JSON.stringify(r.dataSafety),
    JSON.stringify(r.players), JSON.stringify(r.roleCard || "")].join(",")).join("\n");
  fs.writeFileSync(CSV, head + body + "\n");
  console.log(`\ncsv → ${CSV}`);
}

console.log(`\n${36 - fails}/36 missions fully conform.`);
if (fails) process.exit(1);

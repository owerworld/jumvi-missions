#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
 * check-daily-star-scope.mjs — the Daily Champion star is the family's, once
 * a day, and switching teams cannot mint a second one.
 *
 * The product decision under test: the daily goal is a shared celebration for
 * everyone on this device. The per-scope counter keeps living where it always
 * did (team-prefixed with a team active, child-prefixed solo) so no existing
 * key moves; a single device-wide ledger records whether today's star is spent.
 *
 * Two things this file exists to prove, because getting either wrong is worse
 * than the bug it replaces:
 *
 *   1. The loophole is closed. team → solo → team, and a second child, all on
 *      the same day, yield exactly ONE star.
 *   2. Nobody's today is reset. A household that earned the star this morning
 *      under the OLD code — where the only record is a per-scope
 *      daily_challenge_v1 — must not be handed a fresh star by the upgrade.
 *      That is the migration, and it is tested from real legacy-shaped seeds.
 *
 * Every transition is a real reload, because the storage prefixes are const
 * and resolved once at load: that is how a real profile or team switch works.
 *
 *   node tools/check-daily-star-scope.mjs
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
const EXE = process.env.JUMVI_EXE_CHROMIUM || undefined;
const SHOTS = argVal("shots", "");
if (SHOTS) await (await import("node:fs/promises")).mkdir(SHOTS, { recursive: true });
/* Visual proof to sit beside the ledger numbers: what the family actually sees
   on Today after a switch. Only written when --shots is passed, so a plain run
   never touches anyone's evidence directory. */
const shot = async (page, name) => {
  if (!SHOTS) return;
  /* The daily card lives on Today, and playOne() leaves the app on Missions,
     so land on Today and bring the card into frame — otherwise the PNG proves
     nothing about the star. */
  await page.evaluate(() => {
    try { if (typeof switchTab === "function") switchTab("today"); } catch (_) {}
  });
  await page.waitForTimeout(500);
  /* The big Today's Goal card is retired at the stylesheet
     (#dailyChallenge{display:none !important}), so the only surface a family
     actually sees is the #todayGoalBadge near the top. Full page anyway, so the
     frame also carries this scope's own mission count — that is what makes a
     "Goal done!" on a 0/36 team read as the FAMILY's star, not this team's. */
  await page.screenshot({ path: `${SHOTS}/daily-star-${name}.png`, fullPage: true });
};

const LEDGER = "jumvi_family_daily_star_v1";
const results = [];
const record = (id, name, status, detail) => {
  results.push({ id, name, status, detail });
  const mark = { PASS: "✅", FAIL: "❌", INFO: "⚠️ ", SKIP: "⏭️ " }[status] || "•";
  console.log(`  ${mark} ${id}  ${name}${detail ? "\n         " + detail : ""}`);
};

const browser = await chromium.launch({
  executablePath: EXE,
  args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});

/* A household with two children; the first is paired with Dad. The seed is
   one-shot: an init script re-runs on every navigation, and every transition
   here IS a navigation, so an unguarded seed would quietly undo the switch it
   is meant to test. */
const SEED = (extra) => `
  localStorage.setItem("jumvi_onboarded_v2", "1");
  if(localStorage.getItem("__qa_daily_seeded") !== "1"){
    localStorage.setItem("__qa_daily_seeded", "1");
    localStorage.setItem("jumvi_profiles_v1", JSON.stringify([
      { id:"p1", name:"StarOne", avatar:"1" },
      { id:"p2", name:"StarTwo", avatar:"2" }
    ]));
    localStorage.setItem("jumvi_active_profile_v1", "p1");
    localStorage.setItem("jumvi_p1_teams_v1", JSON.stringify([
      { id:"t1", partner:"dad",  createdAt:"2026-08-01" },
      { id:"t2", partner:"mom",  createdAt:"2026-08-02" }
    ]));
    ${extra || ""}
  }
`;

async function open({ extraSeed } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("   [pageerror]", String(e.message).slice(0, 110)));
  await page.addInitScript(new Function(SEED(extraSeed)));
  await page.goto(BASE, { waitUntil: "networkidle" }).catch(() => {});
  await page.waitForTimeout(1500);
  await dismiss(page);
  return { ctx, page };
}
const dismiss = async (page) => {
  for (let i = 0; i < 5; i++) {
    if (!(await page.evaluate(() => document.body.classList.contains("modalOpen")))) break;
    await page.keyboard.press("Escape"); await page.waitForTimeout(280);
  }
};
const reload = async (page) => {
  await page.reload({ waitUntil: "networkidle" }).catch(() => {});
  await page.waitForTimeout(1500);
  await dismiss(page);
};
/* A real team switch: write the active-team key the app owns, then reload —
   which is exactly what the app itself does, because the progress prefix is a
   const resolved once at load. */
const setTeam = async (page, teamId) => {
  await page.evaluate((t) => localStorage.setItem("jumvi_p1_active_team_v1", t), teamId);
  await reload(page);
};
const setProfile = async (page, id) => {
  await page.evaluate((i) => switchProfile(i), id).catch(() => {});
  await page.waitForTimeout(3200);   // switchProfile reloads on a 350ms timer
  await dismiss(page);
};

/* Play one real mission through to completion: start until the clock runs,
   age the sheet past the dwell gate, then one tap on the real button. */
const playOne = async (page) => {
  await page.evaluate(() => switchTab("browse"));
  await page.waitForTimeout(800);
  const id = await page.evaluate(() => {
    const done = window.__jumviPlayProbe ? new Set(window.__jumviPlayProbe().doneIds) : new Set();
    const el = [...document.querySelectorAll("[data-mission-id]")]
      .find(e => e.getClientRects().length && !done.has(Number(e.dataset.missionId)));
    if (!el) return null;
    el.scrollIntoView({ block: "center" }); el.click();
    return Number(el.dataset.missionId);
  });
  if (id == null) return null;
  await page.waitForTimeout(1000);
  for (let i = 0; i < 4; i++) {
    await page.evaluate(() => document.getElementById("btnStartTimer")?.click());
    await page.waitForTimeout(1400);
    if ((await page.evaluate(() => window.__jumviPlayProbe?.()?.timerState)) === "running") break;
  }
  await page.evaluate(() => { missionOpenedAt = Date.now() - 90000; });
  await page.waitForTimeout(1200);
  await page.evaluate(() => document.getElementById("btnToggleDone")?.click());
  await page.waitForTimeout(1500);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(700);
  await dismiss(page);
  return id;
};

const ledger = (page) => page.evaluate((k) => {
  try { return JSON.parse(localStorage.getItem(k) || "null"); } catch (_) { return "unparsable"; }
}, LEDGER);

/* What the family actually sees on Today, plus every daily_challenge key. */
const surface = (page) => page.evaluate(() => ({
  badge: (document.getElementById("todayGoalBadge")?.textContent || "").replace(/\s+/g, " ").trim(),
  reward: (document.getElementById("dailyChallengeReward")?.textContent || "").replace(/\s+/g, " ").trim(),
  status: (document.getElementById("dailyChallengeStatus")?.textContent || "").trim(),
  scopes: Object.keys(localStorage).filter(k => /daily_challenge_v1$/.test(k)).sort()
    .map(k => k + "=" + localStorage.getItem(k)),
}));

console.log("Daily Champion star — one per family, per day\n");

/* ── D1 the loophole: team → solo → other team, all on the same day ─────── */
{
  const { ctx, page } = await open();
  await setTeam(page, "t1");                      // playing with Dad
  const m1 = await playOne(page);
  const afterTeam = await ledger(page);

  await shot(page, "d1-a-team-t1-earned");

  await setTeam(page, "");                        // leave the team, play solo
  const soloBefore = await surface(page);
  await shot(page, "d1-b-solo-before-playing");
  const m2 = await playOne(page);
  const afterSolo = await ledger(page);

  await setTeam(page, "t2");                      // now play with Mom
  await shot(page, "d1-c-team-t2-before-playing");
  const m3 = await playOne(page);
  const afterTeam2 = await ledger(page);
  await shot(page, "d1-d-team-t2-after-playing");
  await ctx.close();

  const sameLedger = JSON.stringify(afterTeam) === JSON.stringify(afterSolo)
    && JSON.stringify(afterSolo) === JSON.stringify(afterTeam2);
  const claimedByTeam1 = !!afterTeam && /team_t1/.test(afterTeam.scope || "");
  const ok = claimedByTeam1 && sameLedger;
  record("D1", "team → solo → another team on one day yields exactly ONE star",
    ok ? "PASS" : "FAIL",
    `played missions ${m1} (team t1), ${m2} (solo), ${m3} (team t2)` +
    `\n         ledger after team t1 : ${JSON.stringify(afterTeam)}` +
    `\n         ledger after solo    : ${JSON.stringify(afterSolo)}` +
    `\n         ledger after team t2 : ${JSON.stringify(afterTeam2)}` +
    `\n         unchanged across all three scopes=${sameLedger}` +
    `\n         solo screen before playing said: status="${soloBefore.status}" reward="${soloBefore.reward}"`);
}

/* ── D2 a second child cannot mint a second star the same day ───────────── */
{
  const { ctx, page } = await open();
  await playOne(page);                            // p1 solo earns it
  const afterP1 = await ledger(page);
  await setProfile(page, "p2");
  const p2Sees = await surface(page);
  await shot(page, "d2-a-child2-before-playing");
  await playOne(page);                            // p2 plays too
  const afterP2 = await ledger(page);
  const p2After = await surface(page);
  await shot(page, "d2-b-child2-after-playing");
  await ctx.close();
  const ok = !!afterP1 && JSON.stringify(afterP1) === JSON.stringify(afterP2)
    && /p1_daily_challenge/.test(afterP1.scope || "");
  record("D2", "a second child sees the family's star, and playing does not mint another",
    ok ? "PASS" : "FAIL",
    `ledger after p1 : ${JSON.stringify(afterP1)}` +
    `\n         ledger after p2 : ${JSON.stringify(afterP2)} (unchanged=${JSON.stringify(afterP1) === JSON.stringify(afterP2)})` +
    `\n         p2 saw before playing: status="${p2Sees.status}" reward="${p2Sees.reward}"` +
    `\n         p2 after playing     : status="${p2After.status}" badge="${p2After.badge}"` +
    `\n         per-scope counters still honest: ${p2After.scopes.join(" · ")}`);
}

/* ── D3 MIGRATION: a household that already earned it under the old code ── */
/* This is the backward-compatibility case. The seed is legacy-shaped on
   purpose: a per-scope daily_challenge_v1 claimed for TODAY and no ledger at
   all, which is exactly what every existing family's storage looks like the
   moment they load the new build. */
{
  const today = new Date();
  const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const { ctx, page } = await open({
    extraSeed: `
      localStorage.setItem("jumvi_p1_daily_challenge_v1", JSON.stringify({iso:"${iso}",count:1,claimed:true}));
      localStorage.removeItem("jumvi_family_daily_star_v1");
    `,
  });
  const led = await ledger(page);
  const seen = await surface(page);
  // and the loophole must be closed for them too, from the first load
  await setTeam(page, "t1");
  await playOne(page);
  const afterTeamPlay = await ledger(page);
  await ctx.close();
  const adopted = !!led && led.migrated === true && /p1_daily_challenge/.test(led.scope || "");
  const stillOne = JSON.stringify(led) === JSON.stringify(afterTeamPlay);
  record("D3", "an existing family that already earned today keeps it — no second star",
    adopted && stillOne ? "PASS" : "FAIL",
    `seeded legacy claim: jumvi_p1_daily_challenge_v1={"iso":"${iso}","count":1,"claimed":true}, no ledger` +
    `\n         ledger derived on first load: ${JSON.stringify(led)}` +
    `\n         adopted the existing claim=${adopted} · today shown as done: status="${seen.status}"` +
    `\n         then joined a team and played: ledger ${JSON.stringify(afterTeamPlay)} (unchanged=${stillOne})`);
}

/* ── D4 a household that had NOT earned it still can ────────────────────── */
{
  const yest = new Date(Date.now() - 86400000);
  const iso = `${yest.getFullYear()}-${String(yest.getMonth() + 1).padStart(2, "0")}-${String(yest.getDate()).padStart(2, "0")}`;
  const { ctx, page } = await open({
    extraSeed: `
      localStorage.setItem("jumvi_p1_daily_challenge_v1", JSON.stringify({iso:"${iso}",count:1,claimed:true}));
      localStorage.removeItem("jumvi_family_daily_star_v1");
    `,
  });
  const before = await ledger(page);
  await playOne(page);
  const after = await ledger(page);
  const seen = await surface(page);
  await ctx.close();
  const ok = before === null && !!after;
  record("D4", "yesterday's claim does not block today's star", ok ? "PASS" : "FAIL",
    `seeded a claim for YESTERDAY (${iso})` +
    `\n         ledger on load: ${JSON.stringify(before)} (correctly empty=${before === null})` +
    `\n         after playing : ${JSON.stringify(after)} · screen: status="${seen.status}" reward="${seen.reward}"`);
}

/* ── D5 the star is spent for the day, even after Mark as Not Done ─────────
 * The Undo bar this case was originally written for is gone, so the star can
 * no longer be handed back. That is a real consequence, not an oversight: the
 * sheet's "Mark as Not Done" returns the mission but has never rewritten the
 * history of a day the family actually played, and the ledger follows that
 * same rule. Asserted here so the cost is measured rather than assumed. */
{
  const { ctx, page } = await open();
  await page.evaluate(() => switchTab("browse"));
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    const el = [...document.querySelectorAll("[data-mission-id]")].find(e => e.getClientRects().length);
    el?.scrollIntoView({ block: "center" }); el?.click();
  });
  await page.waitForTimeout(1000);
  for (let i = 0; i < 4; i++) {
    await page.evaluate(() => document.getElementById("btnStartTimer")?.click());
    await page.waitForTimeout(1400);
    if ((await page.evaluate(() => window.__jumviPlayProbe?.()?.timerState)) === "running") break;
  }
  await page.evaluate(() => { missionOpenedAt = Date.now() - 90000; });
  await page.waitForTimeout(1200);
  await page.evaluate(() => document.getElementById("btnToggleDone")?.click());
  await page.waitForTimeout(1400);
  const claimed = await ledger(page);
  const barGone = await page.evaluate(() => !document.getElementById("undoBar"));
  // Same button, now reading "Mark as Not Done".
  await page.evaluate(() => document.getElementById("btnToggleDone")?.click());
  await page.waitForTimeout(1400);
  const afterUnmark = await ledger(page);
  const surface = await page.evaluate(() =>
    (document.getElementById("dailyChallengeStatus")?.textContent || "").trim());
  await ctx.close();
  const ok = barGone && !!claimed &&
             JSON.stringify(afterUnmark) === JSON.stringify(claimed);
  record("D5", "no Undo bar exists; Mark as Not Done does NOT hand the star back",
    ok ? "PASS" : "FAIL",
    `#undoBar in DOM=${!barGone}` +
    `\n         after completion     : ${JSON.stringify(claimed)}` +
    `\n         after Mark as Not Done: ${JSON.stringify(afterUnmark)} (unchanged=${JSON.stringify(afterUnmark) === JSON.stringify(claimed)})` +
    `\n         screen still says    : status="${surface}"`);
}

/* ── D6 a new day is a new star ─────────────────────────────────────────── */
{
  const { ctx, page } = await open();
  await playOne(page);
  const today = await ledger(page);
  /* Age EVERYTHING dated today back one day — the ledger and every per-scope
     daily_challenge_v1 alike. Ageing only the ledger, as an earlier version of
     this check did, produces a state that cannot occur: a stale ledger next to
     a scope key still stamped today. familyDailyStar() then correctly adopted
     that scope's claim and the check failed on its own bad fixture. */
  await page.evaluate((k) => {
    const d = new Date(Date.now() - 86400000);
    const yest = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const age = (key) => {
      try {
        const v = JSON.parse(localStorage.getItem(key) || "null");
        if (v && v.iso) { v.iso = yest; localStorage.setItem(key, JSON.stringify(v)); }
      } catch (_) {}
    };
    age(k);
    Object.keys(localStorage).filter(x => /daily_challenge_v1$/.test(x)).forEach(age);
  }, LEDGER);
  await reload(page);
  const seen = await surface(page);
  const fresh = await ledger(page);
  // The real question is not what the key holds, it is whether a family can
  // earn the star again — so earn it.
  await playOne(page);
  const reEarned = await ledger(page);
  const seenAfter = await surface(page);
  await ctx.close();
  const todayIso = new Date();
  const isoNow = `${todayIso.getFullYear()}-${String(todayIso.getMonth() + 1).padStart(2, "0")}-${String(todayIso.getDate()).padStart(2, "0")}`;
  const ok = !!today && fresh === null && /0 \/ 1/.test(seen.status)
    && !!reEarned && reEarned.iso === isoNow;
  record("D6", "tomorrow the star is available again, and can be earned again", ok ? "PASS" : "FAIL",
    `ledger earned today: ${JSON.stringify(today)}` +
    `\n         after the day rolls over: ${JSON.stringify(fresh)} · screen status="${seen.status}" reward="${seen.reward}"` +
    `\n         after playing on the new day: ${JSON.stringify(reEarned)} · status="${seenAfter.status}"`);
}

await browser.close();
const pass = results.filter(r => r.status === "PASS").length;
const fail = results.filter(r => r.status === "FAIL").length;
console.log(`\n${pass} pass, ${fail} fail, of ${results.length} checks.`);
process.exit(fail > 0 ? 1 : 0);

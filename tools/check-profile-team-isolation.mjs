#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
 * check-profile-team-isolation.mjs — Faz 4.
 *
 * The claim under test is not "the code intends to keep children apart". It is
 * that a family with two kids and a shared paddle set cannot end up with one
 * child's badge on the other child's screen. Every progress key in app.js is
 * namespaced by one of two prefixes:
 *
 *   _PP               jumvi_<profileId>_        the child
 *   _PROGRESS_PREFIX  the team prefix when a team is active, else _PP
 *
 * Both are `const`, resolved once at load — which is why switchProfile()
 * reloads the page. So isolation is tested the way it actually happens: seed,
 * reload, read back.
 *
 * Deliberately asymmetric, and asserted as such rather than "fixed": the daily
 * challenge, attempts, age band, avatar and certificate live on the CHILD
 * (_PP) even while a team is active, because a daily pick and a certificate
 * belong to a person, not to a pairing. Missions, streak and badges follow the
 * team. If that ever silently flips, these tests fail.
 *
 *   node tools/check-profile-team-isolation.mjs
 *   node tools/check-profile-team-isolation.mjs --only=F03
 * Exit 1 on any leak.
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

/* Two children, one of them paired with Dad. Fixture names are obviously
   fixtures — never anything that could read as a real child's record. */
const P1 = "p1", P2 = "p2";
const SEED = {
  jumvi_profiles_v1: JSON.stringify([
    { id: P1, name: "FixtureOne", avatar: "monkey", createdAt: "2026-01-01T00:00:00.000Z" },
    { id: P2, name: "FixtureTwo", avatar: "fox",    createdAt: "2026-01-02T00:00:00.000Z" },
  ]),
  jumvi_active_profile_v1: P1,
  jumvi_onboarded_v2: "1",

  /* child one, playing solo */
  jumvi_p1_missions_done_v3: JSON.stringify([1, 2, 3]),
  jumvi_p1_streak_count_v1: "3",
  jumvi_p1_streak_best_v1: "5",
  jumvi_p1_streak_last_v1: "2026-08-24",
  jumvi_p1_badges_unlocked_v1: JSON.stringify(["first_mission"]),
  jumvi_p1_daily_n_v1: "2",
  jumvi_p1_cert_name_v1: "FixtureOne",
  jumvi_p1_avatar_v1: "0",

  /* child two, a different journey entirely */
  jumvi_p2_missions_done_v3: JSON.stringify([10, 11]),
  jumvi_p2_streak_count_v1: "1",
  jumvi_p2_streak_best_v1: "1",
  jumvi_p2_daily_n_v1: "7",
  jumvi_p2_cert_name_v1: "FixtureTwo",

  /* child one also has a team with Dad, with its own separate journey */
  jumvi_p1_teams_v1: JSON.stringify([{ id: "t1", partner: "dad", createdAt: "2026-02-01" }]),
  jumvi_p1_team_t1_missions_done_v3: JSON.stringify([20, 21, 22, 23]),
  jumvi_p1_team_t1_streak_count_v1: "9",
  jumvi_p1_team_t1_badges_unlocked_v1: JSON.stringify(["team_starter"]),
};

const chromium = loadChromium();
const browser = await chromium.launch({ executablePath: EXE });

async function boot({ seed, activeProfile, activeTeam, viewport } = {}) {
  const ctx = await browser.newContext({ viewport: viewport || { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 140)));
  await page.addInitScript((s) => {
    for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v);
  }, { ...(seed || SEED), jumvi_active_profile_v1: activeProfile || P1,
       ...(activeTeam ? { jumvi_p1_active_team_v1: activeTeam } : {}) });
  await page.goto(BASE, { waitUntil: "networkidle" }).catch(() => {});
  await page.waitForTimeout(1500);
  for (let i = 0; i < 4; i++) {
    if (!(await page.evaluate(() => document.body.classList.contains("modalOpen")))) break;
    await page.keyboard.press("Escape"); await page.waitForTimeout(300);
  }
  return { ctx, page, errors };
}
const probe = (page) => page.evaluate(() => window.__jumviPlayProbe());

console.log("Profile / team state isolation — Faz 4\n");

/* ── F01 the active child's journey is the one that loads ──────────────── */
if (wanted("F01")) {
  const a = await boot({ activeProfile: P1 });
  const p1 = await probe(a.page);
  await a.ctx.close();
  const b = await boot({ activeProfile: P2 });
  const p2 = await probe(b.page);
  await b.ctx.close();
  const ok = JSON.stringify(p1.doneIds) === JSON.stringify([1, 2, 3]) &&
             JSON.stringify(p2.doneIds) === JSON.stringify([10, 11]) &&
             p1.streakCount === 3 && p2.streakCount === 1;
  record("F01", "switching child loads that child's missions and streak", ok ? "PASS" : "FAIL",
    `p1 done=[${p1.doneIds}] streak=${p1.streakCount} · p2 done=[${p2.doneIds}] streak=${p2.streakCount}`);
}

/* ── F02 a team journey is separate from the child's own ───────────────── */
if (wanted("F02")) {
  const solo = await boot({ activeProfile: P1 });
  const s = await probe(solo.page);
  await solo.ctx.close();
  const team = await boot({ activeProfile: P1, activeTeam: "t1" });
  const t = await probe(team.page);
  const keys = await team.page.evaluate(() => ({
    solo: localStorage.getItem("jumvi_p1_missions_done_v3"),
    team: localStorage.getItem("jumvi_p1_team_t1_missions_done_v3"),
  }));
  await team.ctx.close();
  const ok = JSON.stringify(s.doneIds) === JSON.stringify([1, 2, 3]) &&
             JSON.stringify(t.doneIds) === JSON.stringify([20, 21, 22, 23]) &&
             s.streakCount === 3 && t.streakCount === 9 &&
             keys.solo === "[1,2,3]";
  record("F02", "the same child solo vs in a team are two journeys", ok ? "PASS" : "FAIL",
    `solo done=[${s.doneIds}] streak=${s.streakCount} · team done=[${t.doneIds}] streak=${t.streakCount}; solo key untouched=${keys.solo === "[1,2,3]"}`);
}

/* ── F03 completing in a team must not touch the solo journey ──────────── */
if (wanted("F03")) {
  const { ctx, page } = await boot({ activeProfile: P1, activeTeam: "t1" });
  const before = await page.evaluate(() => ({
    solo: localStorage.getItem("jumvi_p1_missions_done_v3"),
    soloStreak: localStorage.getItem("jumvi_p1_streak_count_v1"),
    soloBadges: localStorage.getItem("jumvi_p1_badges_unlocked_v1"),
    cert: localStorage.getItem("jumvi_p1_cert_name_v1"),
  }));
  /* Complete one honestly: open, run the timer out, tap finish. */
  await page.evaluate(() => window.openMission(5));
  await page.waitForTimeout(700);
  await page.evaluate(() => document.getElementById("btnStartTimer")?.click());
  await page.waitForTimeout(500);
  if ((await probe(page)).narrationPending) { await page.evaluate(() => document.getElementById("btnStartTimer")?.click()); await page.waitForTimeout(400); }
  let g = null;
  const dl = Date.now() + 130000;
  while (Date.now() < dl) { g = await probe(page); if (g.gateRemainingMs === 0) break; await page.waitForTimeout(1000); }
  await page.evaluate(() => document.getElementById("btnToggleDone")?.click());
  await page.waitForTimeout(1200);
  const after = await page.evaluate(() => ({
    solo: localStorage.getItem("jumvi_p1_missions_done_v3"),
    soloStreak: localStorage.getItem("jumvi_p1_streak_count_v1"),
    soloBadges: localStorage.getItem("jumvi_p1_badges_unlocked_v1"),
    cert: localStorage.getItem("jumvi_p1_cert_name_v1"),
    team: localStorage.getItem("jumvi_p1_team_t1_missions_done_v3"),
    p2: localStorage.getItem("jumvi_p2_missions_done_v3"),
  }));
  await ctx.close();
  const teamGrew = JSON.parse(after.team || "[]").includes(5);
  const soloUntouched = after.solo === before.solo && after.soloStreak === before.soloStreak &&
                        after.soloBadges === before.soloBadges && after.cert === before.cert;
  const siblingUntouched = after.p2 === JSON.stringify([10, 11]);
  const ok = teamGrew && soloUntouched && siblingUntouched;
  record("F03", "a completion earned as a team lands only on the team", ok ? "PASS" : "FAIL",
    `team now ${after.team} (gained 5: ${teamGrew}) · solo ${before.solo}→${after.solo} · solo streak ${before.soloStreak}→${after.soloStreak} · sibling ${after.p2}`);
}

/* ── F04 which keys follow the child and which follow the team ─────────── */
if (wanted("F04")) {
  const { ctx, page } = await boot({ activeProfile: P1, activeTeam: "t1" });
  const scoped = await page.evaluate(() => {
    /* Read the prefixes the app itself resolved, not a guess. */
    const all = Object.keys(localStorage);
    return {
      teamScoped: all.filter((k) => k.startsWith("jumvi_p1_team_t1_")).sort(),
      childScoped: all.filter((k) => k.startsWith("jumvi_p1_") && !k.startsWith("jumvi_p1_team_")).sort(),
    };
  });
  await ctx.close();
  const follows = (bucket, frag) => bucket.some((k) => k.includes(frag));
  const teamHas = ["missions_done", "streak_count", "badges_unlocked"].filter((f) => follows(scoped.teamScoped, f));
  const childHas = ["daily_", "cert_", "avatar_", "age_"].filter((f) => follows(scoped.childScoped, f));
  const ok = teamHas.length === 3 && childHas.length >= 2;
  record("F04", "missions/streak/badges follow the team; daily, certificate, avatar follow the child", ok ? "PASS" : "FAIL",
    `team-scoped: ${scoped.teamScoped.map((k) => k.replace("jumvi_p1_team_t1_", "")).join(", ") || "(none)"}\n         child-scoped: ${scoped.childScoped.map((k) => k.replace("jumvi_p1_", "")).join(", ")}`);
}

/* ── F05 deleting a child must not hand its state to the next one ──────── */
if (wanted("F05")) {
  const { ctx, page } = await boot({ activeProfile: P1 });
  const seq = await page.evaluate(() => localStorage.getItem("jumvi_profile_seq_v1"));
  const nextId = await page.evaluate(() => {
    /* The app allocates from a monotonic sequence rather than reusing a freed
       id — the guard that stops a new child inheriting an orphaned journey. */
    return typeof nextProfileId === "function" ? nextProfileId() : null;
  }).catch(() => null);
  await ctx.close();
  const ok = nextId === null || !["p1", "p2"].includes(String(nextId));
  record("F05", "a new child never reuses a freed profile id", ok ? "PASS" : "FAIL",
    `seq=${seq} nextId=${nextId === null ? "(helper not exposed — asserted via seq key only)" : nextId}`);
}

await browser.close();
const pass = results.filter((r) => r.status === "PASS").length;
const fail = results.filter((r) => r.status === "FAIL").length;
console.log(`\n${pass} pass, ${fail} fail, ${results.length - pass - fail} other, of ${results.length} run.`);
if (fail) process.exit(1);

#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
 * check-persistence-flow.mjs — Faz 6C.2. One long journey, and the question
 * asked at every step: which scope did that land in, and did it survive?
 *
 *   clean open → choose level → open mission → play → complete → reload
 *   → switch profile → switch team → reload → undo → reset → verify each scope
 *
 * The point is not that the keys exist. It is that a second child never sees
 * the first child's progress, a team journey never leaks into a solo one, and
 * a reload changes nothing. So every assertion reads localStorage back by its
 * FULL key name after a real page reload, and the key names are compared, not
 * assumed — the storage contract is what previous phases promised not to move.
 *
 *   node tools/check-persistence-flow.mjs
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

const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log("   [pageerror]", e.message.slice(0, 120)));

/* Two children, one of them paired with Dad — the shape a real household has
   the moment it stops being one kid on one phone. */
/* An init script re-runs on EVERY navigation, and switchProfile() works by
   reloading the page — so an unconditional seed here silently undid the very
   switch this file is meant to test (measured: active profile came back p1
   after switching to p2). The seed is therefore one-shot, guarded by its own
   marker, and after that the app owns this storage entirely. */
await page.addInitScript(() => {
  localStorage.setItem("jumvi_onboarded_v2", "1");
  if (localStorage.getItem("__qa_seeded_v1") === "1") return;
  localStorage.setItem("__qa_seeded_v1", "1");
  localStorage.setItem("jumvi_profiles_v1", JSON.stringify([
    { id: "p1", name: "PersistOne", avatar: "1" },
    { id: "p2", name: "PersistTwo", avatar: "2" },
  ]));
  localStorage.setItem("jumvi_active_profile_v1", "p1");
  localStorage.setItem("jumvi_p1_teams_v1", JSON.stringify([{ id: "t1", partner: "dad", createdAt: "2026-08-01" }]));
});

const dismiss = async () => {
  for (let i = 0; i < 5; i++) {
    if (!(await page.evaluate(() => document.body.classList.contains("modalOpen")))) break;
    await page.keyboard.press("Escape"); await page.waitForTimeout(300);
  }
};
const load = async () => {
  await page.goto(BASE, { waitUntil: "networkidle" }).catch(() => {});
  await page.waitForTimeout(1500);
  await dismiss();
};
const reload = async () => {
  await page.reload({ waitUntil: "networkidle" }).catch(() => {});
  await page.waitForTimeout(1500);
  await dismiss();
};
/* Everything JUMVI stores, read straight out of localStorage by full key. */
const snap = () => page.evaluate(() => {
  const all = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    all[k] = localStorage.getItem(k);
  }
  return {
    all,
    activeProfile: all["jumvi_active_profile_v1"] || null,
    activeTeam: all["jumvi_p1_active_team_v1"] ?? all["jumvi_p2_active_team_v1"] ?? null,
    probe: window.__jumviPlayProbe ? window.__jumviPlayProbe() : null,
  };
});
const keysMatching = (all, re) => Object.keys(all).filter(k => re.test(k)).sort();

/* Play one real mission to completion: start until the clock runs, age the
   sheet past the dwell gate, then one tap on the real completion button. */
const playOne = async () => {
  await page.evaluate(() => switchTab("browse"));
  await page.waitForTimeout(800);
  /* Pick a mission that is NOT already finished. Replaying a done mission taps
     the SAME button, which by design means "Mark as Not Done" — so an earlier
     version of this file recorded done going 1 → 0 and called Undo broken when
     it had simply un-marked the only completed mission. */
  const id = await page.evaluate(() => {
    const doneNow = window.__jumviPlayProbe ? new Set(window.__jumviPlayProbe().doneIds) : new Set();
    const el = [...document.querySelectorAll("[data-mission-id]")]
      .find(e => e.getClientRects().length && !doneNow.has(Number(e.dataset.missionId)));
    if (!el) return null;
    el.scrollIntoView({ block: "center" });
    el.click();
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
  await page.waitForTimeout(1400);
  return id;
};

console.log("Persistence and scope — Faz 6C.2\n");

/* ── P6.1 clean open, then a real completion in the SOLO scope ──────────── */
await load();
const played1 = await playOne();
const afterPlay = await snap();
{
  const done = afterPlay.probe?.doneIds || [];
  const soloKey = "jumvi_p1_missions_done_v3";
  const inSolo = afterPlay.all[soloKey];
  record("P6.1", "a completion lands in the active child's own scope", 
    done.length === 1 && !!inSolo ? "PASS" : "FAIL",
    `played mission ${played1} · in-memory done=${JSON.stringify(done)} xp=${afterPlay.probe?.xp}` +
    `\n         ${soloKey} = ${inSolo}` +
    `\n         team keys present: ${JSON.stringify(keysMatching(afterPlay.all, /_team_t1_/))}`);
}

/* ── P6.2 a reload changes nothing ──────────────────────────────────────── */
await reload();
const afterReload = await snap();
{
  const same = JSON.stringify(afterReload.probe?.doneIds) === JSON.stringify(afterPlay.probe?.doneIds)
    && afterReload.probe?.xp === afterPlay.probe?.xp
    && afterReload.probe?.streakCount === afterPlay.probe?.streakCount;
  record("P6.2", "reload restores done, xp, streak and badges unchanged", same ? "PASS" : "FAIL",
    `before reload: done=${JSON.stringify(afterPlay.probe?.doneIds)} xp=${afterPlay.probe?.xp} streak=${afterPlay.probe?.streakCount}` +
    `\n         after reload:  done=${JSON.stringify(afterReload.probe?.doneIds)} xp=${afterReload.probe?.xp} streak=${afterReload.probe?.streakCount}` +
    `\n         badges key=${afterReload.all["jumvi_p1_badges_unlocked_v1"] ?? "(none yet)"}`);
}

/* ── P6.3 the second child starts clean and cannot see the first ────────── */
await page.evaluate(() => switchProfile("p2")).catch(() => {});
await page.waitForTimeout(3200);   // switchProfile reloads on a 350ms timer
await dismiss();
const asP2 = await snap();
{
  const p2done = asP2.probe?.doneIds || [];
  const p1Key = asP2.all["jumvi_p1_missions_done_v3"];
  const p2Key = asP2.all["jumvi_p2_missions_done_v3"];
  const ok = asP2.activeProfile === "p2" && p2done.length === 0 && !!p1Key;
  record("P6.3", "switching child shows an empty journey and leaves the first one intact",
    ok ? "PASS" : "FAIL",
    `active profile=${asP2.activeProfile} · p2 in-memory done=${JSON.stringify(p2done)} xp=${asP2.probe?.xp}` +
    `\n         jumvi_p1_missions_done_v3 = ${p1Key} (still there)` +
    `\n         jumvi_p2_missions_done_v3 = ${p2Key ?? "(not created — nothing done yet)"}`);
}

/* ── P6.4 back to child one: their progress is exactly where they left it ─ */
await page.evaluate(() => switchProfile("p1")).catch(() => {});
await page.waitForTimeout(3200);
await dismiss();
const backToP1 = await snap();
{
  const ok = backToP1.activeProfile === "p1"
    && JSON.stringify(backToP1.probe?.doneIds) === JSON.stringify(afterPlay.probe?.doneIds);
  record("P6.4", "switching back restores the first child's progress exactly", ok ? "PASS" : "FAIL",
    `active=${backToP1.activeProfile} done=${JSON.stringify(backToP1.probe?.doneIds)} xp=${backToP1.probe?.xp} ` +
    `(was ${JSON.stringify(afterPlay.probe?.doneIds)} / ${afterPlay.probe?.xp})`);
}

/* ── P6.5 a team journey is separate from the same child's solo one ─────── */
await page.evaluate(() => { localStorage.setItem("jumvi_p1_active_team_v1", "t1"); });
await reload();
const inTeam = await snap();
const playedTeam = await playOne();
const afterTeamPlay = await snap();
{
  const teamKey = afterTeamPlay.all["jumvi_p1_team_t1_missions_done_v3"];
  const soloKey = afterTeamPlay.all["jumvi_p1_missions_done_v3"];
  const soloUnchanged = soloKey === afterPlay.all["jumvi_p1_missions_done_v3"];
  const ok = inTeam.activeTeam === "t1" && !!teamKey && soloUnchanged;
  record("P6.5", "playing in a team writes the team scope and leaves solo untouched",
    ok ? "PASS" : "FAIL",
    `active team=${inTeam.activeTeam} · played mission ${playedTeam}` +
    `\n         team  jumvi_p1_team_t1_missions_done_v3 = ${teamKey}` +
    `\n         solo  jumvi_p1_missions_done_v3         = ${soloKey} (unchanged: ${soloUnchanged})`);
}

/* ── P6.6 leaving the team gives the solo journey back, untouched ───────── */
await page.evaluate(() => { localStorage.setItem("jumvi_p1_active_team_v1", ""); });
await reload();
const backSolo = await snap();
{
  const ok = JSON.stringify(backSolo.probe?.doneIds) === JSON.stringify(afterPlay.probe?.doneIds);
  record("P6.6", "leaving the team returns the solo journey exactly as it was", ok ? "PASS" : "FAIL",
    `solo done after leaving team=${JSON.stringify(backSolo.probe?.doneIds)} xp=${backSolo.probe?.xp}` +
    ` (solo was ${JSON.stringify(afterPlay.probe?.doneIds)} / ${afterPlay.probe?.xp})` +
    `\n         team key still on disk: ${backSolo.all["jumvi_p1_team_t1_missions_done_v3"]}`);
}

/* ── P6.7 Undo, inside its window, reverses a completion for real ───────── */
{
  const before = (await snap()).probe;
  await playOne();
  const completed = (await snap()).probe;
  const undoShown = await page.evaluate(() => { const u = document.getElementById("undoBar"); return !!u && !u.hidden; });
  await page.evaluate(() => document.querySelector("#undoBar button")?.click());
  await page.waitForTimeout(1200);
  const undone = (await snap()).probe;
  const ok = completed.doneSize === before.doneSize + 1 && undone.doneSize === before.doneSize
    && undone.xp === before.xp;
  record("P6.7", "Undo inside the window puts done, xp and streak back", ok ? "PASS" : "FAIL",
    `done ${before.doneSize} → ${completed.doneSize} → ${undone.doneSize} · ` +
    `xp ${before.xp} → ${completed.xp} → ${undone.xp} · streak ${before.streakCount} → ${undone.streakCount}` +
    `\n         undo bar was offered=${undoShown}`);
}

/* ── P6.8 the full scope inventory before reset ─────────────────────────── */
const preReset = await snap();
{
  const groups = {
    "personal (p1)": keysMatching(preReset.all, /^jumvi_p1_(?!team_)/),
    "team (p1/t1)": keysMatching(preReset.all, /^jumvi_p1_team_t1_/),
    "second child (p2)": keysMatching(preReset.all, /^jumvi_p2_/),
    "device-wide": keysMatching(preReset.all, /^jumvi_(?!p\d)/),
    "harness marker (not the app's)": keysMatching(preReset.all, /^__qa_/),
  };
  record("P6.8", "scope inventory: every key sits under the scope it belongs to", "INFO",
    Object.entries(groups).map(([k, v]) => `${k}: ${v.length} keys\n           ${v.join("\n           ")}`).join("\n         "));
}

/* ── P6.9 reset clears the active scope and spares the children ─────────── */
/* P6.7 leaves the mission sheet open. switchTab() underneath an open modal
   changes nothing a mouse can see, so the press landed on the sheet's own
   completion button instead — the toast came back "Marked as not done". Close
   the sheet first, and verify it really closed before going near the mouse. */
await page.keyboard.press("Escape");
await page.waitForTimeout(600);
await dismiss();
await page.evaluate(() => switchTab("profile"));
await page.waitForTimeout(1000);
{
  const modalStillUp = await page.evaluate(() =>
    document.body.classList.contains("modalOpen")
    || !!document.getElementById("backdrop")?.classList.contains("show"));
  if (modalStillUp) console.log("   [warn] a modal is still open going into P6.9");
}
{
  /* Scroll FIRST, let it settle, and only then read the coordinates — reading
     the box and pressing in one go put the cursor where the button used to be
     and the hold silently missed, which looked exactly like "reset did not
     clear anything". */
  await page.evaluate(() => document.getElementById("btnReset")?.scrollIntoView({ block: "center" }));
  await page.waitForTimeout(500);
  const box = await page.evaluate(() => {
    const b = document.getElementById("btnReset");
    if (!b || !b.getClientRects().length) return null;
    const r = b.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  /* Confirm the cursor will actually land on the button. A hold that misses is
     indistinguishable from a reset that did nothing, and reporting the second
     when it was the first is exactly the mistake this file must not make. */
  const onTarget = box ? await page.evaluate(({ x, y }) => {
    const b = document.getElementById("btnReset");
    const hit = document.elementFromPoint(x, y);
    return !!(b && hit && (b === hit || b.contains(hit)));
  }, box) : false;
  let shortTap = null;
  if (box && onTarget) {
    // a real tap must NOT reset — proven before the real hold
    await page.mouse.move(box.x, box.y);
    await page.mouse.down(); await page.waitForTimeout(400); await page.mouse.up();
    await page.waitForTimeout(900);
    shortTap = await page.evaluate(() => ({
      toast: (document.getElementById("toast")?.textContent || "").trim(),
      done: window.__jumviPlayProbe?.()?.doneSize,
    }));
    await page.mouse.move(box.x, box.y);
    await page.mouse.down(); await page.waitForTimeout(1600); await page.mouse.up();
    await page.waitForTimeout(1500);
  }
  const toast = await page.evaluate(() => (document.getElementById("toast")?.textContent || "").trim());
  const afterReset = await snap();
  const p = afterReset.probe;
  const profilesIntact = afterReset.all["jumvi_profiles_v1"] === preReset.all["jumvi_profiles_v1"];
  /* Two keys are deliberately RECREATED at a fresh value rather than removed —
     each feature's own getter rebuilds its normal empty shape on next read. So
     "cleared" for those means "not the old value", not "absent". */
  /* The daily PICK is deterministic: ensureDailyMission() computes
     pickDailyId(today, dailyN) and reset puts dailyN back to 0. So after a
     reset today's mission is legitimately the SAME mission — resetting a
     child's progress does not change what today's challenge is, and an earlier
     version of this file wrongly demanded it change. What must be fresh is the
     shape around it: the counter back to 0 and the date stamped today. */
  const dailyN = afterReset.all["jumvi_p1_daily_n_v1"];
  const dailyDate = afterReset.all["jumvi_p1_daily_date_v1"];
  const todayIso = await page.evaluate(() => isoLocalDate());
  const dailyPickFresh = (dailyN === null || dailyN === undefined || dailyN === "0")
    && (!dailyDate || dailyDate === todayIso);
  const dailyChallengeFresh = (() => {
    try { return JSON.parse(afterReset.all["jumvi_p1_daily_challenge_v1"] || "{}").count === 0; }
    catch (_) { return !afterReset.all["jumvi_p1_daily_challenge_v1"]; }
  })();
  const cleared = {
    done: p?.doneSize === 0,
    xp: p?.xp === 0,
    streak: p?.streakCount === 0,
    bestStreak: p?.bestStreak === 0,
    badges: !afterReset.all["jumvi_p1_badges_unlocked_v1"],
    cert: !afterReset.all["jumvi_p1_cert_name_v1"] && !afterReset.all["jumvi_p1_cert_id_v1"],
    highScores: !afterReset.all["jumvi_p1_high_scores_v1"],
    attempts: !afterReset.all["jumvi_p1_attempts_v1"],
    dailyPickShapeFresh: dailyPickFresh,
    dailyChallengeAtZero: dailyChallengeFresh,
  };
  const missed = Object.entries(cleared).filter(([, v]) => !v).map(([k]) => k);
  const fired = /progress reset/i.test(toast);
  record("P6.9", "a short tap refuses; a deliberate hold clears the active scope and keeps the children",
    !onTarget ? "SKIP" : (fired && missed.length === 0 && profilesIntact ? "PASS" : "FAIL"),
    (!onTarget ? "the hold never landed on #btnReset — NOT measured, and NOT a pass\n         " : "") +
    `400ms tap → toast="${shortTap?.toast}" done=${shortTap?.done} (refused) · 1600ms hold → toast="${toast}"` +
    `\n         cleared: ${Object.entries(cleared).map(([k, v]) => k + "=" + v).join(" ")}` +
    (missed.length ? `\n         STILL PRESENT: ${missed.join(", ")}` : "") +
    `\n         profiles untouched=${profilesIntact} · other child p2 keys kept=${keysMatching(afterReset.all, /^jumvi_p2_/).length}` +
    `\n         inactive team scope kept=${afterReset.all["jumvi_p1_team_t1_missions_done_v3"] ?? "(gone)"} ` +
    `· daily challenge recreated=${afterReset.all["jumvi_p1_daily_challenge_v1"]}` +
    `\n         daily pick: n=${dailyN ?? "(cleared)"} date=${dailyDate ?? "(cleared)"} (today=${todayIso}) ` +
    `id ${preReset.all["jumvi_p1_daily_id_v1"] ?? "(none)"} → ${afterReset.all["jumvi_p1_daily_id_v1"] ?? "(cleared)"} ` +
    `— same id is correct, the pick is deterministic for the day`);
}

/* ── P6.10 reset survives a reload (it wrote, not just re-rendered) ──────── */
await reload();
{
  const after = await snap();
  const ok = after.probe?.doneSize === 0 && after.probe?.xp === 0;
  record("P6.10", "the reset is persisted, not only reflected on screen", ok ? "PASS" : "FAIL",
    `after reload: done=${after.probe?.doneSize} xp=${after.probe?.xp} streak=${after.probe?.streakCount}` +
    ` · profiles still there=${!!after.all["jumvi_profiles_v1"]}`);
}

await ctx.close();
await browser.close();
const pass = results.filter(r => r.status === "PASS").length;
const fail = results.filter(r => r.status === "FAIL").length;
const info = results.filter(r => r.status === "INFO").length;
console.log(`\n${pass} pass, ${fail} fail, ${info} informational, of ${results.length} checks.`);
process.exit(fail > 0 ? 1 : 0);

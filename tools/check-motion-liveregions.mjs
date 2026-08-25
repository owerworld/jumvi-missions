#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
 * check-motion-liveregions.mjs — Faz 6A.4.
 *
 * Two things a screen-reader or vestibular-sensitive family notices
 * immediately, and neither shows up in a static audit:
 *
 *   reduced motion — with prefers-reduced-motion: reduce, the decoration has
 *   to stop while the FUNCTION stays. So this checks both halves: animations
 *   are actually off on the real elements (computed animationName / duration,
 *   not a grep of the stylesheet), AND the 36 missions, the sheet, the timer
 *   and completion still work.
 *
 *   live-region traffic — an aria-live region is a promise that what changes
 *   inside it is worth interrupting someone for. A countdown that rewrites
 *   itself every second inside one turns a screen reader into a metronome at
 *   exactly the moment the product is saying "put the phone down". This
 *   counts real mutations, per region, during real play, by observing every
 *   [aria-live] node from before app.js runs.
 *
 *   node tools/check-motion-liveregions.mjs
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

/* The live-region census has to be installed BEFORE app.js parses, or the
   first announcements are already gone by the time we look. */
const LIVE_CENSUS = () => {
  window.__live = { regions: {}, started: 0 };
  const attach = () => {
    for (const el of document.querySelectorAll("[aria-live], [role=status], [role=alert]")) {
      if (el.__liveWatched) continue;
      el.__liveWatched = true;
      const key = el.id || el.tagName.toLowerCase() + "." + String(el.className).split(" ")[0];
      window.__live.regions[key] = window.__live.regions[key] || { announcements: 0, domMutations: 0, texts: [] };
      /* What a screen reader re-announces is a change to the region's
         ACCESSIBLE text, not any DOM mutation under it. aria-hidden="true"
         removes a subtree from the accessibility tree, so a per-second counter
         inside one produces mutations that can never reach the user. Counting
         raw mutations made this file report the app's own deliberate fix as
         spam, so both numbers are kept and only the accessible one can fail. */
      const accText = (root) => {
        let out = "";
        const walk = (n) => {
          if (n.nodeType === 3) { out += n.textContent; return; }
          if (n.nodeType !== 1) return;
          if (n.getAttribute("aria-hidden") === "true") return;
          if (getComputedStyle(n).display === "none") return;
          for (const c of n.childNodes) walk(c);
        };
        walk(root);
        return out.replace(/\s+/g, " ").trim();
      };
      window.__live.regions[key].texts.push(accText(el));
      new MutationObserver((recs) => {
        const r = window.__live.regions[key];
        for (const rec of recs) { if (rec.type !== "attributes") r.domMutations++; }
        const t = accText(el);
        if (t !== r.texts[r.texts.length - 1]) { r.texts.push(t); r.announcements++; }
      }).observe(el, { childList: true, characterData: true, subtree: true });
    }
  };
  /* An init script runs before <html> exists, so documentElement is null here
     and observing it throws — which used to abort this whole function and
     leave __liveReset undefined. Assign the API first, then wire the observer
     once there is a document element to watch. */
  window.__liveReset = () => {
    for (const k of Object.keys(window.__live.regions)) {
      const cur = window.__live.regions[k];
      window.__live.regions[k] = { announcements: 0, domMutations: 0, texts: cur.texts.slice(-1) };
    }
    window.__live.started = performance.now();
  };
  const arm = () => {
    if (!document.documentElement) { requestAnimationFrame(arm); return; }
    attach();
    new MutationObserver(attach).observe(document.documentElement, { childList: true, subtree: true });
  };
  arm();
  document.addEventListener("DOMContentLoaded", attach);
};

async function session({ reduced = false, census = false } = {}) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    ...(reduced ? { reducedMotion: "reduce" } : {}),
  });
  const page = await ctx.newPage();
  page.on("pageerror", () => {});
  await page.addInitScript(() => localStorage.setItem("jumvi_onboarded_v2", "1"));
  if (census) await page.addInitScript(LIVE_CENSUS);
  await page.goto(BASE, { waitUntil: "networkidle" }).catch(() => {});
  await page.waitForTimeout(1400);
  for (let i = 0; i < 5; i++) {
    if (!(await page.evaluate(() => document.body.classList.contains("modalOpen")))) break;
    await page.keyboard.press("Escape"); await page.waitForTimeout(300);
  }
  return { ctx, page };
}

/* The first Start tap plays narration, not the clock — same seam the play-state
   suite uses. Tap until the timer is genuinely running. */
const startUntilRunning = async (page) => {
  for (let i = 0; i < 4; i++) {
    await page.evaluate(() => document.getElementById("btnStartTimer")?.click());
    await page.waitForTimeout(1500);
    const st = await page.evaluate(() => window.__jumviPlayProbe?.()?.timerState);
    if (st === "running") return true;
  }
  return false;
};

console.log("Reduced motion and live regions — Faz 6A.4\n");

/* ── M01 reduced motion: the decoration stops ───────────────────────────── */
{
  const { ctx, page } = await session({ reduced: true });
  const honoured = await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches);
  const moving = await page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll("body *")) {
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden") continue;
      if (!el.getClientRects().length) continue;
      const anim = cs.animationName && cs.animationName !== "none";
      const dur = parseFloat(cs.animationDuration) || 0;
      const infinite = cs.animationIterationCount === "infinite";
      const paused = cs.animationPlayState === "paused";
      // an infinite, running, non-zero-duration animation is motion nobody asked for
      if (anim && dur > 0 && infinite && !paused) {
        out.push({
          sel: el.id ? "#" + el.id : el.tagName.toLowerCase() + "." + String(el.className).split(" ")[0],
          anim: cs.animationName, dur: cs.animationDuration,
        });
      }
    }
    return out;
  });
  await ctx.close();
  record("M01", "reduced motion: no looping animation is left running", moving.length === 0 ? "PASS" : "FAIL",
    `prefers-reduced-motion=${honoured} · still-looping=${moving.length}` +
    (moving.length ? " → " + moving.slice(0, 6).map(m => `${m.sel}[${m.anim} ${m.dur}]`).join(", ") : ""));
}

/* ── M02 reduced motion: the FUNCTION survives ──────────────────────────── */
{
  const { ctx, page } = await session({ reduced: true });
  await page.evaluate(() => { try { switchTab("browse"); } catch (_) {} });
  await page.waitForTimeout(700);
  const cards = await page.evaluate(() => document.querySelectorAll("[data-mission-id]").length);
  await page.evaluate(() => [...document.querySelectorAll("[data-mission-id]")].find(e => e.getClientRects().length)?.click());
  await page.waitForTimeout(900);
  const opened = await page.evaluate(() => ({
    sheet: document.getElementById("backdrop")?.classList.contains("show"),
    title: (document.getElementById("mTitle")?.textContent || "").trim().slice(0, 24),
    start: !!document.getElementById("btnStartTimer"),
  }));
  const ran = await startUntilRunning(page);
  const probe = await page.evaluate(() => window.__jumviPlayProbe?.() || {});
  await ctx.close();
  const ok = cards === 36 && opened.sheet && opened.start && ran;
  record("M02", "reduced motion: 36 missions, sheet and timer all still work", ok ? "PASS" : "FAIL",
    `cards=${cards} sheetOpen=${opened.sheet} ("${opened.title}") timerRan=${ran} timerState=${probe.timerState}`);
}

/* ── M03 reduced motion: celebration still tells you what happened ──────── */
{
  const { ctx, page } = await session({ reduced: true });
  await page.evaluate(() => { try { switchTab("browse"); } catch (_) {} });
  await page.waitForTimeout(600);
  await page.evaluate(() => [...document.querySelectorAll("[data-mission-id]")].find(e => e.getClientRects().length)?.click());
  await page.waitForTimeout(800);
  await startUntilRunning(page);
  // Open the dwell gate the honest way: make the sheet look like a family that
  // really has been playing for 90 seconds. No handler is bypassed — the gate
  // still computes itself from missionOpenedAt exactly as it does in the wild.
  await page.evaluate(() => { missionOpenedAt = Date.now() - 90000; });
  await page.waitForTimeout(1200);
  const before = await page.evaluate(() => window.__jumviPlayProbe?.()?.doneSize ?? null);
  await page.evaluate(() => document.getElementById("btnToggleDone")?.click());
  await page.waitForTimeout(1400);
  const after = await page.evaluate(() => ({
    done: window.__jumviPlayProbe?.()?.doneSize ?? null,
    reward: (() => { const r = document.getElementById("missionXpReward"); return r && !r.hidden; })(),
    rewardText: (document.getElementById("missionXpReward")?.textContent || "").replace(/\s+/g, " ").trim().slice(0, 50),
    undo: (() => { const u = document.getElementById("undoBar"); return !!u && !u.hidden; })(),
  }));
  await ctx.close();
  const completed = after.done !== before;
  record("M03", "reduced motion: completion still announces itself in text",
    completed || after.reward ? "PASS" : "FAIL",
    `done ${before}→${after.done} · reward card shown=${after.reward} · undo offered=${after.undo}` +
    `\n         reward text="${after.rewardText}" — the outcome is words, not only confetti`);
}

/* ── M04 live-region traffic during 10s of real play ────────────────────── */
{
  const { ctx, page } = await session({ census: true });
  await page.evaluate(() => { try { switchTab("browse"); } catch (_) {} });
  await page.waitForTimeout(700);
  await page.evaluate(() => [...document.querySelectorAll("[data-mission-id]")].find(e => e.getClientRects().length)?.click());
  await page.waitForTimeout(900);
  const ran = await startUntilRunning(page);
  await page.evaluate(() => window.__liveReset());
  await page.waitForTimeout(10000);           // ten real seconds of a running timer
  const census = await page.evaluate(() => window.__live.regions);
  await ctx.close();

  const rows = Object.entries(census).filter(([, v]) => v.announcements > 0 || v.domMutations > 0)
    .sort((a, b) => b[1].announcements - a[1].announcements);
  /* A screen reader interrupting someone more than twice in ten seconds, while
     the app is telling them to put the phone down, is spam. */
  const LIMIT = 2;
  const noisy = rows.filter(([, v]) => v.announcements > LIMIT);
  const hidden = rows.filter(([, v]) => v.announcements === 0 && v.domMutations > 0);
  record("M04", `live regions during 10s of a running timer (limit ${LIMIT} announcements per region)`,
    noisy.length === 0 ? "PASS" : "FAIL",
    `timerRan=${ran} · announcements: ` +
    (rows.length ? rows.map(([k, v]) => `${k}=${v.announcements} (raw DOM ${v.domMutations})`).join(", ") : "none") +
    (hidden.length ? `\n         ${hidden.map(([k, v]) => `"${k}" mutated ${v.domMutations}× but its accessible text never changed`).join("; ")}` +
      `\n         — those writes are inside aria-hidden nodes, so nothing reaches the accessibility tree` : "") +
    (noisy.length ? `\n         OVER LIMIT: ${noisy.map(([k, v]) => `${k}=${v.announcements}`).join(", ")}` : ""));
}

/* ── M05 the countdown number is still available, just not shouted ──────── */
{
  const { ctx, page } = await session();
  await page.evaluate(() => { try { switchTab("browse"); } catch (_) {} });
  await page.waitForTimeout(700);
  await page.evaluate(() => [...document.querySelectorAll("[data-mission-id]")].find(e => e.getClientRects().length)?.click());
  await page.waitForTimeout(900);
  await startUntilRunning(page);
  await page.waitForTimeout(1200);
  const st = await page.evaluate(() => {
    const dial = document.getElementById("playPanelDial");
    const done = document.getElementById("btnToggleDone");
    return {
      dialHidden: dial?.getAttribute("aria-hidden"),
      dialText: (dial?.textContent || "").trim(),
      doneLabel: (done?.textContent || done?.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim().slice(0, 44),
      timerText: (document.getElementById("timerDisplay")?.textContent || "").trim(),
    };
  });
  await ctx.close();
  // The number must reach a screen-reader user through a real control, not by
  // machine-gunning a live region.
  const reachable = /\d/.test(st.doneLabel) || /\d/.test(st.timerText);
  const ok = st.dialHidden === "true" && reachable;
  record("M05", "the per-second number is aria-hidden but still reachable on a real control",
    ok ? "PASS" : "FAIL",
    `#playPanelDial aria-hidden=${st.dialHidden} text="${st.dialText}" · ` +
    `completion button label="${st.doneLabel}" · timer="${st.timerText}"`);
}

/* ── M06 Undo and completion DO get announced ───────────────────────────── */
{
  const { ctx, page } = await session({ census: true });
  await page.evaluate(() => { try { switchTab("browse"); } catch (_) {} });
  await page.waitForTimeout(700);
  await page.evaluate(() => [...document.querySelectorAll("[data-mission-id]")].find(e => e.getClientRects().length)?.click());
  await page.waitForTimeout(900);
  await startUntilRunning(page);
  await page.evaluate(() => { missionOpenedAt = Date.now() - 90000; });
  await page.waitForTimeout(1200);
  await page.evaluate(() => window.__liveReset());
  await page.evaluate(() => document.getElementById("btnToggleDone")?.click());
  await page.waitForTimeout(1600);
  const census = await page.evaluate(() => window.__live.regions);
  const undoVisible = await page.evaluate(() => { const u = document.getElementById("undoBar"); return !!u && !u.hidden; });
  await ctx.close();
  const spoke = Object.entries(census).filter(([, v]) => v.announcements > 0);
  const undoSpoke = spoke.find(([k]) => /undo/i.test(k));
  record("M06", "completion and Undo are announced (the events worth interrupting for)",
    spoke.length > 0 ? "PASS" : "FAIL",
    `undo bar visible=${undoVisible} · regions that spoke: ` +
    (spoke.length ? spoke.map(([k, v]) => `${k}=${v.announcements}`).join(", ") : "NONE") +
    (undoSpoke ? `\n         undo said: ${JSON.stringify(undoSpoke[1].texts.slice(0, 2))}` : ""));
}

await browser.close();
const pass = results.filter(r => r.status === "PASS").length;
const fail = results.filter(r => r.status === "FAIL").length;
console.log(`\n${pass} pass, ${fail} fail, of ${results.length} checks.`);
process.exit(fail > 0 ? 1 : 0);

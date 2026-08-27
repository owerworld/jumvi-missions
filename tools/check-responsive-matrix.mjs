#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
 * check-responsive-matrix.mjs — Faz 6B. The six viewports, every primary
 * surface, and a hit test rather than a look.
 *
 * The distinction this file is built around: a control having a box on screen
 * is not the same as a control a finger can reach. A sticky bottom nav, a
 * sheet footer and a fixed undo bar all paint over content quite legally, so
 * every claim here ends in document.elementFromPoint() on the control's own
 * centre — after scrolling it into view, and after a second attempt at the end
 * of the scroll range, because these screens deliberately keep the nav on
 * screen.
 *
 * Screenshots are written next to the assertions so a human can check the same
 * frame the numbers came from.
 *
 *   node tools/check-responsive-matrix.mjs
 *   node tools/check-responsive-matrix.mjs --only=568x320
 * Exit 1 on any FAIL.
 * ══════════════════════════════════════════════════════════════════════════*/
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";

const require_ = createRequire(import.meta.url);
const chromium = (() => {
  const spec = process.env.JUMVI_PW || "playwright";
  try { return require_(spec).chromium; }
  catch { console.error(`Playwright not found (tried "${spec}"). Set JUMVI_PW.`); process.exit(2); }
})();
const args = process.argv.slice(2);
const argVal = (n, d) => { const h = args.find((a) => a.startsWith(`--${n}=`)); return h ? h.slice(n.length + 3) : d; };
const BASE = argVal("base", "http://localhost:8910/index.html");
const SHOTS = argVal("shots", "docs/audits/screens/faz6");
const ONLY = argVal("only", "").split(",").filter(Boolean);
const EXE = process.env.JUMVI_EXE_CHROMIUM || undefined;
mkdirSync(SHOTS, { recursive: true });

const VIEWPORTS = [
  { w: 320, h: 568, o: "portrait" },
  { w: 390, h: 844, o: "portrait" },
  { w: 430, h: 932, o: "portrait" },
  { w: 568, h: 320, o: "landscape" },
  { w: 844, h: 390, o: "landscape" },
  { w: 768, h: 1024, o: "portrait" },
];

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

/* Injected once per page: the two primitives every assertion below uses. */
const HELPERS = () => {
  /* Reach: scroll it into view, hit test its centre, and if a fixed layer is in
     the way, scroll to the end of the range and try once more. Returns what
     blocked it, so a failure names the culprit instead of just saying "no". */
  window.__reach = (el) => {
    if (!el) return { ok: false, why: "absent" };
    if (!el.getClientRects().length) return { ok: false, why: "no box" };
    const test = () => {
      const r = el.getBoundingClientRect();
      const x = Math.min(Math.max(r.left + r.width / 2, 1), innerWidth - 1);
      const y = Math.min(Math.max(r.top + r.height / 2, 1), innerHeight - 1);
      const hit = document.elementFromPoint(x, y);
      return { ok: !!hit && (el === hit || el.contains(hit) || hit.contains(el)), hit };
    };
    el.scrollIntoView({ block: "center", inline: "nearest" });
    let t = test();
    if (!t.ok) {
      const sc = el.closest(".sheetBody, .tabPanel, #app-wrapper") || document.scrollingElement;
      try { sc.scrollTop = sc.scrollHeight; } catch (_) {}
      window.scrollTo(0, document.documentElement.scrollHeight);
      t = test();
    }
    return { ok: t.ok, why: t.ok ? "" : "blocked by " + (t.hit ? (t.hit.id || String(t.hit.className).split(" ")[0] || t.hit.tagName) : "nothing") };
  };
  /* Text whose own box can no longer hold it, ignoring deliberate ellipsis. */
  window.__clipped = () => {
    const out = [];
    for (const el of document.querySelectorAll("body *")) {
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden") continue;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      const own = [...el.childNodes].filter(n => n.nodeType === 3 && n.textContent.trim()).length;
      if (!own) continue;
      const ellipsis = cs.textOverflow === "ellipsis" && cs.whiteSpace === "nowrap";
      if (ellipsis) continue;
      const hx = /hidden|clip/.test(cs.overflowX) && el.scrollWidth - el.clientWidth > 2;
      const hy = /hidden|clip/.test(cs.overflowY) && el.scrollHeight - el.clientHeight > 2;
      if (hx || hy) out.push((el.id ? "#" + el.id : el.tagName.toLowerCase() + "." + String(el.className).split(" ")[0])
        + ':"' + (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 22) + '"');
    }
    return out;
  };
  window.__hoverflow = () => document.documentElement.scrollWidth - document.documentElement.clientWidth;
};

async function open(vp) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
  const page = await ctx.newPage();
  page.on("pageerror", () => {});
  await page.addInitScript(() => localStorage.setItem("jumvi_onboarded_v2", "1"));
  await page.addInitScript(HELPERS);
  await page.goto(BASE, { waitUntil: "networkidle" }).catch(() => {});
  await page.waitForTimeout(1400);
  for (let i = 0; i < 5; i++) {
    if (!(await page.evaluate(() => document.body.classList.contains("modalOpen")))) break;
    await page.keyboard.press("Escape"); await page.waitForTimeout(300);
  }
  return { ctx, page };
}

const reachAll = (page, sels) => page.evaluate((list) => {
  const out = [];
  for (const sel of list) {
    const el = document.querySelector(sel);
    const r = window.__reach(el);
    out.push({ sel, ok: r.ok, why: r.why });
  }
  return out;
}, sels);

console.log("Responsive matrix — Faz 6B\n");

for (const vp of VIEWPORTS) {
  const tag = `${vp.w}x${vp.h}`;
  if (ONLY.length && !ONLY.includes(tag)) continue;

  /* ── the four tabs: clipping, horizontal overflow, nav reachable ─────── */
  {
    const { ctx, page } = await open(vp);
    const per = {};
    for (const t of ["today", "browse", "modes", "profile"]) {
      await page.evaluate((x) => switchTab(x), t);
      await page.waitForTimeout(700);
      per[t] = {
        clipped: await page.evaluate(() => window.__clipped()),
        hover: await page.evaluate(() => window.__hoverflow()),
        nav: await page.evaluate(() => [...document.querySelectorAll(".navTab")]
          .map(n => ({ label: (n.textContent || "").trim().slice(0, 10), ...window.__reach(n) }))),
      };
      await page.screenshot({ path: `${SHOTS}/${tag}-${t}.png` });
    }
    await ctx.close();
    const clipped = Object.entries(per).filter(([, v]) => v.clipped.length);
    const overflow = Object.entries(per).filter(([, v]) => v.hover > 2);
    const navBad = Object.entries(per).filter(([, v]) => v.nav.some(n => !n.ok));
    const ok = !clipped.length && !overflow.length && !navBad.length;
    record(`${tag}.tabs`, `${tag} ${vp.o}: four tabs — no clipping, no sideways scroll, nav reachable`,
      ok ? "PASS" : "FAIL",
      `clipping: ${clipped.length ? clipped.map(([k, v]) => `${k}→${v.clipped.slice(0, 3).join(", ")}`).join(" | ") : "none"}` +
      `\n         horizontal overflow: ${overflow.length ? overflow.map(([k, v]) => `${k}=${v.hover}px`).join(", ") : "none"}` +
      ` · nav buttons reachable on all four tabs: ${!navBad.length}` +
      (navBad.length ? " → " + navBad.map(([k, v]) => `${k}: ${v.nav.filter(n => !n.ok).map(n => n.label + " " + n.why).join(", ")}`).join(" | ") : ""));
  }

  /* ── the mission sheet: every play control, and the footer ───────────── */
  {
    const { ctx, page } = await open(vp);
    await page.evaluate(() => switchTab("browse"));
    await page.waitForTimeout(700);
    await page.evaluate(() => [...document.querySelectorAll("[data-mission-id]")].find(e => e.getClientRects().length)?.click());
    await page.waitForTimeout(1000);
    const beforeStart = await reachAll(page, ["#btnClose", "#btnStartTimer"]);
    const scrolls = await page.evaluate(() => {
      const b = document.querySelector("#backdrop .sheetBody");
      return b ? { canScroll: b.scrollHeight > b.clientHeight + 2, h: b.clientHeight } : null;
    });
    // start for real so the completion controls exist
    for (let i = 0; i < 4; i++) {
      await page.evaluate(() => document.getElementById("btnStartTimer")?.click());
      await page.waitForTimeout(1400);
      if ((await page.evaluate(() => window.__jumviPlayProbe?.()?.timerState)) === "running") break;
    }
    await page.evaluate(() => { missionOpenedAt = Date.now() - 90000; });
    await page.waitForTimeout(1200);
    /* #btnStartTimer is deliberately swapped out once the clock is running, so
       it is reported but never counted as unreachable in this state. */
    const playing = await reachAll(page, ["#btnStartTimer", "#btnToggleDone", "#btnClose"]);
    const playingRequired = playing.filter(r => r.sel !== "#btnStartTimer");
    await page.screenshot({ path: `${SHOTS}/${tag}-mission-playing.png` });
    // complete, then check the sheet's own action row survives the takeover
    await page.evaluate(() => document.getElementById("btnToggleDone")?.click());
    await page.waitForTimeout(1300);
    /* Measured WITHOUT scrolling: post-completion the sheet already shows its
       action row, and __reach() scrolls the target to the vertical centre,
       which reports a different layout than the one the family actually sees.
       Geometry plus a grid hit test over the whole button is the honest measure.

       This used to also weigh the Undo bar against "Next". The bar is gone, so
       what is left is the question that outlived it: is the action row still
       reachable once the celebration card takes the screen? */
    const nextState = await page.evaluate(() => {
      const barGone = !document.getElementById("undoBar");
      const n = document.getElementById("btnNext");
      if (!n || !n.getClientRects().length) return { barGone, next: "no box" };
      const nr = n.getBoundingClientRect();
      const withinViewport = nr.top >= 0 && nr.bottom <= innerHeight;
      let clickable = false;
      for (let x = nr.left + 6; x < nr.right - 6 && !clickable; x += 8) {
        for (let y = nr.top + 4; y < nr.bottom - 4; y += 6) {
          const hit = document.elementFromPoint(x, y);
          if (hit && (hit === n || n.contains(hit))) { clickable = true; break; }
        }
      }
      return { barGone, next: `${Math.round(nr.top)}–${Math.round(nr.bottom)}`, withinViewport, clickable };
    });
    await page.screenshot({ path: `${SHOTS}/${tag}-mission-done.png` });
    await ctx.close();
    const bad = [...beforeStart, ...playingRequired]
      .filter(r => !r.ok && r.why !== "absent" && r.why !== "no box");
    const nextUsable = nextState.next === "no box" || nextState.clickable;
    record(`${tag}.mission`, `${tag} ${vp.o}: mission sheet controls reachable, Next not buried`,
      bad.length === 0 && nextUsable && nextState.barGone ? "PASS" : "FAIL",
      `before start: ${beforeStart.map(r => `${r.sel}=${r.ok ? "ok" : r.why}`).join(" ")} · sheet scrolls=${scrolls?.canScroll}` +
      `\n         playing: ${playing.map(r => `${r.sel}=${r.ok ? "ok" : r.why}`).join(" ")}` +
      `\n         after completion: #undoBar in DOM=${!nextState.barGone} · #btnNext ${nextState.next}` +
      ` · fully in viewport=${nextState.withinViewport} · any part tappable=${nextState.clickable}`);
  }

  /* ── Family: the first actions must be reachable, not merely present ─── */
  {
    const { ctx, page } = await open(vp);
    await page.evaluate(() => switchTab("modes"));
    await page.waitForTimeout(900);
    const acts = await page.evaluate(() => {
      const out = [];
      for (const sel of [".familyPickMission", "#btnFamilyAddPlayer"]) {
        const el = document.querySelector(sel);
        const r = el ? el.getBoundingClientRect() : null;
        out.push({ sel, top: r ? Math.round(r.top) : null,
          inFirstViewport: !!(r && r.top >= 0 && r.top < innerHeight), ...window.__reach(el) });
      }
      const nav = document.getElementById("bottomNav");
      out.navTop = nav ? Math.round(nav.getBoundingClientRect().top) : null;
      return { items: out, navTop: out.navTop, vh: innerHeight };
    });
    await page.screenshot({ path: `${SHOTS}/${tag}-family.png` });
    await ctx.close();
    const bad = acts.items.filter(a => !a.ok);
    record(`${tag}.family`, `${tag} ${vp.o}: Family's first actions are reachable`,
      bad.length === 0 ? "PASS" : "FAIL",
      acts.items.map(a => `${a.sel} top=${a.top} inFirstViewport=${a.inFirstViewport} reachable=${a.ok}${a.why ? " (" + a.why + ")" : ""}`).join("\n         ") +
      `\n         viewport height=${acts.vh} · bottom nav top=${acts.navTop}`);
  }

  /* ── Profile edit: Save and Cancel within a reasonable reach ─────────── */
  {
    const { ctx, page } = await open(vp);
    await page.evaluate(() => { try { document.getElementById("avatarBtn")?.click(); } catch (_) {} });
    await page.waitForTimeout(800);
    /* The Save/Cancel pair lives in #profileEditSection, which stays
       display:none until a parent actually picks a child to edit — an earlier
       run reported "no box" for both and was measuring a panel nobody had
       opened. openProfileEdit(id) is the real entry the pencil row calls. */
    await page.evaluate(() => { try { openProfileEdit(getActiveProfileId()); } catch (_) {} });
    await page.waitForTimeout(900);
    const opened = await page.evaluate(() =>
      document.getElementById("profileBackdrop")?.classList.contains("show"));
    const saveCancel = await reachAll(page, ["#btnProfileEditSave", "#btnProfileEditCancel", "#btnProfileClose"]);
    const clipped = await page.evaluate(() => window.__clipped());
    await page.screenshot({ path: `${SHOTS}/${tag}-profile-edit.png` });
    await ctx.close();
    const present = saveCancel.filter(r => r.why !== "absent");
    const bad = present.filter(r => !r.ok);
    record(`${tag}.profile`, `${tag} ${vp.o}: profile Save/Cancel reachable, nothing clipped`,
      opened && bad.length === 0 && clipped.length === 0 ? "PASS" : (opened ? "FAIL" : "SKIP"),
      `sheet open=${opened} · ` + saveCancel.map(r => `${r.sel}=${r.ok ? "ok" : r.why}`).join(" ") +
      `\n         clipped=${clipped.length}${clipped.length ? " → " + clipped.slice(0, 3).join(", ") : ""}`);
  }
}

await browser.close();
const pass = results.filter(r => r.status === "PASS").length;
const fail = results.filter(r => r.status === "FAIL").length;
const skip = results.filter(r => r.status === "SKIP").length;
console.log(`\n${pass} pass, ${fail} fail, ${skip} skipped, of ${results.length} checks.`);
console.log(`screenshots → ${SHOTS}/`);
process.exit(fail > 0 ? 1 : 0);

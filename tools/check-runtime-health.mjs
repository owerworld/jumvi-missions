#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
 * check-runtime-health.mjs — Faz 6C.1 and the Privacy row of the final matrix.
 *
 * Everything here is observed from OUTSIDE the app: console events, network
 * responses, request bodies, and the decoded state of every <img> after load.
 * Nothing is asked of the app itself, because an app that is broken is
 * exactly the app whose self-report cannot be trusted.
 *
 * The privacy half is the part worth being careful about. JUMVI's whole
 * promise is that a child's name never leaves the device, so this seeds a
 * name that could not occur by accident, drives a full session with it, and
 * then greps every console line and every outgoing request — URL, headers and
 * body — for that string. A single hit is a P0.
 *
 *   node tools/check-runtime-health.mjs
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

/* A name no product string, asset path or library could contain by accident. */
const CANARY = "Zylphraxine";

/* Two network outcomes are expected on a LOCAL static server and are not app
   defects. They are named explicitly rather than pattern-whitelisted, and each
   one gets its own positive assertion below that the app handles it:

     POST /api/beacon → 405   the analytics endpoint is a Cloudflare Worker
                              (src/worker.js, BEACON_PATH="/api/beacon"); the
                              static dev server has no POST handler. Production
                              contract, per docs/audits/faz1-beacon.md, is 204.
     mission-book.pdf         checkOptionalDownloads() probes optional assets on
                              purpose. The file IS present here (GET and HEAD
                              both return 200 — verified with curl), so the
                              link is correctly left live; the stray
                              ERR_ABORTED is the browser dropping a request it
                              no longer needs, not a missing asset. R6.6 checks
                              the link's state against the file's real
                              availability rather than assuming either.

   "Failed to load resource" lines are the browser's own network log, not
   something app code threw, so they are counted apart from real exceptions. */
const EXPECTED_LOCAL = [/\/api\/beacon$/, /mission-book\.pdf$/];
const isExpectedLocal = (url) => EXPECTED_LOCAL.some((re) => re.test(url));
const isNetworkLogLine = (e) => /Failed to load resource/i.test(e.text);

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

/* One instrumented session; every listener is attached before the first byte. */
async function watched({ seedCanary = false, onboarded = true } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const log = { errors: [], warnings: [], logs: [], rejections: [], badResponses: [], requests: [] };

  page.on("console", (m) => {
    const entry = { type: m.type(), text: m.text().slice(0, 200), url: m.location()?.url || "" };
    if (m.type() === "error") log.errors.push(entry);
    else if (m.type() === "warning") log.warnings.push(entry);
    else log.logs.push(entry);
  });
  page.on("pageerror", (e) => log.errors.push({ type: "pageerror", text: String(e.message).slice(0, 200), url: "" }));
  page.on("requestfailed", (r) => {
    // a deliberately offline test would land here; this session is online
    log.badResponses.push({ url: r.url(), status: "requestfailed: " + (r.failure()?.errorText || "?") });
  });
  page.on("response", (r) => {
    if (r.status() >= 400) log.badResponses.push({ url: r.url(), status: r.status() });
  });
  page.on("request", (r) => {
    /* navigator.sendBeacon posts a Blob, and postData() returns null for those
       — the body only comes back through postDataBuffer(). Reading just
       postData() made the beacon-privacy check silently measure nothing. */
    let post = r.postData() || "";
    if (!post) { try { post = (r.postDataBuffer() || Buffer.alloc(0)).toString("utf8"); } catch (_) { post = ""; } }
    log.requests.push({ url: r.url(), method: r.method(), post: post.slice(0, 4000),
      headers: JSON.stringify(r.headers()).slice(0, 2000) });
  });

  await page.addInitScript(() => {
    window.__rejections = [];
    addEventListener("unhandledrejection", (e) => {
      window.__rejections.push(String(e.reason && e.reason.message ? e.reason.message : e.reason).slice(0, 200));
    });
  });
  if (onboarded) await page.addInitScript(() => localStorage.setItem("jumvi_onboarded_v2", "1"));
  if (seedCanary) await page.addInitScript((name) => {
    localStorage.setItem("jumvi_profiles_v1", JSON.stringify([{ id: "p1", name, avatar: "1" }]));
    localStorage.setItem("jumvi_active_profile_v1", "p1");
    localStorage.setItem("jumvi_p1_cert_name_v1", name);
  }, CANARY);

  await page.goto(BASE, { waitUntil: "networkidle" }).catch(() => {});
  await page.waitForTimeout(1600);
  return { ctx, page, log };
}

const dismissModals = async (page) => {
  for (let i = 0; i < 5; i++) {
    if (!(await page.evaluate(() => document.body.classList.contains("modalOpen")))) break;
    await page.keyboard.press("Escape"); await page.waitForTimeout(300);
  }
};

console.log("Runtime health and privacy — Faz 6C.1\n");

/* ── R6.1 clean first open ──────────────────────────────────────────────── */
{
  const { ctx, page, log } = await watched({ onboarded: false });
  const welcome = await page.evaluate(() => {
    const w = document.getElementById("welcomeOverlay");
    return !!w && w.getClientRects().length > 0;
  });
  const rejections = await page.evaluate(() => window.__rejections || []);
  await ctx.close();
  const appErrors = log.errors.filter(e => !isNetworkLogLine(e));
  const netNoise = log.errors.filter(isNetworkLogLine);
  const unexpectedNet = log.badResponses.filter(r => !isExpectedLocal(r.url));
  const ok = appErrors.length === 0 && rejections.length === 0 && welcome && unexpectedNet.length === 0;
  record("R6.1", "clean profile, first open: onboarding appears, no app code throws", ok ? "PASS" : "FAIL",
    `welcome overlay shown=${welcome} · app exceptions=${appErrors.length} · unhandled rejections=${rejections.length}` +
    `\n         browser network-log lines=${netNoise.length} (all from the two expected-local endpoints: ${unexpectedNet.length === 0})` +
    (appErrors.length ? "\n         " + appErrors.slice(0, 4).map(e => `[${e.type}] ${e.text}`).join("\n         ") : "") +
    (unexpectedNet.length ? "\n         UNEXPECTED: " + unexpectedNet.slice(0, 4).map(b => `${b.status} ${b.url}`).join(", ") : "") +
    (rejections.length ? "\n         rejections: " + rejections.slice(0, 3).join(" | ") : ""));
}

/* ── R6.2 a full session across all four tabs and a real mission ────────── */
{
  const { ctx, page, log } = await watched();
  await dismissModals(page);
  const tabs = {};
  for (const t of ["today", "browse", "modes", "profile"]) {
    await page.evaluate((x) => switchTab(x), t);
    await page.waitForTimeout(700);
    tabs[t] = await page.evaluate((x) => document.body.classList.contains("tab-" + x), t);
  }
  await page.evaluate(() => switchTab("browse")); await page.waitForTimeout(700);
  const cards = await page.evaluate(() => document.querySelectorAll("[data-mission-id]").length);
  await page.evaluate(() => [...document.querySelectorAll("[data-mission-id]")].find(e => e.getClientRects().length)?.click());
  await page.waitForTimeout(1000);
  const sheet = await page.evaluate(() => document.getElementById("backdrop")?.classList.contains("show"));
  await page.keyboard.press("Escape"); await page.waitForTimeout(500);
  const rejections = await page.evaluate(() => window.__rejections || []);
  await ctx.close();
  const allTabs = Object.values(tabs).every(Boolean);
  const appErrors = log.errors.filter(e => !isNetworkLogLine(e));
  const unexpectedNet = log.badResponses.filter(r => !isExpectedLocal(r.url));
  const ok = allTabs && cards === 36 && sheet && appErrors.length === 0
    && rejections.length === 0 && unexpectedNet.length === 0;
  record("R6.2", "four tabs, 36 missions, a sheet — no app exception, no rejection", ok ? "PASS" : "FAIL",
    `tabs ok=${allTabs} (${Object.entries(tabs).map(([k, v]) => k + "=" + v).join(" ")}) · cards=${cards} · sheet=${sheet}` +
    `\n         app exceptions=${appErrors.length} · unhandled rejections=${rejections.length} · warnings=${log.warnings.length}` +
    `\n         unexpected network failures=${unexpectedNet.length}` +
    (appErrors.length ? "\n         " + appErrors.slice(0, 5).map(e => `[${e.type}] ${e.text}`).join("\n         ") : "") +
    (unexpectedNet.length ? "\n         UNEXPECTED: " + unexpectedNet.slice(0, 4).map(b => `${b.status} ${b.url}`).join(", ") : ""));
}

/* ── R6.3 no 404s and no undecodable images ─────────────────────────────── */
{
  const { ctx, page, log } = await watched();
  await dismissModals(page);
  for (const t of ["today", "browse", "modes", "profile"]) {
    await page.evaluate((x) => switchTab(x), t);
    await page.waitForTimeout(900);
  }
  const broken = await page.evaluate(() =>
    [...document.querySelectorAll("img")]
      .filter(i => i.currentSrc && i.complete && i.naturalWidth === 0)
      .map(i => i.currentSrc.split("/").slice(-1)[0]));
  await ctx.close();
  const bad = log.badResponses.filter(r => !/favicon/i.test(r.url) && !isExpectedLocal(r.url));
  const expected = log.badResponses.filter(r => isExpectedLocal(r.url));
  const ok = bad.length === 0 && broken.length === 0;
  record("R6.3", "no unexpected 404/failed request, no image that fails to decode", ok ? "PASS" : "FAIL",
    `expected-on-a-static-server=${expected.length} (POST /api/beacon → Worker in prod; HEAD mission-book.pdf → optional asset probe)\n         ` +
    `bad responses=${bad.length}${bad.length ? "\n         " + bad.slice(0, 8).map(b => `${b.status}  ${b.url}`).join("\n         ") : ""}` +
    ` · broken <img>=${broken.length}${broken.length ? " → " + broken.slice(0, 5).join(", ") : ""}`);
}

/* ── R6.4 debug noise left in the shipped build ─────────────────────────── */
{
  const { ctx, page, log } = await watched();
  await dismissModals(page);
  for (const t of ["today", "browse", "modes", "profile"]) {
    await page.evaluate((x) => switchTab(x), t);
    await page.waitForTimeout(700);
  }
  await ctx.close();
  const chatty = log.logs.filter(l => l.type === "log" || l.type === "debug");
  record("R6.4", "console is not used as a debug channel in the shipped build",
    chatty.length <= 3 ? "PASS" : "INFO",
    `console.log/debug lines during a full four-tab session=${chatty.length}` +
    (chatty.length ? "\n         " + chatty.slice(0, 5).map(l => l.text.slice(0, 90)).join("\n         ") : ""));
}

/* ── R6.5 PRIVACY: a seeded child name must never leave the device ──────── */
{
  const { ctx, page, log } = await watched({ seedCanary: true });
  await dismissModals(page);
  // drive the surfaces that actually handle the name
  for (const t of ["today", "modes", "profile"]) {
    await page.evaluate((x) => switchTab(x), t);
    await page.waitForTimeout(700);
  }
  await page.evaluate(() => { try { document.getElementById("avatarBtn")?.click(); } catch (_) {} });
  await page.waitForTimeout(700);
  await page.keyboard.press("Escape"); await page.waitForTimeout(400);
  await page.evaluate(() => { try { openCertificate(); } catch (_) {} });
  await page.waitForTimeout(1500);
  await page.keyboard.press("Escape"); await page.waitForTimeout(400);
  await page.evaluate(() => switchTab("browse")); await page.waitForTimeout(700);
  await page.evaluate(() => [...document.querySelectorAll("[data-mission-id]")].find(e => e.getClientRects().length)?.click());
  await page.waitForTimeout(900);
  await page.keyboard.press("Escape"); await page.waitForTimeout(600);

  // confirm the canary was really in play, or this proves nothing
  const inUse = await page.evaluate((n) =>
    (document.body.innerText || "").includes(n) || localStorage.getItem("jumvi_p1_cert_name_v1") === n, CANARY);
  await ctx.close();

  const hasCanary = (s) => typeof s === "string" && s.includes(CANARY);
  const consoleHits = [...log.errors, ...log.warnings, ...log.logs].filter(e => hasCanary(e.text));
  const outbound = log.requests.filter(r => r.method !== "GET" || /[?&]/.test(r.url));
  const requestHits = log.requests.filter(r => hasCanary(r.url) || hasCanary(r.post) || hasCanary(r.headers));
  const offHost = log.requests.filter(r => !r.url.startsWith("http://localhost:8910") && !r.url.startsWith("data:") && !r.url.startsWith("blob:"));

  const ok = consoleHits.length === 0 && requestHits.length === 0;
  record("R6.5", `a seeded child name ("${CANARY}") never reaches a log or the network`,
    ok ? "PASS" : "FAIL",
    `canary really in use=${inUse} · console hits=${consoleHits.length} · request hits=${requestHits.length}` +
    `\n         ${log.requests.length} requests observed, ${outbound.length} with a query or body, ` +
    `${offHost.length} to a host other than the local server` +
    (offHost.length ? " → " + offHost.slice(0, 4).map(r => r.url.slice(0, 70)).join(", ") : "") +
    (requestHits.length ? "\n         LEAKED IN: " + requestHits.slice(0, 3).map(r => r.method + " " + r.url.slice(0, 80)).join(", ") : ""));
}

/* ── R6.6 the optional-asset probe's FALLBACK actually fires ────────────── */
/* mission-book.pdf is absent here, which is the case checkOptionalDownloads()
   exists to handle. Rather than excusing the failed request, prove the app did
   the right thing with it: the link must end up disabled and relabelled, not
   left as a live link to a file that is not there. */
{
  const { ctx, page } = await watched();
  await dismissModals(page);
  await page.evaluate(() => switchTab("profile"));
  await page.waitForTimeout(2000);
  const links = await page.evaluate(() =>
    [...document.querySelectorAll("[data-optional-file]")].map(a => ({
      file: a.getAttribute("data-optional-file"),
      text: (a.textContent || "").replace(/\s+/g, " ").trim().slice(0, 40),
      disabled: a.getAttribute("aria-disabled") === "true" || a.classList.contains("disabled")
        || !a.getAttribute("href"),
    })));
  /* Ask the server directly, from the page, what each file's real status is —
     so the link's state is judged against reality rather than an assumption
     about which files this checkout happens to contain. */
  const real = await page.evaluate(async (files) => {
    const out = {};
    for (const f of files) {
      try { const r = await fetch(f, { method: "HEAD", cache: "no-store" }); out[f] = r.status; }
      catch (e) { out[f] = "network error"; }
    }
    return out;
  }, links.map(l => l.file));
  await ctx.close();
  /* Present ⇒ must be live. Missing (404/403) ⇒ must be disabled and relabelled.
     Anything else (a network error) is the offline case: leave the UI alone. */
  const wrong = links.filter(l => {
    const st = real[l.file];
    if (st === 200) return l.disabled;
    if (st === 404 || st === 403) return !l.disabled;
    return false;
  });
  record("R6.6", "optional download links match whether the file is really there",
    links.length === 0 ? "SKIP" : (wrong.length === 0 ? "PASS" : "FAIL"),
    links.length === 0 ? "no [data-optional-file] links on this build — nothing to check"
      : links.map(l => `${l.file}: server=${real[l.file]} link text="${l.text}" disabled=${l.disabled}`).join("\n         ") +
        (wrong.length ? `\n         MISMATCH on ${wrong.map(w => w.file).join(", ")}` : ""));
}

/* ── R6.7 PRIVACY: what the analytics beacon actually puts on the wire ──── */
/* The Privacy sheet promises "an event name plus, at most, one small value",
   never a name, profile or identifier. That promise is checkable — but not
   from Playwright's request events: navigator.sendBeacon posts a Blob, and
   both postData() and postDataBuffer() come back EMPTY for those (verified:
   7 beacon POSTs observed, every body blank). So the payload is captured at
   the sendBeacon/fetch boundary instead, wrapped before app.js parses. That is
   still an observation from outside the app — it reads the bytes the app hands
   to the platform, which is exactly what would travel. */
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  page.on("pageerror", () => {});
  await page.addInitScript(() => {
    window.__beacons = [];
    const readBody = async (body) => {
      try {
        if (typeof body === "string") return body;
        if (body instanceof Blob) return await body.text();
        return String(body);
      } catch (_) { return ""; }
    };
    const realSend = navigator.sendBeacon && navigator.sendBeacon.bind(navigator);
    if (realSend) {
      navigator.sendBeacon = function (url, body) {
        readBody(body).then((t) => window.__beacons.push({ via: "sendBeacon", url: String(url), body: t }));
        return realSend(url, body);
      };
    }
    const realFetch = window.fetch.bind(window);
    window.fetch = function (url, init) {
      try {
        if (String(url).includes("/api/beacon") && init && init.body) {
          readBody(init.body).then((t) => window.__beacons.push({ via: "fetch", url: String(url), body: t }));
        }
      } catch (_) {}
      return realFetch(url, init);
    };
  });
  await page.addInitScript(() => localStorage.setItem("jumvi_onboarded_v2", "1"));
  await page.addInitScript((name) => {
    localStorage.setItem("jumvi_profiles_v1", JSON.stringify([{ id: "p1", name, avatar: "1" }]));
    localStorage.setItem("jumvi_active_profile_v1", "p1");
    localStorage.setItem("jumvi_p1_cert_name_v1", name);
  }, CANARY);
  await page.goto(BASE, { waitUntil: "networkidle" }).catch(() => {});
  await page.waitForTimeout(1600);
  await dismissModals(page);
  for (const t of ["today", "browse", "modes", "profile"]) {
    await page.evaluate((x) => switchTab(x), t);
    await page.waitForTimeout(700);
  }
  await page.evaluate(() => switchTab("browse")); await page.waitForTimeout(600);
  await page.evaluate(() => [...document.querySelectorAll("[data-mission-id]")].find(e => e.getClientRects().length)?.click());
  await page.waitForTimeout(1200);
  await page.keyboard.press("Escape"); await page.waitForTimeout(800);
  const beacons = await page.evaluate(() => window.__beacons || []);
  await ctx.close();

  const bodies = beacons.map(b => { try { return JSON.parse(b.body); } catch (_) { return { __unparsed: b.body }; } });
  const keys = [...new Set(bodies.flatMap(b => Object.keys(b)))].sort();
  const values = bodies.flatMap(b => Object.values(b)).map(v => typeof v === "object" ? JSON.stringify(v) : String(v));
  const canaryInBody = bodies.some(b => JSON.stringify(b).includes(CANARY));
  const longValues = values.filter(v => v.length > 40);
  const events = [...new Set(bodies.map(b => b.e).filter(Boolean))];
  const ok = beacons.length > 0 && !canaryInBody && longValues.length === 0;
  record("R6.7", "analytics beacon carries event names and small values only, never a name",
    beacons.length === 0 ? "FAIL" : (ok ? "PASS" : "FAIL"),
    beacons.length === 0 ? "no beacon payload captured — NOT a pass, the check did not run"
      : `${beacons.length} payloads · top-level keys=[${keys.join(", ")}] · child name present=${canaryInBody}` +
        `\n         events seen: ${events.join(", ")}` +
        `\n         sample: ${JSON.stringify(bodies.slice(0, 3))}` +
        (longValues.length ? `\n         SUSPICIOUS free-text values: ${longValues.slice(0, 3).join(" | ")}` : " · no value longer than 40 chars"));
}

await browser.close();
const pass = results.filter(r => r.status === "PASS").length;
const fail = results.filter(r => r.status === "FAIL").length;
const info = results.filter(r => r.status === "INFO").length;
console.log(`\n${pass} pass, ${fail} fail, ${info} informational, of ${results.length} checks.`);
process.exit(fail > 0 ? 1 : 0);

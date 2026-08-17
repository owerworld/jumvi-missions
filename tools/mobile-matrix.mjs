#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
 * mobile-matrix.mjs — the phones American families actually scan the QR with.
 *
 * JUMVI's traffic is not a browser-share chart. It is a parent standing in a
 * driveway holding a paddle, opening Safari on an iPhone that is two or three
 * years old, in sunlight, on cellular. This walks the real flow on that class
 * of device and reports what would go wrong there: content wider than the
 * screen, taps smaller than a fingertip, text too small or too pale to read
 * outdoors, UI hidden behind the home indicator, console errors, dead assets.
 *
 * WebKit is not optional here. Chromium alone cannot answer the Safari
 * questions (100vh, -webkit- prefixes, AudioContext gestures), and Safari is
 * the majority engine for this product's buyers.
 *
 *   node tools/mobile-matrix.mjs                → both engines, all viewports
 *   node tools/mobile-matrix.mjs --engine=webkit
 *   node tools/mobile-matrix.mjs --shots=DIR    → also write screenshots
 *   node tools/mobile-matrix.mjs --base=URL     → default http://localhost:8910
 *
 * Exit code 1 if any P0 check fails (overflow, console error, dead asset),
 * so it can gate a deploy. Tap-target and contrast findings are reported but
 * do not fail the run — they need human judgement about what is decorative.
 * ═══════════════════════════════════════════════════════════════════════════ */
import { createRequire } from "node:module";
import fs from "node:fs";

const require_ = createRequire(import.meta.url);

/* Chromium and WebKit can come from different Playwright installs — a machine
 * often has one build with the Chromium revision already downloaded and a
 * newer one carrying WebKit. JUMVI_PW is the default for both; the per-engine
 * overrides exist so neither engine has to be skipped. */
const loadPw = (engine) => {
  const spec = process.env["JUMVI_PW_" + engine.toUpperCase()] || process.env.JUMVI_PW || "playwright";
  try {
    return require_(spec)[engine];
  } catch {
    console.error(`Playwright for ${engine} not found (tried "${spec}").`);
    console.error(`Set JUMVI_PW, or JUMVI_PW_${engine.toUpperCase()}, to a Playwright install that has it.`);
    process.exit(2);
  }
};
const EXE = (engine) => process.env["JUMVI_EXE_" + engine.toUpperCase()] || undefined;

const args = new Set(process.argv.slice(2));
const argVal = (name, dflt) => {
  const hit = [...args].find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : dflt;
};
const BASE = argVal("base", "http://localhost:8910");
const SHOTS = argVal("shots", "");
const ONLY_ENGINE = argVal("engine", "");

/* ── the device matrix ─────────────────────────────────────────────────────
 * Named for what the viewport represents in US traffic, not for a model we
 * are pretending to emulate — Playwright gives us the engine and the box, not
 * the actual hardware. */
const DEVICES = [
  { engine: "webkit",   label: "iPhone 12/13/14 class", w: 390, h: 844, dpr: 3 },
  { engine: "webkit",   label: "iPhone 11 / XR class",  w: 414, h: 896, dpr: 2 },
  { engine: "webkit",   label: "iPhone 15/16 class",    w: 393, h: 852, dpr: 3 },
  { engine: "webkit",   label: "iPhone Pro Max class",  w: 430, h: 932, dpr: 3 },
  { engine: "chromium", label: "Galaxy A mid-range",    w: 360, h: 780, dpr: 3 },
  { engine: "chromium", label: "Android common",        w: 384, h: 832, dpr: 2.75 },
  { engine: "chromium", label: "Galaxy S / large",      w: 412, h: 915, dpr: 2.625 },
  { engine: "chromium", label: "iPhone SE / smallest",  w: 375, h: 812, dpr: 2 },
];

/* ── in-page probes ────────────────────────────────────────────────────────
 * Everything below runs in the browser. Kept as one string per probe so the
 * intent stays readable next to what it measures. */

// Real contrast needs the composited backdrop, not the element's own
// (usually transparent) background — a translucent tint over a white card is
// not the color the eye receives. Walk up the tree compositing alpha.
const PROBE = () => {
  const px = (v) => parseFloat(v) || 0;
  const parse = (c) => {
    const m = String(c).match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(/[,\s/]+/).filter(Boolean).map(Number);
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };
  const over = (fg, bg) => ({
    r: fg.r * fg.a + bg.r * (1 - fg.a),
    g: fg.g * fg.a + bg.g * (1 - fg.a),
    b: fg.b * fg.a + bg.b * (1 - fg.a),
    a: 1,
  });
  // Gradients are where the primary CTAs live, and a gradient is not one
  // color — the text has to stay legible against its LIGHTEST stop as much as
  // its darkest. Pull every rgb() stop out of the computed background-image so
  // the worst point on the button is the one that gets judged. Without this a
  // gradient button reads as "transparent" and the whole check is fiction.
  const gradientStops = (cs) => {
    const bi = cs.backgroundImage;
    if (!bi || bi === "none") return [];
    return [...bi.matchAll(/rgba?\([^)]+\)/g)].map((m) => parse(m[0])).filter((c) => c && c.a > 0.5);
  };
  // Returns every plausible backdrop for the element: usually one, but a
  // gradient contributes one per stop so callers can take the worst case.
  const backdrops = (el) => {
    const stack = [];
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) stack.push(n);
    let base = parse(getComputedStyle(document.documentElement).backgroundColor) || { r: 255, g: 255, b: 255, a: 1 };
    if (base.a < 1) base = { r: 255, g: 255, b: 255, a: 1 };
    let outs = [base];
    for (let i = stack.length - 1; i >= 0; i--) {
      const cs = getComputedStyle(stack[i]);
      const stops = gradientStops(cs);
      const solid = parse(cs.backgroundColor);
      if (stops.length) {
        // A gradient paints over whatever is beneath it, so it replaces the
        // accumulated backdrop rather than blending with it.
        outs = stops.map((s) => (s.a < 1 ? over(s, outs[0]) : s));
      } else if (solid && solid.a > 0) {
        outs = outs.map((o) => over(solid, o));
      }
    }
    return outs;
  };
  const lum = (c) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  };
  const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); };

  const visible = (el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return r.width > 1 && r.height > 1 && cs.visibility !== "hidden" && cs.display !== "none" && px(cs.opacity) > 0.05;
  };

  const out = { overflow: null, taps: [], contrast: [], tiny: [], safeArea: [] };

  // 1 — horizontal overflow. The single most damaging mobile failure: it
  // makes the whole page slide sideways under the thumb.
  const de = document.documentElement;
  if (de.scrollWidth > de.clientWidth + 1) {
    const culprits = [];
    document.querySelectorAll("*").forEach((el) => {
      if (!visible(el)) return;
      const r = el.getBoundingClientRect();
      if (r.right > de.clientWidth + 1 || r.left < -1) {
        culprits.push(`${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""}${el.className && typeof el.className === "string" ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".") : ""} → ${Math.round(r.left)}…${Math.round(r.right)}`);
      }
    });
    out.overflow = { scrollWidth: de.scrollWidth, clientWidth: de.clientWidth, culprits: culprits.slice(0, 8) };
  }

  // 2 — tap targets. 44px is the floor for a hand that is also holding a
  // paddle. Measured on the real hit box, not the icon inside it — and a
  // ::before/::after that extends past the element IS part of that hit box,
  // which is the standard way to grow a target without resizing the artwork.
  const hitBox = (el) => {
    const r = el.getBoundingClientRect();
    let w = r.width, h = r.height;
    for (const pseudo of ["::before", "::after"]) {
      const cs = getComputedStyle(el, pseudo);
      if (!cs || cs.content === "none" || cs.pointerEvents === "none") continue;
      const pw = px(cs.width) || 0, ph = px(cs.height) || 0;
      const mw = px(cs.minWidth) || 0, mh = px(cs.minHeight) || 0;
      w = Math.max(w, pw, mw);
      h = Math.max(h, ph, mh);
    }
    return { w, h };
  };
  document.querySelectorAll('button,a[href],[role="button"],input,select,summary').forEach((el) => {
    if (!visible(el)) return;
    const r = hitBox(el);
    const w = Math.round(r.width), h = Math.round(r.height);
    if (w < 44 || h < 44) {
      const label = (el.innerText || el.getAttribute("aria-label") || el.getAttribute("title") || "").trim().replace(/\s+/g, " ").slice(0, 34);
      out.taps.push({ sel: `${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""}${typeof el.className === "string" && el.className.trim() ? "." + el.className.trim().split(/\s+/)[0] : ""}`, w, h, label });
    }
  });

  // 3 — outdoor readability. Sunlight is the real test; 4.5:1 for body text
  // and 3:1 for large text is the standard that survives it.
  document.querySelectorAll("*").forEach((el) => {
    if (!visible(el)) return;
    const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join(" ").trim();
    if (!own || own.length > 200) return;
    const cs = getComputedStyle(el);
    const fg = parse(cs.color);
    if (!fg) return;
    const size = px(cs.fontSize);
    const weight = Number(cs.fontWeight) || 400;
    const large = size >= 24 || (size >= 18.66 && weight >= 700);
    /* CSS `opacity` on an ancestor fades the text toward whatever is behind
     * it, and getComputedStyle().color knows nothing about that. Skipping it
     * makes a de-emphasised control look compliant on paper while being close
     * to invisible on a phone in sunlight — so fold the whole opacity chain
     * into the foreground's alpha before compositing. */
    let opacity = 1;
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) opacity *= px(getComputedStyle(n).opacity) || 1;
    const effFg = { ...fg, a: fg.a * opacity };

    // Worst backdrop wins: a gradient button is only as readable as its
    // weakest point, and that is the point a parent squints at in sunlight.
    let cr = Infinity;
    for (const bg of backdrops(el)) {
      const composited = effFg.a < 1 ? over(effFg, bg) : effFg;
      cr = Math.min(cr, ratio(composited, bg));
    }
    const need = large ? 3 : 4.5;
    if (cr < need) {
      out.contrast.push({ text: own.slice(0, 40), ratio: Number(cr.toFixed(2)), need, size: Math.round(size), weight,
        sel: `${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""}${typeof el.className === "string" && el.className.trim() ? "." + el.className.trim().split(/\s+/)[0] : ""}` });
    }
    // 4 — type that is too small to read at arm's length outdoors.
    if (size < 12 && own.length > 3) {
      out.tiny.push({ text: own.slice(0, 34), size: Number(size.toFixed(1)),
        sel: `${el.tagName.toLowerCase()}${typeof el.className === "string" && el.className.trim() ? "." + el.className.trim().split(/\s+/)[0] : ""}` });
    }
  });

  /* 5 — safe area. Playwright resolves env(safe-area-inset-*) to 0, so the
   * emulator CANNOT tell us whether the bottom nav clears an iPhone's home
   * indicator: measuring geometry here would flag every notched viewport
   * forever and mean nothing. What IS checkable is whether the fixed bottom
   * chrome asks for the inset at all — a rule that never mentions env() can
   * never be safe, and one that does can only be confirmed on real hardware.
   * So this reports the DECLARATION, and the report says so. */
  const bottomChrome = document.querySelector(".bottomNav");
  if (bottomChrome) {
    const pb = getComputedStyle(bottomChrome).paddingBottom;
    // env() has already been resolved to 0px by the time it reaches computed
    // style, so read the authored rules instead.
    let declaresEnv = false;
    for (const sheet of document.styleSheets) {
      let rules; try { rules = sheet.cssRules; } catch (_) { continue; }
      if (!rules) continue;
      for (const rule of rules) {
        if (rule.cssText && /bottomNav/.test(rule.cssText) && /safe-area-inset-bottom/.test(rule.cssText)) { declaresEnv = true; break; }
      }
      if (declaresEnv) break;
    }
    if (!declaresEnv) out.safeArea.push({ sel: ".bottomNav", note: "no safe-area-inset-bottom in any rule", paddingBottom: pb });
  }

  return out;
};

/* ── the flow a family actually walks ──────────────────────────────────── */
async function walk(page, note) {
  const steps = [];
  const step = async (name, fn) => {
    try { await fn(); } catch (e) { steps.push(`${name}: ERROR ${String(e.message).slice(0, 80)}`); return false; }
    steps.push(`${name}: ok`);
    return true;
  };

  // Landing: the welcome overlay is the first thing a fresh QR scan sees.
  await page.waitForTimeout(1400);
  const hasWelcome = await page.evaluate(() => {
    const o = document.getElementById("welcomeOverlay") || document.querySelector(".welcomeOverlay");
    return !!(o && getComputedStyle(o).display !== "none");
  });
  note.welcome = hasWelcome;

  if (hasWelcome) {
    await step("pick level", async () => {
      await page.evaluate(() => { const b = document.querySelectorAll(".ageBtn")[1]; b && b.click(); });
      await page.waitForTimeout(250);
    });
    await step("start first mission", async () => {
      await page.evaluate(() => { const b = document.getElementById("btnWelcomeStart"); b && b.click(); });
      await page.waitForTimeout(900);
    });
  } else {
    await step("open a mission", async () => {
      await page.evaluate(() => { if (window.openMission) window.openMission(1); });
      await page.waitForTimeout(900);
    });
  }

  note.missionOpen = await page.evaluate(() => {
    const m = document.getElementById("sheet");
    if (!m) return false;
    const cs = getComputedStyle(m);
    return cs.display !== "none" && parseFloat(cs.opacity) > 0.5 && m.getBoundingClientRect().height > 100;
  });

  return steps;
}

/* ── driver ────────────────────────────────────────────────────────────── */
const results = [];
let hardFail = false;

/* Sunlight is only half the readability story — the other half is the parent
 * who has their phone on dark mode all day. Both schemes get walked. */
const SCHEMES = argVal("scheme", "both") === "both" ? ["light", "dark"] : [argVal("scheme", "both")];

for (const dev of DEVICES) {
  if (ONLY_ENGINE && dev.engine !== ONLY_ENGINE) continue;
  for (const scheme of SCHEMES) {
  const engine = loadPw(dev.engine);
  const browser = await engine.launch({ executablePath: EXE(dev.engine) });
  const ctx = await browser.newContext({
    viewport: { width: dev.w, height: dev.h },
    deviceScaleFactor: dev.dpr,
    isMobile: true,
    hasTouch: true,
    colorScheme: scheme,
  });
  const page = await ctx.newPage();

  /* /api/beacon is served by the Cloudflare Worker in production (verified:
   * POST → 204). A static local mirror answers 501 to any POST, which would
   * drown every run in an error that does not exist for a real user. Answer it
   * the way production does so the report is about the app, not the harness. */
  await page.route("**/api/beacon", (route) => route.fulfill({ status: 204, body: "" }));

  /* JUMVI's theme is a stored preference that DEFAULTS TO LIGHT — it does not
   * follow the OS unless the family picks "System". So emulating a dark OS
   * proves nothing: the app stays light and a dark-theme audit silently tests
   * the light theme instead. Write the preference the same way the Profile
   * screen does, before any app code runs. */
  await ctx.addInitScript((s) => {
    try { localStorage.setItem("jumvi_theme_v1", s); } catch (_) {}
  }, scheme);

  /* Two lines of noise belong to the harness, not to JUMVI, and both were
   * checked against production before being filtered:
   *   • /api/beacon — the Cloudflare Worker answers POST with 204 in prod
   *     (verified); a static mirror answers 501. WebKit routes sendBeacon
   *     around page.route(), so it is filtered here rather than stubbed.
   *   • interactive-widget — a progressive-enhancement viewport key Chrome
   *     understands and WebKit ignores by design. Ignoring it IS the
   *     fallback; there is nothing to fix.
   * Anything else that reaches these arrays is a real finding. */
  const BENIGN = [/\/api\/beacon/, /interactive-widget/, /Unsupported method \('POST'\)/];
  const benign = (s) => BENIGN.some((re) => re.test(s));
  let teardown = false;
  const consoleErrors = [];
  const failedRequests = [];
  /* Chromium fires requestfailed(ERR_ABORTED) for a HEAD request that already
   * returned a perfectly good response — there is no body to read, so the
   * request is torn down and reported as aborted. Counting that as a dead
   * asset is wrong: the app got its 200 and acted on it. Remember which URLs
   * answered successfully and let their aborts go. */
  const answeredOk = new Set();
  page.on("pageerror", (e) => { const m = String(e.message).slice(0, 120); if (!benign(m)) consoleErrors.push(m); });
  page.on("console", (m) => { const t = m.text().slice(0, 120); if (m.type() === "error" && !benign(t)) consoleErrors.push(t); });
  page.on("requestfailed", (r) => {
    // Requests still in flight when the walk ends are cancelled by teardown,
    // not by the app. Only count aborts that happen while we are still driving.
    if (teardown || answeredOk.has(r.url())) return;
    const t = `${r.url().split("/").slice(-1)[0]} ${r.failure()?.errorText || ""}`;
    if (!benign(r.url())) failedRequests.push(t);
  });
  page.on("response", (r) => {
    const u = new URL(r.url());
    if (r.status() >= 400 && !benign(u.pathname)) failedRequests.push(`${u.pathname} → HTTP ${r.status()}`);
    else if (r.status() < 400) answeredOk.add(r.url());
    // An image URL answering with HTML is the classic silent-broken-asset bug.
    const ct = (r.headers()["content-type"] || "").toLowerCase();
    if (/\.(webp|png|jpg|jpeg|svg|avif)$/i.test(u.pathname) && ct.includes("text/html")) {
      failedRequests.push(`${u.pathname} → served as text/html, not an image`);
    }
  });

  const note = {};
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
  const flow = await walk(page, note);

  const home = await page.evaluate(PROBE);
  if (SHOTS) {
    fs.mkdirSync(SHOTS, { recursive: true });
    await page.screenshot({ path: `${SHOTS}/${dev.engine}-${dev.w}x${dev.h}-${scheme}-mission.png` });
  }

  // Back to home, then sweep each tab so the audit is not just one screen.
  await page.evaluate(() => { const x = document.getElementById("btnClose"); x && x.click(); });
  await page.waitForTimeout(500);
  const perTab = {};
  for (const tab of ["today", "browse", "modes", "stats", "profile"]) {
    await page.evaluate((t) => { const b = document.querySelector(`.navTab[data-tab="${t}"]`); b && b.click(); }, tab);
    await page.waitForTimeout(600);
    perTab[tab] = await page.evaluate(PROBE);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/${dev.engine}-${dev.w}x${dev.h}-${scheme}-${tab}.png` });
  }

  /* The tab sweep ends on Profile, which is where the optional-download HEAD
   * probe fires. Resizing straight afterwards cancels it mid-flight and the
   * abort looks like a dead asset — let it settle first so a real failure here
   * would still be a real finding. */
  await page.waitForTimeout(600);

  // Landscape must not be catastrophic, even though portrait is the product.
  await page.setViewportSize({ width: dev.h, height: dev.w });
  await page.waitForTimeout(600);
  const landscape = await page.evaluate(PROBE);
  await page.setViewportSize({ width: dev.w, height: dev.h });

  teardown = true;
  const overflowTabs = Object.entries(perTab).filter(([, v]) => v.overflow).map(([k]) => k);
  if (home.overflow) overflowTabs.unshift("mission");
  const uniqTaps = new Map();
  [home, ...Object.values(perTab)].forEach((r) => r.taps.forEach((t) => uniqTaps.set(t.sel + t.label, t)));
  const uniqContrast = new Map();
  [home, ...Object.values(perTab)].forEach((r) => r.contrast.forEach((c) => uniqContrast.set(c.sel + c.text, c)));
  const uniqTiny = new Map();
  [home, ...Object.values(perTab)].forEach((r) => r.tiny.forEach((t) => uniqTiny.set(t.sel + t.text, t)));
  const uniqSafe = new Map();
  [home, ...Object.values(perTab)].forEach((r) => r.safeArea.forEach((s) => uniqSafe.set(s.sel, s)));

  const rec = {
    dev, scheme, flow, note,
    overflowTabs,
    overflowDetail: home.overflow || Object.values(perTab).find((v) => v.overflow) || null,
    landscapeOverflow: !!landscape.overflow,
    taps: [...uniqTaps.values()],
    contrast: [...uniqContrast.values()].sort((a, b) => a.ratio - b.ratio),
    tiny: [...uniqTiny.values()],
    safeArea: [...uniqSafe.values()],
    consoleErrors: [...new Set(consoleErrors)],
    failedRequests: [...new Set(failedRequests)],
  };
  if (rec.overflowTabs.length || rec.consoleErrors.length || rec.failedRequests.length) hardFail = true;
  results.push(rec);

  await browser.close();
  }
}

/* ── report ────────────────────────────────────────────────────────────── */
console.log("JUMVI mobile matrix — " + BASE + "\n");
for (const r of results) {
  const d = r.dev;
  const verdict = r.overflowTabs.length || r.consoleErrors.length || r.failedRequests.length ? "FAIL"
    : r.taps.length || r.contrast.length ? "PASS WITH LIMITATION" : "PASS";
  console.log(`── ${d.engine.padEnd(8)} ${String(d.w) + "×" + d.h} · ${d.label} · ${r.scheme}  →  ${verdict}`);
  console.log(`   flow: ${r.flow.join(" · ")}${r.note.missionOpen ? " · mission rendered" : " · MISSION DID NOT RENDER"}`);
  if (r.overflowTabs.length) {
    console.log(`   ✗ horizontal overflow on: ${r.overflowTabs.join(", ")}`);
    (r.overflowDetail?.culprits || []).forEach((c) => console.log(`       ${c}`));
  }
  if (r.landscapeOverflow) console.log("   ! landscape overflows horizontally");
  if (r.taps.length) {
    console.log(`   ! ${r.taps.length} tap target(s) under 44px:`);
    r.taps.slice(0, 6).forEach((t) => console.log(`       ${t.w}×${t.h}  ${t.sel}  "${t.label}"`));
    if (r.taps.length > 6) console.log(`       … ${r.taps.length - 6} more`);
  }
  if (r.contrast.length) {
    console.log(`   ! ${r.contrast.length} contrast failure(s):`);
    r.contrast.slice(0, 6).forEach((c) => console.log(`       ${c.ratio}:1 (needs ${c.need}) ${c.size}px  ${c.sel}  "${c.text}"`));
    if (r.contrast.length > 6) console.log(`       … ${r.contrast.length - 6} more`);
  }
  if (r.tiny.length) {
    console.log(`   ! ${r.tiny.length} text node(s) under 12px:`);
    r.tiny.slice(0, 5).forEach((t) => console.log(`       ${t.size}px  ${t.sel}  "${t.text}"`));
    if (r.tiny.length > 5) console.log(`       … ${r.tiny.length - 5} more`);
  }
  if (r.safeArea.length) {
    console.log("   ! bottom chrome does not reference safe-area-inset-bottom:");
    r.safeArea.slice(0, 4).forEach((s) => console.log(`       ${s.sel} — ${s.note} (padding-bottom ${s.paddingBottom})`));
  }
  if (r.consoleErrors.length) { console.log("   ✗ console errors:"); r.consoleErrors.slice(0, 5).forEach((e) => console.log("       " + e)); }
  if (r.failedRequests.length) { console.log("   ✗ failed/bad requests:"); r.failedRequests.slice(0, 8).forEach((e) => console.log("       " + e)); }
  console.log("");
}

const fails = results.filter((r) => r.overflowTabs.length || r.consoleErrors.length || r.failedRequests.length).length;
console.log(fails ? `${fails}/${results.length} device class(es) have a P0 failure.` : `All ${results.length} device classes clear of P0 failures.`);
process.exit(hardFail ? 1 : 0);

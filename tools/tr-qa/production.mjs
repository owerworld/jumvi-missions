/* Production-readiness sweep for the /tr route.
 *
 * Covers the scenarios a family actually hits — both language orders, offline
 * in each, a hard refresh, and the service worker generation change — plus the
 * one risk the architecture introduces: /tr injects <base href="/">, so a
 * relative link or an in-app navigation could silently drop the child back
 * onto the English route. */
/* Playwright is not a repo dependency (this project ships no package.json),
 * so resolve it with a clear message instead of a bare MODULE_NOT_FOUND. */
let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch (_) {
  console.error(
    "playwright bulunamadı. Repo kökünde bir kez kurun:\n" +
    "  npm install playwright\n" +
    "Tarayıcı zaten kuruluysa CHROMIUM_PATH ile gösterin."
  );
  process.exit(2);
}

const BASE = process.env.BASE || "http://localhost:8787";
let pass = 0, fail = 0;
const ok = (l, c, d = "") => { c ? (pass++, console.log(`  ok   ${l}`)) : (fail++, console.log(`  FAIL ${l}${d ? "\n         " + d : ""}`)); };
const head = (t) => console.log(`\n${t}`);

const RETURNING = `
try {
  localStorage.setItem("jumvi_onboarded_v2","1");
  localStorage.setItem("jumvi_tour_done","1");
  localStorage.setItem("jumvi_tutorial_done_v1","1");
} catch (e) {}
`;

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });

/* ── Routes ───────────────────────────────────────────────────────────────── */
head("Rotalar");
{
  const ctx = await browser.newContext();
  for (const [path, want] of [["/", "en"], ["/tr", "tr"], ["/tr/", "tr"], ["/tr/index.html", "tr"], ["/tr?hub3d=1", "tr"]]) {
    const p = await ctx.newPage();
    const res = await p.goto(BASE + path, { waitUntil: "networkidle" });
    await p.waitForTimeout(400);
    const lang = await p.getAttribute("html", "lang");
    ok(`${path.padEnd(18)} → ${res.status()} lang=${lang}`, res.status() === 200 && lang === want);
    await p.close();
  }
  await ctx.close();
}

/* ── <base href="/"> — nothing may leak back to the English route ─────────── */
head('<base href="/"> — /tr İngilizceye düşmüyor');
{
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  await p.addInitScript(RETURNING);
  await p.goto(BASE + "/tr", { waitUntil: "networkidle" });
  await p.waitForTimeout(600);

  ok("<base> enjekte edildi", await p.getAttribute("base", "href") === "/");

  // Relative sub-resources must resolve from the root, not from /tr/.
  const bad = await p.evaluate(() =>
    [...document.querySelectorAll("script[src], link[href], img[src]")]
      .map((el) => el.src || el.href)
      .filter((u) => u && u.includes("/tr/") && !/\/tr\/(i18n\.js|manifest\.json)/.test(u)));
  ok("hiçbir alt kaynak /tr/ altına çözülmüyor", bad.length === 0, JSON.stringify(bad));

  // Every in-page anchor must either stay on /tr, be external, or be a real
  // English-side document (there are none today).
  const anchors = await p.evaluate(() =>
    [...document.querySelectorAll("a[href]")]
      .map((a) => ({ href: a.getAttribute("href"), resolved: a.href }))
      .filter((a) => !/^(mailto:|tel:|https?:\/\/(?!localhost))/.test(a.href)));
  const leaks = anchors.filter((a) => {
    const u = new URL(a.resolved);
    return u.pathname === "/" || u.pathname === "/index.html";
  });
  ok("hiçbir bağlantı / İngilizce köküne gitmiyor", leaks.length === 0, JSON.stringify(leaks));
  console.log(`       incelenen bağlantı: ${anchors.length}`);

  // In-app tab navigation must not change the path.
  for (const tab of ["today", "browse", "stats", "profile"]) {
    await p.evaluate((t) => document.querySelectorAll(`[data-tab="${t}"]`).forEach((b) => { try { b.click(); } catch (e) {} }), tab);
    await p.waitForTimeout(200);
  }
  await p.evaluate(() => { try { openMission(missions.find((m) => m.id === 2)); } catch (_) {} });
  await p.waitForTimeout(400);
  const after = new URL(p.url());
  ok("sekme gezinmesi sonrası hâlâ /tr", after.pathname === "/tr", p.url());
  ok("gezinme sonrası dil hâlâ tr", await p.getAttribute("html", "lang") === "tr");
  await ctx.close();
}

/* ── Hard refresh ─────────────────────────────────────────────────────────── */
head("Hard refresh");
{
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  await p.goto(BASE + "/tr", { waitUntil: "networkidle" });
  await p.waitForTimeout(800);
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForTimeout(600);
  ok("/tr yeniden yüklemeden sonra Türkçe", await p.getAttribute("html", "lang") === "tr");
  ok("başlık Türkçe kaldı", (await p.title()).includes("JUMVI Görevleri"));
  await ctx.close();
}

/* ── Service worker generation change (v182 → v183 here) ─────────────────────────────────────── */
head("Service worker kuşak değişimi (eski cache temizliği)");
{
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  await p.goto(BASE + "/", { waitUntil: "networkidle" });
  // Plant a previous-generation cache the way a returning visitor would have.
  await p.evaluate(async () => {
    const c = await caches.open("jumvi-missions-v181");
    await c.put("/index.html", new Response("<html lang='en'>stale</html>", { headers: { "content-type": "text/html" } }));
  });
  // activate only fires when a new worker takes over; a plain reload reuses
  // the already-activated one and would leave the planted cache untouched for
  // reasons that have nothing to do with the cleanup logic.
  await p.evaluate(async () => {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map((r) => r.unregister()));
  });
  await p.reload({ waitUntil: "networkidle" });
  await p.evaluate(() => navigator.serviceWorker.ready);
  await p.waitForTimeout(2000);
  const names = await p.evaluate(() => caches.keys());
  ok("v182 cache açıldı", names.includes("jumvi-missions-v183"), JSON.stringify(names));
  ok("v181 cache silindi (activate temizliği)", !names.includes("jumvi-missions-v181"), JSON.stringify(names));
  await ctx.close();
}

/* ── Both language orders, then offline ───────────────────────────────────── */
for (const order of [["/", "/tr"], ["/tr", "/"]]) {
  head(`Sıra: ${order[0]} → ${order[1]} → offline`);
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  for (const path of order) {
    await p.goto(BASE + path, { waitUntil: "networkidle" });
    await p.evaluate(() => navigator.serviceWorker.ready);
    await p.waitForTimeout(1400);
  }
  const bodies = await p.evaluate(async () => {
    const c = await caches.open("jumvi-missions-v183");
    const read = async (k) => {
      const r = await c.match(k);
      if (!r) return null;
      return ((await r.text()).match(/<html[^>]*lang=["']([a-z-]+)["']/i) || [, "?"])[1];
    };
    return { en: await read("/index.html"), tr: await read("/tr/index.html") };
  });
  ok("cache'te / İngilizce", bodies.en === "en", `lang=${bodies.en}`);
  ok("cache'te /tr Türkçe", bodies.tr === "tr", `lang=${bodies.tr}`);

  await ctx.setOffline(true);
  for (const [path, want] of [["/", "en"], ["/tr", "tr"]]) {
    await p.goto(BASE + path, { waitUntil: "domcontentloaded" }).catch(() => {});
    await p.waitForTimeout(700);
    ok(`offline ${path} → ${want}`, (await p.getAttribute("html", "lang")) === want);
  }
  await ctx.setOffline(false);
  await ctx.close();
}

/* ── Progress shared across languages ─────────────────────────────────────── */
head("İlerleme iki dilde ortak");
{
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  await p.addInitScript(RETURNING);
  await p.goto(BASE + "/tr", { waitUntil: "networkidle" });
  await p.waitForTimeout(600);
  await p.evaluate(() => { try { markMissionDone(5, "manual"); } catch (_) {} });
  // persist() writes through lsSetDebounced(..., 500) — read before that and
  // the key is legitimately still empty.
  await p.waitForTimeout(1200);
  const trDone = await p.evaluate(() => lsGet(LS_KEY));

  await p.goto(BASE + "/", { waitUntil: "networkidle" });
  await p.waitForTimeout(600);
  const enDone = await p.evaluate(() => lsGet(LS_KEY));
  ok("Türkçede tamamlanan görev İngilizcede de görünüyor", !!trDone && trDone === enDone, `tr=${trDone} en=${enDone}`);
  ok("görev 5 kayıtlı", (JSON.parse(enDone || "[]") || []).includes(5), String(enDone));
  await ctx.close();
}

/* ── Features ─────────────────────────────────────────────────────────────── */
head("Özellikler (/tr)");
{
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  await p.addInitScript(RETURNING + `
    window.__spoken=[];
    const voices=[{lang:"tr-TR",name:"TR"}];
    Object.defineProperty(SpeechSynthesisUtterance.prototype,"voice",{configurable:true,get(){return this.__v||null;},set(v){this.__v=v;}});
    Object.defineProperty(window,"speechSynthesis",{configurable:true,value:{
      getVoices:()=>voices,cancel(){},addEventListener(){},
      speak(u){window.__spoken.push({text:String(u.text),lang:u.lang});}}});
  `);
  const errors = [];
  p.on("pageerror", (e) => errors.push(String(e)));
  await p.goto(BASE + "/tr", { waitUntil: "networkidle" });
  await p.waitForTimeout(700);

  // Coach Leo tour
  const tour = await p.evaluate(() => {
    try { window.JumviLeoTour && window.JumviLeoTour.start && window.JumviLeoTour.start(); } catch (_) {}
    return document.body.textContent.replace(/\s+/g, " ");
  });
  await p.waitForTimeout(400);
  ok("Coach Leo turu İngilizce metin göstermiyor",
     !/Hi! I'm Coach Leo|Ready for a quick tour|These are your missions/.test(tour));

  // TTS via the real read-aloud path
  const spoken = await p.evaluate(() => {
    window.__spoken.length = 0;
    try { soundOn = true; toggleLeoSpeakSteps(missions.find((m) => m.id === 2)); } catch (_) {}
    return window.__spoken;
  });
  ok("sesli okuma tr-TR", spoken.length > 0 && spoken.every((s) => s.lang === "tr-TR"), JSON.stringify(spoken.slice(0, 1)));
  ok("sesli okuma metni Türkçe", spoken.length > 0 && spoken.every((s) => !/^Step |How to win/.test(s.text)),
     JSON.stringify(spoken.map((s) => s.text).slice(0, 2)));

  // Red Light / Green Light
  const caller = await p.evaluate(() => {
    window.__spoken.length = 0;
    for (const t of ["Green light!", "Red light! Freeze!", "Time is up! Great freezing!"]) {
      const u = new SpeechSynthesisUtterance(t); u.lang = "en-US";
      window.speechSynthesis.speak(u);
    }
    return window.__spoken.map((s) => s.text);
  });
  ok("RLGL caller Türkçe", caller.length === 3 && caller.every((t) => !/light|Freeze|Time is up/i.test(t)), JSON.stringify(caller));

  // Certificate — meta line drawn onto the canvas
  const cert = await p.evaluate(() => new Promise((r) => {
    const probe = "Awarded 2026-08-13  ·  ID: AB12";
    const d = document.createElement("div");
    d.textContent = probe;
    document.body.appendChild(d);
    // The canvas draw path and the DOM path share translateCore; measuring the
    // canvas by swapping fillText would overwrite the locale layer's own patch,
    // so compare widths there and read the text here.
    const c = document.createElement("canvas").getContext("2d");
    const sameWidth = c.measureText(probe).width === c.measureText("Veriliş: 2026-08-13 · Kimlik: AB12").width;
    setTimeout(() => { const out = d.textContent; d.remove(); r({ out, sameWidth }); }, 300);
  }));
  ok("sertifika tarih/kimlik satırı Türkçe (DOM)", /Veriliş:|Kimlik:/.test(cert.out || ""), JSON.stringify(cert));
  ok("aynı satır canvas'ta da çevriliyor", cert.sameWidth === true, JSON.stringify(cert));

  // Turkish asset routing is wired and inert while the files are absent
  const assets = await p.evaluate(() => ({
    certSources: typeof CERT_TEMPLATE_SOURCES !== "undefined" ? CERT_TEMPLATE_SOURCES.slice() : null,
    bookHrefs: [...document.querySelectorAll('a[href$="mission-book.pdf"]')].map((a) => a.getAttribute("href")),
  }));
  ok("Türkçe sertifika şablonu ilk sırada", assets.certSources && assets.certSources[0] === "/tr/certificate-template.webp",
     JSON.stringify(assets.certSources));
  ok("İngilizce şablon yedek olarak duruyor", assets.certSources && assets.certSources.includes("certificate-template.webp"));
  ok("Türkçe PDF yokken kitap linki İngilizcede kalıyor",
     assets.bookHrefs.every((h) => h === "mission-book.pdf"), JSON.stringify(assets.bookHrefs));

  // Privacy modal
  const privacy = await p.evaluate(() => {
    const el = [...document.querySelectorAll("div")].find((e) => /Anonim oyun analitiği/.test(e.textContent));
    return el ? el.textContent.replace(/\s+/g, " ") : "";
  });
  ok("gizlilik metni Türkçe", /kısa ve sabit bir anonim olay listesi/.test(privacy));
  ok("gizlilik metni artık 'beş olay' demiyor", !/beş basit|five simple/.test(privacy));
  ok("gizlilik metni sertifika/profil adını da sayıyor",
     /sertifika adı/.test(privacy) && /profil adı/.test(privacy));

  // 3D Hub opt-in
  await p.goto(BASE + "/tr?hub3d=1", { waitUntil: "networkidle" });
  await p.waitForTimeout(700);
  ok("hub3d=1 bayrağı açıldı", await p.evaluate(() => localStorage.getItem("jumvi_3d_hub_enabled")) === "1");
  ok("hub canvas metni locale katmanına bağlı",
     await p.evaluate(() => !!CanvasRenderingContext2D.prototype.__jumviTrPatched));

  ok("hiç sayfa hatası yok", errors.length === 0, errors.slice(0, 2).join(" | "));
  await ctx.close();
}

/* ── Install metadata ─────────────────────────────────────────────────────── */
head("Manifest / install metadata");
{
  const en = await (await fetch(`${BASE}/manifest.json`)).json();
  const tr = await (await fetch(`${BASE}/tr/manifest.json`)).json();
  ok("/tr → start_url /tr", tr.start_url === "/tr", tr.start_url);
  ok("/tr → ad Türkçe", tr.name === "JUMVI Görevleri", tr.name);
  ok("/ → start_url / (dokunulmadı)", en.start_url === "/");
  ok("/ → ad İngilizce (dokunulmadı)", en.name === "JUMVI Missions");
  ok("ikonlar aynı sette", tr.icons.length === en.icons.length);

  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  await p.goto(BASE + "/tr", { waitUntil: "networkidle" });
  ok("/tr sayfası Türkçe manifest'e bağlanıyor",
     await p.getAttribute('link[rel=manifest]', "href") === "/tr/manifest.json");
  await p.goto(BASE + "/", { waitUntil: "networkidle" });
  ok("/ sayfası İngilizce manifest'e bağlı kaldı",
     await p.getAttribute('link[rel=manifest]', "href") === "manifest.json");
  await ctx.close();
}

await browser.close();
console.log(`\n${fail === 0 ? "✅" : "❌"} ${pass} geçti, ${fail} kaldı`);
process.exit(fail === 0 ? 0 : 1);

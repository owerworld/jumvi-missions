/* Registers the real service-worker.js in Chromium and proves the thing the
 * brief asked for: visiting /tr must not turn the offline / shell Turkish,
 * and vice versa. Runs the sequence a real family would: English online,
 * Turkish online, then both offline. */
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

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const ctx = await browser.newContext();
const page = await ctx.newPage();

const swReady = () => page.evaluate(() => navigator.serviceWorker.ready.then(r => !!r.active));

// 1. English first visit, online.
await page.goto(BASE + "/", { waitUntil: "networkidle" });
await swReady();
await page.waitForTimeout(1500); // let precache + runtime caching settle
ok("service worker aktif", await swReady());

// 2. Turkish visit, online — this is the step that used to poison / .
await page.goto(BASE + "/tr", { waitUntil: "networkidle" });
await page.waitForTimeout(1200);
ok("/tr online Türkçe", (await page.getAttribute("html", "lang")) === "tr");

// 3. Both navigation shells must now be cached under separate keys.
const keys = await page.evaluate(async () => {
  const names = await caches.keys();
  const out = {};
  for (const n of names) {
    const c = await caches.open(n);
    out[n] = (await c.keys()).map(r => new URL(r.url).pathname).filter(p => p.endsWith("index.html") || p === "/");
  }
  return out;
});
const cacheName = Object.keys(keys).find(n => n.startsWith("jumvi-missions-"));
const shells = keys[cacheName] || [];
console.log(`       cache=${cacheName} shells=${JSON.stringify(shells)}`);
ok("İngilizce kabuk /index.html olarak duruyor", shells.includes("/index.html"));
ok("Türkçe kabuk AYRI anahtarda (/tr/index.html)", shells.includes("/tr/index.html"));

/* The decisive check. Presence of two keys is not enough — what matters is
 * that the body stored under /index.html is still the ENGLISH shell after a
 * /tr visit. Reading the cache directly sidesteps Chromium's own HTTP cache,
 * which can serve an offline navigation without ever consulting the SW and
 * make a poisoned cache look fine. */
const bodies = await page.evaluate(async (name) => {
  const c = await caches.open(name);
  const read = async (k) => {
    const r = await c.match(k);
    if (!r) return null;
    const t = await r.text();
    return (t.match(/<html[^>]*lang=["']([a-z-]+)["']/i) || [, "?"])[1];
  };
  return { en: await read("/index.html"), tr: await read("/tr/index.html") };
}, cacheName);
console.log(`       cache içeriği: /index.html=${bodies.en}  /tr/index.html=${bodies.tr}`);
ok("cache'teki /index.html gövdesi İNGİLİZCE kaldı", bodies.en === "en", `lang=${bodies.en}`);
ok("cache'teki /tr/index.html gövdesi Türkçe", bodies.tr === "tr", `lang=${bodies.tr}`);

// 4. Offline: each route must serve its own language.
await ctx.setOffline(true);

await page.goto(BASE + "/tr", { waitUntil: "domcontentloaded" }).catch(() => {});
await page.waitForTimeout(800);
const trOffline = await page.getAttribute("html", "lang");
const trTitle = await page.title();
ok("çevrimdışı /tr hâlâ Türkçe", trOffline === "tr", `lang=${trOffline} title=${trTitle}`);

await page.goto(BASE + "/", { waitUntil: "domcontentloaded" }).catch(() => {});
await page.waitForTimeout(800);
const enOffline = await page.getAttribute("html", "lang");
const enTitle = await page.title();
ok("çevrimdışı / hâlâ İngilizce (/tr onu ezmedi)", enOffline === "en", `lang=${enOffline} title=${enTitle}`);
ok("çevrimdışı / başlığı İngilizce", /JUMVI Missions/.test(enTitle), enTitle);

await ctx.setOffline(false);
await browser.close();
console.log(`\n${fail === 0 ? "✅" : "❌"} ${pass} geçti, ${fail} kaldı`);
process.exit(fail === 0 ? 0 : 1);

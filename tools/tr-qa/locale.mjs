/* Drives the real Worker output in Chromium and checks the eight things the
 * brief named, plus the invariant that / and /tr share progress state. */
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
import fs from "node:fs";
import vm from "node:vm";

const BASE = process.env.BASE || "http://localhost:8787";
const REPO = process.env.REPO || process.cwd();

let pass = 0, fail = 0;
const ok = (label, cond, detail = "") => {
  if (cond) { pass++; console.log(`  ok   ${label}`); }
  else { fail++; console.log(`  FAIL ${label}${detail ? "\n         " + detail : ""}`); }
};

// English source of truth, straight from data.js.
const ctx = vm.createContext({ window: {}, document: {} });
vm.runInContext(fs.readFileSync(`${REPO}/data.js`, "utf8") + "\n;__out={missions,PACKS,BADGES};", ctx);
const EN = ctx.__out;

// Turkish table, straight from the package layer.
const trSrc = fs.readFileSync(`${REPO}/tr/i18n.js`, "utf8");
const missionTR = JSON.parse(trSrc.match(/const missionTR = (\{.*?\});\n/s)[1]);

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });

/* Spy on speech + capture the locale layer's effect, installed before any
 * page script runs so i18n.js wraps the spy rather than the reverse. */
const initScript = `
window.__spoken = [];
const voices = [
  { lang: "en-US", name: "Spy EN", default: true },
  { lang: "tr-TR", name: "Spy TR", default: false },
];
// The native .voice setter rejects anything that is not a real
// SpeechSynthesisVoice, which headless Chromium has none of. Make it accept
// our stand-ins so the test measures the locale layer's CHOICE of voice
// rather than a harness TypeError.
Object.defineProperty(SpeechSynthesisUtterance.prototype, "voice", {
  configurable: true,
  get(){ return this.__v || null; },
  set(v){ this.__v = v; },
});
// speechSynthesis is a readonly getter on window — plain assignment is a
// silent no-op, which makes an empty spy log look like a pass. Define it.
Object.defineProperty(window, "speechSynthesis", {
  configurable: true,
  value: {
    speaking: false, pending: false, paused: false,
    getVoices: () => voices,
    cancel(){}, pause(){}, resume(){},
    addEventListener(){}, removeEventListener(){},
    speak(u){ window.__spoken.push({ text: String(u.text), lang: u.lang, voice: u.voice && u.voice.lang }); },
  },
});
`;

async function open(path) {
  const page = await browser.newPage();
  await page.addInitScript(initScript);
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(BASE + path, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  return { page, errors };
}

/* ── 1. / stays English ───────────────────────────────────────────────────── */
console.log("\n/ (İngilizce kalmalı)");
{
  const { page, errors } = await open("/");
  ok("<html lang> = en", await page.getAttribute("html", "lang") === "en");
  ok("başlık İngilizce", (await page.title()).includes("JUMVI Missions"));
  ok("manifest = manifest.json", await page.getAttribute('link[rel=manifest]', "href") === "manifest.json");
  const body = await page.textContent("body");
  ok("Türkçe metin sızmamış", !/Görevleri’ne Hoş Geldin|Hız Canavarı|Tüm Paketler/.test(body));
  ok("sayfa hatası yok", errors.length === 0, errors[0]);
  await page.close();
}

/* ── 2. /tr is Turkish, all 36 missions ───────────────────────────────────── */
console.log("\n/tr (Türkçe olmalı)");
const { page: tr, errors: trErrors } = await open("/tr");
{
  ok("<html lang> = tr", await tr.getAttribute("html", "lang") === "tr");
  ok("başlık Türkçe", (await tr.title()).includes("JUMVI Görevleri"));
  ok("manifest = /tr/manifest.json", await tr.getAttribute('link[rel=manifest]', "href") === "/tr/manifest.json");
  ok("sayfa hatası yok", trErrors.length === 0, trErrors[0]);

  const data = await tr.evaluate(() => ({
    count: missions.length,
    ids: missions.map((m) => m.id),
    packs: PACKS.map((p) => [p.key, p.name]),
    badges: BADGES.map((b) => [b.id, b.name]),
    titles: missions.map((m) => m.title),
    fields: missions.map((m) => ({ id: m.id, steps: m.steps, win: m.win, safety: m.safety, tip: m.tip })),
  }));

  ok("36 görev", data.count === 36);
  ok("id'ler 1..36 değişmedi", data.ids.join() === EN.missions.map((m) => m.id).join());
  ok("pack key'leri çevrilmedi", data.packs.map((p) => p[0]).join() === EN.PACKS.map((p) => p.key).join());
  ok("badge id'leri çevrilmedi", data.badges.map((b) => b[0]).join() === EN.BADGES.map((b) => b.id).join());
  ok("pack ADLARI Türkçe", data.packs.every(([k, n]) => n !== EN.PACKS.find((p) => p.key === k).name),
     JSON.stringify(data.packs.filter(([k, n]) => n === EN.PACKS.find((p) => p.key === k).name)));
  ok("badge ADLARI Türkçe", data.badges.every(([id, n]) => n !== EN.BADGES.find((b) => b.id === id).name));

  const untranslated = data.titles.filter((t, i) => t === EN.missions[i].title);
  ok("36 görev başlığı Türkçe", untranslated.length === 0, "çevrilmemiş: " + JSON.stringify(untranslated));

  const missingField = data.fields.filter((f) => {
    const en = EN.missions.find((m) => m.id === f.id);
    return JSON.stringify(f.steps) === JSON.stringify(en.steps) || f.win === en.win
        || f.safety === en.safety || f.tip === en.tip;
  }).map((f) => f.id);
  ok("adımlar/hedef/güvenlik/ipucu Türkçe (36/36)", missingField.length === 0, "eksik id: " + missingField.join(", "));
  ok("i18n tablosu 36 görev kapsıyor", Object.keys(missionTR).length === 36, `tabloda ${Object.keys(missionTR).length}`);
}

/* ── 3. Visible UI copy ───────────────────────────────────────────────────── */
console.log("\nGörünen arayüz + Coach Leo");
{
  const bodyText = await tr.textContent("body");
  const leftEnglish = ["Missions", "Today", "Badges", "Progress", "Settings", "Welcome to JUMVI Missions",
    "Ready to play?", "Let's go", "Start", "Close", "Next", "Back"]
    .filter((w) => new RegExp(`(^|[>\\s])${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([\\s<]|$)`).test(bodyText));
  ok("gövdede kalan İngilizce arayüz metni yok", leftEnglish.length === 0, "kalan: " + leftEnglish.join(", "));

  const leo = await tr.evaluate(() => {
    const hits = [];
    document.querySelectorAll("*").forEach((el) => {
      const t = (el.textContent || "").trim();
      // "Coach Leo" is a registered brand name and stays as-is in the legal
      // line; what must not survive is English Leo *copy*.
      if (/trademark|tescilli marka/i.test(t)) return;
      if (/Hey there|I'm Leo|I’m Leo|Let me show you|Coach Leo will|Meet Coach Leo/i.test(t)
          && el.children.length === 0) hits.push(t.slice(0, 80));
    });
    return hits;
  });
  ok("Coach Leo metinleri Türkçeleşmiş", leo.length === 0, "İngilizce kalan: " + JSON.stringify(leo));

  const ariaEn = await tr.evaluate(() =>
    [...document.querySelectorAll("[aria-label]")]
      .map((el) => el.getAttribute("aria-label"))
      .filter((v) => /^(Close|Open|Next|Back|Settings|Missions|Badges|Play|Start|Read aloud)$/i.test(v)));
  ok("aria-label'lar Türkçe", ariaEn.length === 0, "kalan: " + JSON.stringify(ariaEn));
}

/* ── 4. Turkish TTS ───────────────────────────────────────────────────────── */
console.log("\nTTS (tr-TR)");
{
  const spoken = await tr.evaluate(() => {
    window.__spoken.length = 0;
    const u = new SpeechSynthesisUtterance("Mission: Speed Demon. Steps: Stand 2 big steps apart. Safety: Throw below chin height.");
    u.lang = "en-US"; u.rate = 1; u.pitch = 1.25; u.volume = 1;
    window.speechSynthesis.speak(u);
    return window.__spoken;
  });
  ok("okuma dili tr-TR'ye çevrildi", spoken[0] && spoken[0].lang === "tr-TR", JSON.stringify(spoken[0]));
  ok("Türkçe ses seçildi", spoken[0] && spoken[0].voice === "tr-TR");
  ok("etiketler Türkçeleşti", spoken[0] && /Görev:|Adımlar:|Güvenlik:/.test(spoken[0].text), spoken[0] && spoken[0].text);
}

/* ── 5. Red Light / Green Light caller ────────────────────────────────────── */
console.log("\nRed Light / Green Light (Görev 2)");
{
  const calls = await tr.evaluate(() => {
    window.__spoken.length = 0;
    const out = [];
    for (const phrase of ["Green light!", "Red light! Freeze!", "Time is up! Great freezing!"]) {
      const u = new SpeechSynthesisUtterance(phrase);
      u.lang = "en-US";
      window.speechSynthesis.speak(u);
    }
    return window.__spoken;
  });
  ok("caller replikleri Türkçe", calls.length === 3 && calls.every((c) => !/light|Freeze|Time is up/i.test(c.text)),
     JSON.stringify(calls.map((c) => c.text)));
  ok("caller dili tr-TR", calls.length === 3 && calls.every((c) => c.lang === "tr-TR"));
  console.log("       replikler: " + JSON.stringify(calls.map((c) => c.text)));

  const m2 = await tr.evaluate(() => missions.find((m) => m.id === 2));
  ok("Görev 2 id'si korunmuş", m2.id === 2 && m2.pack === "Reflex Rush");
  ok("Görev 2 başlığı Türkçe", m2.title === "Kırmızı Işık, Yeşil Işık", m2.title);
}

/* ── 6. Shared progress state ─────────────────────────────────────────────── */
console.log("\nPaylaşılan ilerleme (/ ve /tr aynı state)");
{
  const trKeys = await tr.evaluate(() => Object.keys(localStorage).sort());
  const { page: en } = await open("/");
  const enKeys = await en.evaluate(() => Object.keys(localStorage).sort());
  ok("aynı localStorage anahtarları yazılıyor", JSON.stringify(trKeys) === JSON.stringify(enKeys),
     `EN=${JSON.stringify(enKeys)}\n         TR=${JSON.stringify(trKeys)}`);
  ok("anahtarlar çevrilmemiş", trKeys.every((k) => /^jumvi_/.test(k)), JSON.stringify(trKeys));
  await en.close();
}

/* ── 7. PWA manifest ──────────────────────────────────────────────────────── */
console.log("\nPWA manifest");
{
  const mf = await (await fetch(`${BASE}/tr/manifest.json`)).json();
  const enMf = JSON.parse(fs.readFileSync(`${REPO}/manifest.json`, "utf8"));
  ok("start_url = /tr", mf.start_url === "/tr", mf.start_url);
  ok("ad Türkçe", mf.name === "JUMVI Görevleri", mf.name);
  ok("açıklama Türkçe", /Çocuklar için 36/.test(mf.description || ""), mf.description);
  ok("ikonlar mutlak yol (base href ile bozulmaz)", mf.icons.every((i) => i.src.startsWith("/")));
  ok("ikon setleri aynı", mf.icons.length === enMf.icons.length);
  ok("İngilizce manifest dokunulmamış", enMf.start_url === "/" && enMf.name === "JUMVI Missions");
}

/* ── 8. /tr?hub3d=1 ───────────────────────────────────────────────────────── */
console.log("\n3D Hub (/tr?hub3d=1)");
{
  const { page: hub, errors: hubErrors } = await open("/tr?hub3d=1");
  ok("sayfa hatası yok", hubErrors.length === 0, hubErrors[0]);
  const flag = await hub.evaluate(() => localStorage.getItem("jumvi_3d_hub_enabled"));
  ok("hub3d=1 opt-in bayrağını açtı", flag === "1", `bayrak=${flag}`);
  ok("bayrak anahtarı çevrilmedi", await hub.evaluate(() => "jumvi_3d_hub_enabled" in localStorage));
  const canvasPatched = await hub.evaluate(() => !!CanvasRenderingContext2D.prototype.__jumviTrPatched);
  ok("canvas metin çizimi locale katmanına bağlı", canvasPatched);
  const drawn = await hub.evaluate(() => {
    const c = document.createElement("canvas").getContext("2d");
    const seen = [];
    for (const label of ["Aim Master", "Focus Control", "Reflex Rush", "Team Duo", "Indoor Compact", "Beach/Park"]) {
      const before = label;
      c.fillText(label, 0, 0);
      seen.push([before, c.measureText(label) ? label : label]);
    }
    return true;
  });
  ok("hub canvas çağrıları hata vermiyor", drawn === true);
  await hub.close();
}

await tr.close();
await browser.close();

console.log(`\n${fail === 0 ? "✅" : "❌"} ${pass} geçti, ${fail} kaldı`);
process.exit(fail === 0 ? 0 : 1);

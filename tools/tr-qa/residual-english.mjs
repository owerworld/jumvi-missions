/* Residual-English scanner.
 * Collects every visible string on / and on /tr after driving the same flows.
 * Anything that appears identically on both is text the locale layer missed. */
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
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });

const initScript = `
// The welcome overlay owns the screen on a first visit and blocks tab
// switching, which kept whole panels out of an earlier scan. Start as a
// returning visitor so every panel is reachable.
try {
  localStorage.setItem("jumvi_onboarded_v2", "1");
  localStorage.setItem("jumvi_tour_done", "1");
  localStorage.setItem("jumvi_tutorial_done_v1", "1");
} catch (e) {}
window.__spoken=[];
const voices=[{lang:"tr-TR",name:"TR"}];
Object.defineProperty(SpeechSynthesisUtterance.prototype,"voice",{
  configurable:true,get(){return this.__v||null;},set(v){this.__v=v;}});
Object.defineProperty(window,"speechSynthesis",{configurable:true,value:{
  getVoices:()=>voices,cancel(){},addEventListener(){},
  speak(u){window.__spoken.push({text:String(u.text),lang:u.lang});}}});
`;

const collect = () => {
  const out = new Set();
  const push = (s) => {
    const t = String(s || "").replace(/\s+/g, " ").trim();
    if (t.length >= 3 && !/^[\d\s.,:/·—–-]+$/.test(t)) out.add(t);
  };
  const walk = (n) => {
    if (n.nodeType === Node.TEXT_NODE) {
      const p = n.parentElement;
      if (!p || /^(SCRIPT|STYLE|CODE|PRE|TEXTAREA)$/i.test(p.tagName)) return;
      const cs = getComputedStyle(p);
      if (cs.display === "none" || cs.visibility === "hidden") return;
      push(n.nodeValue);
      return;
    }
    if (n.nodeType !== Node.ELEMENT_NODE) return;
    for (const a of ["aria-label", "title", "placeholder", "alt"]) {
      if (n.hasAttribute(a)) push(n.getAttribute(a));
    }
    for (const c of n.childNodes) walk(c);
  };
  walk(document.body);
  return [...out];
};

/* Drive the flows that create most of the dynamic copy, so the scan is not
 * limited to the static shell. */
const drive = async (page, extra, collectFn) => {
  // Every tab panel, not just the default one: copy inside a closed panel is
  // computed-invisible and would otherwise never be measured. The footer's
  // legal line lives in the "profile" panel and hid from an earlier pass
  // exactly this way.
  for (const tab of ["today", "browse", "stats", "profile"]) {
    await page.evaluate((t) => {
      try { soundOn = true; } catch (_) {}
      document.querySelectorAll(`[data-tab="${t}"]`).forEach((b) => { try { b.click(); } catch (e) {} });
    }, tab);
    await page.waitForTimeout(250);
    const seen = await page.evaluate(collectFn);
    seen.forEach((s) => extra.add(s));
  }
  await page.evaluate(() => { try { openMission(missions.find((m) => m.id === 2)); } catch (_) {} });
  await page.waitForTimeout(400);
  (await page.evaluate(collectFn)).forEach((s) => extra.add(s));
};

const scan = async (path) => {
  const page = await browser.newPage();
  await page.addInitScript(initScript);
  await page.goto(BASE + path, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  const extra = new Set();
  const before = await page.evaluate(collect);
  await drive(page, extra, collect);
  const after = await page.evaluate(collect);
  await page.close();
  return new Set([...before, ...after, ...extra]);
};

const en = await scan("/");
const tr = await scan("/tr");
await browser.close();

// Brand/legal tokens that are supposed to read the same in both languages.
const ALLOW = /^(JUMVI|JUMVI®|SAY23 LLC|Coach Leo|WhatsApp|support@jumvi\.co|qr\.jumvi\.co|OK|PDF|3D|v\d)$/i;

const shared = [...tr].filter((s) => en.has(s) && !ALLOW.test(s)).sort();

console.log(`/ görünen dize: ${en.size}`);
console.log(`/tr görünen dize: ${tr.size}`);
console.log(`\nHer iki dilde AYNI kalan (çevrilmemiş aday): ${shared.length}\n`);
for (const s of shared) console.log("  · " + (s.length > 110 ? s.slice(0, 110) + "…" : s));

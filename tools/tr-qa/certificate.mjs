/* The Turkish certificate template is a separate binary, so nothing in the
 * locale layer can catch a regression in it. This checks the three things that
 * would break silently: the geometry app.js draws against, that the file is a
 * decodable WebP at all, and that each route actually requests its own
 * template rather than falling back to the other language's. */
let chromium;
try { ({ chromium } = await import("playwright")); } catch (_) {
  console.error("playwright bulunamadı: npm install playwright");
  process.exit(2);
}
import fs from "node:fs";
let pass=0,fail=0; const ok=(l,c,d="")=>{c?(pass++,console.log("  ok   "+l)):(fail++,console.log("  FAIL "+l+(d?"\n         "+d:"")));};
const BASE = process.env.BASE || "http://localhost:8787";
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const p = await b.newPage();

// 1. dimensions + decodability, straight from the file on disk
const enc = f => fs.readFileSync(f).toString("base64");
await p.setContent(`<img id="tr" src="data:image/webp;base64,${enc("tr/certificate-template.webp")}">
<img id="en" src="data:image/webp;base64,${enc("certificate-template.webp")}">`);
const dims = await p.evaluate(() => new Promise(r => {
  const done = () => r({ tr:[tr.naturalWidth,tr.naturalHeight], en:[en.naturalWidth,en.naturalHeight] });
  if (tr.complete && en.complete) done(); else { tr.onload = en.onload = () => (tr.complete&&en.complete)&&done(); }
}));
console.log("       TR:", dims.tr.join("x"), " EN:", dims.en.join("x"));
ok("WebP çözülebiliyor (0x0 değil)", dims.tr[0] > 0 && dims.tr[1] > 0);
ok("tam olarak 1376x768", dims.tr[0] === 1376 && dims.tr[1] === 768, dims.tr.join("x"));
ok("İngilizce ile aynı geometri", dims.tr[0] === dims.en[0] && dims.tr[1] === dims.en[1]);
await p.close();

// 2. the real /tr certificate flow must load the Turkish file
for (const [route, want] of [["/tr", "/tr/certificate-template.webp"], ["/", "certificate-template.webp"]]) {
  const pg = await b.newPage();
  const reqs = [];
  pg.on("request", r => { if (/certificate-template/.test(r.url())) reqs.push(new URL(r.url()).pathname); });
  await pg.goto(BASE + route, { waitUntil: "networkidle" });
  await pg.waitForTimeout(500);
  const drawn = await pg.evaluate(async () => {
    try { await renderSimpleCertificateBlob(); } catch (e) { return "hata:" + e.message; }
    return "çizildi";
  });
  await pg.waitForTimeout(900);
  ok(`${route} sertifika kaynağı → ${want}`, reqs.some(u => u.endsWith(want.replace(/^\//,"")) && (route==="/" ? !u.startsWith("/tr/") : u.startsWith("/tr/"))), JSON.stringify({reqs, drawn}));
  await pg.close();
}
await b.close();
console.log(`\n${fail===0?"✅":"❌"} ${pass} geçti, ${fail} kaldı`);
process.exit(fail === 0 ? 0 : 1);

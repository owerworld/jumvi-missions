#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
 * Trend görünümü — dürüstlük bekçisi
 *
 * Panele haftalar arası trend eklendiğinde yeni bir yalan söyleme biçimi de
 * doğdu: sayılar tek tek doğruyken ÇİZGİ yalan söyleyebilir. İki durumda:
 *
 *   1. Tanımı değişmiş bir metriğin iki yakası tek çizgiyle birleşirse,
 *      grafik gerçekte olmayan bir "çöküş" gösterir. mission_complete
 *      17 Ağustos'ta gerçek oyun şartına bağlandı (3b876f5); öncesi ve
 *      sonrası aynı şeyi ölçmüyor.
 *   2. O hafta ölçülmeyen bir alan (null) 0 olarak çizilirse, "kimse
 *      kullanmadı" gibi görünür — snapshot'ın availability bloğunun bütün
 *      varlık sebebi bu ayrımdı.
 *
 * Bu dosya assets/analiz/index.html'i kaynak olarak okur ve iki kaydın
 * (METRIC_CHANGES ↔ TREND_SERIES) birbiriyle tutarlı kalmasını zorlar.
 * Asıl yakalamak istediği hata sessiz olanı: `affects` içine yanlış yazılmış
 * bir anahtar hiçbir yerde patlamaz, sadece kırılma işareti sessizce kaybolur
 * ve panel tekrar yalan söylemeye başlar.
 *
 * .github/workflows/analytics-guard.yml tarafından her PR'da çalıştırılır.
 * Ağ erişimi yok, Cloudflare'e gitmez — sadece repodaki dosyaları okur.
 * ═══════════════════════════════════════════════════════════════════════════ */

import { readFileSync, existsSync } from "node:fs";
import vm from "node:vm";

const PANEL = "assets/analiz/index.html";
const html = readFileSync(PANEL, "utf8");

let pass = 0;
const failures = [];
function check(label, condition, detail = "") {
  if (condition) {
    pass++;
    console.log(`  ok    ${label}`);
  } else {
    failures.push(label);
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

/** Paneldeki bir üst-seviye `const <ad> = [...]` bloğunu değer olarak alır. */
function readConst(name) {
  const start = html.indexOf(`const ${name} = [`);
  if (start === -1) throw new Error(`${PANEL} içinde "const ${name} = [" bulunamadı`);
  const open = html.indexOf("[", start);
  let depth = 0;
  for (let i = open; i < html.length; i++) {
    if (html[i] === "[") depth++;
    else if (html[i] === "]" && --depth === 0) {
      const literal = html.slice(open, i + 1);
      // Panelde CSS değişkeni stringleri var ("var(--sky)"), fonksiyon yok:
      // düz bir dizi literali, sandbox'ta güvenle değerlendirilebilir.
      return vm.runInNewContext(`(${literal})`);
    }
  }
  throw new Error(`${name} dizisi kapanmıyor`);
}

console.log("\n1 — kayıtlar okunabiliyor ve boş değil\n");

const CHANGES = readConst("METRIC_CHANGES");
const SERIES = readConst("TREND_SERIES");

check("METRIC_CHANGES panelden okunabildi", Array.isArray(CHANGES) && CHANGES.length > 0);
check("TREND_SERIES panelden okunabildi", Array.isArray(SERIES) && SERIES.length > 0);

const seriesKeys = new Set(SERIES.map((s) => s.key));
check(
  "her seri anahtarı benzersiz",
  seriesKeys.size === SERIES.length,
  `${SERIES.length} seri, ${seriesKeys.size} benzersiz anahtar`,
);

console.log("\n2 — METRIC_CHANGES ↔ TREND_SERIES tutarlılığı (asıl sessiz hata)\n");

for (const c of CHANGES) {
  check(`${c.commit}: affects boş değil`, Array.isArray(c.affects) && c.affects.length > 0);
  for (const key of c.affects || []) {
    check(
      `${c.commit}: affects["${key}"] gerçek bir TREND_SERIES anahtarı`,
      seriesKeys.has(key),
      `panelde böyle bir seri yok — kırılma işareti sessizce kaybolurdu`,
    );
  }
}

console.log("\n3 — her kırılmanın kanıtlanabilir bir dayanağı var\n");

for (const c of CHANGES) {
  check(`${c.commit}: "at" ISO Zulu damgası`, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(c.at || ""));
  check(`${c.commit}: "at" geçerli bir tarih`, Number.isFinite(Date.parse(c.at)));
  check(`${c.commit}: commit sha'sı yazılı`, /^[0-9a-f]{7,40}$/.test(c.commit || ""));
  check(`${c.commit}: kısa etiket var`, typeof c.short === "string" && c.short.length > 0);
  check(
    `${c.commit}: gerekçe ekranda gösterilecek kadar açık (≥120 karakter)`,
    typeof c.detail === "string" && c.detail.length >= 120,
    "panelde tek görünen açıklama bu — 'tanım değişti' demek yetmez, NEDEN değiştiği yazmalı",
  );
}

console.log("\n4 — kırılma anı gerçek snapshot haftalarına doğru uyguluyor\n");

/* Panelin sideOfChange() mantığının aynısı. Amaç kodu tekrarlamak değil,
 * kayıttaki anın GERÇEK haftalara ne yaptığını bağımsız doğrulamak: 3b876f5
 * 2026-34'ün içine düşüyor, 2026-33 tamamen öncesinde, 2026-35 tamamen
 * sonrasında. Bu ilişki bozulursa panel yanlış yeri işaretler. */
const side = (snap, at) => {
  const t = Date.parse(at);
  if (Date.parse(snap.period_end + "T23:59:59Z") < t) return "before";
  if (Date.parse(snap.period_start + "T00:00:00Z") >= t) return "after";
  return "straddles";
};

const indexPath = "data/snapshots/index.json";
if (!existsSync(indexPath)) {
  check("data/snapshots/index.json mevcut", false, "snapshot dizini yok");
} else {
  const weeks = JSON.parse(readFileSync(indexPath, "utf8")).weeks || [];
  check("en az bir snapshot kayıtlı", weeks.length > 0);

  const snaps = weeks
    .filter((w) => existsSync(`data/snapshots/${w}.json`))
    .map((w) => JSON.parse(readFileSync(`data/snapshots/${w}.json`, "utf8")));

  check("index.json'daki her hafta için dosya var", snaps.length === weeks.length);

  for (const c of CHANGES) {
    const sides = snaps.map((s) => ({ week: s.week, side: side(s, c.at) }));
    const before = sides.filter((s) => s.side === "before").map((s) => s.week);
    const after = sides.filter((s) => s.side === "after").map((s) => s.week);
    const strad = sides.filter((s) => s.side === "straddles").map((s) => s.week);

    console.log(
      `        ${c.commit} @ ${c.at}\n` +
        `          öncesi: ${before.join(", ") || "—"}\n` +
        `          içinde: ${strad.join(", ") || "—"}\n` +
        `          sonrası: ${after.join(", ") || "—"}`,
    );

    check(
      `${c.commit}: en fazla bir hafta kırılmanın içine düşer`,
      strad.length <= 1,
      `${strad.length} hafta straddles döndü — bir an tek bir ISO haftaya düşebilir`,
    );
    check(
      `${c.commit}: kırılma gerçekten iki yakayı ayırıyor`,
      before.length > 0 && (after.length > 0 || strad.length > 0),
      "tek yaka varsa bu kayıt panelde hiçbir şey işaretlemiyor demektir",
    );
  }

  console.log("\n5 — tanımı değişmiş metrik gerçekten iki yakada farklı davranıyor\n");

  /* Bu, kaydın kozmetik olmadığının kanıtı: 3b876f5 öncesi ve sonrası
   * tamamlama oranları aynı aralıkta olsaydı, kırılmayı işaretlemek gereksiz
   * bir süsleme olurdu. Aradaki fark, çizgiyi koparmanın neden zorunlu
   * olduğunu gösteriyor. */
  const ratioChange = CHANGES.find((c) => (c.affects || []).includes("ratio"));
  if (ratioChange) {
    const withRatio = snaps.filter((s) => typeof s.recorded_completion_ratio === "number");
    const pre = withRatio.filter((s) => side(s, ratioChange.at) === "before");
    const post = withRatio.filter((s) => side(s, ratioChange.at) === "after");
    if (pre.length && post.length) {
      const maxPost = Math.max(...post.map((s) => s.recorded_completion_ratio));
      const minPre = Math.min(...pre.map((s) => s.recorded_completion_ratio));
      console.log(
        `        öncesi en düşük oran: ${minPre} · sonrası en yüksek oran: ${maxPost}`,
      );
      check(
        "iki yaka örtüşmüyor — kırılmayı işaretlemek zorunlu, süs değil",
        maxPost < minPre,
        `sonrası (${maxPost}) öncesinin en düşüğünü (${minPre}) geçiyor`,
      );
    }
  }
}

console.log("\n6 — panel bu kayıtları gerçekten kullanıyor\n");

check("renderTrend() tanımlı", html.includes("function renderTrend("));
check("render() renderTrend'i çağırıyor", /renderTrend\(weekId\)/.test(html));
check("sideOfChange() tanımlı", html.includes("function sideOfChange("));
check(
  "yaka değişiminde çizgi koparılıyor",
  /pts\[i - 1\]\.side !== p\.side/.test(html),
  "bu satır gitti mi iki yaka tek çizgiyle birleşir — grafiğin yalan söylediği tam an",
);
check(
  "null değer çizgiyi koparıyor (0 olarak çizilmiyor)",
  /if \(!ok\) \{ if \(cur\.length\) segs\.push\(cur\); cur = \[\]; continue; \}/.test(html),
);
check(
  "farklı yakadaki haftalar arasında delta gösterilmiyor",
  /prev\.side === pts\[idx\]\.side/.test(html),
  "tanım değiştiyse fark anlamsızdır — '▼496' olmayan bir çöküşü rapor etmek olur",
);

console.log("");
if (failures.length) {
  console.log(`❌ ${failures.length} başarısız kontrol:`);
  for (const f of failures) console.log(`   - ${f}`);
  process.exit(1);
}
console.log(`✅ Trend görünümü dürüst: ${pass} kontrol geçti — tanım kırılmaları işaretli, null sıfır değil.`);

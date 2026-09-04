# Genel tarama — 2026-09-04

**Taban:** `0af117e` · Depoda o an bulunan 35 `tools/check-*.mjs` aracının tamamı,
shell kontrolleri, ESLint ile statik tarama ve canlı `qr.jumvi.co` karşılaştırması
çalıştırıldı. Bu belge bulunanları ve her birinin nasıl kapatıldığını kaydeder.

---

## 1. Özet

| # | Bulgu | Etki | Durum |
|---|---|---|---|
| 1 | `mission-book.pdf` 4 ay bayat; görev 21 emekli oyunu öğretiyor | Ebeveyne basılı yanlış içerik | ✅ düzeltildi |
| 2 | `app.js` ve `jumvi-icons.css` `?v=` damgaları geride | Dönen ziyaretçi 1 yıl eski dosyada kalabilir | ✅ düzeltildi + guard |
| 3 | `check-mission-equipment` 2026-08-27'den beri kırmızı | Test yanlış, veri doğru | ✅ düzeltildi |
| 4 | `check-hub-fallback` H02/H03 hiçbir şey test etmiyordu | Hata yolu denetimsiz | ✅ düzeltildi |
| 5 | `tools/tr-qa/serve.mjs` production'ı yanlış modelliyordu | Testler yanlış uygulamayı ölçüyordu | ✅ düzeltildi |
| 6 | CI 35 kontrolden 9'unu çalıştırıyordu | 3 ve 4 numara bu yüzden aylarca fark edilmedi | ✅ düzeltildi |
| 7 | `tr/i18n.js` içinde gölgelenmiş çeviri anahtarı | Yok (aynı değer) | ✅ düzeltildi |
| 8 | `manifest.webmanifest` sahipsiz, çelişen `theme_color` | Kafa karışıklığı | ✅ silindi |
| 9 | CSP'de kullanılmayan `unpkg.com`, pdf-lib CDN'lerinde SRI yok | Gereksiz saldırı yüzeyi | ✅ düzeltildi |
| 10 | Faz 8 runbook'u silinmiş bir aracı listeliyordu | Yanlış yönlendirme | ✅ düzeltildi |
| 11 | Görev 21'in keşif görseli hâlâ eski oyunu çiziyor | Kartta yanlış resim | ⚠️ **yeni render gerekiyor** — guard'a kaydedildi |
| 12 | [PR #45](https://github.com/owerworld/jumvi-missions/pull/45) (2026-35 snapshot) açık | `/analiz` panelinde bir hafta eksik | ⏸️ **kullanıcı onayı bekliyor** |
| 13 | `origin/3d-forest-experiment` hâlâ duruyor | CLAUDE.md silindiğini söylüyordu | ⏸️ **kullanıcı onayı bekliyor** (CLAUDE.md düzeltildi) |

---

## 2. Görev Kitabı PDF'i

`generate_mission_book.py` görev verisinin **ikinci bir kopyasını** kendi içinde
tutuyordu. O kopya en son 2026-05-07'de üretilmişti, dolayısıyla `data.js` ile
35 alanda ayrışmıştı:

- Sayfa 12 hâlâ **"Captain Says"** öğretiyordu — görev 21 `e476b83` ile
  "Middle Defender" olmuştu.
- `PLAYERS 3+`, `4+`, `3-6` etiketleri basılıyordu; uygulamanın kendi kuralı
  dört raketlik kiti aşan ve "+" içeren etiketi yasaklıyor.
- 26 görevin süresi farklıydı (ör. #35 → PDF `150s`, uygulama `75s`).

**Çözüm:** kopya silindi; script `data.js`'i node ile değerlendirip okuyor —
`tools/check-*.mjs` dosyalarının kullandığı yöntemin aynısı. Kapak ve altbilgi
sayıları (`36 MISSIONS`, `across 6 skill packs`) ve paket başlıklarındaki
`Missions 7-12` aralıkları da artık veriden sayılıyor. Yükleyici, veriye
güvenmeden önce şunları doğruluyor ve aksi halde **hata verip çıkıyor**: bilinmeyen
paket, `+` içeren oyuncu etiketi, kiti aşan oyuncu sayısı, boş alan, adımsız görev,
bölünmüş paket. `OUTPUT_PATH` sabit `/Users/ramo/Desktop/...` yolu yerine depoya
göreli; `--out` ile değiştirilebiliyor.

**Doğrulama:** yeniden üretilen PDF metni çıkarılıp `data.js` ile karşılaştırıldı —
36 görevin başlığı, yaşı, oyuncu sayısı, süresi, tüm adımları ve kazanma koşulu
için **0 uyuşmazlık**.

## 3. `?v=` damgaları ve yeni guard

`_headers`, `/*.js` ve `/*.css` için `max-age=31536000, immutable` veriyor. Bu,
damga bump'lanmadan yeni bayt göndermenin dönen ziyaretçiyi bir yıl eski dosyada
bırakması demek. **CACHE_NAME bump'ı bunu kurtarmıyor:** precache anahtarı çıplak
`/app.js`, sayfanın istediği ise `app.js?v=…`; `caches.match()` sorgu dizesini yok
saymadığı için precache eşleşmiyor, istek `fetch()`'e düşüyor ve tarayıcının kendi
immutable HTTP cache'i yanıtlıyor.

Geride kalan iki damga:

| Dosya | Damga | Gerçek değişim |
|---|---|---|
| `app.js` | `?v=20260831-1` | `72b25a9`, 2026-09-02 — iOS tam ekran çıkmaz düzeltmesi |
| `jumvi-icons.css` | `?v=20260821-1` | `54303cb`, 2026-08-24 — WCAG AA kontrast düzeltmeleri |

İkisi de `20260904-1`'e alındı; `tr/i18n.js` de bu turda değiştiği için onun
damgası da (`src/worker.js` içinde) bump'landı, `CACHE_NAME` `v248` oldu ve iki
kilit dosyası da yenilendi.

**Yeni guard:** `tools/check-versioned-assets.mjs` +
`tools/versioned-assets.lock`. `check-core-assets.sh`'in bir katman üstteki
eşdeğeri: gönderilen HTML/JS/CSS içindeki her `<yol>?v=<damga>` referansını
hashleyip kilitle karşılaştırıyor. Aynı damga altında değişen bayt → kırmızı.
`--update` ile yeniden kilitleniyor. Üç senaryo için negatif test edildi
(damga bump'lanmadan değişen dosya, kilitlenmemiş yeni damga, var olmayan dosyaya
referans) — üçü de yakalanıyor, exit 1.

Kapsam dışı, bilerek: Coach Leo 2D sprite'ları. Damgaları `app.js` içindeki ortak
`LEO_ASSET_V` sabitinden geliyor ve `/assets/*` altındalar — orada `_headers`
bir yıl değil bir gün veriyor (`stale-while-revalidate`), yani bayat damga kendini
düzeltiyor.

## 4. Yalan söyleyen iki test

**`check-mission-equipment`** 36 satırlık donmuş bir ekipman matrisi taşıyordu.
Görev 21 değişince matris değişmedi ve kontrol, *doğru* olan kataloğu yanlış diye
raporlayarak kırmızıya düştü. Bir tabloyu, kopyası olduğu şeyi denetlemek için
kullanamazsınız. Matris kaldırıldı; kural görevin kendisinden türetiliyor —
**her aktif oyuncuya bir raket, her göreve bir top** (36/36 için geçerli). Sınırlar
(dört raketi aşmama, `+` etiketi yasağı) ayrı ayrı asserted; bunlar tutarlılıktan
türemiyor, basılı kitabın ve FBA kitinin verdiği söz.

**`check-hub-fallback` H02/H03** `page.route(...abort)` ile hub modülünü ve
three.js'i iptal ettiğini sanıyordu. Playwright, service worker'ın sayfa adına
yaptığı isteği göremez; dolayısıyla iptal edilen hiçbir şey yoktu, hub sorunsuz
açılıyor, kontrol de hub menüsündeki "Browse Missions"ı "← Missions" ile birlikte
sayıp "iki kurtarma yolu" diyerek FAIL basıyordu. Sadece iptal senaryolarına
`serviceWorkers: "block"` eklendi (H04'ün çevrimdışı senaryosu worker **ile**
daha gerçekçi olduğu için dokunulmadı) ve her senaryo artık kendi iptalinin
gerçekten çalıştığını sayıyor. Uygulamanın gerçek hata ekranı ortaya çıktı ve
zaten kusursuzdu: *"The island got lost! / Check your connection and try again."*
+ tam olarak bir çıkış yolu. **6/6 pass.**

## 5. QA sunucusunun production'a uymaması

Tarayıcı testlerinin tamamı `tools/tr-qa/serve.mjs` üzerinde koşuyor, yani onun
yanlış modellediği her şey "yanlış uygulamayı test eden bir kontrol" oluyor. Üç
sapma vardı, üçü de yanlış sonuç üretiyordu:

| Sapma | Sonucu |
|---|---|
| `.assetsignore` elle kopyalanmış ve bayatlamıştı | `CLAUDE.md`, `generate_mission_book.py`, `wrangler.jsonc` yerelde servis ediliyordu (production 404) |
| `run_worker_first` hiç modellenmemişti | `/assets/analiz/` yerelde parolasız 200 (production 401) — kapı, onu kontrol edeceğiniz araçta açık görünüyordu |
| `.mp3`/`.opus` MIME tablosunda yoktu, Range desteği yoktu | Chromium her Coach Leo klibini reddediyordu; `check-mission-play-state` T31 var olmayan bir ağ hatası raporluyordu |

Üçü de artık Cloudflare'in okuduğu dosyalardan (`.assetsignore`, `wrangler.jsonc`)
okunuyor, elle tutulan kopyadan değil. Ses/video/font MIME'ları ve `206 Partial
Content` eklendi. **11 yol için yerel↔production HTTP kodu karşılaştırması yapıldı**
(`/analiz`, `/data/*`, `/assets/analiz/*`, kaynak dosyalar, `/tr/`, `/manifest.json`)
— `/index.html` dışında tam eşleşme. (`/index.html` production'da 307 ile `/`'e
yönleniyor; testlerin giriş URL'si o olduğu için yerelde bilerek Worker'a
gidiyor.)

## 6. CI kapsamı

`analytics-guard.yml` 9 kontrol çalıştırıyordu; kalan 26'sı yalnızca yerel
alışkanlıktı. 3 ve 4 numaralı bulgular tam bu yüzden haftalarca kırmızı kaldı.

Yeni `.github/workflows/checks.yml`, iki iş:

- **`offline`** (~10 dk, ağsız, sırsız): gönderilen 90 script için `node --check`,
  iki cache guard'ı, katalog/ses/ikon/artwork kontrolleri, mission factory ve
  importer paketleri. Sonunda "çalışma ağacı checkout'taki gibi kalmalı" adımı var.
- **`browser`** (~35 dk): `serve.mjs` üzerinde 19 Playwright kontrolü. Playwright
  çalışma ağacının **dışına** kuruluyor ki `node_modules/` ağacı kirletmesin;
  `check-responsive-matrix` ve `check-zoom-textresize` ekran görüntülerini
  `$RUNNER_TEMP`'e yazıyor ki commit'li Faz 6 kanıtları ezilmesin.

`analytics-guard.yml`'a dokunulmadı — ayrı, dar ve zaten zorunlu bir kapı; hızlı
deterministik kontrolleri yavaş tarayıcı kontrollerinden ayırmak kırmızı X'i
okunur tutuyor.

CI dışı bırakılanlar ve nedeni: `mobile-matrix` (WebKit de gerekiyor),
`contrast-sweep` (~10 dk tam tarama; kapı `check-nontext-contrast`, bu rapor),
`check-deploy-health` ve `check-production-ui-assets` (canlı siteyi yokluyorlar,
kendi workflow'ları var).

## 7. Görev 21'in keşif görseli — kapatılamadı

`assets/ui/missions/21-captain-says.webp` hâlâ *Captain Says* çiziyor: yıldız
rozetli bir "kaptan" raketi, okla başka bir rakete işaret ediyor. Detay
sayfasındaki SVG diyagram `e476b83` ile doğru şekilde yeniden çizildi; kart,
bugünün görevi ve liste yüzeylerinin kullandığı ürün render'ı çizilmedi.

Bu bir render işi — kodla üretilemez. Yapılan: yeni `tools/check-mission-art.mjs`,
her slug'ın `<id>-<slugify(başlık)>` olduğunu ve dosyanın diskte bulunduğunu
doğruluyor. Görev 21 `ART_PENDING` içinde **tarihli ve gerekçeli** bir istisna
olarak duruyor, yani sorun görünmez değil kayıtlı. İstisna, sorun çözüldüğünde
kendisi de hata veriyor (`no exception outlives the problem it records`), böylece
unutulup gelecekteki bir uyuşmazlığı susturamıyor.

**Yeni render ne göstermeli:** üç raket; ortadaki, dıştaki ikisinin arasında atılan
topu kesiyor. Geldiğinde: dosyayı `21-middle-defender.webp` yap, `jumvi-art.js`
içindeki `MISSION_SLUGS` ve `service-worker.js` içindeki `CORE_ASSETS` güncelle,
`CACHE_NAME` bump'la, `tools/core-assets.lock`'ı yenile ve `ART_PENDING` kaydını sil.

## 8. Kullanıcı onayı bekleyen iki iş

- **[PR #45](https://github.com/owerworld/jumvi-missions/pull/45)** — 2026-08-31'den
  beri açık, 2026-35 haftasının analitik snapshot'ı. Merge edilmediği için `/analiz`
  panelinde o hafta eksik. CLAUDE.md main'e merge'ü açık onaya bağladığı için
  dokunulmadı.
- **`origin/3d-forest-experiment`** (head `0db4fef`, 2026-07-07) — CLAUDE.md
  2026-08-15'te silindiğini yazıyordu; silme yalnızca yerelde yapılmış. Uzak ref'i
  silmek geri alması zor bir işlem olduğu için bırakıldı; CLAUDE.md'deki yanlış
  cümle düzeltildi.

---

## 9. Temiz çıkanlar

- 35 check aracının tamamı yeşil (36. olarak `check-mission-art` eklendi).
- Gönderilen 90 script için sözdizimi temiz; `debugger`/`console.log` sızıntısı yok.
- XSS yok: çocuk adı ve profil alanları her yerde `escapeHtml` ya da `textContent`.
- `contrast-sweep`: 134 yüzey, **5402 metin düğümü, 0 adet WCAG AA altı**.
- `check-deploy-health.sh` canlıya karşı: 116/116 CORE_ASSETS doğrulandı,
  CACHE_NAME kilitle eşleşiyor, production JS sözdizimi geçerli.
- Production'da `/analiz` ve `/data/*` 401; `src/`, `tools/`, `docs/`, `CLAUDE.md`
  404. Gizlilik ve beacon guard'ları geçiyor.
- Coach Leo sesleri: 36/36 görev + 40/40 hatırlatma kayıtlı.
- `mission-book.pdf` yeniden üretildikten sonra 36 görev için `data.js` ile
  0 uyuşmazlık.

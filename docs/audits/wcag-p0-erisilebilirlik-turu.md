# P0 mobil ilk kullanım + WCAG turu — İngilizce ana rota

**Branch:** `claude/jumvi-visual-accessibility-k92evo`
**Başlangıç:** `54303cb` (metin kontrastı turu) · **Bitiş:** `024abd8`
**Tarih:** 2026-08-24

Bu tur, kontrast raporunda açık bırakılan üç maddeyi ve spec'in P0 listesini
kapsıyor. **Tamamlanmayan fazlar bölüm 6'da tek tek yazılı** — hiçbiri "geçti"
olarak işaretlenmedi.

---

## 1. Önceki kontrast çalışması korundu

`54303cb`'deki dokuz düzeltmenin hiçbiri geri alınmadı. Her turdan sonra
`contrast-sweep.mjs` yeniden çalıştırıldı: **140 yüzey geçişi, 4634 metin
düğümü, 0 hata** (düğüm sayısı 4628'den 4634'e çıktı — üç yeni seviye
açıklaması × iki tema).

Bu turda o çalışmadan doğan bir kusur da düzeldi: koyu temada Start butonunun
▷ ikonu beyaz kalmıştı (2.28:1), etiketi koyu mürekkebe geçmişken. İkon artık
etiketi takip ediyor.

## 2. P0 — onboarding örtüşmesi

Start CTA `position:sticky` idi. Sticky bir footer kendi yerini ayıramaz:
viewport'un altına sabitlenince oradaki içeriğin üstüne boyanır. Varsayılan
scroll konumunda, hiçbir etkileşim olmadan ölçülen:

| Viewport | Örtülen | Kayıp |
|---|---|---:|
| 390×844 | `36 games included …` | 12px |
| 320×568 | `Just starting` | 22px |
| 568×320 | `Any challenge` | 9px |
| 844×390 | `Any challenge` | 18px |

Panel artık tam bir viewport yüksekliğinde flex kolon (`100dvh`, `100vh`
fallback), CTA'nın üstündeki içerik kendi scroll bölgesinde (`.welcomeScroll`
— yeni bir sarmalayıcı; içindeki her id ve class aynı, app.js hepsine
`getElementById` ile erişiyor), CTA ise o kolonun footer'ı. Scroller'ın
kardeşi olan bir footer hiçbir scroll konumunda onu örtemez.

Düzeltirken iki şey daha çıktı:

- Kolon flex container'ı, overflow etmektense çocuklarını eziyordu. Kit kartı
  86px içeriğin etrafında 30px render oluyor, kürek ve top karoları karttan
  taşıp üstündeki "Grab your kit" başlığına biniyordu.
- 14px satır boşluğunu `.welcomePanel` taşıyordu; artık scroller taşıyor.

**Sonuç:** 6 viewport × 2 seviye durumu = 12/12 temiz.

## 3. §1.2 — zoom geri geldi

Viewport meta'sı `maximum-scale=1, user-scalable=no` taşıyordu — hem de üstünde
"pinch-zoom ENABLED (WCAG 1.4.4)" yazan bir yorumla. Arkasında app.js'te
`disableZoom()` bloğu vardı: double-tap, iOS gesture olayları, çok parmaklı
touchstart ve ctrl/cmd+wheel iptal ediliyordu. Android'de Chrome ve Firefox bu
ipuçlarına uyuyor, yani bu kâğıt üzerinde değil gerçek bir engeldi.

İkisi de kaldırıldı. Double-tap yarısının tap gecikmesi gerekçesi zaten
`width=device-width` + kontrollerdeki `touch-action:manipulation` ile karşılanmış
durumda.

## 4. §6.3 — SC 1.4.11 ölçüldü

Kriterin doğru okunması koddan daha önemliydi. İlk çalıştırma ile son hâli
arasında üç düzeltme, her biri kendinden emin saçmalık üretiyordu:

- Tab bar `1:1` "aktif vs pasif" dedi. İki tab da saydam; durum ikon ve etiket
  renginde. `background-color` okumak iki özdeş hiçliği karşılaştırıyordu.
- Etiketli her buton soluk kenarlık için işaretlendi. 1.4.11 bir bileşeni
  tanımak için **gereken** bilgiyi kapsar; görünür etiketi olan buton o
  etiketle tanınır ve onu 1.4.3 yönetir. Artık yalnızca kendi metni olmayan
  kontroller (ikon-only butonlar, input'lar) hata verebiliyor.
- Durum, durum-karşı-durum ölçülüyordu. Normatif ifade "against adjacent
  color(s)": geçmesi gereken, göstergenin üzerine çizildiği yüzeye karşı
  kontrastı. İki sayı da raporlanıyor, ama yalnızca ilki turu düşürüyor.

Bundan sonra geriye tek gerçek hata kaldı ve her yerdeydi: **global focus
stili yoktu.** On üç scoped kural birkaç kontrolü kapsıyordu; gerisi —
mission Start, Mark as done, tab bar, her dialog close — Chromium'un 1px
siyaha yakın varsayılanına düşüyordu. Koyu mission sheet'inde **1.35:1**.

Tek renk çözmüyor: beyazda 3:1 için luminans ≤0.175, `#1b2c44` sheet'te ≥0.176
gerekiyor. `outline-offset` halkayı kontrolün dolgusuna değil çevresindeki
yüzeye çizdiği için tema başına tek renk yetiyor — açıkta lacivert, koyuda bu
uygulamanın zaten kullandığı amber. **9.27:1 ve 9.76:1.**

İlk deneme box-shadow hâlesiydi ve specificity kavgasını kaybetti: primary
butonlar kendi gölgelerini `:focus-visible`'dan çok daha spesifik
seçicilerden `!important` ile veriyor, yani hâle tam da ihtiyaç duyulan
butonlarda sessizce hiç render olmuyordu.

## 5. §6.4 — 9px illüstrasyon etiketleri

Görev 14'teki `slow`/`fast` etiketleri SVG `<text>` değil, HTML `<span>`.
İllüstrasyon cerrahisi gerekmedi: 9px → 13px (projenin kendi alt sınırı).
96px'lik şeritte 47px metin, 320 ve 390'da sarma yok.

## 6. §2.1 — ölü search/filter yüzeyi

Spec iki seçenek sunuyordu. **Silme** seçildi: görünür yapmak, emekliye
ayrılmış düz liste görünümünü geri getirmek demek (`#list` `display:none`,
`renderList()` QR ilk boyamasını korumak için bilerek erken dönüyor) — bu bir
ürün kararı, kusur düzeltmesi değil.

Gidenler: sekiz `display:none`/0×0/`aria-hidden` stub, bağlı handler'lar ve
`renderFilters()`/`renderFilterGroups()` — bunlar her çağrıda chip üretip
gizli veya markup'ta hiç olmayan container'lara yazıyordu.

**Sadece ölü olmayan kısım:** `getVisibleMissions()` hâlâ "Pick one for me" ve
"Next"i besliyor ve `currentPack` + `onlyUnfinished` ile daraltıyordu. İkisi de
localStorage'a yazılıyor, hiçbiri bir kontrolden erişilebilir değil.

`jumvi_current_pack_v1="Beach/Park"` tohumlanıp "Pick one for me" 25 kez
basıldığında:

| | Erişilebilen görev |
|---|---|
| önce | **3 / 36** — Marathon Rally, Cloud Chaser, Home Base |
| sonra | 25 çekilişte 14 farklı — temiz profille aynı |

Geriye kalan tek filtre ailenin seçtiği ve hâlâ değiştirebildiği onboarding
oyun seviyesi. Değişkenler duruyor: `applyBackupPayload` onları okuyup yazıyor
ve v1 yedek formatı çalışmaya devam etmeli.

---

## 7. Araçlar

Hepsi hata durumunda çıkış kodu 1 veriyor.

| Araç | Ne doğruluyor |
|---|---|
| `tools/check-mission-schema.mjs` | 36/36 görev, zorunlu alanlar, tekil id, pack/oyuncu/ekipman tutarlılığı |
| `tools/check-onboarding-occlusion.mjs` | CTA'nın hiçbir şeyin üstüne boyanmadığı — `elementFromPoint` ile, ancak clip'lenmiş görünür dikdörtgen üzerinde |
| `tools/check-a11y-controls.mjs` | Erişilebilir isim, gerçek label, duplicate id, hedef boyutu (SC 2.5.8 inline istisnasıyla), viewport zoom |
| `tools/check-nontext-contrast.mjs` | SC 1.4.11 — bileşen kimliği, durum göstergesi, focus halkası |
| `tools/contrast-sweep.mjs` | SC 1.4.3 metin kontrastı (önceki tur) |

```
npx http-server -p 8910 -c-1
node tools/check-mission-schema.mjs
node tools/check-onboarding-occlusion.mjs --shots=DIR
node tools/check-a11y-controls.mjs
node tools/check-nontext-contrast.mjs
node tools/contrast-sweep.mjs
```

**Ölçüm tuzağı (ikinci kez):** tema sınıfı değişince her yüzeyde
`background-color` geçişi başlıyor; geçiş ortasında ölçmek ekranda hiç
görünmeyen renkleri hata sanıyor. Aynı şekilde `getBoundingClientRect()`
scroll container'ın kestiği kısmı da rapor ediyor — bu yüzden occlusion
kontrolü önce ataların clip'iyle kesişim alıp sonra renderer'a soruyor.

## 8. Yapılmayanlar — hiçbiri "tamamlandı" değil

Spec'in şu fazları **bu turda ele alınmadı**. Kod da test de yazılmadı:

- **Faz 1.4** mission state machine (çift timer, narration/timer yarışı,
  pause/resume, gate/elapsed tutarlılığı)
- **Faz 1.5** completion + Undo state bütünlüğü
- **Faz 2.2** mission card metadata · **2.3** pack açıklamaları
- **Faz 3** sheet bilgi sırası, göreve özel safety, riskli görevler (7/11/31/36),
  practice mode, çok oyunculu role preflight, phone-down cue
- **Faz 4** Family first viewport, profile edit, team/progress izolasyonu,
  Product Care, Privacy
- **Faz 5** install / offline / update / reset / 3D Hub izolasyonu
- **Faz 6.2** dialog focus contract (open → first focus → Escape → return focus)
- **Faz 6.5** `prefers-reduced-motion`
- 200% text resize ve OS font scaling testleri

## 9. Bilinen, ertelenen

- **Tab bar durum farkı** açık temada iki durum rengi arasında 1.15:1
  (koyuda 1.38:1). SC 1.4.11'i geçiyor — aktif ikon kendi zeminine karşı
  4.88:1 — ama iki durumu birbirinden ayırmak renk ayrımı zayıf olan biri için
  zor. Araç bunu `⚠` ile raporluyor, turu düşürmüyor. Şekil/kalınlık gibi
  renk dışı bir ayırt edici eklemek ayrı bir tasarım kararı.
- **`.ageBtn` kenarlığı** açıkta 1.22:1. Kart kendi etiketiyle tanınıyor,
  bu yüzden 1.4.11 hatası değil; 3:1'e çıkarmak kartları belirgin biçimde
  çerçeveli gösterir — ton düzeltmesi değil, tasarım değişikliği olur.
- **Üç hedef 44px altında** (40×44 iki close, 103×36 PDF linki). SC 2.5.8'in
  24px tabanının üstünde, yani AA geçiyor; tercih edilen 44'ün altında.
- `mission-book.pdf` için `ERR_ABORTED` — app.js'in opsiyonel dosya varlık
  yoklaması; dosya 200 dönüyor. Kusur değil.
- `/api/beacon` 405 — yalnızca statik sunucuda; Worker'da mevcut.

## 10. Breaking change

Yok. Görev id'leri, pack anahtarları, localStorage anahtarları ve v1 yedek
formatı değişmedi. Kaldırılan HTML stub'larının hiçbiri görünür değildi.

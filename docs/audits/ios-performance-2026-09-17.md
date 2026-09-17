# iOS 27 / iPhone 13 performans taraması — 2026-09-17

**Taban:** `e8ee8cf` · Şikâyet: "iOS 27'de iPhone 13 biraz takılıyor gibi".
Kısıt: kullanıcı arayüzü bozulmayacak.

Ölçüm, iPhone 13 görünüm alanında (390×844, dpr 3) **WebKit** ve **Chromium**
karşılaştırmalı olarak yapıldı. İki motoru yan yana koymak bu iş için şart:
şikâyet "iPhone'da takılıyor" olduğunda, Chromium'da olmayıp WebKit'te olan şey
aranan şeydir.

---

## 1. Özet

| # | Bulgu | Etki | Durum |
|---|---|---|---|
| 1 | `#sheet` dâhil 8 yüzey, opak arka planın ardında `backdrop-filter` taşıyor | Safari her görev açılışında tüm ekranı bulanıklaştırıp üstünü kapatıyordu | ✅ kaldırıldı |
| 2 | Her kartın üstünde %0.88 efektif alfalı `repeating-radial-gradient` doku | Kart başına fazladan kutu + 3× ölçekte raster | ✅ kapatıldı |
| 3 | İlk dokunuşta 4 saniyelik pembe gürültü tamponu senkron dolduruluyordu | İlk tap'in kendi karesi içinde ~190k iterasyon | ✅ tap dışına alındı |
| 4 | `warm-toy.css` `?v=` damgası olmadan `immutable` yayınlanıyordu | 36 commit'lik değişiklik dönen ziyaretçiye hiç ulaşmamış olabilir | ✅ damgalandı + guard |
| 5 | `html.perf-low` hiçbir iPhone'da tetiklenemiyor | Projenin kendi performans modu iOS'ta ölü | ⚠️ raporlandı, otomatik açılmadı |
| 6 | Browse listesi kaydırmasında WebKit kare düşürüyor, sebebi tek bir CSS özelliğine bağlanamadı | Açık | ⚠️ 10 ablasyon denendi, aşağıda |

Yeni guard: `tools/check-render-cost.mjs` (CI'da, WebKit ile).
`tools/check-versioned-assets.mjs` 4 numaralı bulgu için genişletildi.

---

## 2. Görülmeyen bulanıklıklar (bulgu 1)

`style.css` cam yüzeylere `backdrop-filter: blur(18–24px)` veriyor. Bu, o
yüzeyler yarı saydamken doğruydu. `warm-toy.css` sonradan aynı yüzeyleri **opak**
arka planla yeniden boyadı (`--glass` → `#FFFDF8` / `#17283A`) ve bulanıklığı
geri çekmedi.

Opak arka planın ardındaki `backdrop-filter` tanımı gereği görünmez: Safari
arkadaki bölgeyi örnekler, GPU'da ayrı bir bulanıklık geçişi çalıştırır, sonra
sonucun her pikselinin üstünü opak kartla boyar. `#sheet` için o bölge **tüm
görünüm alanı** (329.160 px²) ve `#sheet` uygulamanın en çok açılan yüzeyi.

Her iki temada da opak olduğu ölçülen ve kaldırılanlar:

| Yüzey | Filtre | Işık teması | Koyu tema |
|---|---|---|---|
| `#sheet` ve diğer `.sheet`'ler | `blur(24px)` / `blur(22px) saturate(1.6)` | `rgb(255,255,255)` | `rgb(27,44,68)` |
| `.sheet.fallbackSheet` | aynı | opak | opak |
| `#dailyBox.dailyBoxPromoted` | `blur(18px) saturate(1.6)` | opak | opak |
| `#parentDashboard.dashCard` | `blur(18px) saturate(1.6)` | filtre yok | opak |
| `#certBox.certBox` | `blur(18px) saturate(1.6)` | filtre yok | opak |

Bilerek **korunanlar** — kendi arka planları bulanıklığı gerçekten geçiriyor:

| Yüzey | Arka plan | Görünen pay |
|---|---|---|
| `#backdrop` | `rgba(2,6,23,.45)` | %55 |
| `#badgeUnlockModal` | `rgba(10,22,40,.7)` | %30 |
| `#timerCountdown` | `rgba(10,22,40,.85)` | %15 |
| `#certSheet` | `rgba(15,23,42,.9)` (koyu) | %10 |
| `#toast` | `rgba(15,23,42,.92)` (koyu) | %8 |
| `#seasonalCard` | ışık temasında saydam | tamamı |

Sonuç: canlı `backdrop-filter` yüzeyi **14 → 6**.

---

## 3. Görülmeyen doku (bulgu 2)

`style.css` on bir yüzeyin (`.hero`, `.card`, `.badge`, `.sheet`, `.dailyBox`,
`.footer`, `.dashCard`, `.seasonalCard`, `.filterGroups`, `.search`,
`.progressBox`, `.certBox`) üstüne tam boy bir `::before` koyuyor:

```css
background: repeating-radial-gradient(circle at 0 0,
  rgba(255,255,255,0.04) 0, rgba(255,255,255,0.04) 1px,
  transparent 1px, transparent 3px);
opacity: .22;
```

Efektif alfa **0.04 × 0.22 = 0.0088** — yüzde birin altında, yani 8 bitlik bir
kanalda bu derinin krem ve lacivert kartlarına karşı en fazla **2/255**. Maliyet
orantılı değil: her kart için fazladan üretilmiş bir kutu ve Safari'nin cihaz
ölçeğinde (bu telefonda 3×) yeniden rasterlediği 3 piksel periyotlu bir radyal
gradyan.

`style.css` bu blokları `html.perf-low` altında zaten siliyor ve gerekçeyi
"rasterisation cost" diye yazıyor — ama 5 numaralı bulguya bakınız.

---

## 4. İlk dokunuşun kendi karesi (bulgu 3)

Uygulamadaki **ilk** dokunuş `pointerdown` üzerinde iki dinleyici çalıştırıyor.
WebKit'te ölçülen:

| Dinleyici | Önce | Sonra |
|---|---|---|
| `unlockAudioOnce` | 25–30 ms | değişmedi (iOS gereği) |
| `startJumviMusicOnce` | 14 ms | 7 ms |

`unlockAudioOnce` içindeki `ctx.resume()` **jest içinde kalmak zorunda** — iOS
bir AudioContext'i ancak kullanıcı hareketi içinde `resume()` çağrıldığında
çalıştırır. Dokunulmadı.

`startJumviMusicOnce` ise `JumviWorldAmbience.start()` üzerinden
`_startWindLayer()` çağırıyordu: 48 kHz'de **4 saniyelik** pembe gürültü
tamponunu örnek örnek dolduran, yedi katsayılı bir filtre döngüsü (~190.000
iterasyon). Bunun jest içinde olması için hiçbir sebep yok — AudioContext zaten
kurulmuş ve bağlanmış oluyor, rüzgâr katmanının bir görev sonra başlaması
duyulabilir bir şey değil.

`requestIdleCallback` (Safari 16.4+) varsa onunla, yoksa düz bir görevle
erteleniyor. `start → stop → start` yarışına karşı bir generation sayacı
eklendi; test edildi: ertelemeden sonra tam olarak **bir** rüzgâr katmanı
kuruluyor (8 düğüm), `stop()` hepsini topluyor.

---

## 5. `warm-toy.css` bir yıllık dondurulmuş dosyaydı (bulgu 4)

`_headers` uzantıya göre donduruyor:

```
/*.css   Cache-Control: public, max-age=31536000, immutable
```

Ve bunu `_headers`'ın kendi yorumunda verilen söze dayandırıyor: *"Scripts and
styles are always requested with ?v=YYYYMMDD-NN"*. `warm-toy.css` istenmiyordu:
185 KB, uygulamanın bütün mevcut derisini tanımlayan dosya, `index.html`'den
damgasız bağlanmış ve onu bir kez indirmiş her cihazda bir yıl boyunca
dondurulmuş.

**36 commit** bu dosyayı değiştirmiş — WCAG kontrast düzeltmeleri (`54303cb`),
odak halkaları (`fa02562`), iOS standalone çıkmaz sokak düzeltmesi (`72b25a9`) —
ve hiçbiri dönen bir ziyaretçiye ulaşamamış olabilir. `CACHE_NAME` artırmak da
kurtarmıyor: `cache.addAll()` aynı HTTP önbelleğinden geçiyor.

Bu oturumun CSS değişikliği de aynı duvara çarpacaktı. `?v=20260917-1` eklendi,
`jumvi-world-ambience.js` damgası tazelendi, kilit yenilendi, `CACHE_NAME`
v249 → v250.

`check-versioned-assets.mjs` bu kör noktayı kapatacak şekilde genişletildi:
`_headers`'ın hangi uzantıları dondurduğunu **dosyadan okuyor** ve yayınlanan
HTML'in damgasız istediği her böyle dosyada patlıyor. Negatif test: damga geri
alındığında `exit=1`.

---

## 6. `perf-low` hiçbir iPhone'a ulaşmıyor (bulgu 5)

`app.js:9408`:

```js
const dm = navigator.deviceMemory || 0;
const isAndroid = /Android/i.test(navigator.userAgent);
const isLowRAM = dm > 0 && dm <= 4;
if(isAndroid || isLowRAM) document.documentElement.classList.add("perf-low");
```

`navigator.deviceMemory` yalnızca Chromium'da var; Safari uygulamıyor. iPhone da
Android değil. Yani **`html.perf-low` bugüne kadar hiçbir iPhone'da açılmadı** —
`style.css`'in 80 satırlık performans modu (gürültü dokularını silen,
`backdrop-filter`'ları kapatan, geçişleri durduran) iOS'ta ölü kod.

Bu **bilerek otomatik açılmadı**: iPhone 13 zayıf bir cihaz değil ve perf-low
görünümü gerçekten değiştiriyor (cam efektleri düz renge düşüyor) — istek "UI
bozmadan" idi. Yerine bu taramanın yaptığı şey, perf modunun en pahalı iki
maddesini (1 ve 2 numaralı bulgular) **herkes için** ve görünümü değiştirmeden
kaldırmak oldu.

Karar kullanıcıda: perf-low'un tetikleyicisi iOS'u da kapsayacak şekilde
düzeltilsin mi, yoksa bir ayar olarak mı sunulsun.

---

## 7. Kapatılamayan: Browse listesi kaydırması (bulgu 6)

Ölçülen, iPhone 13 görünüm alanı, dpr 3:

| | WebKit | Chromium |
|---|---|---|
| Düz 40 satırlık liste (kontrol) | 17 ms p95, 0/44 düşük | 17 ms, 0/44 |
| Düz 1365 düğümlü liste (kontrol) | 23 ms p95, 0/44 | — |
| Jumvi Browse listesi | **51 ms p95, 18/45 düşük** | 17 ms, 0/45 |

Yani ortam bozuk değil: aynı tarayıcı, aynı düğüm sayısındaki sade bir sayfayı
60 fps'te kaydırıyor. Maliyet cihaz pikseliyle ölçekleniyor (dpr 1: 17 ms →
dpr 2: 25 ms → dpr 3: 51 ms), yani raster sınırlı.

Denenen ve **hiçbiri işe yaramayan** ablasyonlar (her biri "sayfa hâlâ çiziliyor
mu" kontrolüyle; bu kontrol olmadan üç yanlış pozitif alınmıştı — sayfayı
boşaltan bir varyant "kazanmış" gibi görünüyor):

`backdrop-filter` kapalı · tüm animasyonlar kapalı · `filter` kapalı ·
`box-shadow` kapalı · `border-radius` kapalı · kenarlıklar saydam ·
`background-image` yok · metin saydam · `<img>` gizli · `overflow` görünür ·
`transform` yok · çubuklara `translateZ(0)` / `will-change` / `contain:paint` /
`isolation` · satırlara `contain:content` / `content-visibility:auto` ·
panele `contain:paint`.

Tam stil yeniden hesaplaması WebKit'te **98 ms**, Chromium'da **9 ms** (2588
kural, 1336 element) — 11 katlık fark. Sebep tek bir seçici sınıfına da
bağlanamadı; `:has()` (54 adet) ve `[style*=]` denemeleri fark yaratmadı.

### 7b. İkinci tur (merge sonrası) — ve ölçüm yönteminin kendi hatası

Önce kendi testimdeki bir hatayı buldum: Browse sayfasının **gerçek kaydırma
mesafesi 698 px** (16 kare), ama benchmark 45 kare kaydırıyordu — yani 29 kare
sayfanın dibinde hiçbir şey yapmadan geçiyordu. Düzeltilmiş ölçüm tabloyu
sertleştiriyor:

| | WebKit | Chromium |
|---|---|---|
| Medyan kare (gerçekten kayan kareler) | **45 ms** | 17 ms |
| Düşen kare | **16/17** | 0/17 |

Yani gerçekten kayan neredeyse her kare düşüyor.

İkinci turda elenen hipotezler (her biri "sayfa hâlâ çiziliyor mu" kontrolüyle):

| Hipotez | Test | Sonuç |
|---|---|---|
| Seçici eşleştirme / kural sayısı | Hiçbir şeyle eşleşmeyen **+10.000 kural** | 49 → 51 ms, aynı 17 kare. **Alakasız** |
| Gizli tam ekran modal katmanları | `#badgesBackdrop`, `#profileBackdrop` `display:none` | 49 → 56 ms |
| `position:sticky` başlık | `static` | 49 → 59 ms |
| Başlığın gizlenme animasyonu (`transform .25s`) | `transition:none` · `.hidden` iptal · `display:none` · terfi · `fixed` | Beşi de 44–48 ms, 14–17/17 düşük |
| `bottomNav` katman terfisi | `will-change:auto` ve tersi | Etkisiz |
| Overdraw | Sade kontrolle kıyas | 4,76 vs 3,65 — 1,3× fark, maliyet farkı 2,2× |

`+10.000 kural` sonucu özellikle önemli: 2588 kurallık stil sayfası **kare
başına maliyetin sebebi değil**. (Tam stil yeniden hesaplamasındaki 98 ms ayrı
bir metrik ve orada kural sayısı hâlâ rol oynuyor olabilir.)

**Dürüst sonuç:** bu kaydırma maliyeti bu oturumda kök nedene indirilemedi.
Yazılımla rasterleyen headless bir WebKit, GPU'lu gerçek bir iPhone'un
fiyatlandırmasını birebir vermiyor; özellikle 1 numaralı bulgu (tam ekran GPU
bulanıklık geçişi) tam olarak bu ortamın en kötü ölçtüğü şey. Bir sonraki adım
gerçek cihazda ölçmek olmalı — ve bunun için Mac gerekmesin diye
alan probu eklendi (§7c).

### 7c. Alan probu — `?perfprobe=1`

Kör tahmin yerine cihazın kendisine sormak için `index.html`'e küçük bir prob
konuldu. URL'de `perfprobe` yoksa **hiç çalışmıyor**: yükleme sırasında
`location.search` üzerinde tek bir `indexOf`, başka hiçbir şey — dinleyici yok,
zamanlayıcı yok, global yok, ağ isteği yok. Doğrulandı: bayraksız açılışta
0 prob düğümü, ağ istekleri ve DOM düğüm sayısı öncekiyle aynı.

Bayrakla açıldığında ekranın altında parmakla kaydırırken okunabilen bir kutu
çıkıyor. Yalnızca **sayfanın gerçekten hareket ettiği** kareleri sayıyor —
hareketsiz kareleri saymak, yukarıdaki benchmark hatasının ta kendisiydi.

    https://qr.jumvi.co/?perfprobe=1

Doğrulama (aynı ortam, aynı sayfa, iki motor):

| | WebKit | Chromium |
|---|---|---|
| Medyan | 48,0 ms | 16,7 ms |
| p95 | 57,0 ms | 16,7 ms |
| Düşen (>32 ms) | %100 | %0 |

Yani prob, headless bulgusunu sadakatle yeniden üretiyor. Şimdi aynı soruyu
gerçek bir iPhone 13'e soruyor: orada da medyan 45 ms civarıysa hata gerçek ve
hedefi var; 16–17 ms geliyorsa headless WebKit'in yazılım rasterleyicisinin
bir artefaktıydı ve 6 numara kapanır.

---

## 8. Görsel fark — "UI bozuldu mu?"

24 ekran görüntüsü (WebKit + Chromium × ışık + koyu × Today / Today-kaydırılmış
/ Browse / Family / Profile / görev sayfası), 31.599.360 piksel:

| Fark | Piksel | Oran |
|---|---|---|
| birebir aynı | 28.724.965 | %90,904 |
| 1–2/255 | 2.842.588 | %8,996 |
| 3–4/255 | 31.596 | %0,100 |
| 5–7/255 | 199 | %0,001 |
| 8+/255 | **12** | %0,000 |

%9'luk 1–2/255 bandı 2 numaralı bulgunun dokusu — zaten en fazla 2/255 katkı
veriyordu. 8/255 üstündeki **12 piksel**, tüm sette, düğme kenarlarındaki
kenar yumuşatma pikselleri.

WebKit'te hiçbir ekranda 4/255'i aşan fark yok.

Sekme ekranlarının ulaşamadığı yüzeyler — rozet, sertifika, gizlilik ve yardım
katmanları — ayrıca çekildi (10 ekran, WebKit, iki tema). Hepsinde **en fazla
2/255**, yani 2 numaralı bulgunun aritmetiğinin öngördüğü değer:

| Yüzey | Işık teması | Koyu tema |
|---|---|---|
| `#badgesBackdrop` | 2/255 (%0,14 piksel) | 2/255 (%30,2) |
| `#certBackdrop` | 2/255 (%3,9) | 2/255 (%12,0) |
| `#privacyBackdrop` | 2/255 (%2,0) | 2/255 (%29,0) |
| `#helpBackdrop` | 2/255 (%1,8) | 2/255 (%12,2) |

---

## 9. Ölçülen kazanç

WebKit, iPhone 13 görünüm alanı, dpr 3, 3 koşunun medyanı:

| | Önce | Sonra |
|---|---|---|
| İlk dokunuş dinleyicisi | 43 ms | **37 ms** |
| Sekme değişimi → boyama | 276 ms | **239 ms** |
| Tam stil yeniden hesaplama | 99 ms | 98 ms |
| Kaydırma p95 | 57 ms | 56 ms |
| Düşen kare | 19/45 | 17/45 |
| Canlı `backdrop-filter` yüzeyi | 14 | **6** |

Chromium'da ilk dokunuş 23 ms → 17 ms; geri kalan zaten temizdi.

Bu sayılar mütevazı, ve öyle sunulmalı. Kaldırılan işin **kesin** olduğu
söylenebilir (8 GPU bulanıklık geçişi, biri tam ekran; her kartta 3× ölçekte
rasterlenen bir gradyan; ilk tap'in içinden çıkarılan 190k iterasyonluk bir
döngü) — ama bu ortamın ölçemediği kısım tam da en büyüğü.

---

## 10. Guard

`tools/check-render-cost.mjs` — WebKit ile, her iki temada:

1. `backdrop-filter` taşıyan hiçbir yüzeyin arka planı opak olmayacak.
2. Tam boy dekoratif `::before`/`::after` katmanlarının efektif alfası %1,5'in
   altına düşmeyecek.
3. `TRANSLUCENT_BY_DESIGN` istisnası, kaydettiği saydamlığı yitirirse kendisi
   patlayacak.

Her iki kural da **kaskadda** yaşıyor — bulanıklık ve onu gizleyen arka plan
ayrı dosyalarda tanımlı, ikisine tek tek bakan hiçbir şey görmüyor. Bu yüzden
stil sayfası grep'i değil, gerçek bir tarayıcı.

Negatif testler (üçü de `exit=1` verdi):
doku geri açıldığında · opak yüzeye bulanıklık geri eklendiğinde · bir istisna
opaklaştığında.

CI: `.github/workflows/checks.yml` → `browser` işi.

---

## 11. Değişen dosyalar

| Dosya | Ne |
|---|---|
| `warm-toy.css` | §9 ve §9.1: ölü bulanıklıklar ve gürültü dokusu |
| `jumvi-world-ambience.js` | rüzgâr katmanı ilk dokunuşun dışına + generation sayacı |
| `index.html` | `warm-toy.css?v=20260917-1`, `jumvi-world-ambience.js?v=20260917-1` |
| `service-worker.js` | `CACHE_NAME` v249 → v250 |
| `tools/check-render-cost.mjs` | yeni guard |
| `tools/check-versioned-assets.mjs` | damgasız `immutable` dosya kuralı |
| `tools/versioned-assets.lock` | yenilendi |
| `.github/workflows/checks.yml` | yeni guard CI'da |

## 12. Açık kalanlar

- **Bulgu 6** — Browse kaydırma maliyeti; gerçek cihazda Safari Web Inspector
  timeline'ı gerekiyor.
- **Bulgu 5** — `perf-low` tetikleyicisi; karar kullanıcıda.
- Önceki taramadan devam: `git push origin --delete 3d-forest-experiment`.

# Faz 3 — mission sheet, fiziksel güvenlik, çocuk davranışı + T29 gerçek Hub

**Branch:** `claude/jumvi-visual-accessibility-k92evo`
**Baseline:** `8d87fab` (Faz 1.4/1.5) · **Tarih:** 2026-08-24
**Kapsam:** T29 gerçek Hub entegrasyonu, 36 görevin sheet bilgi sırası, göreve
özel güvenlik, riskli dört görev, çok oyunculu role preflight, phone-down cue,
Undo sonrası Family kartı, landscape completion CTA.

---

## 1. T29 — atlanan test artık gerçek Hub'a karşı çalışıyor

Önceki tur T29'u atladı ve sebebini yazdı: kontrol `window.openMissionFromHub`
arıyordu, o fonksiyon `jumvi-hub-app.js` içinde module scope ve window'a hiç
çıkmıyor. Yani kontrol her zaman false dönerdi.

`tools/check-hub-mission-flow.mjs` gerçeğini açıyor: `?hub3d=1`, "Explore Leo's
Island" kartı, `showHub3D()` ile `vendor/three.module.min.js` ve hub modülünün
gerçek import'u, `initHub3D()`, ve **gerçekten boyanmış bir kare** beklemesi
(`window.__hub3dLastFrameAt`). Headless'ta `--use-gl=swiftshader` gerekiyor;
GL context yoksa hub zaten doğru biçimde başlamayı reddediyor ve araç PASS
değil **UNTESTED** raporluyor.

Üç bug buldu, her biri diğerini gizliyordu.

### 1.1 Hub her popstate'te adayı terk ediyordu

Hub `{jumviHub}` sentinel'i push edip popstate dinliyor ve koşulsuz
`leaveHub()` çağırıyordu. app.js gate'ten mission açarken kendi `{jumviSheet}`
kaydını push ediyor, `closeMission()` de onu `history.back()` ile düşürüyor —
bu **içeriden** bir back ve tam da hub sentinel'inin üstüne iniyor. Hub bunu
"aile Back'e bastı" diye okudu.

Belirti: gate'te bir görevi bitirince ada kayboluyor, aile Play sekmesine
düşüyordu. Listener artık kendi sentinel'i güncel kayıtsa yerinde kalıyor.

### 1.2 `_hub3dAdvance` hedefini beklemeden önce sabitliyordu

`nextUndone`'ı en başta çözüp sonra ödül overlay'lerinin kapanmasını
bekliyordu — 20 saniyeye kadar. Görev 7 tamamlanır, o bekleme içinde Undo'ya
basılır, ve yine de **görev 8** açılıyordu. Hedef artık açılış anında
çözülüyor; ada ekranda değilse yürüyüş tamamen iptal.

### 1.3 Yürüyüş, onu hak eden completion'dan sonra da yaşıyordu

Hedef düzeltilse bile, Undo'dan sonra sheet'i kapatmak aileyi doğrudan içeri
geri sokuyordu. app.js artık tamamlanan görev id'sini `_hub3dAdvance`'a
geçiriyor; o completion `done` içinde değilse yürüyüş geçersiz.

Ölçüm — gate'ten görev 7 tamamlanınca:

| | Sonuç |
|---|---|
| önce | `tab-today`, ada gizli, sonra görev 8 Play üzerinde açılıyor |
| sonra | `tab-hub3d`, ada görünür, görev 8 **hub içinde** açılıyor |
| Undo | yürüyüş iptal; kapatma kapalı kalıyor |

**T29: 6/6.**

## 2. 36 görev matrisi — ölçülen kusurlar

`tools/check-mission-sheet-matrix.mjs` 36 görevi tek tek açıp bölüm varlığını,
DOM sırasını, metadata'nın gerçekten o görevin verisinden geldiğini ve güvenlik
bandının o oyuna mı yoksa diğer 35'le aynı cümleye mi ait olduğunu kaydediyor.

**Baseline: 0/36.** İki kusur:

### 2.1 Güvenlik bandı 36 görevde birebir aynıydı

Her sheet aynı satırı gösteriyordu: `×36 "Throw below face level · Stand 1–3 m
apart · Adult nearby"` — index.html'de sabit bir string. Oysa her görev
data.js'te kendi güvenlik satırını taşıyor ("Always throw UP — never AT each
other", "Stop stepping back when throws get wild") ve bu satırın göründüğü tek
yer **kapalı** "More tips & safety" akordiyonuydu. Yani oynanacak oyun için
yazılmış cümleyi pratikte kimse okumuyordu.

Artık görevin kendi cümlesi başta, ortak kurallar altında. Yeni bir güvenlik
iddiası eklenmedi — iki string de zaten vardı. Veri sözleşmesi değişmedi.

### 2.2 Metadata render ediliyor, kimseye gösterilmiyordu

`#sheet .sheetMeta{ display:none !important }` — üstünde "v32 keeps the sheet
header clean, the chips move out of it" notu vardı ama hiçbir yere
taşınmamışlardı. Zorluk, süre, oyuncu sayısı ve yaş her açılışta yeniden
kuruluyor ve gizleniyordu: sheet "ne lazım" sorusuna cevap veriyordu (You need:
2 paddles) ama "ne kadar sürer, kaç kişiyiz, dört yaşındakine uygun mu"
sorularına hiç. Geri getirildi, v32'nin düz pill diliyle. `Space` alanı veride
yok; pack'ten türetiliyor (Indoor Compact → Small space, Beach/Park → Outdoor),
uydurulmuyor.

**Sonuç: 36/36.**

## 3. Riskli dört görev (§3.3)

7 Rainbow Throws, 11 Sky Floater, 31 Cloud Chaser, 36 Marathon Rally. Hiçbiri
silinmedi, id'leri ve güvenlik verileri değişmedi. Her birine sheet içinde
"Take it gently" bloğu eklendi:

- **Start easier** — daha yakın/daha alçak/tek mesafe varyantı
- **How high, how far** — açık yükseklik/mesafe sınırı
- **Grown-up first** — yetişkinin önce yaptığı hazırlık
- **When to stop** — açık durma koşulu
- **Quick round** — gerçekten çalışan kısa mod

Quick round ölçüldü: 7/11/31 → `timerTotal=45s` (tam süreleri 90/75/90),
36 → `timerTotal=60s` (tam süresi 180). Bayraklanmamış görevlerde buton yok.

Metin, güvenlik verisinde zaten kullanılan kelimelerle yazıldı ("stop stepping
back when throws get wild", "throw UP, never AT"). Yeni tıbbi/hukuki/ürün
iddiası yok.

## 4. Role preflight (§3.5)

36 görevin **hiçbiri solo değil** — hepsi en az iki kişi istiyor. Sekizi üç ya
da dört kişi istiyor (2, 19, 20, 21, 22, 23, 24, 27) ve baseline'da bu sekizin
**hiçbirinde** rol kartı yoktu.

Üç+ kişilik görevlerde Start'tan önce: kim atar, kim tutar, kim sayar, ne zaman
değişiriz, nerede dururuz, ve **yalnızca iki kişiyseniz ne olur**. Roller
görevin kendi oyuncu sayısından türetiliyor, elle yazılmış tablodan değil.

İki kişilik 28 görevde tek satır: "This one is for two — one throws, one
catches… There is no solo version of this game." Spec "solo görevlerde solo
olduğu yazsın" diyor; veri solo görev içermediği için doğru cevap bunu
belirtmek, uydurmak değil.

## 5. Phone-down cue (§3.6) — vardı, ama ekran okuyucuyu boğuyordu

Cue zaten mevcuttu ve doğru metni taşıyordu ("Eyes on the ball! / Put the phone
down — Leo will let you know."). Sorun `aria-live` tarafındaydı:
**10 saniyelik oyunda 30 mutation** — saniyede ~3 duyuru, hem de ürünün "telefonu
bırakın" dediği anda.

İki kaynak vardı: her saniye yeniden yazılan geri sayım dial'i, ve değeri
değişmese bile her tick'te yeniden atanan chip/state metinleri (`textContent`
ataması aynı string olsa da mutation üretir).

- Dial `aria-hidden="true"` — sayı kaybolmuyor, completion butonu zaten aynı
  geri sayımı etiketinde taşıyor ve o gerçek bir kontrol.
- Chip ve state metni yalnızca **değiştiğinde** yazılıyor.

**30 → 0 duyuru.** Gate geçişi hâlâ bir kez duyuruluyor.

## 6. Undo sonrası Family kartı

Family yüzeyleri yalnızca `switchTab("modes")` içinden render ediliyordu. Undo
sonrası kart completion öncesi değeri gösteriyor, ancak sekmeye uğrayınca
düzeliyordu (ölçüldü: `"Family streak: 0 days"` → sekme dönüşünde `"Start a
family streak today!"`). `refreshFamilySurfaces()` eklendi ve hem completion
hem Undo yolundan çağrılıyor. Artık her adımda aynı değer.

## 7. Landscape completion CTA

Oyun sırasında `#sheetBody` gizleniyor ve 346px'lik play paneli doğrudan
`.sheetActions` üstüne yerleşiyor — 320px'lik bir landscape viewport'tan uzun.
Completion butonu 390px ekranda y=489'a düşüyordu. Erişilemez değildi (sheet
scroll ediyor; `scrollIntoView` + hit-test doğrulandı) ama yan yatmış telefona
bakan bir ebeveyn bitirme yolunu göremiyordu.

`@media (max-height:460px) and (orientation:landscape)` içinde panel ve —
yalnızca `.isPlaying` iken — başlık sıkıştırıldı:

| Viewport | Buton üstü (önce → sonra) | İlk viewport'ta |
|---|---|---|
| 844×390 | 489 → **325** | tamamen görünür |
| 568×320 | 489 → **311** | üst kenarı görünür, kalanı scroll ile |

Panel kaldırılmadı — §3.6 onu oyun sırasında ekranda istiyor. Portrait'e
dokunulmadı; sheet scroll'u bozulmadı (ölçüldü).

## 8. Practice / 3 başarısız deneme

Zaten vardı ve doğru çalışıyor: 3+ denemede "Try an easier version" görünüyor,
0 denemede görünmüyor. Ölçüldü, değiştirilmedi.

## 9. Regresyon

Faz 1–2 ve Faz 1.4/1.5 kontrollerinin hepsi yeşil: schema 36/36, sheet matrisi
36/36, onboarding 12/12, kontrol erişilebilirliği, SC 1.4.11, ikon glyph'leri,
Hub T29 6/6.

## 10. Bilinen / ertelenen

- **568×320 landscape**'te completion butonunun yalnızca üst kenarı ilk
  viewport'ta. Bu ekran yüksekliğinde panel + başlık + 56px buton fiziksel
  olarak sığmıyor; daha fazlası paneli kaldırmayı gerektirir.
- **Kids Challenge ve Parent Tip** hâlâ "More tips & safety" akordiyonunda.
  Spec sırası onları güvenlikten sonra istiyor ve oradalar; akordiyonu açık
  getirmek sheet'i belirgin biçimde uzatır — bilinçli olarak yapılmadı.
- **Quick round** completion gate'ini kısaltmıyor: 45s'lik hızlı tur
  `MISSION_GATE_MIN_S=45` ile aynı, yani gate yine gerçek oyun süresini
  bekliyor. Kasıtlı — gate'in amacı tap-through'u durdurmak.

## 11. Breaking change

Yok. Görev id'leri, pack anahtarları, `safety` veri sözleşmesi, localStorage
anahtarları ve v1 yedek formatı değişmedi. Yeni storage key eklenmedi.

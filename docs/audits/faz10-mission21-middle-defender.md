# Faz 10 — Görev #21 değişimi: "Captain Says" → "Middle Defender"

**Taban:** `7157eab` · 36 görev korundu (37. görev eklenmedi).

---

## 1. Envanter — sistem nasıl çalışıyor

| Soru | Cevap |
|---|---|
| Görev verisi nerede | `data.js`, `missions` dizisi; pozisyonel `m(id, pack, title, difficulty, players, time, age, steps, win, safety, tip, equipment)` yardımcısı |
| İllüstrasyonlar nasıl | `jumvi-mission-icons.js` → `MISSION_ICONS[1..36]`, satır içi SVG. `jumvi-icons.css` ile eşleşir, `.jmv` sarmalayıcı içinde render edilir |
| Detay UI'da nerede | `app.js:~4948` `#missionIconWrap`'a `innerHTML` yazıyor. Bu element `.sheetBody`'nin **ilk** çocuğu — "You need" satırının ve adımların üstünde |
| Team Up komşuları hangi formatta | 19, 20, 22, 23 **3 panelli** HTML blokları (`<h2 class="sr-only">` + flex paneller + chevron ayraçlar). 7, 8 gibi tekil sahneler tek SVG |
| Ayrıca ne var | `assets/ui/missions/NN-slug.webp` — keşif yüzeylerinde (kart, günün görevi, liste) kullanılan ürün art'ı; detay sayfası bunu **kullanmaz** |

**Yerleşim kararı:** UI'da değişiklik yapmadım. Diyagram zaten en doğru yerde — sheet gövdesinin en üstünde, adımlardan önce. Mevcut konvansiyonu izlemek yeterliydi.

**Format kararı:** 3 panel. Takas kuralı doğası gereği sıralı (kurulum → atış → yakalama ve takas) ve paketteki komşuların çoğu zaten bu formatta.

## 2. Nihai görev metni

```js
m(21,"Team Duo","Middle Defender",2,"3","150s","6+",
  ["Two players face off — the third stands in the middle",
   "Outside players toss past the middle, below face level",
   "Middle catches it? Swap with the player who THREW!"],
  "6 middle catches — everyone gets a turn!",
  "Toss below face level — swap by walking, not diving!",
  "Stand closer at first, so nobody stays stuck in the middle!", { paddles:3, balls:1 }),
```

Gerekçeler:

- **Başlık:** "Middle Defender" — paketin isim-öbeği kalıbına uyuyor (Round Robin, Spin Squad), pozitif ("defender", "steal" değil) ve rolü anında anlatıyor.
- **Adım 3'te `THREW` büyük harf:** paket zaten vurgu için büyük harf kullanıyor (`ANYONE`, `EVERYONE`, `ONE shared total`). Kritik belirsizlik — takasın **atan** kişiyle olması — böylece kaçırılamıyor.
- **Süre 150s:** Spin Squad ve Mix It Up ile aynı; sürekli ralli formatı.
- **Yaş 6+:** kesişme + takas kuralı Round Robin'den (4+) daha fazla kavrayış istiyor.
- **Tip:** klasik "ortada kalan çocuk hiç çıkamıyor" sorununu doğrudan hedefliyor — ebeveynin gerçek acı noktası.

## 3. Diyagram

`MISSION_ICONS[21]`, 3 panel:

| Panel | İçerik | Alt yazı |
|---|---|---|
| 1 | Üç oyuncu, ortadaki kesikli daireyle işaretli | "1. One in the middle" |
| 2 | Sol → sağ yay, top havada, arkasında ok | "2. Toss past them" |
| 3 | Ortadaki topu yakalamış; sağdaki soluk; **sol ile orta arasında çift yönlü takas oku** | "3. Caught? Swap with the thrower" |

Panel 2'de atış sol→sağ gidiyor, panel 3'te takas oku sol↔orta arasında — yani "atan kişiyle takas" görsel olarak da tutarlı.

## 4. Yol boyunca bulunan gerçek tuzak

`brandEquipment()` (jumvi-mission-icons.js sonunda) çalışma anında şunu yapıyor:

- `<ellipse ... fill="#85B7EB" stroke="#639922"/>` → fotoğrafik raket (`<use href="#jmvEqPaddle">`)
- `<circle ... fill="#EF9F27"/>` → top; **bir raketin `ry + r + 2` = 10 birim yakınındaki top raketle birleşip "catch" sembolü oluyor**

Bu eşleştirme **tüm ikon string'i** üzerinde yapılıyor — paneller ayrı `<svg>` olsa da aynı koordinat aralığını paylaştıkları için **paneller arası** çakışıyor.

İlk denememde: panel 2'nin topu (31,40) panel 1'in raketine (28,43) 4.2 birim uzaktaydı, panel 3'ünki (48,33) panel 1'in (48,40) raketine 7 birim. Sonuç: **panel 1'de hiç top yokken iki "yakalanmış top" görseli çıkıyordu ve panel 2 ile 3 toplarını tamamen kaybediyordu.**

Koordinatları yeniden kurguladım ve eşiğe karşı doğruladım:

```
panel2 havada top (55,27)  → en yakın raket 14.8 birim  → birleşmiyor ✓
panel3 yakalanmış (62,44)  → yalnızca kendi raketiyle 0.0 → birleşiyor ✓
```

Tarayıcıda doğrulandı: panel 1 → 3 düz raket, panel 2 → 3 raket + 1 uçan top, panel 3 → 2 raket + 1 catch.

Ayrıca bir **test hatamı** da not ediyorum: diyagramı bağımsız bir HTML sayfasında büyütüp incelemiştim ve raketler görünmüyordu. Sebep uygulamada değildi — o sayfaya `brandEquipment()`'ın gövdeye enjekte ettiği `<symbol>` tanımları yüklenmiyordu, dolayısıyla `<use>` hiçbir şeye çözülmüyordu. Ölçümü gerçek uygulama sayfasına taşıyınca doğru sonucu verdi.

## 5. Bayat referanslar

| Referans | Ne yaptım |
|---|---|
| `jumvi-mission-icons.js` `MISSION_NAMES["21"]` | "Middle Defender" |
| `coach-leo-audio.js` `MISSION_FILES[21]` | **Kaldırıldı.** Kayıt "Captain Says" kurallarını anlatıyor; görev artık o değil. Eksik id, TTS'e düşüyor (dosyanın kendi notu: "Missing IDs intentionally retain their TTS fallback") ve TTS **güncel** metni okuyor |
| `coach-leo-audio.js` `COACHING_FILES[21]` | Aynı gerekçeyle kaldırıldı |
| `data.js:285` "Team Captain" rozeti | **Dokunulmadı** — o paket rozeti ("Finish all Team Up missions"), görev adıyla ilgisi yok |
| `tr/i18n.js` | Görev metinleri TR haritasında yok; dosya değişmedi |

## 6. Bilerek ertelenen: keşif art'ı

`assets/ui/missions/21-captain-says.webp` — üç raket, bir top, bir ok ve **bir yıldız** (= kaptan). Yeni göreve yıldız uymuyor.

**Yeniden adlandırmadım.** Gerekçe:

1. Dosya `service-worker.js` CORE_ASSETS listesinde ve `tools/core-assets.lock` içinde. Adını değiştirmek `CACHE_NAME` bump'ı gerektirir (v244 → v245), bu da **her kullanıcı için 116 varlığın yeniden indirilmesi** demek — kozmetik bir yeniden adlandırma için ağır bir bedel.
2. Görselin kendisi zaten yeniden çizilmeli. Yeni art çizildiğinde `21-middle-defender.webp` olarak kaydedilir ve yeniden adlandırma + cache bump **tek bir değişiklikte** doğal olarak yapılır.
3. Şimdi yeniden adlandırmak, adı "middle-defender" ama resmi hâlâ kaptan yıldızı olan bir dosya üretirdi — sonraki bakımcı için daha yanıltıcı.

Ayrıca görevi öğreten yüzey detay sayfasındaki **diyagram**; webp yalnızca kart/liste süsü.

**Açık iş:** `21` için yeni keşif art'ı (yıldız yerine kesişme motifi) + Koç Leo'nun yeni anlatım ve iki koçluk kaydı. İkisi de üretim varlığı, kodla üretilemez.

## 7. Testler — 12 paket, 0 fail

```
mission schema 36/36 · sheet matrix 36/36 (3+ oyunculu 8 görevin 8'inde rol kartı)
icon glyphs · TR + localStorage invariants
runtime 7/7 · hub T29 6/6 · daily star 6/6 · mission entry sources
responsive 24/24 · a11y controls
contrast sweep: 134 yüzey, 5402 metin düğümü, 0 AA altı · non-text contrast
```

Bozulmadığı doğrulananlar: toplam görev sayısı (36), paket gruplaması, `players:"3"` ile oyuncu-sayısı filtresi (`Number(players.split("–").pop())` → 3), rol kartı render'ı, analytics kancaları, ilerleme/tamamlama davranışı.

Ekran görüntüleri: `docs/audits/screens/faz10/`

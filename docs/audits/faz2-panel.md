# Faz 2 — Görev 2.3: Gerçek Panel

**Branch:** `feat/faz2-arge` · **Tarih:** 2026-08-08
**Durum:** ✅ Panel çalışıyor, beş ek gereksinimin beşi de doğrulandı.
WAE'ye **sahte veri yazılmadı** — test yerel örnek JSON'larla yapıldı, dataset 16 satırda kaldı.

> **2026-08-14 güncellemesi — bu belgedeki "deploy edilmiyor" iddiası artık geçerli değil.**
> Panel `tools/panel/` → `assets/analiz/`'e taşındı ve şifre korumalı `qr.jumvi.co/analiz`
> route'u eklendi. §1 ve §6'daki mimari ve kapsam notları **tarihsel** — o an doğruydu, artık
> değil. Güncel mimari: [`docs/audits/faz2-analiz-route.md`](faz2-analiz-route.md).

---

## 1. Mimari

```
tools/generate-weekly-snapshot.mjs   (terminal — token burada kalır)
        ↓
data/snapshots/YYYY-WW.json + index.json
        ↓
tools/panel/index.html               (bu JSON'ları okur)
```

Panel WAE'yi **sorgulamıyor**. Tarayıcıdan WAE sorgusu API token gerektirir; token sayfaya girerse
sızmış demektir. Panel tek satır bile `fetch` ile Cloudflare'e gitmiyor — yalnızca yerel JSON okuyor.

**`qr.jumvi.co`'ya deploy edilmiyor.** `tools/` zaten `.assetsignore`'da (Faz 1'de `data/` ve `docs/`
ile birlikte doğrulandı), yani platform bu sayfayı kazara bile servis edemez.

---

## 2. Tasarım — prototip birebir korundu

`jumvi-arge-panel.html`'in CSS'i **satır satır aynen** alındı: renk değişkenleri, üç font ailesi,
eyebrow/thesis/alert/grid/funnel/cross/features blokları, hover tooltip'leri, legend. Sabit HTML
içerik JavaScript render'ına çevrildi; görsel dil değişmedi.

Eklenen CSS yalnızca prototipte karşılığı olmayan dört şey için: hafta seçici, değişim rozeti
(`.delta`), örneklem uyarısı (`.smallN`) ve boş durum (`.empty`).

### Prototipte olup veriyle karşılanamayan: huni

Prototipin hunisi **kişi bazlı** sorular soruyor: "En az 1 görev bitiren 94", "3+ görev bitiren 41".
Bu sayılar için hangi kullanıcının kaç görev bitirdiğini bilmek gerekir — yani cihaz kimliği. Faz 1'in
3. kuralı bunu yasaklıyor ve beacon böyle bir şey toplamıyor. **Bu iki basamak üretilemez.**

Yerine spec'in 2.1'de kendi tanımladığı huni kullanıldı — aynı görsel, cevaplanabilir sorular:

```
(satılan ünite — elle girilir, CONFIG.unitsSold)
  → Farklı cihaz açtı     app_first_opens     erişim
  → Toplam oturum         app_opens           kullanım
  → 2./3./5./10. kez geldi return_visits      tutundurma
  → Sertifika üreten      features.certificate_made
```

`unitsSold` hiçbir veri kaynağında yok; `null` bırakılırsa o basamak gizleniyor ve yüzdeler
"açan cihaz" tabanına göre hesaplanıyor.

### Çapraz okuma çubukları — gerçek veri prototipi zorladı

Prototipte her çubukta üç segment vardı ve her birinin etiketi içine sığıyordu. Gerçek katalogda
süre yedi, oyuncu altı kovaya sahip (bkz. `docs/audits/faz2-snapshot.md` §3). Dar segmentlerde
etiketler üst üste binip okunmaz hale geldi.

Çözüm prototipin kendi tasarım sözlüğünden: `%12`'nin altındaki segmentler metinsiz kalıyor ve
prototipte tanımlı ama kullanılmamış olan `.xkeys` / `.dot` stili altta tam listeyi taşıyor.

---

## 3. Ek gereksinimler — beşi de çalışıyor

| # | Gereksinim | Durum |
|---|---|---|
| 1 | Hafta seçici | ✅ `data/snapshots/index.json`'dan besleniyor |
| 2 | Önceki haftayla karşılaştırma | ✅ 7 metrikte ▲/▼, önceki hafta yoksa gizli |
| 3 | Uyarı eşikleri | ✅ üç tür, `CONFIG` bloğunda |
| 4 | Örneklem uyarısı | ✅ `app_opens < 100` iken kalıcı satır |
| 5 | Boş durum | ✅ komut + dosya seçici |

### 1 — hafta seçici ve `index.json`

Statik bir sayfa dizin listeleyemez, bu yüzden dizin kendini listeliyor: snapshot üreticisi her
koşuda `data/snapshots/index.json`'ı **diskteki dosyalardan yeniden kuruyor** (üzerine eklemiyor),
böylece silinen bir snapshot indeksten de düşüyor.

### 2 — karşılaştırma

Seçilen hafta ile bir öncekinin farkı: `▲59`, `▼3`, `▬ değişmedi`. **Renk yok, bilinçli:** yukarı
her zaman iyi değil — `progress_reset`'in artması kötüdür. Ok yönü söyler, yorumu okuyan yapar.

### 3 — eşikler

`CONFIG` bloğu dosyanın başında:

```js
weakMissionRatio: 0.5,   // genel ortalamanın yarısının altı → uyarı
resetAlertAbove: 5,      // bundan çok sıfırlama → uyarı
smallSampleBelow: 100,   // altında örneklem uyarısı
minStartsForAlert: 5,    // bu kadar başlatma yoksa görev uyarısı üretilmez
unitsSold: null,         // elle girilir
```

`minStartsForAlert` spec'te yok, eklendi: onsuz **1 başlatma / 0 tamamlama** olan bir görev
"%0 — sorunlu" diye alarm üretirdi. Tek çocuğun yarım bıraktığı bir oyun, bozuk bir görev değildir.

### 4 — örneklem uyarısı

`app_opens < 100` olduğu sürece panelin üstünde kapatılamaz bir satır duruyor:
*"Örneklem küçük (N=0). Paket seviyesi okunabilir, tek görev seviyesi henüz güvenilir değil."*

### 5 — boş durum

Snapshot yoksa ya da sayfa `file://` ile açıldığı için okuma engellendiyse aynı ekran çıkıyor —
kullanıcı açısından ikisi de "veride bir şey yok":

```
node tools/generate-weekly-snapshot.mjs
python3 -m http.server 8080 && open http://localhost:8080/assets/analiz/   # (o zamanki yol: tools/panel/)
```

artı bir **dosya seçici**. `file://` üzerinden tarayıcı yerel JSON okumasını CORS ile engellediği
için panel bu durumda snapshot'ları elle yükletebiliyor; spec'in "lokal dosya olarak açılacak"
gereksinimi bu iki yoldan biriyle karşılanıyor, hata mesajı hangi yolu izleyeceğini söylüyor.

### Ek: tamamen boş hafta

Sıfır trafikli bir haftada "pakete hiç girilmedi" uyarısı **altı kez** ateşliyordu — hepsi aynı şeyi
söyleyen, hiçbiri paketlerle ilgili olmayan altı alarm. Böyle bir haftada tek bir sakin satır
çıkıyor: *"Bu hafta hiç veri yok."*

---

## 4. Doğrulama

### Gerçek snapshot ile (`data/snapshots/2026-32.json`, hepsi sıfır)

```
örneklem uyarısı        N=0 → görünüyor ✅
uyarılar                1 (sakin "hiç veri yok") ✅
karşılaştırma           0 delta — "Önceki hafta yok" ✅
ızgara                  36 kare / 6 satır, hepsi "hiç açılmadı" ✅
huni                    7 basamak ✅   özellik listesi 11 satır ✅   hub 7 adım ✅
```

### Yerel örnek veriyle (`tools/panel/sample/2026-35.json`, `2026-36.json`)

İki hafta üretildi: Zen Mode paketi kasıtlı ölü, 31. görev kasıtlı bozuk (%12), sıfırlama 9.
**Bu dosyalar WAE'ye yazılmadı; dataset'e hiç dokunulmadı.**

```
thesis      "293 cihaz açtı, 368 görev bitti."
uyarılar    11% | Görev 31 yarıda kalıyor          ← zayıf görev eşiği
            0   | Zen Mode paketine hiç girilmedi  ← ölü paket eşiği
            9   | İlerleme sıfırlama beklenenin üstünde  ← reset eşiği
karşılaştırma  ▲59 ▲130 ▲20 ▲12 ▲7 ▲2 ▲2  (2026-35'e göre)
örneklem uyarısı  N=644 → gizli ✅
ızgara      Zen Mode satırı tamamen gri, 31. görev turuncu ✅
```

Üç uyarı türünün üçü de tetiklendi, eşiklerin altında kalanlar tetiklenmedi.

### Hafta değiştirme

| Seçilen | Delta | Dipnot |
|---|---|---|
| 2026-32 (ilk) | 0 | "Önceki hafta yok — karşılaştırma gösterilmiyor" |
| 2026-35 | 7 | "Karşılaştırma: 2026-32" |
| 2026-36 | 7 | "Karşılaştırma: 2026-35" |

Panel konsola hata yazmıyor.

---

## 5. Dipnot ne söylüyor

Her render'da kaynağı ve sınırlarını yazıyor: hangi dosya, hangi şema sürümü, ne zaman üretildi,
hangi haftayla karşılaştırıldı, hafta kapanmış mıydı, `excluded_before` var mı — ve zorunlu dürüstlük
etiketi:

> "Farklı cihaz açtı" kimlik tutulmadığı için kesin değil, yönsel bir göstergedir — aynı hane iki
> telefondan girerse iki sayılır, tarayıcı verisi temizlenirse yeniden sayılır.

---

## 6. Kapsam dışı

- `hq.jumvi.co`'ya taşıma — spec'te açıkça kapsam dışı.
- Snapshot otomasyonu — Faz 3.
- `unitsSold`'ın bir kaynaktan otomatik gelmesi — Amazon verisi bu projede yok, elle girilir.
- Kova başına tamamlanma oranı grafiği — veri snapshot'ta mevcut (§2.2 §4), panelde gösterilmiyor.

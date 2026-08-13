# `/tr` — English text baked into binary assets

**Durum:** İki dosya üretilmedi. Bu ortamda görsel kaliteyi koruyarak üretilemedikleri
için tahmin edilmedi; aşağıda ne gerektiği tam olarak listelendi.

`tr/i18n.js` bir DOM/canvas katmanı: `fillText` ile çizilen ve DOM'a giren her metni
çevirir. Bir raster görselin piksellerine veya bir PDF'in içine gömülü metne
erişemez. Bu yüzden `/tr` bu iki dosyanın Türkçe sürümlerine ihtiyaç duyar.

## Routing — hazır ve inert

Wiring `tr/i18n.js` içinde zaten var ve dosyalar eklenene kadar **hiçbir şeyi
bozmaz**:

| Asset | `/` (değişmez) | `/tr` (dosya eklendiğinde) | Dosya yokken |
|---|---|---|---|
| Sertifika şablonu | `certificate-template.webp` | `/tr/certificate-template.webp` | `loadImageWithFallback()` sıradaki İngilizce şablona düşer |
| Görev kitabı | `mission-book.pdf` | `/tr/mission-book.pdf` | `HEAD` 404 döner, link İngilizce PDF'te kalır |

İngilizce dosyaların üzerine yazılmaz. Türkçe dosyalar `tr/` klasörüne bu adlarla
konduğu anda kendiliğinden devreye girer.

---

## 1. `certificate-template.webp` (1376×768)

Uygulama şablonun üzerine yalnızca üç şey çizer — ad, tarih/kimlik satırı ve alt
bilgi — ve bunların üçü de `/tr`'de zaten Türkçeleşiyor. Aşağıdakilerin hepsi
**görselin içine gömülü** ve yalnızca yeni bir görselle değişir:

| Konum | Gömülü İngilizce | Önerilen Türkçe |
|---|---|---|
| Sol üst, logo altı | `Missions Program` | `Görev Programı` |
| Üst orta (3D altın rozet) | `YOU DID IT!` | `BAŞARDIN!` |
| Ana başlık (2 satır, mavi) | `MISSION CHAMPION & STAR CATCHER CERTIFICATE` | `GÖREV ŞAMPİYONU VE YILDIZ AVCISI SERTİFİKASI` |
| Başlık altı | `High five! You completed every mission and caught every star!` | `Çak bir beşlik! Tüm görevleri tamamladın ve bütün yıldızları yakaladın!` |
| Sarı rozet şerit | `All Missions Complete • Safe play • Kids 3–8` | `Tüm Görevler Tamamlandı • Güvenli oyun • 3–8 yaş` |
| Sol alt kutu | `Achievement` / `Status: Complete` / `Badge: Champion 🏆` | `Başarı` / `Durum: Tamamlandı` / `Rozet: Şampiyon 🏆` |
| Sağ alt | `JUMVI Team` / `Safe play • Kids 3–8` | `JUMVI Ekibi` / `Güvenli oyun • 3–8 yaş` |

Değişmemeli: `JUMVI` kelime markası, sol üstteki logo, sağ alttaki `JUMVI` filigranı,
yıldız/parıltı süslemeleri, arka plan, kenarlık ve **noktalı ad çizgisinin konumu**.

> **Kritik ölçü:** `app.js` adı `height * 0.575`'e, tarih/kimlik satırını
> `height * 0.935`'e, alt bilgiyi `height * 0.975`'e çizer. Türkçe şablon **1376×768
> olmalı** ve noktalı çizgi aynı yükseklikte kalmalı; yoksa ad yanlış yere düşer.

`YOU DID IT!` 3D altın kabartma bir tipografi çalışması — bu ortamda kalite kaybı
olmadan yeniden üretilemez. Tasarımcı işi.

---

## 2. `mission-book.pdf` (21 sayfa)

`generate_mission_book.py` ile üretiliyor. Metinlerin tamamı script'in içinde sabit;
PDF'in kendisi düzenlenmez, script'ten yeniden üretilir.

### Gereken çalışma

1. **36 görevin Türkçe içeriği.** Script, `data.js`'in ayrı bir Python kopyasını
   taşıyor (`MISSIONS`, satır 47) — başlık, adımlar, kazanma kuralı, güvenlik ve
   ipucu. Türkçe karşılıkların tamamı `tr/i18n.js` içindeki `missionTR`'de zaten
   hazır; oradan üretilmeli, elle yeniden çevrilmemeli.
2. **Kitap kroniği** (görev dışı metinler):

   | Yer | İngilizce |
   |---|---|
   | Kapak | `JUMVI Mission Book` · `36 Fun Tossing & Catching Games for Ages 3-8` · `across 6 skill packs \| Ages 3-8 \| Indoors & Outdoors` · `Boost reflexes, focus & teamwork -- one mission at a time!` |
   | Bölüm başlıkları | `36 MISSIONS` · `HOW TO PLAY` · `Safety & How to Play` |
   | Kart etiketleri | `WIN` · `SAFETY` · `TIP` |
   | Güvenlik sütunu | `SAFETY FIRST` + 4 madde (`Always toss below face level`, `Start 3-6 feet (1-2 meters) apart`, `No running indoors -- keep movements controlled`, `Adult supervision recommended for ages 3-4`) |
   | Nasıl oynanır sütunu | `HOW TO PLAY` + 4 madde + not (`Scan the QR code on your paddle packaging…`) |
   | Pack başlıkları | 6 pack için `Missions N-M` + açıklama (ör. `Speed, reaction time & hand-eye coordination`) |
   | Alt bilgi | `6 Skill Packs: Reflex Rush \| Aim Master \| …` · `qr.jumvi.co` |

   Pack **adları** Türkçeleşmeli (`tr/i18n.js` `packTR`), pack **anahtarları**
   (`Reflex Rush` vb.) veri tarafında olduğu gibi kalmalı.

3. **Türkçe destekleyen bir font.** Script yalnızca yerleşik `Helvetica` /
   `Helvetica-Bold` / `Helvetica-Oblique` kullanıyor. Bunlar Latin-1; `ğ ı ş İ Ğ Ş`
   karakterleri **yok**. `pdfmetrics.registerFont(TTFont(...))` ile Türkçe glif
   taşıyan bir TTF gömülmeli ve tüm `setFont(...)` çağrıları ona çevrilmeli.
   Dikkat: `wrap_text()` satır kırmalarını `stringWidth(..., "Helvetica", ...)` ile
   hesaplıyor — font değişince metrikler değişir, yani **her kartın satır düzeni
   yeniden kontrol edilmeli**.

4. `OUTPUT_PATH` (satır 39) sabit bir yerel masaüstü yoluna bakıyor
   (`/Users/ramo/Desktop/...`); Türkçe üretimde `/tr/mission-book.pdf`'e yazmalı.

### Bu ortamda neden üretilmedi

`reportlab` kurulu değil, Türkçe glif taşıyan bir font seçilmedi ve font değişimi
21 sayfanın satır düzenini kaydıracağı için çıktının mevcut tasarımla eşleştiği
görsel olarak doğrulanamaz. Doğrulanamayan bir PDF'i "Türkçe görev kitabı" diye
yayınlamak, İngilizce bir belgeyi Türkçe etiketlemekten daha kötü olurdu.

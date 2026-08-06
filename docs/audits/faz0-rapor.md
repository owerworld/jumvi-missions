# JUMVI — Faz 0 Denetim Raporu

Repo: `owerworld/jumvi-missions` (`~/Developer/jumvi-missions`)
Spec: `docs/specs/jumvi-faz0-denetim-spec.md`

---

## Denetim 3 — Mikrofon

**Model:** Sonnet (spec Haiku öneriyordu; session zaten Sonnet'teydi, denetim mekanik grep olduğu için sonucu etkilemez)
**Tarih:** 2026-08-07

### 3.1 Ses çıkışı (speechSynthesis)
Kullanım yerleri:
- `app.js:875,882,884,893,2204,2206,2207,2213` — kid-voice seçimi, read-aloud butonu (`btnSpeak`), mission metnini okuma
- `jumvi-redlight.js:106,108,126,128,134,137,139,140,149,152,158,166,343,352,408` — Mission 2 "caller" sesi (GREEN/RED anonsu)

Hepsi `speechSynthesis` / `SpeechSynthesisUtterance` — tarayıcının kendi TTS motorunu çağırıyor, hiçbir ses verisi cihazdan çıkmıyor.

✅ Sorun yok

### 3.2 Ses girişi
Bulgu: **YOK**

Aranan ve bulunamayan API'ler (repo genelinde, `vendor/` dahil, `node_modules` hariç):
- `SpeechRecognition` / `webkitSpeechRecognition` — bulunamadı
- `getUserMedia` — bulunamadı
- `mediaDevices` — bulunamadı
- `MediaRecorder` — bulunamadı
- `audio: true` (obje literal) — bulunamadı

**Bir istisna, incelenip elenmiş:** `vendor/three.module.min.js` içinde `createMediaStreamSource` string'i geçiyor. Bu, three.js'in `THREE.Audio.setMediaStreamSource(stream)` yardımcı metodunun içinde duran genel bir kütüphane yeteneği — bir `MediaStream`'i (örn. `getUserMedia` çıktısı) Web Audio grafına bağlamak için var. JUMVI'nin kendi kodunda (`app.js`, `jumvi-hub-app.js`, `jumvi-redlight.js`, `jumvi-mission-icons.js`, `data.js`, `index.html`, `leo-tour.js`, `service-worker.js`) bu metot **hiçbir yerden çağrılmıyor** (`grep -c MediaStreamSource` → hepsinde 0), ve zaten `getUserMedia` projede yok — yani ona beslenecek bir stream de yok. Davet edilmemiş, ulaşılamayan kütüphane kodu. Aktif değil, feature-flag'li değil, çağrılmıyor.

### 3.3 Mission 2 doğrulaması
Dosya: `jumvi-redlight.js` ("Red Light, Green Light caller — Mission 2 only")

Kullanılan API: `speechSynthesis` / `SpeechSynthesisUtterance`
Sentez mi tanıma mı: **Sentez.** Telefon "caller" rolünde — GREEN/RED'i sesli duyuruyor ve ekranda ışık gösteriyor (`callerHint` / `callerHintLight` DOM'u, `index.html:578-587`). Çocuktan hiçbir ses/giriş almıyor; tek yönlü.

Not: "caller" kelimesi kod tabanında iki ayrı anlamda geçiyor — (1) bu mekaniğin UI adı ("Phone calls the lights", `index.html:586`), (2) genel programlama terimi "the calling function" (`jumvi-leo.js:4,59,278,281`, `jumvi-hub-app.js:1441,3439,4160`) — telefon çağrısıyla ilgisi yok, isim çakışması. Karışıklığa mahal vermemek için ayrıca not edildi.

### 3.4 Manifest / permissions
`manifest.json`: `permissions` alanı **yok** (PWA manifest'inde bu alan zaten standart değil, tarayıcı izinleri `Permissions-Policy` header'ı ve runtime `navigator.mediaDevices` çağrılarıyla yönetilir — ikisi de kontrol edildi ve temiz).

`_headers:6`:
```
Permissions-Policy: camera=(), microphone=(), geolocation=()
```
Mikrofon **açıkça ve sitewide kapatılmış.** Bu, tarayıcı seviyesinde bir garanti — bir gün kod içine yanlışlıkla bir `getUserMedia` çağrısı girse bile bu header onu engeller.

### 3.5 Commander/caller spec
Dosya var mı: **Hayır.** `find . -iname '*commander*' -o -iname '*caller*' -o -iname '*phone*'` (node_modules/.git hariç) sonuç döndürmedi.
Mikrofon planlıyor mu: Böyle bir spec dosyası olmadığı için değerlendirilecek bir şey yok. "Caller" adı yalnızca Mission 2'nin UI ismi (bkz. 3.3), ayrı bir roadmap dokümanı değil.

### SONUÇ
- [x] Production'da ses girişi yok
- [x] Manifest'te mikrofon izni yok (+ `_headers`'ta açıkça kapatılmış, manifestten daha güçlü bir garanti)
- [x] Mission 2 sadece sentez

**DUR koşulları:** Hiçbiri tetiklenmedi (`SpeechRecognition` yok, `getUserMedia` yok).

**Riskli madde:** Yok.

---

## Denetim 2 — Sertifika

**Model:** Sonnet
**Tarih:** 2026-08-07
**DUR koşulu tetiklendi — bkz. 2.2 ve SONUÇ.** Denetim tamamlandı (izleme bitmişti), ama bu bulgudan sonra Denetim 1'e otomatik geçilmedi; karar kullanıcıya bırakıldı.

### 2.1 İsim akış haritası

İki ayrı isim değişkeni var, ayrı kaynaklardan geliyor:

**A) `certNameInput` — sertifikaya yazılan isim**
1. Toplanma: `index.html:749` — `<input id="certNameInput" placeholder="Type child's name (optional)">`, opsiyonel, boş bırakılabilir
2. Okunma: `app.js:762` — `const certNameInput = document.getElementById("certNameInput")`
3. Saklanma: `app.js:2764-2767` (`buildCertificate()`) — her `input` event'inde (`app.js:2804`) `lsSet(CERT_NAME_KEY, raw)` → **sadece `localStorage`** (`app.js:51-55`, doğrudan `localStorage.setItem`, ağ çağrısı yok)
4. Görsele basılma: `app.js:424-477` (`renderSimpleCertificateBlob()`) — `<canvas>` üzerine `ctx.fillText(name, ...)` (satır 453), `canvas.toBlob()` ile PNG blob'a dönüşüyor (satır 473). **Tamamen client-side, sunucuya hiçbir şey gitmiyor.**
5. Geri yüklenme: `app.js:5757-5759` — sayfa açılışında `lsGet(CERT_NAME_KEY)` ile input'a geri yazılıyor (localStorage → DOM, tek yönlü, cihaz içi)

**B) `getActiveProfile().name` — çocuğun profil adı (ayrı bir alan)**
1. Toplanma/saklanma: bu denetimin kapsamı dışında bir profil sistemi (ayrı bir akış); `app.js:3524`'te `getActiveProfile()` ile okunuyor
2. Kullanım: `buildFamilyShareText()` (`app.js:3523-3542`) içinde haftalık aile özeti metnine gömülüyor — `` `🏓 ${name}'s JUMVI progress this week:` `` (satır 3537)

### 2.2 Sunucuya giden veri

**Hiçbir isim `fetch`/`XHR` gövdesine girmiyor.** Bütün kod tabanında (`app.js`, `jumvi-hub-app.js`, `jumvi-redlight.js`) isim ile ilişkili tek bir `fetch(` veya `XMLHttpRequest` çağrısı yok — sertifika/profil akışı ağ isteği içermiyor.

**⚠️ Ancak isim, URL üzerinden üçüncü taraf bir sunucuya (WhatsApp/`wa.me`) gidiyor — iki ayrı yerde:**

| # | Konum | Hangi isim | Tetiklenme koşulu |
|---|---|---|---|
| 1 | `app.js:2968-2994` (`shareCertificateWhatsApp`) | `certNameInput.value` (satır 2970, `namePart`) | Sadece **fallback**: `navigator.share({files:...})` dosya paylaşımını desteklemeyen tarayıcılarda (satır 2994: `window.open(\`https://wa.me/?text=${encodeURIComponent(shareText)}\`, ...)`) |
| 2 | `app.js:3545-3551` (`btnDashShareWA.onclick`) | `getActiveProfile().name` (`buildFamilyShareText()`, satır 3524-3537) | **Her zaman** — bu buton `navigator.share` hiç denemeden doğrudan `wa.me` URL'sine gidiyor (satır 3550) |

Her iki durumda da `encodeURIComponent()` ile URL query string'ine gömülen metin, tarayıcının `wa.me` alan adına (WhatsApp/Meta) yaptığı navigasyon isteğinin bir parçası olarak düz metin halinde o sunucuya ulaşıyor. Bu, JUMVI'nin kendi sunucusuna giden bir veri değil — ama **spec'in DUR koşulu ("çocuğun ismi bir URL'de sunucuya gidiyorsa") bunu literal olarak karşılıyor**, o yüzden burada durup işaretliyorum.

Önemli bağlamsal fark, karar verirken işe yarayabilir:
- Bu, arka planda sessiz çalışan bir telemetri değil — kullanıcının (genelde ebeveynin) elle bastığı bir "WhatsApp'ta Paylaş" butonunun sonucu. Aynı desen (`wa.me/?text=`) hemen hemen her tüketici web uygulamasında var.
- \#1'deki risk zaten kısmen azaltılmış: sadece Web Share API dosya paylaşımını desteklemeyen tarayıcılarda devreye giriyor (çoğu modern iOS/Android Chrome'da hiç tetiklenmez).
- \#2'de böyle bir koruma yok — her tıklamada doğrudan `wa.me`'ye gidiyor.
- Karşılaştırma: `downloadCertificatePNG` (`app.js:2894-2895`) ve `shareCertificate()` (`app.js:2940`) aynı paylaşım ailesinde ama metinleri **jenerik** ("🏆 My JUMVI Champion Certificate!", isim yok) — yani kod tabanında hem isimli hem isimsiz paylaşım metni örnekleri bir arada duruyor, tutarsızlık var.

**İhlal varsa ne yapılmalı (öneri, kod yazılmadı):**
- \#2 (`btnDashShareWA`, her zaman tetikleniyor) için en basit düzeltme: `buildFamilyShareText()`'teki `${name}'s JUMVI progress` yerine zaten var olan generic fallback deyimini (`"Our paddle pro"`) her zaman kullanmak — `ap.name !== "Player"` kontrolünü kaldırıp doğrudan generic ifadeye sabitlemek.
- \#1 (`shareCertificateWhatsApp` fallback) için: `wa.me` fallback yoluna düşüldüğünde `namePart`'ı boş bırakmak (satır 2970-2971), tıpkı `shareCertificate()`'ın zaten yaptığı gibi.
- Alternatif: her ikisinde de önce `navigator.share({text: shareText})` (dosyasız, salt metin) denemek — bu OS paylaşım sayfası üzerinden gider, `wa.me`'ye doğrudan HTTP isteği atmaz. Ama bu da isim OS düzeyinde paylaşım hedefine gitmesini engellemez, sadece taşıma şeklini değiştirir.

### 2.3 OG image
Üretim yeri: **Statik dosya.** `index.html:23` — `<meta property="og:image" content="https://qr.jumvi.co/assets/og/cert-og.jpg" />`
Kişiselleştirilmiş mi: **Hayır.** Sabit bir dosya yolu, query string yok, dinamik üretim yok. Repo genelinde `satori`, `@vercel/og`, `ImageResponse` — hiçbiri bulunamadı (statik PWA, sunucu tarafı render yok).
URL şablonu: Yok — tek, sabit URL.

### 2.4 Paylaşım mekanizması
Yöntem: **Karışık.** Öncelik her yerde `navigator.share({files:[file]})` (Web Share API, dosya olarak) — bkz. `app.js:2892,2945,2982,3037`. Bu desteklenmediğinde:
- Sertifika/skor paylaşımlarının çoğu (`shareCertificate()` `app.js:2950-2953`, skor kartı butonları `app.js:3625-3633`, `app.js:5700-5710`) `navigator.share({url: location.href})` (dosyasız, salt URL+metin, isim içermiyor) veya masaüstünde direkt indirmeye düşüyor.
- İki İSTİSNA (2.2'de detaylı): `shareCertificateWhatsApp` fallback'i ve `btnDashShareWA` — bunlar `navigator.share`'i atlayıp/deneyip başarısız olunca doğrudan `wa.me` URL'sine isim gömerek gidiyor.

Paylaşılan şey: Çoğunlukla **dosya** (PNG/PDF blob). İki istisnada **isim içeren URL**.

### SONUÇ
- [ ] İsim cihazdan çıkmıyor — **HAYIR, iki koşullu durumda çıkıyor** (bkz. 2.2, tablo #1 ve #2)
- [x] OG image generic
- [~] Paylaşım dosya tabanlı — çoğunlukla evet, iki buton hariç (WhatsApp fallback'leri)

**Riskli maddeler:**
1. `app.js:3545-3551` (`btnDashShareWA`) — çocuğun profil adı, koşulsuz olarak `wa.me` URL'sine gidiyor. En yüksek öncelik, çünkü hiçbir tarayıcı/API koşuluna bağlı değil.
2. `app.js:2968-2994` (`shareCertificateWhatsApp`) — sertifika ismi, sadece Web Share dosya desteği olmayan tarayıcılarda `wa.me`'ye gidiyor. Daha düşük öncelik (dar tetiklenme koşulu) ama aynı kalıp.

Öneriler yukarıda 2.2 içinde verildi. **Kod değiştirilmedi**, spec'in kuralı gereği.

**Güncelleme (2026-08-07):** Bu iki konum düzeltildi — paylaşım metinlerinden isim çıkarıldı, git commit: `b548503`. Sertifika görseli ve Copy butonu değişmedi (kasıtlı, kapsam dışı).

## Denetim 1 — Cloudflare Log & IP

**Model:** Sonnet
**Tarih:** 2026-08-07
**DUR koşulu:** Tetiklenmedi.

### 1.1 Logpush durumu
Bulgu: **Config'de yok.**
Kaynak: Repo genelinde `wrangler.jsonc`/`wrangler.toml` mevcut değil (`find . -maxdepth 2 -iname 'wrangler.*'` → sonuç yok, node_modules hariç). Logpush yalnızca Cloudflare hesap/zone seviyesinde ya da bir Workers projesinde `wrangler.toml` üzerinden yapılandırılır; bu repo düz statik dosyalardan oluşan bir Cloudflare Pages sitesi, ne Workers runtime'ı ne de wrangler config'i var.
**Belirsiz kalan kısım:** Bu, repodan Logpush'un **kodla** tetiklenmediğini kanıtlar — ama Cloudflare Dashboard üzerinden zone seviyesinde manuel açılmış bir Logpush job'ı olup olmadığını dosya okuyarak göremem. Bu ayrım zaten spec'in "CLAUDE CODE'UN YAPAMAYACAKLARI" bölümünde tanımlı; manuel kontrol gerekiyor.

### 1.2 Analytics Engine binding
Bulgu: **Yok** — dataset adı: yok (bağlanacak binding mekanizması repoda mevcut değil)
Kaynak: Analytics Engine binding'leri `wrangler.jsonc`/`toml`'daki `analytics_engine_datasets` alanı üzerinden tanımlanır; böyle bir dosya yok. `d1_databases`, `kv_namespaces`, `tail_consumers` için de aynı durum — hiçbiri repoda tanımlı değil (tanımlanacakları dosya yok).

### 1.3 writeDataPoint çağrıları
Bulgu: **Bulunamadı.** Repo genelinde (node_modules/dist/.next hariç) `writeDataPoint` string'i sıfır kez geçiyor — sadece `docs/specs/jumvi-faz0-denetim-spec.md`'nin kendi arama listesinde (bu, denetimin kendi talimat metni, kod değil).
Çağrı yok → blobs[]/doubles[]/indexes[]/kullanıcı-ayırt-edici-alan soruları **uygulanamaz** (N/A).

### 1.4 IP / request.cf erişimi
Bulgu: **Bulunamadı.** `request.cf`, `cf.colo`, `cf.country`, `cf.city`, `cf.latitude`, `cf.longitude`, `CF-Connecting-IP`, `X-Forwarded-For`, `X-Real-IP` — hiçbiri kod tabanında geçmiyor (yalnızca spec dosyasının kendi arama listesinde).
Ek gözlem: Bu sitede sunucu tarafında `request` nesnesini işleyecek bir çalışma zamanı zaten yok — `functions/` klasörü yok, Workers/Pages Functions kullanılmıyor. Yani IP/`request.cf` erişimi için gereken **kod yüzeyi mimari olarak mevcut değil**, sadece "yazılmamış" değil.

### 1.5 Üçüncü taraf beacon
Bulunanlar (spec'in arama listesindeki 9 terim): **yok** — `static.cloudflareinsights.com`, `beacon.min.js`, `clarity.ms`, `googletagmanager`, `google-analytics`, `gtag(`, `fbq(`, `ttq.`, `_hsq` hiçbiri bulunamadı.

⚠️ **Not, dürüstlük için eklendi:** Spec'in arama listesinde olmayan ama gerçekten yüklenen bir üçüncü taraf script var — **Plausible** (`index.html:53`: `<script defer data-domain="qr.jumvi.co" src="https://plausible.io/js/script.tagged-events.js">`). Bunu "bulunamadı" listesine sessizce dahil etmek yanıltıcı olurdu, o yüzden ayrı satırda:
- CSP'de açıkça izinli: `_headers:2` → `connect-src ... https://plausible.io`
- Kullanıcıya açıklanmış: `index.html:712` — "no cookies, no personal information, never tracks your child across other sites or apps"
- `app.js:69-75` (`trackEvent`) → yalnızca `window.plausible(name, {props})` çağırıyor; Denetim 2'de bu `props` içeriği ayrıca tarandı ve isim/PII taşımadığı doğrulandı (bkz. Denetim 2, "SONUÇ" öncesi analiz)
- Spec'in kara listesindeki 9 script (Cloudflare Insights, Clarity, GA, GTM, Meta Pixel, TikTok Pixel, HubSpot) — hiçbiriyle aynı kategoride değil; bunlar genelde fingerprinting/reklam takibi amaçlı, Plausible ise cookie'siz/kimliksiz sayaç. Ama spec'in listesinde olmadığı için bu ayrımı ben yapıyorum — **kullanıcının kendi karar noktası** bu olmalı, "temiz" diye ben etiketlemiyorum.

**Netleştirme (2026-08-07):** `index.html:53` — `data-domain="qr.jumvi.co"` (jumvi.co değil, alt domain etiketleniyor); `src="https://plausible.io/js/script.tagged-events.js"` — self-host değil, script Plausible'ın kendi bulut sunucusundan (`plausible.io`) geliyor.

### 1.6 Observability / tail
Bulgu: **Config'de yok.** `tail_consumers` ve Workers Observability ayarları da `wrangler.jsonc`/`toml` üzerinden tanımlanır; dosya yok, dolayısıyla bağlanacak bir yapı da yok. Dashboard'dan "Workers Logs" açık/kapalı olması ayrı bir zone-seviyesi ayar — manuel kontrol listesinde zaten var (bkz. spec, "CLAUDE CODE'UN YAPAMAYACAKLARI").

### SONUÇ
- [x] Sunucu tarafında kullanıcı kimliği yaratılmıyor (kod seviyesinde — yaratacak bir server-side çalışma zamanı zaten yok)
- [x] IP hiçbir kalıcı depoya yazılmıyor (kod seviyesinde — yazacak API çağrısı yok)
- [~] Üçüncü taraf analytics yok — **spec'in kara listesindeki 9 script yok**, ama Plausible var (bkz. 1.5, zaten kullanıcıya açıklanmış ve CSP'de kayıtlı)

**Riskli maddeler:** Kod seviyesinde yok. Kalan tek belirsizlik kod okuyarak çözülemeyecek türden: Cloudflare Dashboard'daki zone/hesap seviyesi ayarlar (Logpush job'ları, Web Analytics beacon açık/kapalı, Bot Management/WAF log saklama süresi). Bunlar spec'in kendi "CLAUDE CODE'UN YAPAMAYACAKLARI" bölümünde zaten manuel kontrol listesine alınmış — bu denetim onların yerine geçmiyor.

## Manuel Cloudflare Dashboard kontrolleri
*(Henüz yapılmadı)*

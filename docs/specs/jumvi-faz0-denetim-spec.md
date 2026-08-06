# JUMVI — Faz 0 Denetim Spec'i

**Repo:** `owerworld/jumvi-missions` (`~/Developer/jumvi-missions`)
**Tip:** Read-only denetim. Kod değişikliği YOK.
**Amaç:** Analytics pipeline kurulmadan ÖNCE üç veri akışı riskini kapatmak.

---

## GLOBAL KURALLAR

Bu spec'teki üç görev için geçerli:

1. **Hiçbir dosyayı değiştirme.** Sadece oku ve raporla.
2. **Commit atma, branch açma, deploy etme.**
3. Tek çıktı dosyası: `docs/audits/faz0-rapor.md` (yoksa oluştur — bu tek istisna).
4. Her bulgu için **`dosya:satır`** referansı ver. Referanssız bulgu kabul edilmez.
5. Bir şey bulamadıysan "bulunamadı" yaz. **Emin değilsen tahmin etme, "belirsiz" yaz ve nedenini açıkla.**
6. Şu klasörleri okuma: `node_modules/`, `dist/`, `.next/`, `*.glb`, `*.webp`, `*.png`, `*.jpg`, `public/models/`
7. Üç denetim **ayrı session'da** çalıştırılacak. Aralarında `/clear`.

### DUR koşulları

Aşağıdakilerden biri bulunursa **hemen dur**, rapora yaz, devam etme:

- Çocuğun ismi bir `fetch`/`XHR` gövdesinde veya URL'de sunucuya gidiyorsa
- `writeDataPoint` veya benzeri bir çağrıda IP / `CF-Connecting-IP` / `request.cf` alanı yazılıyorsa
- `SpeechRecognition` veya `getUserMedia` production kodunda aktifse

---

# DENETİM 1 — Cloudflare Log & IP Akışı

**Model:** Sonnet
**Neden ilk:** Burada bir sızıntı varsa WAE pipeline'ı baştan farklı kurulacak.

## Kapsam

Aşağıdakileri ara ve her birinin ne yaptığını açıkla:

**Config dosyaları**
- `wrangler.jsonc` / `wrangler.toml` — özellikle: `logpush`, `analytics_engine_datasets`, `observability`, `tail_consumers`, `d1_databases`, `kv_namespaces`
- Cloudflare Pages Functions varsa: `functions/` klasörünün tamamı
- `_headers`, `_redirects`, `_routes.json`

**Kod içinde aranacak string'ler**

```
CF-Connecting-IP
X-Forwarded-For
X-Real-IP
request.cf
cf.colo
cf.country
cf.city
cf.latitude
cf.longitude
writeDataPoint
console.log(request
JSON.stringify(request
new Response(JSON.stringify(
```

**HTML/JS içinde aranacak üçüncü taraf beacon'ları**

```
static.cloudflareinsights.com
beacon.min.js
clarity.ms
googletagmanager
google-analytics
gtag(
fbq(
ttq.
_hsq
```

## Rapor formatı

```markdown
## Denetim 1 — Cloudflare Log & IP

### 1.1 Logpush durumu
Bulgu: [aktif / pasif / config'de yok]
Kaynak: dosya:satır

### 1.2 Analytics Engine binding
Bulgu: [var / yok] — dataset adı:
Kaynak: dosya:satır

### 1.3 writeDataPoint çağrıları
Her çağrı için:
- Konum: dosya:satır
- blobs[] içeriği:
- doubles[] içeriği:
- indexes[] içeriği:
- ⚠️ Kullanıcı ayırt edici alan var mı: [evet/hayır]

### 1.4 IP / request.cf erişimi
Her kullanım için: konum, ne için kullanılıyor, saklanıyor mu

### 1.5 Üçüncü taraf beacon
Bulunanlar: [liste veya "yok"]
⚠️ qr.jumvi.co'da olmamalı.

### 1.6 Observability / tail
Bulgu:

### SONUÇ
- [ ] Sunucu tarafında kullanıcı kimliği yaratılmıyor
- [ ] IP hiçbir kalıcı depoya yazılmıyor
- [ ] Üçüncü taraf analytics yok
Riskli maddeler:
```

---

# DENETİM 2 — Sertifika Veri Akışı

**Model:** Sonnet
**Süre:** ~30 dk
**Soru:** Çocuğun ismi cihazdan çıkıyor mu?

## Kapsam

İsim girişinden başlayıp **tüm yolu izle.** Sadece grep yetmez — akışı takip et.

**Başlangıç noktası:** sertifika / champion / certificate ile ilgili component veya modül.

**Aranacaklar**

```
certificate
champion
playerName
childName
kidName
nameInput
og:image
openGraph
satori
@vercel/og
ImageResponse
navigator.share
canvas.toDataURL
toBlob
encodeURIComponent
searchParams.set
URLSearchParams
```

**Her isim değişkeni için cevapla:**

| Soru | Cevap |
|---|---|
| Nerede toplanıyor? | dosya:satır |
| Nerede saklanıyor? | memory / localStorage / sessionStorage |
| Bir `fetch`/`XHR` gövdesine giriyor mu? | evet/hayır + konum |
| Bir URL'e (query param, path) giriyor mu? | evet/hayır + konum |
| Bir analytics event'ine giriyor mu? | evet/hayır + konum |
| Sertifika görseli nerede üretiliyor? | client canvas / sunucu |
| OG image kişiselleştirilmiş mi? | evet/hayır |
| Paylaşım nasıl? | Web Share (dosya) / URL paylaşımı |

## Hedef mimari (kıyas noktası)

```
İsim girişi
   ↓ (sadece browser memory)
Canvas ile lokal üretim
   ↓
Download veya Web Share API (dosya olarak)
```

Sunucuya gitmemesi gerekenler: isim, sertifika görseli, isim içeren URL, isim içeren event.
OG image gerekiyorsa **generic JUMVI Champion görseli** olmalı.

## Rapor formatı

```markdown
## Denetim 2 — Sertifika

### 2.1 İsim akış haritası
[Giriş noktasından çıkışa kadar adım adım, her adımda dosya:satır]

### 2.2 Sunucuya giden veri
Liste (veya "hiçbir şey"):

### 2.3 OG image
Üretim yeri:
Kişiselleştirilmiş mi:
URL şablonu:

### 2.4 Paylaşım mekanizması
Yöntem:
Paylaşılan şey: [dosya / URL]

### SONUÇ
- [ ] İsim cihazdan çıkmıyor
- [ ] OG image generic
- [ ] Paylaşım dosya tabanlı
İhlal varsa: [dosya:satır + ne yapılmalı — KOD YAZMA, sadece öner]
```

---

# DENETİM 3 — Mikrofon & Ses Girişi

**Model:** Haiku (mekanik tarama)
**Süre:** ~10 dk
**Karar:** v1'de mikrofon girişi YOK. Bu denetim mevcut durumu doğrular.

## Kritik ayrım

| API | Durum |
|---|---|
| `speechSynthesis` / `SpeechSynthesisUtterance` | ✅ SORUN YOK — ses **çıkışı** |
| `SpeechRecognition` / `webkitSpeechRecognition` | ❌ ses **girişi** |
| `getUserMedia({ audio: true })` | ❌ |
| `MediaRecorder` | ❌ |
| `AudioContext.createMediaStreamSource` | ❌ |

Mission 2 (Red Light Green Light) Web Speech API kullanıyor — **sentez** olduğunu doğrula, tanıma değil.

## Aranacaklar

```
SpeechRecognition
webkitSpeechRecognition
getUserMedia
mediaDevices
MediaRecorder
createMediaStreamSource
audio: true
microphone
navigator.permissions
```

Ayrıca kontrol et:
- `manifest.json` → `permissions` alanı
- Herhangi bir `Permissions-Policy` header'ı
- Repo içinde "commander", "caller", "phone" isimli spec/dokuman dosyası var mı — varsa mikrofon planlıyor mu

## Rapor formatı

```markdown
## Denetim 3 — Mikrofon

### 3.1 Ses çıkışı (speechSynthesis)
Kullanım yerleri: [liste]
✅ Sorun yok

### 3.2 Ses girişi
Bulgu: [YOK / VAR]
Varsa: dosya:satır + aktif mi feature-flag'li mi

### 3.3 Mission 2 doğrulaması
Kullanılan API:
Sentez mi tanıma mı:

### 3.4 Manifest / permissions
Bulgu:

### 3.5 Commander/caller spec
Dosya var mı:
Mikrofon planlıyor mu:

### SONUÇ
- [ ] Production'da ses girişi yok
- [ ] Manifest'te mikrofon izni yok
- [ ] Mission 2 sadece sentez
```

---

# CLAUDE CODE'UN YAPAMAYACAKLARI

Bunları Cloudflare Dashboard'dan **manuel** kontrol et:

| Kontrol | Nerede | Beklenen |
|---|---|---|
| Web Analytics beacon | Analytics & Logs → Web Analytics | qr.jumvi.co için KAPALI |
| Logpush job'ları | Analytics & Logs → Logpush | Yok |
| Zone Analytics saklama | Analytics | Varsayılan, uzatılmamış |
| Workers Logs / Observability | Workers → ayarlar | Kapalı veya IP içermiyor |
| Bot Management / WAF logları | Security | IP içeren kalıcı log yok |

Sonuçları `docs/audits/faz0-rapor.md` sonuna elle ekle.

---

# ÇALIŞTIRMA SIRASI

```
Session 1:  /model haiku    → Denetim 3   (~10 dk)
            /clear
Session 2:  /model sonnet   → Denetim 2   (~30 dk)
            /clear
Session 3:  /model sonnet   → Denetim 1   (~45 dk)
            /clear
Manuel:     Cloudflare Dashboard kontrol listesi
```

Her session'ı şöyle başlat:

> `@docs/specs/jumvi-faz0-denetim-spec.md` dosyasındaki GLOBAL KURALLAR'ı ve **DENETİM [N]** bölümünü uygula. Sadece o bölümü. Kod değiştirme.

---

# FAZ 0 SONRASI KARAR NOKTASI

Üç rapor geldiğinde şu üçü netleşmiş olacak:

1. WAE pipeline'ı nasıl kurulacak (Denetim 1)
2. Sertifikada düzeltme gerekiyor mu (Denetim 2)
3. Privacy policy'de "ses toplanmaz" yazılabilir mi (Denetim 3)

**Ancak bundan sonra** Faz 1 build spec'i yazılır.

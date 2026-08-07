# Faz 1 — Görev 1.2: Minimal Beacon (5 Event)

**Branch:** `feat/faz1-beacon` · **Commit:** `43d7283` · **Tarih:** 2026-08-07
**Durum:** ⛔ **Cloudflare Workers Builds bu branch'te BAŞARISIZ.** Kod lokalde tamamen doğrulandı,
ancak `main` entry point'i eklemenin taşıdığı risk **gerçekleşti**. Production'a dokunulmadı ve
merge edilmedi. Ayrıntı ve teşhis yolu: §6.

---

## 1. Mimari — bu görev projeye ilk Worker'ı ekliyor

Spec `env.JUMVI_ANALYTICS.writeDataPoint()` diyor. Bu sunucu tarafı bir API; tarayıcıdan çağrılamaz.
Proje ise bu görevden önce **assets-only** idi: `wrangler.jsonc` içinde `main` yoktu, hiç Worker kodu yoktu.

Bu yüzden 1.2 sadece event eklemek değil, `main` entry point'i eklemek demek:

```
tarayıcı  ──POST /api/beacon──▶  src/worker.js  ──writeDataPoint──▶  WAE (jumvi_events_v1)
                                       │
                                       └── diğer tüm path'ler ──▶ env.ASSETS.fetch()
```

`/api/beacon` bir asset'e karşılık gelmediği için platform isteği Worker'a düşürür; geri kalan her şey
eskisi gibi statik asset olarak servis edilir.

**Değişen dosyalar (sunucu):**

| Dosya | Ne |
|---|---|
| `src/worker.js` | yeni — beacon endpoint + asset geçişi |
| `wrangler.jsonc` | `main`, `assets.binding: "ASSETS"`, `analytics_engine_datasets` |
| `.assetsignore` | `src/` eklendi (worker kaynağı public serve edilmesin) |

---

## 2. WAE şeması — DONDURULDU

`jumvi_events_v1`, binding `JUMVI_ANALYTICS`.

| event | `blob1` | `blob2` | `double1` | `index1` |
|---|---|---|---|---|
| `app_open` | `app_open` | `""` | — | `app_open` |
| `mission_start` | `mission_start` | mission id (string, "1".."36") | — | `mission_start` |
| `mission_complete` | `mission_complete` | mission id (string) | — | `mission_complete` |
| `help_open` | `help_open` | reason (6'lık enum) | — | `help_open` |
| `player_count` | `player_count` | `""` | `2` \| `3` \| `4` | `player_count` |

`help_open.reason` sabit enum, serbest metin **değil**:
`ball_stuck` · `ball_hard_to_remove` · `strap_uncomfortable` · `need_more_space` · `instructions_unclear` · `mission_too_hard`

Bu isimler ve kolon konumları değiştirilirse geçmiş veri bölünür; WAE backfill yapamaz.

### Spec'in snippet'inden iki bilinçli sapma

Spec şunu yazıyordu:

```js
blobs: [eventName, JSON.stringify(props)],
doubles: [Date.now()],
indexes: [eventName]
```

Onaylanan sapma **1 — props JSON string yerine düz kolon.**
JSON string ile 1.3'ün haftalık snapshot'ı `help_open`'ı reason'a göre kıramaz: `GROUP BY blob2`
`{"reason":"ball_stuck"}` gibi string'ler üretir ve sorgu tarafında parse gerektirir. Düz kolonda
`GROUP BY blob1, blob2` doğrudan çalışır.

Onaylanan sapma **2 — `Date.now()` yazılmıyor.**
İki gerekçe: (a) WAE zaten her satıra kendi `timestamp`'ini basıyor, (b) client saati güvenilmez.
Ayrıca `double1`'i `player_count.n` için serbest bırakıyor.

---

## 3. Event tetikleme noktaları

| # | Event | Dosya:satır | De-dupe |
|---|---|---|---|
| 1 | `app_open` | [`app.js:4162`](../../app.js) | session başına 1 |
| 2 | `mission_start` | [`app.js:2540`](../../app.js) (`openMission`) | session içinde **mission başına** 1 |
| 3 | `mission_complete` | [`app.js:3270`](../../app.js) (`markMissionDone`) | fonksiyonun kendi `done.has(id)` guard'ı |
| 4 | `help_open` | [`app.js:4231`](../../app.js) | **yok, kasıtlı** — aynı sorun farklı mission'da tekrar sinyaldir |
| 5 | `player_count` | [`app.js:4202`](../../app.js) (tıklama) ve [`app.js:2547`](../../app.js) (kayıtlı değer) | session başına 1 |

Yardımcılar: `beacon()` [`app.js:107`](../../app.js), `beaconOnce()` [`app.js:127`](../../app.js).

**`mission_start` neden `openMission()`?** Start butonu opsiyonel — timer kullanmadan oynayan çocuk az
değil. Sheet'in açılması tek güvenilir sinyal. Aynı mission'a geri dönmek ikinci start saymaz, yoksa
completion ratio gürültüye döner.

**`player_count` neden session başına 1?** Spec'in 1.3 örneğinde `40+12+22 = 74 = app_opens`.
Yani tasarım gereği app_open ile 1:1. Önceki oturumda seçim yapmış bir kullanıcı için mission
açılışında kayıtlı değer bir kez sayılır — tekrar sormaya gerek kalmaz.

### Yeni UI

Her ikisi de mission sheet'in içinde, **bloklamıyor** (spec: mission seçiminden önce blocking ekran yok):

- **Player count** — [`index.html:596`](../../index.html), Start butonunun hemen üstünde inline satır (`2 / 3 / 4+`). Atlanabilir.
- **Help** — [`index.html:655`](../../index.html), "Something not working?" → 6 sabit seçenek. Her seçenek çocuğa anında bir ipucu gösteriyor (`HELP_TIPS`, [`app.js:4172`](../../app.js)), yani UI sadece event üretmek için var değil.
  Paneli **açmak** event değildir; sadece bir reason **seçmek** event üretir — boş merak dataset'e sahte problem raporu olarak düşmez.

### `trackEvent()`'e neden dokunulmadı

`app.js`'te Plausible döneminden kalma ~45 `trackEvent()` çağrısı var ve Faz 0'dan beri hepsi ölü
(`window.plausible` artık tanımlı değil). Bunları beacon'a bağlamak tek satırlık bir değişiklik olurdu
ama ilk gün 5 event kuralını çöpe atardı. `trackEvent()` ölü bırakıldı, beacon ayrı ve allowlist'li.

---

## 4. Gizlilik doğrulaması

**"IP / cihaz kimliği yazılmadığını doğruladım."**

Kanıt üç katmanlı:

### (a) Worker'da hiçbir kimlik alanı okunmuyor

Yorumlar tamamen soyularak:

```
$ nocomment src/worker.js | grep -Ei "cf-connecting-ip|x-forwarded-for|user-agent|request\.cf|
    referer|cookie|fingerprint|uuid|randomUUID|navigator\.(userAgent|platform|language)|
    screen\.(width|height)|Date\.now|timestamp"
  → eşleşme YOK ✅

$ nocomment app.js 81 137   # beacon yardımcı bloğu, aynı desen
  → eşleşme YOK ✅
```

Worker `request.cf`, `CF-Connecting-IP`, `User-Agent`, `Referer` veya cookie'ye hiç dokunmuyor;
`request.text()` dışında istekten bir şey okumuyor.

### (b) Gönderilen props'ların tam listesi (grep değil, tam sayım)

`app.js`'teki **tüm** beacon çağrıları:

```
beaconOnce("mission_start_" + id, "mission_start", { id: id })
beaconOnce("player_count",        "player_count",  { n: savedN })
beacon(                           "mission_complete", { id: id })
beaconOnce("app_open",            "app_open")
beaconOnce("player_count",        "player_count",  { n: n })
beacon(                           "help_open",     { reason: reason })
```

Yedi çağrı, üç props alanı: `id` (1–36 integer), `n` (2/3/4), `reason` (6'lık enum). Başka alan yok.

### (c) Telde ne gittiğinin canlı kaydı

`navigator.sendBeacon` araya girilerek gerçek tarayıcı oturumundan yakalanan payload'lar:

```
1. /api/beacon  {"e":"app_open"}
2. /api/beacon  {"e":"mission_start","id":3}
3. /api/beacon  {"e":"player_count","n":4}
4. /api/beacon  {"e":"help_open","reason":"need_more_space"}
5. /api/beacon  {"e":"help_open","reason":"strap_uncomfortable"}
6. /api/beacon  {"e":"mission_start","id":7}
7. /api/beacon  {"e":"mission_complete","id":7}
```

Her payload: `e` + en fazla bir skaler. UUID yok, timestamp yok, cihaz alanı yok.

**Not:** `app.js` genelinde `Date.now()` ve `navigator.userAgent` geçen satırlar var (timer'lar, iOS
tespiti). Bunlar bu görevden önce de vardı ve beacon yoluna değmiyorlar — (b)'deki tam sayım bunu
kapsıyor.

---

## 5. Doğrulama sonuçları

### Şema + reddetme testi — `tools/check-beacon-schema.mjs`

`buildDataPoint()` saf fonksiyon olarak export edildiği için kolon düzeni Worker çalıştırmadan
sabitlenebiliyor. Endpoint geçerli ve geçersiz payload'a **aynı** 204'ü döndürüyor (dışarıdan allowlist
probe edilemesin diye), bu yüzden HTTP status kanıt değil — yazma sayısı doğrudan ölçülüyor:

```
$ node tools/check-beacon-schema.mjs
Accepted events — frozen column layout:      5/5 ok
All six help_open reasons accepted:          6/6 ok
Rejected (must all be null):                12/12 ok
fetch handler — only allowlisted payloads reach WAE:
  ok    write count (5 valid + 5 invalid)     → 10 istek, 5 yazma
  ok    no extra columns ever emitted
  ok    GET /api/beacon rejected              → 405
  ok    non-beacon path falls through to assets
✅ beacon schema OK
```

Reddedilenler arasında: bilinmeyen event adı, serbest metin reason, `n=5`, `n="3"`, `id=0`,
`id=99999`, `id=1.5`, `id="1"`, bozuk JSON, dizi/string payload, 512 bayttan büyük gövde.

### `wrangler dev` duman testi

```
env.JUMVI_ANALYTICS (jumvi_events_v1)      Analytics Engine Dataset      local
env.ASSETS                                 Assets                        local
Ready on http://localhost:8799
```

Her iki binding de çözüldü — `main` eklendikten sonra config parse ediliyor ve Worker derleniyor.

| İstek | Sonuç |
|---|---|
| 5 geçerli event (POST) | 204 ✅ |
| 4 geçersiz event (POST) | 204 ✅ (kasıtlı, yazma yok) |
| `GET /api/beacon` | 405 ✅ |
| `/`, `/app.js`, `/style.css`, `/service-worker.js` | 200, doğru Content-Type ✅ |
| `/index.html` | 307 → 200 (platformun standart `.html` → `/` davranışı, worker'dan bağımsız) |
| `/yok-boyle-bir-sey` | 404 ✅ (assets-only ile aynı) |

### Tarayıcı doğrulaması

Chrome, 375×812 mobil viewport, açık + koyu tema. Konsolda hata yok.

De-dupe davranışı — 11 kullanıcı aksiyonu → 7 beacon:

| Aksiyon | Beacon |
|---|---|
| aynı mission'ı 2. kez aç | gönderilmedi ✅ |
| player count 4 → 2 değiştir | gönderilmedi ✅ |
| aynı mission'ı 2. kez complete et | gönderilmedi ✅ |
| farklı mission aç | gönderildi ✅ |
| 2. help reason seç | gönderildi ✅ (kasıtlı) |

### Cache tutarlılığı

`app.js` / `style.css` / `index.html` CORE_ASSETS'te olduğu için:
`CACHE_NAME` v167 → **v168**, `?v=` sorguları `20260807-1`, `tools/core-assets.lock` yeniden kilitlendi.

```
$ ./tools/check-core-assets.sh
OK: CORE_ASSETS unchanged (CACHE_NAME=jumvi-missions-v168)
```

---

## 6. ⛔ DEPLOY BAŞARISIZ — karar sizde

Öngörülen risk gerçekleşti. `feat/faz1-beacon` push edildi, Cloudflare Workers Builds tetiklendi
ve **başarısız oldu**.

```
$ gh api repos/owerworld/jumvi-missions/commits/43d7283/check-runs
Workers Builds: jumvi-missions = failure   [00:04:34 → 00:04:34]
Cloudflare Pages               = success   [00:04:15 → 00:04:15]

# karşılaştırma — main'deki son başarılı commit (81f0ddb):
Workers Builds: jumvi-missions = success   [23:40:25 → 23:40:25]
```

Build ID: `e9837a9e-d0fb-4f31-a7fa-543b687e5139`
Log: dash.cloudflare.com → Workers → jumvi-missions → Builds → bu build ID.

### Production etkilenmedi

```
$ curl https://qr.jumvi.co/            → 200
$ curl https://qr.jumvi.co/app.js      → 200, "api/beacon" geçmiyor (0 eşleşme)
$ curl https://qr.jumvi.co/service-worker.js → CACHE_NAME = "jumvi-missions-v167"
```

Canlı hâlâ v167, beacon kodu yok. `POST /api/beacon` → 405, ki bu zaten assets-only Worker'ın
POST reddi — yeni Worker canlıda değil. `main` branch'ine dokunulmadı.

Ayrıca Görev 1.1'in health-check workflow'u bu commit için **skipped** oldu — check suite başarısız
olduğu için gate açılmadı. Yani 1.1 tasarlandığı gibi çalıştı: başarısız deploy'un ardından canlıya
karşı kontrol çalıştırmadı.

### İkinci deneme — Analytics Engine etkinleştirildikten sonra (2026-08-07 18:23)

Hesapta AE etkinleştirildi (dashboard'da "Setup Analytics Engine" boş durumu, dataset elle
oluşturulmadı — binding ilk yazmada oluşturur). Aynı ağaç boş commit `821368e` ile yeniden
tetiklendi:

```
Workers Builds: jumvi-missions = failure
Build ID: 521f3f71-5943-471f-a3e7-966acb9b1c4b
```

**Aynı hata.** Yani Analytics Engine'in kapalı olması sebep DEĞİLDİ — yukarıdaki (b) hipotezi elendi.
Production yine dokunulmadı (v167, `app.js`'te `api/beacon` yok, site 200).

### Düzeltme — "0 saniyede reddedildi" çıkarımı yanlıştı

İlk raporda build'in `started_at == completed_at` olmasına dayanarak "build başlamadan reddedildi"
denmişti. Bu yanlış: main'deki **başarılı** build'in de `started_at == completed_at` (23:40:25 →
23:40:25). Bu alanlar build süresini değil, sonucun GitHub'a yazıldığı anı gösteriyor. Build gerçekten
çalışıyor — poll sırasında ~40 saniye `in_progress` gözlendi — ve sonra başarısız oluyor. Süreden
hiçbir sonuç çıkarılamaz.

### Nedeni ne DEĞİL — lokalde elenenler

| Hipotez | Durum |
|---|---|
| Config parse edilmiyor / `main` bulunamıyor | ❌ elendi — `wrangler dev` iki binding'i de çözdü, Worker derlendi |
| Bundling hatası | ❌ elendi — `wrangler deploy --dry-run` geçiyor (hem 4.61.1 hem 4.119.0 ile) |
| Analytics Engine'in plan gereksinimi | ❌ elendi — docs: Workers **Free** plan'a dahil (100.000 yazma/gün) |
| AE'nin hesapta kapalı olması | ❌ elendi — etkinleştirildikten sonra da aynı hata |
| Non-prod komutunun (`versions upload`) config'i reddetmesi | ❌ elendi — `versions upload --dry-run` temiz geçiyor |
| `src/` dosyalarının asset olarak yüklenmesi | ❌ elendi — `.assetsignore`'da |

```
$ npx wrangler@4.119.0 deploy --dry-run
✨ Read 462 files from the assets directory
Total Upload: 2.30 KiB / gzip: 1.01 KiB
env.JUMVI_ANALYTICS (jumvi_events_v1)      Analytics Engine Dataset
env.ASSETS                                 Assets
--dry-run: exiting now.
```

### Geriye kalan — log olmadan ilerlenemiyor

İki denemeden sonra lokalde test edilebilecek her hipotez elendi. `wrangler dev`, `deploy --dry-run`
ve `versions upload --dry-run` üçü de temiz; AE artık açık. Hata yalnızca Cloudflare'in build
ortamında görünüyor ve **build log'u olmadan daha fazla daraltılamaz.**

En olası kalan aday: **non-production branch build'lerinin kapalı veya yanlış yapılandırılmış olması**
(Settings → Build). İkincil aday: dashboard'da tanımlı bir build komutunun bu repoda karşılığı
olmaması — repoda `package.json` yok, dolayısıyla `npm ci` / `npm run build` türü bir komut
başarısız olur. `main` entry eklenmeden önce bu fark etmemiş olabilir.

### Neden burada durdum

Ayırt etmenin yolu, binding'i çıkarıp tekrar push ederek bisect etmek. Bunu **yapmadım**: bu hesapta
branch build'inin production deploy komutuyla mı yoksa `versions upload` ile mi yapılandırıldığını
göremiyorum. Yanlış yapılandırılmışsa **başarılı** bir branch build'i doğrudan canlıya çıkabilir.
Bu geri alması zor bir işlem ve sizin kararınız.

### Sıradaki adımlar — sizin çalıştırmanız gerekenler

1. **Build log'unu açın:** dash.cloudflare.com → Workers → `jumvi-missions` → Builds →
   `e9837a9e-d0fb-4f31-a7fa-543b687e5139`. İlk hata satırı (a) ile (b) arasında kesin ayrım yapar.
2. **Settings → Build**'de iki şeyi kontrol edin:
   - non-production branch build'leri açık mı,
   - non-production deploy komutu ne — `wrangler versions upload` olmalı, `wrangler deploy` **olmamalı**.
     `deploy` ise branch build'i canlıya çıkar; düzeltilmeden tekrar denenmemeli.
3. Sebep (b) çıkarsa — AE hesapta kapalıysa — bana söyleyin; beacon'ı geçici olarak
   `writeDataPoint` yerine başka bir hedefe almak veya AE'yi açtırmak seçenekleri var.

Alternatif, GitHub'ı hiç kullanmayan yol: yerelde `wrangler login` sonrası

```bash
npx wrangler versions upload
```

Bu preview version üretir, production'a promote etmez ve gerçek hatayı terminalde gösterir.
Hesabınızda kimlik doğrulaması gerektirdiği için **sizin** çalıştırmanız gerekiyor — bu makinede
wrangler oturumu yok (`wrangler whoami` → "Not logged in") ve `CLOUDFLARE_API_TOKEN` tanımlı değil.

### Karar

**`main`'e merge EDİLMEMELİ.** Branch push edilmiş durumda, kod hazır, tek eksik deploy'un neden
reddedildiği. Sebep anlaşıldığında düzeltme muhtemelen tek satırlık bir config değişikliği olacak.

---

## 7. Kapsam dışı bırakılanlar

- `trackEvent()`'in ~45 ölü çağrı yeri — dokunulmadı (bkz. §3).
- 1.3'ün `tools/generate-weekly-snapshot.js`'i — ayrı görev.
- Privacy policy güncellemesi — Görev 1.4. **Beacon canlıya çıkmadan önce yapılmalı**: bu iş
  politikanın şu an bahsetmediği bir veri toplama başlatıyor.
- Slack/email uyarısı — spec'te açıkça kapsam dışı.

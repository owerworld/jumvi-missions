# Faz 1 — Görev 1.2: Minimal Beacon (5 Event)

**Branch:** `feat/faz1-beacon` · **Tarih:** 2026-08-07
**Durum:** Kod tamam, lokal olarak doğrulandı. **Canlı Cloudflare pipeline'ından geçtiği HENÜZ DOĞRULANMADI** — bkz. "Test edilmemiş risk".

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

## 6. TEST EDİLMEMİŞ RİSK — karar sizde

Görev 1.1'in asset monitor'ü deploy **sonrasını** kontrol ediyor; buradaki risk deploy'un **kendisinde**.

### Risk

`wrangler.jsonc`'a `main` eklemek, bu repoda daha önce "Missing entry-point" deploy hatasına yol açan
sınıfla aynı mimari değişiklik. Lokalde `wrangler dev` sorunsuz çalışıyor ama bu Cloudflare Workers
Builds'in aynı sonucu vereceğini **kanıtlamıyor**.

### Ne doğrulanabildi, ne doğrulanamadı

| | Durum |
|---|---|
| Analytics Engine plan gereksinimi | ✅ Cloudflare docs: Workers **Free** plan'a dahil (100.000 data point/gün, 10.000 sorgu/gün). Plan engeli yok. |
| AE binding'in bu **hesapta** gerçekten açık olması | ❌ **Doğrulanamadı** — makinede `wrangler` oturumu yok (`wrangler whoami` → "Not logged in"), `CLOUDFLARE_API_TOKEN` da tanımlı değil. Uzak doğrulama yapılamadı. |
| `main` ile config'in parse edilip Worker'ın derlenmesi | ✅ lokal `wrangler dev` |
| Gerçek Cloudflare deploy'unun geçmesi | ❌ **Doğrulanmadı** |

### Workers Builds preview durumu

Workers Builds non-production branch build'lerini destekliyor: production dışı bir dal için deploy
komutu `npx wrangler versions upload` ile değiştiriliyor ve bir preview URL üretiliyor. Ancak bu
**dashboard'dan açılması gereken opsiyonel bir ayar** ("Configure non-production branch builds",
Settings → Build). Bu ayarın bu Worker'da açık olup olmadığını hesap erişimi olmadan göremiyorum.

### Öneri

`main`'e merge **edilmedi**. Sırasıyla:

1. Cloudflare dashboard → Worker `jumvi-missions` → Settings → Build → non-production branch build'lerin
   açık olduğunu doğrulayın. Kapalıysa açın.
2. `feat/faz1-beacon` için bir build tetiklenip **success** olduğunu görün. Bu, `main` entry riskini
   production'a dokunmadan kapatır.
3. Preview URL'de `POST /api/beacon` → 204 ve sayfanın normal açıldığını teyit edin.
4. Ancak ondan sonra merge kararı.

Non-production build açılamıyorsa alternatif: yerelde `wrangler login` sonrası `npx wrangler versions upload`
— preview version üretir, production'a promote etmez. Bu komut hesabınızda kimlik doğrulaması gerektirdiği
için sizin çalıştırmanız gerekir.

**Bu risk kapanana kadar `main`'e merge edilmemeli.**

---

## 7. Kapsam dışı bırakılanlar

- `trackEvent()`'in ~45 ölü çağrı yeri — dokunulmadı (bkz. §3).
- 1.3'ün `tools/generate-weekly-snapshot.js`'i — ayrı görev.
- Privacy policy güncellemesi — Görev 1.4. **Beacon canlıya çıkmadan önce yapılmalı**: bu iş
  politikanın şu an bahsetmediği bir veri toplama başlatıyor.
- Slack/email uyarısı — spec'te açıkça kapsam dışı.

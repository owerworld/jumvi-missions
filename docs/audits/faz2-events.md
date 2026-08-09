# Faz 2 — Görev 2.1: 16 Ölçüm Noktasını Bağla

**Branch:** `feat/faz2-arge` · **Tarih:** 2026-08-08
**Durum:** ✅ 21 event bağlandı, 19'u gerçek tarayıcıda uçtan uca doğrulandı.
`main`'e merge edildi (`2d1ea37`, 2026-08-09) ve canlıda doğrulandı — bkz. §6b.

Geliştirme sırasındaki doğrulama `wrangler dev`'in varsayılan **lokal** modunda yapıldı ve canlı
`jumvi_events_v1` dataset'ine tek satır yazmadı; iş bitiminde çalıştırılan sorgu bunu doğruladı
(16 satır, değişmemiş). Production doğrulaması ise bilerek **yazdı** — penceresi §6b'de kayıtlı.

---

## 1. Sayı: spec 14 diyor, tablo 16 satır

Spec'in başlığı ve GLOBAL KURAL 2 "14 event" diyor, tablosu 16 satır listeliyor: 15 ve 16
(`app_first_open`, `return_visit`) ayrı bir bölümde gerekçelendirilmiş. 16'sı da bağlandı.
Faz 1'in 5'iyle birlikte allowlist **21 event**.

---

## 2. Ne nereye bağlandı

### Mevcut `trackEvent` noktalarına eklenenler (8)

`trackEvent()` çağrıları **silinmedi**; beacon çağrısı yanlarına kondu. Spec "yeni hook yazma,
mevcutları yönlendir" diyor — kastedilen tetikleme noktası, ve GLOBAL KURAL 5 `trackEvent`'in ölü
kalmasını istiyor, kaldırılmasını değil. Envanter olduğu gibi duruyor.

| Mevcut çağrı | Yeni event | Yer |
|---|---|---|
| `Pack Completed` | `pack_complete {pack}` | app.js |
| `Coach Pick Tapped` (2 yer) | `daily_pick_tap` | `#coachPickCard`, `#dailyAlt` |
| `Read Aloud Toggled` | `speak_on` — **yalnızca açılışta** | `#profileTtsBtn` |
| `Score Recorded` | `score_saved` | app.js |
| `Profile Added` | `profile_add` | app.js |
| `Progress Reset` | `progress_reset` | `#btnReset` (1200 ms basılı tutma) |
| `Dashboard Share ×3` | `share_tap {whatsapp\|native\|copy}` | app.js |
| `Hub3D Entered / Load Failed / Load Escaped / Mission Completed` | `hub3d {entered\|failed\|escaped\|mission}` | app.js |

### Yeni hook'lar (8)

| Event | Yer | Not |
|---|---|---|
| `pack_view {pack}` | Mission Path pack başlığı, IntersectionObserver | aşağıda §3 |
| `badge_earned {badge}` | `showBadgeUnlockModal(badge)` | 11'lik enum, isim değil id |
| `certificate_made` | `openCertificate()` | `buildCertificate()` değil: o her tuş vuruşunda ve profil geri yüklemesinde de çalışıyor |
| `timer_start {id}` | `startTimer()` | `_openMissionId` eklendi — startTimer sayaç geri sayımından çağrılıyor ve görev id'sini görmüyordu |
| `dashboard_open` | `switchTab("stats")` | dashboard = **stats** sekmesi |
| `missionbook_get` | `a[href="mission-book.pdf"]` (2 bağlantı) | `sendBeacon` sayfa gitse de hayatta kalır, navigasyon engellenmiyor |
| `hub3d {shown}` | `initBottomNav()`, cihaz destekliyorsa | huninin ilk basamağı |
| `hub3d {ready}` | `onFirstFrame()` | ilk boyanan kare = hub gerçekten kullanılabilir |
| `hub3d {moved}` | `track` köprüsü, `Hub3D First Walk` | hub kendi yürüyüşünü bildiriyor |
| `app_first_open`, `return_visit {n}` | `app_open`'ın yanı | §4 |

---

## 3. `pack_view` — planlanan bağlantı noktası ölü UI çıktı

Plan `renderFilters()` içindeki pack filtre chip'lerine bağlamaktı. Uygulama sırasında görüldü ki
**`#filters` `index.html`'de `display:none` ve app.js onu hiçbir yerde göstermiyor** — eski liste
görünümünden kalma ölü UI. Oraya bağlanan `pack_view` sonsuza kadar sıfır okurdu ve sağlıklı
görünürdü: dataset'te satır yok, kod incelemesinde hook var.

Bugün bir paket gerçekte **Mission Path**'te geziliyor — çocuğun kaydırdığı dikey pack bölümleri.
`pack_view` oraya taşındı, `IntersectionObserver` ile, `threshold: 0.5`.

Gözlenen eleman **pack başlığı**, bölümün tamamı değil. Bölüm izlense daha doğal görünür ve sessizce
bozuk olurdu: altı görevlik bir bölüm telefon ekranından uzun, dolayısıyla `0.5` eşiği hiçbir zaman
sağlanamazdı. Ölçüldü — bölüm 1163 px, viewport 812 px. Başlık 44 px, eşik ne diyorsa o.

---

## 4. Erişim ve tutundurma — `app_first_open` / `return_visit`

`app_open` **oturum** sayıyor. "Kaç kişi" diye okunursa iki yönde birden yanıltır: aynı hane salı günü
tekrar gelirse iki, tek telefonu paylaşan iki çocuk bir sayılır. Tek sayıyı düzeltmek yerine üç ayrı
soru üç ayrı sayıyla cevaplanıyor: erişim (`app_first_open`), kullanım (`app_open`), tutundurma
(`return_visit`).

**Cihazda ne var, telde ne gidiyor.** Sayaç `localStorage`'da (`jumvi_seen`, `jumvi_visits`) ve
cihazdan hiç çıkmıyor. UUID, parmak izi, kimlik üretilmiyor. Sunucu "bir cihaz 3. ziyaretine ulaştı"
bilgisini alıyor, **hangi** cihaz olduğunu değil; iki ziyareti birbirine bağlayamıyor. Eşikler arası
(4., 6., 7.) hiçbir şey gitmiyor.

`localStorage` kapalıysa ikisi de **gönderilmiyor**: her oturum "ilk ziyaret" gibi görünüp erişimi
şişirir ve sahte tutundurma üretirdi. Boşluk dürüst, yanlış sayı değil.

**Dürüstlük etiketi.** `app_first_open` kesin kullanıcı sayısı değildir: tarayıcı verisi
temizlenirse cihaz yeniden yeni sayılır, iki telefonlu hane iki sayılır. 2.2'nin metodoloji notuna ve
2.3 panelinde bu sayının yanına **"yönsel tahmin"** olarak taşınmalı.

---

## 5. Gizlilik doğrulaması

**"IP / cihaz kimliği / çocuk adı yazılmadığını doğruladım."**

### (a) Worker'da hiçbir kimlik alanı okunmuyor

`src/worker.js` Faz 1'den beri `request.text()` dışında istekten bir şey okumuyor; `request.cf`,
`CF-Connecting-IP`, `User-Agent`, `Referer`, cookie hiç geçmiyor. Faz 2 yalnızca allowlist'e
`case` ekledi — yeni bir okuma yolu açmadı.

### (b) Kolon düzeni payload'dan değil, worker'dan geliyor

`buildDataPoint()` her event için kolonları **kendisi** kuruyor; client'ın gönderdiği fazladan alan
hiçbir yere yazılamaz. Bu bir iddia değil, test:

```
Extra props are dropped, never written:
  ok    profile_add carrying a child name    → blobs: ["profile_add", ""]
  ok    app_open carrying an id              → blobs: ["app_open", ""]
  ok    no child name reached any column
  ok    no age reached any column
```

### (c) Canlı kanıt — gerçek tarayıcıda ad yazıldı, payload'a girmedi

Profil sheet'ine **"Ada"** yazılıp "+ Add Child" tıklandı. Giden:

```
{"e":"profile_add"}          → props: null
```

Ad, yaş, avatar: hiçbiri yok. Spec'in "bu event'in tek amacı çoklu çocuk özelliği yaşıyor mu"
kuralı telde de böyle.

### (d) Tüm payload'lar tek skaler

Yakalanan her gövde `e` + en fazla bir skaler:
`{"e":"pack_view","pack":"Aim Master"}` · `{"e":"timer_start","id":1}` ·
`{"e":"return_visit","n":2}` · `{"e":"badge_earned","badge":"first"}`

---

## 6. Doğrulama sonuçları

### Şema testi — `tools/check-beacon-schema.mjs`

```
Faz 2 — frozen column layout:        8/8 ok
All six pack keys accepted:          6/6 ok
All eleven badge ids accepted:      11/11 ok
All seven hub3d steps accepted:      7/7 ok
Prop-less events emit empty blob2:   8/8 ok
Extra props are dropped:             4/4 ok
Rejected (must all be null):        24/24 ok
fetch handler:  22 geçerli + 9 geçersiz → 31 istek, 22 yazma
✅ beacon schema OK
```

Reddedilenler arasında: enum dışı pack key (`all`), görünen ad (`Bullseye!`), slug (`aim-master`),
uydurma badge, `hub3d {step:"exited"}`, eşik dışı `return_visit {n:4}`, string `timer_start {id:"12"}`,
ve `review_prompt_shown` — spec'in bilinçli olarak bağlamadığı Amazon yorum istemi event'i.

### Gerçek tarayıcı — `wrangler dev`, 375×812 mobil

19 event canlı ateşlendi ve payload'ı yakalandı:

| Event | Yakalanan |
|---|---|
| `app_open` | oturum guard'ı yazıldı |
| `app_first_open` | `{"e":"app_first_open"}`, sayaç 1'den başladı |
| `return_visit` | `{n:2}` ✅ · 4. ziyaret **sessiz** ✅ · `{n:10}` ✅ |
| `pack_view` | `Aim Master`, `Team Duo`, `Reflex Rush` |
| `mission_start` | `{id:1}`, `{id:2}`, `{id:11}` |
| `player_count` | `{n:3}` |
| `timer_start` | `{id:1}` |
| `help_open` | `{reason:"strap_uncomfortable"}` |
| `mission_complete` | `{id:1}` |
| `badge_earned` | `{badge:"first"}` |
| `certificate_made` | `{}` |
| `dashboard_open` | `{}` |
| `missionbook_get` | `{}` |
| `share_tap` | `{channel:"whatsapp"}` |
| `daily_pick_tap` | `{}` |
| `speak_on` | açılışta ✅, kapanışta **0** ✅ |
| `profile_add` | `{}` — §5(c) |
| `progress_reset` | `{}` (1200 ms hold) |
| `hub3d` | `{step:"shown"}`, `{step:"entered"}`, `{step:"ready"}` |

**Tekrar kuralları:**

| Aksiyon | Sonuç |
|---|---|
| aynı görevi 2. kez aç + aynı zamanlayıcıyı yeniden başlat | **0 event** ✅ |
| farklı görev aç | `mission_start {id:2}` ✅ |
| `daily_pick_tap` 2. dokunuş | **0 event** ✅ |
| read-aloud kapat | **0 event** ✅ |

### Canlı çalıştırılamayanlar — dürüst liste

| Event | Neden |
|---|---|
| `pack_complete` | bir paketin 6 görevini de bitirmek gerekiyor |
| `score_saved` | skor kaydetme butonu test oturumunda "Preparing…" durumundaydı |
| `share_tap {native,copy}` | native paylaşım ve pano yazma headless panelde çalışmıyor |
| `hub3d {moved, mission, failed, escaped}` | 3D içi yürüyüş / hata yolları |

Bunların hepsi şema testinde geçiyor ve bağlandıkları `trackEvent` noktaları kodda mevcut; eksik olan
yalnızca canlı tetikleme. **Launch öncesi gerçek cihazda bir kez geçilmeli.**

### Test ortamı notu — IntersectionObserver

Headless tarayıcı paneli boyamadığı sürece `IntersectionObserver` hiç callback üretmiyor (taze bir
observer bile ateşlenmiyor, `innerHeight` 0 dönüyor). `pack_view` ancak panel ekran görüntüsüyle
boyandığında ateşledi. Bu bir kod sorunu değil, ölçüm ortamının sınırı — ama `pack_view`'in gerçek
cihazda kaydırmayla ateşlendiği launch öncesi teyit edilmeli.

---

## 6b. Production doğrulaması — 2026-08-09

`main`'e merge edildi (`2d1ea37`), Cloudflare build'inin beş check'i de success. Canlıda:
`CACHE_NAME = jumvi-missions-v170`, `app.js?v=20260808-3`, `packViewObserver` servis edilen
`app.js`'te mevcut, `docs/` ve `tools/` → 404, `GET /api/beacon` → 405, `POST` → 204.

### `pack_view` gerçek cihazda ateşliyor — headless'ta doğrulanamayan tek şey

§6'da not edilmişti: headless panel boyamadığı sürece `IntersectionObserver` hiç callback
üretmiyor. Bu yüzden canlıda gerçek tarayıcıyla, 375×812 mobil viewport'ta, depolama temizlenmiş
"yeni cihaz" olarak Mission Path kaydırıldı. **Kaydırma ile dört paket başlığı görüş alanına girdi
ve dördü de event üretti:**

```
01:34:10  pack_view  Aim Master
01:34:35  pack_view  Team Duo
01:34:48  pack_view  Indoor Compact
01:35:05  pack_view  Reflex Rush
```

Focus Control ve Beach/Park başlıkları iki boyama arasında geçtiği için ateşlemedi — aynı headless
sınırı, gerçek bir çocuğun telefonunda geçerli değil.

### TEST PENCERESİ — snapshot'ta dışlanacak

```
2026-08-09 01:32:12 – 01:35:21 UTC   10 satır
```

| Event | n | Not |
|---|---|---|
| `app_first_open` | 2 | depolama iki kez temizlendi; gerçek "yeni cihaz" sayısını 2 şişirir |
| `app_open` | 2 | |
| `hub3d {shown}` | 2 | |
| `pack_view` | 4 | yukarıdaki dört paket |

Bu haftanın (2026-W33) snapshot'ı üretilirken:

```bash
node tools/generate-weekly-snapshot.mjs --week 2026-33 --since 2026-08-09T01:36:00Z
```

…**yalnızca** bu pencereyi dışlamak istiyorsan yeterli değil: `--since` bir taban değerdir, öncesindeki
her şeyi keser. Aşağıdaki açık maddeyle birlikte karara bağlanmalı.

### AÇIK MADDE — 2026-08-08'de kaynağı belirlenemeyen 70 satır

Bu görevin sonunda dataset 16 satırdı. Production doğrulamasına başlarken **86** satırdı:

```
2026-08-07   16 satır   Faz 1 test verisi (docs/audits/faz1-snapshot.md §3)
2026-08-08   70 satır   12:44:51 – 19:41:04 UTC  ← kaynağı belirlenemedi
2026-08-09   10 satır   yukarıdaki test penceresi
```

70 satır **Faz 2 event'leri içeriyor** (`pack_view`, `badge_earned`, `hub3d`, `app_first_open`,
`pack_complete`, `timer_start`, `dashboard_open`). Ama o saatlerde Faz 2 kodu production'da değildi
ve `feat/faz2-arge` uzağa hiç push edilmedi — yani preview deployment da yoktu. Bu satırlar bu
oturumdaki çalışmadan da gelmiyor: buradaki doğrulama `wrangler dev`'in varsayılan lokal modunda
yapıldı ve iş bitiminde çalıştırılan sorgu hâlâ 16 satır döndürüyordu.

**Kısmen açıklığa kavuştu — [`docs/audits/wrangler-dev-analytics-engine.md`](wrangler-dev-analytics-engine.md).**
Varsayılan `wrangler dev` Analytics Engine'i her zaman no-op simüle eder (kod düzeyinde ve resmi
dokümantasyonla doğrulandı) — bu **kesin**. Gerçek dataset'e lokal makineden ulaşmanın tek yolu
kodda `wrangler dev --remote` (`-r`), ama bu mekanizma bu hesapta **test edilip çalışmadığı
doğrulandı** — `error 1031, Invalid Workers Preview configuration` ile düşüyor, bilinen açık bir
wrangler sorunu ([workers-sdk#10773](https://github.com/cloudflare/workers-sdk/issues/10773)).
Yani en olası aday hâlâ budur ama *o gün gerçekten çalıştığı* kanıtlanamadı; mekanizma tam
doğrulanmış değil.

**Karar hâlâ gerekiyor:** bu 70 satır gerçek kullanıcı verisi mi, test mi? Testse ilk gerçek
haftalık snapshot bu pencereyi de dışlamalı, yoksa `app_first_opens` ve tüm özellik sayıları şişer.

---

## 7. Cache disiplini

`app.js` CORE_ASSETS'te: `CACHE_NAME` v169 → **v170**, `app.js?v=` → `20260808-3`,
`tools/core-assets.lock` yeniden kilitlendi. `./tools/check-core-assets.sh` → OK.

Test sırasında bir tuzak: `?v=` sabit kalırken `app.js` iki kez değişti ve tarayıcı ara sürümü
HTTP cache'inden servis etti — kod değişmiş gibi görünmezken aslında eski dosya çalışıyordu.
Service worker de aynı şeyi yapıyordu (v170 cache'i kaydolmuştu). Yerel doğrulamada SW'yi kaldırıp
`?v=`'yi ilerletmek gerekti.

---

## 8. Kapsam dışı

- Kalan ~31 ölü `trackEvent` çağrısı — dokunulmadı (GLOBAL KURAL 5).
- **Amazon yorum istemi** (`reviewHeading`, `review_prompt_*`) — spec'in açık kararı gereği
  bağlanmadı. Şema testi bu event'i açıkça reddediyor.
- `.claude/launch.json`'a worker'lı dev sunucu girdisi eklendi (repo içi). Preview aracı
  `~/Desktop` cwd'sinden çalıştığı için oradaki config'e de bir girdi eklendi — repo dışı, session
  kolaylığı.

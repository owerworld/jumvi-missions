# Faz 1.4 + 1.5 — mission state machine, timer, gate, completion, Undo

**Branch:** `claude/jumvi-visual-accessibility-k92evo`
**Başlangıç:** `39db613` · **Tarih:** 2026-08-24
**Kapsam:** görev oynatma state'i, timer/countdown/gate, completion ve Undo.
UI redesign yok, yeni renk sistemi yok, yeni ürün özelliği yok.

---

## 1. Kod envanteri

| Alan | Gerçek yer | Mevcut davranış |
|---|---|---|
| Mission open/close | `openMission()` / `closeMission()` | Açılışta `stopMissionCoach()`, `stopLeoSpeakSteps()`, `cancelTimerCountdown()`, sonra `_openMissionId = id`, `missionOpenedAt = Date.now()`, `resetTimerUI()` |
| Timer state | `timerState` (`idle`/`running`/`paused`), `timerTotal`, `timerLeft`, `timerEndAt`, `timerInterval` | Tek `setInterval(updateTimerTick, 200)`; kalan süre her tick'te `timerEndAt - Date.now()` ile yeniden hesaplanıyor |
| Countdown | `showCountdownThenStart()`, `cancelTimerCountdown()`, `timerCountdownToken` | Her countdown başlarken token artıyor; interval ve timeout callback'leri hem token'ı hem `_openMissionId`'yi doğruluyor |
| Narration | `playMissionNarration()`, `_missionNarrationPending`, `_missionNarrationToken`, watchdog | İlk Start tap'i narration'ı başlatıyor, buton `Skip & Play` oluyor; countdown ancak narration bitince |
| Gate | `MISSION_GATE_MIN_S=45`, `MISSION_GATE_CEIL_S=75`, `missionGateMsFor()`, `missionGateRemainingMs()`, `_timerFinishedFor` | `min(max(görevSüresi,45),75)`; `Time's Up` veya `done` gate'i anında açıyor. Memory-only, yeni storage key yok |
| Manual completion | `btnToggleDone.onclick` → gate kontrolü → `markMissionDone(id,"manual")` | Gate kapalıysa `showToast` + `updateToggleDoneGateUI()`, hiçbir mutation yok |
| Auto completion | `updateTimerTick()` içinde `autoDoneOnEnd` ise `markMissionDone(id,"auto")` | Varsayılan **kapalı** (`jumvi_auto_done_v1`, default `"0"`); Grown-ups'taki toggle'dan geliyor |
| Undo | `captureJourneySnapshot()` / `restoreJourneySnapshot()` / `showUndoBar()` | Snapshot `markMissionDone` mutasyondan **önce** alınıyor; `restoreLsRaw()` `cancelLsDebounced()` çağırıyor |
| XP | `xpFromDoneSet(done)` | Ayrı yazılmıyor — `done` set'inden türetiliyor, yani `done`'dan çıkarmak XP'yi de geri alıyor |
| Team/personal scope | `_PROGRESS_PREFIX` = takım aktifse takım prefix'i, değilse profil prefix'i | Anahtar namespace'i ayrı |

**Mission 2** (`Red Light, Green Light`) standart timer kullanmıyor: `btnStartTimer.onclick`
`window.JumviRedLight.start()` çağırıyor, buton `Start Caller`. Ayrı akış olarak korundu.

## 2. State modeli — ne değişti, ne değişmedi

Spec `playFinished`'i `idle`'dan ayırmayı istiyor. Bu ayrım kodda **zaten var**, sadece
`timerState` üzerinde değil: `_timerFinishedFor` set'i "bu görevin timer'ı sonuna kadar
çalıştı"yı taşıyor, `done` seti kalıcı completion'ı taşıyor, `timerState` yalnızca
interval'in canlı olup olmadığını. Spec "mevcut isimleri koruyabilirsin; davranış ayrımı
sağlamalı" diyor ve davranış testlerle doğrulandı (T13, T16, T20). `timerState`'e üçüncü
bir string eklemek `setTimerButtonLabel`, `toggleTimer`, `resumeTimer` ve `resetTimerUI`'yi
aynı anda değiştirmeyi gerektirirdi; kanıtlanmış bir kusur olmadan bunu yapmadım.

## 3. Bulunan ve düzeltilen iki kusur

### 3.1 Undo penceresi kapanınca yetki kapanmıyordu

`showUndoBar()` beş saniye sonra yalnızca `bar.hidden = true` yapıyordu. Bu barı gizliyor
(`.undoBar[hidden]{display:none}`) ama `#undoBtn`'in `onclick`'i bağlı, snapshot closure'da
canlı kalıyordu. Beş saniyelik söz **görünürlük** hakkındaydı, **yetki** hakkında değil:
süre dolduktan sonra butona ulaşan bir tıklama completion'ı hâlâ geri alıyordu.

Ölçüldü (T22, düzeltmeden önce): süre dolduktan sonra `done 1→0`, `xp 10→0`.

`_undoOffer` eklendi — hangi completion'a ait olduğunu tutan tek kayıt. `endUndoOffer()`
hem barı gizliyor hem teklifi null'lıyor; handler `_undoOffer.id !== id` ise hemen dönüyor.
Yeni bir completion eski teklifi devralıyor, yani süresi geçmiş bir snapshot yanlış göreve
uygulanamıyor.

### 3.2 Aynı ekranda iki farklı saat

Completion butonu gate kapalıyken `After you play (Xs)` yazıyordu. X gate'in kalanı; oyun
halkası ise timer'ın kalanını sayıyor. Mission 1'de ikisi de 45s olduğu için aynı görünüyor.
Uzun görevlerde ayrışıyor — ölçüldü:

| Görev | Oyun halkası | Buton (eski) |
|---|---:|---|
| 1 Speed Demon | 42/45s | `After you play (38s)` |
| 24 2v2 Squad Count | 207/210s | `After you play (68s)` |
| 36 Marathon Rally | 177/180s | `After you play (68s)` |

Mission 24'te ekranda 207 ve 68 yan yana, hangisinin ne olduğunu söyleyen bir şey yok.
İngilizce copy `Play for about Xs more` oldu: halka oyunun ne kadar süreceğini, buton
bitirmenin ne zaman sıradaki adım olacağını söylüyor. **Türkçe string'e dokunulmadı** —
o rota bu turda kapsam dışı.

## 4. Test aracı

`tools/check-mission-play-state.mjs` — iki salt-okunur seam:

- **interval sayımı:** `window.setInterval`/`clearInterval`, app.js parse edilmeden önce
  sarmalanıyor. "Çift timer yok" böylece çıkarım değil, gerçek bir sayı.
- **play probe:** `window.__jumviPlayProbe()` (app.js) script-scope state'i döndürüyor.
  `let` binding'leri window'a çıkmaz; bu olmadan bir sürücü ancak render edilmiş metni geri
  okuyabilir, yani state'i değil kelimeleri test eder. Probe hiçbir çocuk adı, profil adı,
  sertifika adı veya cihaz tanımlayıcısı taşımıyor (T32).

```
npx http-server -p 8910 -c-1
node tools/check-mission-play-state.mjs
node tools/check-mission-play-state.mjs --only=T03,T18
```

### Testin kendisi üç kez yanlıştı — kaydı

Bunları yazmak, uygulamayı düzeltmekten daha uzun sürdü ve üçü de "uygulama bozuk" diye
raporlanabilirdi:

1. **T02 fail, T03 pass** — tek Start tap'i timer'ı başlatmıyor, narration başlatıyor; üç
   tap narration'ı atlayıp countdown'a geçiyor. Düz 3.6s bekleyen test narration'ı ölçüyordu.
   `startUntilRunning()` yardımcısı gerçek akışı takip ediyor.
2. **T18 fail** — ikinci tap "double completion" değil, butonun kendi `Mark as Not Done`
   toggle'ı. Gerçek tehlike aynı tick'teki iki tıklama; test o hâle getirildi ve T21'i
   kirletmemesi için kendi session'ına alındı.
3. **T27 fail** — takım fixture'ım `partner` alanı taşımıyordu, `normalizeJumviTeams()` onu
   atıyor ve uygulama sessizce solo prefix'e düşüyordu. Uygulamanın değil, fixture'ın hatası.

## 5. T01–T32

| ID | Sonuç | Kanıt |
|---|---|---|
| T01 clean open | PASS | `timerState=idle`, 0 interval, countdown yok |
| T02 single Start | PASS | `running`, 1 interval, `timerTotal=45` (veriden) |
| T03 double/triple tap | PASS | 1 interval |
| T04 narration active | PASS | `narrationPending=true`, `timerState=idle`, 0 interval |
| T05 skip narration | PASS | tek countdown, narration iptal |
| T06 close during countdown | PASS | 0 interval, `idle` |
| T07 switch during countdown | PASS | `missionId=3`, 0 interval, `timerTotal=0` |
| T08 running consistency | PASS | gösterilen `43s` = `timerLeft` = `timerEndAt`'ten türetilen |
| T09 pause | PASS | 0 interval, kalan 1.6s boyunca 44 |
| T10 resume | PASS | 1 interval, 44'ten devam |
| T11 repeated pause/resume | PASS | interval hiç yığılmıyor |
| T12 background/return | PASS | 4s gizli → `timerLeft 45→41`, `timerEndAt` değişmedi |
| T13 Time's Up | PASS | interval 0, `timerFinishedFor=[1]`, `doneSize=0` |
| T14 gate closed | PASS | done/xp/streak/undo mutation yok |
| T15 dwell gate | PASS | `gateTotal=45000` = `min(max(45,45),75)` |
| T16 gate by timer | PASS | `gateRemainingMs=0` |
| T17 manual completion | PASS | done 0→1, xp 0→10, Undo açıldı |
| T18 iki tıklama tek tick | PASS | çift XP yok, tekrarlı id yok |
| T19 auto completion | PASS | `autoDoneOnEnd=true` → tam bir completion |
| T20 completed replay | PASS | xp 10→10 |
| T21 Undo | PASS | done/xp/streak/bestStreak/lastActive hepsi geri |
| T22 Undo after expiry | PASS | **düzeltmeden sonra**; öncesinde done 1→0 |
| T23 double Undo | PASS | no-op |
| T24 Undo + reward takeover | PASS | bar görünür ve hit-test'te üstte |
| T25 Undo after reload | PASS | completion kalıyor, memory-only teklif bitiyor |
| T26 Mark as Not Done later | PASS | görev geri, streak günü korunuyor (§5.4) |
| T27 personal/team isolation | PASS | solo `[1]`, takım namespace'i boş |
| T28 mission 2 caller | PASS | çift start yok, geçişte overlay kalmıyor |
| T29 3D hub completion | **SKIP** | `openMissionFromHub` flag olmadan tanımlı değil — test edilmedi, geçti değil |
| T30 offline | PASS | sheet, timer, gate, local progress çalışıyor |
| T31 console/runtime | PASS | temiz |
| T32 log privacy | PASS | 22 alan, hiçbiri isim benzeri |

**31 pass, 0 fail, 1 skip.**

## 6. Regresyon

Önceki turların altı kontrolü de yeniden çalıştırıldı, hepsi yeşil: schema 36/36, onboarding
12/12, kontrol erişilebilirliği, SC 1.4.11, metin kontrastı 0/4634, ikon glyph'leri.

## 7. Bilinen / ertelenen

- **T29 3D Hub** test edilmedi. Hub lazy ve flag arkasında; `openMissionFromHub` normal
  açılışta tanımlı değil. Doğru mission ID ile completion iddiası **kanıtlanmadı**.
- **Landscape'te completion butonu** ilk viewport'ta ekran altında kalıyor (568×320 ve
  844×390). Sheet scroll ediyor: `scrollIntoView` sonrası görünür ve tıklanabilir
  (hit-test doğrulandı). Erişilemez değil, ama ilk bakışta görünmüyor.
- **`timerState` üçüncü bir `playFinished` değeri almadı** — gerekçe bölüm 2'de.
- **Family sekmesindeki streak metni** Undo'dan sonra sekmeye dönene kadar eski değeri
  gösterebiliyor. State doğru; yalnızca o kartın render'ı sekme aktivasyonuna bağlı.
  Undo bütünlüğü kusuru değil, bu turda düzeltilmedi.

## 8. Breaking change

Yok. Görev ID'leri, pack anahtarları, localStorage anahtarları ve v1 yedek formatı aynı.
Yeni storage key eklenmedi. `window.__jumviPlayProbe` salt okunur.

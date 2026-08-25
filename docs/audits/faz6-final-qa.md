# Faz 6 — Final QA: Erişilebilirlik, Responsive, Runtime ve Production-Readiness

**Branch:** `claude/jumvi-visual-accessibility-k92evo`
**Baseline commit:** `a815147`
**Kapsam:** yalnızca İngilizce ana rota. `/tr/` bu turda hiç açılmadı, hiç değiştirilmedi.

Bu tur yeni bir tasarım turu değil. Amaç, JUMVI'nin gerçek aile kullanımına hazır olup
olmadığını **kanıtlamak**; yalnızca gerçek tarayıcı testinde kanıtlanmış kusurları
düzeltmek; ve ölçülemeyen hiçbir maddeyi "pass" saymamak.

---

## 1. Baseline

```
$ git branch --show-current
claude/jumvi-visual-accessibility-k92evo

$ git log --oneline -12
a815147 Make the failure paths tell the truth: install, offline, update, reset, 3D
57bce60 Give Family a way to start, and the dialogs the contract they claim
8b5dd7e Make the mission sheet say something about the mission
217cf1b Prove T29 against the real hub, and fix the three bugs that surfaced
8d87fab Close the Undo window for real, and stop showing two clocks at once
39db613 Document the P0 and WCAG round
024abd8 Remove the dead search/filter UI and the silent narrowing it hid
fa02562 Measure SC 1.4.11, give focus a ring that survives both themes
210f067 Fix the onboarding CTA occlusion, restore zoom, explain the play levels
54303cb Fix WCAG AA contrast failures without touching the palette
28ebe65 Merge pull request #35 from owerworld/claude/edge-no-store-fix
528251d Force no-store on document responses to stop edge re-caching stale HTML

$ git status --short && git diff --stat
(temiz)
```

---

## 2. Gerçek envanter

Koda dokunmadan önce çıkarıldı; her satır repository'nin gerçeğidir, varsayım değildir.

| Alan | Gerçek dosya/fonksiyon | Mevcut davranış | Test yöntemi |
|---|---|---|---|
| Entry/build | `index.html` (1599 satır), `app.js` (9515), `style.css` (8768), `warm-toy.css` (5457), `data.js` (306) — build adımı yok, klasik `<script defer>` | Tek sayfa, framework yok | `npx http-server -p 8910 -c-1` + Playwright |
| Service worker | `service-worker.js`, `index.html:1540` `register("/service-worker.js?v=…", {updateViaCache:"none"})` | Cache + `reg.update()` yarışı, 8s tavan | `check-install-offline-update-reset.mjs` (U01–U06) |
| 4 tab navigation | `switchTab()` `app.js:8005`, `initBottomNav()` `app.js:8360` | `today/browse/modes/profile` (+ opt-in `hub3d`) | `check-responsive-matrix.mjs`, `check-runtime-health.mjs` |
| Dialog/modal layer | `enhanceDialog()` `app.js:1256`, `handleDialogKeys()` `app.js:1298`, `dialogFocusable()` `app.js:1295` | 12 yüzey `aria-modal="true"` ilan ediyor | **`check-dialog-contract.mjs` (yeni)** — DOM'dan okuyarak |
| Keyboard/focus | global `:focus-visible` (`warm-toy.css`), `_missionReturnFocus` `app.js:1167`, `_profileReturnFocus` | Escape + trap + focus return | `check-dialog-contract.mjs`, `check-a11y-controls.mjs` |
| Responsive CSS | `style.css` + `warm-toy.css`; landscape bloğu `warm-toy.css` `@media (max-height:460px) and (orientation:landscape)` | Portrait height-gate dışında etkilenmez | `check-responsive-matrix.mjs` (6 viewport) |
| Theme/motion | `applyTheme()`, `prefersReducedMotion`, `@media (prefers-reduced-motion: reduce)` | Tema 3 durumlu, motion azaltılıyor | **`check-motion-liveregions.mjs` (yeni)** |
| Mission state | `openMission()` `app.js:4756`, `closeMission()` `app.js:5170`, `window.__jumviPlayProbe()` `app.js:3981` | timer/gate/completion/Undo | `check-mission-play-state.mjs` (T01–T32) |
| Progress/localStorage | `_PP = "jumvi_"+getActiveProfileId()+"_"` `app.js:823`, `_PROGRESS_PREFIX` `app.js:1036`, `TEAM_PROGRESS_SUFFIXES` `app.js:850` | Takım aktifken takım prefix'i, değilse çocuk | **`check-persistence-flow.mjs` (yeni)** |
| Install/update/reset | `installState()`, `btnCheckUpdate`, `doReset()` `app.js:6148` | 5 install durumu, 6 update durumu, hold-to-reset | `check-install-offline-update-reset.mjs` |
| 3D fallback | `showHub3D()` `app.js:7902`, `hub3dWebGLOk()` `app.js:7606`, `applyHub3dUnsupported()` `app.js:7615` | WebGL yoksa reddet + kartı gizle | `check-hub-fallback.mjs` (H01–H06) |
| Analytics | `BEACON_ENDPOINT="/api/beacon"` `app.js:164`, `src/worker.js:25` | `navigator.sendBeacon`, Cloudflare Worker | **`check-runtime-health.mjs` (yeni)** R6.7 |
| Mevcut QA araçları | `tools/check-*.mjs` — 10 adet, hepsi çalıştırıldı | — | §6 test matrisi |

Bu turda üretilen **beş yeni ölçüm aracı**:

```bash
npx http-server -p 8910 -c-1                     # yerel sunucu

export JUMVI_PW=/opt/node22/lib/node_modules/playwright
export JUMVI_EXE_CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome

node tools/check-dialog-contract.mjs      # 6A.2  12 aria-modal yüzeyinin sözleşmesi
node tools/check-zoom-textresize.mjs      # 6A.3  SC 1.4.4 %200 + SC 1.4.10 reflow
node tools/check-motion-liveregions.mjs   # 6A.4  reduced motion + canlı bölge trafiği
node tools/check-responsive-matrix.mjs    # 6B    6 viewport × 4 yüzey, hit-test
node tools/check-runtime-health.mjs       # 6C.1  console/network/asset + gizlilik
node tools/check-persistence-flow.mjs     # 6C.2  scope ve kalıcılık yolculuğu
```

---

## 3. Bulunan gerçek bug ve yapılan tek minimal düzeltme

### P1 — Mission sheet Escape'te focus'u `<body>`'ye düşürüyordu

Uygulamanın en çok kullanılan dialog'u, kapanırken focus'u geri vermiyordu. Diğer 11
yüzeyin hepsi veriyordu; yalnızca bu vermiyordu.

**Ölçüm** (`check-dialog-contract.mjs`, Missions sekmesindeki gerçek bir görev kartından
klavyeyle açıp Escape'e basarak):

```
openedFrom=FIRST_VISIBLE_MISSION firstFocus=#btnClose
Tab out=never · Shift+Tab out=never
Escape closed=true · focus after=body.tab-browse · returnedToOpener=false
```

**Kök neden** — tahmin değil, ölçüldü:

```
rememberedWasOpener=true      ← açan kart doğru hatırlanmıştı
openerConnected=false         ← ama düğüm artık DOM'da değildi
btnDailyPlayRects=0           ← ve yedek hedefin kutusu yoktu
→ activeAfter = BODY
```

`closeMission()` focus'u `requestAnimationFrame` içinde geri veriyor, ama hemen ardından
`renderMissionPath()` çağrılıyordu ve o, listeyi baştan kuruyor. rAF çalıştığında
hatırlanan düğüm çoktan koparılmıştı. Yedek olan `btnDailyPlay` ise Today sekmesinde
yaşıyor; Missions görünürken kutusu yok. İki koruma da sessizce başarısız oluyor ve
focus `<body>`'ye düşüyordu. Today sekmesinden açıldığında sorun hiç görünmüyordu —
`#btnDailyPlay` kendi yeniden render'ından sağ çıkıyor.

**Kullanıcıya maliyeti:** klavye veya ekran okuyucu kullanan bir ebeveyn, 36 görevlik
listede bir görevi her kapattığında belgenin en başına atılıyor ve header ile nav'ı tekrar
geçmek zorunda kalıyordu.

**Düzeltme** (`app.js`, `closeMission()`): focus geri verme artık yeniden render'lardan
**sonra** çalışıyor ve hedef bir düğüm referansı olarak tutulmak yerine görev id'siyle
yeniden çözülüyor — yani kullanıcı, taze listede tam da bıraktığı yere dönüyor.

**Doğrulama:**

```
Escape closed=true · focus after=#pathNodeNext · returnedToOpener=re-rendered same mission card
```

Bu turda uygulama kodunda yapılan **tek** değişiklik budur.

### Kanıtlanmış ama düzeltilmeyen: 320×568'de Undo bar "Next" butonunun üstüne biniyor

**Ölçüm** (`check-responsive-matrix.mjs`, tamamlama sonrası, scroll edilmemiş gerçek
yerleşim):

| Viewport | `#btnNext` | `undoBar` | Next'in dikey örtülme oranı | Next'in bir kısmı tıklanabilir mi |
|---|---|---|---|---|
| **320×568** | 419–475 | **436–496** | **%69** | evet (sağ kenardan) |
| 390×844 | 557–613 | 712–772 | %0 | evet |
| 430×932 | 601–657 | 800–860 | %0 | evet |
| 568×320 | 297–353 | 188–248 | %0 | evet |
| 844×390 | 332–388 | 258–318 | %0 | evet |
| 768×1024 | 647–703 | 892–952 | %0 | evet |

Yalnızca en küçük ekranda, 5 saniye boyunca, iki **zıt anlamlı** kontrol üst üste
biniyor: "Next" ileri gider, "Undo" az önce kazanılan tamamlamayı geri alır. Next'in
ortasına nişan alan bir parmak Undo'ya basar.

**Neden düzeltmedim — ve bu bir varsayım değil, ölçüm:** `.undoBar` viewport'a sabit ve
`bottom: calc(72px + safe-area)` ile konumlanıyor; bu 72px, modal açıkken zaten gizlenen
bottom nav'a göre ayarlanmış. Denediğim her tek-değerli düzeltmeyi altı viewport'ta da
hesapladım ve hepsi örtüşmeyi **kaldırmıyor, başka bir viewport'a taşıyor**:

| Aday `bottom` | 320×568 | 568×320 landscape |
|---|---|---|
| mevcut `72px` | %69 örtüşme | %0 |
| `16px` | %0 ✓ | Next'in üstünü 7px keser ✗ |

Yani bu, tek satırlık bir CSS düzeltmesi değil; undo bar'ın mission sheet'in kendi aksiyon
satırına göre konumlanmasını gerektiren bir yerleşim kararı. Bu turun kapsamı "yalnızca
kanıtlanmış P0/P1" ve "gereksiz redesign yapma". Bu bir P2: tek viewport, 5 saniye, ve
buton hâlâ tıklanabilir durumda. **Ürün kararına bırakıldı**, ölçümleriyle birlikte
yukarıda duruyor.

---

## 4. Faz 6A — Erişilebilirlik son denetimi

### 6A.2 Dialog focus sözleşmesi — 12/12 yüzey

Yüzey listesi elle yazılmadı: araç DOM'dan `[aria-modal="true"]` sorgulayıp kendi
kapsamını karşılaştırıyor (`D00`), yani sonradan eklenen bir modal bu testi sessizce
atlayamaz. Her adım gerçek klavye girdisiyle sürüldü (`page.keyboard.press`), uygulamanın
kendi handler'ları çağrılarak değil.

| Yüzey | İlk focus | Tab dışarı | Shift+Tab dışarı | Escape kapattı | Focus döndü | Sonuç |
|---|---|---|---|---|---|---|
| `backdrop` Mission sheet | `#btnClose` | asla | asla | ✓ | aynı görevin yeniden render edilmiş kartı | **pass** |
| `profileBackdrop` Kids & Settings | `#btnProfileClose` | asla | asla | ✓ | `#avatarBtn` | pass |
| `privacyBackdrop` | `#btnPrivacyClose` | asla | asla | ✓ | `#privacyLink` | pass |
| `helpBackdrop` | `#btnHelpClose` | asla | asla | ✓ | `#helpSupportLink` | pass |
| `badgesBackdrop` | `#btnBadgesClose` | asla | asla | ✓ | `#btnBadgesRow` | pass |
| `certBackdrop` | `#btnCertClose` | asla | asla | ✓ | `#helpSupportLink` | pass |
| `fallbackBackdrop` | `#fallbackCloseBtn` | asla | asla | ✓ | `#avatarBtn` | pass |
| `teamXpBackdrop` | `#teamXpClose` | asla | asla | ✓ | `#avatarBtn` | pass |
| `badgeUnlockModal` | `#badgeUnlockClose` | asla | asla | ✓ | `#avatarBtn` | pass |
| `installDlg` (iPhone UA) | `#btnInstallDlgClose` | asla | asla | ✓ | `#btnKeepOnPhone` | pass |
| `welcomeOverlay` | `button.ageBtn` | asla | — | tasarımı gereği yok | — | pass |
| `seasonalBackdrop` | — | — | — | — | — | **emekli yüzey** |

**`welcomeOverlay`** ilk açılış yüzeyi: arkasında dönülecek bir şey olmadığı için Escape
ile kapanmıyor. Bu bir eksik değil, bilinçli bir tasarım; test bunu ayrı bir sözleşmeyle
ölçüyor (sayfayı kaplıyor mu, Tab dışarı çıkabiliyor mu).

**`seasonalBackdrop` ("Where to Play")** state ile değil, stylesheet ile kapatılmış:
`#seasonalCard{display:none !important}` tek giriş noktasını, `.seasonalBackdrop,
#seasonalBackdrop{display:none !important}` da dialog'un kendisini gizliyor — `.show`
sınıfı eklense bile boyanamıyor (ölçüldü: `class="backdrop show"` iken `display=none`,
`rects=0`). Hiçbir kullanıcı yolu oraya ulaşmıyor, dolayısıyla focus sözleşmesi geçerli
değil. Ölü markup; yerinde bırakıldı, çünkü silmek bir QA düzeltmesi değil refactor olur.

Uzun modal içeriği: mission sheet'te `sheetBody` gerçekten scroll ediyor (`sheetScrolls=true`,
altı viewport'ta da), sticky footer içeriği örtmüyor ve close sonrası focus görünmeyen bir
elemana gitmiyor (§3'teki düzeltmeden sonra).

### 6A.3 Zoom, %200 metin ve reflow — 14/14

| ID | Kontrol | Ölçüm | Sonuç |
|---|---|---|---|
| Z01 | Pinch zoom engellenmiyor | `viewport="width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content"` · `touch-action` html/body = `manipulation` · gesture `preventDefault=false` · touchmove `preventDefault=false` | pass |
| Z02 | Input'lar ≥16px (iOS focus zoom'u olmasın) | 1 görünür input ölçüldü, 16px altında yok | pass |
| Z03 | **SC 1.4.4** — kök font 16→32px, dört sekme | hard-clip=0, ellipsis=0, CTA örtüşmesi=0, yatay scroll=false (4/4 sekme) | pass |
| Z04 | %200 metinde mission sheet kontrolleri | `btnStartTimer=reachable` `btnClose=reachable` · hard-clip=0 | pass |
| Z06 | %200 metinde her primary kontrol hit-test | today 5, modes 6, profile 8 kontrol — **hiçbiri bloke değil** | pass |
| Z05 | **SC 1.4.10** reflow — 320px (≈%400 zoom) | yatay taşma **0px** (4/4 sekme) | pass |

`maximum-scale`, `user-scalable=no`, JS gesture guard veya `touch-action:none` **yok**.

Ekranlar: `docs/audits/screens/faz6/text200-{today,browse,modes,profile}.png`,
`text200-mission-sheet.png`, `reflow320-today.png`.

### 6A.4 Reduced motion ve canlı bölgeler — 6/6

| ID | Ölçüm | Sonuç |
|---|---|---|
| M01 | `prefers-reduced-motion=true` · hâlâ dönen sonsuz animasyon = **0** | pass |
| M02 | Reduced motion'da 36 görev, sheet açılıyor, timer çalışıyor (`timerState=running`) | pass |
| M03 | Reduced motion'da tamamlama **metinle** duyuruluyor: `"MISSION COMPLETE Great job! +20 XP 0 → 20 XP"` · undo teklif ediliyor | pass |
| M04 | 10 saniyelik gerçek oyun boyunca canlı bölge **duyuru** sayısı: `missionPlayPanel=0` (ham DOM mutasyonu 10) | pass |
| M05 | `#playPanelDial aria-hidden=true` ama sayı gerçek bir kontrolde: completion butonu `"Play for about 69s more"` | pass |
| M06 | Tamamlama ve Undo **duyuruluyor**: `missionXpReward=1, statusLive=1` | pass |

M04'ün ayrımı önemli: `#playPanelDial` saniyede bir yeniden yazılıyor (10 saniyede 10
mutasyon) ama `aria-hidden="true"` olduğu için erişilebilirlik ağacına hiç ulaşmıyor.
Bölgenin **erişilebilir metni 10 saniye boyunca bir kez bile değişmedi** — ölçülen tek
sürüm: `"Playing now Eyes on the ball! Put the phone down — Leo will let you know. Leo is
counting the rally — keep playing."` Yani Faz 3'te konan çözüm gerçekten çalışıyor.

---

## 5. Faz 6B — Responsive: 6 viewport × 4 yüzey, hepsi hit-test edilerek

**24 pass, 0 fail.** Her iddia `document.elementFromPoint()` ile kontrolün kendi merkezinde
bitiyor — "kutusu var" ile "parmak değebiliyor" ayrı şeyler.

| Viewport | 4 sekme (clip / yatay taşma / nav) | Mission sheet kontrolleri | Family ilk aksiyonlar | Profile Save/Cancel |
|---|---|---|---|---|
| 320×568 P | pass · clip 0, taşma 0 | pass | pass | pass |
| 390×844 P | pass · clip 0, taşma 0 | pass | pass | pass |
| 430×932 P | pass · clip 0, taşma 0 | pass | pass | pass |
| 568×320 L | pass · clip 0, taşma 0 | pass | pass | pass |
| 844×390 L | pass · clip 0, taşma 0 | pass | pass | pass |
| 768×1024 P | pass · clip 0, taşma 0 | pass | pass | pass |

**Family ilk aksiyonlar** (Faz 5'te yapılan landscape düzenlemesinin korunduğunun kanıtı):

| Viewport | `Pick a Mission` | `Add a player` | nav üst kenarı |
|---|---|---|---|
| 320×568 | top=93, ilk viewport'ta, **tıklanabilir** | top=254, ilk viewport'ta, **tıklanabilir** | 496 |
| 568×320 | ilk viewport'ta, **tıklanabilir** | ilk viewport'ta, **tıklanabilir** | 267 |

568×320'de aksiyonların durum bilgisinden önce gelmesi Faz 5'te alınan bilinçli karardı;
bu turda **gerçek tıklanabilirliği** hit-test ile kanıtlandı, sadece görünürlüğü değil.

Landscape sıkıştırma kuralı yalnızca `@media (max-height:460px) and (orientation:landscape)`
ile kapılı; 320×568, 390×844, 430×932 ve 768×1024 portrait ölçümlerinde clip ve taşma
sıfır olduğu için portrait'in bozulmadığı doğrulandı.

Ekranlar: `docs/audits/screens/faz6/{320x568,390x844,430x932,568x320,844x390,768x1024}-*.png`
(sekme başına biri, artı `-mission-playing`, `-mission-done`, `-family`, `-profile-edit`).

---

## 6. Faz 6C — Runtime, kalıcılık ve production-readiness

### 6C.1 Runtime sağlığı ve gizlilik — 7/7

| ID | Ölçüm | Sonuç |
|---|---|---|
| R6.1 | Temiz profil, ilk açılış: welcome görünüyor · **app exception 0** · unhandled rejection 0 | pass |
| R6.2 | 4 sekme + 36 görev + sheet · app exception 0 · rejection 0 · warning 0 | pass |
| R6.3 | Beklenmeyen 404/failed request **0** · decode edilemeyen `<img>` **0** | pass |
| R6.4 | Tam bir 4-sekme oturumunda `console.log/debug` satırı = **0** | pass |
| R6.5 | Tohumlanan çocuk adı (`"Zylphraxine"`) log'a **0**, ağa **0** · 159 istek, yerel sunucu dışında **0 host** | pass |
| R6.6 | Opsiyonel indirme linki dosyanın gerçek durumuyla tutarlı (`mission-book.pdf` server=200 → link canlı) | pass |
| R6.7 | Beacon gövdeleri: anahtarlar `[e, id, pack, step]` · çocuk adı **yok** · 40 karakterden uzun değer **yok** | pass |

**R6.7 örnek yük:** `[{"e":"hub3d","step":"shown"},{"e":"app_open"},{"e":"app_first_open"}]`
— Privacy sayfasının "bir olay adı ve en fazla bir küçük değer" taahhüdüyle birebir
örtüşüyor. `navigator.sendBeacon` Blob gönderdiği ve Playwright'ın `postData()`/
`postDataBuffer()` çağrılarının bunlar için **boş** döndüğü ölçüldü (7 POST, hepsi boş
gövde), bu yüzden yük `sendBeacon`/`fetch` sınırında yakalandı — yine uygulamanın dışından,
platforma teslim edilen baytları okuyarak.

Yerel statik sunucuda beklenen ve uygulama hatası **olmayan** iki ağ sonucu, kalıpla
listelenmek yerine adıyla tanımlandı ve her biri için ayrı bir olumlu iddia var:
`POST /api/beacon → 405` (üretimde `src/worker.js`, sözleşme 204) ve `mission-book.pdf`
(dosya repo'da, GET ve HEAD 200 döndürüyor — R6.6 bunu sunucuya sorarak doğruluyor).

### 6C.2 Kalıcılık ve scope — 9 pass, 0 fail, 1 envanter

| ID | Ölçüm | Sonuç |
|---|---|---|
| P6.1 | Tamamlama aktif çocuğun kendi scope'una yazıyor: `jumvi_p1_missions_done_v3=[7]`, takım anahtarı yok | pass |
| P6.2 | Reload sonrası done/xp/streak/badge birebir aynı | pass |
| P6.3 | İkinci çocuğa geçince journey **boş**, birincininki yerinde | pass |
| P6.4 | Geri dönünce birinci çocuğun ilerlemesi tam olarak eski hâlinde | pass |
| P6.5 | Takımda oynamak `jumvi_p1_team_t1_missions_done_v3`'e yazıyor, **solo dokunulmuyor** | pass |
| P6.6 | Takımdan çıkınca solo journey aynen geri geliyor | pass |
| P6.7 | Undo: done/xp/streak geri alınıyor | pass |
| P6.8 | Scope envanteri (aşağıda) | bilgi |
| P6.9 | 400ms dokunuş → `"Hold to reset progress"` (reddedildi) · 1600ms basılı tutma → `"Progress reset"` | pass |
| P6.10 | Reset reload'dan sonra da duruyor (`done=0 xp=0 streak=0`), profiller yerinde | pass |

**P6.9 reset kapsamı — hepsi ölçüldü:** `done ✓ xp ✓ streak ✓ bestStreak ✓ badges ✓
certificate ✓ highScores ✓ attempts ✓`, daily challenge sıfırda yeniden yaratıldı
(`{"iso":"2026-08-25","count":0,"claimed":false}`), profiller **dokunulmadı**, ikinci
çocuğun 4 anahtarı **korundu**, aktif olmayan takım scope'u (`[7]`) **korundu**.

Günün görev seçimi reset sonrası **aynı id'de kalıyor (6 → 6)** ve bu doğrudur:
`ensureDailyMission()` `pickDailyId(today, dailyN)` ile hesaplıyor, reset `dailyN`'i 0'a
alıyor, dolayısıyla "bugünün görevi" değişmiyor. Değişmesi gereken şekildi: `n=0`,
`date=2026-08-25` (bugün) — ölçüldü, doğru.

**P6.8 scope envanteri** — her anahtar ait olduğu scope'un altında:

```
personal (p1)      12  jumvi_p1_{active_team,badges_unlocked,missions_done,streak_*,daily_*,age,avatar,...}
team (p1/t1)        5  jumvi_p1_team_t1_{missions_done,streak_best,streak_count,streak_freeze,streak_last}
second child (p2)   4  jumvi_p2_daily_{challenge,date,id,n}
device-wide        10  jumvi_{active_profile,active_tab,first_visit,last_opened_id,leo_speak_hint,
                          onboarded,profiles,seen,tutorial_done,visits}
```

Kişisel test fixture'ı veya çocuk adı hiçbir log'a veya isteğe girmedi (R6.5: console 0,
istek 0, yerel sunucu dışı host 0).

### 6C.3 `daily_challenge` scope asimetrisi — **ürün kararı gerekiyor, kod değişmedi**

Faz 5'te ölçülen asimetri bu turda yeniden doğrulandı ve **değiştirilmedi**:

| Anahtar | Takım aktif | Solo |
|---|---|---|
| Daily Champion hedefi | `jumvi_p1_team_t1_daily_challenge_v1` | `jumvi_p1_daily_challenge_v1` |
| Günün görev seçimi (`daily_date/id/n`) | `jumvi_p1_daily_*_v1` | `jumvi_p1_daily_*_v1` |

Bu bir kaza değil: `TEAM_PROGRESS_SUFFIXES` (`app.js:850`) `daily_challenge_v1`'i açıkça
**içeriyor**, daily-pick anahtarlarını açıkça **dışarıda bırakıyor**. Yani aynı ekranda
"bugünün görevi" çocuğa, "1/1 today · Daily Champion yıldızı" takıma ait.

Promptun sunduğu üç seçenekten **ikincisi** geçerli: bu bir ürün kararı gerektiriyor,
kanıtlı bir bug değil. Gerekçe:

1. **İki okuma da savunulabilir.** Yıldız "bugün birlikte oynadık" ortak kutlamasıysa
   takım scope'u doğru (streak ve badge'ler de takım scope'unda). Yıldız çocuğun kendi
   başarısıysa çocuk scope'u doğru (saydığı görev zaten çocuk başına seçiliyor).
2. **Kodun içinde cevap yok.** Hangisinin doğru olduğu "bu yıldız kimin?" sorusuna
   ürünün cevabına bağlı.
3. **Değiştirmek mevcut aileleri etkiler.** Saklanan bir anahtarın scope'unu taşımak,
   bu turda korunması istenen localStorage sözleşmesini kırar ve mevcut ailelerde bugünün
   hedefini sessizce sıfırlar ya da iki kez saydırır.

**Görünür sonuç (kararı verecek kişi için):** çocuk Dad ile bir görev bitirir → takımın
Daily Champion'ı alınır. Aynı gün takımdan çıkarsa Today yeniden `0/1` gösterir ve aynı
günün hedefi ikinci kez kazanılabilir. Tersine, gün ortasında bir takıma katılmak hedefi
zaten yapılmış gösterebilir.

**Regresyon testi eklendi:** `check-persistence-flow.mjs` P6.5/P6.6, takım ve solo
scope'larının birbirine karışmadığını her koşuda doğruluyor; bu davranış bilinçli olarak
değiştirilirse test bunu yakalar.

---

## 7. Ölçüm araçlarının kendisinde bulunan 13 hata

Bu turda **13 kez** araç yanlıştı, uygulama değil. Her biri, düzeltilmeseydi sahte bir bug
raporu olacaktı. Bu turun asıl disiplini bu: bir ölçüm "fail" derse, önce ölçümü sorgula.

| # | Araç yanlış davranışı | Yanlış suçlanan |
|---|---|---|
| 1 | Her yüzey için Grown-ups sekmesinde park edildi; başka sekmedeki opener'lar `display:none` olduğu için `.focus()` sessizce başarısız oldu | Mission sheet + Badges "focus döndürmüyor" |
| 2 | Mission 1'in kartı Missions sekmesinde varsayılan olarak görünmüyor; 0-rect bir düğüm focus'landı | Mission sheet sözleşmesi |
| 3 | Örtüşme testi `position:fixed` elemanları eledi ama **çocuklarını** elemedi; yüzen bottom nav etiketleri sayfa içeriğiyle "örtüşüyor" sayıldı | Profile'da %200 metin |
| 4 | Z02 sıfır input ölçüp "pass" verdi | (boş geçiş) |
| 5 | Canlı bölge testi **ham DOM mutasyonu** saydı — `aria-hidden` içindekiler dahil | Faz 3'ün kendi çözümü "spam" sanıldı |
| 6 | `page.on("request")` yalnızca `postData()` okudu; `sendBeacon` Blob'ları için boş | Beacon gizlilik testi sessizce hiçbir şey ölçmedi |
| 7 | `mission-book.pdf`'in eksik olduğu varsayıldı; dosya repo'da ve 200 dönüyor | "Ölü link" |
| 8 | `__reach()` hedefi dikey merkeze kaydırıyor — sabit undo bar'ın tam durduğu yere | 3 viewport'ta "blocked by undoBar" |
| 9 | `addInitScript` her navigasyonda `active_profile`'ı yeniden tohumladı; `switchProfile()` reload ile çalıştığı için testin kendisi switch'i geri aldı | "Profil değişmiyor" |
| 10 | `playOne()` zaten tamamlanmış görevi tekrar oynadı → aynı buton "Mark as Not Done" demek | "Undo bozuk" |
| 11 | Reset hold'u, P6.7'den açık kalan mission sheet'in tamamlama butonuna indi (`toast="Marked as not done"`) | "Reset hiçbir şeyi temizlemiyor" |
| 12 | Reset sonrası günün görev id'sinin **değişmesi** istendi; oysa `pickDailyId(today, 0)` deterministik | "Daily pick temizlenmiyor" |
| 13 | **Faz 5'ten devralınan:** `R03`, daily anahtarlarının reset sonrası **yok olmasını** iddia ediyordu. Faz 5'te geçmesinin sebebi doğruluk değil, snapshot'ın getter yeniden çalışmadan alınmasıydı — yani bir yarış. Bu turda taze **şekli** (sayaç 0, tarih bugün) kontrol edecek biçimde düzeltildi. | "Sertifika ve daily state temizlenmiyor" |

13 numaralı madde ayrıca şunu gösteriyor: geçen bir test, doğru bir test olduğu anlamına
gelmiyor. Faz 5'in R03'ü doğru sonucu yanlış sebeple veriyordu ve bu tur onu yakaladı.

---

## 8. Faz 6D — Geriye kalan kararların açık raporu

| Madde | Ölçüm | Sınıflandırma |
|---|---|---|
| **iOS offline install** | `navigator.onLine=false` iken `installState()="ios-manual"`, satır görünür. Add to Home Screen tamamen yerel bir işlem; offline'da gizlemek hâlâ çalışan tek kurulum yolunu saklamak olurdu. Chromium'da offline `beforeinstallprompt` gelmez → `installState()="none"` → CTA çıkmaz. | **dürüst, bilinçli** — dead CTA yok |
| **568×320 Family roster** | `Pick a Mission` ve `Add a player` ilk viewport'ta ve **hit-test ile tıklanabilir**; roster kartı fold altında. | **bilinçli öncelik, kanıtlandı** |
| **Landscape max-height kuralı** | Yalnızca `@media (max-height:460px) and (orientation:landscape)`. Dört portrait viewport'ta clip 0, yatay taşma 0. | **çalışıyor, portrait bozulmuyor** |
| **Literal `playFinished` state** | Davranış zaten doğru: `check-mission-play-state.mjs` T13/T16/T19 Time's Up → interval temizleniyor, gate açılıyor, tam olarak bir tamamlama. Bir enum değeri eklemek davranışı değiştirmez. | **gereksiz refactor — yapılmadı** |
| **Quick Round gate** | Gate `min(max(missionTime,45),75)` ve 45s tabanı ürün kararı. Copy iki saati **ayırıyor**: timer `"89s"` gösterirken tamamlama butonu ayrıca `"Play for about 69s more"` diyor (M05'te ölçüldü) — kullanıcı yanıltılmıyor. | **bilinçli, copy dürüst** |
| **`daily_challenge` scope** | §6C.3 | **ürün kararı gerekiyor** |
| **TR route** | Bu turda hiç açılmadı, hiç değiştirilmedi. | **kapsam dışı** |
| **320×568 undo/Next örtüşmesi** | §3, ölçüm tablosuyla | **ürün kararı gerekiyor (P2)** |
| **`seasonalBackdrop` ölü markup** | Stylesheet ile kapatılmış, hiçbir yol ulaşmıyor, `display:none` olduğu için erişilebilirlik ağacında da yok | **zararsız; silmek refactor olur** |

---

## 9. Faz 6E — Son test matrisi

Hepsi bu turda, bu commit'in kodu üzerinde, gerçek tarayıcıda çalıştırıldı.

| Grup | Araç | Sonuç | Durum |
|---|---|---|---|
| Schema | `check-mission-schema.mjs` | 36/36 görev, unique id, required field | **pass** |
| Sheet | `check-mission-sheet-matrix.mjs` | 36/36 title, metadata, steps, win, safety, equipment | **pass** |
| Onboarding | `check-onboarding-occlusion.mjs` | 320/390/430 portrait + landscape, occlusion 0 | **pass** |
| Timer | `check-mission-play-state.mjs` | duplicate timer 0, narration/countdown race 0 | **pass** |
| Completion | `check-mission-play-state.mjs` | tek tamamlama, doğru ödül, çift mutasyon yok | **pass** |
| Undo | `check-mission-play-state.mjs` + `check-persistence-flow.mjs` P6.7 | 5s sonrası yetki kapanıyor, snapshot geri dönüyor | **pass** |
| Profile/team | `check-profile-team-isolation.mjs` (5/5), `check-profile-team-ux.mjs` (12/12), `check-persistence-flow.mjs` (9/10 + 1 envanter) | isolation, reload, profil ve takım geçişi | **pass** |
| Install | `check-install-offline-update-reset.mjs` I01–I05 | standalone/prompt/iOS/none dürüst, offline bilgi notu | **pass** |
| Offline | aynı araç O01 | core mission, local progress, timer, completion, Undo | **pass** |
| Update | aynı araç U01–U06 | offline/no-registration/latest/found/busy/error | **pass** |
| Reset | aynı araç R01–R04 + `check-persistence-flow.mjs` P6.9/P6.10 | kısa dokunuş reddediyor, hold temizliyor, kalıcı | **pass** |
| 3D | `check-hub-fallback.mjs` (6/6), `check-hub-mission-flow.mjs` (6/6) | gerçek Hub success/failure/offline/WebGL/reduced-motion/orientation | **pass** |
| Dialogs | **`check-dialog-contract.mjs`** | 12/12 aria-modal yüzeyi; open/focus/trap/Escape/return | **pass** |
| A11y | `check-a11y-controls.mjs` | eksik isim 0, eksik label 0, duplicate id 0 | **pass** |
| Contrast | `check-nontext-contrast.mjs`, `contrast-sweep.mjs` | metin + metin dışı ölçüldü | **pass** |
| Zoom | **`check-zoom-textresize.mjs`** | %200 text resize, reflow 320px, pinch zoom | **pass** |
| Motion | **`check-motion-liveregions.mjs`** | reduced-motion 3/3, live-region spam 0 | **pass** |
| Responsive | **`check-responsive-matrix.mjs`** | 6 viewport, clipping/occlusion/hit-test 24/24 | **pass** |
| Runtime | **`check-runtime-health.mjs`** | app exception 0, unhandled rejection 0, bozuk asset 0 | **pass** |
| Privacy | `check-runtime-health.mjs` R6.5 + R6.7 | çocuk/profil adı, IP/device identifier, kişisel veri **yok** | **pass** |
| Icons | `check-icon-glyphs.mjs` | her ikon sınıfı bir mask'e çözülüyor | **pass** |

### Ham çıktılar (bu turda, bu kodda)

```
check-mission-schema                  36/36 missions satisfy the schema
check-mission-sheet-matrix            36/36 missions fully conform
check-onboarding-occlusion            nothing above the CTA is covered, any size or orientation
check-a11y-controls                   every visible control named, every input labelled, ids unique
check-nontext-contrast                every required boundary/state/focus ring ≥ 3:1
check-icon-glyphs                     every icon class resolves to a mask
check-profile-team-isolation           5 pass,  0 fail
check-profile-team-ux                 12 pass,  0 fail
check-install-offline-update-reset    15 pass,  0 fail, 1 informational   (R03 düzeltildikten sonra)
check-hub-fallback                     6 pass,  0 fail
check-hub-mission-flow (T29)           6 pass,  0 fail
check-mission-play-state              31 pass,  0 fail, 1 informational
check-dialog-contract        (yeni)   12 pass,  0 fail  (13 yüzey: 12 + 1 emekli)
check-zoom-textresize        (yeni)   14 pass,  0 fail
check-motion-liveregions     (yeni)    6 pass,  0 fail
check-responsive-matrix      (yeni)   24 pass,  0 fail
check-runtime-health         (yeni)    7 pass,  0 fail
check-persistence-flow       (yeni)    9 pass,  0 fail, 1 envanter
contrast-sweep                        140 surface passes, 5562 text nodes, 0 below WCAG AA
```

**`skip` / `decision required` olan maddeler:**

| Madde | Durum | Neden |
|---|---|---|
| `daily_challenge` takım/çocuk scope'u | **decision required** | §6C.3 — iki okuma da savunulabilir, kodda cevap yok, değiştirmek localStorage sözleşmesini kırar |
| 320×568'de undo bar'ın `#btnNext` ile %69 örtüşmesi | **decision required (P2)** | §3 — tek viewport, 5 saniye, buton hâlâ tıklanabilir; tek değerli her CSS düzeltmesi örtüşmeyi başka viewport'a taşıyor |
| `seasonalBackdrop` focus sözleşmesi | **skip (uygulanamaz)** | yüzey stylesheet ile emekliye ayrılmış, hiçbir kullanıcı yolu ulaşmıyor |
| I05 offline install | **info** | iOS manuel yolu bilinçli olarak korunuyor |
| TR rotası | **kapsam dışı** | promptun 1. maddesi |

---

## 10. Değişen dosyalar

| Dosya | Değişiklik | Neden |
|---|---|---|
| `app.js` | `closeMission()` — focus geri verme yeniden render'lardan sonraya alındı ve hedef görev id'siyle yeniden çözülüyor; `closedMissionId` yakalanıyor | §3'teki P1 |
| `tools/check-install-offline-update-reset.mjs` | `R03` iddiası düzeltildi: daily pick'in **yok olması** değil, taze **şeklinin** (sayaç 0, tarih bugün) doğrulanması | §7 madde 13 — Faz 5'te yarış sayesinde geçiyordu |
| `tools/check-dialog-contract.mjs` | **yeni** — 12 aria-modal yüzeyi, DOM'dan keşfedilerek | 6A.2 |
| `tools/check-zoom-textresize.mjs` | **yeni** — SC 1.4.4 %200, SC 1.4.10 reflow, pinch/gesture/touch-action | 6A.3 |
| `tools/check-motion-liveregions.mjs` | **yeni** — reduced motion + erişilebilir-metin bazlı canlı bölge sayımı | 6A.4 |
| `tools/check-responsive-matrix.mjs` | **yeni** — 6 viewport × 4 yüzey, hepsi hit-test | 6B |
| `tools/check-runtime-health.mjs` | **yeni** — console/network/asset + canary ile gizlilik + beacon yükü | 6C.1 |
| `tools/check-persistence-flow.mjs` | **yeni** — tam scope yolculuğu, reset dahil | 6C.2 |
| `docs/audits/faz6-final-qa.md` | **yeni** — bu rapor | — |
| `docs/audits/screens/faz6/` | **yeni** — 54 ekran görüntüsü | kanıt |

**Uygulama kodunda yapılan tek değişiklik `app.js`'teki `closeMission()` düzeltmesidir.**
`index.html`, `warm-toy.css`, `style.css`, `data.js` ve `jumvi-hub-app.js` bu turda hiç
değiştirilmedi.

## 11. Hiç değiştirilmeden korunan önceki düzeltmeler

Hepsi bu turda yeniden ölçüldü ve geçti:

onboarding overlap · zoom engelinin kaldırılması · metin ve metin dışı kontrast · 13px
görev etiketleri · search/filter dead UI temizliği · `Pick one for me` görev havuzu ·
timer/countdown/pause/resume/gate/completion · gerçek 5 saniyelik transactional Undo ·
36 görevde metadata ve görev bazlı safety · riskli görevlerde easy/Quick Round/stop
condition · multiplayer role preflight ve phone-down live-region · gerçek 3D Hub
popstate/advance/Undo · profile/team isolation ve profile UX · Family `Pick a Mission` ·
dialog Escape/focus sözleşmesi · install/offline/update/reset/3D fallback · Product Care
sıralaması ve Privacy disclosure sadeleştirmesi.

Kapsam sözleşmesi de korundu: 4 sekme, 36 görev ID'si, pack anahtarları, localStorage
sözleşmesi, renk paleti, Leo, tipografi, İngilizce ana rota, local-first, hesap yok,
reklam yok.

## 12. Ekran görüntüleri ve artifact'ler

```
docs/audits/screens/faz6/
  {320x568,390x844,430x932,568x320,844x390,768x1024}-{today,browse,modes,profile}.png
  {…}-mission-playing.png · {…}-mission-done.png · {…}-family.png · {…}-profile-edit.png
  text200-{today,browse,modes,profile}.png · text200-mission-sheet.png
  reflow320-today.png
```

`320x568-mission-done.png` §3'teki örtüşme kararının görsel kanıtıdır: koyu
"Marked done / Undo" çubuğu mavi "Next" butonunun üzerinde durmaktadır.

---

## 13. Test edilemeyen maddeler

| Madde | Neden test edilemedi | Yerine kullanılan kanıt |
|---|---|---|
| Gerçek iOS Safari'de pinch zoom ve input focus zoom'u | Bu ortamda yalnızca headless Chromium var; gerçek bir iPhone yok | Zoom'u engelleyecek her mekanizmanın **yokluğu** ölçüldü (viewport meta, `touch-action`, gesture/touchmove `preventDefault`, input font-size ≥16px). iOS UA ile install akışı ayrıca sürüldü. |
| Gerçek OS-seviyesi font scaling (Dynamic Type / Android font size) | Playwright OS ayarını taklit edemez | Tarayıcının kendi metin boyutu mekanizması sürüldü: kök `font-size` 16→32px (SC 1.4.4'ün tanımladığı %200), artı 320px reflow (SC 1.4.10) |
| Gerçek ekran okuyucu (VoiceOver/TalkBack/NVDA) duyuruları | Bu ortamda AT yok | Duyurunun **kaynağı** ölçüldü: canlı bölgelerin erişilebilir metninin kaç kez değiştiği, `aria-hidden` alt ağaçları hariç tutularak |
| Üretimdeki `POST /api/beacon → 204` | Yerel statik sunucuda POST handler yok (405) | Sözleşme `src/worker.js:25` ve `docs/audits/faz1-beacon.md`'de; uygulamanın 405'te hata atmadığı, gövdesinin kişisel veri taşımadığı ölçüldü |
| Gerçek cihazda 9.4 MB'lık 3D indirmesi | Yerel ağ | WebGL yokluğu, modül iptali, three.js iptali, offline, reduced motion ve orientation ayrı ayrı **gerçekten kırılarak** test edildi |
| Çoklu gerçek cihaz / tarayıcı matrisi (Safari, Firefox) | Yalnızca Chromium mevcut | Kapsam olarak raporlandı; ölçülen her şey Chromium'da |

---

## 14. 10/10 kararı

### **READY WITH EXPLICIT PRODUCT DECISIONS**

**Neden `READY` değil:** ürün kararı bekleyen iki madde var ve promptun standardı bunların
10/10 iddiasından **ayrı** gösterilmesini gerektiriyor:

1. **`daily_challenge` takım/çocuk scope asimetrisi** (§6C.3). Kanıtlı bir bug değil;
   bilinçli bir liste (`TEAM_PROGRESS_SUFFIXES`) tarafından üretiliyor, iki okuma da
   savunulabilir ve değiştirmek mevcut ailelerin bugünkü hedefini etkiler. "Bu yıldız
   kimin?" sorusunun cevabı ürüne aittir.
2. **320×568'de undo bar'ın `#btnNext` ile %69 örtüşmesi** (§3). P2: tek viewport,
   5 saniye, buton hâlâ tıklanabilir. Denenen her tek-değerli CSS düzeltmesinin örtüşmeyi
   kaldırmak yerine başka bir viewport'a taşıdığı ölçüldü; doğru çözüm bir yerleşim
   kararı, bu turun kapsamındaki "yalnızca kanıtlanmış P0/P1" işi değil.

**Neden `NOT READY` de değil:**

- **P0 yok.** Temiz açılışta uygulama kodu hiç exception atmıyor, unhandled rejection yok,
  bozuk asset yok, 36 görev listeleniyor, dört sekme açılıyor, mission sheet'ler açılıyor.
- **Açık P1 yok.** Bu turda bulunan tek P1 (mission sheet'in focus'u `<body>`'ye düşürmesi)
  ölçüldü, kök nedeni kanıtlandı, minimal biçimde düzeltildi ve düzeltmesi doğrulandı.
- **Bütün test grupları gerçek kanıtla `pass`** ya da yukarıda açıkça ürün kararı olarak
  işaretlendi. Hiçbir satır "muhtemelen çalışıyor" diye geçmedi.
- **Ölçülemeyen alanlar gizlenmedi** — §13'te neden ölçülemediği ve yerine ne kullanıldığı
  yazılı.
- **Önceki bütün düzeltmeler korundu** ve bu turda yeniden ölçüldü (§11).
- **Sözleşme korundu:** 4 sekme, 36 görev ID'si, pack anahtarları, localStorage, renk
  paleti, Leo, İngilizce ana rota, local-first, hesap yok, reklam yok.
- **Gizlilik kanıtlandı, iddia edilmedi:** tohumlanan bir çocuk adı ne bir log satırına
  ne de bir isteğe girdi; 159 isteğin **hiçbiri** yerel sunucu dışında bir hosta gitmedi;
  beacon yükleri yalnızca `[e, id, pack, step]` taşıyor.

**Bu iki karar verildikten sonra `READY`.** İkisi de kod düzeltmesi değil, ürün sahibinin
cevaplaması gereken sorulardır — ve ikisinin de ölçümleri bu belgede, karar verilebilecek
kadar somut biçimde duruyor.

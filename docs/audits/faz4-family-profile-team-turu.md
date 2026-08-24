# Faz 4 — Family, Profile, Team, Product Care, Help, Privacy

**Branch:** `claude/jumvi-visual-accessibility-k92evo`
**Baseline:** `8b5dd7e` (Faz 3) · **Tarih:** 2026-08-24

---

## 1. Kod envanteri (değişiklikten önce)

| Alan | Gerçek yer | Mevcut davranış |
|---|---|---|
| Aktif çocuk | `PROFILES_KEY="jumvi_profiles_v1"`, `ACTIVE_PROFILE_KEY="jumvi_active_profile_v1"`, `getActiveProfileId()` | Varsayılan `p1`; profil yoksa `{id:"p1", name:"Player"}` oluşturuluyor |
| Profil prefix'i | `_PP = "jumvi_" + getActiveProfileId() + "_"` | **Yükleme anında bir kez** çözülen `const` — bu yüzden `switchProfile()` sayfayı yeniliyor |
| İlerleme prefix'i | `_PROGRESS_PREFIX` = takım aktifse takım prefix'i, değilse `_PP` | Takım/kişisel ayrımının tek kaynağı |
| Takımlar | `_PP+"teams_v1"`, `_PP+"active_team_v1"`, `teamProgressPrefix(id)` | `normalizeJumviTeams()` geçersiz takımı **sessizce** eliyor ve solo prefix'e düşüyor |
| Yeni profil id | `nextProfileId()` + `jumvi_profile_seq_v1` | Monotonik — silinen id yeniden kullanılmıyor |
| Profil düzenleme | `openProfileEdit()`, `saveProfileEdit()`, `childNameConflict()` | Boş/çakışan isim reddediliyordu, ama yalnızca toast ile |
| Profil ekranı | `#profileBackdrop.jvFullSurface` | `role="dialog" aria-modal="true"` — **fakat hiç klavye işleyicisi yok** |
| Takım kurulumu | `openChildIdentitySetup()`, `_teamSetupResumeAfterIdentity` | İsimsiz `Player` önce kimlik adımına gidiyor (**beklenen davranış**) |

## 2. İzolasyon — kanıtlandı, kusur bulunmadı

`tools/check-profile-team-isolation.mjs`. İki çocuk, biri Dad ile takımda; her senaryo
seed → reload → geri okuma (prefix `const` olduğu için gerçek yol budur).

| Test | Sonuç |
|---|---|
| F01 çocuk değişince o çocuğun görevleri/streak'i yükleniyor | p1 `[1,2,3]` streak 3 · p2 `[10,11]` streak 1 |
| F02 aynı çocuk solo vs takımda iki ayrı yolculuk | solo `[1,2,3]`/3 · takım `[20,21,22,23]`/9, solo anahtarı dokunulmamış |
| F03 takımda kazanılan completion yalnızca takıma yazılıyor | takım `[…,5]`; solo done/streak/badge/sertifika ve kardeşin verisi değişmedi |
| F04 hangi anahtar kimi takip ediyor | takım: missions, streak, badges, daily_challenge · çocuk: daily_date/id/n, cert, avatar, age, attempts |
| F05 yeni çocuk boşalan id'yi almıyor | `nextProfileId() → p3` |

**5/5 pass. İzolasyonda değişiklik yapılmadı — gerekmedi.**

Kaydedilen asimetri (kusur değil, bilinçli görünüyor): `daily_challenge_v1` takımı,
`daily_date/id/n` ise çocuğu takip ediyor. Yani "bugün kaç görev bitirdik" aktif
yolculuğa, "bugünün önerilen görevi" ise çocuğa ait. Değiştirilmedi; test artık bu
ayrımı sabitliyor, sessizce ters dönerse düşer.

## 3. Profil/takım UX — 6 kusur bulundu, 6'sı düzeltildi

`tools/check-profile-team-ux.mjs`, 5 viewport (320/390/430 portrait, 568×320 ve
844×390 landscape). **Baseline 6/12 → 12/12.**

### 3.1 İki isim alanı da yalnızca placeholder taşıyordu
`#profileEditName` ve `#profileNewName` için tek "isim" placeholder'dı. Placeholder
yazmaya başlayınca kayboluyor ve birçok ekran okuyucu onu hiç duyurmuyor. Her ikisine
gerçek `<label for>` eklendi.

### 3.2 Landscape'te Save/Cancel ulaşılamıyordu
Avatar ızgarası `repeat(4, minmax(0,1fr))` idi: 844px genişlikte her hücre ~200px
oluyor ve 12 avatar **607px** yükseliyordu — 390px'lik viewport'ta Save/Cancel alt
nav'ın altında kalıyordu. `repeat(4, minmax(0,84px))` ile hücre kapatıldı.

Ölçüm (ızgara yüksekliği): 844×390'da **607 → 272**, 568×320'de **400 → 272**,
320×568'de 214 (değişmedi — dört sütun korundu).

> Ara denemede `auto-fit` kullandım; landscape'i düzeltti ama 320px'te üç sütuna
> düşüp ızgarayı **daha uzun** yaptı (214 → 366). Bu yüzden sütun sayısı sabit.

### 3.3 Klavye açıkken Save
390×508 kalan yükseklikte input 16px (zoom yok) ve Save ekranda; sayfa sonuna
kaydırınca nav'ın üstünde ve tıklanabilir.

> **Testin kendisi de yanlıştı.** İlk hâli `scrollIntoView({block:'nearest'})`
> kullanıyordu; bu, öğe viewport dikdörtgenine girer girmez duruyor — sabit alt nav
> üstünü boyasa bile. Bu ekranlar nav'ı **bilerek** tutuyor (warm-toy.css: "these
> surfaces are screens, not modals"). Yardımcı artık bir insanın yaptığını yapıyor:
> ortala, tıklanmıyorsa yüzeyi sonuna kadar kaydır, tekrar dene.

### 3.4 Reddetme yalnızca toast'taydı
Boş ve çakışan isim zaten engelleniyordu, ama alanın kendisi işaretlenmiyordu. Artık
`aria-invalid="true"` + `aria-describedby` ile bağlı görünür hata satırı. Toast korundu.

### 3.5 Profil ekranının klavye sözleşmesi yoktu
`role="dialog" aria-modal="true"` yazıyordu ama Escape kapatmıyor, Tab dışarı
çıkıyor, açılışta odak içeri girmiyor, kapanışta odak `<body>`'ye düşüyordu. Uygulamadaki
diğer dialog'lar `handleDialogKeys`'ten geçiyor; bu ekran hiç bağlanmamıştı. Bağlandı;
`_profileReturnFocus` ile odak açan kontrole dönüyor.

### 3.6 Privacy / Help / Badges / Certificate / Seasonal / 3D fallback
Aynı kusur, altı yüzeyde daha: hepsi `aria-modal="true"` ilan ediyor, hiçbirinde
Escape/focus trap/odak dönüşü yoktu. `enhanceDialog()` eklendi.

Her açılış çağrısını tek tek düzenlemek yerine **class observer** kullanıldı: bu
yüzeyler dört farklı yolla kapanıyor (kapat butonu, backdrop tıklaması, Escape,
programatik) ve yalnızca observer hepsini görüyor.

Doğrulandı: Privacy ve Help artık `firstFocusInside=true`, `Escape closed=true`,
`focusBack=<açan kontrol>`.

## 4. Family ilk viewport (§4.1)

Üç sorudan **üçüncüsünün cevabı yoktu**. Family'de görünür eylemler: "Add a player",
"No team yet", "View all" — hiçbiri oyuna başlatmıyordu.

Başlığın hemen altına `Pick a Mission` eklendi; mevcut `[data-go-tab="today"]`
bağlaması kullanıldı, yeni handler yok. Doğrulandı: tıklayınca `tab-today`.

İlk viewport'ta (üst kenar y):

| Viewport | Pick a Mission | Add a player | Team state | Family progress |
|---|---:|---:|---:|---:|
| 320×568 | 93 | 353 | 536 | 409 |
| 390×844 | 93 | 353 | 536 | 409 |
| 430×932 | 93 | 353 | 536 | 409 |
| 568×320 | 97 | fold altı | fold altı | fold altı |
| 844×390 | 97 | 357 | fold altı | fold altı |

## 5. Privacy & Safety (§4.5)

Analytics maddesi satır içinde ~400 kelimeydi ve kalan kararları ekrandan itiyordu.
Tek kelimesi değiştirilmeden `<details>` arkasına alındı; üstünde tek cümlelik özet.

Ölçüm: ilk katman **269 kelime**, açıklama arkasında **161 kelime**.

**Kısmen karşılandı:** spec ilk katmanda 4–6 karar maddesi istiyor; 8 madde var.
Daha aza indirmek gizlilik taahhütlerini birleştirmek/çıkarmak demek — bu bir hukuk
ve ürün kararı, tek başıma yapmadım.

## 6. Beklenen davranış olarak sabitlendi

İsimsiz varsayılan `Player` profili `Create a Team` seçtiğinde önce kimlik adımına
gidiyor (`STEP 1 OF 2 · CHILD`). Bug olarak **değiştirilmedi**; P07 testi artık bunu
doğruluyor, yani biri yanlışlıkla "düzeltirse" test düşer.

## 7. Ertelenenler

- **Product Care sıralaması (§4.4)** yapılmadı. "missing catches", "indoors", "ball
  won't stick" maddelerini üste almak ve her cevaba `Do this now` eklemek içerik
  yazımı; bu turda dokunulmadı.
- **Privacy 8 → 4–6 madde** (yukarıda).
- **568×320 landscape**'te Family progress ve team state ilk viewport altında. 320px
  yükseklikte başlık + birincil eylem sonrası yer kalmıyor.
- **Team picker'ın kendi focus trap'i** zaten vardı (`handleDialogKeys`, app.js:2313);
  değiştirilmedi.

## 8. Breaking change

Yok. `jumvi_profiles_v1`, `jumvi_active_profile_v1`, `_PP`/`_PROGRESS_PREFIX` şeması,
takım anahtarları, 36 görev id'si ve v1 yedek formatı değişmedi. Yeni storage key yok.
TR dosyalarına, renk paletine ve Leo varlıklarına dokunulmadı.

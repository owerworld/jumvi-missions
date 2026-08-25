# Faz 5 — Install, Offline, Update, Reset ve 3D Fallback Turu

**Baseline:** `57bce60`
**Kapsam:** yalnızca İngilizce ana rota. `/tr/` bu turda hiç açılmadı, hiç değiştirilmedi.
**Değiştirilmeyenler:** renk paleti, Leo, 36 görev ID'si, pack anahtarları, localStorage sözleşmesi,
4 sekme, önceki turlardaki kontrast / onboarding / search-filter / timer / completion-Undo /
gerçek 3D Hub / mission sheet / safety / profile-team isolation / dialog focus / Family
"Pick a Mission" düzeltmeleri.

Bu turda üretilen iki yeni ölçüm aracı:

```bash
npx http-server -p 8910 -c-1            # yerel sunucu

JUMVI_PW=/opt/node22/lib/node_modules/playwright \
JUMVI_EXE_CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome \
  node tools/check-install-offline-update-reset.mjs      # I01–I05, O01, U01–U06, R01–R04

JUMVI_PW=/opt/node22/lib/node_modules/playwright \
JUMVI_EXE_CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome \
  node tools/check-hub-fallback.mjs                      # H01–H06
```

Her durum gerçekten kırılarak üretildi; hiçbiri simüle bir bayrakla "varsayılmadı":
`navigator.standalone`, gerçek bir `beforeinstallprompt` olayı, iPhone UA, düz masaüstü UA,
`context.setOffline(true)`, `navigator.serviceWorker.getRegistration` stub'ları, gerçek
`mouse.down()` → bekle → `up()` hold, `getContext("webgl")` → `null`, ve
`page.route(...).abort()` ile ağ katmanında iptal edilen hub modülü / three.js istekleri.

---

## 1. Install — beş durum birbirinden ayrıldı

| ID | Durum | Nasıl zorlandı | Ölçülen | Sonuç |
|----|-------|----------------|---------|-------|
| I01 | Zaten kurulu | `display-mode: standalone` | `installState()="standalone"` · satır gizli, kart gizli | ✅ dead CTA yok |
| I02 | Prompt hazır | gerçek `beforeinstallprompt` | `"prompt"` · satır görünür | ✅ |
| I03 | iOS / manuel | iPhone UA | `"ios-manual"` · satır görünür (Share → Add to Home Screen) | ✅ |
| I04 | Dürüst yol yok | masaüstü UA, prompt yok | `"none"` · satır gizli, kart gizli | ✅ dead CTA yok |
| I05 | Offline | `setOffline(true)` | `"ios-manual"` · satır görünür | ⚠️ bilgi |

**I05 neden FAIL değil:** iOS'ta "Add to Home Screen" tamamen yerel bir işlemdir; ağ
gerektirmez. Offline'da bu satırı gizlemek, hâlâ çalışan tek gerçek kurulum yolunu
saklamak olurdu. Chromium tarafında ise offline'da `beforeinstallprompt` zaten gelmez,
yani `installState()` kendiliğinden `"none"` olur ve CTA çıkmaz. Bu bir test kısıtı
değil, ölçülmüş ve kabul edilmiş bir ürün davranışıdır.

## 2. Offline — çekirdek döngü

| ID | Ölçülen | Sonuç |
|----|---------|-------|
| O01 | 4 sekme açılıyor (today/browse/modes/profile) · 36 kart · mission sheet açılıyor · timer çalışıyor · gate açıldı · completion `done=1` · Undo `done=0` · banner `"Offline — missions still work. Island needs a connection."` | ✅ |

O01 ilk gezinmeden **sonra** offline'a geçer; önce geçirmek servis worker'ın hiç
kurulmamasına yol açıyordu — o bir test hatasıydı, uygulamanın davranışı değil (düzeltildi).

## 3. Update — altı durum ayrı ayrı

| ID | Durum | Ölçülen | Sonuç |
|----|-------|---------|-------|
| U01 | Offline | `"You're offline — can't check for updates right now."` · kontrol hiç başlamıyor | ✅ |
| U02 | Registration yok | `"Couldn't check right now. Try again in a moment."` | ✅ |
| U03 | Zaten güncel | `"You're already on the latest version!"` · `aria-busy=true`, alt satır `"Checking…"` | ✅ |
| U04 | `update()` hata atıyor | `"Couldn't check right now. Try again in a moment."` | ✅ |
| U05 | Güncelleme bulundu | toast yok, **reload** oldu (`reloaded=true`) | ✅ |
| U06 | Meşgul | üç dokunuş → `update()` **1 kez** çağrıldı, `aria-busy=true` | ✅ |

## 4. Reset — yalnızca deliberate hold

| ID | Ölçülen | Sonuç |
|----|---------|-------|
| R01 | Kısa dokunuş: `done [1,2,3,4] → [1,2,3,4]`, streak `4 → 4` | ✅ hiçbir şey silinmedi |
| R02 | 1.2s hold: `done=[]` · streak 0 · best 0 · badges `null` · daily challenge `{count:0, claimed:false}` · **görünen UI** `streakPill="Start your streak!"`, done=0, xp=0 | ✅ |
| R03 | Sertifika ve daily-pick state'i de silindi | ✅ |
| R04 | Profiller **silinmedi** — reset ilerlemeyi temizler, çocukları değil | ✅ |

**R02'deki `count:0` bir kalıntı değil:** `getDailyChallengeState()` bugünün kaydını
yoksa sıfırdan yaratır. Test önce "anahtar yok olmalı" diye iddia ediyordu; bu benim
hatamdı, düzeltildi.

---

## 5. 3D Hub — altı başarısızlık modu

| ID | Kırılan şey | Ölçülen | Sonuç |
|----|-------------|---------|-------|
| H01 | `getContext("webgl*") → null` | `tab-today` · canvas 0 · **island kartı gizlendi** · toast `"Adventure Mode needs a newer device — missions still work great!"` · 36 görev, sheet açılıyor | ✅ |
| H02 | `jumvi-hub-app.js` ağda iptal | `[Try again | Back to missions]` → **tam 1 kurtarma eylemi** · çekirdek sağlam | ✅ |
| H03 | `three.module.min.js` ağda iptal | aynı arayüz, aynı 1 eylem · çekirdek sağlam | ✅ |
| H04 | Offline | ada **hiç açılmıyor** (`hubShown=false`, canvas 0), `tab-today`'de kalınıyor, banner `"Offline — missions still work. Island needs a connection."`, 36 görev ve sheet çalışıyor | ✅ |
| H05 | `prefers-reduced-motion: reduce` | `welcomePanel:still dailyIcon:still leo:still` · uygulama tam kullanılabilir | ✅ |
| H06 | Portrait → landscape | canvas 390×844 → 844×390 · döndükten sonra yeni kareler geliyor · yatay taşma yok | ✅ |

**H04'ün ilk hali hiçbir şey ölçmüyordu.** Kurtarma butonu sayısı için
`rec.buttons.length === 0 || backButtons.length === 1` yazmıştım; bu koşulu her olası
sonuç sağlıyor. Ada offline'da zaten hiç açılmıyor — `advModeCard.onclick`
`switchTab()`'e gitmeden önce yolculuğu reddedip offline banner'ını yakıyor (9.4 MB'lık
bir indirmeyi başlatıp yarıda bırakmak yerine doğru olan da bu). Test artık gerçekte
olanı iddia ediyor: hub overlay'i açılmadı, canvas yok, `tab-today`'de kalındı, banner
sebebini söylüyor ve 36 görev duruyor.

### H01 iki gerçek hata ortaya çıkardı

İlk çalıştırmada H01 **başarısızdı** ve ölçüm şuydu:
`tab=tab-hub3d canvas=0 islandCard=visible`. WebGL kapısı doğru çalışmıştı (toast
`showHub3D()`'nin `!hub3dWebGLOk()` dalından geliyordu), ama sonuçları iki ayrı hata
yüzünden ekrana yansımıyordu.

**Hata 1 — `switchTab()` re-entrancy.** `switchTab()` `showHub3D()`'yi body class'ını
yazmadan **önce** çağırıyordu. `showHub3D()` WebGL'i reddedip kendisi
`switchTab("today")` çağırıyor; iç çağrı işini yapıyor, dış çağrı geri dönüp body
class'ını tekrar `tab-hub3d` yapıyordu. Yani "bu cihaz adayı çalıştıramaz" denen
kullanıcı, hub'ın CSS durumunda bırakılıyordu. Hub gönderimi artık body class'ından
**sonra** çalışıyor, `showHub3D()` reddi `false` döndürüyor ve `switchTab()` iç
çağrının yazdığını bozmak yerine `return` ediyor.

**Hata 2 — gizlenemeyen island kartı.** `applyHub3dUnsupported()` yalnızca
`card.style.display = "none"` yazıyordu; ama `warm-toy.css` bu kartı
`#tabToday #advModeCard{ display:flex !important }` ile biçimlendiriyor ve
`!important` inline bildirimi yener. Ölçüm: `advInline="none"` iken
`advComputed="flex"`. Sonuç: WebGL'i olmayan **her** cihazda kart ekranda kalıyor ve
her dokunuş aynı "needs a newer device" toast'ını tekrar oynatıyordu — tam olarak bu
turda yasaklanan dead CTA. Artık `hub3dUnsupported` sınıfı ekleniyor ve eşleşen
`!important` kuralı daha yüksek specificity ile (2 id + 1 class) kartı kapatıyor.

`HUB3D_UNSUPPORTED_KEY` **reset'te bilerek silinmiyor** — cihazın WebGL'i reset'ten
sonra da yok. `updateProgress()` içindeki sınıf temizliği bu yüzden bir "reset geri
alma" değil, yalnızca bayrak ile sınıfın ayrışamamasını garanti eden bir senkronizasyon.
(İlk yazdığım kod yorumu bunun tersini söylüyordu; kodu okuyunca yanlış olduğu görüldü
ve düzeltildi.)

---

## 6. Faz 4'ten devralınan küçük maddeler

### 6.1 Product Care sıralaması ✅

Yeni sıra — bileşene göre değil, ailenin sorunla **ne zaman** karşılaştığına göre:

1. My child is missing most catches
2. Can we play indoors?
3. The ball won't stick
4. The ball is hard to remove
5. How should the hand strap fit?
6. How do I clean and store the set?
7. Something is damaged or missing

İlk üçü setle geçirilen ilk on dakikanın sorularıdır ve bunlardan birini soran ebeveyn
hayal kırıklığına uğramış bir çocukla oyunun ortasındadır. Temizlik, kayış ve yedek
parça daha sakin, daha sonraki sorulardır. Hiçbir madde silinmedi, metinler değişmedi.

Ekran: `docs/audits/screens/faz5/390x844-product-care.png`

### 6.2 Privacy ilk katmanı: 8 madde → 5 karar ✅

Eski ilk katman 8 madde ve ~600 kelimeydi; kapı önünde duran bir ebeveyn ilk ikisini
okuyup kapatıyordu. Yeni katman **5 karar**, her biri tek satır. **Hiçbir taahhüt
kaybedilmedi** — maddeler gruplandı, kırpılmadı; karar değil de detay olan cümleler
`<details>` içine indi, orada hâlâ açık ve hâlâ sayfada.

| Yeni madde | Kapsadığı eski maddeler |
|---|---|
| No sign-up, no account. | 1 + 2'nin "hiç sormadıklarımız" kısmı |
| Everything stays on this device. | 2 + 3 (+ sertifika adı detayı disclosure'da) |
| No ads. No third-party trackers. No data selling — ever. No microphone, ever. | 4 + 6 (read-aloud detayı disclosure'da) |
| Anonymous play analytics. | 5 (tam envanter disclosure'da, kelimesi kelimesine korundu) |
| Made for kids — and for safe play. | 7 + 8 (COPPA metni disclosure'da, tam) |

Taahhüt korunumu makine ile doğrulandı: `HEAD:index.html` ile yeni dosyanın privacy
gövdeleri düzleştirilip 32 anahtar ifade karşılaştırıldı; hepsi ikisinde de mevcut.
İlk turda "provide **adult** supervision" → "please supervise" olarak zayıflamıştı;
ölçüm bunu yakaladı ve orijinal cümle birebir geri kondu.

Ekran: `docs/audits/screens/faz5/390x844-privacy.png`

### 6.3 `daily_challenge` takım/çocuk scope asimetrisi — ürün kararı gerekiyor, kod değişmedi

**Ölçüm** (aynı çocuk `p1`, önce Dad ile takımda, sonra solo):

| Anahtar | Takım aktif | Solo |
|---|---|---|
| Daily Champion hedefi | `jumvi_p1_team_t1_daily_challenge_v1` | `jumvi_p1_daily_challenge_v1` |
| Günün görev seçimi (`daily_date/id/n`) | `jumvi_p1_daily_*_v1` | `jumvi_p1_daily_*_v1` |

Yani **aynı ekranda** "bugünün görevi" çocuğun kendisine, "1/1 today · Daily Champion
yıldızı" ise takıma ait. Bu bir kaza değil: `TEAM_PROGRESS_SUFFIXES` listesi
`daily_challenge_v1`'i açıkça içeriyor ve daily-pick anahtarlarını açıkça dışarıda
bırakıyor.

**Görünür sonuç:** çocuk Dad ile bir görev bitirir → takımın Daily Champion'ı alınır.
Aynı gün takımdan çıkarsa Today yeniden `0/1` gösterir ve aynı günün hedefi ikinci kez
kazanılabilir. Tersine, gün ortasında bir takıma katılmak hedefi zaten yapılmış
gösterebilir.

**Kararım: değiştirmedim, çünkü kanıtlı bir ürün kararı gerekiyor.** İki okuma da
savunulabilir — yıldız "bugün birlikte oynadık" ortak kutlamasıysa takım scope'u
doğrudur (streak ve badge'ler de takım scope'unda); yıldız çocuğun kendi başarısıysa
çocuk scope'u doğrudur (saydığı görev zaten çocuk başına seçiliyor). Bunu koda göre
seçmek mümkün değil; ürünün "bu yıldız kimin?" sorusuna cevabı gerekiyor. Ayrıca
scope değiştirmek saklanan bir anahtarın yerini değiştirmek demektir — bu turda
dokunulmaması istenen localStorage sözleşmesi — ve mevcut ailelerde bugünün hedefini
sessizce sıfırlar ya da iki kez saydırır. **Ertelendi, ürün kararına bağlandı.**

### 6.4 568×320 Family — ilk aksiyonların görünürlüğü ✅

**Önce (ölçülen):** ilk viewport'ta gerçekten kullanılabilir **tek** aksiyon vardı.
`Pick a Mission @97`; `Add a player` `@258` raporlanıyordu ama bottom nav'ın üst kenarı
`@248` idi — yani görünüyormuş gibi duruyor, tıklanamıyordu. Sekmenin geri kalanı
(takım kartı, View all, Create a Team) 320px'lik bir viewport'ta `@441`'den başlıyordu.

**Sonra (ölçülen ve hit-test edildi):**

```
navTop=267
Pick a Mission @87  → elementFromPoint: CLICKABLE
Add a player   @144 → elementFromPoint: CLICKABLE
```

Yapılan, yalnızca `@media (max-height:460px) and (orientation:landscape)` içinde:
başlık alt satırı gizlendi (zaten başlığı tekrar ediyordu), başlık 26px → 20px,
bottom nav sıkıştırıldı (butonlar 48px'te kaldı — 44px konfor tabanının ve WCAG 2.2
SC 2.5.8'in 24px eşiğinin üstünde), ve `#tabModes` zaten `flex-direction:column`
olduğu için `order` ile "Add a player" roster kartının üstüne alındı.

**DOM'a dokunulmadı.** Kaynak sırası — dolayısıyla portrait, ekran okuyucu sırası ve
her diğer boyuttaki tab sırası — aynı kaldı. Roster kartı bir aksiyon değil, bir durum
göstergesidir; 320px yüksekliğinde ikisini birden tutamayan tek viewport'ta aşağı
inmesi gereken odur.

`order` kullanmanın bilinen riski görsel sıra ile focus sırasının ayrışmasıdır
(WCAG 2.2 SC 1.3.2 / 2.4.3). Burada ayrışmadığı **ölçüldü**: roster kartının hiç
odaklanılabilir çocuğu yok, dolayısıyla landscape'te DOM sırası ile görsel sıra birebir
örtüşüyor.

```
DOM#0 y=87   Pick a Mission
DOM#1 y=144  Add a player
DOM#2 y=420  No team yet / Play missions together
DOM#3 y=490  View all
```

Ekranlar: `docs/audits/screens/faz5/568x320-*.png` (today, browse, modes, profile,
product-care, privacy) ve karşılaştırma için `390x844-*.png`.

---

## 6.5 Regresyon bataryası — bu turun değişikliklerinden sonra

Faz 5 değişiklikleri (app.js, index.html, warm-toy.css) uygulandıktan **sonra** önceki
tüm turların araçları yeniden koşuldu:

| Araç | Sonuç |
|---|---|
| `check-mission-schema.mjs` | ✅ 36/36 |
| `check-profile-team-isolation.mjs` | ✅ 5 pass, 0 fail |
| `check-profile-team-ux.mjs` | ✅ 12 pass, 0 fail |
| `check-mission-sheet-matrix.mjs` | ✅ 36/36 mission sheet uyumlu |
| `check-onboarding-occlusion.mjs` | ✅ hiçbir boyut/oryantasyonda CTA örtülmüyor |
| `check-a11y-controls.mjs` | ✅ isimler, label'lar, benzersiz id'ler, zoom |
| `check-nontext-contrast.mjs` | ✅ tüm gerekli sınır/state/focus ≥ 3:1 |
| `check-icon-glyphs.mjs` | ✅ her ikon sınıfı bir mask'e çözülüyor |
| `check-hub-mission-flow.mjs` (T29) | ✅ 6 pass, 0 fail (gerçek hub modülü) |
| `check-mission-play-state.mjs` | ✅ 31 pass, 0 fail, 1 bilgi, of 32 |
| `contrast-sweep.mjs` | ✅ 140 surface pass, 5562 metin düğümü, **0** AA altı |

Kontrast sweep'i özellikle önemli: bu turda hem yeni bir `!important` gizleme kuralı hem
de landscape'te font-size/padding değiştiren bir medya bloğu eklendi. Sweep bunların
hiçbirinin bir metni AA'nın altına düşürmediğini ölçtü.

## 7. Değişen dosyalar

| Dosya | Değişiklik |
|---|---|
| `app.js` | `switchTab()` re-entrancy sırası; `showHub3D()` reddi `false` döndürüyor; `applyHub3dUnsupported()` sınıf ekliyor; supported dalında sınıf temizleniyor; (bu turun başında) `doReset()` scope genişletildi |
| `index.html` | Product Care 7 maddesi yeniden sıralandı; Privacy ilk katmanı 8 → 5 karar + 3 yeni disclosure |
| `warm-toy.css` | `#advModeCard.hub3dUnsupported` gizleme kuralı; landscape Family sıkıştırma bloğu |
| `tools/check-install-offline-update-reset.mjs` | yeni — I01–I05, O01, U01–U06, R01–R04 |
| `tools/check-hub-fallback.mjs` | yeni — H01–H06 |
| `docs/audits/screens/faz5/` | yeni — 12 ekran görüntüsü |

## 8. Ertelenen riskler

- **`daily_challenge` scope asimetrisi** — §6.3. Ürün kararı bekliyor; kod değişmedi.
- **I05 (offline install)** — iOS satırı offline'da görünmeye devam ediyor. Ölçülüp
  kabul edildi (§1), gizlenmesi daha kötü olurdu; ama iOS dışı bir tarayıcı
  ileride offline'da `beforeinstallprompt` verirse yeniden bakılmalı.
- **568×320 roster kartı** hâlâ fold'un altında. Bilinçli: aksiyonlar öne alındı,
  durum göstergesi geriye. 320px yükseklikte ikisi birden sığmıyor.
- **Landscape sıkıştırma yalnızca `max-height:460px`** ile kapılı. Daha kısa ama
  portrait sayılan (ör. bölünmüş ekran) durumlar test edilmedi.
- **`timerState`** hâlâ literal bir `playFinished` değeri almıyor (Faz 3'ten devir).
- **Quick round** gate süresini kısaltmıyor (Faz 3'ten devir).
- **`/tr/`** bu turda hiç açılmadı; buradaki hiçbir düzeltme oraya taşınmadı.

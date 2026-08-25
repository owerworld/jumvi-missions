# Faz 7 — Daily Champion ürün kararı + Undo/Next yerleşimi

**Branch:** `claude/jumvi-visual-accessibility-k92evo` · **Baseline:** `9759697`
**Kapsam:** yalnızca İngilizce ana rota. `/tr/` açılmadı, değiştirilmedi.

Faz 6'da "ürün kararı gerekiyor" diye bırakılan iki maddenin uygulanması.

---

## 1. Önce düzeltmem gereken bir şey: Faz 5 ve Faz 6 raporlarımdaki hata

Faz 5 ve Faz 6'da `daily_challenge` scope asimetrisini şu görünür sonuçla raporlamıştım:

> "çocuk Dad ile bir görev bitirir → takımın Daily Champion'ı alınır. Aynı gün takımdan
> çıkarsa Today yeniden 0/1 gösterir ve aynı günün hedefi ikinci kez kazanılabilir."

**Bu senaryo gerçekleşemezdi.** Bu turda ilk iş olarak ölçtüm:

```
$ grep -rn "bumpDailyChallenge" --include=*.js --include=*.html .
./app.js:8614:function bumpDailyChallenge(){        ← tanım. Başka hiçbir çağrı yok.
```

`bumpDailyChallenge()` **hiçbir yerden çağrılmıyordu.** Temiz bir profille gerçek bir
görev tamamlayıp ölçtüm:

```
before play                 todayGoalBadge: "0/1 today"
                            jumvi_p1_daily_challenge_v1 = {"iso":"2026-08-25","count":0,"claimed":false}
after completing 1 mission  todayGoalBadge: "0/1 today"     ← değişmedi
                            jumvi_p1_daily_challenge_v1 = {"iso":"2026-08-25","count":0,"claimed":false}
probe done: [7]                                              ← görev gerçekten tamamlandı
```

Yani sayaç hiç artmıyordu, yıldız hiç kazanılmıyordu, dolayısıyla **iki kez kazanılması
da mümkün değildi**. Anahtarların scope'una ve `bumpDailyChallenge()`'ın içindeki
mantığa bakıp sonucu çıkarmıştım; o fonksiyonun hiç çağrılıp çağrılmadığını kontrol
etmemiştim. Raporladığım kullanıcı etkisi gerçek değildi.

**Ama yerine daha kötü ve gerçekten yaşanan bir kusur çıktı:** `#todayGoalBadge` Today
ekranında görünür (ölçüldü: `disp=flex`, 69×14 kutu) ve **sonsuza kadar "0/1 today"**
yazıyor. Aile ne yaparsa yapsın hareket etmeyen bir gösterge. Büyük "Today's Goal" kartı
zaten stylesheet'te emekliye ayrılmış (`#dailyChallenge{display:none !important}`), ama
küçük rozet ekranda bırakılmış.

Bu, ürün kararının uygulanabilmesi için önce çözülmesi gereken şeydi: kapalı bir
özelliğin scope'unu tanımlamak, ölü koda scope vermek olurdu.

---

## 2. Uygulanan ürün kararı

> "Bunu aktif takım/aile içinde ortak günlük görev olarak tanımla; solo kullanımda child
> scope kullan. Aynı aile/takım içinde takım değiştirerek aynı günlük yıldızın ikinci kez
> kazanılmasını engelle."

### Tasarım

| Katman | Nerede durur | Neden |
|---|---|---|
| **Sayaç** (`count`) | Değişmedi: takım aktifken takım prefix'i, solo iken çocuk prefix'i | Mevcut sözleşmeden hiçbir anahtar taşınmadı; her yüzey kendi dürüst sayısını gösterir |
| **Yıldız** (kazanıldı mı) | **Yeni, cihaz genelinde tek defter:** `jumvi_family_daily_star_v1` = `{ iso, scope }` | "Ortak günlük görev" tam olarak budur: günde bir kez, aileye ait |

**"Aile" bu uygulamada cihazdır.** `jumvi_profiles_v1` cihaz genelindedir ve bütün
çocukları tutar; başka bir aile kimliği yok. Bu, "ilerleme telefondan çıkmaz" sözünün
doğal sonucu. Aynı evdeki iki cihaz iki ayrı yıldız tutar — local-first'ün doğasında var
ve JUMVI'nin diğer bütün garantileriyle tutarlı.

### Veri sözleşmesi bunu güvenli destekliyor mu? — Evet

- **Hiçbir mevcut anahtar taşınmadı, yeniden adlandırılmadı veya şekli değiştirilmedi.**
- Eklenen tek şey yeni bir cihaz-geneli anahtar; bu zaten yerleşik bir kalıp
  (`jumvi_profiles_v1`, `jumvi_active_profile_v1`, `jumvi_seen`, `jumvi_visits` …).
- Dolayısıyla promptun "güvenli desteklemiyorsa kodu değiştirme" şartı devreye girmedi.

### Migration — mevcut ailelerin bugünü sessizce sıfırlanmıyor

Bu değişikliğin en riskli kısmı buydu. Bugün sabah yıldızı kazanmış bir ailenin bu
bilgisi **yalnızca** scope'lu `daily_challenge_v1` anahtarında duruyor, çünkü yeni build
yüklendiğinde defter henüz yok. Boş bir defter yazmak, o aileye aynı gün ikinci bir
yıldız vermek olurdu — yani düzeltmeye çalıştığımız şeyi bütün mevcut kullanıcılara
birden yapmak.

`familyDailyStar()` bu yüzden **tembel migration** yapıyor: bugün için defter yoksa,
cihazdaki her `daily_challenge_v1` anahtarı okunur ve bugüne ait bir claim varsa
devralınır. O anahtarlara hiçbir şey yazılmaz, hiçbiri silinmez — migration onları
yalnızca **okur**.

### Undo

Undo anlık görüntüsü artık defteri de taşıyor. Yanlışlıkla tamamla + Undo, ailenin o
günkü tek yıldızını yakmıyor.

### Reset

Defter cihaz geneli olduğu için reset onu da temizler ("press and hold to clear this
device"). Scope'lu anahtardan **sonra** temizleniyor; bu şu faydayı veriyor: bir sonraki
okumada `familyDailyStar()` defteri yeniden türetir ve az önce silinen scope'u devralamaz,
**ama** gerçekten bugün yıldızı kazanmış başka bir çocuğu devralabilir. Yani bir çocuğun
reset'i, başkasının claim'i dururken haneye ikinci yıldız vermez.

---

## 3. Testler — `tools/check-daily-star-scope.mjs`

Her geçiş **gerçek reload** ile yapılıyor, çünkü storage prefix'leri `const` ve yükleme
anında bir kez çözülüyor — gerçek profil/takım değişimi de tam olarak böyle çalışır.

| ID | Ne kanıtlıyor |
|---|---|
| D1 | takım t1 → solo → takım t2, aynı gün → **tek yıldız**; defter üç scope boyunca değişmiyor |
| D2 | ikinci çocuk ailenin yıldızını görüyor; oynaması ikinci yıldız üretmiyor; scope sayaçları dürüst kalıyor |
| D3 | **migration**: eski kodla bugünü kazanmış aile (legacy şekilli seed, defter yok) yıldızını koruyor, sonra takıma girip oynayınca ikinci yıldız çıkmıyor |
| D4 | dünkü claim bugünü engellemiyor |
| D5 | Undo yıldızı geri veriyor |
| D6 | gün dönünce yıldız yeniden kazanılabiliyor — ve gerçekten kazanılıyor |

---

## 4. Undo / Next yerleşimi

### Neden tek bir `bottom` değeriyle çözülemezdi

Undo bar'ı viewport'a sabit bir katmandayken, mission sheet'in kendi aksiyon satırıyla
yarışıyordu. Ölçümler:

```
320x568   actions 419-487   bar 436-496   → "Next"in %69'u örtülü
568x320   actions 297-361   ← 320px yüksekliğinde bir ekranda
844x390   actions 332-396   ← 390px yüksekliğinde bir ekranda
```

Landscape'te aksiyon satırı zaten ekranın altını **ve ötesini** kaplıyor. Bar'ı aşağı
almak orada çakışıyor, yukarı almak uzun portrait ekranlarda çakışıyor. Sayıyı ayarlamak
hatayı taşımaktan başka bir şey yapmıyor.

### Yapılan: yapısal çözüm

Mission sheet açıkken undo bar **fixed katmandan çıkıp sheet'in kendi akışına** giriyor,
aksiyon satırının hemen üstüne. Akış yerleşiminde örtüşme yapısal olarak imkânsızdır.
Sheet kapalıyken (sheet olmadan gelen bir tamamlama) eskisi gibi fixed overlay kalıyor.

Yol boyunca ölçümle bulunan iki gerçek engel:

1. **Düz akışta bar görünmüyordu.** Sheet scroll ediyor; bar aksiyonların üstünde kalıp
   ekranın tepesinden kayıp gidiyordu — 320×568'de `top=-12`, 568×320'de `top=-134`.
   Örtüşme yok, ama tamamen görünmez. Sebep: `#missionXpReward` tamamlama sonrası
   **378px** ve `min-height:auto` ile flex kolonda **küçülemiyor**, her şeyi dışarı
   itiyordu. Kutlama kartı sunumdur; artık küçülüyor ve kendi içinde scroll ediyor,
   kontroller kutularını koruyor.
2. **Bar ekranın en tepesine fırlıyordu.** `#sheet.isComplete` çocukları `order` ile
   yeniden diziyor (reward 1, actions 2, header 3); varsayılan 0'daki bar en başa
   gidiyordu. Artık `order: 1` ile ödül kartından hemen sonra geliyor.

Ayrıca: aria-live. Undo bar `role="status" aria-live="polite"`. DOM'da taşınması içeriği
varken ekran okuyucuya tekrar okutabilir, bu yüzden taşıma **her zaman bar gizliyken ve
metni yazılmadan önce** yapılıyor. Sheet, teklif hâlâ canlıyken kapanırsa bar body'ye
kurtarılıyor — beş saniye içinde sheet'i kapatmak Undo'yu götürmüyor.

### Doğrulama — `tools/check-undo-next-layout.mjs`

Scroll edilmemiş gerçek tamamlama ekranında, üç şey birden:
sıfır örtüşme · **ikisi de tam görünür** · ikisi de kendi merkezinden hit-test edilebilir.

| Viewport | Undo bar | Next | Örtüşme | İkisi de tam görünür | İkisi de tıklanabilir |
|---|---|---|---|---|---|
| 320×568 P | [333,393] | [421,477] | **0px** | ✓ | ✓ |
| 390×844 P | [504,564] | [592,648] | **0px** | ✓ | ✓ |
| 430×932 P | [548,608] | [636,692] | **0px** | ✓ | ✓ |
| 568×320 L | [89,149] | [177,233] | **0px** | ✓ | ✓ |
| 844×390 L | [159,219] | [247,303] | **0px** | ✓ | ✓ |

Ekranlar: `docs/audits/screens/faz7/{320x568,390x844,430x932,568x320,844x390}-undo-next.png`

`docs/audits/screens/faz6/` **kasıtlı olarak eski hâlinde bırakıldı.** Faz 6 raporu
`320x568-mission-done.png`'i örtüşmenin görsel kanıtı olarak gösteriyor;
`check-responsive-matrix.mjs` varsayılan olarak o klasöre yazdığı için bu turda üzerine
yazılmıştı, geri alındı. Faz 6 klasörü o turun tarihsel kaydıdır; bu turun ekranları
faz7 klasöründedir.

---

## 5. Regresyon — Faz 7 değişikliklerinden sonra

Hepsi bu turda, bu kodda, gerçek tarayıcıda:

```
check-daily-star-scope       (yeni)    6 pass,  0 fail
check-undo-next-layout       (yeni)    5 pass,  0 fail   (5 viewport)
check-mission-play-state              31 pass,  0 fail, 1 bilgi
check-responsive-matrix               24 pass,  0 fail
check-motion-liveregions               6 pass,  0 fail
check-dialog-contract                 12 pass,  0 fail
check-install-offline-update-reset    15 pass,  0 fail, 1 bilgi
check-persistence-flow                 9 pass,  0 fail, 1 envanter
check-runtime-health                   7 pass,  0 fail
check-zoom-textresize                 14 pass,  0 fail
```

Özellikle önemli olanlar:

- **`check-motion-liveregions` 6/6** — undo bar DOM'da taşınıyor ve `role="status"
  aria-live="polite"`. M06 tamamlama ve Undo'nun hâlâ **birer kez** duyurulduğunu ölçüyor;
  taşıma bir ek duyuru üretmiyor.
- **`check-mission-play-state` 31 pass** — Undo'nun 5 saniyelik transactional davranışı,
  timer, gate ve completion bozulmadı.
- **`check-persistence-flow` 9/9** — reset kapsamı ve profile/team izolasyonu korundu.
- **`check-runtime-health` 7/7** — yeni kod hiçbir exception veya unhandled rejection
  üretmiyor; gizlilik canary'si hâlâ temiz.

## 6. Değişen dosyalar

| Dosya | Değişiklik |
|---|---|
| `app.js` | `FAMILY_DAILY_STAR_KEY` + `familyDailyStar()` (tembel migration) + `claimFamilyDailyStar()`; `bumpDailyChallenge()` yıldızı kapılıyor ve **artık `markMissionDone()` içinden çağrılıyor**; `renderDailyChallenge()` aile defterini okuyor; Undo anlık görüntüsü ve reset defteri kapsıyor; `dockUndoBar()` ve `closeMission()` kurtarması |
| `style.css` | `#sheet .undoBar` akış yerleşimi, `#missionXpReward` küçülebilir/scroll, `#sheet.isComplete .undoBar{order:1}`, `undoInFlow` keyframe |
| `tools/check-daily-star-scope.mjs` | **yeni** — D1–D6 |
| `tools/check-undo-next-layout.mjs` | **yeni** — 5 viewport |
| `docs/audits/faz7-*.md`, `docs/audits/screens/faz7/` | **yeni** |

`index.html`, `data.js`, `warm-toy.css`, `jumvi-hub-app.js` bu turda değişmedi.
36 görev ID'si, pack anahtarları, 4 sekme, renk paleti, Leo ve `/tr/` korundu.

## 7. Ertelenen riskler

- **Daily Champion artık gerçekten kazanılıyor.** Bu, dormant bir özelliğin açılmasıdır:
  bir görev tamamlandığında artık bir toast ve (reduced motion kapalıysa) konfeti çıkar.
  Faz 6'ya kadar hiçbiri olmuyordu. Bu istenmiyorsa geri almak tek satır:
  `markMissionDone()` içindeki `bumpDailyChallenge();` çağrısını kaldırmak yeterli —
  scope mantığı ve migration yerinde kalır, yalnızca sayaç durur.
- **"Aile" = cihaz.** Aynı evdeki iki telefon iki ayrı yıldız tutar. Local-first
  sözleşmesinin doğal sonucu; cihazlar arası tek bir yıldız hesap/senkronizasyon
  gerektirirdi ki bu ürünün "hesap yok" sözüne aykırı.
- **Reset defteri temizler.** Bir çocuğun reset'i, başka bir çocuğun bugünkü claim'i
  duruyorsa yıldızı geri getirmez (migration onu devralır); ama hiç kimsenin claim'i
  kalmamışsa gün yeniden açılır. Bu, "clear this device" etiketiyle tutarlı.
- **Tamamlama ekranındaki toast ile undo bar** artık farklı bölgelerde; 320×568'de toast
  üstte, undo bar ödül kartının altında. Ekran görüntüleriyle doğrulandı.
- **`/tr/`** bu turda açılmadı; buradaki hiçbir değişiklik oraya taşınmadı.

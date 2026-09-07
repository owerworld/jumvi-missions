# Faz 8 — Release doğrulaması (release candidate: `83ef808`)

**Amaç:** yeni özellik veya görsel değişiklik yapmadan, `83ef808` commit'inin
production'a hazır olup olmadığını temiz state'te tüm regresyon paketini bir kez
daha çalıştırarak kanıtlamak.

**Uygulama kodu bu turda değişmedi.** `git diff 83ef808 -- index.html app.js
style.css warm-toy.css tr/` boş döner. Tek değişiklik bir test aracına eklenen
screenshot desteğidir (aşağıda).

---

## 1. Ortam

| | |
|---|---|
| Aktif branch | `claude/jumvi-visual-accessibility-k92evo` |
| Baseline commit | `83ef808` — *Make the daily star the family's, and give Undo its own box* |
| Çalışma ağacı | Testler başlarken temiz (`git status --short` boş) |
| Sunucu | `npx http-server -p 8910 -c-1` → `http://localhost:8910/index.html` |
| Tarayıcı | Chromium `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`, headless |
| Playwright | `/opt/node22/lib/node_modules/playwright` |
| Tarih (test) | 2026-08-25 |

3D hub testleri `--use-gl=swiftshader --enable-unsafe-swiftshader
--ignore-gpu-blocklist` ile gerçek WebGL2 bağlamı alır; hub sahte değildir.

---

## 2. Değişen dosyalar ve amaçları

| Dosya | Değişiklik | Neden |
|---|---|---|
| `tools/check-daily-star-scope.mjs` | `--shots=DIR` seçeneği ve 6 screenshot noktası | Kullanıcı Daily Champion sonucunun **gerçek screenshot** ile de kanıtlanmasını istedi. Araç daha önce yalnızca ledger/DOM değeri yazıyordu. Assertion'lar değişmedi; `--shots` verilmezse davranış birebir eskisi. |

Uygulama kodunda (`app.js`, `style.css`, `warm-toy.css`, `index.html`, `tr/`)
**hiçbir değişiklik yok** — gerçek bir regresyon bulunmadığı için.

---

## 3. Çalıştırılan kesin komutlar

Ortak ön ayar:

```bash
export JUMVI_PW=/opt/node22/lib/node_modules/playwright
export JUMVI_EXE_CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome
setsid npx http-server -p 8910 -c-1 </dev/null &
```

```bash
node tools/check-mission-schema.mjs
node tools/check-mission-sheet-matrix.mjs
node tools/check-onboarding-occlusion.mjs
node tools/check-mission-play-state.mjs
node tools/check-hub-mission-flow.mjs
node tools/check-profile-team-isolation.mjs
node tools/check-daily-star-scope.mjs      --shots=docs/audits/screens/faz8
node tools/check-responsive-matrix.mjs     --shots=docs/audits/screens/faz8
node tools/check-zoom-textresize.mjs       --shots=docs/audits/screens/faz8
node tools/check-dialog-contract.mjs
node tools/check-motion-liveregions.mjs
node tools/check-install-offline-update-reset.mjs
node tools/check-runtime-health.mjs
node tools/check-persistence-flow.mjs
node tools/contrast-sweep.mjs
node tools/check-nontext-contrast.mjs
node tools/check-a11y-controls.mjs
node tools/check-tr-invariants.mjs
```

> **`--shots` zorunludur.** `check-responsive-matrix.mjs` ve
> `check-zoom-textresize.mjs` varsayılan olarak `docs/audits/screens/faz6`
> dizinine yazar. Bayrak verilmezse Faz 6 kanıtları sessizce ezilir. Bkz. bölüm 7.

> **Faz 9 sonrası not.** Bu bölüm bir *çalıştırma listesiydi*; aşağıdaki sonuç
> tablosu ise o günkü kaydı olduğu gibi koruyor. `check-undo-next-layout.mjs`
> Faz 9'da Undo bar ile birlikte silindi (bkz.
> `docs/audits/faz9-undo-bar-kaldirma.md`), bu yüzden komut listesinden
> çıkarıldı — 8 numaralı satır tarihsel kayıt olarak duruyor, koşulacak bir
> adım olarak değil.

---

## 4. Test sonuçları

| # | Test | Beklenen | Sonuç | Durum |
|---|---|---|---|---|
| 1 | `check-mission-schema` | 36/36 | 36/36 şemaya uyuyor; id, başlık, pack tutarlı | **pass** |
| 2 | `check-mission-sheet-matrix` | 36/36 | 36/36 tam uyumlu; 3+ oyunculu 8 görevin 8'inde rol kartı | **pass** |
| 3 | `check-onboarding-occlusion` | 12/12 | 12/12 — CTA 52px, hiçbir şey örtülmüyor | **pass** |
| 4 | `check-mission-play-state` | 31/0 | 31 pass, 0 fail, 1 bilgilendirme (T29) | **pass** |
| 5 | `check-hub-mission-flow` (T29) | gerçek hub | 6 pass, 0 fail, 0 untested | **pass** |
| 6 | `check-profile-team-isolation` | izolasyon | 5 pass, 0 fail | **pass** |
| 7 | `check-daily-star-scope` | D1–D6 | 6 pass, 0 fail | **pass** |
| 8 | `check-undo-next-layout` | 5/5 | 5 pass, 0 fail (5 viewport, overlap 0px) | **pass** |
| 9 | `check-responsive-matrix` | 24/24 | 24 pass, 0 fail, 0 skipped | **pass** |
| 10 | `check-dialog-contract` | 12/12 | 12 pass, 0 fail, 13 yüzeyin 12'si (1'i ölü markup) | **pass** |
| 11 | `check-motion-liveregions` | 6/6 | 6 pass, 0 fail | **pass** |
| 12 | `check-zoom-textresize` | 14/14 | 14 pass, 0 fail | **pass** |
| 13 | `check-install-offline-update-reset` | 15/15 | 15 pass, 0 fail, 1 bilgilendirme | **pass** |
| 14 | `check-runtime-health` | 7/7 | 7 pass, 0 fail | **pass** |
| 15 | `contrast-sweep` | AA | 140 yüzey, 5562 metin düğümü, 0 AA altı | **pass** |
| 16 | `check-persistence-flow` | — | 9 pass, 0 fail, 1 envanter | **pass** |
| 17 | `check-nontext-contrast` | 3:1 | Tüm sınır/durum/odak halkaları ≥ 3:1 | **pass** |
| 18 | `check-a11y-controls` | — | Her kontrol adlandırılmış, id'ler tekil | **pass** |
| 19 | `check-tr-invariants` | değişmez | Tüm değişmezler yerinde | **pass** |

**Toplam: 19 paket, 0 fail, 0 atlanmış test.**

### Bilgilendirme sayılan (fail olmayan) üç kalem

- **T29 (`check-mission-play-state`)** — bu dosyada ölçülmez; `openMissionFromHub`
  hub modülünün kendi kapsamında, `window`'da değil. Gerçek karşılığı
  `check-hub-mission-flow.mjs`: orada 6/6.
- **`check-install-offline-update-reset`** — 1 bilgilendirme: gerçek
  `BeforeInstallPromptEvent` testte üretilemez.
- **`check-nontext-contrast`** — `span.packDot` 1.11:1. Dekoratif; bilgi taşımaz,
  SC 1.4.11 kapsamı dışında. Raporlanır, fail sayılmaz.

---

## 5. Özel kanıt 1 — Undo ve Next 320×568'de örtüşmüyor

Ölçüm: sayfa kaydırılmadan, görev tamamlandıktan sonra, `getBoundingClientRect`
ile dikey aralık + `document.elementFromPoint` ile hit-test.

| Viewport | Undo bar [top,bottom] | Next [top,bottom] | Örtüşme | İkisi de tam görünür | İkisi de tıklanabilir |
|---|---|---|---|---|---|
| **320×568** | [333, 393] | [421, 477] | **0px** | ✓ | ✓ |
| 390×844 | [504, 564] | [592, 648] | 0px | ✓ | ✓ |
| 430×932 | [548, 608] | [636, 692] | 0px | ✓ | ✓ |
| 568×320 | [89, 149] | [177, 233] | 0px | ✓ | ✓ |
| 844×390 | [159, 219] | [247, 303] | 0px | ✓ | ✓ |

320×568'de iki kontrol arasında **28px** boşluk var. Undo bar `position: static`
ve `#sheet` içinde akışta (`docked inside #sheet=true`) — yani tek bir `bottom`
değerine bağlı değil, geometrik olarak örtüşmesi mümkün değil. Bu, sorunu başka
bir viewport'a taşımayan yapısal çözümdür.

**Görsel kanıt:** `docs/audits/screens/faz8/320x568-undo-next.png` — "Marked done
· Undo" kutusu ile "→ Next Mission!" düğmesi ayrı, üst üste binmiyor, ikisi de
tam olarak ekranda.

---

## 6. Özel kanıt 2 — Aynı gün ikinci Daily Champion yıldızı kazanılamıyor

Her geçiş **gerçek reload**'dur, çünkü storage prefix'leri yüklenirken bir kez
çözülen `const`'lardır — gerçek profil/takım değişimi de böyle çalışır.

| ID | Senaryo | Sonuç |
|---|---|---|
| **D1** | Aynı gün: takım t1 → solo → takım t2 | Ledger üç kapsamda da **değişmedi**: `{"iso":"2026-08-25","scope":"jumvi_p1_team_t1_daily_challenge_v1"}`. Solo ekranı: *"Your family already earned today's star — keep playing for fun!"* |
| **D2** | İkinci çocuk (p2) aynı gün oynuyor | Ledger `p1` kapsamında sabit kaldı. p2 oynadıktan sonra da `status="1 / 1"`. Kapsam sayaçları dürüst kalıyor: `p1={count:1,claimed:true}`, `p2={count:1,claimed:false}` |
| **D3** | **Migration:** eski kodla bugün yıldızı zaten kazanmış aile | Mevcut claim ledger'a benimsendi (`migrated:true`); takıma girip oynayınca ledger değişmedi. Kimsenin bugünü sıfırlanmıyor, kimseye ikinci yıldız verilmiyor. |
| **D4** | Dünkü claim | Bugünü engellemiyor; ledger temiz açılıyor |
| **D5** | Undo | Ailenin yıldızını geri veriyor, günü yakmıyor |
| **D6** | Gün dönümü | Yıldız yeniden kazanılabilir |

**Görsel kanıt** (`docs/audits/screens/faz8/`):

- `daily-star-d1-a-team-t1-earned.png` — yıldız takım t1'de kazanıldı
- `daily-star-d1-b-solo-before-playing.png` — solo'ya geçiş
- **`daily-star-d1-c-team-t2-before-playing.png`** — en güçlü tek kare: takım t2
  kendi kapsamında **0 / 36 mission** ile bomboş, ama başlıkta yine
  **"Goal done!"** yazıyor. Yıldız takımın değil, **ailenin**.
- `daily-star-d1-d-team-t2-after-playing.png` — t2'de oynadıktan sonra da ikinci
  yıldız/kutlama yok
- `daily-star-d2-a-child2-before-playing.png`, `daily-star-d2-b-child2-after-playing.png`

> Not: büyük "Today's Goal" kartı stylesheet'te bilerek emekli
> (`#dailyChallenge{display:none !important}`); ailenin gerçekten gördüğü yüzey
> başlıktaki `#todayGoalBadge` rozetidir. Screenshot'lar bu yüzden tam sayfa.

---

## 7. Test artifact'ları — önceki kanıtlar ezilmedi

Testlerden **önce** mevcut 71 screenshot'ın SHA-256 özeti alındı, **sonra**
yeniden doğrulandı:

```
71 / 71 unchanged
git status --short docs/audits/screens/  →  ?? docs/audits/screens/faz8/
```

`faz5` (12), `faz6` (54) ve `faz7` (5) dosyalarının hepsi bayt bayt aynı. Bu
turun 65 screenshot'ı yalnızca yeni `docs/audits/screens/faz8/` dizinine yazıldı.

Bu gerçek bir tehlikeydi: önceki turda `check-responsive-matrix.mjs` varsayılan
`--shots` değeriyle çalıştırıldığında 9 adet Faz 6 screenshot'ını — Faz 6
raporunun Undo/Next örtüşmesinin görsel kanıtı olarak gösterdiği
`320x568-mission-done.png` dahil — üzerine yazmıştı.

**Artifact yolları**

- Screenshot'lar: `docs/audits/screens/faz8/` (65 dosya)
- Ham test log'ları: oturum scratchpad'i,
  `.../scratchpad/logs/<araç-adı>.log` (19 dosya)

---

## 8. Bilinen ve ertelenen riskler

| # | Risk | Değerlendirme |
|---|---|---|
| 1 | **Daily Champion artık gerçekten kazanılabilir.** `bumpDailyChallenge()` uzun süre çağrısızdı; `83ef808` onu `markMissionDone()` içine bağladı. Yani ilk kez bir toast + konfeti görünecek. | Kasıtlı ve istenen davranış — rozet daha önce sonsuza dek "0/1 today" gösteriyordu. Geri almak isterseniz tek satır: `markMissionDone()` içinden `bumpDailyChallenge();` satırını çıkarmak. Kapsam mantığı ve migration bozulmadan kalır. |
| 2 | Gerçek `BeforeInstallPromptEvent` test edilemiyor | Yalnızca gerçek cihazda doğrulanabilir. Kod yolu incelendi, dead CTA yok. |
| 3 | `span.packDot` 1.11:1 | Dekoratif, bilgi taşımıyor; WCAG kapsamı dışında. Ertelendi. |
| 4 | `check-dialog-contract`'ta 1 ölü markup yüzeyi | Kaldırmak QA düzeltmesi değil refactor olur; dokunulmadı. |
| 5 | Undo anlık görüntüsü yalnızca bellekte | Tasarım gereği: cihazda yeni bir çocuk verisi anahtarı oluşturulmuyor. Reload teklifi bitirir, tamamlanma korunur (T25). |
| 6 | `check-mission-play-state` ilk turda tarayıcı süreci T26 sırasında çöktü (`Target page, context or browser has been closed`) | Assertion hatası değil. O ana kadar 29 test geçmişti; kalan T26/T29/T30 tek başına geçti, ardından **tüm dosya baştan sona temiz çalıştırıldı: 31 pass, 0 fail, 1 bilgilendirme**. Disk ve bellek boldu (30G boş, 14.5G boş RAM). Altyapı kaynaklı tek seferlik olay; rapordaki 31/0 sayısı çökmeyen tam turdan alınmıştır. |

---

## 9. Karar

Uygulama kodunda bu turda hiçbir değişiklik gerekmedi: 19 test paketinin
tamamı temiz state'te geçti, kullanıcının özellikle kanıt istediği iki sonuç
(320×568 Undo/Next örtüşmemesi ve aynı gün ikinci Daily Champion yıldızının
kazanılamaması) hem sayısal ölçüm hem gerçek screenshot ile doğrulandı, önceki
turların kanıtları ezilmedi.

# RELEASE READY

Kapsam dışı bırakılanlar (kullanıcı talimatı): `main`'e merge yok, PR yok,
production deploy yok. TR rotasına, renk paletine, Leo'ya, 4 sekmeye, 36 görev
ID'sine ve localStorage sözleşmesine dokunulmadı — hepsi test ile doğrulandı.

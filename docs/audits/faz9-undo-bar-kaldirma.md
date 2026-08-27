# Faz 9 — "Marked done / Undo" bar'ının tamamen kaldırılması

**Talep:** Undo butonunu komple kaldır.
**Taban:** `7157eab` (merge sonrası main).

---

## 1. Kaldırılanlar

| Katman | Ne gitti |
|---|---|
| `index.html` | `#undoBar` markup'ı (`.undoBarText` + `#undoBtn`) |
| `app.js` | `showUndoBar()`, `endUndoOffer()`, `dockUndoBar()`, `captureJourneySnapshot()`, `restoreJourneySnapshot()`, `restoreLsRaw()`, `_undoTimer`, `_undoOffer` |
| `app.js` | `markMissionDone()` içindeki snapshot alma ve `showUndoBar(...)` çağrısı |
| `app.js` | `closeMission()` içindeki "bar'ı sheet'ten kurtar" bloğu |
| `app.js` | Test probe'undaki `undoBarVisible`, `HUB_BACKGROUND_SELECTORS`'taki `#undoBar` |
| `style.css` | `.undoBar`, `.undoBarBtn`, `#sheet .undoBar`, `#sheet.isComplete .undoBar`, `@keyframes undoIn` / `undoInFlow` ve reduced-motion eşleri |
| `warm-toy.css` | `#undoBar.undoBar{ z-index:9600 }` |
| `tools/` | `check-undo-next-layout.mjs` (dosyanın tamamı Undo bar'a dairdi) |

Depo genelinde `undoBar` / `undoBtn` referansı kalmadı.

## 2. Bilerek korunanlar

- **`mission_undo` beacon'ı** allowlist'te ve Worker'da duruyor. İstemci artık göndermiyor, ama analytics deposundaki geçmiş verinin adı çözülmeye devam etmeli. `check-beacon-schema` ve haftalık snapshot araçları buna bağlı.
- **`#btnToggleDone`** — tamamlamadan sonra "Mark as Not Done" oluyor. Geri alma yolu artık **sadece** bu.
- **`#sheet .missionXpReward{min-height:0; overflow-y:auto}`** ve `#sheet .sheetActions{flex:0 0 auto}` — ilk olarak Undo bar için yazılmışlardı, ama aynı aritmetik hâlâ kısa sheet'lerde "Next" ve "Back to Play"in ekranda kalmasını sağlıyor. Kaldırmak aksiyon satırını ekran dışına iterdi.

## 3. Ölçülen davranış değişikliği

Gerçek tarayıcıda, temiz profille:

| | done | xp | streak | lastActive | günlük yıldız |
|---|---|---|---|---|---|
| başlangıç | 0 | 0 | 0 | — | yok |
| tamamlandı | 1 | 10 | 1 | 2026-08-27 | **claimed** |
| Mark as Not Done | 0 | 0 | **1** | **2026-08-27** | **claimed** |

**Sonuç:** yanlışlıkla yapılan bir tamamlama artık geri alınamıyor — yalnızca görev ve XP dönüyor. Streak günü ve ailenin o güne ait Daily Champion yıldızı harcanmış kalıyor.

Bu, `#btnToggleDone`'ın öteden beri süregelen tasarımı (§5.4: "sonradan yapılan bir un-mark, ailenin gerçekten oynadığı bir günün geçmişini yeniden yazmaz"). Eskiden 5 saniyelik Undo bu kuralın istisnasıydı; artık istisna yok.

## 4. Testler

Kaldırılanlar (hepsi Undo penceresine dairdi, karşılığı kalmadı):

- `T22` Undo penceresi dolduktan sonra etkisiz
- `T23` ikinci Undo dokunuşu no-op
- `T24` Undo ödül takeover'ının üstünde erişilebilir
- `T25` reload Undo teklifini bitiriyor
- `check-undo-next-layout.mjs` (5 viewport)

Gerçeğe göre yeniden yazılanlar:

| Test | Yeni iddia |
|---|---|
| `T17` | tamamlama çalışıyor **ve DOM'da hiç `#undoBar` yok** |
| `T21` | Mark as Not Done görevi ve XP'yi geri veriyor, streak gününü koruyor |
| `D5` | Undo bar yok; Mark as Not Done yıldızı **geri vermiyor** (maliyet ölçülüyor, varsayılmıyor) |
| `M06` | tamamlama tek başına duyuruluyor |
| `P6.7` | Mark as Not Done semantiği |
| `O01` | offline akışta un-mark |
| `T29.3` | hub tamamlamasını un-mark etmek hub'ı yıkmıyor |
| `responsive .mission` | "Next" kutlama kartının altında erişilebilir kalıyor |
| `check-mission-entry-sources` | `trackEntry:false` çağrı yeri sayısı 3 → **2** |

**Boş kalan iddia düzeltildi:** `T14` hâlâ `!after.undoBarVisible` kontrol ediyordu. Probe artık o alanı döndürmediği için `!undefined === true` oluyor ve test hiçbir şey ölçmeden geçiyordu. Kaldırıldı.

## 5. Sonuçlar — 20 paket, 0 fail

```
mission schema 36/36 · sheet matrix 36/36 · onboarding 12/12
play state 27/0 (1 info) · hub T29 6/6 · profile/team isolation 5/5
daily star D1–D6 6/6 · responsive 24/24 · zoom 14/14
dialogs 12/12 · reduced motion 6/6 · persistence 9/9
install/offline/update/reset 15/15 · runtime 7/7
contrast sweep: 134 yüzey, 5400 metin düğümü, 0 AA altı
non-text contrast · a11y controls · TR + localStorage invariants
beacon schema · event coverage · analytics compliance
mission entry sources · snapshot availability
```

play-state 31 → 27: kaldırılan 4 test kadar. Kontrast 140 → 134 yüzey: "Undo bar" yüzeyi düştü.

## 6. Dikkat edilmesi gerekenler

1. **Yanlış dokunuşun maliyeti arttı** (bölüm 3). Ürün kararı olarak kabul edilmiş sayıyorum; istenirse telafi yolu, `markMissionUndone` yolunun aynı gün içinde yıldızı da geri vermesi olurdu — ama bu, un-mark'ın mevcut sözleşmesini değiştirir.
2. **Rozet açılış gecikmesi (5.4s) korundu.** Tek gerekçesi 5 saniyelik Undo penceresinin dışında kalmaktı; artık gerekçesiz bekliyor. Kutlama temposunu değiştirmek ayrı bir ürün kararı olduğu için dokunmadım, yorumu dürüst hâle getirdim. Kısaltmak isterseniz tek satır.
3. `localStorage` sözleşmesi değişmedi — hiçbir anahtar eklenmedi/silinmedi; yalnızca bir geri-yükleme yolu kalktı.
4. TR rotası, renk paleti, Leo, 4 sekme ve 36 görev ID'sine dokunulmadı.

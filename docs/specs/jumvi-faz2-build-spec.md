# JUMVI — Faz 2 Build Spec'i (Ar-Ge Ölçümü + Panel)

**Repo:** `owerworld/jumvi-missions` (`~/Developer/jumvi-missions`)
**Tip:** Build. Kod yazılacak, commit atılacak.
**Amaç:** Uygulamanın kendisini geliştirmek için ölçüm — hangi içerik tutuyor, hangi özellik ölü, sonraki sürüm nasıl olmalı.

---

## ÖNKOŞUL — Faz 1 tamamlandı

| Madde | Durum |
|---|---|
| Beacon (5 event) canlıda, WAE'ye yazıyor | ✅ `jumvi_events_v1` |
| Asset health monitor | ✅ |
| Privacy policy | ✅ "Anonymous play analytics" canlıda |
| Haftalık snapshot script'i | ✅ `tools/generate-weekly-snapshot.mjs` |
| Domain doğru Workers projesinde | ✅ `qr.jumvi.co` |

---

## GLOBAL KURALLAR

1. **Her görev ayrı session.** Aralarında `/clear`.
2. **Şema DEĞİŞMİYOR.** Faz 1'de dondurulan düzen aynen korunacak:
   ```
   blob1  = event adı
   blob2  = string prop (boşsa "")
   double1 = sayısal prop (yoksa 0)
   index1 = event adı
   ```
   Aşağıdaki 14 event bu şemaya sığıyor — yeni kolon açma.
3. **Kimlik yok.** Hiçbir event'e UUID, IP, cihaz kimliği, çocuk adı, profil adı eklenmeyecek.
4. **Serbest metin yok.** Tüm `blob2` değerleri sabit enum ya da sayı.
5. **`trackEvent` ölü kalacak.** Kodda 45 ölü `trackEvent()` çağrısı var. Bunların **sadece bu spec'te listelenen 14'ü** `beacon()`'a bağlanacak. Kalan 31'i olduğu gibi ölü kalacak — hepsini bağlamak ölçüm setini kullanılamaz hale getirir.
6. **`beacon()` allowlist'i genişletilecek**, ama yine allowlist olarak kalacak — listede olmayan hiçbir event geçmeyecek (hem client hem worker tarafında).

---

# GÖREV 2.1 — 14 Ölçüm Noktasını Bağla

**Model:** opusplan (event isimleri geri alınamaz — plan sun, onay bekle)

## Event listesi (KESİN — isimler değişmeyecek)

| # | Event adı | `blob2` | `double1` | Tekrar kuralı |
|---|---|---|---|---|
| 1 | `pack_view` | pack key (6 sabit) | 0 | Oturumda paket başına 1 kez |
| 2 | `pack_complete` | pack key | 0 | Doğal olarak 1 kez |
| 3 | `daily_pick_tap` | `""` | 0 | Oturumda 1 kez |
| 4 | `badge_earned` | badge id (11 sabit) | 0 | Doğal olarak 1 kez |
| 5 | `certificate_made` | `""` | 0 | Oturumda 1 kez |
| 6 | `share_tap` | `whatsapp` \| `native` \| `copy` | 0 | Her seferinde |
| 7 | `speak_on` | `""` | 0 | Oturumda 1 kez |
| 8 | `timer_start` | `""` | mission id | Oturumda görev başına 1 kez |
| 9 | `score_saved` | `""` | 0 | Her seferinde |
| 10 | `dashboard_open` | `""` | 0 | Oturumda 1 kez |
| 11 | `missionbook_get` | `""` | 0 | Her seferinde |
| 12 | `profile_add` | `""` | 0 | Her seferinde |
| 13 | `progress_reset` | `""` | 0 | Her seferinde |
| 14 | `hub3d` | `shown` \| `entered` \| `ready` \| `moved` \| `mission` \| `failed` \| `escaped` | 0 | Oturumda adım başına 1 kez |
| 15 | `app_first_open` | `""` | 0 | **Cihaz başına hayatta 1 kez** (localStorage işareti) |
| 16 | `return_visit` | `""` | ziyaret no | Sadece 2., 3., 5., 10. gelişte |

## Tekil sayım sorunu — 15 ve 16 neden var

Mevcut `app_open` her tarayıcı oturumunda tetikleniyor. Yani aynı hane ertesi gün
tekrar gelirse 2 sayılıyor, iki telefon kullanılırsa 2 sayılıyor. Bu tek başına
"187 kişi" gibi okunursa yanıltıcı olur.

Çözüm sayımı azaltmak değil, **üç farklı sayıyı ayırmak:**

| Event | Ölçtüğü |
|---|---|
| `app_first_open` | Kaç farklı cihaz hiç ulaştı — **erişim** |
| `app_open` | Toplam oturum — **kullanım** |
| `return_visit` | Kaç cihaz geri döndü — **tutundurma** |

### Uygulama kuralları

- `app_first_open`: `localStorage`'a kalıcı bir işaret yazılır (ör. `jumvi_seen`).
  İşaret varsa event **hiç** gönderilmez. İşaretin kendisi asla sunucuya gitmez.
- `return_visit`: cihaz `localStorage`'da bir ziyaret sayacı tutar. Sunucuya
  **yalnızca eşik değerlerinde** (2, 3, 5, 10) ve **yalnızca sayı** gönderilir.
  Ara değerlerde (4., 6., 7. ziyaret) hiçbir şey gönderilmez.
- Hiçbir kimlik, UUID, cihaz parmak izi üretilmeyecek. Sayaç cihazın içinde kalır,
  dışarı sadece eşiğe ulaşıldığı bilgisi çıkar. Sunucuda "hangi cihaz kaçıncı kez
  geldi" diye bir kayıt oluşmaz — sadece "N cihaz 2. ziyarete ulaştı" toplamı görünür.
- Ziyaret tanımı: aynı oturumda tekrar tetiklenmemeli. `app_open`'ın oturum
  guard'ıyla aynı mantığı kullan.

### Panelde nasıl sunulacak

Huni şu şekilde okunacak:

```
1.008 satıldı
  → 187 farklı cihaz açtı        (app_first_open)
  → 412 toplam oturum            (app_open)
  →  63 ikinci kez geldi         (return_visit = 2)
  →  21 beşinci kez geldi        (return_visit = 5)
```

**Dürüstlük etiketi zorunlu.** `app_first_open` kesin kullanıcı sayısı değildir:
aynı hanede iki cihaz iki sayılır, tarayıcı verisi temizlenirse yeniden sayılır,
tek telefonu paylaşan iki çocuk bir sayılır. Panelde ve snapshot metodoloji notunda
**"yönsel tahmin"** olarak etiketlenecek, kesin sayı gibi sunulmayacak.

## Bağlanacak mevcut noktalar

Bunlar kodda **zaten var**, sadece ölü `trackEvent`'e bağlılar. Yeni hook yazma, mevcutları yönlendir:

```
Pack Completed          → pack_complete
Coach Pick Tapped       → daily_pick_tap
Read Aloud Toggled      → speak_on        (sadece açılışta, kapanışta değil)
Score Recorded          → score_saved
Profile Added           → profile_add
Progress Reset          → progress_reset
Dashboard Share WhatsApp/Native/Copy → share_tap {channel}
Hub3D Entered/Load Failed/Load Escaped/Exited/Mission Completed → hub3d {step}
```

Karşılığı olmayan, yeni eklenecekler: `pack_view`, `badge_earned`, `certificate_made`,
`timer_start`, `dashboard_open`, `missionbook_get`, ve `hub3d`'nin `shown`/`ready`/`moved` adımları.

## Kritik gizlilik notu — `profile_add`

Profil ekleme event'i **yalnızca olayın gerçekleştiğini** bildirecek. Çocuğun adı,
yaşı, avatarı — hiçbiri gönderilmeyecek. Bu event'in tek amacı "çoklu çocuk özelliği
yaşıyor mu" sorusunu cevaplamak.

## Doğrulama (rapora yazılacak)

1. Tarayıcıda gerçek akış: paket gez → görev aç → zamanlayıcı → bitir → rozet → sertifika.
   Her adımda ağ isteğini yakala, payload'da **sadece** `e` + tek skaler olduğunu göster.
2. Tekrar kuralları çalışıyor mu: aynı paketi iki kez gez, ikinci kez event gitmemeli.
3. Allowlist dışı bir event denemesi reddedilmeli (client + worker, iki katman).
4. `grep` ile kanıt: IP / UA / `request.cf` / profil adı / çocuk adı hiçbir payload'da yok.
5. **Test verisi kirlenmesi:** Bu doğrulama WAE'ye satır yazacak. Test başlangıç/bitiş
   zamanını UTC olarak rapora yaz — snapshot'ta `--since` ile dışlanacak.

## Rapor

`docs/audits/faz2-events.md`

---

# GÖREV 2.2 — Snapshot Script'ini Genişlet

**Model:** Sonnet
**Bağımlılık:** 2.1 canlıya çıktıktan sonra.

## Ne değişiyor

`tools/generate-weekly-snapshot.mjs` şu an 5 event'i topluyor. 14 event daha eklenecek,
**artı** görev meta-verisiyle çapraz okumalar.

## Çapraz okumalar — bedava veri

`data.js` içindeki her görev zaten şu etiketleri taşıyor:

```js
m(3, "Reflex Rush", "Quick Slap", zorluk:2, oyuncu:"2", süre:"60s", yaş:"6+", ...)
```

`mission_start` / `mission_complete` event'lerindeki `mission_id`'yi bu tabloyla
birleştirerek şu kırılımlar üretilecek — ekstra event gerekmeden:

| Kırılım | Ne söyler |
|---|---|
| Yaş etiketi (3+ / 4+ / 6+) | Kutudaki "Ages 3-8" doğru mu |
| Zorluk (1 / 2 / 3) | Seviye merdiveni çalışıyor mu |
| Oyuncu (2 / 2-3 / 3+) | 4 raket iddiası gerçekte karşılık buluyor mu |
| Süre (45s / 60s / ...) | Uzun görevler daha çok mu terk ediliyor |
| Paket → mekan (Indoor Fun vs Outdoor) | İç mekan ürünü mü dış mekan mı |

**Teknik not:** `data.js` bir tarayıcı script'i (`const missions = [...]`, `m()` helper'ı ile).
Node'dan okumak için ya güvenli bir sandbox'ta değerlendir ya da bir kerelik
`data/missions-meta.json` üret. İkincisi tercih edilir — deterministik ve denetlenebilir.
**Meta dosyayı elle yazma, `data.js`'ten türet** ki görev verisi değişirse senkron kalsın.

## Genişletilmiş JSON formatı

Mevcut alanlar korunacak, üstüne eklenecek:

```json
{
  "week": "2026-36",
  "period_start": "2026-08-31",
  "period_end": "2026-09-06",
  "generated_at": "2026-09-07",
  "excluded_before": null,

  "app_opens": 187,
  "mission_starts": 412,
  "mission_completes": 251,
  "recorded_completion_ratio": 0.61,

  "help_opens":   { "...": 0 },
  "player_count": { "2": 54, "3": 16, "4": 30 },

  "packs": {
    "Aim Master":     { "views": 88, "starts": 144, "completes": 92, "completed_pack": 3 },
    "Focus Control":  { "views": 0,  "starts": 0,   "completes": 0,  "completed_pack": 0 }
  },

  "missions": {
    "1":  { "starts": 68, "completes": 57 },
    "31": { "starts": 48, "completes": 6 }
  },

  "by_age":        { "3+": 0.54, "4+": 0.33, "6+": 0.13 },
  "by_difficulty": { "1": 0.61, "2": 0.31, "3": 0.08 },
  "by_players":    { "2": 0.54, "2-3": 0.16, "3+": 0.30 },
  "by_duration":   { "45s": 0.41, "60s": 0.59 },
  "by_setting":    { "indoor": 0.64, "outdoor": 0.36 },

  "features": {
    "daily_pick_tap": 139, "speak_on": 90, "timer_start": 77,
    "badge_earned": 62, "certificate_made": 7, "share_tap": 11,
    "score_saved": 21, "dashboard_open": 28, "missionbook_get": 15,
    "profile_add": 4, "progress_reset": 3
  },

  "hub3d": { "shown": 0, "entered": 0, "ready": 0, "moved": 0, "mission": 0, "failed": 0, "escaped": 0 },

  "methodology": "..."
}
```

## Kurallar

- `sum(_sample_interval)` kullan, `count()` değil (hacim artınca `count()` sessizce yanlış olur).
- `GROUP BY`'da alias kullan (WAE SQL tuhaflığı, Faz 1'de canlıda çarpıldı).
- `double1`'i her zaman `blob1` filtresiyle birlikte oku (sayısal prop'u olmayan event'lerde `0` döner, "değer yok" ile karışır).
- Eksik anahtarlar `0` ile doldurulur, atlanmaz.
- **Otomatik çalışmasın** — manuel tetiklenir. Cron/Actions Faz 3.

## Rapor

`docs/audits/faz2-snapshot.md`

---

# GÖREV 2.3 — Gerçek Panel

**Model:** Sonnet
**Bağımlılık:** 2.2 çalışır durumda.

## Mimari — güvenlik kararı

Panel **statik HTML**, WAE'yi doğrudan sorgulamayacak.

Sebep: tarayıcıdan WAE sorgusu API token gerektirir, token client'a girerse sızar.
Doğru akış:

```
tools/generate-weekly-snapshot.mjs  (terminal, token burada kalır)
        ↓
data/snapshots/2026-36.json         (.assetsignore'da — public servis edilmiyor)
        ↓
tools/panel/index.html              (bu JSON'ı okur, lokal açılır)
```

Panel `qr.jumvi.co`'ya **deploy edilmeyecek** — orası çocuğa açık uygulama.
Lokal dosya olarak açılacak. İleride `hq.jumvi.co`'ya taşınabilir, bu fazın kapsamı değil.

## Tasarım referansı

Ekteki prototip birebir uygulanacak: `jumvi-arge-panel.html`
(marka paleti, 36 görevlik ızgara, huni, çapraz okuma, özellik listesi).

Prototipte veriler sabit yazılı — bunlar snapshot JSON'ından beslenecek şekilde
değiştirilecek. Görsel tasarım aynen korunacak.

## Ek gereksinimler

1. **Hafta seçici** — `data/snapshots/` altındaki dosyaları listele, seçilebilsin.
2. **Karşılaştırma** — seçilen hafta ile bir önceki hafta arasındaki değişim
   (▲8 / ▼3 gibi) ana metriklerde gösterilsin. Önceki hafta yoksa gizle.
3. **Uyarı eşikleri** — "Karar bekliyor" bölümü otomatik dolsun:
   - Bir görevin tamamlanma oranı, genel ortalamanın yarısının altındaysa → uyarı
   - Bir pakete hiç girilmemişse → uyarı
   - `progress_reset` > 5 ise → uyarı
   - Eşikler dosyanın başında sabit olarak tanımlansın, kolay değiştirilebilir olsun
4. **Örneklem uyarısı** — `app_opens < 100` olduğu sürece panelin üstünde kalıcı bir
   satır: *"Örneklem küçük (N=..). Paket seviyesi okunabilir, tek görev seviyesi henüz güvenilir değil."*
5. **Boş durum** — snapshot yoksa "Henüz veri yok, önce snapshot üret" + komut satırı.

## Rapor

`docs/audits/faz2-panel.md`

---

# ÇALIŞTIRMA SIRASI

```
Session 1: /model opusplan → GÖREV 2.1 (14 event)  — plan onayı iste
           /clear
           → merge, canlıya çıkar, gerçek veri akmaya başlasın
Session 2: /model sonnet   → GÖREV 2.2 (snapshot genişletme)
           /clear
Session 3: /model sonnet   → GÖREV 2.3 (panel)
```

**2.1 launch'tan önce bitmeli.** İlk hafta verisi bir kez toplanır, geriye dönük alınamaz.
2.2 ve 2.3 launch sonrasına kalabilir — veri birikirken yapılır.

---

# KAPSAM DIŞI (bilinçli)

- Kalan 31 ölü `trackEvent` çağrısı — dokunulmayacak
- Snapshot otomasyonu (cron/Actions)
- Panelin `hq.jumvi.co`'ya taşınması
- 3D Hub'ın açılması — önce ölçüm, sonra karar
- Fiziksel ürün şikayet kanalı (`help_open` zaten Faz 1'de var, genişletilmeyecek)

---

# AÇIK KARAR — Amazon review prompt

`index.html`'de hâlâ **"Three missions done!"** başlıklı bir Amazon yorum istemi var
(`reviewHeading`). Daha önceki tartışmada bunun kaldırılmasına karar verilmişti
(gerekçe: uygulamayı kullanan çocuk, satın alan kişi değil; ayrıca marka sicilinde
açık bir ihlal penceresi var), ama kaldırma hiç uygulanmamış.

**Bu spec bu konuya dokunmuyor.** Ayrı bir karar olarak ele alınmalı — ya bilinçli
olarak bırakılmalı ya da kaldırılmalı. Ölçüm tarafında `review_prompt_*` event'leri
**bağlanmayacak**, çünkü bu belirsizliği veri toplayarak meşrulaştırmak istemiyoruz.

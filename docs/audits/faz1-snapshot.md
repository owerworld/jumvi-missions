# Faz 1 — Görev 1.3: Haftalık Snapshot Şeması

**Branch:** `feat/faz1-snapshot` · **Tarih:** 2026-08-07 (UTC) / 2026-08-08 (TR)
**Durum:** ✅ Tool yazıldı, dört sorgu da canlı WAE'ye karşı doğrulandı, ilk snapshot üretildi.
Branch push edildi; `main`'e **merge edilmedi** — onay bekliyor.

---

## 1. Ne eklendi

| Dosya | Ne |
|---|---|
| `tools/generate-weekly-snapshot.mjs` | yeni — WAE SQL API'den haftalık aggregate çekip JSON yazar |
| `data/snapshots/2026-32.json` | ilk snapshot |
| `.assetsignore` | `data/` ve `docs/` eklendi |

Bağımlılık yok (repoda `package.json` yok): Node'un yerleşik `fetch`'i ve `node:fs`/`node:os`/`node:path`
dışında hiçbir şey kullanılmıyor. `tools/check-beacon-schema.mjs` ile aynı ESM stili.

**Otomatik çalışmıyor** — spec bu fazda manuel tetikleme istiyor. Workflow yok, cron yok, hook yok.

### `data/` ve `docs/` neden `.assetsignore`'a eklendi

`wrangler.jsonc`'de `assets.directory = "."`. Yani repodaki her dosya, açıkça hariç tutulmadıkça
`qr.jumvi.co` üzerinden servis edilir. Bu satır olmadan `data/snapshots/2026-32.json` ürün
domain'inden indirilebilir hâle gelirdi. Repo zaten public olduğu için sayılar gizli değil, ama
ürün domain'i ile git arşivi ayrı şeyler; snapshot'ların ikincisinde yeri var.

`docs/` de aynı sebeple eklendi — bu görevin kapsamı dışındaydı ama tek satır. Denetim raporları
(`docs/audits/*.md`, bu dosya dahil) o ana kadar `qr.jumvi.co/docs/...` üzerinden servis
ediliyordu: neyin nasıl kırıldığını, hangi hipotezlerin elendiğini, hesap ve build kimliklerinin
nerede geçtiğini anlatan bir iz. Hassas değil, ama ürün domain'inde durmasının bir faydası da yok.
Altında yalnızca markdown var ve siteden hiçbir referans yok (`src/worker.js`'teki iki kod yorumu
dışında) — kırılan bir şey olmadan hariç tutulabildi.

---

## 2. Şema — DONDURULDU

`data/snapshots/YYYY-WW.json`, ISO hafta (Pazartesi–Pazar, UTC).

```json
{
  "week": "2026-32",
  "period_start": "2026-08-03",
  "period_end": "2026-08-09",
  "app_opens": 0,
  "mission_starts": 0,
  "mission_completes": 0,
  "recorded_completion_ratio": null,
  "help_opens": { "ball_stuck": 0, "…6 sabit reason": 0 },
  "player_count": { "2": 0, "3": 0, "4": 0 },
  "missions": {},
  "generated_at": "2026-08-07T21:33:43Z",
  "dataset": "jumvi_events_v1",
  "snapshot_schema": 1,
  "excluded_before": "2026-08-08T00:00:00Z",
  "methodology": [ "…" ]
}
```

Spec'in dokuz alanı birebir korundu, sıraları da. Aşağıdaki eklerin hepsi **onaylandı**.
`excluded_before` normal bir haftada `null`'dır — yalnızca `--since` ile üretilen koşularda dolar.

### Ek 1 — `missions`

```json
"missions": { "12": { "starts": 31, "completes": 9 } }
```

Spec'in örnek gövdesinde yok. Eklenmesinin tek gerekçesi geri döndürülemezlik: WAE ham satırları
90 gün sonra siliyor ve "hangi mission terk ediliyor" sorusu o andan sonra hiçbir şekilde
cevaplanamıyor. Snapshot'a bugün girmezse veri kaybolur. 1.2 prop'ları JSON string yerine düz
kolona yazdığı için sorgu tek `GROUP BY blob2, blob1`.

Mission id'leri string anahtar, ama **sayısal** sıralanıyor — `"9"` `"10"`dan önce gelir.

### Ek 2 — köken alanları

`generated_at`, `dataset`, `snapshot_schema`. Yıllar sonra bu dosyayı açan kişinin ilk soracağı
üç şey. Sonradan eklenselerdi geçmiş dosyalarda boş kalırlardı.

### Ek 3 — `excluded_before` + `methodology`

Aşağıda §3.

### Ayrıca `partial` bayrağı **yok**

Kısmilik zaten türetilebiliyor: `generated_at < period_end` ise hafta o an kapanmamıştı. Ayrı
bir bayrak aynı bilgiyi ikinci kez, tutarsızlaşabilecek şekilde saklardı. Bu kural
`methodology` bloğunun son satırında dosyanın kendi içinde yazılı.

### `recorded_completion_ratio` — `null`, `0` değil

`mission_starts = 0` iken oran diye bir şey yok. `0` yazmak "kimse hiçbir şeyi bitirmedi" diye
okunurdu. Aksi hâlde 2 ondalığa yuvarlanır (spec örneği: 156/210 → `0.74`).

---

## 3. Metodoloji — test verisi nasıl ele alındı

### Dataset'in gerçek durumu

Sorgu anında `jumvi_events_v1` içinde **16 satır** vardı, hepsi 2026-08-07'de:

```
20:13:09 – 20:17:56   11 satır   1.2 preview duman testi (docs/audits/faz1-beacon.md §6b)
20:42:01               1 satır   app_open — hiçbir notta geçmiyordu
21:16:30 – 21:20:09    4 satır   production geçiş testi
```

Hiçbiri gerçek kullanıcı değil.

### Karar: pencere listesi değil, tek an — ve kodda sabit değil, `--since` bayrağı

```bash
node tools/generate-weekly-snapshot.mjs --week 2026-32 --since 2026-08-08T00:00:00Z
```

Alternatif — iki test penceresini tek tek listeleyip çıkarmak — reddedildi: eldeki pencere listesi
**zaten eksikti**. `20:42:01`'deki app_open ne 1.2 raporunda ne de görev notunda geçiyordu; pencere
listesiyle sayıma dahil olur ve ilk haftanın `app_opens` değerini sessizce şişirirdi. Tek bir an
eksik kalamaz. Doğrulandı: `timestamp >= '2026-08-08 00:00:00'` sorgusu sıfır satır döndürüyor.

**Bu an script'te sabit olarak durmuyor.** İlk uygulamada `DATA_START` diye kalıcı bir sabit vardı
ve her koşuda `max(haftanın pazartesisi, DATA_START)` uygulanıyordu. Sonucu bozmuyordu — taban
değer olduğu için 2026-32'den sonraki her haftada etkisiz kalırdı — ama yeri yanlıştı: haftalık
bir aracın gövdesinde tek bir haftaya ait bir istisna taşınmamalı. Sabit kaldırıldı; yerine o
koşuya özel `--since` bayrağı kondu. Normal bir hafta hiçbir bayrak almadan, yalnızca kendi
Pazartesi–Pazar aralığını sorgular.

Filtre unutulursa sessiz kalmıyor: bayraksız `--week 2026-32` koşusu 16 test satırını olduğu gibi
raporluyor (`app_opens: 8`), yani fark görünür. Ve `--since`, hedeflenen haftanın dışında bir an
verilirse reddediliyor — "hiçbir şeyi filtrelemez" ve "her şeyi filtreler" durumlarının ikisi de
hata.

### Dosyaya gömülen not

Spec'in istediği metin birebir korundu; üç blok eklendi: sayımların `sum(_sample_interval)` ile
yapıldığı, `excluded_before` alanının semantiği (`null` ise haftanın tamamı sayılmıştır), ve kısmi
hafta kuralı. `--since` kullanılan koşularda buna dördüncü bir paragraf ekleniyor: hangi andan
öncesinin neden çıkarıldığı ve gerçek launch verisinin nereden başladığı. Yani filtre bilgisi
kodda değil, **üretilen dosyanın kendisinde** yaşıyor.

Not `methodology` alanında **satır dizisi** olarak duruyor — tek uzun string olsaydı JSON'da `\n`
kaçışlarıyla okunmaz hâle gelirdi.

---

## 4. Sorgular

Dört sorgu, hepsi aggregate — ham satır hiçbir zaman diske inmiyor.

```sql
-- 1 funnel
SELECT blob1 AS event, sum(_sample_interval) AS n FROM jumvi_events_v1
 WHERE <pencere> AND blob1 IN ('app_open','mission_start','mission_complete') GROUP BY event;

-- 2 help_open kırılımı
SELECT blob2 AS reason, sum(_sample_interval) AS n FROM jumvi_events_v1
 WHERE <pencere> AND blob1 = 'help_open' GROUP BY reason;

-- 3 player_count kırılımı
SELECT double1 AS players, sum(_sample_interval) AS n FROM jumvi_events_v1
 WHERE <pencere> AND blob1 = 'player_count' GROUP BY players;

-- 4 mission bazında start/complete
SELECT blob2 AS mission, blob1 AS event, sum(_sample_interval) AS n FROM jumvi_events_v1
 WHERE <pencere> AND blob1 IN ('mission_start','mission_complete') GROUP BY mission, event;
```

1.2'nin bıraktığı üç tuzağın üçü de uygulandı:

| Tuzak | Uygulama |
|---|---|
| `ORDER BY`/`GROUP BY` ham kolon adını kabul etmiyor | her yerde alias |
| `double1`, sayısal prop'u olmayan event'lerde `0` döner | `double1` **daima** `blob1` filtresiyle okunuyor |
| — | `count()` değil `sum(_sample_interval)`: bugün örnekleme yok (`si = 1`), ama hacim artınca `count()` sessizce eksik sayardı |

Eksik `help_open` reason'ları ve `player_count` değerleri 0 ile dolduruluyor (spec örneğinde
`need_more_space: 0` var). Dataset'te enum dışı bir değer çıkarsa — Worker allowlist'i buna izin
vermiyor — sayı **atılmıyor**, `⚠️` ile stderr'e yazılıp gövdeye ekleniyor.

Hafta tamamen eşikten önceyse hiç sorgu atılmıyor; sıfırlarla dolu iskelet zaten doğru cevap.

---

## 5. Doğrulama

### Toplama matematiği — bilinen 16 satıra karşı

`--since` olmadan `--week 2026-32` koşusu (yani commit edilen kodun kendisi, hiçbir değişiklik
olmadan) test verisinin tamamını topluyor. Çıktı, ham satır dökümüyle birebir karşılaştırıldı:

```
app_opens                 8   ✅ (ham dökümde 8 app_open satırı)
mission_starts            2   ✅ (33, 36)
mission_completes         2   ✅ (33, 36)
recorded_completion_ratio 1   ✅ (2/2)
help_opens   ball_stuck=1, mission_too_hard=1, diğer dördü 0   ✅
player_count "2"=1, "3"=0, "4"=1                              ✅
missions     33:{1,1}  36:{1,1}                                ✅
```

Dört sorgunun dördü de gerçek veriyle çalıştı. Commit edilen `2026-32.json` — aynı komut
`--since 2026-08-08T00:00:00Z` ile — sıfırlarla dolu, ama bu sıfırlar sorgunun çalışmamasından
değil, o andan sonra henüz veri olmamasından geliyor. Yukarıdaki koşu bu ayrımı kanıtlıyor:
aynı kod, aynı hafta, bayrak farkı.

### `--since` doğrulaması

| Girdi (hafta 2026-32) | Sonuç |
|---|---|
| `--since notadate` | ✗ `must be an ISO 8601 instant` ✅ |
| `--since 2026-08-03T00:00:00Z` | ✗ haftanın başında ya da öncesinde — hiçbir şeyi filtrelemez ✅ |
| `--since 2026-08-20T00:00:00Z` | ✗ haftanın sonunda ya da sonrasında — her şeyi filtreler ✅ |
| `--since 2026-08-08T00:00:00Z` | kabul, `excluded_before` dolduruldu, nota paragraf eklendi ✅ |

### ISO hafta aritmetiği

| Girdi | Sonuç |
|---|---|
| `--week 2026-35` | `2026-08-24` → `2026-08-30` ✅ spec'in örneğiyle birebir |
| `--week 2026-32` | `2026-08-03` → `2026-08-09` ✅ |
| `--week 2026-53` | `2026-12-28` → `2027-01-03` ✅ (2026 gerçekten 53 haftalı) |
| `--week 2025-53` | ✗ `ISO week 2025-53 does not exist` ✅ (2025 52 haftalı) |
| `--week 2026-00` | ✗ reddedildi ✅ |
| `--week 2026-3` | ✗ format hatası ✅ |
| `--bogus` | ✗ `Unknown argument` ✅ |
| argümansız | `2026-31` (`2026-07-27` → `2026-08-02`) ✅ son **tamamlanmış** hafta |

Hafta geçerliliği tablo tutarak değil, ISO takviminde gidiş-dönüş yaparak doğrulanıyor: var
olmayan bir hafta numarası kendine geri dönmüyor.

### Gizlilik

Script yalnızca beacon'ın yazdığını görebiliyor ve beacon hiçbir kimlik yazmıyor
(`docs/audits/faz1-beacon.md` §4). Buna ek olarak: dört sorgunun dördü de `GROUP BY` aggregate;
`SELECT *` veya satır bazlı bir sorgu yok, dolayısıyla snapshot dosyasına düşebilecek en ince
taneli şey "mission 12'de 31 start" gibi bir sayı.

---

## 6. Çalıştırma

```bash
node tools/generate-weekly-snapshot.mjs                  # son tamamlanmış hafta
node tools/generate-weekly-snapshot.mjs --week 2026-33
node tools/generate-weekly-snapshot.mjs --week 2026-33 --dry-run   # stdout, yazma yok
```

Normal ritim: her pazartesi, biten hafta için **argümansız** çalıştır ve çıkan dosyayı commit et.

`--since` normal ritmin parçası değil. Yalnızca bir haftanın içinde gerçek olmayan trafik varsa
kullanılır ve o ana kadar bunun tek örneği 2026-32'dir. İleride tekrar gerekirse (örneğin bir
basın demosu ya da mağaza içi test günü) aynı bayrak kullanılır ve gerekçe otomatik olarak
üretilen dosyanın `methodology` notuna düşer.

### Kimlik doğrulama

Sırayla denenir:

1. `CLOUDFLARE_API_TOKEN` (izin: **Account Analytics: Read**)
2. yerel `wrangler login` OAuth token'ı — bu makinede kullanılan yol

`CLOUDFLARE_ACCOUNT_ID` verilmezse API'den keşfediliyor (hesap tekse). Token da hesap ID'si de
ne bir dosyaya yazılıyor ne de ekrana basılıyor — repo public.

Sürpriz bir bulgu: wrangler'ın OAuth token'ı `analytics_engine/sql` endpoint'ini **kabul ediyor**,
scope listesinde ayrı bir analytics izni görünmemesine rağmen. Ayrı API token üretmek gerekmedi.
Bu davranışa güvenilemez hâle gelirse (401/403) script'in hata mesajı doğrudan `wrangler login`
veya token oluşturmaya yönlendiriyor.

---

## 7. Kapsam dışı bırakılanlar

- **Otomasyon** — spec açıkça istemiyor.
- **Geçmiş haftaların doldurulması** — beacon 2026-08-07'de canlıya çıktı; öncesi için veri yok.
- **Snapshot'ları okuyan bir dashboard/rapor** — ayrı iş.

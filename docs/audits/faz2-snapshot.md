# Faz 2 — Görev 2.2: Snapshot Script'ini Genişlet

**Branch:** `feat/faz2-arge` · **Tarih:** 2026-08-08
**Durum:** ✅ 8 sorgu, 5 çapraz okuma, canlı WAE'ye karşı doğrulandı. `snapshot_schema` 1 → **2**.

---

## 1. Ne eklendi

| Dosya | Ne |
|---|---|
| `tools/derive-missions-meta.mjs` | yeni — `data.js`'ten görev etiketlerini türetir |
| `data/missions-meta.json` | yeni — türetilmiş çıktı, elle yazılmıyor |
| `tools/generate-weekly-snapshot.mjs` | 4 sorgu → 8; paketler, çapraz okumalar, özellikler, hub hunisi, tutundurma |

Faz 1'in tüm alanları yerinde ve aynı sırada. Eklenenler: `app_first_opens`, `return_visits`,
`packs`, `by_age`, `by_difficulty`, `by_players`, `by_duration`, `by_setting`, `features`, `hub3d`.

---

## 2. `missions-meta.json` — neden türetiliyor

Spec iki seçenek sunuyor: `data.js`'i sandbox'ta değerlendirmek ya da bir kerelik meta dosyası
üretmek; ikincisini tercih ediyor. **İkisi birden yapıldı** — meta dosyası var, ama `data.js`'ten
sandbox'ta türetiliyor ve **her koşuda yeniden doğrulanıyor.**

Sebep: elle tutulan bir kopya, bir görevin yaş bandı ilk düzenlendiğinde bayatlar — ve **sessizce**
bayatlar. Çöken bir şey olmaz; sadece görevler yanlış kovaya düşer ve gayet makul görünen yanlış bir
kırılım üretilir. Snapshot kalıcı olduğu için bu hata da kalıcı olur.

`node:vm`, boş context. `data.js` modül kapsamında DOM'a dokunmuyor, temiz değerleniyor. Tek incelik:
`data.js` her şeyi `const` ile tanımlıyor ve top-level `const` context nesnesine **düşmez** —
değerler aynı script'e eklenen bir ifadeyle okunuyor.

`setting` (indoor/outdoor) `data.js`'te yok; pakete bağlı bir etiket olduğu için türetme dosyasının
başında altı satır olarak duruyor, sorgunun içine gömülmedi.

### Bayatlama koruması — kanıtlandı

`data/missions-meta.json` elle bozuldu (bir görevin yaşı `9+` yapıldı):

```
$ node tools/generate-weekly-snapshot.mjs --week 2026-32 --dry-run
✗ data/missions-meta.json no longer matches data.js — the cross-reads would be wrong.
  Re-run: node tools/derive-missions-meta.mjs

$ node tools/derive-missions-meta.mjs --check
✗ data/missions-meta.json is stale relative to data.js.
```

Snapshot üretmiyor, hata veriyor. Yanlış sayı üretmektense hiç üretmemek.

---

## 3. Kovalar spec'in örneğiyle uyuşmuyor — veriden türetiliyor

Spec'in çapraz okuma tablosu üç yaş bandı (3+/4+/6+) ve üç zorluk (1/2/3) varsayıyor.
`data.js`'teki gerçek dağılım:

| Etiket | Gerçek değerler |
|---|---|
| yaş | `3+` (7), `4+` (13), **`5+` (7)**, `6+` (9) — **dört** band |
| zorluk | `1` (17), `2` (19) — **zorluk 3 hiç yok** |
| oyuncu | `2` (28), `2-3` (2), `3+` (1), `3-6` (1), `4` (2), `4+` (2) — **altı** değer |
| süre | `45s`, `60s`, `90s`, `120s`, `150s`, `180s`, `240s` — **yedi** değer |
| mekan | indoor 24 / outdoor 12 |

Kova anahtarları bu yüzden **kod içinde sabit liste değil, meta dosyasından türetiliyor**. Sabit
liste yazılsaydı `5+` bandındaki 7 görev hiçbir kovaya düşmez, sessizce kaybolurdu.

**Ayrıca bir ürün bulgusu:** spec "Zorluk (1/2/3) — seviye merdiveni çalışıyor mu" diye soruyor ama
katalogda **zorluk 3 yok**; en zor görev 2. Kutu/pazarlama üç seviye iddia ediyorsa bu veriyle
karşılanmıyor. Ölçümün kapsamı dışı, ama 2.3 panelinde bu kırılım hep iki sütun gösterecek.

---

## 4. `by_*` ne demek

Her değer o kovanın **`mission_start` payı** (toplamları 1.0), 2 ondalık.

Kova başına "kaçı bitirildi" oranı bilerek önceden hesaplanmıyor: `missions` her görevin
start **ve** complete sayısını, `missions-meta.json` her görevin etiketlerini tutuyor. Yani
"uzun görevler daha çok mu terk ediliyor" sorusu snapshot'tan yeni bir sorgu gerekmeden
türetilebilir — ham malzeme kalıcı olarak saklanmış oluyor.

---

## 5. Sorgular

Dördü Faz 1'den, dördü yeni. Hepsi aggregate; ham satır diske inmiyor.

| # | Ne | Kural |
|---|---|---|
| 1–4 | funnel, help_open, player_count, mission bazında start/complete | Faz 1 |
| 5 | özellik sayıları + `app_first_open` | tek `GROUP BY`, prop'suz event'ler |
| 6 | `pack_view` / `pack_complete` | `GROUP BY event, pack` |
| 7 | `hub3d` huni adımları | `GROUP BY step` |
| 8 | `return_visit` | `double1`, **daima** `blob1` filtresiyle |

Faz 1'in üç kuralı korundu: `sum(_sample_interval)`, `GROUP BY`'da alias, `double1` asla çıplak
okunmuyor. Eksik anahtarlar 0 ile dolduruluyor; enum dışı bir değer gelirse sayı atılmıyor,
`⚠️` ile stderr'e yazılıp gövdeye ekleniyor.

`packs` şöyle kuruluyor: `views` ve `completed_pack` kendi event'lerinden, `starts`/`completes`
o pakete ait görevlerin toplamından.

---

## 6. Doğrulama

Canlı `jumvi_events_v1`'e karşı, `--since` olmadan — yani dataset'teki 16 test satırı üzerinden,
çapraz okumaların gerçekten birleştiğini görmek için:

```
app_opens                  8
mission_starts             2      missions: {"33":{1,1}, "36":{1,1}}
mission_completes          2
recorded_completion_ratio  1
packs                      Beach/Park {views:0, starts:2, completes:2, completed_pack:0}
by_age                     {"3+":0, "4+":0.5, "5+":0.5, "6+":0}
by_difficulty              {"1":0.5, "2":0.5}
by_players                 {"2":1, ...}
by_duration                {"120s":0.5, "180s":0.5, ...}
by_setting                 {"indoor":0, "outdoor":1}
```

Elle doğrulandı: 33 ve 36'nın ikisi de Beach/Park (outdoor) → `outdoor: 1.0` ✅; yaşları `4+` ve
`5+` → 0.5/0.5 ✅; zorlukları 1 ve 2 → 0.5/0.5 ✅; süreleri 120s ve 180s → 0.5/0.5 ✅; ikisi de
2 oyuncu → `"2": 1.0` ✅. Tüm paylar 1.0'a toplanıyor, tüm katalog kovaları 0 ile mevcut.

Faz 2 event'leri henüz canlıda olmadığı için `features`, `hub3d`, `app_first_opens`,
`return_visits` ve `packs.views` sıfır — sorguların çalıştığı, hata vermeden 0 döndürmelerinden
belli (yanlış kolon adı olsaydı WAE hata verirdi).

### Yan bulgu — wrangler OAuth token'ı süresi doluyor

Oturum ortasında token expire oldu; script `401` alıp doğru yönlendirmeyi yazdı
(*"the wrangler login has expired"*). `npx wrangler whoami` çalıştırmak token'ı yeniledi ve
script tekrar çalıştı. Hesap listeleme `403` verdiğinde `CLOUDFLARE_ACCOUNT_ID` ile geçilebiliyor.

---

## 7. Kapsam dışı

- Otomasyon (cron/Actions) — Faz 3.
- `by_*` içinde kova başına tamamlanma oranı — türetilebilir olduğu için saklanmıyor (§4).
- Rozet bazında kırılım — `features.badge_earned` toplam sayı; per-badge kırılım spec'te yok.

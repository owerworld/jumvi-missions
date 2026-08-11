# Faz 2 — Dev Dataset Ayrımı

**Branch:** `feat/faz2-dev-dataset` · **Tarih:** 2026-08-09
**Durum:** ✅ Config + wrapper eklendi, binding çözümü dry-run ile kanıtlandı. Uçtan uca canlı
yazma testi **yapılamadı** — sebebi bu görevin kapsamı dışında, ayrıntı aşağıda. `main`'e
**merge edilmedi**.

---

## Ne eklendi

| Dosya | Ne |
|---|---|
| `wrangler.jsonc` | `env.dev.analytics_engine_datasets` bloğu |
| `tools/wrangler-dev-remote.sh` | `wrangler dev --remote --env dev` kısayolu |

Seçilen yaklaşım (üç seçenekten C, onaylandı): üst seviye (production'ın kullandığı) config **hiç
değişmedi**. `env.dev` yalnızca binding'i (`JUMVI_ANALYTICS`) `jumvi_events_dev`'e yeniden bağlıyor;
`main`, `assets`, `compatibility_date` env'ler arası otomatik miras alındığı için `env.dev`
bloğunda tekrar yazılmasına gerek yok — bu, `docs/audits/wrangler-dev-analytics-engine.md`'de
doğrulanan miras kuralının doğrudan uygulaması.

`src/worker.js` **değişmedi**. Kod hep `env.JUMVI_ANALYTICS.writeDataPoint(...)` çağırıyor;
hangi dataset'e gittiğine wrangler'ın env çözümü karar veriyor.

## Doğrulama — binding çözümü

```
$ npx wrangler deploy --dry-run --env dev
env.JUMVI_ANALYTICS (jumvi_events_dev)      Analytics Engine Dataset

$ npx wrangler deploy --dry-run
env.JUMVI_ANALYTICS (jumvi_events_v1)       Analytics Engine Dataset
```

İkisi de `env.ASSETS` dahil doğru çözümleniyor — `assets`'in miras alındığının kanıtı. Prod config
satır satır aynı: `wrangler.jsonc`'nin üst kısmı bu görevde tek satır değişmedi.

## Uçtan uca canlı test — engellendi, ayrı ve önemli bir bulgu

Plan `tools/wrangler-dev-remote.sh`'i çalıştırıp bir test event'inin `jumvi_events_dev`'e
düştüğünü, `jumvi_events_v1`'e **dokunmadığını** WAE SQL API'siyle kanıtlamaktı. Bu adım
tamamlanamadı: `wrangler dev --remote` bu hesapta şu an **hiç çalışmıyor.**

```
✘ [ERROR] Could not create remote preview session on your account.
```

`WRANGLER_LOG_SANITIZE=false` ile bakıldığında Cloudflare edge'i `*.workers.dev` preview token
exchange adımında **error 1031 — "Invalid Workers Preview configuration"** döndürüyor.

**Bu görevin config'inden kaynaklanmadığı doğrulandı:** aynı hata hem `--env dev` ile hem de
mevcut, çalışan production script adına (`jumvi-missions`) karşı çıktı — env.dev hiç ortada
yokken de aynı sonuç. Production script'in `workers_dev` ayarı API'den kontrol edildi:
`enabled: true, previews_enabled: true`. Bu, [cloudflare/workers-sdk#10773]
(https://github.com/cloudflare/workers-sdk/issues/10773) ile eşleşen, hesaba özgü olmayan,
hâlâ açık bir wrangler/Cloudflare sorunu.

### Bunun anlamı

- Bu görevin teslim ettiği şey (config + script) **doğru ve prod'a sıfır riskli** — dry-run bunu
  kanıtlıyor.
- Ama "gelecekte biri bunu çalıştırınca güvenle dev dataset'e yazar" iddiası şu an **test
  edilemedi**, çünkü çalıştırma yolu (`--remote`) bu hesapta zaten kapalı. Fiilen: risk şu anda
  sıfıra daha da yakın — kimse ne prod'a ne dev'e `wrangler dev --remote` ile yazamıyor.
- `docs/audits/wrangler-dev-analytics-engine.md`'deki "70 satırı `--remote` yazdı" hipotezi bu
  yüzden **kanıtlanmış değil, hâlâ en olası aday** — o gün gerçekten çalışıp çalışmadığı
  bilinmiyor. İlgili doküman ve `faz2-events.md` bu netlikle güncellendi.
- `--remote` yukarı akışta (Cloudflare veya wrangler tarafında) düzelirse eklenen script ve config
  hazır ve doğru duruyor — o zaman tek yapılacak `./tools/wrangler-dev-remote.sh` çalıştırıp
  gerçek bir yazmanın `jumvi_events_dev`'e düştüğünü, `jumvi_events_v1`'in değişmediğini
  doğrulamak.

## Kapsam dışı / dokunulmayan

- Cloudflare Workers Builds branch/preview deploy'larının aynı riski taşıması (`faz1-beacon.md`
  §6b'de belgeli) — bu görev yalnızca `wrangler dev`'i kapsıyor, dashboard build config'i değil.
- `jumvi_events_dev` dataset'inin elle oluşturulması — `--remote` çalışmadığı için henüz gerekmedi;
  ilk gerçek yazma denemesinde gerekip gerekmediği görülecek (Faz 1'in dersi: bu hesapta auto-create
  garanti değil).

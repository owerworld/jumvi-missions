# `wrangler dev` ve Analytics Engine — kalıcı ders

**Tarih:** 2026-08-09 · **wrangler:** 4.61.1 · **Bağlam:** [faz2-events.md §6b](faz2-events.md#6b-production-doğrulaması--2026-08-09)'daki "kaynağı belirlenemeyen 70 satır" bulgusunun kök sebep incelemesi.

---

## Soru

`wrangler dev` (bayraksız, varsayılan lokal mod) Analytics Engine binding'ini gerçekten lokal
simüle mi ediyor, yoksa sessizce gerçek (production) dataset'e mi yazıyor?

## Cevap — kesin, iki bağımsız kaynaktan doğrulandı

**Hayır, asla yazmıyor. Varsayılan `wrangler dev`'in Analytics Engine binding'i kalıcı bir no-op'tur.**

Kod düzeyinde: `miniflare`'in (wrangler'ın lokal çalıştırıcısı) Analytics Engine simülatörü:

```js
// node_modules/miniflare/dist/src/workers/analytics-engine/analytics-engine.worker.js
var LocalAnalyticsEngineDataset = class {
  constructor(env) { this.env = env; }
  writeDataPoint(_event) { }   // ← gövde boş. Parametre bile okunmuyor.
};
```

Binding kurulumunda bu, **koşulsuz** uygulanıyor — diğer binding türlerinin (KV, D1, R2, AI,
Browser Rendering…) aksine `remote` bayrağına hiç bakmıyor:

```js
// wrangler-dist/cli.js — analytics_engine_datasets binding kurulumu
mode: getMode({ isSimulatedLocally: true })   // ← sabit true, remote kontrolü YOK
// (diğer binding türleri: isSimulatedLocally: context.remoteBindingsDisabled || !X.remote)
```

Cloudflare'in resmi "remote bindings" (mixed mode, `remote: true`) dokümantasyonu bunu teyit
ediyor: **Analytics Engine desteklenmeyen binding türleri listesinde** — `remote: true` verilirse
wrangler hata fırlatıyor, sessizce yoksaymıyor.

## Peki 70 satır nereden geldi

`wrangler dev`'in **varsayılan** modu değil — eski, artık deprecated ama hâlâ çalışan
**tam-uzak mod**: `wrangler dev --remote` (kısayolu `-r`).

```
$ npx wrangler dev --help
  -r, --remote   Run on the global Cloudflare network with access to production resources
```

`--remote` (mixed-mode "remote bindings"den farklı) Worker'ın **tamamını** Cloudflare'in edge'inde
çalıştırır — binding bazlı seçim yok, hepsi gerçek. Analytics Engine mixed-mode'a giremediği için,
gerçek WAE'ye lokal makineden ulaşmanın **tek** yolu budur — *teoride.*

### Bu teoriyi bu hesapta test ettim — ve şu an çalışmıyor

`wrangler dev --remote` bu makineden, hem `--env dev` ile hem de mevcut production script adına
(`jumvi-missions`) karşı denendi. İkisi de aynı hatayla düştü, deploy edilen hiçbir şeye
dokunmadan:

```
✘ [ERROR] Could not create remote preview session on your account.
```

`WRANGLER_LOG_SANITIZE=false` ile ham HTTP gövdesine bakıldığında Cloudflare edge'i
**"Invalid Workers Preview configuration" (error 1031)** döndürüyor — `*.workers.dev` preview
mekanizmasının token exchange adımında. Bu, bu oturumun yaptığı bir değişiklikten kaynaklanmıyor:
production script'in `workers_dev` ayarı API'den `enabled: true, previews_enabled: true` olarak
doğrulandı, `env.dev` hiç ortada yokken de aynı hata çıktı. Bu, [cloudflare/workers-sdk#10773]
(https://github.com/cloudflare/workers-sdk/issues/10773) ile eşleşen, hâlâ açık, hesaba özgü
olmayan bilinen bir wrangler/Cloudflare sorunu.

**Sonuç:** `--remote` mekanizması "70 satırın nasıl yazılabileceğini" açıklamaya devam ediyor
(kod düzeyinde bu tek gerçek yol), ama *o gün gerçekten çalışıp çalışmadığı* doğrulanamadı —
bugün bu hesapta çalışmıyor. Kaynağı belirlenemeyen 70 satır hâlâ tam olarak açıklanmış değil;
en olası aday budur ama kanıtlanmış değildir.

## Bundan çıkan ikinci ders — `analytics_engine_datasets` env'ler arası **inherit edilmiyor**

`wrangler.jsonc`'te `main`, `assets`, `compatibility_date` gibi alanlar bir `env.X` bloğu
tanımlandığında üst seviyeden **otomatik miras alınır**. Binding'ler (dolayısıyla
`analytics_engine_datasets` de) miras alınmaz — her `env` bloğunda **yeniden**, tam olarak
yazılmalıdır. Bu tasarım bilinçli: Cloudflare'in kendi dokümantasyonu bunu "yanlış dataset'e
yazma hatasını önlemek için kasıtlı" diye tanımlıyor.

## Nasıl uygulanır

- `npx wrangler dev` (bayraksız) → her zaman güvenli, hangi dataset tanımlı olursa olsun; binding
  ne yazarsa yazsın gövdesi boş.
- `npx wrangler dev --remote` veya `-r` → **gerçek** production kaynaklarına dokunur — çalıştığı
  zaman. Bu repoda Analytics Engine söz konusu olduğunda bu, gerçek `jumvi_events_v1`'e yazmak
  demektir. Kasıtlı bir sebep yoksa **kullanılmamalı**; bugün itibariyle zaten çalışmıyor (yukarı
  bakın), ama yukarı akış düzeltmesi bunu her an tekrar çalışır hale getirebilir — varsayım
  "çalışmıyor" üzerine kurulmamalı.
- Cloudflare Workers Builds'in branch/preview deploy'ları (`git push`) da aynı riski taşır — bu
  zaten `docs/audits/faz1-beacon.md` §6b'de belgelenmişti (preview URL'i gerçek dataset'e 11 satır
  yazmıştı) ve `--remote`'dan bağımsız olarak hâlâ geçerli. Bu yol test edilmedi/kapatılmadı.

## Faz 2 dev dataset ayrımı — `docs/audits/faz2-dev-dataset.md`

Yukarıdaki riski kalıcı olarak azaltan `wrangler.jsonc` `env.dev` bloğu ve
`tools/wrangler-dev-remote.sh` script'i eklendi — detay ve doğrulama ayrı raporda.

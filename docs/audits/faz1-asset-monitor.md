# Faz 1 — GÖREV 1.1: Deploy Sonrası Asset Health Monitor

**Tarih:** 2026-08-07
**Durum:** Script yazıldı, canlıya karşı iki kez çalıştırıldı (temiz), workflow yazıldı ama **tetiklenmesi henüz doğrulanamadı** (aşağıda açıklandı). Henüz commit edilmedi.

## Ne eklendi

1. **`tools/check-deploy-health.sh`** — yeni, bağımsız script. `tools/check-core-assets.sh`'e dokunulmadı; o script deploy'dan ÖNCE repoyu korur (CACHE_NAME/asset uyuşmazlığı), bu script deploy'dan SONRA canlıyı doğrular (edge'e gerçekten ne gitti).
2. **`.github/workflows/deploy-health-check.yml`** — yeni workflow. Mevcut `pages-build-deployment` workflow'una (GitHub'ın kendi, repoda dosyası olmayan sentetik GitHub Pages deploy'u) **dokunulmadı** — spec'in açık talimatı buydu.
3. **`docs/audits/faz1-asset-monitor.md`** — bu dosya.

## Script ne kontrol ediyor (4 bölüm)

| # | Kontrol | Yöntem |
|---|---|---|
| 1 | `service-worker.js`'deki canlı `CACHE_NAME`, bu commit'in `tools/core-assets.lock`'una eşit mi | Canlıdan fetch + repodaki kilit dosyasıyla karşılaştırma |
| 2 | `CORE_ASSETS`'teki her dosya (101 adet) gerçekten servis ediliyor mu | **Magic byte / dosya başı kontrolü** — durum koduna güvenmiyor |
| 3 | `app.js`, `jumvi-hub-app.js`, `leo-tour.js` — canlıda servis edilen bayt dizisi sözdizimsel olarak geçerli mi | Üretimden çekilip `node --check` ile denetleniyor (repo kopyası değil) |
| 4 | `/assets/ui/*` görev/paket/rozet görselleri örneklemesi (~12'de 1) | Aynı magic-byte yöntemi |

**Neden durum koduna/Content-Type'a güvenmiyor:** Bu oturumdaki iki gerçek olay yüzünden. (1) `b548503` commit'i `app.js`'i değiştirip `CACHE_NAME`'i artırmamıştı — elle bulundu, bu script'in [1/4] kontrolü bunun otomatik hali. (2) Bir Cloudflare edge node'u, font URL'sinde SPA-fallback HTML'ini önbelleğe almıştı ve **`Content-Type: font/woff2` başlığı doğru göründüğü halde gövde HTML'di** (`assets/fonts/README.md`'de kayıtlı). Bu yüzden her kontrol gerçek baytlara bakıyor: ikili formatlarda magic number, metin formatlarında dosyanın **başında** (tüm gövdede değil) `<!doctype html` arıyor.

## İlk çalıştırma — iki bulgu çıktı, ikisi de kendi script hatammış, düzelttim

**1. deneme (düzeltme öncesi):** `/index.html` "HTTP 308" diye işaretlendi, `/app.js` "SPA fallback" diye işaretlendi. İkisini de elle doğruladım:
- `/index.html` → `/`'e **tasarım gereği** 308 yönlendiriyor (bu oturumda daha önce doğrulanmış davranış). Script `curl -fsS` kullanıyordu, yönlendirmeyi takip etmiyordu — gerçek bir tarayıcı/service worker `fetch()`'i takip eder. **Düzeltme:** tüm asset fetch'leri `-L` ile yönlendirme takip eder oldu.
- `/app.js` → gerçekten 200, gerçek JS içeriği geldiğini `curl -sI` ve gövde inceleyerek doğruladım. Script'in "HTML mi" kontrolü **tüm 220 KB dosyada** `<!doctype html` arıyordu; `app.js:3604`'te (bir yazdırma/paylaşım özelliği için) bu string'in **kod içinde meşru olarak** geçtiğini buldum (`grep -n` ile doğrulandı). **Düzeltme:** kontrol artık sadece dosyanın ilk 200 baytına bakıyor — gerçek bir SPA-fallback gövdesi baştan itibaren HTML'dir, ortasında HTML string'i geçen gerçek bir JS dosyası değil.

**2. deneme (düzeltme sonrası):** Temiz.
```
[1/4] ✅ live matches the committed lock: jumvi-missions-v167
[2/4] ✅ 101/101 CORE_ASSETS verified
[3/4] ✅ app.js, leo-tour.js, jumvi-hub-app.js — hepsi sözdizimsel olarak geçerli
[4/4] ✅ 6/6 örneklenen /assets/ui/* görseli doğru
```

## Doğrulanamayan tek şey: workflow'un gerçekten tetiklenmesi

`deploy-health-check.yml`, `check_suite: completed` event'ine, Cloudflare'in GitHub App'i (`cloudflare-workers-and-pages`, id 85455 — bu oturumda `gh api` ile doğrulanan gerçek değer) için filtrelenmiş şekilde bağlı. **GitHub, bir workflow'u ancak default branch'te var olduktan SONRAKİ event'ler için dinlemeye başlar** — yani bu workflow, kendisini getiren commit'in deploy'unu ASLA yakalayamaz; ancak `main`'e merge olduktan sonraki bir sonraki gerçek Cloudflare deploy'unda tetiklenip tetiklenmediği görülebilir. Bunu buradan simüle edemem. **Bu yüzden: workflow yazıldı ve YAML olarak geçerli, ama "gerçekten çalışıyor" iddiası bu raporda YOK — bir sonraki deploy'da Actions sekmesinden kontrol edilmeli.**

## Kapsam dışı bırakılanlar (spec'in kendi sınırı)

- Script her zaman `exit 0` döner — build'i kırmıyor, sadece `⚠️` satırları basıyor (spec: "Başarısız olursa: build'i kırma (henüz)")
- Slack/email bildirimi yok (spec: "kapsam dışı")
- `pages-build-deployment` workflow'una dokunulmadı, ona bağlı bir şey eklenmedi

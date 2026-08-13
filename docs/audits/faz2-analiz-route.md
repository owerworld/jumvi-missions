# `qr.jumvi.co/analiz` — şifre korumalı Ar-Ge panel route'u

**Branch:** `feat/analiz-panel-route` · **Tarih:** 2026-08-14
**Durum:** ✅ Çalışıyor, `wrangler dev` üzerinde uçtan uca doğrulandı. `main`'e **merge edilmedi**.

---

## 1. Karar — A) aynı domain, B) ayrı subdomain değil

Panel artık `qr.jumvi.co/analiz`'de, HTTP Basic Auth ile korunuyor. İki seçenek sunulmuştu:
aynı Worker'da yeni bir route (dashboard işlemi gerektirmiyor, benim tek başıma yapabileceğim) ya da
ayrı bir subdomain (`hq.jumvi.co` — tam izole ama Cloudflare dashboard'da DNS/route kaydı gerektiriyor,
bu adımı göremiyorum). **A seçildi.**

Bunun anlamı: panel kodu artık çocuk uygulamasıyla **aynı** `src/worker.js`'de yaşıyor. Riski
azaltan şey, eklenen bloğun küçük, kendi içine kapalı olması ve beacon/asset-fallback yollarına
dokunmaması.

---

## 2. Ne değişti

| Önce | Sonra |
|---|---|
| `tools/panel/index.html` (yalnızca lokal, `tools/` `.assetsignore`'da) | `assets/analiz/index.html` (servis edilebilir) |
| `data/` `.assetsignore`'da | `data/` artık normal bir asset — ama `/data/*` Worker'da şifre korumalı |
| Panel erişimi: `python3 -m http.server` | + `qr.jumvi.co/analiz` (şifreli) |

`tools/panel/sample/` (test fixture'ları) yerinde kaldı — servis edilmesine gerek yok.

### Neden `data/` tamamen açıldı, sadece `/analiz` değil

Panelin kendi JS'i `data/snapshots/*.json` ve `data/missions-meta.json`'ı doğrudan `fetch()` ile
okuyor. `.assetsignore` bir dosyayı ya tamamen deploy'a dahil eder ya tamamen dışarıda bırakır —
"şifreliyse servis et" diye bir orta yol yok. Yani `data/`'nin fiziksel olarak deploy edilmesi
şart; koruma tamamen Worker seviyesinde (`/data/*` için de aynı Basic Auth kontrolü) sağlanıyor.

Bu veri zaten sır değildi — `data/snapshots/*.json` bu public GitHub repo'da hep durdu. Şifrenin
işi veriyi gizlemek değil, ürün domain'inde tesadüfen karşılaşılmasını önlemek.

**Yan fayda:** `data/` artık gerçek bir asset olduğu için haftalık iş akışı değişmedi —
`generate-weekly-snapshot.mjs` çalıştır, `git push`, panel otomatik güncel. Ayrı bir "paneli
deploy et" adımı yok.

---

## 3. KRİTİK BULGU — asset dizinini `.assetsignore`'dan çıkarmak yetmiyor

İlk uygulamada `/data/*`'i Worker'ın `fetch()`'i içinde bir `if` bloğuyla koruyordum — mantıken
doğru görünüyordu. Test ettiğimde:

```
$ curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8799/data/snapshots/index.json
200        ← şifresiz, olmamalıydı
```

Yanıt başlığında `CF-Cache-Status: HIT` vardı — bu, isteğin Worker koduma **hiç uğramadığını**
gösteriyordu. Sebep: Cloudflare'in static-assets mimarisinde, istek bir asset ile eşleşiyorsa
platform onu **doğrudan edge'den** servis ediyor, `fetch()` handler'ı hiç çalışmıyor —
`run_worker_first: true` (veya belirli yollar için bir liste) açıkça ayarlanmadıkça. Bu tam
olarak Cloudflare'in kendi dokümantasyonunda "gating assets behind authentication" için
önerdiği ayar — ironik biçimde tam benim senaryomun resmi örneği.

**Düzeltme** — `wrangler.jsonc`:

```jsonc
"assets": {
  "directory": ".",
  "binding": "ASSETS",
  "run_worker_first": ["/data/*", "/assets/analiz/*"]
}
```

İkinci yol (`/assets/analiz/*`) ayrı bir bulgu: panelin kendi HTML dosyası da artık gerçek bir
asset, yani `/analiz` route'unu atlayıp doğrudan `qr.jumvi.co/assets/analiz/`'e gidilse aynı
bypass tekrarlanırdı. İkisi de `run_worker_first`'e eklenmeden önce ayrı ayrı test edilip
doğrulandı (bkz. §5).

**Ders:** "`.assetsignore`'dan çıkardım, artık Worker'da kontrol edebilirim" varsayımı yanlıştı.
Bir yol asset olarak eşleşiyorsa, `run_worker_first` olmadan Worker'ın kendisi o isteği **hiç
görmez** — kodun içindeki `if` bloğu ne kadar doğru yazılırsa yazılsın devreye girmez.

---

## 4. Kimlik doğrulama

HTTP Basic Auth, `src/worker.js`'de:

- Kullanıcı adı kontrol edilmiyor, yalnızca parola.
- Parola `env.ANALIZ_PASSWORD` — bir Cloudflare **secret**, `wrangler.jsonc`'de veya kodda hiçbir
  yerde açık yazmıyor.
- Karşılaştırma sabit zamanlı (`safeEqual`) — düşük riskli bir parola için gereğinden fazla ama
  bedelsiz.
- Secret hiç tanımlı değilse (`env.ANALIZ_PASSWORD` boş) → herkes reddedilir, "açık kapı" değil
  "kapalı kapı" varsayılan.

### Parolayı kim belirliyor

**Ben belirlemedim.** `wrangler secret put ANALIZ_PASSWORD` interaktif bir komut — parolayı
sohbet geçmişinde bırakmamak için **senin çalıştırman** gerekiyor:

```bash
cd ~/Developer/jumvi-missions
npx wrangler secret put ANALIZ_PASSWORD
```

Komut parolayı soracak, sen yazacaksın, hiçbir yerde loglanmayacak. Bu adım atılmadan `/analiz`
canlıda çalışmaz — `isAuthorized()` secret yoksa koşulsuz `false` döner.

---

## 5. Doğrulama

### `wrangler dev` üzerinde, 10 senaryo (`curl`)

```
şifresiz  /data/...                  → 401
şifresiz  /assets/analiz/            → 401
şifresiz  /analiz                    → 401
yanlış şifre                         → 401
doğru şifre /analiz                  → 200, gerçek panel HTML'i
doğru şifre /data/snapshots/index.json → 200, gerçek JSON
doğru şifre /assets/analiz/ (direkt) → 200
/api/beacon (auth'suz kalmalı)       → 204
/  (auth'suz kalmalı)                → 200
/app.js (auth'suz kalmalı)           → 200
```

10/10 geçti. Son üçü kritik: `/analiz` ve `/data/` dışındaki hiçbir şey etkilenmedi — çocuk
uygulaması, beacon, ana sayfa tamamen auth'suz kalmaya devam ediyor.

### Gerçek tarayıcıda render

`curl` sayfayı çalıştırmaz, sadece indirir — CSP altında gerçekten render olduğunu görmek için
tarayıcıda `fetch()`'i `Authorization` header'ıyla yamalayıp aynı origin'de `document.write` ile
sayfayı yeniden yazdım (native Basic Auth dialog'u bu headless ortamda tetiklenmiyor). Panel
canlı `_headers` CSP'siyle (`default-src 'self'; ...`) sıfır konsol hatasıyla render oldu: ızgara,
uyarılar, huni hepsi göründü.

### Google Fonts kaldırıldı

Panel eskiden `fonts.googleapis.com`'dan üç font çekiyordu. Bu CSP'nin `style-src`/`font-src`
listesinde yok — sitenin tamamı için CSP'yi genişletmek (bir iç araç fontu uğruna) gereksiz risk
artışı olurdu. Bunun yerine `<link>` etiketleri kaldırıldı, `system-ui`/`ui-monospace` fallback'ine
düşüyor — CSP'ye hiç dokunulmadı, panel görsel olarak hâlâ okunabilir.

### `CACHE_NAME` bump gerekti — beklenmedik ama doğru

`src/worker.js`'i değiştirdiğim için `tools/check-core-assets.sh` `/tr/index.html`'in hash'inin
değiştiğini bildirdi — çünkü o sentetik hash `index.html + tr/i18n.js + src/worker.js`'nin
toplamından hesaplanıyor (bkz. script içindeki yorum). `/tr` sayfasının içeriğine hiç dokunmadım
ama worker.js bir girdisi olduğu için kural doğru tetiklendi. `CACHE_NAME` v185 → v186,
`--update` ile yeniden kilitlendi.

---

## 6. Kapsam dışı / bilinen sınırlar

- Ayrı subdomain (`hq.jumvi.co`) — B seçeneği, reddedildi (§1).
- Kullanıcı bazlı erişim (herkese aynı parola) — tek kullanıcılı bir proje için yeterli, çoklu
  kullanıcı/rol sistemi değil.
- Production secret'ın gerçekten set edildiğinin doğrulanması — bu merge sonrası, `wrangler
  secret put` çalıştırıldıktan sonra yapılmalı: `curl -u x:GERÇEK_ŞİFRE https://qr.jumvi.co/analiz`.

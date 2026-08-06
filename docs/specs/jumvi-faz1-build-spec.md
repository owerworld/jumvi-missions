# JUMVI — Faz 1 Build Spec'i

**Repo:** `owerworld/jumvi-missions` (`~/Developer/jumvi-missions`)
**Tip:** Build. Kod yazılacak, commit atılacak.
**Önkoşul:** Faz 0 tamamen kapanmış olmalı — aşağıdaki tabloyu doğrula, HAYIR varsa DURMADAN devam etme.

## BAŞLATMA KAPISI

| Madde | Durum |
|---|---|
| Denetim 1 (Cloudflare/IP) | ✅ temiz |
| Denetim 2 (Sertifika) | ✅ bulundu, düzeltildi (`156d060`), canlıda doğrulandı |
| Denetim 3 (Mikrofon) | ✅ temiz |
| Plausible kaldırma | ✅ canlıda doğrulandı |
| Cloudflare Workers Builds — son deploy | ✅ success |
| Manuel Dashboard 5 madde (Web Analytics, Logpush, log saklama, Observability, WAF) | ✅ tamamlandı — Web Analytics sadece jumvi.co'da (qr.jumvi.co dahil değil), Logpush Free plan'da yok, Observability disabled |

---

## GLOBAL KURALLAR

1. Her görev ayrı session'da. Aralarında `/clear`.
2. Şema kararları (WAE tablo yapısı, event isimleri, snapshot formatı) **geri alınamaz** — bir kez veri akmaya başlarsa isim değiştirmek geçmiş veriyi böler. Bu yüzden 1.2 ve 1.3'te **önce onay iste, sonra uygula.**
3. Hiçbir event'e kullanıcı/cihaz kimliği (UUID, IP, fingerprint) eklenmesin.
4. Süre verisi her zaman **bucket** olarak (`<1m`, `1-3m`, `3-10m`, `>10m`), ham saniye değil.
5. Yaş verisi toplanmayacak — bunun yerine `difficulty` (pack seçimine bağlı, dolaylı).
6. Mikrofon/ses girişi bu fazda da YOK (Denetim 3 kararı geçerli).

---

# GÖREV 1.1 — Deploy Sonrası Asset Health Monitor

**Model:** Sonnet
**Öncelik:** İlk — diğer her şeyi koruyan güvenlik ağı.

## Amaç

Her deploy sonrası, kullanıcı beklemeden, kritik asset'lerin gerçekten servis edildiğini doğrula. Geçen turda yakalanan cache-bump bug'ı gibi sorunları otomatik yakala.

## Kapsam

`tools/check-core-assets.sh`'in yanına, ayrı bir script: `tools/check-deploy-health.sh` (veya CI adımı).

Kontrol edilecekler:
- `CORE_ASSETS` listesindeki her dosya için: HTTP 200 mü, `Content-Type` beklenen mi (örn. `.webp` → `image/webp`, `.js` → `application/javascript`)
- `service-worker.js`'deki `CACHE_NAME` ile `tools/core-assets.lock`'taki değer eşleşiyor mu (Faz 0'da elle bulduğumuz uyuşmazlığın otomatik versiyonu)
- Ana JS dosyaları (`app.js`, `jumvi-hub-app.js`, `leo-tour.js`) syntax olarak geçerli mi (`node --check` eşdeğeri, üretimde çalışacak versiyon üzerinden)
- Kritik mission pack asset'leri (`/assets/ui/*`) örnekleme ile kontrol

## Çalıştırma

GitHub Actions'a bir adım olarak ekle (mevcut `pages-build-deployment` workflow'una DEĞİL — o ayrı, ilgisiz bir hedef, ona dokunma). Cloudflare Workers Builds sonrası tetiklenecek yeni, ayrı bir workflow veya script.

Başarısız olursa: build'i kırma (henüz), sadece açık uyarı çıktısı ver. İleride Slack/email entegrasyonu düşünülebilir — bu fazda kapsam dışı.

## Rapor

`docs/audits/faz1-asset-monitor.md` — ne eklendiğini, nasıl çalıştırıldığını, ilk çalıştırmanın sonucunu yaz.

---

# GÖREV 1.2 — Minimal Beacon (5 Event)

**Model:** opusplan (plan Opus, uygulama Sonnet) — şema kararı geri alınamaz.
**Öncelik:** İkinci.

## Amaç

Launch'tan itibaren en temel funnel'ı ölçmeye başla. Tam pipeline değil — 1.3'ün temelini atan minimal set.

## Event listesi (KESİN — değiştirilmeyecek isimler)
```
app_open
mission_start { id }
mission_complete { id }
help_open { reason }
player_count { n }
```

`help_open.reason` sabit enum, serbest metin DEĞİL:
```
ball_stuck | ball_hard_to_remove | strap_uncomfortable |
need_more_space | instructions_unclear | mission_too_hard
```

`player_count.n`: `2 | 3 | 4`

## Nereye gönderiliyor

Cloudflare Workers Analytics Engine (WAE).

## writeDataPoint şeması — ÖNCE ONAY İSTE

```js
env.JUMVI_ANALYTICS.writeDataPoint({
  blobs: [eventName, JSON.stringify(props)],
  doubles: [Date.now()],
  indexes: [eventName]
});
```

**Kritik kural:** `blobs`/`doubles`/`indexes` hiçbirine IP, User-Agent, `request.cf`, cihaz kimliği yazılmayacak. Commit'ten önce kendi kendine denetle ve raporda "IP/cihaz kimliği yazılmadığını doğruladım" diye açıkça belirt.

## Player count nereye entegre edilecek

Mission setup akışının **içine** göm — mission seçiminden önce blocking bir ekran AÇMA (funnel'ı bozar).

## Rapor

`docs/audits/faz1-beacon.md` — event şeması, writeDataPoint konumları (dosya:satır), IP/kimlik yazılmadığının doğrulaması.

---

# GÖREV 1.3 — Haftalık Snapshot Şeması

**Model:** opusplan
**Öncelik:** Üçüncü, 1.2 canlıya çıktıktan sonra.

## Amaç

WAE 3 ay sonra veriyi siler. Exit/Ar-Ge/pazarlama için kalıcı olması gereken şey bu değil — **haftalık aggregate özet.** Bunu git'e commit ediyoruz, WAE'ye değil.

## Format

`data/snapshots/YYYY-WW.json`:

```json
{
  "week": "2026-35",
  "period_start": "2026-08-24",
  "period_end": "2026-08-30",
  "app_opens": 74,
  "mission_starts": 210,
  "mission_completes": 156,
  "recorded_completion_ratio": 0.74,
  "help_opens": {
    "ball_stuck": 3,
    "ball_hard_to_remove": 8,
    "strap_uncomfortable": 1,
    "need_more_space": 0,
    "instructions_unclear": 2,
    "mission_too_hard": 4
  },
  "player_count": { "2": 40, "3": 12, "4": 22 }
}
```

## Nasıl üretiliyor

`tools/generate-weekly-snapshot.js` (veya `.sh`) — WAE'den GraphQL Analytics API ile haftalık sorgu çekip JSON'a yazar. **Otomatik çalışmasın bu fazda** — manuel tetiklenir.

## Metodoloji notu — dosyanın kendisine göm
```
QR Activation Proxy — metodoloji notu:
Bu sayılar cihaz/kullanıcı kimliği içermez. "app_opens" ilk tarayıcı
açılışlarının tahmini sayısıdır; hane başına birden fazla cihaz veya
tarayıcı verisi temizleme nedeniyle olduğundan az/çok sayılabilir.
Kesin kullanıcı sayısı değil, yönsel (directional) bir göstergedir.
```

## Rapor

`docs/audits/faz1-snapshot.md`

---

# GÖREV 1.4 — Privacy Policy Güncellemesi

**Model:** Sonnet — ama metnin son hali bu sohbette onaylanmalı, commit etme.

## Talimat

Mevcut privacy policy'yi bul, yapıyı KORU, ekle:
1. **Analytics** — WAE kullanımı, 5 event, kullanıcı kimliği yok, 90 gün saklama.
2. **Ses/mikrofon** — mikrofon yok, sadece text-to-speech.

Taslağı `docs/drafts/privacy-policy-update.md`'ye yaz, commit ETME.

---

# ÇALIŞTIRMA SIRASI

Her görev ayrı session, aralarında `/clear`. Şu an: **Görev 1.1**.

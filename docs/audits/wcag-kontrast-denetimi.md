# Erişilebilirlik kontrast denetimi — İngilizce ana rota

**Branch:** `claude/jumvi-visual-accessibility-k92evo` · **Tarih:** 2026-08-24
**Kapsam:** yalnızca WCAG 2.2 SC 1.4.3 (metin kontrastı). Renk paleti, Coach Leo,
tipografi, düzen ve bilgi mimarisi değişmedi; yeniden markalama yapılmadı.

---

## 1. Nasıl ölçüldü

`tools/contrast-audit.js` zaten repodaydı — sayfaya enjekte edilen, her görünür
metin düğümünün ön plan/arka plan oranını gradient stop'ları ve alfa katmanları
dâhil hesaplayan ölçüm aracı. Eksik olan, onu **nereye** bakacağını bilen bir
sürücüydü: JUMVI'nin kontrast hataları ilk ekranda değil, sertifika sayfasında,
görev içindeki skor pedinde ve 36 illüstrasyonun içinde, çoğu yalnızca koyu
temada duruyordu.

`tools/contrast-sweep.mjs` (yeni) bu sürücü. Üç tarama, ikisi de temada:

| Tarama | Ne geziyor |
|---|---|
| `surfaces` | welcome, 4 sekme, tüm dialog'lar (badges, privacy, help, certificate, profile, team XP, seasonal, 3D fallback) |
| `missions` | 36 görev sheet'i, tek tek açılıp ölçülüyor |
| `states` | arama/filtre açık, oynanan görev, skor pedi, undo bar, tutorial, badge unlock, 3D hub — 320/390/430 px |

```
npx http-server -p 8910 -c-1
node tools/contrast-sweep.mjs                 # üç tarama
node tools/contrast-sweep.mjs --sweep=missions
```

AA altında tek bir metin varsa çıkış kodu 1 — palet değişikliğini kapıya bağlamak için.

**Ölçüm tuzağı:** tema sınıfı değiştirildiği anda her yüzeyde bir
`background-color` geçişi başlıyor. Geçişin ortasında ölçmek, ekranda hiç
görünmeyen yarı-karışmış renkleri hata olarak raporluyor (welcome seviye
kartları geçiş ortasında 2.02:1, oturunca 15:1). Sürücü tema değişiminden
sonra geçişin bitmesini bekliyor.

## 2. Baseline

`140 yüzey geçişi, 4628 metin düğümü, 20'si AA altında` — dokuz ayrı kusur.

## 3. Değişenler

| # | Yüzey | Neydi | Ne oldu | Önce → Sonra | Dosya |
|---|---|---|---|---|---|
| 1 | Koyu temada primary butonlar (Start My First Mission, Replay guided tour, Save, + Add Child) | `#4FB3FF` dolgu üzerine beyaz metin | Aynı dolgu, `--jv-on-blue` mürekkep — uygulamadaki diğer primary butonların zaten kullandığı kural | 2.28:1 → 7.93:1 | `warm-toy.css` |
| 2 | Sertifika · "Save to Photos" | Yeşil gradient üzerine beyaz | Gradient aynı; metin `--ink` (paletin "parlak dolgu → koyu metin" kuralı) | 1.74:1 → 10.25:1 / 5.42:1 | `style.css` |
| 3 | Sertifika · "Share with family" | `#6366f1 → #8b5cf6` | Aynı indigo→mor rampası bir ton koyu: `#6062ee → #7f4ef0` | 4.47/4.23:1 → 4.69/4.94:1 | `style.css` |
| 4 | Sertifika · "Or save as PDF" (koyu tema) | Açık temanın gri tonu koyu temaya sabitlenmiş (`#64748b`) | Koyu temanın kendi muted token'ı `--jv-text-3` | 3.81:1 → 7.17:1 | `style.css` |
| 5 | Grown-ups · ayar değerleri ("System", "On") | `--accent-blue` (dolgu tonu) metin olarak | `--blue` — aynı mavinin metin ağırlıklı, temaya duyarlı varyantı | 2.34:1 → 4.88:1 | `style.css` |
| 6 | İllüstrasyon üçüncül metni ("slow"/"fast", görev 14) | `#9aa1ac` / `#7c828c` | `#67707d` / `#8a919b` — `--color-text-secondary`'den hâlâ belirgin biçimde açık | 2.60:1 → 5.01:1 (açık), 4.37:1 → 5.31:1 (koyu) | `jumvi-icons.css` |
| 7 | Görev sheet'i karusel sayacı ("1 / 3") | İllüstrasyon üçüncül tonu, ama sheet kartının üstünde duruyor | Aynı ikon paletinin ikincil tonu | 2.08:1 → 4.71:1 | `style.css` |
| 8 | Skor pedi · "Best: 0" (açık tema) | `--accent-blue`, %12 gökyüzü tint'i üzerinde | `--jv-recommend-fg` — uygulamanın mevcut "tint üzerine mavi" token'ı | 1.98:1 → 7.85:1 | `style.css` |
| 9 | Skor pedi · "Tap on every catch" (koyu tema) | Sheet'in gövde rengi (`#e5e7eb`) pedin kendi beyazını yeniyordu, üstüne `opacity:.85` | Ped kendi beyaz mürekkebini geri alıyor, opaklık 1 | 3.94:1 → 4.88:1 | `style.css`, `warm-toy.css` |

Hiçbir marka rengi (`--wt-sky`, `--wt-blue`, `--wt-lime`, `--wt-orange`, ada
yeşilleri, Leo) değişmedi. Değişen tek dolgu rengi 3 numaradaki mor gradient;
gerisi metin rengi ya da token seçimi.

## 4. Sonuç

`140 yüzey geçişi, 4628 metin düğümü, 0'ı AA altında` (açık + koyu, 320/390/430 px).

## 5. Kapsam dışı kalanlar

- **SC 1.4.11 (metin olmayan kontrast)** — buton kenarlıkları, ikon çizgileri,
  karusel noktaları ölçülmedi. Denetim aracı yalnızca metin düğümlerini geziyor.
- **9 px illüstrasyon etiketleri** — görev 14'teki "slow"/"fast" artık okunur
  ama hâlâ projenin kendi 13 px alt sınırının altında. Etiketler üretilmiş SVG
  içinde; büyütmek illüstrasyon düzenini etkiler, bu görevin kapsamı değil.
- **`/tr/` rotası** — master prompt kapsam dışı bırakıyor.
- **Onboarding CTA örtüşmesi** — 390×844'te "36 games included…" yardımcı metni
  Start butonunun altında kalıyor. Bilinen bir P0, ama düzen sorunu; bu görev
  kontrastla sınırlıydı.

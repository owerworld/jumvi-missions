# Coach Leo 3D Model — Kaynak Temizliği

**Branch:** `feat/faz2-leo-cleanup` · **Tarih:** 2026-08-13
**Durum:** ✅ Tek kaynağa indirildi, doku çözünürlüğü iyileştirildi, canlıda **404 döneceğini** doğruladığım bir hata düzeltildi. Şekil sorunu **bilerek** çözülmedi — bu bir remodel işi, bu görevin kapsamı dışı.
`main`'e **merge edilmedi** — launch'ı bloklamıyor, bekleyebilir.

---

## 1. Neden bu temizlik gerekti

İki önceki araştırma turu (bu dosyanın önceki sürümlerinde, silinmeden önce belgelenmişti) şunu ortaya çıkardı:

1. **"Real GLTF model approved by user comparison" yorumu kanıtsızdı.** Model ile aynı commit'te (28 Haziran, `0713128`) eklenmiş, ama commit mesajında onaya dair hiçbir şey yok.
2. **Repo'daki "source" dosya gerçek orijinal değildi.** `textured_mesh_source.glb` (754 KB) ile masaüstündeki gerçek orijinal (`textured_mesh.glb`, 3.98 MB) **aynı geometriye** sahipti (20.000 üçgen, aynı `roughnessFactor`), ama dokusu **2048×2048 PNG → 1024×1024 WebP**'ye zaten düşürülmüş hâldeydi — bu adım git'e hiç girmeden, repo dışında yapılmıştı.
3. **Gerçek orijinal git'e hiç girmemişti** (`git log --all` bu isimle sıfır sonuç).

Kullanıcı gerçek orijinali (`coach-leo-source.glb`, 2048×2048 PNG doku, sıkıştırılmamış) elle sağladı. Bu görev, üç dağınık dosyayı tek bir doğru kaynağa indiriyor.

---

## 2. Ne değişti

| Önce | Sonra |
|---|---|
| `prototypes/textured_mesh_optimized.glb` (245 KB, 1024² webp) | **silindi** |
| `prototypes/textured_mesh_source.glb` (754 KB, zaten küçültülmüş) | **silindi** |
| — | `prototypes/coach-leo-source.glb` (3.98 MB, **2048² PNG, sıkıştırılmamış**) — yeni tek kaynak |
| — | `assets/leo/coach-leo-optimized.glb` (331 KB, meshopt + **2048² webp**, 20.000 üçgen) — canlıda kullanılan |

`prototypes/` zaten `.assetsignore`'da — 3.98 MB'lık kaynak production'a **hiç gitmiyor**, kullanıcının istediği gibi.

### Sıkıştırma

64a240e'de kullanılan aynı pipeline (`@gltf-transform/cli optimize`, meshopt, **simplify kapalı** — 20.000 üçgenin hepsi korunuyor), ama bu sefer 1024'e düşürülmüş WebP'den değil, **2048² PNG kaynaktan** başlayarak:

```bash
npx @gltf-transform/cli@4 optimize prototypes/coach-leo-source.glb assets/leo/coach-leo-optimized.glb \
  --compress meshopt --simplify false \
  --texture-compress webp --texture-size 2048
```

Birkaç doku boyutu denendi, hedef 300–500 KB'ye göre:

| `--texture-size` | Sonuç boyutu |
|---|---|
| 1024 (eski yaklaşım) | 221 KB |
| 1280 | 244 KB |
| 1536 | 271 KB |
| **2048 (seçildi)** | **331 KB** |

2048 seçildi — hedef aralıkta kaldı **ve** dokuyu hiç küçültmeden, sadece WebP'ye çevirerek sıkıştırdı. Doğrulandı: 20.000 üçgen korunmuş, `EXT_meshopt_compression` + `EXT_texture_webp` uygulanmış, doku gerçekten 2048×2048.

---

## 3. Kritik yan bulgu — canlıda muhtemelen hiç yüklenmiyordu

`jumvi-hub-app.js` modeli `./prototypes/textured_mesh_optimized.glb?v=20260723-meshopt` yolundan yüklüyordu. Ama **`prototypes/` `.assetsignore`'da** — yani bu dosya `qr.jumvi.co` üzerinden hiçbir zaman servis edilmiyordu:

```
$ curl -sIL https://qr.jumvi.co/prototypes/textured_mesh_optimized.glb
HTTP/2 404
```

Bu, gerçek kullanıcıların (launch'tan beri, `.assetsignore`'a `prototypes/` eklendiği andan itibaren) **hiçbir zaman gerçek GLTF modelini görmediği**, her zaman `createCoachLeo()`'nun prosedürel fallback rig'ine düştüğü anlamına geliyor — sessizce, `window.__jumviFallbacks` local-only olduğu için fark edilmeden.

**Düzeltme:** yeni dosya `assets/leo/coach-leo-optimized.glb`'de — bu dizin `.assetsignore`'da değil, servis ediliyor (doğrulandı: `assets/leo/leo-face-64.webp` ve `assets/hub3d-optimized/.../*.glb` canlıda 200 dönüyor). `prototypes/coach-leo-source.glb` ise bilerek `prototypes/` altında kaldı — 3.98 MB'lık dosyanın production'a gitmemesi gereken tam da bu.

**Doğrulandı — preview deploy'da (2026-08-13):** `feat/faz2-leo-cleanup` push edildikten sonra Cloudflare Workers Builds'in ürettiği preview URL'inde (`feat-faz2-leo-cleanup-jumvi-missions.saykirtasiye.workers.dev`) üç yol test edildi:

```
/assets/leo/coach-leo-optimized.glb      → 200, content-type: model/gltf-binary
                                            cache-control: public, max-age=86400, stale-while-revalidate=604800
/prototypes/textured_mesh_optimized.glb  → 404  (eski silinen yol)
/prototypes/coach-leo-source.glb         → 404  (3.98 MB kaynak — production'a gitmedi, beklendiği gibi)
```

`.assetsignore` analizinin ve `_headers` kuralının doğru çalıştığının uçtan uca kanıtı bu — `main`'e merge edilmeden.

### Versiyon sorgu dizesi bilerek yok

Eski yol `?v=20260723-meshopt` taşıyordu. Yeni yol taşımıyor — `_headers` dosyasındaki bilinçli kurala uyuyor: `/assets/*` altındaki her şey **versiyonsuz** referans veriliyor çünkü service worker bu dosyaları tam yol üzerinden precache ediyor ve bir `?v=` bu eşleşmeyi bozar. Tazelik `max-age=86400, stale-while-revalidate=604800` ile sağlanıyor — aynı `_headers` yorumu ironik biçimde tam da Leo'nun eski GLB'sinin bu yüzden bayatladığını anlatıyor.

---

## 4. Yorum satırı — doğrulanmamış iddia kaldırıldı

`jumvi-hub-app.js`'deki eski yorum:

> "Real GLTF model approved by user comparison"

Kanıtsızdı (bkz. §1). Yerine dürüst bir not kondu:

```js
// Source: AI image-to-3D conversion (temp mesh name "tmphriv0dlo.ply" in the
// original file confirms this). Geometry/shape has known issues — does not
// match the locked 2D Coach Leo spec proportions. Texture/colors are correct.
// Shape needs a real remodel post-launch (see docs/audits/faz2-leo-model.md).
```

"tmphriv0dlo.ply" iddiası kontrol edildi — yeni `coach-leo-source.glb`'nin glTF JSON'ında `meshes[0].name` ve `nodes[1].name` alanları gerçekten bu string'i taşıyor, `asset.generator` de `"https://github.com/mikedh/trimesh"` — bir AI image-to-3D pipeline'ının tipik çıktı imzası (geçici `.ply` dosya adı, trimesh ile glTF'e çevrilmiş).

Aynı `jumvi-leo.js`'deki (modül varsayılanı) eski dosya yolu da düzeltildi — fonksiyonel olarak ölü kod olsa da (gerçek çağrı yeri her zaman kendi `modelUrl`'unu veriyor), yanlış bir varsayılan bırakmanın anlamı yoktu.

---

## 5. Doğrulama — tarayıcıda

Statik sunucu üzerinden (`python3 -m http.server`), servis worker + tüm tarayıcı cache'leri temizlenerek, sıfırdan:

```
window.__jumviFallbacks → { list: [], counts: {} }
```

Boş — **hiçbir fallback tetiklenmedi**, yani gerçek GLTF modeli (yeni dosya) başarıyla yüklendi, meshopt decoder doğru kayıtlı (`jumvi-hub-app.js:1365`, `jumvi-leo.js:293` — 64a240e'nin daha önce düzelttiği "decoder unutuldu, model sessizce fallback'e düştü" hatası tekrarlanmadı).

Canlı hub içi ekran görüntüsü + `tools/leo-compare.html` (bu görevde güncellendi — artık `coach-leo-source.glb` / `coach-leo-optimized.glb`'ye işaret ediyor) ile üretilen stüdyo render'ı gönderildi.

**Öncesi/sonrası (yüz yakın plan, 1024px silinen dosya vs 2048px yeni dosya):** doku belirgin biçimde daha keskin — kürk detayı, göz kenarları, bandana kıvrımları. **Şekil aynı kaldı** — beklenen, bu bir "fix" değil.

---

## 6. AÇIK KALAN — şekil sorunu

**Geometri değiştirilmedi ve değiştirilmemeliydi** (bu görevin kapsamı dışı). `coach-leo-source.glb` bir AI image-to-3D dönüşümünün çıktısı (§4) ve kilitli 2D Coach Leo tasarımının oranlarına uymuyor — önceki incelemede not edildiği gibi, zoolojik bir quokka'dan çok tombul bir su samuru/kunduz yavrusuna benziyor. Renkler doğru (kum/tan kürk, mavi bandana, kahverengi göz — hepsi piksel ölçümüyle doğrulanmıştı), sorun yalnızca şekilde.

**Launch sonrası gerçek bir remodel gerekiyor.** Bu doküman o işin referans noktası: mevcut model neden yetersiz, gerçek kaynağın nerede durduğu, sıkıştırma pipeline'ının nasıl tekrarlanacağı.

---

## 7. Kapsam dışı / dokunulmayanlar

- Şekil/geometri düzeltmesi — §6.
- `prototypes/jumvi-leo-test.html`'in kendi `createCoachLeo(THREE)` çağrısı — `useModel` varsayılan `false` olduğu için model yolunu hiç kullanmıyor, dokunmaya gerek yok.
- `DRACOLoader` importu (`tools/leo-compare.html`) — yeni dosya draco kullanmıyor (yalnızca meshopt), ama loader'ı kaydetmek zararsız; temizlik bu görevin odağı değil.
- Production'da `assets/leo/coach-leo-optimized.glb`'nin gerçekten 200 döndüğünün deploy-sonrası doğrulanması — §3'te not edildi, bu branch merge edilince yapılmalı.

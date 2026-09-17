# `/panel` — kurulum ve kullanım

Uygulamanın **tamamlanmış hâlini** görmek için, yalnızca sizin girebildiğiniz
sayfa. `qr.jumvi.co/panel`

---

## 1. PIN'i bir kez ayarlayın

PIN **depoda değil**. Bu depo GitHub'da herkese açık; koda yazılan bir PIN,
depoyu açan herkesin eline geçer. Onun yerine Cloudflare secret'ında duruyor —
aynı `/analiz` panelinde olduğu gibi.

```
npx wrangler secret put PANEL_PASSWORD
```

Komut PIN'i sorduğunda yazıp Enter'a basın. Bu kadar; bir daha gerekmez.

**Secret ayarlanmadığı sürece `/panel` kimseye açılmaz** — `PANEL_PASSWORD`
tanımsızsa kontrol `false` döner ve sayfa 401 verir. Yani yanlış tarafa değil,
kapalı tarafa düşer.

PIN'i değiştirmek isterseniz aynı komutu tekrar çalıştırmanız yeterli.

## 2. Girmek

Telefonda `qr.jumvi.co/panel` açın. Safari kullanıcı adı ve şifre soracak:

* **kullanıcı adı:** boş bırakın (kontrol edilmiyor)
* **şifre:** PIN'iniz

`/analiz` ile aynı akış. İki panel **ayrı secret** kullanıyor: birinin PIN'ini
değiştirmek diğerini etkilemez.

## 3. Ne yapıyor

“Tamamlanmış hâliyle aç” düğmesi:

* **Panel** adında ayrı bir profil açar (ilk seferde)
* O profilde 36 görevin tamamını tamamlanmış işaretler
* 12 günlük seri ve günün hedefini tamamlanmış yazar
* Uygulamayı açar

Rozetler, XP, seviye, ilerleme halkası ve sertifika bunlardan **kendiliğinden**
doluyor — uygulama onları görev listesinden hesaplıyor, panelin ayrıca
“hepsini aç” diye bir listesi yok. Bir rozet kuralı değişirse panel de
kendiliğinden doğru kalır.

Ölçülen sonuç: `36 / 36 missions`, `Level 7 · JUMVI Champion`, `12 day streak`,
`Goal done!`, altı pakette de `6/6`, sertifika “Unlocked”.

## 4. Kendi ilerlemeniz silinmez

Panel **ayrı bir profil** kullanıyor. Uygulamada zaten bir çocuk profili varsa
onun verisine hiç dokunulmuyor — panel kendi `jumvi_panel_…` anahtarlarına
yazıyor.

Test edilen senaryo: cihazda 3 görev bitirmiş “Ada” profili varken panele
girildi, uygulama 36/36 gösterdi, Ada'nın ilerlemesi 3 olarak yerinde kaldı,
“Kendi profilime dön” sonrası aktif profil Ada'ya döndü ve panel profilinin
durumu da bozulmadan kaldı.

Geri dönmenin iki yolu var: paneldeki **“Kendi profilime dön”** düğmesi, ya da
uygulamanın kendi profil seçicisi (Grown-ups → Kids & Settings).

## 5. Arama motorları

Sayfa `X-Robots-Tag: noindex` ile dönüyor ve HTML'de de `noindex, nofollow`
var. Zaten 401'in arkasında, ama bir bağlantı sızarsa diye.

## 6. Nerede duruyor

| Dosya | Ne |
|---|---|
| `src/worker.js` | PIN kontrolü — istek asset katmanına ulaşmadan önce |
| `assets/panel/index.html` | Sayfanın kendisi |
| `wrangler.jsonc` | `run_worker_first`: `/assets/panel/*` |

`run_worker_first` satırı kritik: o olmadan `/assets/panel/` adresine doğrudan
yapılan bir istek PIN'i hiç görmeden dosyaya ulaşırdı.

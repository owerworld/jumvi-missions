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

## 2. Girmek — tek dokunuş

İlk sefer, telefonda şu adresi açın (PIN'i URL'e koyarak):

```
https://qr.jumvi.co/panel?k=PIN
```

Olan şu: sunucu PIN'i doğrular, karşılığında bir çerez bırakır ve sizi temiz
`/panel` adresine yönlendirir — PIN adres çubuğundan anında kaybolur. Sonra
**Paylaş → Ana Ekrana Ekle** deyin.

O ikonun adresi artık sade `qr.jumvi.co/panel`. Sonraki her açılışta hiçbir şey
yazmıyorsunuz: tek dokunuş, doğrudan panel.

Çerez **PIN değil**. `<son kullanma>.<HMAC-SHA256(secret, son kullanma)>`
biçiminde imzalı bir jeton; geri çevrilip PIN elde edilemez. `HttpOnly` sayfa
JavaScript'inin erişmesini, `Secure` şifresiz bağlantıyı, `Path=/panel` ise
alan adının başka hiçbir yerine gönderilmesini engelliyor. 60 gün geçerli.

Kullanıcı adı/şifre penceresi de çalışmaya devam ediyor (masaüstü için, ya da
çerez silinirse): kullanıcı adını boş bırakıp PIN'i yazın.

**Dürüst sınır:** `?k=` bağlantısı o tarayıcının geçmişine düşer. Tek dokunuşun
bedeli bu; zaten çerezin duracağı cihazla aynı cihaz, ve yönlendirme adres
çubuğundan hemen siliyor. Rahatsız ederse kullanıcı adı/şifre yöntemini
kullanın, o URL'de iz bırakmaz.

`/analiz` ile aynı mantık ama **ayrı secret**: birinin PIN'ini değiştirmek
diğerini etkilemez. PIN'i değiştirdiğinizde daha önce dağıtılmış bütün çerezler
de geçersiz olur — jeton secret'tan türetildiği için.

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
| `src/worker.js` | PIN/çerez kontrolü — istek asset katmanına ulaşmadan önce |
| `assets/panel/index.html` | Sayfanın kendisi |
| `wrangler.jsonc` | `run_worker_first`: `/assets/panel/*` |

`run_worker_first` satırı kritik: o olmadan `/assets/panel/` adresine doğrudan
yapılan bir istek PIN'i hiç görmeden dosyaya ulaşırdı.

## 7. Test edilenler

| Durum | Sonuç |
|---|---|
| Secret ayarlı değil (dört yol da) | 401 |
| Kimlik yok | 401 |
| Yanlış PIN (URL'de veya pencerede) | 401 |
| Doğru PIN | 200 |
| Çerezle, hiçbir şey yazmadan | 200 |
| Kurcalanmış çerez | 401 |
| Süresi geçmiş çerez | 401 |
| PIN değiştikten sonra eski çerez | 401 |
| `/analiz`'e panel PIN'i ile | 401 |
| Başka birinin tarayıcısı | 401 |

Tek dokunuş yolculuğu WebKit ve Chromium'da baştan sona sürüldü: kayıtlı
bağlantı → pencere çıkmadan panel → uygulama `36 / 36 missions`.

> Bir tuzak kayda değer: aynı test `http://127.0.0.1` üzerinde Chromium'da
> geçip WebKit'te **kalıyordu**. Sebep kodda değil — WebKit, `Secure` çerezi
> şifresiz bir kaynakta saklamayı (doğru olarak) reddediyor; Chromium ise
> localhost'u güvenilir sayıp gizliyor. Gerçek https üzerinde iki motor da
> aynı. `tools/tr-qa/https-front.mjs` tam bunun için duruyor; olmasaydı akla
> gelen ilk "düzeltme" `Secure` bayrağını kaldırmak olurdu.

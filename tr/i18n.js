/* JUMVI Turkish localization layer — /tr only.
 * Keep internal mission IDs, pack keys, analytics enums and localStorage keys
 * unchanged so English and Turkish share exactly the same progress state.
 */
(function () {
  'use strict';

  document.documentElement.lang = 'tr';
  window.__JUMVI_LOCALE = 'tr-TR';

  const missionTR = {"1":{"title":"Hız Canavarı","steps":["Aranızda 2 büyük adım olsun","Hızlı at — ama yumuşak!","Yakala, hazır pozisyona dön ve tekrar!"],"win":"45 saniyede olabildiğince çok yakala — kendi rekorunu geç!","safety":"Topu çene hizasının altında at — asla yüze nişan alma.","tip":"Minikler oynuyorsa iyice yavaşlat — önce eğlence, hız sonra!"},"2":{"title":"Kırmızı Işık, Yeşil Işık","steps":["YEŞİL IŞIK — normal şekilde at ve yakala","KIRMIZI IŞIK — DON! Atmak da hareket etmek de yok","Süre bitene kadar devam et!"],"win":"60 saniyeyi KIRMIZI IŞIKTA hiç atış yapmadan tamamla!","safety":"Don demek gerçekten donmak demek — gizli hareket yok!","tip":"En eğlenceli kısmı? Donunca gülmemeye çalışmak!"},"3":{"title":"Hızlı Dokun","steps":["Arkadaşın topu yumuşakça atsın","Boştaki elinle JUMVI raketine bir kez hızlıca dokun","Sonra dön ve yakala! Her 10 atışta rol değiştirin"],"win":"Her iki tarafta 10 temiz dokun-yakala yapınca görev tamam!","safety":"Raketi sıkı tut — sadece boştaki elinle dokun.","tip":"Ritmi bul: at → DOKUN → yakala — tekrar!"},"4":{"title":"El Değiştir","steps":["Raketi güçlü elinde tutarak başla","Her yakalamadan sonra raketi diğer eline geçir","Yeni elinle yakala. Her atışta el değiştir!"],"win":"Dönüşümlü 12 yakalamaya ilk ulaşan kazanır!","safety":"El değişimini sakin yap — acele edip düşürme.","tip":"Güçlü elin genelde yazı yazdığın eldir. Onunla başla!"},"5":{"title":"Heykel Modu","steps":["Topu yakala — sonra 2 saniye DON","Hareket yok — raket, beden, ayaklar; hepsi taş gibi","Sonra geri at!"],"win":"Her birinin arasında tam donarak 10 kez yakala!","safety":"Donma sırasında gerçekten hiç hareket etme.","tip":"Komik bir heykel pozu dene — her tur daha eğlenceli!"},"6":{"title":"Sayıyı Tekrarla","steps":["Topu atarken sayıyı yüksek sesle söyle","Yakalayan sayıyı tekrar edip topu geri atsın","Düştü mü? 1’den yeniden başlayın!"],"win":"Üst üste 15’e ulaş — yüksek sesle say!","safety":"Kaçırırsan gerilme — sadece yeniden başla.","tip":"Gizli matematik çalışması — çocuklara söyleme!"},"7":{"title":"Gökkuşağı Atışları","steps":["Aranızda 5 büyük adım olsun","Her atış YÜKSEK bir yay çizsin — ikinizin de başının üstünden!","Düz atış sayılmaz. 5 temiz yaydan sonra bir adım geri!"],"win":"Her seviyede 5 gökkuşağı atışıyla 3 mesafe seviyesini geç!","safety":"Güç değil, yumuşak yükseklik — bırak yerçekimi işini yapsın.","tip":"Gerçek bir gökkuşağı düşün — yukarı, üzerinden ve rakete doğru aşağı!"},"8":{"title":"İniş Pisti","steps":["Atan kişi topu yumuşak ve yüksek bir yayla göndersin","Yakalayan raketi DÜZ ve SABİT tutsun — pist gibi","Top kendi kendine YAPIŞMALI — raketi savurmak yok!"],"win":"8 kusursuz iniş yap!","safety":"Topa vurma — cırt cırtın işini yapmasına izin ver.","tip":"Hiçbir şey yapmadan kazandığın tek görev!"},"9":{"title":"Geri Adım Meydan Okuması","steps":["1 büyük adım arayla başlayın, 3 temiz yakalama yapın","Yarım adım geri gidin — tekrarlayın","Aranızda 3 büyük adım olana kadar devam edin!"],"win":"En uzak mesafede 3 temiz yakalamayla zirveye ulaş!","safety":"Atışlar kontrolden çıkmaya başlarsa durun.","tip":"Sadece yumuşak yaylar — burada kazandıran şey güç değil."},"10":{"title":"Güç Adımı","steps":["Aranızda 6 büyük adım olsun","Atarken ÖNE bir adım at — gerçek bir sporcu gibi!","Yakala, sonra başlangıç yerine geri adım at. Sıra arkadaşında!"],"win":"Kişi başı 10 temiz adımlı atış!","safety":"Yumuşak at — adım zaten kendi gücünü ekler.","tip":"Profesyonel atıcılar da gücü böyle aktarır!"},"11":{"title":"Gökyüzü Süzülüşü","steps":["Topu olabildiğince yüksek ve YAVAŞ at","Yakalayan sabırla beklesin — acele yok!","Topun rakete doğru süzülmesini bekle"],"win":"10 sabırlı gökyüzü yakalaması!","safety":"Yavaş ve sabırlı olan kazanır — raketi savurma.","tip":"Hareketli bir günün ardından sakinleşmek için harika!"},"12":{"title":"Kalp Hizası","steps":["Aranızda 6 büyük adım olsun","Her atış yakalayanın GÖĞÜS HİZASINA gelsin","Yakalayan raketi göğüs hizasında hedef gibi tutsun. Çok yukarı veya aşağı = kaçtı!"],"win":"Arka arkaya 10 göğüs hizası yakalaması!","safety":"Kişiye değil, rakete nişan al.","tip":"Raketin olduğu yerde bir hedef tahtası hayal et — oraya nişan al!"},"13":{"title":"Sessiz Mod","steps":["Tam sessizlik — HİÇ konuşmak yok","Her yakalamadan sonra sayıyı parmaklarınla göster","Biri konuşursa 1’den yeniden başlayın!"],"win":"Tam sessizlikte 12 yakalamaya ulaş!","safety":"Her atıştan önce bir nefes al.","tip":"Şaşırtıcı derecede zor — ve bir o kadar eğlenceli!"},"14":{"title":"Tempo Ustası","steps":["5 tane çok yavaş atış","5 tane orta hızlı atış","Bir tur daha tekrarla. Ayaklar YERDEN KIPIRDAMASIN!"],"win":"20 atışın tamamını düşürmeden bitir!","safety":"Ayaklar sabit — sadece kollar hareket etsin.","tip":"Bir şarkıda vites değiştirir gibi — önce yavaş, sonra hızlan!"},"15":{"title":"Gözler Hedefte","steps":["Yakalamadan önce “GÖRDÜM!” diye seslen","Arkadaşın seni duyduktan sonra atsın","Yakala, tekrar “GÖRDÜM!” de ve geri at"],"win":"15 odaklı yakalamaya ulaş!","safety":"Mesafeyi aynı tutun — sürpriz yapmayın.","tip":"Yüksek sesle söylemek gözlerinin önce hedefe kilitlenmesine yardımcı olur!"},"16":{"title":"1 — 2 — 3 — BAŞLA!","steps":["Atan kişi yüksek sesle 1 — 2 — 3 saysın","Top tam 3’te havalansın!","Yakalayan da 1 — 2 — 3 deyip geri atsın"],"win":"Tam zamanında 10 yakalama!","safety":"Sakin say, ritmi sabit tut.","tip":"Sporcular buna “tempo” der — profesyonel becerisi açıldı!"},"17":{"title":"Ayna Modu","steps":["Atan kişi raketi bir pozisyonda tutsun (yukarıda, aşağıda, eğik)","Yakalayan AYNI pozisyonu birebir kopyalasın","Ayna tamamlanınca atış yapılsın! Her 5 atışta rol değiştirin"],"win":"8 ayna-ve-yakala turu tamamla!","safety":"Rahat pozisyonlar seçin — zorlayıcı esnemeler yok.","tip":"Komik pozisyonlar dene — arkadaşını şaşırt!"},"18":{"title":"10’a Kadar Say","steps":["Her temiz yakalamayı BİRLİKTE yüksek sesle sayın","Top düşerse 1’den yeniden başlayın","Baskı yok — tekrar deneyin!"],"win":"Topu düşürmeden 10 yakalamaya ulaş!","safety":"Burası stressiz bölge — yeniden başlamak oyunun bir parçası.","tip":"Minikler için harika ilk görev — özgüven kazandırır!"},"19":{"title":"Sırayla Pas","steps":["Herkes bir raketle daire şeklinde dursun","Topu İSTEDİĞİN kişiye at — ama üst üste iki kez aynı kişiye değil!","Tüm atışlar yumuşak olsun"],"win":"2 dakika boyunca oynayın — düşenleri sayın ve rekorunuzu geçin!","safety":"Aranızda yeterli mesafe olsun — sıkışmayın.","tip":"4 raket + 4 oyuncu = tam parti modu!"},"20":{"title":"Yengeç Yürüyüşü Bayrak Yarışı","steps":["Karşılıklı iki sıra olun","Topu sıranın sonuna doğru aktarın — yakala ve pas ver","Sıran bitince yengeç yürüyüşüyle sıranın arkasına geç!"],"win":"İki sıra birlikte toplam 20 pasa ulaşsın!","safety":"Sadece yürü veya yengeç yürüyüşü yap — koşmak yok.","tip":"Yavaş ve komik — kısa atışlar oyunu güvenli tutar!"},"21":{"title":"Kaptan Diyor ki","steps":["3 atış için bir kaptan seçin","Kaptan bir takım arkadaşının adını söyleyip topu ona atsın","O kişi yakalasın! Her 3 atışta kaptanı değiştirin"],"win":"İsmi söylenerek yapılan 12 temiz yakalama!","safety":"Dostça seslenin — kandırmaca yok!","tip":"Herkesin kaptan olmasına sıra gelsin!"},"22":{"title":"Dönen Takım","steps":["4 oyuncu kare şeklinde dursun, herkesin raketi olsun","Bir oyuncu topu istediği kişiye atsın","HERKES her yakalamadan sonra saat yönünde bir adım ilerlesin — sonra yeniden atın!"],"win":"Takım tam dönüşler yaparken 20 yakalamaya ulaş!","safety":"Sakin dönün — çarpışmak yok!","tip":"Takımı hareket halinde tutmak için her yakalamada “DÖN!” diye bağırın!"},"23":{"title":"Eş Değiştir","steps":["İkişerli eşleşin — birlikte 6 yakalama yapın","6’dan sonra yeni bir eşle değişin!","Herkes herkesle oynayana kadar tekrarlayın"],"win":"En çok temiz eş-değişim turunu yapan kazanır!","safety":"Eş değiştirirken sakin olun — itmek yok.","tip":"4 raket + 4 oyuncuyla mükemmel!"},"24":{"title":"2v2 Takım Sayacı","steps":["2 kişilik 2 takıma ayrılın","Bir takım 5 temiz yakalama yapsın, sonra sıra diğer takımda","Hepsini TEK ortak toplamda birleştirin!"],"win":"Toplam 40 takım yakalamasına ulaşın!","safety":"Her temiz yakalamayı birlikte kutlayın — bu BİZİM skorumuz.","tip":"4 raketin TAMAMINI aynı anda kullanır!"},"25":{"title":"Sakin Yakala","steps":["İki oyuncu da otursun — yere veya sandalyeye","Sadece kısa ve yumuşak atışlar","Oturduğun yerden yakala — ayağa fırlamak yok!"],"win":"Oturarak 15 temiz yakalama!","safety":"Ayağa kalkmak yok — sakin ve kontrollü oyun.","tip":"Yağmurlu günlerin favorisi — yorulanlar için de harika!"},"26":{"title":"Mini Alan","steps":["Aranızda sadece 1 büyük adım olsun","Yumuşak at — öne adım atmak yok!","Ayaklar tüm oyun boyunca SABİT"],"win":"Mini alanda 12 temiz yakalama!","safety":"Lambalara ve raflara dikkat edin.","tip":"Adım yok kuralı = her yakalama gerçek bir başarı."},"27":{"title":"Gizli İşaret","steps":["Birlikte gizli bir el işareti seçin","Atan kişi önce işareti göstersin, sonra atsın","Yakalayan da işareti yapıp geri atsın. İşaret yoksa atış da yok!"],"win":"10 gizli işaret yakalaması!","safety":"İşaretleri basit tutun — kolayca görülsün.","tip":"Ailenize özel bir gizli işaret uydurun!"},"28":{"title":"Zihin Okuyucu","steps":["Atan kişi içinden SOL, SAĞ veya ORTA seçsin","3 saniye bekle — ipucu vermek yok!","Yakalayan atıştan ÖNCE tahmin edip raketi o yöne yerleştirsin!"],"win":"12 tahminden 8’ini doğru bil!","safety":"Mesafe sabit, atış yumuşak olsun — sürpriz sadece yönde.","tip":"Profesyonel ipucu: Atanın omuzlarını izle — genelde yönü ele verir!"},"29":{"title":"Ayaklar Sabit","steps":["İki oyuncunun da ayakları yere yapışmış gibi dursun","Sadece yumuşak atışlar","Yakala ve geri gönder — topun peşinden koşmak yok!"],"win":"20 temiz yakalama!","safety":"Atışlar kontrolden çıkarsa birlikte yavaşlayın.","tip":"En güvenli ev içi görevlerden biri — HER alanda oynanabilir."},"30":{"title":"Sol mu Sağ mı?","steps":["Atan kişi atmadan önce SOL veya SAĞ diye seslensin","Yakalayan raketi o tarafa çevirip yakalasın!","Yanlış taraf = kaçtı. Her 5 atışta seslenen kişi değişsin"],"win":"Doğru tarafta 8 yakalama yap!","safety":"Atışlar düz ve yumuşak olsun — bulmaca sadece yön.","tip":"Sadece raket + kulaklar + refleksler!"},"31":{"title":"Bulut Avcısı","steps":["Aranızda 6 büyük adım olsun","Topu gökyüzüne olabildiğince YÜKSEK at!","Aşağı inerken gözünü hiç ayırma — raketle yakala!"],"win":"10 gökyüzü yakalaması!","safety":"Her zaman YUKARI at — birbirinize doğru değil.","tip":"Açık gökyüzünde topu takip etmek daha kolay — dışarı için harika başlangıç!"},"32":{"title":"Ana Üs","steps":["Her oyuncu bir ana üs seçsin (gölge, kaldırım karesi, çim alan)","Üssünden at ve yakala — ayaklar hareket etmesin!","Üsten çıkarsan o atış sayılmaz"],"win":"Üsten çıkmadan 10 yakalama!","safety":"Üs için güvenli ve düz bir zemin seçin.","tip":"Gerçek meydan okuma için üsleri 8–10 büyük adım arayla kurun!"},"33":{"title":"Ne Kadar Uzağa Atabilirsin?","steps":["Aranızda 6 büyük adım olsun","3 temiz yakalama yapın, sonra İKİNİZ de 2 büyük adım geri gidin","Devam edin! En iyi mesafenizi aklınızda tutun!"],"win":"Önceki mesafe rekorunu geç!","safety":"Uzak mesafede büyük yaylar kullanın — düz atışlar kısa kalır.","tip":"Sadece açık alanda — büyümek için geniş yer ister!"},"34":{"title":"Topun Peşine!","steps":["Atan kişi topu önüne doğru atsın — çok uzağa değil!","Yakalayan topa doğru koşsun","Top yere düşmeden ÖNCE raketle yakala!"],"win":"Koşarak 7 yakalama yap!","safety":"Engelsiz ve açık bir koşu alanı seçin!","tip":"Yumuşak çim en iyisi — zemin düz olsun."},"35":{"title":"Zıplayarak Yakala","steps":["Atan kişi topu normal erişim yüksekliğinin HEMEN üstüne atsın — çok yüksek değil!","Atışı bekle — önceden zıplama!","Sonra ZIPLA ve havada yakala! Her 5 atışta rol değiştirin"],"win":"Zıplayarak 8 yakalama!","safety":"Düz ve yumuşak zeminde zıpla — çim en iyisi.","tip":"En iyi yükseklik normal erişimin HEMEN üstü — fazla yüksek değil!"},"36":{"title":"Maraton Serisi","steps":["Yakın başlayın — bir yakalama serisi oluşturun!","Her 5 temiz yakalamadan sonra İKİNİZ de bir büyük adım geri gidin","Seriyi ne kadar uzağa taşıyabileceğinizi görün!"],"win":"Topu düşürmeden 20 yakalamaya ulaş!","safety":"Atışlar kontrolden çıkınca geri gitmeyi bırakın.","tip":"Her oynadığınızda mesafe rekorunuzu geçmeye çalışın!"}};
  const packTR = {"all":"Tüm Paketler","Aim Master":"Tam İsabet!","Focus Control":"Zen Modu","Team Duo":"Takım Oyunu","Indoor Compact":"Evde Eğlence","Beach/Park":"Açık Hava","Reflex Rush":"Şimşek Eller"};
  const themeTR = {"Reflex Rush":["Şimşek Avı","Şimşeği kaybolmadan yakala!"],"Aim Master":["Hedef Avcısı","Her atışta tam isabeti hedefle."],"Focus Control":["Zen Bahçesi","Sakin beden, keskin dikkat, sabit el."],"Team Duo":["Kurtarma Görevi","İki kahraman, tek takım — birlikte başarın!"],"Indoor Compact":["Salon Olimpiyatları","Küçük alan, BÜYÜK şampiyon enerjisi!"],"Beach/Park":["Korsan Hazinesi","X hazineyi gösteriyor — bul bakalım!"]};
  const badgeTR = {"first":["İlk Adım","İlk görevini tamamla"],"aim":["Keskin Atıcı","Tüm Tam İsabet görevlerini bitir"],"zen":["Zen Ustası","Tüm Zen Modu görevlerini bitir"],"team":["Takım Kaptanı","Tüm Takım Oyunu görevlerini bitir"],"indoor":["Salon Kahramanı","Tüm Evde Eğlence görevlerini bitir"],"outdoor":["Açık Hava Maceracısı","Tüm Açık Hava görevlerini bitir"],"reflex":["Refleks Ustası","Tüm Şimşek Eller görevlerini bitir"],"streak3":["3 Günlük Seri","3 gün üst üste oyna"],"streak7":["7 Günlük Seri","7 gün üst üste oyna"],"champ":["JUMVI Şampiyonu","36 görevin tamamını bitir"],"zippy":["Zıpzıp Zana","Zana’nın gizli zıplamasında ustalaş"]};
  const EXACT = new Map(Object.entries({"Welcome to JUMVI Missions":"JUMVI Görevleri’ne Hoş Geldin","Ready to play?":"Oynamaya hazır mısın?","Grab your set. We’ll pick a quick first game.":"Setini hazırla. Sana kısa bir ilk oyun seçelim.","Grab your set. We'll pick a quick first game.":"Setini hazırla. Sana kısa bir ilk oyun seçelim.","Get two paddles and one ball ready":"İki raket ve bir top hazırla","2 paddles":"2 raket","1 ball":"1 top","No app · No account · No ads":"Uygulama yok · Hesap yok · Reklam yok","Choose a play level":"Oyun seviyeni seç","Just starting":"Yeni başlıyorum","Some practice":"Biraz deneyimliyim","Any challenge":"Her göreve hazırım","Start My First Mission":"İlk Görevimi Başlat","Offline — missions still work. Island needs a connection.":"Çevrimdışısın — görevler çalışmaya devam eder. Leo’nun Adası için internet gerekir.","Marked done":"Tamamlandı olarak işaretlendi","Undo":"Geri Al","Missions":"Görevler","Mission":"Görev","Play":"Oyna","Progress":"İlerleme","Adults":"Ebeveynler","Player":"Oyuncu","How to play — start the guided tour":"Nasıl oynanır — rehberli turu başlat","Switch player or settings":"Oyuncu değiştir veya ayarları aç","Add to Home Screen":"Ana Ekrana Ekle","Use JUMVI like an app — no download needed.":"JUMVI’yi uygulama gibi kullan — indirme gerekmez.","Share → Add to Home Screen":"Paylaş → Ana Ekrana Ekle","Install":"Ekle","Close add to home screen":"Ana ekrana ekleme bildirimini kapat","Pick a mission, learn the rules, then focus on the ball—not the screen.":"Bir görev seç, kuralları öğren; sonra ekrana değil topa odaklan.","Continue where you left off:":"Kaldığın yerden devam et:","Resume":"Devam Et","PICKED FOR YOU":"SENİN İÇİN SEÇİLDİ","Start this mission":"Bu görevi başlat","Start Mission":"Görevi Başlat","Choose another mission":"Başka bir görev seç","Choose another":"Başka görev seç","Today's Mission":"Bugünün Görevi","Coach Leo's pick":"Koç Leo’nun seçimi","Try something new!":"Yeni bir şey dene!","Today's Goal":"Bugünün Hedefi","Play 1 mission → earn the Daily Champion star":"1 görev oyna → Günün Şampiyonu yıldızını kazan","Today's goal":"Bugünün hedefi","Explore Leo's Island, an optional 3D adventure":"Leo’nun Adası’nı keşfet, isteğe bağlı 3D macera","Explore Leo’s Island":"Leo’nun Adası’nı Keşfet","Explore Leo's Island":"Leo’nun Adası’nı Keşfet","Bonus 3D adventure · optional":"Bonus 3D macera · isteğe bağlı","All Missions":"Tüm Görevler","36 games in 6 skill packs. Tap any mission to see how to play.":"6 beceri paketinde 36 oyun. Nasıl oynandığını görmek için bir göreve dokun.","Pick a random mission":"Rastgele görev seç","Pick one for me":"Benim için bir tane seç","Your Progress":"İlerlemen","Family Stats":"Aile İstatistikleri","Family streak: 0 days":"Aile serisi: 0 gün","Your stats will appear here":"İstatistiklerin burada görünecek","Finish your first game and your progress will show up here.":"İlk oyununu bitir; ilerlemen burada görünmeye başlasın.","Pick a Mission":"Görev Seç","This Week's Progress":"Bu Haftaki İlerleme","Keep playing to see your child's skills grow!":"Çocuğunun becerilerindeki gelişimi görmek için oynamaya devam edin!","Share progress with family":"İlerlemeyi aileyle paylaş","Copy":"Kopyala","Your Badges":"Rozetlerin","badges":"rozetler","Swipe to see all badges →":"Tüm rozetleri görmek için kaydır →","Mission Champion Certificate":"Görev Şampiyonu Sertifikası","Complete all missions to unlock.":"Kilidi açmak için tüm görevleri tamamla.","Locked":"Kilitli","Share your score":"Skorunu paylaş","/ 36 missions":"/ 36 görev","Share with family!":"Aileyle paylaş!","Copy Link":"Bağlantıyı Kopyala","Where to Play":"Nerede Oynanır","For Grown-ups":"Ebeveynler İçin","Players, settings, product care, privacy, and support.":"Oyuncular, ayarlar, ürün bakımı, gizlilik ve destek.","0 missions complete":"0 görev tamamlandı","Players & Settings":"Oyuncular ve Ayarlar","View Progress":"İlerlemeyi Gör","Dashboard, badges & certificate":"Özet, rozetler ve sertifika","Mission Book PDF":"Görev Kitabı PDF","Printable list for parents":"Ebeveynler için yazdırılabilir liste","Privacy & Safety":"Gizlilik ve Güvenlik","No account, ads, or personal data":"Hesap, reklam veya kişisel veri yok","Product Care & Quick Help":"Ürün Bakımı ve Hızlı Yardım","Keeping your set working":"Setini iyi durumda tut","The ball is hard to remove":"Topu çıkarmak zor","Peel it from one edge instead of pulling straight up. A grown-up can show younger players the first time.":"Topu dümdüz çekmek yerine bir kenarından sıyırarak çıkarın. Küçük oyunculara ilk seferde bir yetişkin gösterebilir.","The paddle is not gripping well":"Raket iyi tutmuyor","Brush away grass, sand, and lint with a dry hand or soft brush.":"Çim, kum ve tüyleri kuru elle veya yumuşak bir fırçayla temizleyin.","Can I wash it?":"Yıkayabilir miyim?","Spot-clean with a damp cloth and air-dry. Don’t machine wash or soak the set.":"Nemli bir bezle bölgesel olarak temizleyin ve açık havada kurutun. Makinede yıkamayın, seti suya bastırmayın.","Is it pool-safe?":"Havuzda kullanılabilir mi?","Use it for dry play. Water on the ball stops it from sticking.":"Kuru oyun için kullanın. Top ıslandığında yapışma performansı düşer.","Lost the QR card?":"QR kartı kayboldu mu?","Bookmark qr.jumvi.co. Progress stays in this browser on this device.":"qr.jumvi.co adresini yer imlerine ekleyin. İlerleme bu cihazdaki bu tarayıcıda kalır.","Reset Progress":"İlerlemeyi Sıfırla","Press and hold to clear this device":"Bu cihazdaki ilerlemeyi silmek için basılı tut","No account":"Hesap yok","No ads":"Reklam yok","Progress stays here":"İlerleme bu cihazda kalır","Questions or missing parts?":"Sorunuz mu var veya parça mı eksik?","Extras":"Ekstralar","Mission Book":"Görev Kitabı","Printable mission list for parents.":"Ebeveynler için yazdırılabilir görev listesi.","Share":"Paylaş","Share progress":"İlerlemeyi paylaş","Progress is saved on this device.":"İlerleme bu cihazda kaydedilir.","Adult supervision required.":"Yetişkin gözetimi gerekir.","Support:":"Destek:","Toggle kids mode":"Çocuk modunu aç/kapat","Kids Mode":"Çocuk Modu","Close mission":"Görevi kapat","Read it together.":"Birlikte okuyun.","When play starts, eyes on the ball—not the screen.":"Oyun başlayınca gözler ekranda değil, topta olsun.","Lightning Strike":"Şimşek Avı","Catch the lightning!":"Şimşeği yakala!","Hide story":"Hikâyeyi gizle","More tips & safety":"Daha fazla ipucu ve güvenlik","General safe play tips":"Genel güvenli oyun ipuçları","Throw below face level · keep 1–3 m distance · adult supervision required.":"Yüz hizasının altında atın · 1–3 m mesafe bırakın · yetişkin gözetimi sağlayın.","Something not working?":"Bir şey yolunda gitmiyor mu?","The ball gets stuck":"Top fazla yapışıyor","The ball is hard to pull off":"Topu çıkarmak zor","The strap feels uncomfortable":"Kayış rahatsız ediyor","We need more space":"Daha fazla alana ihtiyacımız var","The instructions are unclear":"Yönergeler anlaşılmıyor","This mission is too hard":"Bu görev çok zor","Start timer":"Süreyi başlat","Start":"Başlat","Track catches":"Yakalamaları say","Mark mission done":"Görevi tamamlandı olarak işaretle","Mark as Done":"Tamamlandı","Next mission":"Sonraki görev","Next Mission":"Sonraki Görev","Hold \"Mark as Done\" to finish.":"Bitirmek için “Tamamlandı” düğmesine basılı tut.","Badges":"Rozetler","Unlock badges by completing missions.":"Görevleri tamamlayarak rozetlerin kilidini aç.","Close badges":"Rozetleri kapat","Badges update automatically on this phone.":"Rozetler bu telefonda otomatik güncellenir.","Fresh ways to play all year.":"Yıl boyunca oynayabileceğiniz yeni oyun yolları.","Close seasonal packs":"Sezonluk paketleri kapat","Tap a mission to open it.":"Açmak için bir göreve dokun.","Privacy and Safety":"Gizlilik ve Güvenlik","Made for kids — built for parents' peace of mind.":"Çocuklar için yapıldı — ebeveynlerin içi rahat etsin diye tasarlandı.","No sign-up, no account.":"Kayıt yok, hesap yok.","No login, no password, no email required. Just open and play.":"Giriş, şifre veya e-posta gerekmez. Aç ve oyna.","Child names stay on this device.":"Çocuk adları bu cihazda kalır.","If you choose to add a child name or avatar, it is stored only in this browser on this device. It is not uploaded to JUMVI. We do not ask for an email address, phone number, photos, or location.":"Bir çocuk adı veya avatar eklemeyi seçerseniz bu bilgi yalnızca bu cihazdaki tarayıcıda saklanır. JUMVI'ye yüklenmez. E-posta adresi, telefon numarası, fotoğraf veya konum istemeyiz.","Everything stays on your device.":"Her şey cihazınızda kalır.","Mission progress and badges are saved only in this browser, on this device. They are never uploaded to a server, and the optional certificate name you type is used only to draw the image on your device — it is not sent anywhere.":"Görev ilerlemesi ve rozetler yalnızca bu cihazdaki bu tarayıcıda saklanır. Sunucuya yüklenmez. Sertifika için isteğe bağlı yazdığınız ad yalnızca cihazınızda görseli oluşturmak için kullanılır; hiçbir yere gönderilmez.","No ads. No third-party trackers. No data selling — ever.":"Reklam yok. Üçüncü taraf takipçisi yok. Veri satışı asla yok.","Anonymous play analytics.":"Anonim oyun analitiği.","No microphone, ever.":"Mikrofon asla kullanılmaz.","JUMVI never asks for microphone access and never records audio. The only sound JUMVI produces is optional read-aloud text, generated by your device's own built-in voice (the browser's text-to-speech) — it plays out loud but is never captured, saved, or sent anywhere.":"JUMVI mikrofon erişimi istemez ve ses kaydetmez. İsteğe bağlı sesli okuma, cihazınızın yerleşik metinden sese özelliğiyle üretilir; ses yalnızca çalınır, kaydedilmez veya gönderilmez.","COPPA & children's privacy.":"COPPA ve çocukların gizliliği.","This app is designed to align with the U.S. Children's Online Privacy Protection Act (COPPA). We do not knowingly collect personal information from children under 13. If you believe we have, contact us and we will address it promptly.":"Bu uygulama ABD Çocukların Çevrimiçi Gizliliğini Koruma Yasası (COPPA) ile uyumlu olacak şekilde tasarlanmıştır. 13 yaşın altındaki çocuklardan bilerek kişisel bilgi toplamayız. Böyle bir durum olduğunu düşünüyorsanız bizimle iletişime geçin.","Play safely.":"Güvenli oynayın.","These missions involve real, active paddle play. Please provide adult supervision and play in a safe, open space clear of obstacles.":"Bu görevler gerçek ve hareketli raket oyunları içerir. Yetişkin gözetimi sağlayın ve engellerden uzak, güvenli ve açık bir alanda oynayın.","JUMVI is a product of SAY23 LLC. Questions or requests:":"JUMVI, SAY23 LLC ürünüdür. Sorular ve talepler:","Effective August 2026 · qr.jumvi.co":"Yürürlük: Ağustos 2026 · qr.jumvi.co","Certificate":"Sertifika","Champion Certificate":"Şampiyon Sertifikası","Close certificate":"Sertifikayı kapat","Type child’s name (optional)":"Çocuğun adını yaz (isteğe bağlı)","Child’s name":"Çocuğun adı","Certificate preview":"Sertifika önizlemesi","Save certificate as image":"Sertifikayı görsel olarak kaydet","Save to Photos":"Fotoğraflara Kaydet","Share certificate":"Sertifikayı paylaş","Share with family":"Aileyle Paylaş","Save as PDF":"PDF olarak kaydet","Or save as PDF":"Veya PDF olarak kaydet","Choose player":"Oyuncu seç","Choose Player":"Oyuncu Seç","Each child has their own progress, streak & badges.":"Her çocuğun ilerlemesi, serisi ve rozetleri ayrıdır.","Close player picker":"Oyuncu seçimini kapat","Edit profile":"Profili Düzenle","Child's name":"Çocuğun adı","Cancel":"İptal","Save":"Kaydet","Delete this profile":"Bu profili sil","Add a new child":"Yeni çocuk ekle","Child's name (e.g. Ali)":"Çocuğun adı (örn. Ali)","+ Add Child":"+ Çocuk Ekle","Settings":"Ayarlar","Theme":"Tema","System":"Sistem","Sound":"Ses","On":"Açık","Off":"Kapalı","Read missions aloud":"Görevleri sesli oku","Skip":"Geç","Next →":"Sonraki →","Badge Unlocked!":"Yeni Rozet Açıldı!","Awesome!":"Harika!","Get ready!":"Hazır ol!","Main navigation":"Ana gezinme","Leo's Island":"Leo’nun Adası","Toggle sound":"Sesi aç/kapat","Tap and hold the image → Save Image":"Görsele basılı tut → Görseli Kaydet","Open image":"Görseli aç","Open Image":"Görseli Aç","Close save overlay":"Kaydetme penceresini kapat","Certificate image":"Sertifika görseli","Image generation failed":"Görsel oluşturulamadı","Image couldn’t be created":"Görsel oluşturulamadı","Got it":"Anladım","JUMVI Adventure Hub":"JUMVI Macera Merkezi","All Packs":"Tüm Paketler","Bullseye!":"Tam İsabet!","Zen Mode":"Zen Modu","Team Up":"Takım Oyunu","Indoor Fun":"Evde Eğlence","Outdoor":"Açık Hava","Lightning Hands":"Şimşek Eller","Easy":"Kolay","Medium":"Orta","Hard":"Zor","Players":"Oyuncu","Time":"Süre","Difficulty":"Zorluk","Ages":"Yaş","STEPS":"ADIMLAR","HOW TO WIN":"NASIL KAZANILIR","Win":"Hedef","Safety":"Güvenlik","Parent Tip":"Ebeveyn İpucu","Kids Challenge":"Çocuk Görevi","I Did It!":"Başardım!","We Finished!":"Bitirdik!","Try an easier version":"Daha kolay sürümü dene","Mark as Not Done":"Tamamlanmadı olarak işaretle","Play Again":"Tekrar Oyna","Pause":"Duraklat","Reset":"Sıfırla","Time's Up!":"Süre Doldu!","Timer reset.":"Süre sıfırlandı.","Best":"En İyi","NEW RECORD":"YENİ REKOR","Done":"Tamamlandı","Open":"Aç","Unlocked!":"Açıldı!","Earned":"Kazanıldı","Close":"Kapat","Back":"Geri","Next":"Sonraki","BONUS 3D ADVENTURE":"BONUS 3D MACERA","Welcome to Leo’s Island!":"Leo’nun Adası’na Hoş Geldin!","Welcome to Leo's Island!":"Leo’nun Adası’na Hoş Geldin!","Tap the ground":"Yere dokun","Leo walks there!":"Leo oraya yürür!","Reach a glowing gate":"Parlayan bir kapıya ulaş","to get a mission":"ve bir görev aç","Grab your paddles":"Raketlerini al","and play for real!":"ve gerçek oyuna başla!","Cloud paths open as you finish each zone.":"Her bölgeyi bitirdikçe bulut yolları açılır.","Let’s go!":"Haydi!","Let's go!":"Haydi!","Great job! Now find a glowing gate":"Harika! Şimdi parlayan bir kapı bul","Target Range":"Hedef Alanı","Zen Garden":"Zen Bahçesi","Playground":"Oyun Alanı","Backyard":"Arka Bahçe","Beach":"Sahil","Energy Zone":"Enerji Bölgesi","Adventure Hub":"Macera Merkezi","Turn sound on":"Sesi aç","Turn sound off":"Sesi kapat","Tap the ground to walk":"Yürümek için yere dokun","Tap the path to walk":"Yürümek için yola dokun","Back to missions":"Görevlere dön","← Missions":"← Görevler","Walk to the next mission":"Sonraki göreve yürü","GO TO NEXT MISSION":"SONRAKİ GÖREVE GİT","Zone Complete!":"Bölge Tamamlandı!","Every star found!":"Tüm yıldızlar bulundu!","CHAMPION!":"ŞAMPİYON!","Jump":"Zıpla","First Steps":"İlk Adım","Sharp Shooter":"Keskin Atıcı","Zen Master":"Zen Ustası","Team Captain":"Takım Kaptanı","Living Room Hero":"Salon Kahramanı","Outdoor Adventurer":"Açık Hava Maceracısı","Reflex Pro":"Refleks Ustası","3-Day Streak":"3 Günlük Seri","Week Warrior":"7 Günlük Seri","JUMVI Champion":"JUMVI Şampiyonu","Zippy Zana":"Zıpzıp Zana","Bullseye Hunter":"Hedef Avcısı","Rescue Mission":"Kurtarma Görevi","Living Room Olympics":"Salon Olimpiyatları","Pirate Treasure":"Korsan Hazinesi","Catch the lightning before it disappears!":"Şimşeği kaybolmadan yakala!","Every throw aims for the perfect spot.":"Her atışta tam isabeti hedefle.","Calm body, sharp mind, steady hand.":"Sakin beden, keskin dikkat, sabit el.","Two heroes, one team — work together!":"İki kahraman, tek takım — birlikte başarın!","Small space, BIG champion energy!":"Küçük alan, BÜYÜK şampiyon enerjisi!","X marks the spot — find the treasure!":"X hazineyi gösteriyor — bul bakalım!","Start your streak!":"Serini başlat!","Streak Freeze used! Your streak is safe.":"Seri Koruması kullanıldı! Serin güvende.","Coach Leo misses you! Play today to keep your streak going!":"Koç Leo seni özledi! Serini sürdürmek için bugün oyna!","Complete all 36 missions to unlock.":"Kilidi açmak için 36 görevin tamamını bitir.","Top skipped missions:":"En çok geçilen görevler:","Read aloud":"Sesli oku","Stop reading":"Okumayı durdur","Playing… Tap to stop":"Okunuyor… Durdurmak için dokun","Read mission aloud":"Görevi sesli oku","Start Caller":"Sesli Yönlendiriciyi Başlat","Start Red Light Green Light caller":"Kırmızı Işık Yeşil Işık yönlendiricisini başlat","Progress is saved on this device automatically.":"İlerlemen bu cihaza otomatik kaydedilir.","Today":"Bugün","Profile":"Profil","Hi! I'm Coach Leo. Ready for a quick tour?":"Merhaba! Ben Koç Leo. Kısa bir tura hazır mısın?","Let's go":"Haydi","These are your missions — 36 games in 6 packs!":"İşte görevlerin — 6 pakette 36 oyun!","Finish missions to earn cool badges!":"Harika rozetler kazanmak için görevleri tamamla!","Complete a pack, get your certificate here!":"Bir paketi tamamla, sertifikanı buradan al!","There's a 3D world too — see you inside!":"Bir de 3D dünya var — içeride görüşürüz!","Start playing":"Oynamaya Başla","Skip tour":"Turu Geç","Coach Leo tour":"Koç Leo turu","Replay Coach Leo tour":"Koç Leo turunu tekrar oynat","GREEN LIGHT":"YEŞİL IŞIK","RED LIGHT":"KIRMIZI IŞIK","Play!":"Oyna!","FREEZE!":"DON!","Green light!":"Yeşil ışık!","Red light! Freeze!":"Kırmızı ışık! Don!","Time's up!":"Süre doldu!","Great freezing!":"Harika dondun!","Time is up! Great freezing!":"Süre doldu! Harika dondun!","Red Light Green Light caller":"Kırmızı Işık Yeşil Işık yönlendiricisi","Get ready…":"Hazır ol…","Green = throw & catch · Red = FREEZE (even mid-throw!)":"Yeşil = at ve yakala · Kırmızı = DON (top havadayken bile!)","Phone calls the lights":"Işıkları telefon söyler","Random Green/Red with voice + screen — tap Start, then play!":"Ses ve ekranla rastgele Yeşil/Kırmızı — Başlat’a dokun, sonra oyna!","Throw below face level · Stand 1–3 m apart · Adult nearby":"Yüz hizasının altında at · 1–3 m mesafe bırak · Yakında bir yetişkin olsun","Grown-ups":"Ebeveynler","See all badges":"Tüm rozetleri gör","Help & Support":"Yardım ve Destek","Guided tour, answers, and contact":"Rehberli tur, cevaplar ve iletişim","Get unstuck quickly.":"Hızlıca yardım al.","Coach Leo guided tour":"Koç Leo rehberli turu","Replay the basics whenever you need them.":"İhtiyaç duydukça temel bilgileri tekrar izle.","Replay guided tour":"Rehberli turu tekrar oynat","Email JUMVI support":"JUMVI destek e-postası gönder","Island needs a connection.":"Leo’nun Adası için internet gerekir.","Your missions are still ready to play offline.":"Görevlerin çevrimdışı oynamaya hazır.","Help and Support":"Yardım ve Destek","Play now":"Şimdi oyna","Explore":"Keşfet","You need":"Gerekenler","What to do":"Nasıl oynanır","You win when":"Şu olunca kazanırsın","Up next":"Sıradaki","Kids & settings":"Çocuklar ve ayarlar","Progress & play":"İlerleme ve oyun","Care & trust":"Bakım ve güven","Need a hand?":"Yardım ister misin?"}));
  const ITEM_TR = {"target board":"hedef tahtası","flag":"bayrak","golden target":"altın hedef","bamboo":"bambu","stone lantern":"taş fener","lotus pond":"nilüfer göleti","golden lantern":"altın fener","bench":"bank","slide":"kaydırak","champion flag":"şampiyon bayrağı","fence":"çit","flower bed":"çiçeklik","swing":"salıncak","mailbox":"posta kutusu","flower crown":"çiçek tacı","palm tree":"palmiye","beach umbrella":"plaj şemsiyesi","sandcastle":"kumdan kale","seashell":"deniz kabuğu","golden sun":"altın güneş","power pole":"enerji direği","lightning bolt":"şimşek","energy orb":"enerji küresi"};

  /* ── Gaps closed by the QA pass on the live repo (2026-08-13) ──────────────
   * Kept as a separate readable block rather than folded into the generated
   * EXACT literal above, so a reviewer can see what the audit added.
   *
   * Two sources the generated table did not reach:
   *   1. jumvi-hub-app.js HUB_TEXTS — the 3D Hub owns its own string table,
   *      so none of it is in data.js. These reach the DOM (and the canvas
   *      sign labels), which means EXACT is the right place to fix them; the
   *      English hub file itself stays untouched.
   *   2. index.html aria-labels — invisible on screen but read out loud by a
   *      screen reader, which is exactly the user who cannot compensate.
   *
   * Strings carrying an apostrophe are listed in both the typographic and the
   * straight form, matching what the generated table already does: the source
   * files are inconsistent and a near-miss silently falls through to English. */
  const EXACT_EXTRA = {
    /* Leo's one job, named on the card he already powered. */
    "LEO’S PICK": "LEO SEÇTİ",
    "LEO'S PICK": "LEO SEÇTİ",
    /* Faz 2F — the two help reasons that had a tip and a schema slot but no
     * way to be picked. Added to the in-mission panel, so /tr needs them too. */
    "We don’t have enough space": "Yeterli alanımız yok",
    "We don't have enough space": "Yeterli alanımız yok",
    "The steps aren’t clear": "Adımlar net değil",
    "The steps aren't clear": "Adımlar net değil",
    "Clear breakables, stand closer, and use soft underhand tosses below face level.": "Kırılabilecek eşyaları kaldırın, birbirinize yaklaşın ve yüz hizasının altından yumuşak alttan atışlar yapın.",
    "Tap the speaker icon to hear the steps read aloud, or open “More tips & safety”.": "Adımları sesli dinlemek için hoparlör simgesine dokunun veya “Daha fazla ipucu ve güvenlik” bölümünü açın.",
    /* First-mission gear. The welcome overlay answers "what do we pick up
     * now?", not "what is in the box" — so it names 2 paddles + 1 ball and the
     * ×4 inventory lives on the Quick Play and product-care copy instead. The
     * old ×4 keys are gone with the markup that carried them. */
    "For your first game: two paddles and one soft ball": "İlk oyunun için: iki paddle ve bir yumuşak top",
    "2 paddles": "2 paddle",
    "1 soft ball": "1 yumuşak top",
    "That’s all you need to start.": "Başlamak için bu kadarı yeterli.",
    "That's all you need to start.": "Başlamak için bu kadarı yeterli.",
    /* "Play Modes" / the "Modes" nav tab are now called Quick Play, and the
     * entry point moved from the bottom bar onto the Play screen. The panel id,
     * the data-tab value and every analytics name still say "modes" — only the
     * words a family reads changed, so only these keys did. */
    "Quick Play": "Hızlı Oyun",
    "Replayable games when you just want to start fast.":
      "Hemen başlamak istediğinde tekrar tekrar oynanan oyunlar.",

    /* Picked-for-You card once its mission is finished: the primary action
     * leads to the next mission and replay drops to secondary. The mission NAME
     * inside "Next: …" is already Turkish (localizeData rewrites the mission
     * table), so only the prefix needs a rule — see translateCore below. */
    "Mission complete": "Görev tamamlandı",
    "Adults": "Aile",
    "Solo, 2-player, and group games": "Tek kişilik, 2 kişilik ve grup oyunları",
    "Quick games for your full 4-paddle set. Repeat them anytime—they don’t change Mission progress.":
      "4 paddle’lı tam setin için kısa oyunlar. İstediğin zaman tekrarla; Görev ilerlemesini değiştirmez.",
    "How many are playing?": "Kaç kişi oynuyor?",
    "Just me": "Tek başıma",
    "2 players": "2 oyuncu",
    "3–4 players": "3–4 oyuncu",
    "Straps go on hands only · Clear the play area · Soft, underhand tosses · Never aim at faces":
      "Kayışlar yalnız elde · Oyun alanını boşalt · Yumuşak, alttan atış yap · Asla yüze nişan alma",
    "REPEAT ANYTIME": "İSTEDİĞİN ZAMAN TEKRARLA",
    "REPEAT ANYTIME · NOT A MISSION": "İSTEDİĞİN ZAMAN TEKRARLA · GÖREV DEĞİL",
    "Play Mode": "Oyun Modu",
    "Close play mode": "Oyun modunu kapat",
    "How to play": "Nasıl oynanır",
    "Your challenge": "Hedefin",
    "Hear how to play": "Nasıl oynandığını dinle",
    "Leo gives short reminders while you play.": "Leo oynarken kısa hatırlatmalar yapar.",
    "Choose another": "Başka bir tane seç",
    "Steps": "Adımlar",
    "Hear the steps read aloud": "Adımları sesli dinle",
    "Tap Leo to hear the steps!": "Adımları dinlemek için Leo’ya dokun!",
    "We finished this mission": "Bu görevi bitirdik",
    "Skip & Play": "Atla ve Oyna",
    "Skip narration and start timer": "Anlatımı atla ve süreyi başlat",
    "Pause timer": "Süreyi duraklat",
    "Resume timer": "Süreyi sürdür",
    "Countdown in progress": "Geri sayım sürüyor",
    "Cancel countdown": "Geri sayımı iptal et",
    "Tap to cancel": "İptal etmek için dokun",

    // Parent-facing Quick Help. The mode data carries its own Turkish copy.
    "Need quick help?": "Hızlı yardım mı lazım?",
    "The ball won’t stick": "Top yapışmıyor",
    "The ball won't stick": "Top yapışmıyor",
    "The ball is hard to remove": "Topu çıkarmak zor",
    "The strap doesn’t feel right": "Kayış rahat değil",
    "The strap doesn't feel right": "Kayış rahat değil",
    "My child is missing most catches": "Çocuğum çoğu topu yakalayamıyor",
    "More product help": "Daha fazla ürün yardımı",
    "How should the hand strap fit?": "El kayışı nasıl ayarlanmalı?",
    "Back of a JUMVI paddle showing the hand strap": "El kayışını gösteren JUMVI paddle arka yüzü",
    "Can we play indoors?": "Evde oynayabilir miyiz?",
    "How do I clean and store the set?": "Seti nasıl temizleyip saklamalıyım?",
    "Something is damaged or missing": "Bir parça hasarlı veya eksik",
    "Use the blue catching face. Remove visible lint, grass, or sand with a soft, dry brush; let every piece dry fully; then move closer and aim a soft toss at the center.":
      "Mavi yakalama yüzünü kullanın. Görünen tüy, çim veya kumu yumuşak ve kuru bir fırçayla temizleyin; her parçanın tamamen kurumasını bekleyin; sonra yaklaşarak merkeze yumuşak bir atış yapın.",
    "Peel it slowly from one edge instead of pulling straight up. Younger players may need a grown-up’s help. Don’t yank the ball or twist the paddle.":
      "Topu dümdüz çekmek yerine bir kenarından yavaşça sıyırın. Küçük oyuncular bir yetişkinden yardım isteyebilir. Topu sertçe çekmeyin ve paddle’ı bükmeyin.",
    "Loosen it first, slide your hand under the strap, then make it snug—not tight. It is a hand strap only; never attach it to furniture, a tree, a wall, or a person.":
      "Önce kayışı gevşetin, elinizi altına geçirin ve rahat ama sıkmayacak şekilde ayarlayın. Bu yalnızca el kayışıdır; mobilyaya, ağaca, duvara veya bir kişiye asla bağlamayın.",
    "Move to 3–4 ft apart and use slow, underhand tosses toward the center. Get one easy catch, then take one small step back.":
      "Yaklaşık 1 metre arayla durun ve merkeze doğru yavaş, alttan atışlar yapın. Önce kolay bir yakalama yapın, sonra küçük bir adım geri çıkın.",
    "Yes. Clear breakables, start close, and toss gently below face level. Move outdoors before adding speed or distance.":
      "Evet. Kırılabilir eşyaları kaldırın, yakın başlayın ve yüz hizasının altında yumuşakça atın. Hız veya mesafe eklemeden önce dışarı çıkın.",
    "Use a soft, dry brush for dirt and lint. Wipe non-catching surfaces lightly, air-dry everything fully, then store all 4 paddles and 4 balls in the carry bag. Don’t machine wash or soak the set.":
      "Kir ve tüy için yumuşak, kuru bir fırça kullanın. Yakalama dışındaki yüzeyleri hafifçe silin, her şeyi tamamen kurutun; ardından 4 paddle ve 4 topu taşıma çantasına koyun. Makinede yıkamayın veya suya bastırmayın.",
    "Stop using any torn or cracked piece. Ask a grown-up to email support@jumvi.co with the order number and a photo.":
      "Yırtılmış veya çatlamış parçayı kullanmayı bırakın. Bir yetişkin sipariş numarası ve fotoğrafla support@jumvi.co adresine e-posta göndersin.",
    // 3D Hub — HUB_TEXTS
    "Sound on/off": "Ses aç/kapat",
    "complete!": "tamamlandı!",
    "START!": "BAŞLA!",
    "Time's up — did you do it?": "Süre doldu — başardın mı?",
    "Time’s up — did you do it?": "Süre doldu — başardın mı?",
    "Done — tap to undo": "Bitti — geri almak için dokun",
    "surprise": "sürpriz",
    "How to play": "Nasıl oynanır",
    "Tap the ground — Leo walks there!": "Yere dokun — Leo oraya yürüsün!",
    "Reach a glowing gate to open a mission": "Görev açmak için parlayan kapıya ulaş",
    "Finish missions to grow each zone!": "Her bölgeyi büyütmek için görevleri bitir!",
    "Got it!": "Anladım!",
    "Get your Champion Certificate!": "Şampiyon Sertifikanı al!",
    "Island photo": "Ada fotoğrafı",
    "Island zones": "Ada bölgeleri",
    "Menu": "Menü",
    "Close menu": "Menüyü kapat",
    "Browse Missions": "Görevlere Göz At",
    "Welcome to my island! Tap the ground and I'll walk there!":
      "Adama hoş geldin! Yere dokun, oraya yürüyeyim!",
    "Welcome to my island! Tap the ground and I’ll walk there!":
      "Adama hoş geldin! Yere dokun, oraya yürüyeyim!",

    // Coach Leo spoken lines (app.js coachSpeak)
    "Time's up! Great job!": "Süre doldu! Harikaydın!",
    "Time’s up! Great job!": "Süre doldu! Harikaydın!",

    /* Progress and Adults tabs. These sit inside closed tab panels, so they
     * are computed-invisible until the panel is opened — which is why the
     * generated table missed them and why the QA scan has to open every tab.
     *
     * The filter chips below are safe to translate: renderFilterGroups()
     * binds each button's handler over the internal option value ("Solo",
     * "Easy", "all"), never over its textContent, so the label and the
     * filter key are independent. */
    "All": "Tümü",
    "Solo": "Tek",
    "Easy": "Kolay",
    "Medium": "Orta",
    "Hard": "Zor",
    "TODAY": "BUGÜN",
    "NEXT": "SIRADAKİ",
    "Your catches": "Yakalayışların",
    "Tap on every catch": "Her yakalayışta dokun",
    "Playing with": "Kaç kişi oynuyor",
    "↺ Reset": "↺ Sıfırla",
    "day streak": "günlük seri",
    "min total play": "dk toplam oyun",
    "Start your first mission!": "İlk görevine başla!",
    "Pick a mission, read the steps, and go play.":
      "Bir görev seç, adımları oku ve oynamaya git.",
    "Play 1 mission today → earn the Daily Champion star":
      "Bugün 1 görev oyna → Günün Şampiyonu yıldızını kazan",
    "This week supported steady focus and coordination.":
      "Bu hafta istikrarlı odaklanma ve koordinasyonu destekledi.",

    /* Footer. Split across two text nodes around a <b>SAY23 LLC</b>, so each
     * half is translated separately and the company name is left alone:
     *   "JUMVI, " + "SAY23 LLC" + " ürünüdür. Soru veya istekler: " */
    "JUMVI is a product of": "JUMVI,",
    ". Questions or requests:": " ürünüdür. Soru veya istekler:",
    "© 2026 SAY23 LLC · JUMVI® and Coach Leo are trademarks of SAY23 LLC. All mission content is protected by copyright.":
      "© 2026 SAY23 LLC · JUMVI® ve Coach Leo, SAY23 LLC şirketinin tescilli markalarıdır. Tüm görev içeriği telif hakkıyla korunmaktadır.",

    /* Privacy & Safety modal. The English copy said "five simple, anonymous
     * events" while the Worker allowlist carries twenty-one, so both languages
     * now describe the categories instead of a count — a number goes stale the
     * next time an event is added, and a stale privacy claim is worse than a
     * vague one. Deliberately does NOT claim events cannot be correlated
     * within a session; docs/drafts/privacy-policy-update.md records that
     * claim being removed on review as too strong. */
    "We measure a short, fixed list of anonymous events to see which missions work and where kids get stuck: the app being opened, missions started and completed, which help topic a parent opened, the player count, pack and badge milestones, whether an optional feature was used at all (certificate, sharing, read-aloud, the timer, the score tracker, the dashboard, the mission book), progress through the 3D Hub, and a few fixed return-visit milestones. Every event is just an event name plus, at most, one small value — a mission number, a pack or badge name, a player count, or a fixed option such as which help topic or which share button. Anything not on that list is discarded without being stored. We never attach a name, account, email address, the certificate name you type, a profile name, an IP address, a device ID, or any other identifier to this data. This is measured using our own infrastructure, not a third-party analytics service.":
      "Hangi görevlerin işe yaradığını ve çocukların nerede takıldığını görmek için kısa ve sabit bir anonim olay listesi ölçüyoruz: uygulamanın açılması, başlatılan ve tamamlanan görevler, ebeveynin hangi yardım konusunu açtığı, oyuncu sayısı, paket ve rozet kilometre taşları, isteğe bağlı bir özelliğin hiç kullanılıp kullanılmadığı (sertifika, paylaşım, sesli okuma, kronometre, skor takibi, panel, görev kitabı), 3D Hub içindeki ilerleme ve birkaç sabit tekrar ziyaret kilometre taşı. Her olay yalnızca bir olay adından ve en fazla bir küçük değerden oluşur — bir görev numarası, bir paket veya rozet adı, bir oyuncu sayısı ya da hangi yardım konusu veya hangi paylaşım düğmesi gibi sabit bir seçenek. Bu listede olmayan hiçbir şey saklanmadan atılır. Bu veriye asla isim, hesap, e-posta adresi, yazdığınız sertifika adı, profil adı, IP adresi, cihaz kimliği ya da başka bir tanımlayıcı eklemeyiz. Ölçüm üçüncü taraf bir analitik hizmetiyle değil kendi altyapımızla yapılır.",

    /* Product-care safety line, added with Play Modes. It is split across two
     * text nodes around the support mailto, so each half is keyed separately —
     * and the surrounding whitespace is re-added by translateText, so neither
     * value carries its own leading space. Of everything on /tr this is the
     * one line that must not stay English: it tells a parent to stop using a
     * torn or cracked piece. */
    "Stop using any torn or cracked piece. Ask a grown-up to email":
      "Yırtık veya çatlak hiçbir parçayı kullanmayın. Bir yetişkin, sipariş numarası ve bir fotoğrafla",
    "with the order number and a photo.":
      "adresine e-posta göndersin.",


    /* ── Görev ekranındaki üretilen güvenlik ve çocuk ipucu metinleri ────────
     * app.js'teki getSafetyText() ve getKidsTip() her görev için sabit bir
     * İngilizce havuzdan cümle seçer; bu cümleler mission tablosunun parçası
     * olmadığı için localizeData() onlara hiç dokunmuyordu. Sonuç: /tr'de 36
     * görevin 36'sında Güvenlik satırı İngilizce başlıyordu — bir çocuk
     * ürününde ebeveynin okuması gereken tek cümle. residual-english.mjs bunu
     * kaçırdı çünkü görev detay ekranını hiç açmıyor.
     *
     * Anahtarlar app.js'ten birebir kopyalandı (tipografik tırnak ve
     * kesme işaretleri dahil); İngilizce kaynak değiştirilmedi. */
    "Throw softly below face level. Stay 1–3 m apart. Adult supervision required.":
      "Topu yüz hizasının altında, yumuşakça atın. Aranızda 1–3 metre olsun. Bir yetişkin mutlaka yanınızda olsun.",
    "Adult supervision required. Keep throws gentle and below face level. Stay 1–3 m apart.":
      "Bir yetişkin mutlaka yanınızda olsun. Atışları yumuşak ve yüz hizasının altında tutun. Aranızda 1–3 metre olsun.",
    "Soft tosses only. Keep 1–3 m distance and aim below face level. Play with an adult nearby.":
      "Sadece yumuşak atışlar. Aranızda 1–3 metre bırakın ve yüz hizasının altına nişan alın. Yanınızda bir yetişkin olsun.",
    "Stay 1–3 m apart. Throw gently and below face level. An adult should be nearby.":
      "Aranızda 1–3 metre olsun. Yumuşakça ve yüz hizasının altında atın. Yakınınızda bir yetişkin bulunsun.",
    "Keep it gentle: soft throws, below face level, 1–3 m apart, adult supervision.":
      "Nazik olun: yumuşak atışlar, yüz hizasının altında, 1–3 metre arayla, yetişkin gözetiminde.",
    "Focus on control: soft throws below face level, 1–3 m apart, adult nearby.":
      "Kontrole odaklanın: yüz hizasının altında yumuşak atışlar, 1–3 metre arayla, yakında bir yetişkin.",
    "Quick does not mean hard: gentle throws below face level, 1–3 m apart, adult supervision.":
      "Hızlı olmak sert olmak değildir: yüz hizasının altında yumuşak atışlar, 1–3 metre arayla, yetişkin gözetiminde.",
    "Aim first, then throw soft: below face level, 1–3 m apart, adult nearby.":
      "Önce nişan alın, sonra yumuşakça atın: yüz hizasının altında, 1–3 metre arayla, yakında bir yetişkin.",
    "Keep targets close: 1–3 m apart, soft throws below face level, adult supervision.":
      "Hedefleri yakın tutun: 1–3 metre arayla, yüz hizasının altında yumuşak atışlar, yetişkin gözetiminde.",
    "Slow and steady: soft throws below face level, 1–3 m apart, adult nearby.":
      "Yavaş ve sakin: yüz hizasının altında yumuşak atışlar, 1–3 metre arayla, yakında bir yetişkin.",
    "Stay calm and safe: gentle throws below face level, 1–3 m apart, adult supervision.":
      "Sakin ve güvende kalın: yüz hizasının altında yumuşak atışlar, 1–3 metre arayla, yetişkin gözetiminde.",
    "Give each player space: 1–3 m apart, soft throws below face level, adult supervision.":
      "Herkese yer açın: 1–3 metre arayla, yüz hizasının altında yumuşak atışlar, yetişkin gözetiminde.",
    "Team safety: gentle throws, below face level, 1–3 m apart, adult nearby.":
      "Takım güvenliği: yumuşak atışlar, yüz hizasının altında, 1–3 metre arayla, yakında bir yetişkin.",
    "Indoor safe play: soft throws below face level, 1–3 m apart, adult supervision. Clear area from breakables.":
      "Evde güvenli oyun: yüz hizasının altında yumuşak atışlar, 1–3 metre arayla, yetişkin gözetiminde. Kırılabilecek eşyaları ortadan kaldırın.",
    "Small space rules: gentle throws below face level, 1–3 m apart, adult nearby. Clear area from breakables.":
      "Dar alan kuralları: yüz hizasının altında yumuşak atışlar, 1–3 metre arayla, yakında bir yetişkin. Kırılabilecek eşyaları ortadan kaldırın.",

    "Try a small step back only after 3 clean catches.":
      "Arka arkaya 3 temiz yakalama yaptıktan sonra bir adım geri git.",
    "Keep your elbows close to your body.":
      "Dirseklerini vücuduna yakın tut.",
    "Watch the ball all the way into your hands.":
      "Topu eline girene kadar gözünle takip et.",
    "Point your belly button at the target.":
      "Göbeğini hedefe doğru çevir.",
    "Use two hands to aim, then one to throw.":
      "Nişan alırken iki elini, atarken tek elini kullan.",
    "Say “target” out loud before you throw.":
      "Atmadan önce yüksek sesle “hedef” de.",
    "Breathe slowly and count in your head.":
      "Yavaşça nefes al ve içinden say.",
    "Freeze your feet like statues before each throw.":
      "Her atıştan önce ayaklarını heykel gibi sabitle.",
    "Use a quiet voice to stay calm.":
      "Sakin kalmak için sesini alçalt.",
    "Call your partner’s name before you throw.":
      "Atmadan önce arkadaşının adını söyle.",
    "Take turns and cheer for each other.":
      "Sırayla oynayın ve birbirinizi alkışlayın.",
    "If someone drops, give a friendly high‑five.":
      "Biri topu düşürürse dostça bir çak yapın.",
    "Use short, easy throws in small spaces.":
      "Dar alanlarda kısa ve kolay atışlar yap.",
    "Stand on a small floor mark to stay steady.":
      "Dengede kalmak için yere koyduğun küçük bir işaretin üzerinde dur.",
    "Keep throws low and slow indoors.":
      "Evde atışlarını alçak ve yavaş tut.",
    "Watch the ball and use two hands if needed.":
      "Topu gözünle takip et, gerekirse iki elini kullan.",

    // index.html aria-labels / alt text
    "missions": "görevler",
    "progress": "ilerleme",
    "streak": "seri",
    "JUMVI logo": "JUMVI logosu",
    "Add one to score": "Skora bir ekle",
    "Close privacy and safety": "Gizlilik ve güvenliği kapat",
    "How many players": "Kaç oyuncu",
    "Reset progress": "İlerlemeyi sıfırla",
  };
  Object.entries(EXACT_EXTRA).forEach(([k, v]) => EXACT.set(k, v));

  /* getSafetyText() in app.js does not always hand the DOM one of its pool
   * sentences on its own — when a mission carries its own extra safety line it
   * returns "<generated base> <mission-specific extra>". The extra half is
   * already Turkish (localizeData rewrote the mission table), so the composite
   * string matches no EXACT key and the whole line fell through to English.
   * These are the same entries added above, indexed for prefix matching, so
   * both shapes resolve from one list. Longest first: two of the sentences end
   * in a second clause and must not be shadowed by a shorter prefix. */
  const SAFETY_BASES = [...EXACT.entries()]
    .filter(([k]) => /\b1[–-]3 m\b/.test(k))
    .sort((a, b) => b[0].length - a[0].length);

  function localizeData() {
    try {
      if (typeof PACKS !== 'undefined') {
        PACKS.forEach(p => { if (packTR[p.key]) p.name = packTR[p.key]; });
      }
      if (typeof PACK_THEMES !== 'undefined') {
        Object.entries(themeTR).forEach(([k, v]) => {
          if (PACK_THEMES[k]) {
            PACK_THEMES[k].name = v[0];
            PACK_THEMES[k].tagline = v[1];
          }
        });
      }
      if (typeof missions !== 'undefined') {
        missions.forEach(m => {
          const tr = missionTR[m.id];
          if (tr) Object.assign(m, tr);
        });
      }
      if (typeof BADGES !== 'undefined') {
        BADGES.forEach(b => {
          const tr = badgeTR[b.id];
          if (tr) { b.name = tr[0]; b.req = tr[1]; }
        });
      }
    } catch (e) {
      console.warn('[JUMVI TR] data localization failed', e);
    }
  }

  function normalized(s) {
    return String(s || '').replace(/\s+/g, ' ').trim();
  }

  function translateCore(input) {
    if (input == null) return input;
    const raw = String(input);
    const norm = normalized(raw);
    if (!norm) return raw;
    if (EXACT.has(norm)) return EXACT.get(norm);

    // Composed safety line — see SAFETY_BASES above. Gated on a cheap test so
    // the loop never runs for the thousands of unrelated text nodes the
    // MutationObserver walks.
    if (/\b1[–-]3 m\b/.test(norm)) {
      for (const [en, tr] of SAFETY_BASES) {
        if (norm.startsWith(en + " ")) return tr + norm.slice(en.length);
      }
    }

    let m;
    if ((m = norm.match(/^(\d+) \/ (\d+) missions$/i))) return `${m[1]} / ${m[2]} görev`;
    if ((m = norm.match(/^(\d+) \/ (\d+) completed$/i))) return `${m[1]} / ${m[2]} tamamlandı`;
    if ((m = norm.match(/^(\d+) of 36 missions complete$/i))) return `${m[1]} / 36 görev tamamlandı`;
    if ((m = norm.match(/^(\d+) of (\d+) missions complete$/i))) return `${m[1]} / ${m[2]} görev tamamlandı`;
    if ((m = norm.match(/^(\d+) missions? complete$/i))) return `${m[1]} görev tamamlandı`;
    if ((m = norm.match(/^(\d+) missions? to go!$/i))) return `${m[1]} görev kaldı!`;
    if ((m = norm.match(/^(\d+) missions? to go$/i))) return `${m[1]} görev kaldı`;
    if ((m = norm.match(/^(\d+)\/([\d]+) complete!?$/i))) return `${m[1]}/${m[2]} tamamlandı${norm.endsWith('!') ? '!' : ''}`;
    if ((m = norm.match(/^Pack (\d+) of (\d+) · (\d+)\/(\d+)$/i))) return `Paket ${m[1]}/${m[2]} · ${m[3]}/${m[4]}`;
    // The welcome band line no longer names a match count; keep the old
    // pattern so a cached English shell still translates, and add the new one.
    if ((m = norm.match(/^(\d+) matched missions · all 36 always available$/i))) return `${m[1]} eşleşen görev · 36 görevin tamamı her zaman açık`;
    if (/^36 games included · we'll start with an easy one$/i.test(norm)) return '36 oyun dahil · kolay bir tanesiyle başlayacağız';
    if (/^36 games included · we’ll start with an easy one$/i.test(norm)) return '36 oyun dahil · kolay bir tanesiyle başlayacağız';
    if (/^All 36 games included$/i.test(norm)) return '36 oyunun tamamı dahil';
    if ((m = norm.match(/^(\d+) day streak!$/i))) return `${m[1]} günlük seri!`;
    // The 1-2 day and 3-6 day rungs of renderStreakUI had no pattern here, so a
    // Turkish family read "2 days" in English. Invisible until the streak moved
    // onto the home screen for households without a Team; now it is the first
    // number they see.
    if ((m = norm.match(/^(\d+) day streak$/i))) return `${m[1]} günlük seri`;
    if ((m = norm.match(/^(\d+) days$/i))) return `${m[1]} gün`;
    if ((m = norm.match(/^(\d+) day$/i))) return `${m[1]} gün`;
    if ((m = norm.match(/^(\d+) days? on fire!$/i))) return `${m[1]} gündür harikasın!`;
    if ((m = norm.match(/^(\d+) day legend!$/i))) return `${m[1]} günlük efsane!`;
    if ((m = norm.match(/^Family streak: (\d+) days?$/i))) return `Aile serisi: ${m[1]} gün`;
    if ((m = norm.match(/^Mission (\d+) of (\d+)$/i))) return `Görev ${m[1]}/${m[2]}`;
    // Picked-for-You "next mission" CTA. The captured half is a mission title,
    // which localizeData() has already replaced with its Turkish name, so it is
    // passed straight through rather than looked up a second time.
    if ((m = norm.match(/^Next:\s*(.+)$/))) return `Sıradaki: ${m[1]}`;
    // Coach Leo's guided tour counter (leo-tour.js) — same shape as the line
    // above, different noun, and it was reaching the screen in English.
    if ((m = norm.match(/^Step (\d+) of (\d+)$/i))) return `Adım ${m[1]}/${m[2]}`;
    if ((m = norm.match(/^Time'?[’']?s up! You got (\d+)!$/i))) return `Süre doldu! ${m[1]} yaptın!`;
    if ((m = norm.match(/^Ages? (.+)$/i))) return `${m[1]} yaş`;
    if ((m = norm.match(/^New: (.+)!$/i))) return `Yeni: ${ITEM_TR[m[1]] || translateCore(m[1])}!`;
    if ((m = norm.match(/^You did ALL (\d+) missions!$/i))) return `${m[1]} görevin TAMAMINI bitirdin!`;
    if ((m = norm.match(/^(\d+)s — Go play!$/i))) return `${m[1]} sn — Haydi oyna!`;
    if ((m = norm.match(/^(.+) · (\d+)\/(\d+) complete!?$/i))) return `${translateCore(m[1])} · ${m[2]}/${m[3]} tamamlandı${norm.endsWith('!') ? '!' : ''}`;
    if ((m = norm.match(/^(\d+)\/1 today$/i))) return `${m[1]}/1 bugün`;
    if ((m = norm.match(/^Day (\d+)$/i))) return `${m[1]}. gün`;
    if ((m = norm.match(/^(\d+) players?$/i))) return `${m[1]} oyuncu`;

    /* Progress counters (app.js renderProgress / certificate subtitle). */
    if ((m = norm.match(/^(\d+)\/(\d+) · (\d+) to go$/i))) return `${m[1]}/${m[2]} · ${m[3]} kaldı`;
    if ((m = norm.match(/^(\d+)\/(\d+) · (\d+) days? to go$/i))) return `${m[1]}/${m[2]} · ${m[3]} gün kaldı`;
    if ((m = norm.match(/^(\d+)\/(\d+) · (\d+) more to go$/i))) return `${m[1]}/${m[2]} · ${m[3]} tane daha`;
    if ((m = norm.match(/^(\d+) \/ (\d+) done — (\d+) more to go!$/i))) return `${m[1]} / ${m[2]} tamamlandı — ${m[3]} tane daha!`;
    if ((m = norm.match(/^Best: (\d+)$/i))) return `En iyi: ${m[1]}`;
    // Certificate meta strip, drawn onto the canvas by app.js.
    // The date is locale-formatted before it gets here, so it contains spaces
    // ("13 Ağu 2026"). An \S+ here silently fails to match and the labels stay
    // English on a real certificate.
    if ((m = norm.match(/^Awarded\s+(.+?)\s*·\s*ID:\s*(\S+)$/i))) return `Veriliş: ${m[1]} · Kimlik: ${m[2]}`;
    // Mission durations come straight from data.js ("45s", "60s") and are not
    // part of the translated mission table.
    if ((m = norm.match(/^(\d+)s$/))) return `${m[1]}sn`;
    // Composite chips such as "Easy • 60s" — translate each half so the rule
    // keeps working when either side gains a new value.
    if ((m = norm.match(/^(.+?) • (.+)$/))) {
      const a = translateCore(m[1]), b = translateCore(m[2]);
      if (a !== m[1] || b !== m[2]) return `${a} • ${b}`;
    }
    if ((m = norm.match(/^(\d+) min$/i))) return `${m[1]} dk`;
    if ((m = norm.match(/^(\d+) sec$/i))) return `${m[1]} sn`;
    return raw;
  }

  function translateText(raw) {
    if (typeof raw !== 'string' || !raw.trim()) return raw;
    const lead = (raw.match(/^\s*/) || [''])[0];
    const tail = (raw.match(/\s*$/) || [''])[0];
    const core = raw.slice(lead.length, raw.length - tail.length || undefined);
    const translated = translateCore(core);
    return lead + translated + tail;
  }

  // Date strings generated by the shared app should use Turkish month/day names.
  try {
    const nativeDate = Date.prototype.toLocaleDateString;
    Date.prototype.toLocaleDateString = function (locales, options) {
      const use = (!locales || locales === 'en-US' || locales === 'en') ? 'tr-TR' : locales;
      return nativeDate.call(this, use, options);
    };
  } catch (_) {}

  // Canvas text is invisible to DOM observers. This catches 3D sign labels and
  // dynamic certificate text before they are measured/drawn.
  try {
    const P = window.CanvasRenderingContext2D && CanvasRenderingContext2D.prototype;
    if (P && !P.__jumviTrPatched) {
      const fill = P.fillText, stroke = P.strokeText, measure = P.measureText;
      P.fillText = function (text, ...args) { return fill.call(this, translateCore(String(text)), ...args); };
      P.strokeText = function (text, ...args) { return stroke.call(this, translateCore(String(text)), ...args); };
      P.measureText = function (text) { return measure.call(this, translateCore(String(text))); };
      Object.defineProperty(P, '__jumviTrPatched', { value:true });
    }
  } catch (_) {}

  // Browser dialogs created by shared JS.
  try {
    const nativeAlert = window.alert && window.alert.bind(window);
    const nativeConfirm = window.confirm && window.confirm.bind(window);
    if (nativeAlert) window.alert = msg => nativeAlert(translateCore(String(msg)));
    if (nativeConfirm) window.confirm = msg => nativeConfirm(translateCore(String(msg)));
  } catch (_) {}

  // Make read-aloud Turkish even though the shared code historically asks for en-US.
  try {
    const synth = window.speechSynthesis;
    const NativeUtterance = window.SpeechSynthesisUtterance;
    if (synth && NativeUtterance && !synth.__jumviTrPatched) {
      const nativeSpeak = synth.speak.bind(synth);
      synth.speak = function (u) {
        try {
          let text = u && u.text ? String(u.text) : '';
          text = text
            .replace(/^Mission:\s*/i, 'Görev: ')
            .replace(/\bSteps:\s*/gi, 'Adımlar: ')
            .replace(/\bStep (\d+):\s*/gi, 'Adım $1: ')
            // app.js builds the read-aloud script with an em dash, not a
            // colon (`Step 1 — …`, `How to win — …`), so the colon rules
            // above never fired on the real path and Coach Leo announced
            // Turkish steps with English labels.
            .replace(/\bStep (\d+)\s*—\s*/gi, 'Adım $1 — ')
            .replace(/\bHow to win\s*—\s*/gi, 'Nasıl kazanılır — ')
            .replace(/\bHow to win:\s*/gi, 'Nasıl kazanılır: ')
            .replace(/\bWin:\s*/gi, 'Hedef: ')
            .replace(/\bSafety:\s*/gi, 'Güvenlik: ')
            .replace(/\bTip:\s*/gi, 'İpucu: ');
          const v = new NativeUtterance(translateCore(text));
          v.lang = 'tr-TR';
          v.rate = u.rate; v.pitch = u.pitch; v.volume = u.volume;
          // Picking a named voice is best-effort and must not cost us the
          // translation. The outer catch re-speaks the ORIGINAL utterance, so
          // letting a throw from here reach it means the child hears raw
          // English. tr-TR text on the platform default voice is still
          // correct Turkish; no voice at all is the acceptable degrade.
          try {
            const voices = synth.getVoices ? synth.getVoices() : [];
            const trVoice = voices.find(x => /^tr(?:-|$)/i.test(x.lang || ''));
            if (trVoice) v.voice = trVoice;
          } catch (_) {}
          ['onstart','onend','onerror','onpause','onresume','onmark','onboundary'].forEach(k => {
            if (u && u[k]) v[k] = u[k];
          });
          return nativeSpeak(v);
        } catch (_) {
          return nativeSpeak(u);
        }
      };
      Object.defineProperty(synth, '__jumviTrPatched', { value:true });
    }
  } catch (_) {}

  function translateNode(node) {
    if (!node) return;
    if (node.nodeType === Node.TEXT_NODE) {
      const p = node.parentElement;
      if (p && /^(SCRIPT|STYLE|CODE|PRE|TEXTAREA)$/i.test(p.tagName)) return;
      const next = translateText(node.nodeValue);
      if (next !== node.nodeValue) node.nodeValue = next;
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node;
    if (/^(SCRIPT|STYLE|CODE|PRE)$/i.test(el.tagName)) return;
    for (const attr of ['aria-label','title','placeholder','alt']) {
      if (!el.hasAttribute(attr)) continue;
      const old = el.getAttribute(attr);
      const next = translateCore(old);
      if (next !== old) el.setAttribute(attr, next);
    }
    for (const child of Array.from(el.childNodes)) translateNode(child);
  }

  // Translate the parsed static shell before deferred app.js runs.
  localizeData();
  translateNode(document.documentElement);

  // Shared app creates most mission/progress UI dynamically, so observe it.
  const observer = new MutationObserver(records => {
    observer.disconnect();
    try {
      for (const rec of records) {
        if (rec.type === 'characterData') translateNode(rec.target);
        for (const n of rec.addedNodes || []) translateNode(n);
      }
    } finally {
      observer.observe(document.documentElement, { subtree:true, childList:true, characterData:true });
    }
  });
  observer.observe(document.documentElement, { subtree:true, childList:true, characterData:true });

  /* ── Turkish variants of the two baked-English binaries ────────────────────
   * A DOM locale layer cannot translate text baked into a raster or a PDF, so
   * /tr has to point at separate files. Neither exists yet (see
   * docs/audits/tr-static-assets.md for what has to be in them), and this
   * wiring is deliberately written to be inert until they land rather than to
   * ship a broken link:
   *
   *   certificate — loadImageWithFallback() walks CERT_TEMPLATE_SOURCES in
   *     order and falls through on error, so putting the Turkish path first
   *     means /tr uses it the moment the file appears and quietly keeps the
   *     English template until then.
   *   mission book — an <a href>, so it is only rewritten after a HEAD says
   *     the Turkish PDF is really there. Mirrors the data-optional-file check
   *     app.js already does for the English one.
   *
   * Runs on DOMContentLoaded because app.js is a deferred script: it has not
   * defined CERT_TEMPLATE_SOURCES yet while this file is executing. */
  document.addEventListener('DOMContentLoaded', function () {
    try {
      if (typeof CERT_TEMPLATE_SOURCES !== 'undefined' &&
          !CERT_TEMPLATE_SOURCES.includes('/tr/certificate-template.webp')) {
        CERT_TEMPLATE_SOURCES.unshift('/tr/certificate-template.webp');
      }
    } catch (_) {}

    try {
      var TR_BOOK = '/tr/mission-book.pdf';
      var books = document.querySelectorAll('a[href="mission-book.pdf"], a[href="/mission-book.pdf"]');
      if (!books.length) return;
      fetch(TR_BOOK, { method: 'HEAD', cache: 'no-store' })
        .then(function (res) {
          if (!res.ok) return;
          books.forEach(function (a) {
            a.setAttribute('href', TR_BOOK);
            if (a.hasAttribute('data-optional-file')) a.setAttribute('data-optional-file', TR_BOOK);
          });
        })
        .catch(function () { /* offline or absent: the English book stays */ });
    } catch (_) {}
  });

  // Locale-specific metadata (server-side Worker also sets these before first paint).
  document.title = 'JUMVI Görevleri — Oyna, Yakala, Devam Et';
  const setMeta = (selector, attr, value) => {
    const el = document.querySelector(selector);
    if (el) el.setAttribute(attr, value);
  };
  setMeta('meta[name="description"]', 'content', 'JUMVI Toss & Catch için 36 eğlenceli görev. İlerlemeyi takip et, rozetleri kazan ve Koç Leo’nun 3D macerasını keşfet. Kayıt, hesap ve reklam yok.');
  setMeta('meta[property="og:url"]', 'content', 'https://qr.jumvi.co/tr');
  setMeta('meta[property="og:title"]', 'content', 'JUMVI Görevleri — Çocuklar için 36 Toss & Catch Oyunu');
  setMeta('meta[property="og:description"]', 'content', '36 JUMVI görevi, ilerleme, rozetler ve Koç Leo’nun 3D macerası.');
  setMeta('meta[name="twitter:url"]', 'content', 'https://qr.jumvi.co/tr');
  setMeta('meta[name="twitter:title"]', 'content', 'JUMVI Görevleri — Çocuklar için Aktif Oyunlar');
  setMeta('meta[name="twitter:description"]', 'content', 'Kısa ve hareketli Toss & Catch görevleri. Kuralları oku, telefonu bırak ve oyna.');

  try {
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href = 'https://qr.jumvi.co/tr';

    const alternates = [
      ['en', 'https://qr.jumvi.co/'],
      ['tr', 'https://qr.jumvi.co/tr'],
      ['x-default', 'https://qr.jumvi.co/']
    ];
    alternates.forEach(([lang, href]) => {
      let l = document.querySelector(`link[rel="alternate"][hreflang="${lang}"]`);
      if (!l) {
        l = document.createElement('link');
        l.rel = 'alternate';
        l.hreflang = lang;
        document.head.appendChild(l);
      }
      l.href = href;
    });
  } catch (_) {}
})();

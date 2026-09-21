# Jumvi Missions - Proje Kuralları

## Branch güvenliği
- main branch SADECE canlı production kodudur. main'e asla doğrudan commit, push veya merge yapılmaz.
- Yeni özellik geliştirmeleri ayrı branch'lerde yapılır.
- 3D orman/mission hub özelliği (`jumvi-hub-app.js`) artık main üzerinde geliştiriliyor. `3d-forest-experiment` branch'i 2026-08-15'te silindi: main ile ilişkisiz bir git geçmişine sahipti, 5+ hafta bayattı ve içindeki `jumvi-hub-app.js` main'dekinden daha eskiydi — yani gerçek geliştirme zaten main'e taşınmıştı, o branch sadece kafa karıştıran bir kalıntıydı. **Düzeltme (2026-09-04):** silme yalnızca yerelde yapılmış; `origin/3d-forest-experiment` (head `0db4fef`, 2026-07-07) hâlâ duruyor. Kullanıcı 2026-09-05'te silinmesini onayladı, ancak silme işlemi ajan oturumunun izin katmanınca engellendiği için uzak ref hâlâ duruyor; `git push origin --delete 3d-forest-experiment` ile kapanır. Bu satır, silinmiş olduğunu söylediği sürece yanlıştı.
- main'e geçiş/merge işlemi sadece kullanıcının açık onayıyla yapılır, otomatik olmaz.

## Otomatik yayın istisnası (haftalık analiz raporu)
Yukarıdaki "açık onay" kuralının tek istisnası, proje sahibinin 20 Eylül 2026'da
açıkça talep ettiği haftalık analiz raporudur. İstisnanın sınırları dardır ve
genişletilmez:

- Yalnızca `.github/workflows/weekly-analytics-snapshot.yml`'nin **zamanlanmış**
  çalışması yayınlayabilir. Elle tetiklenen backfill asla otomatik merge edilmez —
  geçmiş veriyi yeniden yazabilen tek yol odur, onu insan inceler.
- Yalnızca `data/snapshots/` altındaki dosyalar. PR bunun dışına çıkarsa iş akışı
  merge etmez, PR'ı inceleme için açık bırakır.
- Merge'den önce analitik bekçilerinin tamamı aynı işin içinde çalışır; biri
  kırmızıysa yayın yapılmaz. (GITHUB_TOKEN ile yapılan merge main'de yeni workflow
  tetiklemediği için kontroller merge sonrasına bırakılamaz.)
- Rapor yine de her zaman bir PR olarak açılır; merge commit'i "bu hafta ne zaman
  yayınlandı"nın kaydıdır.

Gerekçe: 2026-36 ve 2026-37 raporları üretildikleri hâlde merge edilmeyi bekleyip
iki hafta boyunca panelde görünmedi. Bu istisna o boşluğu kapatmak içindir; kod,
uygulama davranışı veya şema değişiklikleri için **geçerli değildir**.

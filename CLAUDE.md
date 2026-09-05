# Jumvi Missions - Proje Kuralları

## Branch güvenliği
- main branch SADECE canlı production kodudur. main'e asla doğrudan commit, push veya merge yapılmaz.
- Yeni özellik geliştirmeleri ayrı branch'lerde yapılır.
- 3D orman/mission hub özelliği (`jumvi-hub-app.js`) artık main üzerinde geliştiriliyor. `3d-forest-experiment` branch'i 2026-08-15'te silindi: main ile ilişkisiz bir git geçmişine sahipti, 5+ hafta bayattı ve içindeki `jumvi-hub-app.js` main'dekinden daha eskiydi — yani gerçek geliştirme zaten main'e taşınmıştı, o branch sadece kafa karıştıran bir kalıntıydı. **Düzeltme (2026-09-04):** silme yalnızca yerelde yapılmış; `origin/3d-forest-experiment` (head `0db4fef`, 2026-07-07) hâlâ duruyor. Kullanıcı 2026-09-05'te silinmesini onayladı, ancak silme işlemi ajan oturumunun izin katmanınca engellendiği için uzak ref hâlâ duruyor; `git push origin --delete 3d-forest-experiment` ile kapanır. Bu satır, silinmiş olduğunu söylediği sürece yanlıştı.
- main'e geçiş/merge işlemi sadece kullanıcının açık onayıyla yapılır, otomatik olmaz.

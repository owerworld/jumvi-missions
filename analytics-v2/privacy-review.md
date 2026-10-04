# Usage measurement disclosure — REVIEW DRAFT, not published

This addendum must be reconciled with the complete JUMVI operator/contact/service-provider/privacy policy and actual hosting settings before activation. Do not present a UI parent gate as consent or identity verification. The US-only filter is not an exemption from children's privacy obligations.

## Proposed US English parent-facing summary

**How we count use of JUMVI**

To improve our play instructions, we count application opens, mission selections, starts, Help opens, stops, resumes and “I finished it” reports from connections classified as being in the United States. We keep daily totals by mission and interface language for up to 90 days in our active usage database. These counts are not linked to a player or used to measure a child's physical skill.

We do not send player names, nicknames, personal saved history, age, contact details or device identifiers to this usage database. We do not create visitor IDs, record sessions or use these counts for targeted advertising. A player and saved progress remain optional and local to this browser on this device.

Cloudflare provides hosting, security and the approximate country check. Like other hosting services, it receives connection information needed to handle requests. Its security logs and database recovery copies are separate from our daily usage totals. The full privacy notice must describe the verified processing and retention for those services. **This last sentence is an editorial activation requirement, not final customer copy.**

Offline activity is not queued for later measurement. Where the browser supplies a Do Not Track or Global Privacy Control signal, this usage collector does not count the event. We cannot use the totals to look up an individual child's activity or to verify a purchase.

## Turkish review translation

Oyun açıklamalarını geliştirmek için ABD bağlantısı olarak sınıflandırılan uygulama açılışlarını, görev seçimlerini, başlatma, yardım, durdurma, devam etme ve “tamamladım” bildirimlerini sayarız. Aktif kullanım veritabanında görev ve arayüz dili başına günlük toplamlar en fazla 90 gün tutulur. Sayılar oyuncuya bağlanmaz ve çocuğun fiziksel becerisini ölçmez.

Oyuncu adı/takma adı, kaydedilmiş kişisel geçmiş, yaş, iletişim bilgileri veya cihaz kimliği bu kullanım veritabanına gönderilmez. Ziyaretçi kimliği, oturum kaydı ve reklam profili oluşturulmaz. Oyuncu ve ilerleme kaydı isteğe bağlıdır; mevcut tarayıcı/cihazda kalır.

Cloudflare barındırma, güvenlik ve yaklaşık ülke tespiti sağlar; bağlantıyı işlemek için gereken bilgileri alır. Altyapı güvenlik kayıtları ve kurtarma kopyaları günlük toplamdan ayrıdır. Bunların doğrulanmış işleme/saklama koşulları tam politikada belirtilmeden bu taslak yayımlanmaz.

Çevrimdışı olaylar sonradan gönderilmek üzere biriktirilmez. Tarayıcının DNT/GPC sinyalleri geldiğinde bu sayaç olayı saymaz. Toplamlardan bir çocuğun geçmişi veya satın alma durumu çıkarılamaz.

## R8 closure record (open)

- Data taxonomy/purpose: concrete candidate above; owner review pending.
- Retention: active daily aggregates 90 days proposed; provider recovery/edge/Access retention to verify.
- Local personal data boundary: unchanged; technical negative tests pass locally.
- Notice: draft only; no complete production privacy notice was newly published in this task.
- Admin access: allowlisted owner email not yet supplied; real Access policy not created.
- US filtering: worker logic tested with synthetic platform metadata; real deployed US request verification pending.
- Collection/deployment: disabled / not deployed. No existing dataset or secret used.

Source: locked `outputs/JUMVI_LOCK09_IMPLEMENTATION_CANDIDATE.md`, section 13 and R8; [FTC COPPA rule](https://www.ftc.gov/legal-library/browse/rules/childrens-online-privacy-protection-rule-coppa). Do not mark R8 closed because this draft exists.

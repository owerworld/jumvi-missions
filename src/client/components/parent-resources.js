import {el} from './dom.js';
// Adult-only resources. No player data is placed in URLs or sent to support.
export function parentResources(locale){
 const tr=locale==='tr',section=el('section',undefined,'parent-resources');
 const box=(title,body)=>{const card=el('div',undefined,'parent-resource');card.append(el('h2',title),el('p',body));section.append(card);return card;};
 const book=box(tr?'Yazdırılabilir görev kitabı':'Printable mission book',tr?'36 görev, hareket görselleri ve kâğıttan ilerleme çizelgesi. Yeni kitaplar İngilizce, 44 sayfa. İlk indirme için internet gerekir; oyun açılırken otomatik indirilmez.':'All 36 missions, illustrated moves, and a paper play tracker. English · 44 pages. These books download only when you open them, so they won’t slow down your first game.');
 const pdfLink=(label,file)=>{const link=el('a',label);link.href=new URL(`../../assets/parents/${file}`,import.meta.url);link.target='_blank';link.rel='noopener';link.type='application/pdf';return link;};
 book.append(pdfLink(tr?'Evde baskı PDF’sini aç · 25,9 MB':'Open home-print PDF · 25.9 MB','mission-book-home-print-en-US-v2.pdf'));
 book.append(el('p',tr?'US Letter kâğıt, Gerçek boyut / %100. Kitabın tamamını veya yalnız oynayacağınız görevin sayfasını yazdırın. Çift taraflı baskıda uzun kenardan çevirin.':'Use US Letter paper at Actual Size / 100%. Print the whole book or just your next mission page. For two-sided printing, flip on the long edge.'));
 const print=el('details');print.append(el('summary',tr?'Matbaa için baskı dosyası':'For professional printing'),el('p',tr?'İngilizce · 44 sayfa · 26,0 MB. US Letter kesim boyutu ve 3,175 mm taşma payı içerir. Ev yazıcısı için yukarıdaki sürümü seçin.':'English · 44 pages · 26.0 MB. US Letter trim size with 0.125-inch bleed. For a home printer, use the version above.'),pdfLink(tr?'Matbaa PDF’sini aç':'Open print-master PDF','mission-book-print-master-en-US-v2.pdf'));book.append(print);
 if(tr){const translation=el('details');translation.append(el('summary','Türkçe inceleme kopyası'),el('p','Önceki Türkçe görev özeti. Yeni 44 sayfalık kitabın birebir çevirisi değildir.'),pdfLink('Türkçe PDF’yi aç','mission-book-tr-v1.pdf'));book.append(translation);}
 book.append(el('p',tr?'PDF’de işaretledikleriniz uygulamaya aktarılmaz. Dijital sertifika için aynı oyuncunun bu tarayıcıda 36 farklı görevi tamamladığını kaydetmesi gerekir. Ekran okuyucuyla görevleri uygulamadan takip edebilirsiniz.':'Marks in the paper book don’t update the app. To unlock the digital certificate, save all 36 different missions as finished for the same player in this browser. For screen-reader access, use the guided missions in the app.','muted'));
 const care=box(tr?'Bakım ve saklama':'Care & storage',tr?'Kısa bakım ipuçları; ayrıntıyı görmek için bir başlık açın.':'A few simple tips. Open a topic for details.');
 const topics=tr?[
 ['Top iyi yapışmıyorsa','Mavi ön yüzü ve topu kontrol edin. Tüy, çim veya kumu yumuşak, kuru bir fırçayla alın. Yüzeyleri tamamen kuru tutun.'],
 ['Topu ayırmak ve kayışı takmak','Topu kenarından yavaşça ayırın; çekiştirmeyin veya bükmeyin. Gerekirse bir yetişkin yardım etsin. El kayışı rahat ve sıkmadan oturmalı. Kayışı eşyalara veya başka bir kişiye bağlamayın.'],
 ['Temizlemek ve saklamak','Tozu ve tüyleri kuru, yumuşak bir fırçayla alın. Topun yapıştığı yüzeyin dışındaki kısımları hafif nemli bezle silebilirsiniz. Tamamen kuruttuktan sonra çantasında saklayın.'],
 ['Hasarlı veya eksik parça','Yırtık veya çatlak parçayla oynamayın. Bir yetişkin destek ekibine ulaşabilir.']
 ]:[
 ['If the ball isn’t sticking','Check the blue front and the ball. Gently brush off lint, grass or sand with a soft, dry brush. Keep both surfaces fully dry.'],
 ['Removing the ball & fitting the strap','Peel the ball away slowly from the edge. Don’t yank or twist it; ask a grown-up for help if needed. The hand strap should fit snugly without squeezing. Never attach it to objects or another person.'],
 ['Cleaning & storing','Use a soft, dry brush to remove dirt and lint. Lightly wipe surfaces other than the catching face with a damp cloth. Let everything air-dry fully before putting it in the carry bag.'],
 ['Damaged or missing pieces','Stop using torn or cracked pieces. A grown-up can contact support for help.']
 ];
 for(const [title,body] of topics){const details=el('details');details.append(el('summary',title),el('p',body));care.append(details);}
 const support=box(tr?'Desteğe ulaşın':'Need a hand?',tr?'Ürün veya eksik parça için bir yetişkin bize e-posta gönderebilir. Oyuncu takma adını ve kişisel geçmişini paylaşmanız gerekmez.':'A grown-up can email us about the product or missing pieces. You don’t need to share player nicknames or personal history.');
 const email=el('a','support@jumvi.co');email.href='mailto:support@jumvi.co';support.append(email);return section;
}

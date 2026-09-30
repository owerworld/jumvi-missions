import {el} from './dom.js';
// Adult-only resources. No player data is placed in URLs or sent to support.
export function parentResources(locale){
 const tr=locale==='tr',section=el('section',undefined,'parent-resources');
 const box=(title,body)=>{const card=el('div',undefined,'parent-resource');card.append(el('h2',title),el('p',body));section.append(card);return card;};
 const book=box(tr?'Yazdırılabilir görev kitabı':'Printable mission book',tr?'V2’deki 36 görevin kuralları ve güvenlik yönergeleri. Ekran yerine kâğıttan takip edebilirsiniz. PDF’yi ilk kez açmak için internet bağlantısı gerekir.':'Rules and safety guidance for all 36 V2 missions, ready to print. You’ll need an internet connection the first time you open the PDF.');
 const link=el('a',tr?'Türkçe PDF’yi aç':'Open English PDF');link.href=new URL(`../../assets/parents/mission-book-${locale}-v1.pdf`,import.meta.url);link.target='_blank';link.rel='noopener';book.append(link);
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

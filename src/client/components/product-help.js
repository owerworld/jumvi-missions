import {el} from './dom.js';
// Product operation only: no automatic caller, timing, tracking or new mission rule.
export function productHelp(locale){
 const tr=locale==='tr',section=el('section',undefined,'product-help');
 section.append(el('h2',tr?'Paddle ve top yardımı':'Paddle & ball help'));
 const topics=tr?[
  ['Top yapışmıyor','Topu mavi ön yüzle karşıla. Kırmızı kayışlı taraf yakalama yüzü değildir. Paddle’la topa vurma; topun mavi yüze gelmesini bekle.'],
  ['Topu nasıl geri atarım?','Normal geri pasta paddle elinde takılı kalır. Görev el değiştirmeyi istiyorsa o görevin adımlarını izle. Boş elinle topu mavi yüzden ayır, sonra aynı boş elle yumuşakça at. Paddle topu geri sektirmez.'],
  ['Kayış rahatsız ediyor','Oyunu durdur. Elin paddle’ın kırmızı arka yüzünde, siyah kayışın altında olmalı. Rahat oturmuyorsa bir yetişkinden yardım iste; zorlayarak oynama.'],
  ['Alan uygun değil','Önce durun. Görevin istediği mesafe ve hareket için çevrenizde boş alan olmalı. Uygun alan yoksa başka bir görev seçin.'],
  ['Sırayı anlayamadık','Görevin Yardım ekranındaki adımları sırayla izleyin. Her resim ayrı bir anı gösterir. Topu yakalama, boş elle ayırma ve yeniden atma aynı anda yapılmaz.']
 ]:[
  ['The ball won’t stick','Meet the ball with the blue front. The red side with the strap is the back, not the catching surface. Let the ball come to the blue face instead of hitting it.'],
  ['How do I toss it back?','For a normal return pass, keep the paddle on your hand. If the mission calls for switching hands, follow that mission’s steps. Use your free hand to take the ball off the blue face, then make a gentle toss with that same free hand. The paddle does not bounce the ball back.'],
  ['The strap feels uncomfortable','Stop playing. Your hand goes against the red back, under the black strap. Ask a grown-up for help if it does not fit comfortably; do not force it.'],
  ['We don’t have enough space','Pause first. Check that you have clear space for this mission’s distance and movement. Choose another mission if the space is not suitable.'],
  ['We lost track of the steps','Follow the steps in the mission’s Help screen in order. Each picture shows a separate moment. Catching, taking the ball off, and tossing again happen one after another.']
 ];
 for(const [title,copy] of topics){const details=el('details');details.append(el('summary',title),el('p',copy));section.append(details);}
 return section;
}

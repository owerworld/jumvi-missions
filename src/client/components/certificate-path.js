import {el} from './dom.js';
import {button} from './button.js';
import {historySummary} from '../repository/history-summary.js';

// Optional, below the play controls. Never guess which sibling is playing.
export function certificatePath({state,personal:p,catalog,send}) {
 const tr=state.locale==='tr',box=el('aside',undefined,'certificate-path');
 box.setAttribute('aria-labelledby','certificate-path-title');
 const title=el('h2',tr?'Sertifikaya doğru':'Your play certificate');title.id='certificate-path-title';box.append(title);
 const players=p?.snapshot?.players||[],actor=players.find(x=>x.id===p?.actorId);
 if(p?.status==='ready'&&actor){
  const count=historySummary(p.snapshot.records,actor.id,catalog.missions.map(m=>m.id)),left=count.certificateTotal-count.certificateCount;
  box.append(el('p',actor.nickname||actor.label,'certificate-player'));
  const number=el('p',tr?`${count.certificateCount}/${count.certificateTotal} farklı görev tamamlandı diye kaydedildi.`:`${count.certificateCount} of ${count.certificateTotal} missions reported complete.`,'certificate-count');
  const bar=el('progress');bar.max=count.certificateTotal;bar.value=count.certificateCount;bar.setAttribute('aria-label',number.textContent);box.append(number,bar);
  box.append(el('p',count.certificateEligible?(tr?'Sertifikan hazır!':'Your certificate is ready!'):(tr?`${left} görev kaldı. Kendi hızında oyna.`:`${left} ${left===1?'mission':'missions'} to go. Play at your own pace.`),'certificate-remaining'));
  box.append(button(count.certificateEligible?(tr?'Sertifikamı gör':'View my certificate'):(tr?'İlerlememi gör':'See my progress'),()=>send(count.certificateEligible?'P_CERTIFICATE':'P_HISTORY',{id:actor.id}),{disabled:!!p.busy}));
 }else{
  box.append(el('p',tr?'36 farklı görevi tamamladığını oyuncuna kaydet, JUMVI sertifikanı aç. İlerleme tutmak isteğe bağlı.':'Save 36 different missions as finished for your player to unlock a JUMVI certificate. Keeping progress is optional.'));
  const choose=p?.status==='ready'&&players.length>0;
  box.append(button(choose?(tr?'Oyuncunu seç':'Choose your player'):(tr?'Nasıl kazanılır?':'How to earn it'),()=>{
   if(choose){const menu=document.querySelector('.profile-menu'),select=menu?.querySelector('#session-player');if(menu&&select){menu.open=true;select.focus();return;}}
   send('GO',{screen:'management'});
  },{kind:'link'}));
 }
 return box;
}

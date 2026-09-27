import {el} from './dom.js';
import {button} from './button.js';
import {historySummary} from '../repository/history-summary.js';
export function playerContext({state,personal:p,send,ui,catalog}, {progress=false}={}) {
 const tr=state.locale==='tr',box=el('section',undefined,'player-context'),players=p?.snapshot?.players||[];
 const actor=players.find(x=>x.id===p.actorId);
 if(!players.length)return box;
 const label=el('label',tr?'Bu oyunda':'Playing as'),select=el('select');select.id='session-player';label.htmlFor=select.id;
 const guest=el('option',tr?'Misafir · kayıt tutma':'Guest · don’t save progress');guest.value='';select.append(guest);
 for(const player of players){const opt=el('option',player.nickname||player.label);opt.value=player.id;select.append(opt);}select.value=actor?.id||'';select.disabled=!!p.busy;
 select.addEventListener('change',()=>send('P_SESSION',{id:select.value}));box.append(label,select);
 if(actor){box.append(el('p',tr?'Bildirimin bu oyuncuya kaydedilir. Yalnız bu tarayıcıda.':'Your report saves to this player, only in this browser.','muted'));
  if(progress){const count=historySummary(p.snapshot.records,actor.id,catalog.missions.map(m=>m.id));box.append(el('p',`${tr?'Oyun yolculuğun':'Your play journey'} · ${count.certificateCount}/36`,'journey-count'));
   if(count.certificateEligible)box.append(button(tr?'Sertifikan hazır — görüntüle':'Your certificate is ready — view it',()=>send('P_CERTIFICATE',{id:actor.id}),{kind:'primary'}));}
 }else if(progress)box.append(el('p',tr?'Tamamlanan görevleri görmek için oyuncunu seç. Misafir olarak oynamaya devam edebilirsin.':'Choose your player to see completed missions. You can keep playing as a guest.','muted'));
 return box;
}

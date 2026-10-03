import {el} from './dom.js';
import {button} from './button.js';
import {historySummary} from '../repository/history-summary.js';

// Only explicit, committed reports belong to a player's completion history.
// Browsing as a guest never silently selects a child or creates a record.
export function discoveryProgress({state,personal:p,send,catalog}) {
 const tr=state.locale==='tr',box=el('section',undefined,'discovery-progress');
 const players=p?.snapshot?.players||[],actor=players.find(x=>x.id===p.actorId);
 const title=el('h2',tr?'Tamamlanan görevler':'Completed missions');box.append(title);
 if(p?.status==='loading'){box.append(el('p',tr?'Yerel kayıtlar yükleniyor…':'Loading local progress…'));return box;}
 if(p?.status!=='ready'){box.append(el('p',tr?'Yerel kayıtlar şu an açılamıyor. Oynamaya devam edebilirsin.':'Local progress is unavailable right now. You can still play.'));return box;}
 if(players.length){
  const label=el('label',tr?'Oyuncunun ilerlemesi':'Player progress'),select=el('select');select.id='discovery-player';label.htmlFor=select.id;
  const guest=el('option',tr?'Oyuncu seç (isteğe bağlı)':'Choose a player (optional)');guest.value='';select.append(guest);
  for(const p of players){const option=el('option',p.nickname||p.label);option.value=p.id;select.append(option);}
  select.value=actor?.id||'';select.disabled=!!p.busy;select.addEventListener('change',()=>send('P_SESSION',{id:select.value}));box.append(label,select);
 }
 if(actor){
  const summary=historySummary(p.snapshot.records,actor.id,catalog.missions.map(x=>x.id));
  box.append(el('p',tr?`${summary.certificateCount}/36 tamamlandı · ${36-summary.certificateCount} görev kaldı`:`${summary.certificateCount}/36 completed · ${36-summary.certificateCount} to go`,'discovery-progress-count'));
  box.append(el('p',tr?'Bu oyuncunun bu tarayıcıya kaydedilen bildirimleri. Sonraki oyun bildirimlerin de bu oyuncuya kaydedilir.':'Reports saved for this player in this browser. Your next play reports will save to this player too.','muted'));
 }else box.append(el('p',players.length?(tr?'İşaretleri görmek için oyuncunu seç. Misafir oyunu otomatik kaydedilmez.':'Choose your player to see completion marks. Guest play isn’t saved automatically.'):(tr?'Oyun sonunda “İlerlememi tut” ile kaydet. Tamamlanan görevler burada işaretlenir. Oyuncu oluşturmadan da oynayabilirsin.':'Choose “Keep my progress” after playing to save your completed missions. They’ll be marked here. You can also play without a player.'),'muted'));
 const report=state.report,unsaved=report?.value==='complete'&&!p.snapshot.records.some(r=>r.report.id===report.id&&r.report.revision===report.revision);
 if(unsaved){
  const mission=catalog.missions.find(m=>m.id===report.missionId),notice=el('div',undefined,'discovery-unsaved');
  notice.append(el('p',`${tr?'Henüz kaydedilmedi':'Not saved yet'}: ${mission?.titles[state.locale]||report.missionId}`));
  const save=button(tr?'Bu görevi kaydet':'Save this mission',()=>send('P_TRACK'),{kind:'secondary'});save.disabled=!!p.busy;notice.append(save);box.append(notice);
 }
 return box;
}

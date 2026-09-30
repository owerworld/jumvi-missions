import {el,heading} from '../components/dom.js';
import {button} from '../components/button.js';
import {choice} from '../components/choice.js';
import {playerLabel} from '../repository/local.js';
import {historySummary} from '../repository/history-summary.js';
import {brandHeader} from '../components/brand-header.js';
export function personalView(name,{state,ui,cp,send,personal:p,catalog}){
 p ||= {snapshot:null,status:'loading',name:'',selectedId:null,result:null};
 const s=el('section');s.dataset.view=name;s.classList.add('customer-layout');s.append(brandHeader(state.locale));const row=el('div',undefined,'controls conflicting');
 const b=(label,type,detail={},disabled=false)=>{const control=button(label,()=>send(type,detail),{disabled});if(type==='START')control.dataset.needsReady='';if(['P_DELETE_ONE','P_DELETE_ALL'].includes(type))control.classList.add('danger-action');return control;};
 const go=(label,screen)=>b(label,'GO',{screen});
 const back=()=>b(ui.back,'BACK');
 const reportMission=report=>catalog?.missions.find(m=>m.id===report?.missionId)?.titles[state.locale]||(!report||report.missionId===state.mission?.id?cp.mission:report.missionId);
 const snap=p.snapshot,players=snap?.players||[],selected=players.find(x=>x.id===p.selectedId),editable=players.find(x=>x.id===p.editId);
 s.append(heading(name==='attribution'?ui.choosePlayer:name==='guest'?ui.guestTitle:ui.titles[name]));
 const status=el('p',p.message||'', 'personal-message');status.setAttribute('role','status');
 const disclosure=()=>{s.append(el('p',ui.localDisclosure));const more=el('details',undefined,'local-details');more.append(el('summary',ui.localDetails),el('p',ui.localRetention));s.append(more);};
 const form=(action,label,value)=>{
  const f=el('form'),l=el('label',ui.nickname),input=el('input'),help=el('p',ui.nicknameHelp),err=el('p');input.id='nickname';input.type='text';input.maxLength=64;input.autocomplete='off';input.spellcheck=false;input.value=value||'';l.htmlFor=input.id;help.id='nickname-help';err.id='nickname-error';err.setAttribute('role','alert');input.setAttribute('aria-describedby',help.id+' '+err.id);
  input.addEventListener('input',()=>send('P_NAME',{value:input.value}));
  const submit=()=>{if(input.value.length>64||/[\u0000-\u001f\u007f]/.test(input.value)){err.textContent=ui.nameError;input.setAttribute('aria-invalid','true');input.focus();return;}send(action);};
  f.addEventListener('submit',e=>{e.preventDefault();submit();});const save=button(label,submit,{kind:'primary',disabled:p.busy||p.status!=='ready'});f.append(l,input,help,err,save);s.append(f);
 };
 if(['guest','group','returning'].includes(name)){
  if(name==='guest'){s.append(el('p',ui.guestInfo));if(state.round||state.previous)s.append(el('p',ui.previousInfo));row.append(b(ui.guestStart,'GUEST'));if(state.previous)row.append(b(ui.previousRound,'PREVIOUS'));}
  if(name==='group'){s.append(el('p',cp.materials),el('p',ui.groupInfo),el('p',cp.setup),el('p',cp.safe));row.append(b(cp.start,'START',{},!state.mission?.ready));}
  if(name==='returning'){s.append(el('p',ui.returnInfo),el('p',cp.mission));row.append(go(cp.backMission||ui.back,'entry'),go(ui.guestTitle,'guest'),go(ui.titles.group,'group'));if(state.previous)row.append(b(ui.previousRound,'PREVIOUS'));}
  row.append(b(cp.how,'HELP'),b(cp.leave,'LEAVE'));s.append(row);return s;
 }
 if(name==='adult'){s.append(el('p',ui.adultPurpose));row.append(go(ui.continueManagement,'management'),back());s.append(row);disclosure();return s;}
 if(p.status==='loading')s.append(el('p',ui.localLoading));
 if(p.status==='unavailable'){s.append(el('p',ui.localUnavailable));row.append(b(ui.retry,'P_REFRESH'));}
 if(name==='new-player'){s.append(el('p',p.quick?(state.locale==='tr'?'Oyuncu oluşturmak isteğe bağlı. Bu görevin bildirimi oluşturduğun oyuncuya kaydedilecek.':'Creating a player is optional. This mission report will be saved to the player you create.'):ui.createInfo));disclosure();form('P_CREATE',p.quick?(state.locale==='tr'?'Oluştur ve bu görevi kaydet':'Create player and save this mission'):ui.createPlayer,p.name);row.append(go(ui.cancel,state.report?'attribution':'management'));}
 if(name==='attribution'){
  const r=p.correction?.report||state.report;
  if(!r)s.append(el('p',ui.noReport));else{
   s.append(el('p',`${reportMission(r)} · ${r.value==='complete'?ui.recordComplete:ui.recordEarly}`),el('p',p.correction?ui.correctionInfo:p.quick?(state.locale==='tr'?'Bu bildirimi kimin geçmişine kaydetmek istersin?':'Whose progress would you like to save this report to?'):ui.chooseInfo));disclosure();
   if(!players.length&&p.status==='ready')s.append(el('p',ui.noPlayers));
   if(p.quick&&!p.correction){for(const player of players)row.append(b(state.locale==='tr'?`${playerLabel(player)} için kaydet`:`Save for ${playerLabel(player)}`,'P_QUICK_SAVE',{id:player.id},p.busy||p.status!=='ready'));row.append(go(ui.newPlayer,'new-player'));}
   else {const group=el('fieldset');group.append(el('legend',ui.choosePlayer));for(const player of players)group.append(choice({group:'attribution',value:player.id,label:playerLabel(player),checked:player.id===p.selectedId,onSelect:id=>send('P_SELECT',{id})}));s.append(group);
   if(selected)s.append(el('p',playerLabel(selected),'selected-player'));
   row.append(go(ui.newPlayer,'new-player'),b(p.correction?ui.confirmCorrection:ui.saveRecord,p.correction?'P_MOVE':'P_SAVE',{},!selected||p.busy||p.status!=='ready'));}
  }
  row.append(b(ui.backReport,'REPORT_RETURN'));
 }
 if(name==='record-result'){
  const result=p.result,record=snap?.records.find(x=>x.id===result?.id),op=snap?.operations.find(x=>x.id===result?.id),target=players.find(x=>x.id===(record?.targetId||op?.targetId||result?.targetId));
  const verified=result?.status==='committed'&&record&&target;const storedReport=record?.report||op?.report||result?.report;const missionLabel=reportMission(storedReport);
  s.append(el('p',target?`${playerLabel(target)} · ${missionLabel}`:missionLabel),el('p',verified?ui.saveVerified:result?.status==='correction-required'?ui.correctionRequired:p.busy?ui.savePending:ui.saveUnverified,'status'));
  if(verified){row.append(b(ui.correctAttribution,'P_CORRECT',{id:record.id}));row.append(b(record.report.value==='complete'?ui.changeToEarly:ui.changeToComplete,'P_CHANGE_REPORT',{id:record.id,value:record.report.value==='complete'?'early':'complete'}));}
  else if(result&&result.status!=='correction-required')row.append(b(ui.retryRecord,'P_RETRY',{},p.busy));
  row.append(back(),go(ui.titles.management,'management'));
 }
 if(name==='management'){
  // The player list already shows this disclosure before opening an individual
  // history. Keep it on the list and the new-player form; avoid repeating two
  // long paragraphs above the selected player's actual progress.
  if(!editable)disclosure();if(p.legacy?.count)s.append(el('p',ui.legacyNotice));
  if(!players.length&&p.status==='ready'){s.append(el('p',ui.managementEmpty));const info=el('section',undefined,'certificate-status');info.append(el('h2',ui.certificateTitle),el('p',ui.certificateIntro));s.append(info);}
  if(editable){
   s.append(el('h2',playerLabel(editable)));
   const summary=historySummary(snap.records,editable.id,catalog?.missions.map(m=>m.id));
   s.append(el('p',ui.historySummary.replace('{distinct}',summary.distinct).replace('{completed}',summary.completed).replace('{early}',summary.early),'history-summary'),el('p',ui.historyHonesty,'muted'));
   const certificate=el('section',undefined,'certificate-status');certificate.append(el('h2',ui.certificateTitle),el('p',ui.certificateProgress.replace('{count}',summary.certificateCount).replace('{total}',summary.certificateTotal)),el('p',ui.certificateScope,'muted'));
   if(summary.certificateEligible)certificate.append(b(ui.certificatePreview,'P_CERTIFICATE'));
   s.append(certificate);
   if(!p.historyOnly){s.append(el('p',ui.nameInfo));form('P_RENAME',ui.saveName,p.name);}
   if(summary.byMission.size){const missions=el('section',undefined,'mission-progress');missions.append(el('h2',ui.missionProgress));for(const m of catalog.missions){const count=summary.byMission.get(m.id);if(count)missions.append(el('p',`${m.titles[state.locale]} · ${count===1&&ui.missionRepeatCountOne?ui.missionRepeatCountOne:ui.missionRepeatCount.replace('{count}',count)}`));}s.append(missions);}
   const history=el('div');history.append(el('h2',ui.history));
   for(const record of snap.records.filter(r=>r.targetId===editable.id)){const item=el('div',undefined,'history-item');item.append(el('p',`${reportMission(record.report)} · ${record.report.value==='complete'?ui.recordComplete:ui.recordEarly}`),b(ui.inspectRecord,'P_INSPECT',{id:record.id}));history.append(item);}
   s.append(history);if(p.historyOnly)row.append(b(ui.editPlayer,'P_EDIT',{id:editable.id}));row.append(b(ui.deletePlayer,'P_DELETE_ONE',{},p.busy));
  }
  else for(const player of players){
   const summary=historySummary(snap.records,player.id,catalog?.missions.map(m=>m.id)),item=el('div',undefined,'history-item');
   item.append(el('h2',playerLabel(player)),el('p',ui.historySummary.replace('{distinct}',summary.distinct).replace('{completed}',summary.completed).replace('{early}',summary.early)),el('p',ui.certificateProgress.replace('{count}',summary.certificateCount).replace('{total}',summary.certificateTotal),'journey-count'),b(`${ui.viewHistory}: ${playerLabel(player)}`,'P_HISTORY',{id:player.id}),b(`${ui.editPlayer}: ${playerLabel(player)}`,'P_EDIT',{id:player.id}));s.append(item);
  }
  if(snap?.operations.some(o=>o.status==='pending')){s.append(el('h2',ui.pendingRecords));for(const op of snap.operations.filter(o=>o.status==='pending')){const owner=players.find(x=>x.id===op.targetId);s.append(b(`${ui.inspectRecord} · ${owner?playerLabel(owner):''}`,'P_INSPECT',{id:op.id}));}}
  row.append(go(ui.newPlayer,'new-player'),b(ui.deleteAll,'P_DELETE_ALL',{},p.busy||p.status!=='ready'),go(cp.adult,'adult'),back());
 }
 s.append(status,row);return s;
}

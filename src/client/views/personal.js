import {el,heading} from '../components/dom.js';
import {button} from '../components/button.js';
import {choice} from '../components/choice.js';
import {playerLabel} from '../repository/local.js';
export function personalView(name,{state,ui,cp,send,personal:p}){
 p ||= {snapshot:null,status:'loading',name:'',selectedId:null,result:null};
 const s=el('section');s.dataset.view=name;const row=el('div',undefined,'controls conflicting');
 const b=(label,type,detail={},disabled=false)=>{const control=button(label,()=>send(type,detail),{disabled});if(type==='START')control.dataset.needsReady='';return control;};
 const go=(label,screen)=>b(label,'GO',{screen});
 const back=()=>go(ui.back,'returning');
 const snap=p.snapshot,players=snap?.players||[],selected=players.find(x=>x.id===p.selectedId),editable=players.find(x=>x.id===p.editId);
 s.append(heading(name==='attribution'?ui.choosePlayer:name==='guest'?ui.guestTitle:ui.titles[name]));
 const status=el('p',p.message||'', 'personal-message');status.setAttribute('role','status');
 const disclosure=()=>s.append(el('p',ui.localDisclosure),el('p',ui.localRetention,'muted'));
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
 if(name==='adult'){s.append(el('p',ui.adultPurpose));disclosure();row.append(go(ui.continueManagement,'management'),back());s.append(row);return s;}
 if(p.status==='loading')s.append(el('p',ui.localLoading));
 if(p.status==='unavailable'){s.append(el('p',ui.localUnavailable));row.append(b(ui.retry,'P_REFRESH'));}
 if(name==='new-player'){s.append(el('p',ui.createInfo));disclosure();form('P_CREATE',ui.createPlayer,p.name);row.append(go(ui.cancel,state.report?'attribution':'management'));}
 if(name==='attribution'){
  const r=p.correction?.report||state.report;
  if(!r)s.append(el('p',ui.noReport));else{
   s.append(el('p',`${cp.mission} · ${r.value==='complete'?ui.recordComplete:ui.recordEarly}`),el('p',p.correction?ui.correctionInfo:ui.chooseInfo));disclosure();
   if(!players.length&&p.status==='ready')s.append(el('p',ui.noPlayers));
   const group=el('fieldset');group.append(el('legend',ui.choosePlayer));for(const player of players)group.append(choice({group:'attribution',value:player.id,label:playerLabel(player),checked:player.id===p.selectedId,onSelect:id=>send('P_SELECT',{id})}));s.append(group);
   if(selected)s.append(el('p',playerLabel(selected),'selected-player'));
   row.append(go(ui.newPlayer,'new-player'),b(p.correction?ui.confirmCorrection:ui.saveRecord,p.correction?'P_MOVE':'P_SAVE',{},!selected||p.busy||p.status!=='ready'));
  }
  row.append(b(ui.backReport,'REPORT_RETURN'));
 }
 if(name==='record-result'){
  const result=p.result,record=snap?.records.find(x=>x.id===result?.id),op=snap?.operations.find(x=>x.id===result?.id),target=players.find(x=>x.id===(record?.targetId||op?.targetId||result?.targetId));
  const verified=result?.status==='committed'&&record&&target;const storedReport=record?.report||op?.report||result?.report;const missionLabel=!storedReport||storedReport.missionId===state.mission?.id?cp.mission:storedReport.missionId;
  s.append(el('p',target?`${playerLabel(target)} · ${missionLabel}`:missionLabel),el('p',verified?ui.saveVerified:p.busy?ui.savePending:ui.saveUnverified,'status'));
  if(verified)row.append(b(ui.correctAttribution,'P_CORRECT',{id:record.id}));else if(result)row.append(b(ui.retryRecord,'P_RETRY',{},p.busy));
  row.append(back(),go(ui.titles.management,'management'));
 }
 if(name==='management'){
  disclosure();if(p.legacy?.count)s.append(el('p',ui.legacyNotice));
  if(!players.length&&p.status==='ready')s.append(el('p',ui.managementEmpty));
  if(editable){s.append(el('h2',playerLabel(editable)),el('p',ui.nameInfo));form('P_RENAME',ui.saveName,p.name);const history=el('div');history.append(el('h2',ui.history));for(const record of snap.records.filter(r=>r.targetId===editable.id)){const item=el('div',undefined,'history-item');item.append(el('p',`${record.report.missionId===state.mission.id?cp.mission:record.report.missionId} · ${record.report.value==='complete'?ui.recordComplete:ui.recordEarly}`),b(ui.inspectRecord,'P_INSPECT',{id:record.id}));history.append(item);}s.append(history);row.append(b(ui.deletePlayer,'P_DELETE_ONE',{},p.busy));}
  else for(const player of players)row.append(b(playerLabel(player),'P_EDIT',{id:player.id}));
  if(snap?.operations.some(o=>o.status==='pending')){s.append(el('h2',ui.pendingRecords));for(const op of snap.operations.filter(o=>o.status==='pending')){const owner=players.find(x=>x.id===op.targetId);s.append(b(`${ui.inspectRecord} · ${owner?playerLabel(owner):''}`,'P_INSPECT',{id:op.id}));}}
  row.append(go(ui.newPlayer,'new-player'),b(ui.deleteAll,'P_DELETE_ALL',{},p.busy||p.status!=='ready'),go(cp.adult,'adult'),back());
 }
 s.append(status,row);return s;
}

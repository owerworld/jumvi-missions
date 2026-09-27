import {storageName,IS_V2} from '../deployment.js';
import {LocalRepository} from './local.js';
import {legacyPresence,deleteLegacy} from './legacy.js';
import {dialog} from '../components/dialog.js';
import {historySummary} from './history-summary.js';
import {showCertificate} from '../certificate.js';
const localViews=new Set(['attribution','record-result','management','new-player','entry','report','discovery','stopped']);
export class PersonalController {
 constructor({getState,navigate,render,ui,catalog}){
  Object.assign(this,{getState,navigate,render,ui,catalog});this.repo=new LocalRepository();this.ticket=0;
  this.model={snapshot:null,status:'loading',selectedId:null,actorId:null,quick:false,editId:null,historyOnly:false,correction:null,result:null,name:'',message:'',busy:false,legacy:null};
  try{this.channel=new BroadcastChannel(storageName('jumvi-local-invalidation-v1'));this.channel.onmessage=()=>{if(localViews.has(this.getState().screen))void this.refresh();else {this.model.snapshot=null;this.model.actorId=null;}};}catch{}
 }
 visible(){if(localViews.has(this.getState().screen))void this.refresh();}
 current(){const s=this.getState();return `${s.documentId}:${s.revision}`;}
 invalidate(){this.channel?.postMessage('changed');}
 enter(screen,previous){
  const p=this.model;p.message='';
  if(screen==='new-player')p.name='';
  if(['management','adult','guest','group'].includes(screen))p.quick=false;
  if(screen==='attribution'&&!['new-player','record-result'].includes(previous)){p.selectedId=null;p.correction=null;}
  if(!['attribution','new-player','record-result'].includes(screen)){p.selectedId=null;p.correction=null;}
  if(localViews.has(screen))void this.refresh();
 }
 async refresh(){
  const key=this.current(),ticket=++this.ticket,p=this.model,signature=()=>JSON.stringify(['entry','stopped'].includes(this.getState().screen)?[p.snapshot?.players||[],p.actorId]:[p.status,p.snapshot,p.result,p.actorId]),before=signature();
  try{const snap=await this.repo.snapshot();if(key!==this.current()||ticket!==this.ticket)return;p.snapshot=snap;p.status='ready';p.legacy=IS_V2?{available:true,count:0}:legacyPresence();if(p.actorId&&!snap.players.some(x=>x.id===p.actorId))p.actorId=null;if(p.selectedId&&!snap.players.some(x=>x.id===p.selectedId))p.selectedId=null;if(p.editId&&!snap.players.some(x=>x.id===p.editId))p.editId=null;
   if(p.result){const op=snap.operations.find(x=>x.id===p.result.id);p.result={...p.result,status:op?.status||(p.result.status==='correction-required'?'correction-required':'unknown')};}
  }catch{if(key!==this.current()||ticket!==this.ticket)return;p.status='unavailable';p.snapshot=null;p.actorId=null;}
  if(before!==signature()){const modal=document.querySelector('dialog');if(modal)modal.addEventListener('close',()=>queueMicrotask(()=>this.render({preserveFocus:true,background:true})),{once:true});else this.render({preserveFocus:true,background:true});}
 }
 isSaved(report){return !!report&&!!this.model.snapshot?.records.some(r=>r.report.id===report.id&&r.report.revision===report.revision);}
 handle(e){
  if(!e.type.startsWith('P_'))return false;
  const p=this.model,s=this.getState(),ui=this.ui,snap=p.snapshot;
  if(e.type==='P_SESSION'){if(!p.busy){p.actorId=snap?.players.some(x=>x.id===e.id)?e.id:null;this.render({preserveFocus:true});}return true;}
  if(e.type==='P_TRACK'){p.quick=true;this.navigate('attribution');return true;}
  if(e.type==='P_QUICK_SAVE'){if(!p.busy&&p.status==='ready'&&s.report){const target=snap?.players.find(x=>x.id===e.id);if(target)this.beginSave(target,true);}return true;}
  if(e.type==='P_NAME'){p.name=e.value;return true;}
  if(e.type==='P_REFRESH'){void this.refresh();return true;}
  if(e.type==='P_SELECT'){p.selectedId=e.id;this.render({preserveFocus:true});return true;}
  if(e.type==='P_EDIT'||e.type==='P_HISTORY'){const player=snap?.players.find(x=>x.id===e.id);if(player){p.editId=e.id;p.historyOnly=e.type==='P_HISTORY';p.name=player.nickname;this.render({preserveFocus:true});}return true;}
  if(e.type==='P_CERTIFICATE'){
   if(p.busy||p.status!=='ready'||document.querySelector('dialog'))return true;
   const player=snap?.players.find(x=>x.id===(e.id||p.editId));if(!player)return true;
   void (async()=>{try{
    const fresh=await this.repo.snapshot(),same=fresh.players.find(x=>x.id===player.id);
    const count=historySummary(fresh.records,player.id,this.catalog.missions.map(m=>m.id));
    if(!same||!count.certificateEligible){p.message=ui.certificateUnavailable;this.render({preserveFocus:true});return;}
    await showCertificate(s.locale,same.nickname||same.label);
   }catch{p.message=ui.certificateUnavailable;this.render({preserveFocus:true});}})();return true;
  }
  if(e.type==='P_CORRECT'){p.quick=false;p.correction=snap?.records.find(x=>x.id===e.id)||null;p.selectedId=null;this.navigate('attribution');return true;}
  if(e.type==='P_CHANGE_REPORT'){
   const record=snap?.records.find(x=>x.id===e.id);
   if(!record||p.busy||p.status!=='ready'||!['complete','early'].includes(e.value)||record.report.value===e.value||document.querySelector('dialog'))return true;
   const key=this.current(),value=e.value,copy=value==='complete'?ui.recordComplete:ui.recordEarly;
   dialog({title:ui.reportChangeTitle,body:`${ui.reportChangeBody} ${copy}`,cancelLabel:ui.cancel,confirmLabel:ui.confirmReportChange,onConfirm:()=>{
    if(key!==this.current()||p.busy)return;
    void this.mutate(()=>this.repo.correctReport({id:record.id,epoch:snap.epoch,revision:record.revision,value}).then(()=>ui.reportCorrected));
   }});return true;
  }
  if(e.type==='P_INSPECT'){const op=snap?.operations.find(x=>x.id===e.id)||(p.result?.id===e.id?p.result:null);if(op){p.result={...op};this.navigate('record-result');}return true;}
  if(p.busy||!snap||p.status!=='ready')return true;
  if(['P_DELETE_ONE','P_DELETE_ALL','P_MOVE'].includes(e.type)){
   if(document.querySelector('dialog'))return true;
   const key=this.current(),player=snap.players.find(x=>x.id===p.editId),selected=snap.players.find(x=>x.id===p.selectedId),correction=p.correction;
   if(e.type==='P_DELETE_ONE'&&!player||e.type==='P_MOVE'&&(!selected||!correction))return true;
   const title=e.type==='P_DELETE_ALL'?ui.deleteAll:e.type==='P_MOVE'?ui.confirmCorrection:`${ui.deletePlayer}: ${player.nickname||player.label}`;
   dialog({title,body:e.type==='P_DELETE_ALL'?ui.deleteAllBody:e.type==='P_MOVE'?`${ui.correctionInfo} ${selected.nickname||selected.label}`:ui.deletePlayerBody,cancelLabel:ui.cancel,confirmLabel:e.type==='P_MOVE'?ui.confirmCorrection:e.type==='P_DELETE_ALL'?ui.deleteAll:ui.deletePlayer,onConfirm:()=>{if(key!==this.current()||p.busy)return;void this.mutate(async()=>{
    if(e.type==='P_MOVE'){await this.repo.reattribute({id:correction.id,epoch:snap.epoch,revision:correction.revision,targetId:selected.id,targetRevision:selected.revision});if(key===this.current())p.result={id:correction.id,epoch:snap.epoch,status:'committed'};}
    else if(e.type==='P_DELETE_ONE')await this.repo.deletePlayer({epoch:snap.epoch,id:player.id,revision:player.revision});
    else {await this.repo.deleteAll(snap.epoch);try{if(!IS_V2)deleteLegacy();}catch{return ui.partialDelete;}}
    return e.type==='P_MOVE'?ui.saveVerified:ui.deleted;
   },e.type==='P_MOVE'?'record-result':null);}});return true;
  }
  if(e.type==='P_CREATE'){if(p.quick&&s.report)void this.createAndSave();else void this.mutate(()=>this.repo.create({epoch:snap.epoch,name:p.name}).then(()=>ui.createInfo),s.report?'attribution':'management');}
  if(e.type==='P_RENAME'){const player=snap.players.find(x=>x.id===p.editId);if(player)void this.mutate(()=>this.repo.rename({epoch:snap.epoch,id:player.id,revision:player.revision,name:p.name}).then(()=>ui.nameSaved));}
  if(e.type==='P_SAVE'){
   const target=snap.players.find(x=>x.id===p.selectedId);if(!target||!s.report)return true;
   this.beginSave(target,false);
  }
  if(e.type==='P_RETRY'&&p.result)void this.save({...p.result},!!p.result.report);
  return true;
 }
 // Session attribution stays in memory. Reload/new tabs/guest never inherit a child.
 clearActor(){this.model.actorId=null;this.model.quick=false;}
 beginSave(target,inline){
  const p=this.model,s=this.getState();if(p.busy||!s.report||!p.snapshot||p.status!=='ready')return;
  const envelope={id:crypto.randomUUID(),epoch:p.snapshot.epoch,targetId:target.id,targetRevision:target.revision,report:{...s.report}};
  p.actorId=target.id;p.result={...envelope,status:'pending'};
  if(inline){if(s.screen!=='report')this.navigate('report');}else this.navigate('record-result');
  void this.save(envelope,true);
 }
 saveExplicitReport(){
  const p=this.model,s=this.getState(),target=p.snapshot?.players.find(x=>x.id===p.actorId);
  // Revised saved reports keep the explicit correction path, not a second record.
  if(target&&!p.snapshot.records.some(x=>x.report.id===s.report?.id))this.beginSave(target,true);
 }
 async createAndSave(){
  const p=this.model,key=this.current(),epoch=p.snapshot.epoch;let handedOff=false;p.busy=true;p.message='';this.render({preserveFocus:true});
  try{const target=await this.repo.create({epoch,name:p.name});this.invalidate();
   if(key!==this.current())return;
   const fresh=await this.repo.snapshot();if(key!==this.current())return;p.snapshot=fresh;p.status='ready';p.busy=false;
   if(fresh.epoch===epoch&&fresh.players.some(x=>x.id===target.id)){handedOff=true;this.beginSave(target,true);}
  }catch(e){if(key===this.current())p.message=e.code==='invalid-name'?this.ui.nameError:this.ui.localUnavailable;}
  finally{if(!handedOff){p.busy=false;if(localViews.has(this.getState().screen))await this.refresh();this.render({preserveFocus:true});}}
 }
 async mutate(fn,destination){
  const p=this.model,key=this.current();p.busy=true;p.message='';this.render({preserveFocus:true});
  try{const message=await fn();this.invalidate();if(key===this.current()){p.message=message||'';if(destination)this.navigate(destination);}}
  catch(e){if(key===this.current())p.message=e.code==='invalid-name'?this.ui.nameError:['stale','deleted','conflict'].includes(e.code)?this.ui.localChanged:this.ui.localUnavailable;}
  finally{p.busy=false;if(localViews.has(this.getState().screen))await this.refresh();this.render({preserveFocus:true});}
 }
 async save(envelope,prepare){
  const key=this.current(),p=this.model;p.busy=true;p.message='';this.render({preserveFocus:true});
  try{let op=prepare?await this.repo.prepare(envelope):envelope;if(key===this.current())p.result={...p.result,id:op.id,epoch:op.epoch};const result=await this.repo.commit(op.id,op.epoch);this.invalidate();if(key===this.current())p.result={id:op.id,epoch:op.epoch,targetId:result.record.targetId,status:'committed'};}
  catch(e){if(key===this.current()){if(e.code==='correction-required'){p.result={...p.result,status:'correction-required'};p.message=this.ui.correctionRequired;}else p.message=this.ui.saveUnverified;}}
  finally{p.busy=false;if(localViews.has(this.getState().screen))await this.refresh();this.render({preserveFocus:true});}
 }
}

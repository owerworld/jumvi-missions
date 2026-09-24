import {storageName,IS_V2} from '../deployment.js';
import {LocalRepository} from './local.js';
import {legacyPresence,deleteLegacy} from './legacy.js';
import {dialog} from '../components/dialog.js';
const localViews=new Set(['attribution','record-result','management','new-player']);
export class PersonalController {
 constructor({getState,navigate,render,ui}){
  Object.assign(this,{getState,navigate,render,ui});this.repo=new LocalRepository();this.ticket=0;
  this.model={snapshot:null,status:'loading',selectedId:null,editId:null,correction:null,result:null,name:'',message:'',busy:false,legacy:null};
  try{this.channel=new BroadcastChannel(storageName('jumvi-local-invalidation-v1'));this.channel.onmessage=()=>{if(localViews.has(this.getState().screen))void this.refresh();else this.model.snapshot=null;};}catch{}
 }
 visible(){if(localViews.has(this.getState().screen))void this.refresh();}
 current(){const s=this.getState();return `${s.documentId}:${s.revision}`;}
 invalidate(){this.channel?.postMessage('changed');}
 enter(screen,previous){
  const p=this.model;p.message='';
  if(screen==='new-player')p.name='';
  if(screen==='attribution'&&!['new-player','record-result'].includes(previous)){p.selectedId=null;p.correction=null;}
  if(!['attribution','new-player','record-result'].includes(screen)){p.selectedId=null;p.correction=null;}
  if(localViews.has(screen))void this.refresh();
 }
 async refresh(){
  const key=this.current(),ticket=++this.ticket,p=this.model;
  try{const snap=await this.repo.snapshot();if(key!==this.current()||ticket!==this.ticket)return;p.snapshot=snap;p.status='ready';p.legacy=IS_V2?{available:true,count:0}:legacyPresence();if(p.selectedId&&!snap.players.some(x=>x.id===p.selectedId))p.selectedId=null;if(p.editId&&!snap.players.some(x=>x.id===p.editId))p.editId=null;
   if(p.result){const op=snap.operations.find(x=>x.id===p.result.id);p.result={...p.result,status:op?.status||'unknown'};}
  }catch{if(key!==this.current()||ticket!==this.ticket)return;p.status='unavailable';p.snapshot=null;}
  this.render({preserveFocus:true});
 }
 isSaved(report){return !!report&&!!this.model.snapshot?.records.some(r=>r.report.id===report.id&&r.report.revision===report.revision);}
 handle(e){
  if(!e.type.startsWith('P_'))return false;
  const p=this.model,s=this.getState(),ui=this.ui,snap=p.snapshot;
  if(e.type==='P_NAME'){p.name=e.value;return true;}
  if(e.type==='P_REFRESH'){void this.refresh();return true;}
  if(e.type==='P_SELECT'){p.selectedId=e.id;this.render({preserveFocus:true});return true;}
  if(e.type==='P_EDIT'){const player=snap?.players.find(x=>x.id===e.id);if(player){p.editId=e.id;p.name=player.nickname;this.render();}return true;}
  if(e.type==='P_CORRECT'){p.correction=snap?.records.find(x=>x.id===e.id)||null;p.selectedId=null;this.navigate('attribution');return true;}
  if(e.type==='P_INSPECT'){const op=snap?.operations.find(x=>x.id===e.id);if(op){p.result={id:op.id,epoch:op.epoch,targetId:op.targetId,status:op.status};this.navigate('record-result');}return true;}
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
  if(e.type==='P_CREATE')void this.mutate(()=>this.repo.create({epoch:snap.epoch,name:p.name}).then(()=>ui.createInfo),s.report?'attribution':'management');
  if(e.type==='P_RENAME'){const player=snap.players.find(x=>x.id===p.editId);if(player)void this.mutate(()=>this.repo.rename({epoch:snap.epoch,id:player.id,revision:player.revision,name:p.name}).then(()=>ui.nameSaved));}
  if(e.type==='P_SAVE'){
   const target=snap.players.find(x=>x.id===p.selectedId);if(!target||!s.report)return true;
   const envelope={id:crypto.randomUUID(),epoch:snap.epoch,targetId:target.id,targetRevision:target.revision,report:{...s.report}};
   p.result={...envelope,status:'pending'};this.navigate('record-result');void this.save(envelope,true);
  }
  if(e.type==='P_RETRY'&&p.result)void this.save({...p.result},!!p.result.report);
  return true;
 }
 async mutate(fn,destination){
  const p=this.model,key=this.current();p.busy=true;p.message='';this.render();
  try{const message=await fn();this.invalidate();if(key===this.current()){p.message=message||'';if(destination)this.navigate(destination);}}
  catch(e){if(key===this.current())p.message=e.code==='invalid-name'?this.ui.nameError:['stale','deleted','conflict'].includes(e.code)?this.ui.localChanged:this.ui.localUnavailable;}
  finally{p.busy=false;if(localViews.has(this.getState().screen))await this.refresh();}
 }
 async save(envelope,prepare){
  const key=this.current(),p=this.model;p.busy=true;p.message='';this.render();
  try{let op=prepare?await this.repo.prepare(envelope):envelope;if(key===this.current())p.result={...p.result,id:op.id,epoch:op.epoch};const result=await this.repo.commit(op.id,op.epoch);this.invalidate();if(key===this.current())p.result={id:op.id,epoch:op.epoch,targetId:result.record.targetId,status:'committed'};}
  catch{if(key===this.current())p.message=this.ui.saveUnverified;}
  finally{p.busy=false;if(localViews.has(this.getState().screen))await this.refresh();}
 }
}

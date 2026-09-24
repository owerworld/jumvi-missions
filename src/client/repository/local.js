// R3: this module has no network, analytics, URL or browser-history dependency.
import {storageName} from '../deployment.js';
export const DATABASE = storageName('jumvi-companion-v1');
const stores = ['meta','players','operations','records'];
const request = r => new Promise((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
const fail = code => {throw Object.assign(new Error(code),{code});};
export const playerLabel = p => p.nickname || p.label;
export function nickname(value) {
 if(typeof value!=='string'||value.length>64||/[\u0000-\u001f\u007f]/.test(value))fail('invalid-name');
 return value.trim();
}
function reportPayload(r) {
 if(!r||!['complete','early'].includes(r.value)||!Number.isInteger(r.revision)||r.revision<1)fail('invalid-report');
 for(const k of ['id','missionId','mechanicsVersion'])if(typeof r[k]!=='string'||!r[k]||r[k].length>128)fail('invalid-report');
 if(r.roundId!==null&&(typeof r.roundId!=='string'||r.roundId.length>128))fail('invalid-report');
 return {id:r.id,missionId:r.missionId,mechanicsVersion:r.mechanicsVersion,roundId:r.roundId,value:r.value,revision:r.revision};
}
const intent = (target,r) => JSON.stringify([target,r.id,r.revision]);
export class LocalRepository {
 constructor(factory){if(arguments.length===0){try{factory=globalThis.indexedDB;}catch{factory=null;}}this.factory=factory;this.connection=null;}
 async open(){
  if(this.connection)return this.connection;
  if(!this.factory)fail('unavailable');
  return new Promise((resolve,reject)=>{
   let settled=false;const r=this.factory.open(DATABASE,1);
   const stop=()=>{if(!settled){settled=true;reject(Object.assign(new Error('blocked'),{code:'blocked'}));}};
   const timer=setTimeout(stop,3000);
   r.onblocked=stop;r.onerror=()=>{clearTimeout(timer);if(!settled){settled=true;reject(r.error);}};
   r.onupgradeneeded=()=>{const db=r.result;db.createObjectStore('meta',{keyPath:'id'}).put({id:'control',epoch:crypto.randomUUID(),next:1});db.createObjectStore('players',{keyPath:'id'});const ops=db.createObjectStore('operations',{keyPath:'id'});ops.createIndex('intent','intent',{unique:true});db.createObjectStore('records',{keyPath:'id'});};
   r.onsuccess=()=>{clearTimeout(timer);const db=r.result;if(settled){db.close();return;}settled=true;this.connection=db;db.onclose=()=>{if(this.connection===db)this.connection=null;};db.onversionchange=()=>{db.close();if(this.connection===db)this.connection=null;};resolve(db);};
  });
 }
 close(){this.connection?.close();this.connection=null;}
 async transaction(mode,fn){
  const db=await this.open(),tx=db.transaction(stores,mode);
  const done=new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error||Object.assign(new Error('aborted'),{code:'aborted'}));tx.onerror=()=>{};});
  // Attach immediately so a request failure cannot leave an unhandled abort rejection.
  done.catch(()=>{});
  const api=Object.fromEntries(stores.map(n=>[n,tx.objectStore(n)]));
  try{const value=await fn(api);await done;return value;}catch(e){try{tx.abort();}catch{}await done.catch(()=>{});throw e;}
 }
 async snapshot(){return this.transaction('readonly',async s=>{const [control,players,operations,records]=await Promise.all([request(s.meta.get('control')),request(s.players.getAll()),request(s.operations.getAll()),request(s.records.getAll())]);if(!control?.epoch)fail('corrupt');return {epoch:control.epoch,players,operations,records};});}
 async guard(s,epoch,id,revision){const control=await request(s.meta.get('control'));if(control?.epoch!==epoch)fail('stale');if(!id)return control;const p=await request(s.players.get(id));if(!p)fail('deleted');if(p.revision!==revision)fail('stale');return p;}
 async create({epoch,name='',id=crypto.randomUUID()}){const clean=nickname(name);return this.transaction('readwrite',async s=>{const c=await this.guard(s,epoch);if(await request(s.players.get(id)))fail('duplicate');const p={id,label:`Player ${c.next}`,nickname:clean,revision:1};await request(s.players.add(p));await request(s.meta.put({...c,next:c.next+1}));return p;});}
 async rename({epoch,id,revision,name}){const clean=nickname(name);return this.transaction('readwrite',async s=>{const p=await this.guard(s,epoch,id,revision);const updated={...p,nickname:clean,revision:p.revision+1};await request(s.players.put(updated));return updated;});}
 async prepare({id,epoch,targetId,targetRevision,report}){
  const payload=reportPayload(report),canonical=JSON.stringify(payload),digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical)))].map(b=>b.toString(16).padStart(2,'0')).join('');
  return this.transaction('readwrite',async s=>{
   await this.guard(s,epoch,targetId,targetRevision);
   const key=intent(targetId,payload),existing=await request(s.operations.index('intent').get(key));
   if(existing){if(existing.digest!==digest)fail('conflict');return existing;}
   const sameId=await request(s.operations.get(id));if(sameId)fail('conflict');
   const op={id,epoch,targetId,targetRevision,report:payload,digest,intent:key,status:'pending'};await request(s.operations.add(op));return op;
  });
 }
 async commit(id,epoch){
  await this.transaction('readwrite',async s=>{
   await this.guard(s,epoch);const op=await request(s.operations.get(id));if(!op)fail('deleted');
   if(op.status==='committed'){if(!await request(s.records.get(id)))fail('corrupt');return;}
   await this.guard(s,epoch,op.targetId,op.targetRevision);
   await request(s.records.add({id:op.id,targetId:op.targetId,report:op.report,revision:1}));
   await request(s.operations.put({...op,status:'committed'}));
  });
  return this.verify(id,epoch);
 }
 async verify(id,epoch){return this.transaction('readonly',async s=>{await this.guard(s,epoch);const [op,record]=await Promise.all([request(s.operations.get(id)),request(s.records.get(id))]);if(!op)fail('deleted');if(op.status==='committed'&&record&&record.targetId===op.targetId)return {status:'committed',op,record};if(op.status==='pending'&&!record)return {status:'pending',op};fail('corrupt');});}
 async reattribute({id,epoch,revision,targetId,targetRevision}){return this.transaction('readwrite',async s=>{await this.guard(s,epoch,targetId,targetRevision);const record=await request(s.records.get(id));if(!record)fail('deleted');if(record.revision!==revision)fail('stale');const op=await request(s.operations.get(id));if(!op||op.status!=='committed')fail('corrupt');const key=intent(targetId,record.report);const duplicate=await request(s.operations.index('intent').get(key));if(duplicate&&duplicate.id!==id)fail('conflict');await request(s.records.put({...record,targetId,revision:record.revision+1}));await request(s.operations.put({...op,targetId,targetRevision,intent:key}));return id;});}
 async deletePlayer({epoch,id,revision}){return this.transaction('readwrite',async s=>{await this.guard(s,epoch,id,revision);for(const table of [s.records,s.operations]){for(const row of await request(table.getAll()))if(row.targetId===id)await request(table.delete(row.id));}await request(s.players.delete(id));});}
 async deleteAll(epoch){return this.transaction('readwrite',async s=>{await this.guard(s,epoch);for(const n of ['players','records','operations'])await request(s[n].clear());await request(s.meta.put({id:'control',epoch:crypto.randomUUID(),next:1}));});}
}

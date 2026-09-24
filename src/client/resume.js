import {storageName} from './deployment.js';
const KEY=storageName('jumvi.lock09.resume.v1');
export function readResume(storage,mission) {
 try {const raw=storage.getItem(KEY);if(!raw)return {kind:'none'};const v=JSON.parse(raw);
 if(v.schema!==1 || typeof v.id!=='string' || !v.id || v.id.length>128 || v.missionId!==mission.id || v.mechanicsVersion!==mission.mechanicsVersion || !['active','stopped','interrupted'].includes(v.state))return {kind:'unknown'};
 return {kind:'known',round:{id:v.id,missionId:v.missionId,mechanicsVersion:v.mechanicsVersion,state:v.state==='active'?'interrupted':v.state}};
 } catch {return {kind:'unknown'};}
}
export function writeResume(storage,state) {
 try {if(!state.round){storage.removeItem(KEY);return true;}const {id,missionId,mechanicsVersion,state:roundState}=state.round;
 storage.setItem(KEY,JSON.stringify({schema:1,id,missionId,mechanicsVersion,state:roundState}));return true;}catch{return false;}
}

import {BASE} from './deployment.js';
export function routeLocale(path) {if(BASE==='/v2/'){if(!path.startsWith(BASE))return null;path='/'+path.slice(BASE.length);}return ['/tr','/tr/','/tr/index.html'].includes(path)?'tr':(['/','/index.html'].includes(path)?'en-US':null);}
// Route/reading snapshots live only in this document. No player, report or round is replayed.
export function installRouter(getState,send,{capture=()=>({y:0}),restore}={}) {
 const previous=history.state;
 const unknown=!!previous?.jumvi && (previous.hasRound===true || ['active','stopped','interrupted'].includes(previous.screen));
 const entries=new Map();let current=crypto.randomUUID();
 const snapshot=()=>{const s=getState();return {jumvi:true,documentId:s.documentId,entry:current,screen:s.screen,revision:s.revision,hasRound:!!s.round};};
 const save=()=>{const s=getState();entries.set(current,{route:!s.round&&!s.report&&['entry','discovery','help'].includes(s.screen)?{missionId:s.mission.id,screen:s.screen,returnContext:s.returnContext}:null,position:capture()});};
 history.scrollRestoration='manual';save();history.replaceState(snapshot(),'',location.pathname);
 addEventListener('popstate',e=>{save();current=e.state?.entry||crypto.randomUUID();const target=entries.get(current);const s=getState();if(target?.route&&!s.round&&!s.report&&restore)void restore(target);else send('BACK',{},false);});
 addEventListener('pageshow',e=>{history.scrollRestoration='manual';if(e.persisted)send('INTERRUPT',{},false);});
 return {unknown,capture:save,write(){try{current=crypto.randomUUID();save();history.pushState(snapshot(),'',location.pathname);return true;}catch{return false;}}};
}

import {BASE} from './deployment.js';
export function routeLocale(path) {if(BASE==='/v2/'){if(!path.startsWith(BASE))return null;path='/'+path.slice(BASE.length);}return ['/tr','/tr/','/tr/index.html'].includes(path)?'tr':(['/','/index.html'].includes(path)?'en-US':null);}
// Route/reading snapshots live only in this document. No player, report or round is replayed.
export const browseScreens=['entry','discovery','help','adult','management','new-player','returning','guest','group','record-result'];
export function installRouter(getState,send,{capture=()=>({y:0}),restore}={}) {
 const previous=history.state;
 const unknown=!!previous?.jumvi && (previous.hasRound===true || ['active','stopped','interrupted'].includes(previous.screen));
 const entries=new Map();let current=crypto.randomUUID();
 const snapshot=()=>{const s=getState();return {jumvi:true,documentId:s.documentId,entry:current,screen:s.screen,revision:s.revision,hasRound:!!s.round};};
 const save=()=>{const s=getState();entries.set(current,{...entries.get(current),route:!s.round&&!s.report&&browseScreens.includes(s.screen)?{missionId:s.mission.id,screen:s.screen,returnContext:s.returnContext,uiPanel:s.uiPanel}:null,position:capture()});};
 history.scrollRestoration='manual';save();history.replaceState(snapshot(),'',location.pathname);
 addEventListener('popstate',e=>{save();current=e.state?.entry||crypto.randomUUID();const target=entries.get(current);const s=getState();if(target?.route&&!s.round&&!s.report&&restore)void restore(target);else send('BACK',{},false);});
 addEventListener('pageshow',e=>{history.scrollRestoration='manual';if(e.persisted)send('INTERRUPT',{},false);});
 return {unknown,capture:save,parent(){return entries.get(entries.get(current)?.parent)?.route||null;},back(){const s=getState(),parent=entries.get(entries.get(current)?.parent);if(s.round||s.report||!parent?.route)return false;history.back();return true;},write(){try{const parent=current;current=crypto.randomUUID();entries.set(current,{parent});save();entries.get(current).position={y:0};history.pushState(snapshot(),'',location.pathname);return true;}catch{return false;}}};
}

export function routeLocale(path) {return ['/tr','/tr/','/tr/index.html'].includes(path)?'tr':(['/','/index.html'].includes(path)?'en-US':null);}
export function installRouter(getState,send) {
 const initial=getState();const previous=history.state;
 const unknown=!!previous?.jumvi && (previous.hasRound===true || ['active','stopped','interrupted'].includes(previous.screen));
 const snapshot=()=>{const s=getState();return {jumvi:true,documentId:s.documentId,screen:s.screen,revision:s.revision,hasRound:!!s.round};};
 history.replaceState(snapshot(),'',location.pathname);
 addEventListener('popstate',()=>send('BACK',{},false));
 addEventListener('pageshow',e=>{if(e.persisted)send('INTERRUPT',{},false);});
 return {unknown,write(){try{history.pushState(snapshot(),'',location.pathname);return true;}catch{return false;}}};
}

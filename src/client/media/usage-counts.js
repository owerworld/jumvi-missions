// LOCK 09 R8: disabled until taxonomy, notice, retention and privacy/technical review close.
// Never pass a player, report, operation ID, state object, URL or text input to this adapter.
export const USAGE_COLLECTION_ENABLED=false;
const events=new Set(['app_open','mission_open','round_start','help_open','round_stop','round_resume','completion_reported']);
export function createUsageCounter({enabled=USAGE_COLLECTION_ENABLED,locale,fetcher=globalThis.fetch,navigator=globalThis.navigator}={}){
  return function count(event,mission='none'){
    if(!enabled||navigator?.onLine===false||navigator?.globalPrivacyControl===true||navigator?.doNotTrack==='1')return;
    if(!events.has(event)||!['en-US','tr'].includes(locale)||!(event==='app_open'?mission==='none':/^m(0[1-9]|[12][0-9]|3[0-6])$/.test(mission)))return;
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),2000);
    try{Promise.resolve(fetcher('/v2/metrics',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({v:1,event,mission,locale}),credentials:'omit',referrerPolicy:'no-referrer',cache:'no-store',signal:controller.signal})).catch(()=>{}).finally(()=>clearTimeout(timer));}catch{clearTimeout(timer);}
    // No retries, offline queue, cookies, storage, visitor or session identifier.
  };
}
export function usageTransition(type,screen,previousScreen,completed,previouslyCompleted){
  if(type==='SELECT'&&screen==='entry')return 'mission_open';
  if(['START','REPLAY'].includes(type)&&screen==='active'&&previousScreen!=='active')return 'round_start';
  if(type==='HELP'&&screen==='help'&&previousScreen!=='help')return 'help_open';
  if(type==='STOP'&&screen==='stopped')return 'round_stop';
  if(type==='RESUME'&&screen==='active')return 'round_resume';
  if(type==='REPORT'&&completed&&!previouslyCompleted)return 'completion_reported';
  return null;
}

import {setupOffline,prepareOffline} from './offline.js';
import {missionCopy,criticalPaths,verifyAsset} from './catalog.js';
import {PersonalController} from './repository/controller.js';
import {icon} from './components/icons.js';
import {initialState,transition} from './state/app.js';import {views} from './views/index.js';import {routeLocale,installRouter} from './router.js';import {contextKey,contextMatches} from './context.js';import {AudioController} from './media/audio-controller.js';import {readResume,writeResume} from './resume.js';import {dialog} from './components/dialog.js';
async function boot(){
 const app=document.querySelector('#app'),locale=routeLocale(location.pathname)||'en-US';
 const load=async(path,sha256)=>{const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);try{const r=await fetch(new URL('../content/'+path,import.meta.url),{credentials:'omit',signal:controller.signal});if(!r.ok||!r.headers.get('content-type')?.startsWith('application/json'))throw Error('Content unavailable');const bytes=await r.arrayBuffer();if(sha256&&!await verifyAsset(bytes,{bytes:bytes.byteLength,sha256}))throw Error('Content mismatch');return JSON.parse(new TextDecoder().decode(bytes));}finally{clearTimeout(timer);}};
 const [ui,assetManifest,catalog]=await Promise.all([load(`ui/${locale}.json`),load('asset-manifest.json'),load('catalog.json')]);
 const fixture=await load('missions/m25.json',catalog.missions.find(m=>m.id==='m25').sha256);
 const labels=fixture.locale[locale];let selected='m25';try{const id=sessionStorage.getItem('jumvi.selected-mission.v1');if(catalog.missions.some(m=>m.id===id))selected=id;}catch{}
 let record=selected==='m25'?fixture:await load(`missions/${selected}.json`,catalog.missions.find(m=>m.id===selected).sha256),cp=missionCopy(record,locale,labels),loadGeneration=0,pendingMission=null;
 let state=initialState({documentId:crypto.randomUUID(),locale,mission:{id:record.id,mechanicsVersion:record.mechanicsVersion,contentVersion:record.contentVersion,ready:false}}),router,helpTrigger=null;
 let pointerInteraction=false;
 app.addEventListener('pointerdown',()=>{pointerInteraction=true;},true);
 for(const type of ['pointerup','pointercancel'])addEventListener(type,()=>{if(!pointerInteraction)return;pointerInteraction=false;requestAnimationFrame(()=>refreshReadiness());},true);
 let storage;try{storage=sessionStorage;}catch{storage=null;}
 const audio=new AudioController({onChange:refreshAudio});
 const personal=new PersonalController({getState:()=>state,navigate:screen=>dispatch({type:'GO',screen,revision:state.revision,documentId:state.documentId}),render,ui});
 function notice(message){const n=app.querySelector('.play-notice');if(n)n.textContent=message;}
 function refreshAudio(){const v=audio.snapshot();for(const n of app.querySelectorAll('[data-sound]')){n.querySelector('[data-sound-text]').textContent=v.preference?ui.soundOn:ui.soundOff;n.querySelector('svg')?.replaceWith(icon(v.preference?'volume-2':'volume-x'));n.setAttribute('aria-pressed',String(v.preference));}if(v.playback==='unavailable')notice(ui.soundUnavailable);else if(v.playback==='pending')notice(ui.soundPending);}
 function render({preserveFocus=false}={}){const focus=preserveFocus&&app.contains(document.activeElement)?{id:document.activeElement.id,start:document.activeElement.selectionStart,end:document.activeElement.selectionEnd}:null;const captured=state,send=(type,detail={},push=true)=>dispatch({type,...detail,revision:captured.revision,documentId:captured.documentId},push);
  app.replaceChildren(views[state.screen]({state,ui,cp,assetManifest,catalog,audio,send,personal:personal.model,isSaved:personal.isSaved(state.report)}));const p=document.createElement('p');p.className='play-notice';p.setAttribute('role','status');p.setAttribute('aria-live','polite');app.append(p);app.setAttribute('aria-busy','false');placeUtilities();app.querySelector('h1')?.focus({preventScroll:true});refreshAudio();if(focus?.id){const target=document.getElementById(focus.id);target?.focus({preventScroll:true});if(target?.type==='text'&&focus.start!==null)target.setSelectionRange(focus.start,focus.end);}
 }
 function placeUtilities(){const textSize=parseFloat(getComputedStyle(document.documentElement).fontSize),compact=innerWidth<24.375*textSize;app.classList.toggle('compact-controls',compact&&textSize>16);const section=app.querySelector('[data-view=entry]'),support=section?.querySelector('.entry-support');if(!support)return;support.classList.toggle('compact',compact);(compact?section.querySelector('h1'):section.querySelector('.setup')).before(support);}
 function dispatch(e,push=true){
  if(!contextMatches(state,e))return;
  if(personal.handle(e))return;
  if(e.type==='SOUND'){audio.toggle(null,contextKey(state));return;}
  if(e.type==='EXPLAIN'){app.querySelector('#first-step')?.focus();app.querySelector('#first-step')?.scrollIntoView({block:'start'});audio.replay(null,contextKey(state));return;}
  if(e.type==='ACCESS'||e.type==='ASK'){notice(e.type==='ACCESS'?ui.accessText:ui.askText);return;}
  if(e.type==='RETRY_MISSION'){if(pendingMission)void selectMission(pendingMission);return;}
  if(e.type==='RETRY_ASSETS'){void retryAssets();return;}
  if(state.report&&!personal.isSaved(state.report)&&['LEAVE','REPLAY','START','PREVIOUS','SELECT_MISSION'].includes(e.type)&&!e.discardConfirmed){if(document.querySelector('dialog'))return;dialog({title:ui.discardTitle,body:ui.discardBody,cancelLabel:ui.cancel,confirmLabel:ui.discard,onConfirm:()=>dispatch({...e,discardConfirmed:true},push)});return;}
  if(e.type==='SELECT_MISSION'){void selectMission(e.missionId);return;}
  if(e.type==='HELP')helpTrigger={screen:state.screen,label:e.trigger||document.activeElement?.textContent};
  const next=transition(state,{...e,id:e.id||crypto.randomUUID()});if(next===state)return;
  const previous=state.screen;audio.cancel({off:e.type==='GUEST'||e.type==='PREVIOUS'});state=next;personal.enter(state.screen,previous);const stored=writeResume(storage,state);render();if(!stored)notice(ui.storageUnavailable);
  if(e.type==='RETURN'&&helpTrigger?.screen===state.screen){[...app.querySelectorAll('button')].find(b=>b.textContent===helpTrigger.label)?.focus();helpTrigger=null;}
  if(push)router?.write();
 }
 async function assetsReady(current){const paths=criticalPaths(current);if(!paths.length)return false;try{return (await Promise.all(paths.map(async path=>{const asset=assetManifest.assets.find(a=>a.path===path);if(!asset)return false;const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);let r,bytes;try{r=await fetch(new URL('../'+path,import.meta.url),{credentials:'omit',signal:controller.signal});bytes=await r.arrayBuffer();}finally{clearTimeout(timer);}if(!r.ok||!r.headers.get('content-type')?.startsWith('image/'))return false;if(!await verifyAsset(bytes,asset))return false;const url=URL.createObjectURL(new Blob([bytes],{type:'image/webp'}));try{const img=new Image();img.src=url;await img.decode();return img.naturalWidth===asset.width&&img.naturalHeight===asset.height;}finally{URL.revokeObjectURL(url);}}))).every(Boolean);}catch{return false;}}
 async function retryAssets(){if(state.loadingAssets)return;const gen=++loadGeneration,current=record;state={...state,loadingAssets:true};refreshReadiness();const ready=await assetsReady(current);if(gen!==loadGeneration||record!==current)return;state={...state,loadingAssets:false,mission:{...state.mission,ready}};refreshReadiness();if(ready)void prepareOffline(current.id);}
 async function selectMission(id){if(!catalog.missions.some(m=>m.id===id)||!['entry','discovery','report','stopped','returning','availability','recovery'].includes(state.screen))return;pendingMission=id;const gen=++loadGeneration,rev=state.revision;audio.cancel();state={...state,loadingAssets:true};notice(ui.criticalLoading);try{const next=await load(`missions/${id}.json`,catalog.missions.find(m=>m.id===id).sha256);if(gen!==loadGeneration||state.revision!==rev)return;const copy=missionCopy(next,locale,labels);record=next;cp=copy;dispatch({type:'SELECT',mission:{id:next.id,mechanicsVersion:next.mechanicsVersion,contentVersion:next.contentVersion,ready:false},revision:state.revision,documentId:state.documentId});try{sessionStorage.setItem('jumvi.selected-mission.v1',id);}catch{}state={...state,loadingAssets:false};void retryAssets();}catch{if(gen!==loadGeneration)return;state={...state,loadingAssets:false};dispatch({type:'GO',screen:'availability',revision:state.revision,documentId:state.documentId});notice(ui.criticalMissing);}}
 function refreshReadiness(){if(pointerInteraction)return;for(const n of app.querySelectorAll('[data-needs-ready]'))n.disabled=!state.mission.ready;for(const n of app.querySelectorAll('[data-readiness]')){if(state.mission.ready)n.remove();else{n.querySelector('p').textContent=state.loadingAssets?ui.criticalLoading:ui.criticalMissing;n.querySelector('button').hidden=state.loadingAssets;}}}
 state={...state,loadingAssets:true};
 const resume=readResume(storage,state.mission);
 router=installRouter(()=>state,(type,d={},push=true)=>dispatch({type,...d,revision:state.revision,documentId:state.documentId},push));
 const sendCurrent=type=>dispatch({type,revision:state.revision,documentId:state.documentId},false);
 function interrupt(){audio.cancel();sendCurrent('INTERRUPT');}
 document.addEventListener('visibilitychange',()=>{if(document.hidden)interrupt();else personal.visible();});addEventListener('pagehide',interrupt);addEventListener('pageshow',()=>personal.visible());addEventListener('resize',placeUtilities);
 if(resume.kind==='known')dispatch({type:'RESTORE',round:resume.round,revision:state.revision,documentId:state.documentId},false);
 else if(resume.kind==='unknown'||router.unknown)sendCurrent('UNKNOWN');else render();
 state={...state,loadingAssets:false};void retryAssets();void setupOffline().then(()=>prepareOffline(record.id));
}
boot().catch(()=>{const app=document.querySelector('#app');app.setAttribute('aria-busy','false');const h=document.createElement('h1'),p=document.createElement('p');h.textContent='JUMVI';h.tabIndex=-1;p.setAttribute('role','status');p.textContent=document.documentElement.lang==='tr'?'Görev içeriği yüklenemedi. Bağlantını kontrol edip sayfayı yeniden açabilirsin.':'Mission content could not load. Check your connection and reopen this page.';app.replaceChildren(h,p);h.focus();});

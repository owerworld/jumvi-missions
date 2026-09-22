import {icon} from './components/icons.js';
import {initialState,transition} from './state/app.js';import {views} from './views/index.js';import {routeLocale,installRouter} from './router.js';import {contextKey,contextMatches} from './context.js';import {AudioController} from './media/audio-controller.js';import {readResume,writeResume} from './resume.js';import {dialog} from './components/dialog.js';
async function boot(){
 const app=document.querySelector('#app'),locale=routeLocale(location.pathname)||'en-US';
 const load=path=>fetch(new URL('../content/'+path,import.meta.url)).then(r=>{if(!r.ok)throw Error('Content unavailable');return r.json();});
 const [ui,fixture,assetManifest]=await Promise.all([load(`ui/${locale}.json`),load('missions/m25.json'),load('asset-manifest.json')]);
 const cp=fixture.locale[locale];if(!cp)throw Error('Locale unavailable');
 let state=initialState({documentId:crypto.randomUUID(),locale,mission:{id:fixture.id,mechanicsVersion:fixture.mechanicsVersion,contentVersion:fixture.contentVersion,ready:false}}),router,helpTrigger=null;
 let storage;try{storage=sessionStorage;}catch{storage=null;}
 const audio=new AudioController({onChange:refreshAudio});
 function notice(message){const n=app.querySelector('.play-notice');if(n)n.textContent=message;}
 function refreshAudio(){const v=audio.snapshot();for(const n of app.querySelectorAll('[data-sound]')){n.querySelector('[data-sound-text]').textContent=v.preference?ui.soundOn:ui.soundOff;n.querySelector('svg')?.replaceWith(icon(v.preference?'volume-2':'volume-x'));n.setAttribute('aria-pressed',String(v.preference));}if(v.playback==='unavailable')notice(ui.soundUnavailable);else if(v.playback==='pending')notice(ui.soundPending);}
 function render(){const captured=state,send=(type,detail={},push=true)=>dispatch({type,...detail,revision:captured.revision,documentId:captured.documentId},push);
  app.replaceChildren(views[state.screen]({state,ui,cp,assetManifest,audio,send}));const p=document.createElement('p');p.className='play-notice';p.setAttribute('role','status');p.setAttribute('aria-live','polite');app.append(p);app.setAttribute('aria-busy','false');placeUtilities();app.querySelector('h1')?.focus({preventScroll:true});refreshAudio();
 }
 function placeUtilities(){const section=app.querySelector('[data-view=entry]'),support=section?.querySelector('.entry-support');if(!support)return;const compact=innerWidth<24.375*parseFloat(getComputedStyle(document.documentElement).fontSize);(compact?section.querySelector('h1'):section.querySelector('.setup')).before(support);}
 function dispatch(e,push=true){
  if(!contextMatches(state,e))return;
  if(e.type==='SOUND'){audio.toggle(null,contextKey(state));return;}
  if(e.type==='EXPLAIN'){app.querySelector('#first-step')?.focus();app.querySelector('#first-step')?.scrollIntoView({block:'start'});audio.replay(null,contextKey(state));return;}
  if(e.type==='ACCESS'||e.type==='ASK'){notice(e.type==='ACCESS'?ui.accessText:ui.askText);return;}
  if(e.type==='RETRY_ASSETS'){void retryAssets();return;}
  if(state.report&&['LEAVE','REPLAY','START'].includes(e.type)&&!e.discardConfirmed){if(document.querySelector('dialog'))return;dialog({title:ui.discardTitle,body:ui.discardBody,cancelLabel:ui.cancel,confirmLabel:ui.discard,onConfirm:()=>dispatch({...e,discardConfirmed:true},push)});return;}
  if(e.type==='HELP')helpTrigger={screen:state.screen,label:e.trigger||document.activeElement?.textContent};
  const next=transition(state,{...e,id:e.id||crypto.randomUUID()});if(next===state)return;
  audio.cancel({off:e.type==='GUEST'});state=next;const stored=writeResume(storage,state);render();if(!stored)notice(ui.storageUnavailable);
  if(e.type==='RETURN'&&helpTrigger?.screen===state.screen){[...app.querySelectorAll('button')].find(b=>b.textContent===helpTrigger.label)?.focus();helpTrigger=null;}
  if(push)router?.write();
 }
 async function assetsReady(){const critical=assetManifest.assets.filter(a=>!a.path.endsWith('product-still-v1.webp'));const values=await Promise.all(critical.map(a=>new Promise(resolve=>{const img=new Image();img.onload=()=>resolve(img.naturalWidth===a.width&&img.naturalHeight===a.height);img.onerror=()=>resolve(false);img.src=new URL('../'+a.path,import.meta.url);})));return values.length===3&&values.every(Boolean);}
 async function retryAssets(){if(state.loadingAssets)return;state={...state,loadingAssets:true};refreshReadiness();const ready=await assetsReady();state={...state,loadingAssets:false,mission:{...state.mission,ready}};refreshReadiness();}
 function refreshReadiness(){for(const n of app.querySelectorAll('[data-needs-ready]'))n.disabled=!state.mission.ready;for(const n of app.querySelectorAll('[data-readiness]')){if(state.mission.ready)n.remove();else{n.querySelector('p').textContent=state.loadingAssets?ui.criticalLoading:ui.criticalMissing;n.querySelector('button').hidden=state.loadingAssets;}}}
 state={...state,loadingAssets:true};
 const resume=readResume(storage,state.mission);
 router=installRouter(()=>state,(type,d={},push=true)=>dispatch({type,...d,revision:state.revision,documentId:state.documentId},push));
 const sendCurrent=type=>dispatch({type,revision:state.revision,documentId:state.documentId},false);
 function interrupt(){audio.cancel();sendCurrent('INTERRUPT');}
 document.addEventListener('visibilitychange',()=>{if(document.hidden)interrupt();});addEventListener('pagehide',interrupt);addEventListener('resize',placeUtilities);
 if(resume.kind==='known')dispatch({type:'RESTORE',round:resume.round,revision:state.revision,documentId:state.documentId},false);
 else if(resume.kind==='unknown'||router.unknown)sendCurrent('UNKNOWN');else render();
 state={...state,loadingAssets:false};void retryAssets();
}
boot().catch(()=>{const app=document.querySelector('#app');app.setAttribute('aria-busy','false');const h=document.createElement('h1'),p=document.createElement('p');h.textContent='JUMVI';h.tabIndex=-1;p.setAttribute('role','status');p.textContent=document.documentElement.lang==='tr'?'Görev içeriği yüklenemedi. Bağlantını kontrol edip sayfayı yeniden açabilirsin.':'Mission content could not load. Check your connection and reopen this page.';app.replaceChildren(h,p);h.focus();});

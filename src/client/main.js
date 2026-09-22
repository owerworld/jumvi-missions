import {initialState,transition} from './state/app.js';import {views} from './views/index.js';import {routeLocale,installRouter} from './router.js';
async function boot(){
const app=document.querySelector('#app'),locale=routeLocale(location.pathname);
let state=initialState({documentId:crypto.randomUUID(),locale:locale||'en-US'}),router;
const ui=await fetch(new URL(`../content/ui/${state.locale}.json`,import.meta.url)).then(r=>{if(!r.ok)throw Error('Content unavailable');return r.json();});
function render() {
 const captured=state;const send=(type,detail={},push=true)=>dispatch({type,...detail,revision:captured.revision,documentId:captured.documentId},push);
 app.replaceChildren(views[state.screen]({state,ui,send}));app.setAttribute('aria-busy','false');app.querySelector('h1')?.focus({preventScroll:true});
}
function dispatch(event,push=true) {const next=transition(state,event);if(next===state)return;state=next;render();if(push)router?.write();}
router=installRouter(()=>state,(type,d={},push=true)=>dispatch({type,...d,revision:state.revision,documentId:state.documentId},push));
addEventListener('visibilitychange',()=>{if(document.hidden)dispatch({type:'INTERRUPT',revision:state.revision,documentId:state.documentId},false);});
if(router.unknown)dispatch({type:'UNKNOWN',revision:state.revision,documentId:state.documentId},false);else render();

}
boot().catch(()=>{const app=document.querySelector("#app");app.setAttribute("aria-busy","false");const h=document.createElement("h1"),p=document.createElement("p");h.textContent="JUMVI";h.tabIndex=-1;p.setAttribute("role","status");p.textContent=document.documentElement.lang==="tr"?"Görev içeriği yüklenemedi. Bağlantını kontrol edip sayfayı yeniden açabilirsin.":"Mission content could not load. Check your connection and reopen this page.";app.replaceChildren(h,p);h.focus();});

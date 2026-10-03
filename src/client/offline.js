import {BASE,releaseId} from './deployment.js';
const release=releaseId;let registration,setup;
// On a first install register() can return while the worker is still installing.
// Wait for a usable worker, but never force an update over an open game.
function installed(reg){
 if(!reg.installing&&(reg.active||reg.waiting))return Promise.resolve();
 return new Promise(resolve=>{
  const workers=new Set();let timer;
  const finish=()=>{clearTimeout(timer);reg.removeEventListener('updatefound',watch);for(const w of workers)w.removeEventListener('statechange',check);resolve();};
  const check=()=>{if([...workers].some(w=>['installed','activated','redundant'].includes(w.state))||(!reg.installing&&(reg.active||reg.waiting)))finish();};
  const watch=()=>{if(reg.installing){workers.add(reg.installing);reg.installing.addEventListener('statechange',check);}check();};
  timer=setTimeout(finish,30000);reg.addEventListener('updatefound',watch);watch();
 });
}
export function setupOffline(){
 if(!('serviceWorker'in navigator))return Promise.resolve();
 return setup??=(async()=>{try{registration=await navigator.serviceWorker.register(BASE+'service-worker.js',{scope:BASE,updateViaCache:'none'});await installed(registration);}catch{/* Online play remains usable; no offline claim. */}})();
}
export async function prepareOffline(id){
 if(!registration)return false;
 await installed(registration);
 const workers=[...new Set([registration.waiting,registration.active].filter(Boolean))];
 if(!workers.length)return false;
 return new Promise(resolve=>{
  const ports=[],timer=setTimeout(()=>finish(false),9000);
  const finish=ready=>{clearTimeout(timer);for(const port of ports)port.close();resolve(ready);};
  for(const worker of workers){const channel=new MessageChannel();ports.push(channel.port1);channel.port1.onmessage=e=>{if(e.data?.release===release&&e.data?.id===id)finish(e.data.ready===true);};try{worker.postMessage({type:'CACHE_MISSION',release,id},[channel.port2]);}catch{channel.port1.close();}}
 });
}

import {storageName} from './deployment.js';
const key=storageName('appearance.v1'),choices=['system','light','dark'];
const system=matchMedia('(prefers-color-scheme: dark)');
let preference='system';
try{const saved=localStorage.getItem(key);if(choices.includes(saved))preference=saved;}catch{}
export const appearance=()=>preference;
function apply(){
 const dark=preference==='dark'||(preference==='system'&&system.matches);
 document.documentElement.dataset.theme=dark?'dark':'light';
 document.documentElement.style.colorScheme=dark?'dark':'light';
 document.querySelector('meta[name="theme-color"]')?.setAttribute('content',dark?'#101C28':'#FAFAF5');
 const select=document.getElementById('appearance');if(select)select.value=preference;
}
export function setAppearance(value){
 if(!choices.includes(value))return;
 preference=value;try{if(value==='system')localStorage.removeItem(key);else localStorage.setItem(key,value);}catch{}
 apply();
}
system.addEventListener('change',apply);
addEventListener('storage',event=>{if(event.key===key||event.key===null){preference=choices.includes(event.newValue)?event.newValue:'system';apply();}});
apply();

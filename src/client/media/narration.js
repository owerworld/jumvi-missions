import {narrationManifest} from './narration-manifest.js';
import {contextKey} from '../context.js';
export const audioContext=state=>contextKey(state)+':'+state.screen;
export async function presentationMatches(presentation){try{const bytes=new TextEncoder().encode(JSON.stringify(presentation)),hash=await crypto.subtle.digest('SHA-256',bytes);return [...new Uint8Array(hash)].map(n=>n.toString(16).padStart(2,'0')).join('')===narrationManifest.presentationFingerprint;}catch{return false;}}
export function narrationSource(state,catalog,presentationValid){
 if(!presentationValid||state.locale!==narrationManifest.locale)return null;
 const kind=['entry','help'].includes(state.screen)?'full':state.screen==='active'?'active':null;
 const mission=narrationManifest.missions[state.mission?.id],source=catalog.missions.find(m=>m.id===state.mission?.id);
 if(!kind||!mission||!source||source.sha256!==mission.sourceSHA256||state.mission.mechanicsVersion!==mission.mechanicsVersion)return null;
 const asset=mission[kind];if(!asset)return null;
 return {url:new URL('../../'+asset.path,import.meta.url).href,context:audioContext(state)};
}

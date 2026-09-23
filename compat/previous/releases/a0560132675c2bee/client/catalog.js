export function missionCopy(record,locale,labels){
 const c=record.locale[locale];if(!c)throw Error('Missing mission locale');
 const isFixture=!!c.mission,steps=c.steps||(isFixture?[c.toss,c.catch]:[]);
 return {...labels,...c,mission:c.title||c.mission,indoor:c.indoor||'',materials:c.materials||(locale==='tr'?`${record.players} oyuncu · ${record.equipment.paddles} paddle · ${record.equipment.balls} top`:`${record.players} players · ${record.equipment.paddles} paddles · ${record.equipment.balls} ball`),setup:c.setup||'',toss:steps[0]||'',catch:steps.slice(1).join(' '),safe:c.safety||c.safe||'',activeCopy:steps[0]||c.activeCopy,activeCatch:locale==='tr'?'Mavi ön yüzle yakala.':'Catch on the blue front.',canonicalSteps:steps,frames:record.art.frames,stepsTitle:c.stepsTitle||(locale==='tr'?'Nasıl oynanır':'How to play')};
}
export const criticalPaths=record=>record.art.frames.flatMap(f=>[...f.images,...(f.detail?[f.detail]:[])]);
export async function verifyAsset(bytes,asset){return bytes.byteLength===asset.bytes&&[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('')===asset.sha256;}

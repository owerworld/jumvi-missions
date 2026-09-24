export function equipmentText(record,locale){
 const tr=locale==='tr',option=value=>Array.isArray(value)?value.join(tr?' veya ':' or '):String(value);
 return tr?`${record.players} oyuncu · ${option(record.equipment.paddles)} paddle · ${option(record.equipment.balls)} top`:`${record.players} players · ${option(record.equipment.paddles)} paddles · ${option(record.equipment.balls)} ball`;
}
export function missionCopy(record,locale,labels,presentation){
 const c=record.locale[locale];if(!c)throw Error('Missing mission locale');
 const isFixture=!!c.mission,steps=c.steps||(isFixture?[c.toss,c.catch]:[]),pilot=presentation?.missions?.[record.id];
 return {...labels,...c,mission:c.title||c.mission,indoor:c.indoor||'',materials:c.materials||equipmentText(record,locale),setup:c.setup||'',entrySetup:pilot?.entrySetup?.[locale]??c.setup??'',entryCopy:pilot?.entryCopy?.[locale],toss:steps[0]||'',catch:steps.slice(1).join(' '),safe:c.safety||c.safe||'',activeCopy:pilot?.activeCopy?.[locale]||c.activeCopy||steps[0],activeCatch:c.activeCatch||(locale==='tr'?'Mavi ön yüzle yakala.':'Catch on the blue front.'),canonicalSteps:steps,frames:pilot?.frames||record.art.frames,hero:pilot?.hero,activeArt:pilot?.active,stepsTitle:c.stepsTitle||(locale==='tr'?'Nasıl oynanır':'How to play')};
}
export const framePaths=f=>[...(f.images||[]),...(f.detail?[f.detail]:[]),...(f.groups||[]).flatMap(g=>g.members.map(m=>m.path))];
export const criticalPaths=(record,presentation)=>{const pilot=presentation?.missions?.[record.id];return [...new Set((pilot?[pilot.hero,pilot.active,...pilot.frames]:record.art.frames).flatMap(framePaths))];};
export async function verifyAsset(bytes,asset){return bytes.byteLength===asset.bytes&&[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('')===asset.sha256;}

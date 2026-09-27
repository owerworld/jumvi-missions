import {playerContext} from '../components/player-context.js';
import {historySummary} from '../repository/history-summary.js';
import {equipmentText} from '../catalog.js';
import {el,heading} from '../components/dom.js';import {button} from '../components/button.js';
// Transient catalogue controls only: no player identity, telemetry or persistence.
const filters=new Map();
export function supportsPlayers(value,count){const digits=String(value).match(/\d+/g)?.map(Number)||[];return !count|| (String(value).includes('+')?count>=digits[0]:digits.length>1?count>=digits[0]&&count<=digits[1]:count===digits[0]);}
export default function view({ui,state,send,cp,presentation,assetManifest,personal,catalog={missions:[]}}){
 const tr=state.locale==='tr',s=el('section');s.dataset.view='discovery';s.classList.add('customer-layout');
 const header=el('header',undefined,'customer-header'),logo=el('img');logo.src=new URL('../../assets/mission-illustrations/m25/jumvi-logo.webp',import.meta.url);logo.alt='JUMVI';logo.width=80;logo.height=80;logo.className='brand';header.append(logo,el('span',tr?'OYNA · HAREKET ET':'PLAY · MOVE','customer-eyebrow'));s.append(header);
 s.append(button(ui.back,()=>send('BACK'),{kind:'link'}),heading(ui.titles.discovery),el('p',tr?'Birlikte oynayacağınız görevi seç.':'Pick a game to play together.'));
 const selected=catalog.missions.find(m=>m.id===state.mission.id),featuredPath=presentation?.missions?.[selected?.id]?.hero?.images?.[0];
 if(selected&&featuredPath){const card=el('article',undefined,'featured-mission'),copy=el('div',undefined,'featured-copy');copy.append(el('p',tr?'OYUNA DEVAM':'KEEP PLAYING','customer-eyebrow'),el('h2',selected.titles[state.locale]),el('p',equipmentText(selected,state.locale)),button(tr?'Bu görevle oyna':'Play this mission',()=>send('SELECT_MISSION',{missionId:selected.id}),{kind:'primary'}));const image=el('img');image.src=new URL('../../'+featuredPath,import.meta.url);image.alt='';const metadata=assetManifest?.assets.find(x=>x.path===featuredPath);if(metadata){image.width=metadata.width;image.height=metadata.height;}card.append(copy,image);s.append(card);}
 s.append(playerContext({state,personal,send,ui,catalog},{progress:true}));
 const actor=personal?.snapshot?.players.find(p=>p.id===personal.actorId),completed=actor?historySummary(personal.snapshot.records,actor.id,catalog.missions.map(m=>m.id)).byMission:new Map();
 const current=filters.get(state.locale)||{players:0},form=el('div',undefined,'mission-filters');
 const playerLabel=el('label',tr?'Kaç oyuncu var?':'How many players?'),players=el('select');players.id='mission-player-filter';playerLabel.htmlFor=players.id;
 for(const n of [0,2,3,4]){const option=el('option',n?`${n} ${tr?'oyuncu':'players'}`:tr?'Tüm oyuncu sayıları':'Any player count');option.value=String(n);players.append(option);}players.value=String(current.players);
 const count=el('p',undefined,'muted');count.setAttribute('role','status');count.setAttribute('aria-live','polite');
 const list=el('ul',undefined,'mission-list'),rows=[];
 for(const m of catalog.missions){const li=el('li');const path=presentation?.missions?.[m.id]?.hero?.images?.[0];if(path){const image=el('img');image.src=new URL('../../'+path,import.meta.url);image.alt='';image.loading='lazy';const metadata=assetManifest?.assets.find(x=>x.path===path);if(metadata){image.width=metadata.width;image.height=metadata.height;}image.className='mission-thumbnail';li.append(image);}const body=el('div',undefined,'mission-card-body');body.append(el('h2',m.titles[state.locale]));if(completed.has(m.id)){const badge=el('p',tr?'✓ Tamamlandı':'✓ Completed','mission-completed');badge.setAttribute('aria-label',tr?`${actor.nickname||actor.label}: tamamlandı olarak kaydedildi`:`${actor.nickname||actor.label}: saved as completed`);body.append(badge);}body.append(el('p',equipmentText(m,state.locale)),button(completed.has(m.id)?tr?'Tekrar oyna':'Play again':tr?'Görevi aç':'Open mission',()=>send('SELECT_MISSION',{missionId:m.id})));li.append(body);li.querySelector('button').setAttribute('aria-label',`${tr?'Görevi aç':'Open mission'}: ${m.titles[state.locale]}`);li.dataset.missionId=m.id;list.append(li);rows.push({li,m});}
 const update=()=>{const n=Number(players.value);let found=0;for(const {li,m} of rows){li.hidden=!(supportsPlayers(m.players,n));if(!li.hidden)found++;}filters.set(state.locale,{players:n});count.textContent=found?tr?`${found} görev gösteriliyor`:`${found} missions shown`:tr?'Bu oyuncu sayısı için görev bulunamadı.':'No missions for this player count.';};
 players.addEventListener('change',update);
 form.append(playerLabel,players,button(tr?'Filtreleri temizle':'Clear filters',()=>{players.value='0';update();players.focus();},{kind:'link'}));s.append(form,count,list,button(ui.back,()=>send('BACK'),{kind:'link'}));update();return s;
}

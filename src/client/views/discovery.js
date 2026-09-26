import {equipmentText} from '../catalog.js';
import {el,heading} from '../components/dom.js';import {button} from '../components/button.js';
// Transient catalogue controls only: no player identity, telemetry or persistence.
const filters=new Map();
export function supportsPlayers(value,count){const digits=String(value).match(/\d+/g)?.map(Number)||[];return !count|| (String(value).includes('+')?count>=digits[0]:digits.length>1?count>=digits[0]&&count<=digits[1]:count===digits[0]);}
export default function view({ui,state,send,presentation,assetManifest,catalog={missions:[]}}){
 const tr=state.locale==='tr',s=el('section');s.dataset.view='discovery';s.classList.add('customer-layout');
 s.append(button(ui.back,()=>send('BACK'),{kind:'link'}),heading(ui.titles.discovery),el('p',tr?'Görev adına veya oyuncu sayısına göre uygun oyunu bul.':'Find a suitable game by mission name or player count.'));
 const current=filters.get(state.locale)||{query:'',players:0},form=el('div',undefined,'mission-filters');
 const label=el('label',tr?'Görev ara':'Search missions'),search=el('input');search.id='mission-search';search.type='search';search.value=current.query;label.htmlFor=search.id;
 const playerLabel=el('label',tr?'Kaç oyuncu var?':'How many players?'),players=el('select');players.id='mission-player-filter';playerLabel.htmlFor=players.id;
 for(const n of [0,2,3,4]){const option=el('option',n?`${n} ${tr?'oyuncu':'players'}`:tr?'Tüm oyuncu sayıları':'Any player count');option.value=String(n);players.append(option);}players.value=String(current.players);
 const count=el('p',undefined,'muted');count.setAttribute('role','status');count.setAttribute('aria-live','polite');
 const list=el('ul',undefined,'mission-list'),rows=[];
 for(const m of catalog.missions){const li=el('li');const path=presentation?.missions?.[m.id]?.hero?.images?.[0];if(path){const image=el('img');image.src=new URL('../../'+path,import.meta.url);image.alt='';image.loading='lazy';const metadata=assetManifest?.assets.find(x=>x.path===path);if(metadata){image.width=metadata.width;image.height=metadata.height;}image.className='mission-thumbnail';li.append(image);}const body=el('div',undefined,'mission-card-body');body.append(el('h2',m.titles[state.locale]),el('p',equipmentText(m,state.locale)),button(tr?'Görevi aç':'Open mission',()=>send('SELECT_MISSION',{missionId:m.id})));li.append(body);li.querySelector('button').setAttribute('aria-label',`${tr?'Görevi aç':'Open mission'}: ${m.titles[state.locale]}`);li.dataset.missionId=m.id;list.append(li);rows.push({li,m});}
 const update=()=>{const query=search.value.trim().toLocaleLowerCase(state.locale==='tr'?'tr':'en-US'),n=Number(players.value);let found=0;for(const {li,m} of rows){li.hidden=!(m.titles[state.locale].toLocaleLowerCase(state.locale==='tr'?'tr':'en-US').includes(query)&&supportsPlayers(m.players,n));if(!li.hidden)found++;}filters.set(state.locale,{query:search.value,players:n});count.textContent=found?tr?`${found} görev gösteriliyor`:`${found} missions shown`:tr?'Uygun görev bulunamadı. Aramayı veya oyuncu sayısını değiştir.':'No matching missions. Change the search or player count.';};
 search.addEventListener('input',update);players.addEventListener('change',update);
 form.append(label,search,playerLabel,players,button(tr?'Filtreleri temizle':'Clear filters',()=>{search.value='';players.value='0';update();search.focus();},{kind:'link'}));s.append(form,count,list,button(ui.back,()=>send('BACK'),{kind:'link'}));update();return s;
}

import {el} from './dom.js';
import {button} from './button.js';
import {icon} from './icons.js';
export function contextNavigation({state,ui,cp,send,navigation}, {missionShortcut=true}={}) {
 const tr=state.locale==='tr',nav=el('nav',undefined,'context-nav');nav.setAttribute('aria-label',tr?'Sayfa gezinmesi':'Page navigation');
 const parent=navigation?.parent,screen=parent?.screen;
 const label=screen==='returning'?(tr?'Oyun seçeneklerine dön':'Back to play options'):screen==='group'?(tr?'Birlikte oyuna dön':'Back to group play'):screen==='guest'?(tr?'Misafir oyununa dön':'Back to guest play'):screen==='new-player'?(tr?'Yeni oyuncuya dön':'Back to new player'):screen==='record-result'?(tr?'Kayda dön':'Back to record'):!parent&&state.report?(tr?'Bildirime dön':'Back to my report'):!parent&&state.round?(tr?'Turuna dön':'Back to your round'):screen==='discovery'?(tr?'Görevlere dön':'Back to missions'):screen==='management'?(tr?'Oyunculara dön':'Back to players'):screen==='adult'?(tr?'Yetişkinlere dön':'Back to grown-ups'):screen==='help'?(tr?'Yardıma dön':'Back to help'):ui.back;
 const back=button(label,()=>send(parent?'BACK':'RETURN_TO_PLAY'),{kind:'link'});back.classList.add('context-back');back.prepend(icon('arrow-left'));nav.append(back);
 if(missionShortcut&&screen&&screen!=='entry'){const mission=button(tr?'Göreve dön':'Back to the mission',()=>send('MISSION_HOME'),{kind:'link'});mission.classList.add('context-mission');nav.append(mission);}
 return nav;
}

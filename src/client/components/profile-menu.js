import {el} from './dom.js';
import {button} from './button.js';
import {playerContext} from './player-context.js';

// A local-player disclosure, not an account or a prerequisite for play.
export function profileMenu(ctx,{tools=[],report=false}={}) {
 const {state,personal,send,ui,cp}=ctx,tr=state.locale==='tr';
 const actor=personal?.snapshot?.players.find(p=>p.id===personal.actorId);
 const menu=el('details',undefined,'entry-menu profile-menu'),summary=el('summary');
 menu.dataset.entryMission=state.mission.id;summary.id='profile-menu-toggle';
 const avatar=el('span',actor?Array.from(actor.nickname||actor.label)[0].toLocaleUpperCase(state.locale):'J','profile-avatar');avatar.setAttribute('aria-hidden','true');
 const name=el('span',actor?.nickname||actor?.label||(tr?'Menü':'Menu'),'profile-name'),chevron=el('span','⌄','profile-chevron');chevron.setAttribute('aria-hidden','true');
 summary.append(avatar,name,chevron);menu.append(summary);
 const panel=el('div',undefined,'profile-panel');
 panel.append(el('p',tr?'Birlikte daha çok oyun':'More ways to play','profile-title'));
 panel.append(playerContext(ctx));
 const nav=el('nav',undefined,'profile-links');nav.setAttribute('aria-label',tr?'Oyuncu ve aile seçenekleri':'Player and family options');
 const item=(label,type,detail,mark,tone)=>{const node=button(label,e=>send(type,{...detail,trigger:e.currentTarget.textContent}),{kind:'link'}),badge=el('span',mark,`profile-link-badge ${tone}`);badge.setAttribute('aria-hidden','true');node.prepend(badge);nav.append(node);};
 item(cp.players,'GO',{screen:'management'},'☺','lime');
 item(ui.titles.returning,'GO',{screen:'returning'},'★','blue');
 item(cp.adult,'GO',{screen:'adult'},'♡','orange');
 if(report)item(cp.report,'REPORT_OPEN',{},'✓','blue');
 panel.append(nav);
 if(tools.length){const utilities=el('div',undefined,'customer-tools');utilities.append(...tools);panel.append(utilities);}
 menu.append(panel);
 menu.addEventListener('keydown',e=>{if(e.key==='Escape'&&menu.open){e.preventDefault();e.stopPropagation();menu.open=false;summary.focus({preventScroll:true});}});
 return menu;
}

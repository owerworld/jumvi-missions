import {icon} from '../components/icons.js';
import {el,heading} from '../components/dom.js';import {button} from '../components/button.js';
const assetRoot=new URL('../../assets/mission-illustrations/m25/',import.meta.url);
export function playView(name,ctx) {
 const {state,ui,send,cp,audio,assetManifest}=ctx,s=el('section');s.dataset.view=name;
 const controls=()=>el('div',undefined,'controls conflicting');
 const b=(text,type,detail={},kind='secondary',active=false)=>{const n=button(text,e=>send(type,{...detail,trigger:e.currentTarget.textContent}),{kind,active});if(['START','REPLAY','RESUME','REPORT'].includes(type)){n.dataset.needsReady='';n.disabled=!state.mission.ready;}const iconName={HELP:'circle-question-mark',STOP:'square',RETURN:'arrow-left'}[type];if(iconName)n.prepend(icon(iconName));return n;};
 const label=()=>s.append(el('p',cp.mission,'muted mission-label'));
 const text=(v,cls)=>el('p',v,cls);
 const art=(file,alt,cls='mission-art')=>{const i=el('img');const entry=assetManifest.assets.find(a=>a.path.endsWith(file+'.webp'));i.src=new URL(file+'.webp',assetRoot);i.alt=alt;i.className=cls;if(entry){i.width=entry.width;i.height=entry.height;}return i;};
 const brand=()=>{const i=el('img');i.src=new URL('jumvi-logo.webp',assetRoot);i.alt='JUMVI';i.width=80;i.height=80;i.className='brand';s.append(i);};
 const support=()=>{const r=controls();r.classList.add('utilities');r.append(b(cp.help,'HELP',{},'link'),sound());return r;};
 const sound=()=>{const v=audio.snapshot();const n=button(v.preference?ui.soundOn:ui.soundOff,()=>send('SOUND'),{kind:'link'});const label=el('span',n.textContent);label.dataset.soundText='';n.replaceChildren(icon(v.preference?'volume-2':'volume-x'),label);n.dataset.sound='';n.setAttribute('aria-label',ui.soundLabel);n.setAttribute('aria-pressed',String(v.preference));return n;};
 const access=()=>b(cp.access,'ACCESS',{},'link');
 const ready=()=>{if(!state.mission.ready){const wrap=el('div');wrap.dataset.readiness='';const p=text(state.loadingAssets?ui.criticalLoading:ui.criticalMissing,'status');p.setAttribute('role','status');const retry=b(ui.retry,'RETRY_ASSETS');retry.hidden=!!state.loadingAssets;wrap.append(p,retry);s.append(wrap);}};
 const secondary=(report=false)=>{const r=el('nav',undefined,'secondary-access');r.setAttribute('aria-label',ui.titles.management);if(report)r.append(b(cp.report,'REPORT_OPEN',{},'link'));r.append(b(cp.players,'GO',{screen:'management'},'link'),b(cp.adult,'GO',{screen:'adult'},'link'),b(ui.titles.returning,'GO',{screen:'returning'},'link'));s.append(r);};
 const action=(txt,type,kind='secondary',active=false)=>b(txt,type,{},kind,active);
 if(name==='entry'){
  brand();const sup=support();sup.classList.add('entry-support');s.append(sup,heading(cp.mission),text(cp.goal,'instruction goal'),art('seated-editorial-v1',cp.step1body+' '+cp.toss+' '+cp.catch),text(cp.materials,'materials'),text(cp.indoor,'muted indoor'));
  s.append(text(cp.setup,'instruction setup'),text(cp.toss+' '+cp.catch,'instruction toss'),text(cp.safe,'safety'));ready();
  const row=controls(),start=action(cp.start,'START','primary');start.disabled=!state.mission.ready;start.dataset.start='';row.append(start,b(cp.another,'GO',{screen:'discovery'},'link'),b(cp.how,'HELP',{},'link'),access());s.append(row);secondary(true);
 }else if(name==='help'){
  brand();const hasRound=!!state.round,back=hasRound?cp.back:cp.backMission;
  s.append(b(back,'RETURN',{},'link',hasRound));label();s.append(heading(cp.stepsTitle),text(cp.setup,'instruction'));
  const list=el('ol',undefined,'steps');list.id='mission-steps';
  for(const [n,file] of [[1,'seated-editorial-v1'],[2,'contact-alpha-v1'],[3,'reset-alpha-v1']]){const li=el('li'),h=el('h2',cp['step'+n]);h.tabIndex=-1;if(n===1)h.id='first-step';li.append(h,art(file,cp['step'+n+'body']),text(cp['step'+n+'body'],'instruction'));list.append(li);}s.append(list,text(cp.goal,'instruction goal'),text(cp.safe,'safety'));ready();
  const row=controls();row.append(b(cp.againExplain,'EXPLAIN'),b(cp.ask,'ASK',{},'link'),b(back,'RETURN',{},'primary',hasRound));if(state.round?.state==='active')row.append(b(cp.stop,'STOP',{},'secondary',true));row.append(sound(),access());s.append(row);
 }else if(name==='active'){
  label();s.append(heading(cp.activeTitle),text(state.resumed?ui.resumed:cp.state,'muted'),text(cp.activeCopy,'instruction'));
  const contact=el('div',undefined,'active-contact');contact.append(art('contact-alpha-v1',cp.step2body,'contact-art'),text(cp.activeCatch,'instruction'));s.append(contact,text(cp.goal,'instruction goal'));
  const row=controls();row.append(b(cp.activeHelp,'HELP',{},'secondary',true),b(cp.stop,'STOP',{},'primary',true),sound(),access());s.append(row);
 }else if(name==='interrupted'){
  label();s.append(heading(ui.interrupted));const p=text(state.unknown||!state.round?ui.unknown:ui.resumeInfo,'status');s.append(p);const row=controls();if(state.round&&!state.unknown)row.append(action(ui.resume,'RESUME','primary'));const n=action(ui.newRound,'REPLAY');n.disabled=!state.mission.ready;row.append(n);if(state.round)row.append(action(ui.end,'END'));row.append(action(cp.leave,'LEAVE','link'),b(cp.how,'HELP'));s.append(row);ready();
 }else if(name==='stopped'){
  label();s.append(heading(state.reportMode?cp.report:ui.stopped));
  s.append(text(state.reportMode&&state.report?cp.edit:(state.reportMode&&!state.round?ui.preReport:ui.unreported)));const row=controls();
  if(state.round&&!state.reportMode)row.append(action(ui.resume,'RESUME','primary'));
  row.append(text(ui.optional,'muted'),b(ui.complete,'REPORT',{value:'complete'}),b(ui.early,'REPORT',{value:'early'}));s.append(row);const next=controls();next.classList.add('secondary-access');next.append(action(cp.again,'REPLAY'),b(cp.other,'GO',{screen:'discovery'}),action(cp.leave,'LEAVE','link'));s.append(next);
 }else if(name==='report'){
  brand();label();s.append(heading(cp.thanks),text(state.report?.value==='early'?ui.reportedEarly:cp.reported,'instruction'),art('product-still-v1','JUMVI','product-still'),text(ctx.isSaved?ui.savedReport:cp.notSaved));
  const row=controls();row.append(b(cp.edit,'EDIT_REPORT',{},'link'),action(cp.again,'REPLAY','primary'),b(cp.other,'GO',{screen:'discovery'}),action(cp.leave,'LEAVE','link'));s.append(row);const r=el('div',undefined,'secondary-access');r.append(b(cp.save,'GO',{screen:'attribution'},'link'),b(ui.guestTitle,'GO',{screen:'guest'},'link'));s.append(r);
 }
 return s;
}

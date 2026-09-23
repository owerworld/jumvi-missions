import {screens, contextMatches} from '../context.js';
import {createRound, changeRound} from './round.js';
import {explicitReport} from './report.js';
import {recordBoundary} from './record.js';
import {initialMedia, invalidateMedia} from './media.js';
export function initialState({documentId, locale='tr', mission=null}={}) {
 return {documentId,locale,mission,revision:0,screen:'entry',round:null,report:null,record:recordBoundary,media:initialMedia(),returnContext:null,unknown:false,reportMode:false,previous:null};
}
export function transition(s,e) {
 if (!contextMatches(s,e)) return s;
 let n=s;
 switch(e.type) {
 case 'SELECT':
  if(!e.mission || !/^m(?:0[1-9]|[12][0-9]|3[0-6])$/.test(e.mission.id) || ['active','help','interrupted'].includes(s.screen))return s;
  n={...s,mission:e.mission,screen:'entry',round:null,report:null,returnContext:null,unknown:false,reportMode:false,previous:null};break;
 case 'GO':
  if (!screens.includes(e.screen) || ['active','stopped','report'].includes(e.screen)) return s;
  n={...s,screen:e.screen,round:s.round?.state==='active'?changeRound(s.round,'interrupted'):s.round};break;
 case 'RESTORE':
  if(!e.round || !s.mission || e.round.missionId!==s.mission.id || e.round.mechanicsVersion!==s.mission.mechanicsVersion || !['stopped','interrupted'].includes(e.round.state))return s;
  n={...s,screen:'interrupted',round:e.round,unknown:false};break;
 case 'REPORT_OPEN': case 'EDIT_REPORT':
  if(!['entry','stopped','report'].includes(s.screen))return s;
  n={...s,screen:'stopped',reportMode:true};break;
 case 'END':
  if(s.screen!=='interrupted'||!s.round)return s;
  n={...s,screen:'stopped',round:changeRound(s.round,'stopped'),reportMode:false};break;
 case 'HELP': n={...s,screen:'help',returnContext:s.screen};break;
 case 'RETURN': {
  const screen=s.round && ['active','stopped','interrupted'].includes(s.round.state) ? s.round.state : (s.returnContext && screens.includes(s.returnContext)?s.returnContext:'entry');
  n={...s,screen,returnContext:null};break;
 }
 case 'START': case 'REPLAY':
  if (!s.mission?.ready || !e.id || (e.type==='START' && !['entry','returning','group'].includes(s.screen)) || (e.type==='REPLAY' && !['report','stopped','interrupted'].includes(s.screen))) return s;
  n={...s,screen:'active',resumed:false,round:createRound(e.id,s.mission),report:null,unknown:false,reportMode:false};break;
 case 'STOP':
  if (!s.round || !['active','help','recovery'].includes(s.screen) || s.round.state!=='active') return s;
  n={...s,screen:'stopped',round:changeRound(s.round,'stopped'),returnContext:null,reportMode:false};break;
 case 'RESUME':
  if (!s.round || !['stopped','interrupted'].includes(s.screen) || !['stopped','interrupted'].includes(s.round.state) || !s.mission?.ready || s.round.mechanicsVersion!==s.mission.mechanicsVersion || s.round.missionId!==s.mission.id || s.unknown) return s;
  n={...s,screen:'active',resumed:true,round:changeRound(s.round,'active')};break;
 case 'INTERRUPT':
  if (!s.round || s.round.state!=='active') return s;
  n={...s,screen:'interrupted',round:changeRound(s.round,'interrupted'),returnContext:null};break;
 case 'BACK':
  n={...s,screen:s.round?.state==='active'?'interrupted':'entry',round:s.round?.state==='active'?changeRound(s.round,'interrupted'):s.round,returnContext:null};break;
 case 'UNKNOWN': n={...s,screen:'interrupted',round:null,unknown:true,returnContext:null};break;
 case 'REPORT': {
  if (!s.mission?.ready || !e.id || !['entry','stopped','report'].includes(s.screen)) return s;
  const report=explicitReport(e.id,s.mission,s.round,e.value,s.report);
  if(!report) return s;
  n={...s,screen:'report',report,reportMode:false};break;
 }
 case 'REPORT_RETURN': n={...s,screen:s.report?'report':'entry'};break;
 case 'PREVIOUS':
  if(!s.previous)return s;
  n={...s,...s.previous,screen:s.previous.report?'report':s.previous.round?.state||'entry',previous:null,record:recordBoundary};break;
 case 'GUEST': n={...s,previous:s.round||s.report?{round:s.round?.state==='active'?changeRound(s.round,'interrupted'):s.round,report:s.report}:s.previous,screen:'entry',round:null,report:null,record:recordBoundary,returnContext:null,unknown:false};break;
 case 'LEAVE': n={...s,screen:'entry',round:null,report:null,returnContext:null,unknown:false};break;
 default: return s;
 }
 return {...n,revision:s.revision+1,media:invalidateMedia(s.media,e.type==='GUEST')};
}

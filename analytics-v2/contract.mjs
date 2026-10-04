export const EVENTS=Object.freeze(['app_open','mission_open','round_start','help_open','round_stop','round_resume','completion_reported']);
export function validEvent(x){
  return !!x && typeof x==='object' && !Array.isArray(x) &&
    Object.keys(x).sort().join(',')==='event,locale,mission,v' && x.v===1 && EVENTS.includes(x.event) &&
    ['en-US','tr'].includes(x.locale) && typeof x.mission==='string' &&
    (x.event==='app_open' ? x.mission==='none' : /^m(0[1-9]|[12][0-9]|3[0-6])$/.test(x.mission));
}
export function dayUTC(now=new Date()){return now.toISOString().slice(0,10);}
export function firstDay(days,now=new Date()){const d=new Date(now);d.setUTCDate(d.getUTCDate()-days+1);return dayUTC(d);}
export function summarize(rows,days,locale='all',now=new Date()){
  const start=firstDay(days,now),end=dayUTC(now),totals=Object.fromEntries(EVENTS.map(e=>[e,0])),missions={},daily={};
  for(let i=0;i<days;i++){const d=new Date(start+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+i);daily[dayUTC(d)]=0;}
  for(const r of rows){
    if(r.day<start||r.day>end||!EVENTS.includes(r.event)||(locale!=='all'&&r.locale!==locale))continue;
    totals[r.event]+=r.count;if(r.event==='app_open')daily[r.day]+=r.count;
    if(r.mission!=='none'){missions[r.mission]??=Object.fromEntries(EVENTS.map(e=>[e,0]));missions[r.mission][r.event]+=r.count;}
  }
  return {start,end,days,locale,totals,daily,missions};
}

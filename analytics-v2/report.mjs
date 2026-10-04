import {EVENTS, firstDay, dayUTC} from './contract.mjs';
export const DEFINITIONS={
 app_open:'Application initialization; reloads and repeat opens count again.',
 mission_open:'Mission entry opened initially or through explicit mission selection.',
 round_start:'Start control used; does not prove physical play.',
 help_open:'Help opened; not evidence of a usability failure.',
 round_stop:'Stop control used; not abandonment.',
 round_resume:'Stopped round resumed.',
 completion_reported:'User reported finished; not measured success or unique completed missions.'
};
export function evidenceReport(source,days,locale,mode,now=new Date()){
 const start=firstDay(days,now),end=dayUTC(now);
 const rows=source.filter(r=>r.day>=start&&r.day<=end&&(locale==='all'||r.locale===locale)&&EVENTS.includes(r.event)).map(r=>({day:r.day,locale:r.locale,mission:r.mission,event:r.event,count:r.count})).sort((a,b)=>a.day.localeCompare(b.day)||a.locale.localeCompare(b.locale)||a.mission.localeCompare(b.mission)||a.event.localeCompare(b.event));
 const totals=Object.fromEntries(EVENTS.map(e=>[e,0])),monthly=new Map();
 for(const r of rows){totals[r.event]+=r.count;const month=r.day.slice(0,7),key=[month,r.locale,r.event].join('|');if(!monthly.has(key))monthly.set(key,{month,locale:r.locale,event:r.event,count:0});monthly.get(key).count+=r.count;}
 return {schema:'jumvi-usage-evidence-v1',generatedAt:now.toISOString(),mode,synthetic:mode==='demo',scope:'JUMVI V2 only; Cloudflare connection country US; no verified buyer identity',period:{start,end,timezone:'UTC',locale},activeRetentionDays:90,collectionCoverage:'Not independently verified. Absent rows mean no recorded events, not proven zero traffic. Current UTC day is incomplete.',definitions:DEFINITIONS,limitations:['Not unique people, customers, sessions, retention, revenue, conversion or physical skill.','Reloads and repeats count again; offline, blocked requests and privacy opt-outs are omitted.','Country is approximate connection country; VPNs and bots can affect counts.','Monthly totals cover only this export date window; partial months are not full calendar months.','No pre-activation history or deleted daily rows can be reconstructed.','This export is not an independently audited financial statement.'],totals,monthlyWithinWindow:[...monthly.values()].sort((a,b)=>a.month.localeCompare(b.month)||a.locale.localeCompare(b.locale)||a.event.localeCompare(b.event)),rows};
}
const csvCell=v=>'"'+String(v).replaceAll('"','""')+'"';
export function reportCSV(report){
 const headings=['schema','mode','generated_at_utc','range_start_utc','range_end_utc','country_scope','day_utc','locale','mission','event','count'];
 const rows=report.rows.map(r=>[report.schema,report.mode,report.generatedAt,report.period.start,report.period.end,'US connection',r.day,r.locale,r.mission,r.event,r.count]);
 return '\uFEFF'+[headings,...rows].map(r=>r.map(csvCell).join(',')).join('\r\n')+'\r\n';
}

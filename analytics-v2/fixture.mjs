import {dayUTC} from './contract.mjs';
// Deterministic synthetic data, never customer records or a production export.
export function exampleRows(now=new Date()){
 const rows=[];
 for(let offset=0;offset<90;offset++){
  const date=new Date(now);date.setUTCDate(date.getUTCDate()-offset);const day=dayUTC(date);
  for(const locale of ['en-US','tr']){
   const scale=locale==='tr'?.07:1,opens=Math.round((40+(offset*17)%63)*scale);
   if(opens)rows.push({day,locale,mission:'none',event:'app_open',count:opens});
   for(let number=1;number<=36;number++){
    const mission='m'+String(number).padStart(2,'0'),count=Math.round(((number*7+offset*3)%13)*scale);
    if(!count)continue;
    for(const [event,factor] of Object.entries({mission_open:1,round_start:.66,help_open:.22,round_stop:.45,round_resume:.15,completion_reported:.31})){
     const n=Math.round(count*factor);if(n)rows.push({day,locale,mission,event,count:n});
    }
   }
  }
 }
 return rows;
}

// A count of explicit, committed local reports. It does not measure catches or skill.
export function historySummary(records,playerId,missionIds){
 const completed=records.filter(r=>r.targetId===playerId&&r.report?.value==='complete');
 const early=records.filter(r=>r.targetId===playerId&&r.report?.value==='early');
 const byMission=new Map();
 for(const record of completed){
  const id=record.report.missionId;
  byMission.set(id,(byMission.get(id)||0)+1);
 }
 const eligible=new Set(missionIds||[]);
 const certificateCount=[...byMission.keys()].filter(id=>eligible.has(id)).length;
 return {distinct:byMission.size,completed:completed.length,early:early.length,byMission,certificateCount,certificateTotal:eligible.size,certificateEligible:eligible.size===36&&certificateCount===eligible.size};
}

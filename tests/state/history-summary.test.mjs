import test from 'node:test';
import assert from 'node:assert/strict';
import {historySummary} from '../../src/client/repository/history-summary.js';

test('only committed records owned by this player determine reported progress',()=>{
 const rows=[
  {targetId:'a',report:{missionId:'m01',value:'complete'}},
  {targetId:'a',report:{missionId:'m01',value:'complete'}}, // a separate saved round
  {targetId:'a',report:{missionId:'m02',value:'complete'}},
  {targetId:'a',report:{missionId:'m03',value:'early'}},
  {targetId:'b',report:{missionId:'m04',value:'complete'}}
 ];
 const a=historySummary(rows,'a');
 assert.equal(a.distinct,2);
 assert.equal(a.completed,3);
 assert.equal(a.early,1);
 assert.equal(a.byMission.get('m01'),2);
 assert.equal(historySummary(rows,'b').distinct,1);
 assert.equal(historySummary(rows.filter(r=>r.targetId!=='a'),'a').completed,0);
});

test('certificate requires the same player to report all 36 canonical missions',()=>{
 const ids=Array.from({length:36},(_,n)=>`m${String(n+1).padStart(2,'0')}`);
 const rows=ids.slice(0,35).map(missionId=>({targetId:'a',report:{missionId,value:'complete'}}));
 rows.push({targetId:'a',report:{missionId:'made-up',value:'complete'}});
 rows.push({targetId:'b',report:{missionId:'m36',value:'complete'}});
 assert.equal(historySummary(rows,'a',ids).certificateEligible,false);
 assert.equal(historySummary(rows,'a',ids).certificateCount,35);
 rows.push({targetId:'a',report:{missionId:'m36',value:'early'}});
 assert.equal(historySummary(rows,'a',ids).certificateEligible,false);
 rows.push({targetId:'a',report:{missionId:'m36',value:'complete'}});
 assert.equal(historySummary(rows,'a',ids).certificateEligible,true);
 rows.push({targetId:'a',report:{missionId:'m36',value:'complete'}});
 assert.equal(historySummary(rows,'a',ids).certificateCount,36);
});

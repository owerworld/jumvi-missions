import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const root=new URL('../../',import.meta.url);
const presentation=JSON.parse(readFileSync(new URL('content/customer-presentation-v1.json',root)));

test('explicit illustrated help mappings preserve every canonical step in both languages',()=>{
 let mapped=0;
 for(const [id,p] of Object.entries(presentation.missions)){
  if(!p.frameStepMap)continue;
  mapped++;
  const canonical=JSON.parse(readFileSync(new URL(`content/missions/${id}.json`,root)));
  assert.equal(p.frameStepMap.length,p.frames.length,`${id} frame count`);
  for(const locale of ['tr','en-US']){
   const indices=p.frameStepMap.flat();
   assert.deepEqual(indices,canonical.locale[locale].steps.map((_,i)=>i),`${id} ${locale} step order`);
  }
 }
 assert.equal(mapped,23);
});

test('m03 toss and tap stay with first frame; sticky catch stays with second',()=>{
 const map=presentation.missions.m03.frameStepMap;
 assert.deepEqual(map,[[0,1],[2],[]]);
});

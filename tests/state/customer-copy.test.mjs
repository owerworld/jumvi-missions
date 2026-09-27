import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {missionCopy} from '../../src/client/catalog.js';
const read=p=>JSON.parse(readFileSync(new URL('../../'+p,import.meta.url))),presentation=read('content/customer-presentation-v1.json'),catalog=read('content/catalog.json'),fixture=read('content/missions/m25.json');
test('all 36 US family instruction overlays retain source quantities and paired TR sources',()=>{
 for(const {id} of catalog.missions){const source=read(`content/missions/${id}.json`),p=presentation.missions[id],copy=p.customerCopy?.['en-US'];assert.ok(copy?.steps?.length,id);assert.ok(copy.goal&&copy.safety,id);
  const c=source.locale['en-US'],original=[c.setup,...(c.steps||[c.toss,c.catch]),c.goal,c.safety||c.safe].filter(Boolean).join(' '),shown=[copy.setup||c.setup,...copy.steps,copy.goal,copy.safety].join(' ');
  const quantities=text=>text.replace(/\bonce\b/gi,'1').replace(/\b(one|two|three|four|five|six|seven|eight|nine|ten)\b/gi,w=>String(['one','two','three','four','five','six','seven','eight','nine','ten'].indexOf(w.toLowerCase())+1)).match(/\d+/g)||[];
  for(const n of new Set(quantities(original)))assert.ok(quantities(shown).includes(n),`${id}: quantity ${n}`);
  assert.deepEqual(missionCopy(source,'tr',fixture.locale.tr,presentation).canonicalSteps,source.locale.tr.steps||[source.locale.tr.toss,source.locale.tr.catch]);
 }
});
test('human closures retain reset exclusions, one-ball turns, transfer and paddle target',()=>{
 const copy=id=>JSON.stringify(presentation.missions[id].customerCopy['en-US']);
 assert.match(copy('m30'),/Returns need no call and do not count/);assert.match(copy('m30'),/own body/);assert.match(copy('m17'),/Return passes do not count/);assert.match(copy('m04'),/Pass the ball to the hand that is still wearing/);assert.match(copy('m23'),/Only one pair plays/);assert.match(copy('m24'),/Only one team plays/);assert.match(copy('m08'),/facing up/);assert.match(copy('m20'),/No running/);
});

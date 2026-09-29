import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const p=JSON.parse(readFileSync(new URL('../../content/customer-presentation-v1.json',import.meta.url)));
test('all 36 missions separate short bilingual Help headings from detailed image descriptions',()=>{
 assert.equal(Object.keys(p.missions).length,36);
 for(const [id,m] of Object.entries(p.missions))for(const f of m.frames)for(const locale of ['en-US','tr']){
  assert.ok(f.helpTitle?.[locale],`${id} ${locale}`);assert.ok(f.caption[locale]);assert.ok(f.helpTitle[locale].split(/\s+/).length<=9,`${id} heading depth`);
  if(f.helpBody)assert.ok(f.helpBody[locale]);
 }
});
test('short labels retain essential ball, free-hand and landing cues outside alt text',()=>{
 const text=(id,ix)=>p.missions[id].frames[ix].helpBody['en-US'];
 assert.match(text('m04',3),/hold.*ball/);assert.match(text('m07',2),/free hand/);
 assert.match(text('m25',0),/free hand/);assert.match(text('m35',2),/on the paddle until you land/);
 assert.match(p.missions.m30.frames[0].helpBody['en-US'],/own right/);
 assert.match(p.missions.m20.frames[2].note['en-US'],/dashed.*foot/);
});

import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const here=new URL('./',import.meta.url);
const read=f=>JSON.parse(fs.readFileSync(new URL(f,here)));
const sha=x=>createHash('sha256').update(x).digest('hex');
const canonicalJSON=v=>Array.isArray(v)?'['+v.map(canonicalJSON).join(', ')+']':v&&typeof v==='object'?'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+': '+canonicalJSON(v[k])).join(', ')+'}':JSON.stringify(v);
const catalogue=read('missions.json'),briefs=read('briefs.json').briefs,matrix=read('readiness-matrix.json'),records=catalogue.records;
assert.equal(records.length,36);
assert.deepEqual(records.map(r=>r.id),Array.from({length:36},(_,i)=>`m${String(i+1).padStart(2,'0')}`));
assert.equal(new Set(matrix.map(r=>r.id)).size,36);
const blocked=records.filter(r=>r.decisionGate);
assert.deepEqual(blocked.map(r=>r.id),['m04','m17','m27']);
for(const r of records){
 assert.equal(r.releaseEligible,false,'Review records must not imply publishable content');
 assert.equal(r.equipment.balls,1);
 const b=briefs.find(b=>b.id===r.id);assert.ok(b);assert.equal(b.mechanicsVersion,r.mechanicsVersion);
 assert.equal(b.recordSHA256,sha(canonicalJSON(r)));
 assert.equal(b.narration.recordSHA256,b.recordSHA256);
 assert.equal(b.narration.runtimeAsset,null);
 if(r.decisionGate){assert.equal(r.locale,null);assert.equal(r.mechanicsVersion,null);assert.equal(b.poseMechanicsBrief.status,'HOLD_HUMAN_DECISION');}
 else {assert.deepEqual(Object.keys(r.locale).sort(),['en-US','tr']);for(const loc of Object.values(r.locale))assert.ok((loc.title&&loc.steps.length&&loc.goal&&loc.safety)||(loc.mission&&loc.step1body&&loc.safe));}
 assert.equal(r.runtimeAudio.automaticCaller,false);assert.equal(r.runtimeAudio.automaticTimer,false);
}
const get=id=>records.find(r=>r.id===id);
for(const id of ['m02','m03','m12','m13','m20','m21','m23','m24'])assert.equal(get(id).status,'human-mechanics-approved');
assert.equal(get('m21').locale['en-US'].title,'Middle Defender');assert.equal(get('m21').locale.tr.title,'Ortadaki Savunmacı');
assert.equal(get('m23').pairCoverage.unorderedPairs,4*3/2);assert.equal(get('m23').pairCoverage.simultaneousPairs,1);
assert.equal(get('m24').teamPolicy.simultaneousTeams,1);assert.equal(get('m24').teamPolicy.sharedGoal,40);
const fixture=JSON.parse(fs.readFileSync(new URL('../../content/missions/m25.json',here)));
assert.deepEqual(get('m25').locale,fixture.locale);assert.equal(get('m25').provenance.fixtureSHA256,sha(fs.readFileSync(new URL('../../content/missions/m25.json',here))));
const literal=JSON.stringify(records.filter(r=>r.locale).map(r=>r.locale));
assert.ok(!/Captain Says|Kaptan Diyor|ALL 4 at once|as HIGH as you can|as high and SLOW as you can|paddlele|raket/.test(literal));
const release=JSON.parse(fs.readFileSync(new URL('../../dist/release-manifest.json',here)));
assert.equal(release.release,'ed077a06428a2cd8','Review work must leave the M3 runtime artifact unchanged');
assert.ok(release.files.every(f=>!f.path.includes('/catalog/')));
console.log(JSON.stringify({result:'PASS',records:36,approvedMechanics:8,blocked:blocked.map(r=>r.id),sourceCopyCandidates:24,exactFixture:1,briefs:briefs.length,release:release.release,reviewLayerPublished:false},null,2));

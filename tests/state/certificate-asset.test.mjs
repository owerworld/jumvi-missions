import test from 'node:test';import assert from 'node:assert/strict';import{readFileSync}from'node:fs';import{createHash}from'node:crypto';
const root=new URL('../../',import.meta.url),read=p=>readFileSync(new URL(p,root));
test('supplied English certificate bytes, size and optional PNG cache contract remain exact',()=>{
 const asset='assets/certificate/celebrate-play-en-US-v2.png',bytes=read(asset),provenance=JSON.parse(read('assets/certificate/celebrate-play-en-US-v2.provenance.json'));
 assert.equal(createHash('sha256').update(bytes).digest('hex'),provenance.sha256);assert.equal(bytes.readUInt32BE(16),1426);assert.equal(bytes.readUInt32BE(20),1103);
 for(const dir of ['dist','dist-v2/v2']){
  const embedded=read(`${dir}/service-worker.js`).toString().match(/^const MANIFEST=(.*);$/m);assert.ok(embedded);const manifest=JSON.parse(embedded[1]),record=manifest.files.find(f=>f.path.endsWith('/'+asset));assert.ok(record);assert.equal(record.mime,'image/png');assert.equal(record.sha256,provenance.sha256);assert.equal(record.bytes,bytes.length);assert.ok(!manifest.precache.includes(record.path));for(const paths of Object.values(manifest.missions))assert.ok(!paths.includes(record.path));
 }
});

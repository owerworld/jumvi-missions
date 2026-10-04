import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync,readdirSync} from 'node:fs';import {createHash} from 'node:crypto';
const read=p=>readFileSync(p),json=p=>JSON.parse(read(p)),hash=b=>createHash('sha256').update(b).digest('hex');
const walk=p=>readdirSync(p,{withFileTypes:true}).flatMap(d=>d.isDirectory()?walk(p+'/'+d.name):[p+'/'+d.name]);
test('all shipped mission artwork uses verified watermarked delivery copies; accepted originals remain intact',()=>{
 const m=json('artifacts/art-protection-v2/manifest.json'),expected=new Set(json('artifacts/art-protection-v2/allowlist.json'));assert.equal(m.version,2);assert.deepEqual(new Set(m.assets.map(a=>a.path)),expected);
 for(const dir of ['dist','dist-v2/v2']){const release=json(dir+'/release-manifest.json'),base=dir+'/releases/'+release.release,delivery=json(base+'/content/asset-manifest.json');
 for(const a of m.assets){assert.equal(hash(read(a.path)),a.sourceSHA256);assert.equal(a.hidden.alphaExact,true);assert.equal(a.hidden.dimensionsExact,true);assert.ok(a.hidden.maxRGBDelta<=4);assert.ok(a.hidden.psnrDB>=42);const bytes=read(base+'/'+a.path);assert.equal(hash(bytes),a.sha256);assert.notEqual(a.sha256,a.sourceSHA256);assert.ok(bytes.includes(Buffer.from('JUMVI branded mission artwork')));assert.ok(a.bytes<25*1024*1024);const declared=delivery.assets.find(x=>x.path===a.path);if(declared){assert.equal(declared.sha256,a.sha256);assert.equal(declared.bytes,bytes.length);assert.equal(declared.width,a.width);assert.equal(declared.height,a.height);}}
 assert.equal(walk(base).some(p=>/ownership\.key|robustness\.json|art_hidden_mark|verify-art-mark/.test(p)),false);
 assert.equal(walk(base+'/assets/mission-illustrations').length,m.assets.length+m.exempt.length);
 for(const p of m.exempt)assert.equal(hash(read(base+'/'+p)),hash(read(p)));
 }
});

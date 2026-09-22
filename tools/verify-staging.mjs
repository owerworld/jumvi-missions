import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const origin='https://jumvi-missions-staging.saykirtasiye.workers.dev';
const local=JSON.parse(readFileSync('dist/release-manifest.json'));
const remote=await fetch(origin+'/release-manifest.json').then(r=>r.json());
assert.deepEqual(remote,local,'Staging must serve the exact reviewed artifact');
for(const path of ['/','/index.html','/tr','/tr/','/tr/index.html']){
 const r=await fetch(origin+path,{redirect:'manual'});
 assert.equal(r.status,200,path);assert.equal(r.headers.get('location'),null,path);
 assert.equal(r.headers.get('x-jumvi-analytics'),'disabled',path);
 assert.match(r.headers.get('content-type'),/text\/html/,path);
 assert((await r.text()).includes(`lang="${path.startsWith('/tr')?'tr':'en-US'}"`),path);
}
for(const path of ['/panel','/analiz','/data/synthetic.json','/src/worker.js']){
 const r=await fetch(origin+path,{redirect:'manual'});assert.equal(r.status,404,path);
}
console.log(`Live staging routes and exact artifact ${local.release}: PASS`);

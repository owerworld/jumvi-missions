import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const origin='https://jumvi-missions-staging.saykirtasiye.workers.dev';
const local=JSON.parse(readFileSync('dist/release-manifest.json'));
async function verify(){
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
}
// Publication acknowledgement can precede propagation to the checking edge.
// Recheck every assertion; never turn a persistent mismatch into success.
for(let attempt=1;attempt<=5;attempt++){
 try{await verify();console.log(`Live staging routes and exact artifact ${local.release}: PASS (attempt ${attempt})`);break;}
 catch(error){if(attempt===5)throw error;console.log(`Staging not yet verified (attempt ${attempt}); rechecking in 10 seconds.`);await new Promise(resolve=>setTimeout(resolve,10000));}
}

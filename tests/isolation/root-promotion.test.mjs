import test from 'node:test';import assert from 'node:assert/strict';import {handle} from '../../src/root-promotion-worker.mjs';
const env={ASSETS:{fetch:async r=>new Response(new URL(r.url).pathname,{headers:{'Content-Type':'text/html'}})}};
test('root promotion exact entry aliases and V1 preserve language; no redirects to V2',async()=>{
 for(const [p,want] of [['/','/index.html'],['/tr/','/tr/index.html'],['/v1/','/v1/index.html'],['/v1/tr','/v1/tr/index.html']]){const r=await handle(new Request('https://qr.jumvi.co'+p),env);assert.equal(r.status,200);assert.equal(await r.text(),want);assert.equal(r.headers.get('Vary'),'*');}
 const r=await handle(new Request('https://qr.jumvi.co/v1?q=ok'),env);assert.equal(r.headers.get('Location'),'https://qr.jumvi.co/v1/?q=ok');
});
test('promotion leaves admin and original assets to existing origin, denies unknown V1',async()=>{
 for(const p of ['/api/beacon','/panel','/analiz','/data/file','/app.js','/assets/leo/example.webp','/v10']){const req=new Request('https://qr.jumvi.co'+p,{headers:{Authorization:'SYNTHETIC'}});let called=false;const r=await handle(req,env,async x=>{assert.equal(x,req);called=true;return new Response('UNCHANGED');});assert(called);assert.equal(await r.text(),'UNCHANGED');}
 for(const p of ['/v1/api','/v1/panel','/v1/unknown'])assert.equal((await handle(new Request('https://qr.jumvi.co'+p),env)).status,404);
 assert.equal((await handle(new Request('https://jumvi.co/'),env)).status,403);
});
test('root and V1 worker scope, no authenticated app response',async()=>{
 for(const [p,scope] of [['/service-worker.js','/'],['/v1/service-worker.js','/v1/']]){const r=await handle(new Request('https://qr.jumvi.co'+p),env);assert.equal(r.headers.get('Service-Worker-Allowed'),scope);assert.equal(r.headers.get('Cache-Control'),'no-store');}
 assert.equal((await handle(new Request('https://qr.jumvi.co/',{headers:{Authorization:'SYNTHETIC'}}),env)).status,403);
});

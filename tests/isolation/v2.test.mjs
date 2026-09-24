import test from 'node:test';import assert from 'node:assert/strict';import worker,{isV2Path} from '../../src/v2-review-worker.mjs';
const origin='https://qr.jumvi.co';
const env={ASSETS:{fetch:async req=>new Response(new URL(req.url).pathname,{headers:{'Content-Type':'text/html'}})}};
test('v2 exact boundary excludes legacy and lookalikes',async()=>{for(const p of ['/','/tr/','/v20','/v2-old','/V2/','/api','/panel','/analiz']){assert.equal(isV2Path(p),false);const r=await worker.fetch(new Request(origin+p),env);assert.equal(r.status,404);assert.equal(r.headers.get('X-Robots-Tag'),null);}});
test('v2 slash and query preserve locale; no ops fallback or credential forwarding',async()=>{const r=await worker.fetch(new Request(origin+'/v2?q=hello'),env);assert.equal(r.status,308);assert.equal(r.headers.get('Location'),origin+'/v2/?q=hello');for(const p of ['/v2/','/v2/tr','/v2/tr/']){const r=await worker.fetch(new Request(origin+p+'?q=1',{headers:{Cookie:'synthetic=1'}}),{ASSETS:{fetch:async req=>{assert.equal(req.headers.has('Cookie'),false);assert.equal(req.headers.has('Authorization'),false);return new Response(new URL(req.url).pathname);}}});assert.match(await r.text(),/\/v2\/(tr\/)?index.html/);}for(const p of ['/v2/api','/v2/panel','/v2/analiz','/v2/unknown'])assert.equal((await worker.fetch(new Request(origin+p),env)).status,404);});
test('old SW cannot cache first v2 navigation; scoped SW header',async()=>{const r=await worker.fetch(new Request(origin+'/v2/',{headers:{Accept:'text/html'}}),env);assert.equal(r.headers.get('Vary'),'*');const asset=await worker.fetch(new Request(origin+'/v2/index.html'),env);assert.equal(asset.headers.get('Vary'),'*');const sw=await worker.fetch(new Request(origin+'/v2/service-worker.js'),env);assert.equal(sw.headers.get('Service-Worker-Allowed'),'/v2/');});

test('route wildcard lookalikes delegate unchanged only to existing same-host origin',async()=>{
 const {handle}=await import('../../src/v2-route-worker.mjs');
 for(const path of ['/v20','/v2-old?q=1','/v2something','/tr/']){const req=new Request(origin+path,{headers:{Cookie:'synthetic=1'}});let calls=0;const r=await handle(req,env,async actual=>{assert.equal(actual,req);calls++;return new Response('LEGACY',{headers:{'X-Legacy':'same'}});});assert.equal(calls,1);assert.equal(await r.text(),'LEGACY');assert.equal(r.headers.get('X-Robots-Tag'),null);}
 for(const path of ['/v2?q=1','/v2/','/v2/tr/?q=1']){const r=await handle(new Request(origin+path),env,()=>{throw Error('V2 must not fall through');});assert([200,308].includes(r.status));}
});
test('legacy compatibility accepts only the exact script, including old query aliases',async()=>{
 const {handle}=await import('../../src/v2-legacy-compat-worker.mjs');for(const path of ['/service-worker.js','/service-worker.js?v=20260920-1']){const r=await handle(new Request(origin+path),env);assert.equal(r.headers.get('Service-Worker-Allowed'),'/');assert.equal(r.headers.get('Cache-Control'),'no-store');}
 const r=await handle(new Request(origin+'/service-worker.js-old'),env,async()=>new Response('UNCHANGED'));assert.equal(await r.text(),'UNCHANGED');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../../src/v2-review-worker.mjs';
import staging from '../../src/m0-staging-worker.mjs';
const asset='/v2/releases/1234567890abcdef/assets/mission-illustrations/final/m04/1.webp';
const origin='https://qr.jumvi.co';
function assets(){let calls=0;return {env:{ASSETS:{fetch:async()=>{calls++;return new Response('image',{headers:{'Content-Type':'image/webp'}})}}},calls:()=>calls};}
test('external image embedding is rejected before asset access, including spoofed domain substrings and missing referrer cross-site requests',async()=>{
 for(const headers of [{Referer:'https://competitor.example/product'},{Referer:'https://qr.jumvi.co.competitor.example/'},{Referer:'https://competitor.example/?qr.jumvi.co'},{'Sec-Fetch-Site':'cross-site'},{Referer:'not a url'}]){const a=assets();const r=await worker.fetch(new Request(origin+asset,{headers}),a.env);assert.equal(r.status,403);assert.equal(a.calls(),0);assert.equal(r.headers.get('Cache-Control'),'no-store');}
});
test('same-site, standalone PWA, direct and referrer-free asset requests keep working without cookies or tokens',async()=>{
 for(const headers of [{},{Referer:origin+'/v2/'},{Referer:'https://jumvi.co/'},{Referer:'https://www.jumvi.co/'},{'Sec-Fetch-Site':'same-origin'},{'Sec-Fetch-Site':'none'}]){const a=assets();const r=await worker.fetch(new Request(origin+asset,{headers}),a.env);assert.equal(r.status,200);assert.equal(r.headers.get('Cross-Origin-Resource-Policy'),'same-site');assert.equal(r.headers.get('X-Content-Type-Options'),'nosniff');assert.match(r.headers.get('X-Robots-Tag'),/noimageindex/);assert.equal(a.calls(),1);}
});
test('QR navigation and PDF sharing remain available; hostile framing is restricted; staging also protects its current images',async()=>{
 for(const path of ['/v2/','/v2/tr/','/v2/releases/1234567890abcdef/assets/parents/book.pdf']){const a=assets();const r=await worker.fetch(new Request(origin+path,{headers:{Referer:'https://search.example/','Sec-Fetch-Site':'cross-site'}}),a.env);assert.equal(r.status,200);if(!path.endsWith('.pdf'))assert.match(r.headers.get('Content-Security-Policy'),/frame-ancestors 'self'/);}
 const a=assets();const r=await staging.fetch(new Request('https://jumvi-missions-staging.saykirtasiye.workers.dev'+asset.replace('/v2/','/'),{headers:{Referer:'https://competitor.example/'}}),a.env);assert.equal(r.status,403);assert.equal(a.calls(),0);
});

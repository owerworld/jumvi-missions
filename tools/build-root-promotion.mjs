// User-authorized promotion: root is V2, old UI lives at /v1/. No source legacy edits.
import {readFileSync,writeFileSync,mkdirSync,rmSync,cpSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const out='artifacts/root-promotion',v2=JSON.parse(readFileSync('dist-v2/v2/release-manifest.json'));
const sha=b=>createHash('sha256').update(b).digest('hex');
rmSync(out,{recursive:true,force:true});mkdirSync(out,{recursive:true});
cpSync('dist-v2/v2',out+'/v2',{recursive:true});
const legacy=JSON.parse(readFileSync('compat/v254-public-manifest.json'));
for(const f of legacy.files){const raw=readFileSync(f.path);assert.equal(sha(raw),f.sha256);const dest=out+'/'+f.path;mkdirSync(dest.slice(0,dest.lastIndexOf('/')),{recursive:true});writeFileSync(dest,raw);}
const published=[];
function put(path,bytes,mime){mkdirSync((out+path).slice(0,(out+path).lastIndexOf('/')),{recursive:true});writeFileSync(out+path,bytes);published.push({path,sha256:sha(bytes),bytes:Buffer.byteLength(bytes),mime});}
for(const tr of [false,true]){
 const old=readFileSync('compat/v254/'+(tr?'tr/':'')+'index.html','utf8');
 const html=old.replace('navigator.serviceWorker.register("/service-worker.js?v=20260920-1", { updateViaCache: "none" })','navigator.serviceWorker.register("/v1/service-worker.js", { scope: "/v1/", updateViaCache: "none" })').replace(/(<link rel="manifest" href=")[^"]+/,`$1/v1/${tr?'tr/':''}manifest.json`);
 assert(!html.includes('register("/service-worker.js'), 'Legacy registration must never replace root SW');
 put('/v1/'+(tr?'tr/':'')+'index.html',html,'text/html');
 const vm=JSON.parse(readFileSync('dist-v2/v2/'+(tr?'tr/':'')+'manifest.json'));
 put('/v1/'+(tr?'tr/':'')+'manifest.json',JSON.stringify({...vm,id:'/v1/',name:'JUMVI · Original',start_url:'/v1/'+(tr?'tr/':''),scope:'/v1/'}),'application/json');
 let home=readFileSync('dist-v2/v2/'+(tr?'tr/':'')+'index.html','utf8');
 home=home.replace('<html ', '<html data-jumvi-home="true" ').replace(`href="/v2/${tr?'tr/':''}manifest.json"`,`href="/${tr?'tr/':''}manifest.json"`);
 put('/'+(tr?'tr/':'')+'index.html',home,'text/html');
 put('/'+(tr?'tr/':'')+'manifest.json',JSON.stringify({...vm,id:'/',start_url:tr?'/tr/':'/',scope:'/'}),'application/json');
}
let oldSW=readFileSync('compat/v254/service-worker.js','utf8');
oldSW=oldSW.replace('"jumvi-missions-v254"','"jumvi-v1-legacy-v254"').replaceAll('"/index.html"','"/v1/index.html"').replaceAll('"/tr/index.html"','"/v1/tr/index.html"').replaceAll('"/tr/manifest.json"','"/v1/tr/manifest.json"').replaceAll('"/manifest.json"','"/v1/manifest.json"').replace('  "/",','  "/v1/",');
oldSW=oldSW.replace('keys.filter((k) => k !== CACHE_NAME)','keys.filter((k) => k.startsWith("jumvi-v1-legacy-") && k !== CACHE_NAME)').replace('self.skipWaiting();','// Never replace an active round.').replace('self.clients.claim();','// New navigation adopts this scoped Worker.').replace('/^\\/tr(?:\\/|$)/','/^\\/v1\\/tr(?:\\/|$)/');
oldSW=oldSW.replace('if (url.origin !== self.location.origin) return;', 'if (url.origin !== self.location.origin) return;\n  if (/^\\/(?:api|panel|analiz|data)(?:\\/|$)/.test(url.pathname)) return;\n  if (req.mode === "navigate" && !url.pathname.startsWith("/v1/")) return;\n  if (url.pathname.startsWith("/v2/") || url.pathname.startsWith("/releases/")) return;');
oldSW=oldSW.replace('caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))', 'caches.open(CACHE_NAME).then(async cache => { for (const path of CORE_ASSETS) { const r = await fetch(new Request(path, {cache:"no-store"})); if (!r.ok) throw Error("Legacy asset unavailable"); await cache.put(path, legacyCacheable(r)); } })').replaceAll('cache.put(navCacheKey, copy)','cache.put(navCacheKey, legacyCacheable(copy))').replaceAll('cache.put(req, copy)','cache.put(req, legacyCacheable(copy))');
oldSW='function legacyCacheable(r){const h=new Headers(r.headers);if(h.get("Vary")==="*")h.delete("Vary");return new Response(r.body,{status:r.status,statusText:r.statusText,headers:h});}\n'+oldSW;
put('/v1/service-worker.js',oldSW,'text/javascript');
const embedded=readFileSync('dist-v2/v2/service-worker.js','utf8').match(/const MANIFEST=(.*);\nconst BASE/);assert(embedded);
const sw=JSON.parse(embedded[1]);sw.base='/';sw.namespace='jumvi-home-';
const rootShells=published.filter(f=>!f.path.startsWith('/v1/'));
sw.files=[...sw.files.filter(f=>!f.path.endsWith('.html')&&!['/v2/manifest.json','/v2/tr/manifest.json'].includes(f.path)),...rootShells];
sw.precache=sw.precache.map(p=>p==='/v2/index.html'?'/index.html':p==='/v2/tr/index.html'?'/tr/index.html':p);
put('/service-worker.js',readFileSync('src/offline/service-worker.js','utf8').replace('__MANIFEST__',JSON.stringify(sw)),'text/javascript');
const record={version:1,sourceSHA:process.env.PROMOTION_EXACT_SHA||'LOCAL',v2Release:v2.release,route:'https://qr.jumvi.co/*',worker:'jumvi-v2-legacy-compat',rootDataNamespace:'jumvi-v2:',legacyData:'unchanged localStorage',files:published};
put('/promotion-manifest.json',JSON.stringify(record,null,2),'application/json');
console.log('Root promotion packaged: '+v2.release+'; root/V1 separate SW caches; original data retained');

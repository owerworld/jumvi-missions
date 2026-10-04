import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {generateKeyPair,SignJWT,jwtVerify} from 'jose';
import {validEvent,summarize,firstDay} from '../contract.mjs';
import {collect,createWorker,authorized} from '../worker.mjs';
import {createUsageCounter,USAGE_COLLECTION_ENABLED,usageTransition} from '../../src/client/media/usage-counts.js';
const sample={v:1,event:'mission_open',mission:'m25',locale:'en-US'},now=new Date('2026-10-04T12:00:00Z');
function db(){const db=new DatabaseSync(':memory:');db.exec(readFileSync(new URL('../schema.sql',import.meta.url),'utf8'));return {raw:db,prepare:sql=>({bind:(...args)=>({run:async()=>db.prepare(sql).run(...args),all:async()=>({results:db.prepare(sql).all(...args)})})})};}
function request(body=sample,country='US',headers={}){const r=new Request('https://qr.jumvi.co/v2/metrics',{method:'POST',headers:{'Content-Type':'application/json','Origin':'https://qr.jumvi.co','Sec-Fetch-Site':'same-origin',...headers},body:JSON.stringify(body)});Object.defineProperty(r,'cf',{value:{country}});return r;}
const env=()=>({DB:db(),COLLECTION_ENABLED:'true',PUBLIC_ORIGIN:'https://qr.jumvi.co',DASHBOARD_ORIGIN:'https://insights.example.invalid'});
test('strict allowlist rejects identifying fields and invented country/device IDs',()=>{
 assert.equal(validEvent(sample),true);for(const key of ['name','nickname','playerId','reportId','operationId','ip','country','url','referrer','email','age','sessionId','fingerprint'])assert.equal(validEvent({...sample,[key]:'test'}),false);
 for(const value of [{...sample,mission:'m37'},{...sample,event:'mission_complete'},{...sample,locale:'en'},{...sample,event:'app_open'},null,[]])assert.equal(validEvent(value),false);
 assert.equal(validEvent({...sample,event:'app_open',mission:'none'}),true);
});
test('US writes atomic daily aggregates only; concurrent calls do not lose counts',async()=>{
 const e=env();await Promise.all(Array.from({length:15},()=>collect(request(),e,now)));const rows=e.DB.raw.prepare('SELECT * FROM daily_counts').all();assert.equal(rows.length,1);assert.equal(rows[0].count,15);assert.deepEqual(Object.keys(rows[0]).sort(),['count','day','event','locale','mission']);assert.equal(rows[0].day,'2026-10-04');
});
test('non-US, unknown, privacy signal and disabled never write; spoofed header does not bypass country',async()=>{
 const e=env();for(const country of ['TR','CA',null,'XX'])assert.equal((await collect(request(sample,country,{'CF-IPCountry':'US'}),e,now)).status,204);
 for(const headers of [{'DNT':'1'},{'Sec-GPC':'1'}])await collect(request(sample,'US',headers),e,now);
 await collect(request(),{...e,COLLECTION_ENABLED:'false'},now);assert.equal(e.DB.raw.prepare('SELECT count(*) AS n FROM daily_counts').get().n,0);
});
test('cross-origin, missing origin, non-JSON, oversized and PII payloads rejected',async()=>{
 const e=env();for(const [headers,status]of [[{'Origin':'https://evil.test'},403],[{'Origin':''},403],[{'Sec-Fetch-Site':'cross-site'},403],[{'Content-Type':'text/plain'},400]])assert.equal((await collect(request(sample,'US',headers),e,now)).status,status);
 assert.equal((await collect(request({...sample,nickname:'kid'}),e,now)).status,400);assert.equal((await collect(request({padding:'x'.repeat(1000)}),e,now)).status,400);
 assert.equal(e.DB.raw.prepare('SELECT count(*) AS n FROM daily_counts').get().n,0);
});
test('SQL schema enforces mission/event/locale and app_open dimensions',()=>{
 const d=db().raw,s=d.prepare('INSERT INTO daily_counts VALUES(?,?,?,?,1)');for(const args of [['2026-10-04','en-US','m99','help_open'],['2026-10-04','fr','m01','help_open'],['2026-10-04','tr','m01','app_open']])assert.throws(()=>s.run(...args));
});
test('summaries filter locale and date, fill zero days, never claim unique visitors',()=>{
 const r=summarize([{day:'2026-10-04',locale:'en-US',mission:'none',event:'app_open',count:2},{day:'2026-10-04',locale:'tr',mission:'none',event:'app_open',count:8},{day:'2026-01-01',locale:'en-US',mission:'none',event:'app_open',count:100}],7,'en-US',now);assert.equal(r.totals.app_open,2);assert.equal(Object.keys(r.daily).length,7);assert.equal(r.start,'2026-09-28');assert.equal('visitors' in r,false);
});
test('retention deletes expired aggregates, retaining inclusive 90 days',async()=>{
 const e=env(),today=new Date(),keep=firstDay(90,today);e.DB.raw.prepare('INSERT INTO daily_counts VALUES(?,?,?,?,1)').run('2000-01-01','tr','none','app_open');e.DB.raw.prepare('INSERT INTO daily_counts VALUES(?,?,?,?,1)').run(keep,'tr','none','app_open');await createWorker().scheduled({},e);assert.equal(e.DB.raw.prepare('SELECT day FROM daily_counts').get().day,keep);assert.equal(e.DB.raw.prepare('SELECT count(*) AS n FROM daily_counts').get().n,1);
});
test('dashboard API and static assets fail closed without valid auth and correct host',async()=>{
 const w=createWorker(),e=env();for(const p of ['/','/api/summary','/app.js','/style.css','/missions.json'])assert.equal((await w.fetch(new Request(e.DASHBOARD_ORIGIN+p),e)).status,401);
 assert.equal((await w.fetch(new Request('https://unknown.workers.dev/'),e)).status,404);
 assert.equal((await w.fetch(new Request('https://qr.jumvi.co/v2/metrics?token=x'),e)).status,404);
});
test('Access JWT validates signature, audience, issuer, expiry, administrator; never trusts plain email header',async()=>{
 const {privateKey,publicKey}=await generateKeyPair('RS256'),e={ACCESS_TEAM_DOMAIN:'test.cloudflareaccess.com',ACCESS_AUD:'audience',ADMIN_EMAIL:'owner@example.test'};
 const verify=(token,_jwks,opts)=>jwtVerify(token,publicKey,opts);
 const token=async(overrides={})=>new SignJWT({email:'owner@example.test',...overrides}).setProtectedHeader({alg:'RS256'}).setIssuer('https://test.cloudflareaccess.com').setAudience('audience').setIssuedAt().setExpirationTime('5m').sign(privateKey);
 const req=t=>new Request('https://insights.example.invalid/',{headers:{'Cf-Access-Jwt-Assertion':t}});
 assert.equal(await authorized(req(await token()),e,verify),true);assert.equal(await authorized(req(await token({email:'other@example.test'})),e,verify),false);assert.equal(await authorized(req(await token()),{...e,ACCESS_AUD:'wrong'},verify),false);assert.equal(await authorized(req('forged'),e,verify),false);
 const expired=await new SignJWT({email:e.ADMIN_EMAIL}).setProtectedHeader({alg:'RS256'}).setIssuer('https://test.cloudflareaccess.com').setAudience('audience').setIssuedAt(1).setExpirationTime(2).sign(privateKey);assert.equal(await authorized(req(expired),e,verify),false);
 assert.equal(await authorized(new Request('https://insights.example.invalid/',{headers:{'Cf-Access-Authenticated-User-Email':e.ADMIN_EMAIL}}),e,verify),false);
});
test('authorized API supports bounded fixed queries and exposes disabled status; cache disabled',async()=>{
 const w=createWorker(async()=>true),e=env();e.COLLECTION_ENABLED='false';const r=await w.fetch(new Request(e.DASHBOARD_ORIGIN+'/api/summary?days=7&locale=tr'),e);assert.equal(r.status,200);assert.equal(r.headers.get('Cache-Control'),'no-store');assert.equal((await r.json()).mode,'disabled');for(const query of ['days=365','locale=fr','sql=SELECT'])assert.equal((await w.fetch(new Request(e.DASHBOARD_ORIGIN+'/api/summary?'+query),e)).status,400);
});
test('client defaults to zero network; offline and GPC/DNT suppressed even when enabled',()=>{
 let calls=0;const fetcher=()=>{calls++;return Promise.resolve();};assert.equal(USAGE_COLLECTION_ENABLED,false);createUsageCounter({locale:'en-US',fetcher})('app_open');for(const navigator of [{onLine:false},{globalPrivacyControl:true},{doNotTrack:'1'}])createUsageCounter({enabled:true,locale:'en-US',fetcher,navigator})('app_open');assert.equal(calls,0);
});
test('enabled client sends only four enum fields, no credentials/referrer, and tolerates failure',async()=>{
 let options;createUsageCounter({enabled:true,locale:'en-US',navigator:{},fetcher:(_u,o)=>{options=o;return Promise.reject(Error('offline'));}})('help_open','m25');assert.deepEqual(JSON.parse(options.body),{v:1,event:'help_open',mission:'m25',locale:'en-US'});assert.equal(options.credentials,'omit');assert.equal(options.referrerPolicy,'no-referrer');await new Promise(r=>setTimeout(r,0));
});
test('event mapping excludes auto-interruption, history, save and repeated report render',()=>{
 for(const type of ['INTERRUPT','BROWSE_HISTORY','SAVE','RESTORE','RETURN'])assert.equal(usageTransition(type,'active','entry',false,false),null);
 assert.equal(usageTransition('REPORT','report','stopped',true,false),'completion_reported');assert.equal(usageTransition('REPORT','report','report',true,true),null);assert.equal(usageTransition('REPORT','report','stopped',false,false),null);assert.equal(usageTransition('START','active','entry',false,false),'round_start');
});

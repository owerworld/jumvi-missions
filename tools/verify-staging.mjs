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

// Verify the hosting MIME/response contract through a real installed Worker,
// not merely through a matching deployment manifest. Fresh synthetic context.
const {chromium,expect}=await import('@playwright/test');
const browser=await chromium.launch();
try{
 const context=await browser.newContext(),page=await context.newPage();
 await page.goto(origin+'/tr');
 await expect(page.locator('[data-start]')).toBeEnabled({timeout:30000});
 await expect.poll(()=>page.evaluate(async()=>!!(await navigator.serviceWorker.getRegistration())?.active),{timeout:60000}).toBe(true);
 await page.reload();
 await expect.poll(()=>page.evaluate(()=>!!navigator.serviceWorker.controller)).toBe(true);
 await context.setOffline(true);
 for(const [path,lang] of [['/tr','tr'],['/','en-US']]){
  await page.goto(origin+path);
  await expect(page.locator('html')).toHaveAttribute('lang',lang);
  await expect(page.locator('[data-start]')).toBeEnabled({timeout:15000});
 }
 console.log(`Live staging SW installation and offline TR/EN ${local.release}: PASS`);
 await context.close();
}finally{await browser.close();}

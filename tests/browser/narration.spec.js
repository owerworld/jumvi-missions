import {test,expect} from '@playwright/test';
import {serveCoexist} from '../../tools/serve-v2-coexist.mjs';
async function instrument(page){await page.addInitScript(()=>{const Original=window.Audio;window.__media=[];window.Audio=function(url){const a=new Original(url);window.__media.push(a);return a;};});}
async function open(page){await page.goto('/');await expect(page.locator('[data-start]')).toBeEnabled();}
async function sound(page){if(await page.locator('.entry-menu').count())await page.locator('.entry-menu').evaluate(n=>n.open=true);await page.getByRole('button',{name:'Sound',exact:true}).click();}
test('Jessica complete narration plays only on explicit request and Stop/navigation cancels it',async({page})=>{
 await instrument(page);await open(page);expect(await page.evaluate(()=>window.__media.length)).toBe(0);
 await sound(page);await expect(page.getByRole('button',{name:'Sound',exact:true})).toHaveAttribute('aria-pressed','true');
 await expect.poll(()=>page.evaluate(()=>window.__media[0]?.currentTime||0)).toBeGreaterThan(0);
 expect(await page.evaluate(()=>window.__media[0].src)).toMatch(/m25-full-[a-f0-9]+\.mp3$/);
 await page.locator('[data-start]').click();expect(await page.evaluate(()=>window.__media.every(a=>a.paused))).toBe(true);expect(await page.evaluate(()=>window.__media.length)).toBe(1);
 await page.getByRole('button',{name:'Sound',exact:true}).click();await sound(page);
 await expect.poll(()=>page.evaluate(()=>window.__media[1]?.currentTime||0)).toBeGreaterThan(0);
 expect(await page.evaluate(()=>window.__media[1].src)).toMatch(/m25-active-[a-f0-9]+\.mp3$/);
 await page.locator('.active-actions button').nth(1).click();expect(await page.evaluate(()=>window.__media.every(a=>a.paused))).toBe(true);
 expect(await page.locator('.play-notice').textContent()).not.toContain('pending');
});
test('Help replay stays silent when off, replays only when on, and return does not autoplay',async({page})=>{
 await instrument(page);await open(page);await page.getByRole('button',{name:'How to play / help',exact:true}).click();
 await page.getByRole('button',{name:'Explain again',exact:true}).click();expect(await page.evaluate(()=>window.__media.length)).toBe(0);
 await sound(page);await expect(page.locator('[data-sound]')).toHaveAttribute('aria-pressed','true');
 await page.getByRole('button',{name:'Explain again',exact:true}).click();await expect.poll(()=>page.evaluate(()=>window.__media.length)).toBe(2);
 expect(await page.evaluate(()=>window.__media[0].paused)).toBe(true);
 await page.getByRole('button',{name:'Back to the mission',exact:true}).first().click();expect(await page.evaluate(()=>window.__media.every(a=>a.paused))).toBe(true);expect(await page.evaluate(()=>window.__media.length)).toBe(2);
});
test('Silent Mode active remains quiet and missing optional audio never blocks Start',async({page})=>{
 await instrument(page);await open(page);await page.getByRole('button',{name:'Find another suitable mission',exact:true}).click();await page.locator('[data-mission-id=m13] button').click();await expect(page.locator('[data-start]')).toBeEnabled();
 await page.locator('[data-start]').click();await sound(page);expect(await page.evaluate(()=>window.__media.length)).toBe(0);await expect(page.locator('[data-sound]')).toHaveAttribute('aria-pressed','false');
});
test('Unavailable recording fails off while instructions and play remain usable',async({page})=>{
 await page.route('**/assets/narration/**',r=>r.abort());await instrument(page);await open(page);await sound(page);await expect(page.locator('[data-sound]')).toHaveAttribute('aria-pressed','false');await expect(page.locator('.play-notice')).toContainText('unavailable');await expect(page.locator('[data-start]')).toBeEnabled();await page.locator('[data-start]').click();await expect(page.locator('[data-view=active]')).toBeVisible();
});
test('V2 caches requested narration only, then plays the verified recording during an origin outage',async({page})=>{
 const replica=await serveCoexist(0);
 try{
  await instrument(page);await page.goto(replica.origin+'/v2/');await expect(page.locator('[data-start]')).toBeEnabled();
  await page.evaluate(()=>navigator.serviceWorker.ready);await page.reload();await expect(page.locator('[data-start]')).toBeEnabled();
  await expect.poll(()=>page.evaluate(()=>!!navigator.serviceWorker.controller)).toBe(true);
  const clips=()=>page.evaluate(async()=>{const urls=[];for(const key of (await caches.keys()).filter(k=>k.startsWith('jumvi-v2-')))for(const r of await(await caches.open(key)).keys())if(r.url.includes('/assets/narration/'))urls.push(r.url);return urls;});
  expect(await clips()).toHaveLength(0);await sound(page);
  await expect.poll(()=>page.evaluate(()=>window.__media[0]?.currentTime||0)).toBeGreaterThan(0);
  await expect.poll(async()=>(await clips()).length,{timeout:20000}).toBe(1);
  await sound(page);expect(await page.evaluate(()=>window.__media.every(a=>a.paused))).toBe(true);
  replica.state.offline=true;
  const ranges=await page.evaluate(async()=>{const url=window.__media[0].src,full=await fetch(url).then(r=>r.arrayBuffer()),results=[];for(const range of ['bytes=0-1','bytes=-12','bytes='+full.byteLength+'-']){const r=await fetch(url,{headers:{Range:range}}),bytes=new Uint8Array(await r.arrayBuffer());results.push({status:r.status,range:r.headers.get('Content-Range'),bytes:[...bytes]});}return{size:full.byteLength,first:[...new Uint8Array(full).slice(0,2)],last:[...new Uint8Array(full).slice(-12)],results};});
  expect(ranges.results[0]).toEqual({status:206,range:`bytes 0-1/${ranges.size}`,bytes:ranges.first});
  expect(ranges.results[1]).toEqual({status:206,range:`bytes ${ranges.size-12}-${ranges.size-1}/${ranges.size}`,bytes:ranges.last});
  expect(ranges.results[2]).toEqual({status:416,range:`bytes */${ranges.size}`,bytes:[]});
  await sound(page);
  await expect.poll(()=>page.evaluate(()=>window.__media[1]?.currentTime||0)).toBeGreaterThan(0);
  await page.locator('[data-start]').click();expect(await page.evaluate(()=>window.__media.every(a=>a.paused))).toBe(true);
 }finally{replica.state.offline=false;replica.server.closeAllConnections();await new Promise(r=>replica.server.close(r));}
});

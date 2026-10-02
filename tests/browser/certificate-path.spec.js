import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
const release=JSON.parse(readFileSync('dist/release-manifest.json')).release;
const root=`/releases/${release}/client/repository/local.js`;
for(const tr of [false,true]){
 test(`stopped choices stay separate at narrow widths and enlarged text ${tr?'TR':'EN'}`,async({page})=>{
  await page.goto(tr?'/tr/':'/');await expect(page.locator('[data-start]')).toBeEnabled();await page.locator('[data-start]').click();await page.locator('.stop-action').click();
  for(const width of [320,390,430,640])for(const size of [100,200]){
   await page.setViewportSize({width,height:844});await page.evaluate(size=>{document.documentElement.style.fontSize=`${size}%`;dispatchEvent(new Event('resize'));},size);
   const geometry=await page.locator('[data-view=stopped] .controls').last().locator('button').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return {top:r.top,bottom:r.bottom,height:r.height,width:r.width,radius:parseFloat(getComputedStyle(n).borderRadius)};}));
   expect(geometry).toHaveLength(3);for(let i=1;i<geometry.length;i++)expect(geometry[i].top-geometry[i-1].bottom).toBeGreaterThanOrEqual(12);
   for(const b of geometry)expect(b.height).toBeGreaterThanOrEqual(56);
   expect(geometry[1].radius).toBeGreaterThan(0);expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  }
 });
 test(`entry certificate path is optional, per player, fresh and truthful ${tr?'TR':'EN'}`,async({page,context})=>{
  await page.goto(tr?'/tr/':'/');await expect(page.locator('[data-start]')).toBeEnabled();const card=page.locator('.certificate-path');await expect(card).toBeVisible();await expect(card.getByRole('progressbar')).toHaveCount(0);
  const seeded=await page.evaluate(async root=>{const {LocalRepository}=await import(root),r=new LocalRepository(),s=await r.snapshot(),a=await r.create({epoch:s.epoch,name:'SYNTHETIC_PATH_A'}),b=await r.create({epoch:s.epoch,name:'SYNTHETIC_PATH_B'});for(let i=1;i<=35;i++){const id=`m${String(i).padStart(2,'0')}`;const op=await r.prepare({id,epoch:s.epoch,targetId:a.id,targetRevision:a.revision,report:{id,missionId:id,value:'complete',revision:1,roundId:null,mechanicsVersion:'synthetic'}});await r.commit(op.id,s.epoch);}for(const [id,missionId,value] of [['duplicate','m01','complete'],['early','m36','early'],['unknown','unknown','complete']]){const op=await r.prepare({id,epoch:s.epoch,targetId:a.id,targetRevision:a.revision,report:{id,missionId,value,revision:1,roundId:null,mechanicsVersion:'synthetic'}});await r.commit(op.id,s.epoch);}r.close();return {a,b,epoch:s.epoch};},root);
  await page.reload();await expect(card.locator('button')).toHaveText(tr?'Oyuncunu seç':'Choose your player');await expect(card.getByRole('progressbar')).toHaveCount(0);
  await card.locator('button').click();await expect(page.locator('.profile-menu')).toHaveAttribute('open');await page.locator('#session-player').selectOption(seeded.a.id);await page.locator('.profile-menu summary').press('Escape');
  await expect(card.getByRole('progressbar')).toHaveAttribute('value','35');await expect(card).toContainText(tr?'1 görev kaldı':'1 mission to go');
  await card.scrollIntoViewIfNeeded();await page.screenshot({path:`review-assets/2026-10-03/certificate-path/certificate-${tr?'tr':'en'}-${test.info().project.name}.png`});
  await card.locator('button').click();await expect(page.locator('.certificate-status')).toBeVisible();await page.locator('.context-back').click();await expect(card.getByRole('progressbar')).toHaveAttribute('value','35');
  const other=await context.newPage();await other.goto(tr?'/tr/':'/');await expect(other.locator('.certificate-path progress')).toHaveCount(0);
  await other.evaluate(async({root,seeded})=>{const {LocalRepository}=await import(root),r=new LocalRepository();const op=await r.prepare({id:'last',epoch:seeded.epoch,targetId:seeded.a.id,targetRevision:seeded.a.revision,report:{id:'last',missionId:'m36',value:'complete',revision:1,roundId:null,mechanicsVersion:'synthetic'}});await r.commit(op.id,seeded.epoch);r.close();new BroadcastChannel('jumvi-local-invalidation-v1').postMessage('changed');},{root,seeded});
  await expect(card.getByRole('progressbar')).toHaveAttribute('value','36');await expect(card).toContainText(tr?'Sertifikan hazır':'Your certificate is ready');
  await card.locator('button').click();await expect(page.getByRole('dialog')).toBeVisible();await page.getByRole('dialog').getByRole('button',{name:tr?'Kapat':'Close',exact:true}).click();
  await other.evaluate(async({root,seeded})=>{const {LocalRepository}=await import(root),r=new LocalRepository();await r.deletePlayer({epoch:seeded.epoch,id:seeded.a.id,revision:seeded.a.revision});r.close();new BroadcastChannel('jumvi-local-invalidation-v1').postMessage('changed');},{root,seeded});
  await expect(card.getByRole('progressbar')).toHaveCount(0);await expect(card).not.toContainText('SYNTHETIC_PATH_A');
  await card.locator('button').click();await page.locator('#session-player').selectOption(seeded.b.id);await page.locator('.profile-menu summary').press('Escape');await expect(card.getByRole('progressbar')).toHaveAttribute('value','0');
  for(const width of [320,390,430]){await page.setViewportSize({width,height:844});await page.evaluate(()=>{document.documentElement.style.fontSize='200%';dispatchEvent(new Event('resize'));});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);}
 });
}

import {test,expect} from '@playwright/test';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
const release=JSON.parse(readFileSync('dist/release-manifest.json')).release;
const root=`/releases/${release}`;

test('synthetic 36-mission local reports unlock an honest PNG, then correction revokes eligibility',async({page})=>{
 await page.goto('/tr');await expect(page.locator('[data-start]')).toBeEnabled();
 const seed=await page.evaluate(async root=>{
  const {LocalRepository}=await import(root+'/client/repository/local.js');
  const r=new LocalRepository(),snap=await r.snapshot(),player=await r.create({epoch:snap.epoch,name:'QA ÖRNEK'});
  const missions=(await fetch(root+'/content/catalog.json').then(r=>r.json())).missions;
  for(let n=0;n<missions.length;n++){
   const id=`qa-${n}`,report={id:`qa-report-${n}`,missionId:missions[n].id,mechanicsVersion:'qa-fixture',roundId:`qa-round-${n}`,value:n===35?'early':'complete',revision:1};
   await r.prepare({id,epoch:snap.epoch,targetId:player.id,targetRevision:player.revision,report});await r.commit(id,snap.epoch);
  }
  r.close();return {playerId:player.id,epoch:snap.epoch};
 },root);
 await page.getByRole('button',{name:'Oyuncu işlemleri',exact:true}).click();
 await page.getByRole('button',{name:'Geçmişi gör: QA ÖRNEK'}).click();
 await expect(page.getByText('35/36 farklı görev tamamlandı olarak kaydedildi')).toBeVisible();
 await expect(page.getByRole('heading',{name:'Tamamlandığı bildirilen görevler'})).toBeVisible();
 await expect(page.locator('.mission-progress > p')).toHaveCount(35);
 await expect(page.locator('.mission-progress')).toContainText('1 tamamlandı bildirimi');
 await page.screenshot({path:'review-assets/2026-09-25/screenshots/progress-35-of-36-viewport-synthetic-qa.png'});
 await page.screenshot({path:'review-assets/2026-09-25/screenshots/progress-35-of-36-synthetic-qa.png',fullPage:true});
 await expect(page.getByRole('button',{name:'Sertifikayı önizle'})).toHaveCount(0);
 await page.evaluate(async({root,seed})=>{
  const {LocalRepository}=await import(root+'/client/repository/local.js');const r=new LocalRepository(),s=await r.snapshot(),record=s.records.find(x=>x.id==='qa-35');
  await r.correctReport({id:record.id,epoch:seed.epoch,revision:record.revision,value:'complete'});
  new BroadcastChannel('jumvi-local-invalidation-v1').postMessage('changed');r.close();
 },{root,seed});
 await expect(page.getByText('36/36 farklı görev tamamlandı olarak kaydedildi')).toBeVisible();
 await expect(page.locator('.mission-progress > p')).toHaveCount(36);
 await page.screenshot({path:'review-assets/2026-09-25/screenshots/progress-36-of-36-viewport-synthetic-qa.png'});
 await page.screenshot({path:'review-assets/2026-09-25/screenshots/progress-36-of-36-synthetic-qa.png',fullPage:true});
 await page.getByRole('button',{name:'Sertifikayı önizle'}).click();
 const modal=page.getByRole('dialog');await expect(modal).toBeVisible();
 await expect(modal.getByRole('img')).toHaveAttribute('alt',/QA ÖRNEK.*36 farklı görevin.*Fiziksel beceri ölçülmedi/);
 const downloadPromise=page.waitForEvent('download');await modal.getByRole('button',{name:'PNG olarak kaydet'}).click();const download=await downloadPromise;
 const buffer=await (await import('node:fs/promises')).readFile(await download.path());
 expect([...buffer.subarray(0,8)]).toEqual([137,80,78,71,13,10,26,10]);expect(buffer.length).toBeGreaterThan(10000);
 mkdirSync('review-assets/2026-09-25/screenshots',{recursive:true});writeFileSync('review-assets/2026-09-25/screenshots/certificate-synthetic-qa.png',buffer);
 await page.screenshot({path:'review-assets/2026-09-25/screenshots/certificate-preview-synthetic-qa.png',fullPage:true});
 await modal.getByRole('button',{name:'Kapat'}).click();
 await page.evaluate(async({root,seed})=>{
  const {LocalRepository}=await import(root+'/client/repository/local.js');const r=new LocalRepository(),s=await r.snapshot(),record=s.records.find(x=>x.id==='qa-35');
  await r.correctReport({id:record.id,epoch:seed.epoch,revision:record.revision,value:'early'});
  new BroadcastChannel('jumvi-local-invalidation-v1').postMessage('changed');r.close();
 },{root,seed});
 await expect(page.getByText('35/36 farklı görev tamamlandı olarak kaydedildi')).toBeVisible();
 await expect(page.getByRole('button',{name:'Sertifikayı önizle'})).toHaveCount(0);
});

test('a revised declaration cannot create a second saved record for the same report',async({page})=>{
 await page.goto('/');await expect(page.locator('[data-start]')).toBeEnabled();
 const result=await page.evaluate(async root=>{
  const {LocalRepository}=await import(root+'/client/repository/local.js');const r=new LocalRepository(),s=await r.snapshot(),p=await r.create({epoch:s.epoch});
  const report={id:'qa-one-report',missionId:'m25',mechanicsVersion:'qa-fixture',roundId:'qa-round',value:'complete',revision:1};
  await r.prepare({id:'qa-one-operation',epoch:s.epoch,targetId:p.id,targetRevision:p.revision,report});await r.commit('qa-one-operation',s.epoch);
  let error='';try{await r.prepare({id:'qa-wrong-second',epoch:s.epoch,targetId:p.id,targetRevision:p.revision,report:{...report,value:'early',revision:2}});}catch(e){error=e.code;}
  const current=(await r.snapshot()).records[0];await r.correctReport({id:current.id,epoch:s.epoch,revision:current.revision,value:'early'});
  const after=await r.snapshot();r.close();return {error,records:after.records,operations:after.operations};
 },root);
 expect(result.error).toBe('correction-required');expect(result.records).toHaveLength(1);expect(result.operations).toHaveLength(1);expect(result.records[0].report.value).toBe('early');
});

test('EN certificate copy renders locally without personal network requests',async({page})=>{
 const requests=[];page.on('request',r=>requests.push({method:r.method(),url:r.url(),body:r.postData()}));
 await page.goto('/');await expect(page.locator('[data-start]')).toBeEnabled();
 const result=await page.evaluate(async root=>{
  const {certificatePng}=await import(root+'/client/certificate.js');
  const {blob,words}=await certificatePng('en-US','QA SAMPLE');
  return {type:blob.type,size:blob.size,words};
 },root);
 expect(result.type).toBe('image/png');expect(result.size).toBeGreaterThan(10000);
 expect(result.words.count).toContain('36 different missions');
 expect(result.words.honesty).toContain('not measured');
 expect(requests.every(r=>r.method==='GET'&&!r.body)).toBe(true);
 expect(JSON.stringify(requests)).not.toContain('QA SAMPLE');
});

test('EN player summary exposes distinct progress and optional certificate path at narrow width',async({page})=>{
 await page.setViewportSize({width:320,height:844});await page.goto('/');
 await expect(page.locator('[data-start]')).toBeEnabled();
 const root=(await page.locator('script[type=module]').getAttribute('src')).split('/client/')[0];
 await page.evaluate(async root=>{
  const {LocalRepository}=await import(root+'/client/repository/local.js');
  const r=new LocalRepository(),s=await r.snapshot(),player=await r.create({epoch:s.epoch,name:'QA SAMPLE'});
  await r.prepare({id:'qa-en-1',epoch:s.epoch,targetId:player.id,targetRevision:player.revision,report:{id:'qa-en-report-1',missionId:'m25',mechanicsVersion:'qa-fixture',roundId:'qa-en-round-1',value:'complete',revision:1}});
  await r.commit('qa-en-1',s.epoch);r.close();
 },root);
 await page.getByRole('button',{name:'Player options',exact:true}).click();
 await page.getByRole('button',{name:'View history: QA SAMPLE'}).click();
 await expect(page.getByRole('heading',{name:'Missions reported complete'})).toBeVisible();
 await expect(page.locator('.mission-progress')).toContainText('1 completion report');
 await expect(page.getByText('1/36 different missions saved as completed')).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(321);
 await page.screenshot({path:'review-assets/2026-09-25/screenshots/progress-en-320-synthetic-qa.png',fullPage:true});
});

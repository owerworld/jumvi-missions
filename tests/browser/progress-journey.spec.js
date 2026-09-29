import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
const release=JSON.parse(readFileSync('dist/release-manifest.json')).release,root=`/releases/${release}/client/repository/local.js`;
const snap=page=>page.evaluate(async root=>{const {LocalRepository}=await import(root),r=new LocalRepository(),s=await r.snapshot();r.close();return s;},root);
async function finish(page,tr){await page.locator('[data-start]').click();await page.locator('.stop-action').click();await page.getByRole('button',{name:tr?'Tamamladığımı bildir':'Report that I completed it',exact:true}).click();}
for(const tr of [true,false])test(`optional quick progress, repeat, guest and completed catalogue ${tr?'TR':'EN'}`,async({page,context})=>{
 const requests=[];page.on('request',r=>requests.push(r.url()+' '+(r.postData()||'')));
 await page.goto(tr?'/tr':'/');await expect(page.locator('[data-start]')).toBeEnabled();await finish(page,tr);
 expect((await snap(page)).records).toHaveLength(0);
 await page.getByRole('button',{name:tr?'İlerlememi tut':'Keep my progress',exact:true}).click();await page.getByRole('button',{name:tr?'Yeni oyuncu':'New player',exact:true}).click();
 await page.getByLabel(tr?'Takma ad (isteğe bağlı)':'Nickname (optional)',{exact:true}).fill('SYNTHETIC_JOURNEY');
 await page.getByRole('button',{name:tr?'Oluştur ve bu görevi kaydet':'Create player and save this mission',exact:true}).click();
 await expect(page.locator('[data-view=report]')).toBeVisible();await expect(page.locator('.journey-count')).toContainText('1/36');expect((await snap(page)).records).toHaveLength(1);
 await page.getByRole('button',{name:tr?'Yeniden oyna':'Play again',exact:true}).click();await page.locator('.stop-action').click();await page.getByRole('button',{name:tr?'Tamamladığımı bildir':'Report that I completed it',exact:true}).click();
 await expect.poll(async()=> (await snap(page)).records.length).toBe(2);await expect(page.locator('.journey-count')).toContainText('1/36');
 await page.getByRole('button',{name:tr?'Başka görev':'Another mission',exact:true}).click();await expect(page.locator('#mission-search')).toHaveCount(0);await expect(page.locator('[data-mission-id=m25] .mission-completed')).toBeVisible();await expect(page.locator('.mission-completed')).toHaveCount(1);
 await page.screenshot({path:`review-assets/2026-09-28/completed-${tr?'tr':'en'}-${test.info().project.name}.png`,fullPage:true});
 await page.addScriptTag({content:readFileSync('node_modules/axe-core/axe.min.js','utf8')});const axe=await page.evaluate(()=>window.axe.run(document.querySelector('main')));expect(axe.violations).toEqual([]);
 await page.setViewportSize({width:320,height:844});await page.evaluate(()=>{document.documentElement.style.fontSize='200%';dispatchEvent(new Event('resize'));});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(321);
 // Changing to Guest clears the visible completion association; another tab never inherits it.
 await page.getByLabel(tr?'Bu oyunda':'Playing as',{exact:true}).selectOption('');await expect(page.locator('.mission-completed')).toHaveCount(0);
 const other=await context.newPage();await other.goto(tr?'/tr':'/');await expect(other.locator('#session-player')).toHaveValue('');
 expect(requests.join('\n')).not.toContain('SYNTHETIC_JOURNEY');
 expect(JSON.stringify(await page.evaluate(()=>({local:{...localStorage},session:{...sessionStorage},history:history.state})))).not.toContain('SYNTHETIC_JOURNEY');
});
test('new session requires explicit actor; per-player badges and deletion invalidate selection',async({page,context})=>{
 await page.goto('/');await expect(page.locator('[data-start]')).toBeEnabled();const seed=await page.evaluate(async root=>{const {LocalRepository}=await import(root),r=new LocalRepository(),s=await r.snapshot(),a=await r.create({epoch:s.epoch,name:'SYNTHETIC_A'}),b=await r.create({epoch:s.epoch,name:'SYNTHETIC_B'});for(const [id,target] of [['m25',a],['m07',b]]){const op=await r.prepare({id,epoch:s.epoch,targetId:target.id,targetRevision:target.revision,report:{id,missionId:id,mechanicsVersion:'synthetic',revision:1,roundId:null,value:'complete'}});await r.commit(op.id,s.epoch);}return {a,b,epoch:s.epoch};},root);
 await page.reload();await expect(page.locator('#session-player')).toHaveValue('');await page.getByRole('button',{name:'Find another suitable mission',exact:true}).click();await expect(page.locator('.mission-completed')).toHaveCount(0);
 await page.locator('#session-player').selectOption(seed.a.id);await expect(page.locator('[data-mission-id=m25] .mission-completed')).toBeVisible();await expect(page.locator('[data-mission-id=m07] .mission-completed')).toHaveCount(0);
 await page.locator('#session-player').selectOption(seed.b.id);await expect(page.locator('[data-mission-id=m07] .mission-completed')).toBeVisible();
 const other=await context.newPage();await other.goto('/');await other.evaluate(async({root,seed})=>{const {LocalRepository}=await import(root),r=new LocalRepository();await r.deletePlayer({epoch:seed.epoch,id:seed.b.id,revision:1});new BroadcastChannel('jumvi-local-invalidation-v1').postMessage('changed');},{root,seed});
 await expect(page.locator('#session-player')).toHaveValue('');await expect(page.locator('.mission-completed')).toHaveCount(0);
});
test('36th distinct report unlocks certificate in the result; fresh page has no actor',async({page})=>{
 await page.goto('/');await expect(page.locator('[data-start]')).toBeEnabled();const id=await page.evaluate(async root=>{const {LocalRepository}=await import(root),r=new LocalRepository(),s=await r.snapshot(),p=await r.create({epoch:s.epoch,name:'SYNTHETIC_CERT'});for(let i=1;i<=36;i++){if(i===25)continue;const id=`m${String(i).padStart(2,'0')}`,op=await r.prepare({id,epoch:s.epoch,targetId:p.id,targetRevision:p.revision,report:{id,missionId:id,mechanicsVersion:'synthetic',roundId:null,value:'complete',revision:1}});await r.commit(op.id,s.epoch);}return p.id;},root);
 await page.reload();await expect(page.locator('#session-player')).toHaveValue('');await page.locator('#session-player').selectOption(id);await finish(page,false);await expect(page.locator('.journey-count')).toContainText('36/36');await page.getByRole('button',{name:'Your certificate is ready — view it'}).click();await expect(page.getByRole('dialog')).toBeVisible();await expect(page.getByRole('dialog').getByRole('img')).toHaveAttribute('alt',/SYNTHETIC_CERT/);
});
test('failed quick save is honest and can retry the original report without a second player',async({page})=>{
 await page.goto('/');await expect(page.locator('[data-start]')).toBeEnabled();await page.evaluate(async root=>{const {LocalRepository}=await import(root),r=new LocalRepository(),s=await r.snapshot();await r.create({epoch:s.epoch,name:'SYNTHETIC_RETRY'});window.restorePrepare=LocalRepository.prototype.prepare;LocalRepository.prototype.prepare=async()=>{throw Error('synthetic unavailable');};},root);
 await finish(page,false);await page.getByRole('button',{name:'Keep my progress',exact:true}).click();await page.getByRole('button',{name:'Save for SYNTHETIC_RETRY',exact:true}).click();
 await expect(page.locator('.report-summary')).not.toContainText('was saved');expect((await snap(page)).records).toHaveLength(0);await page.getByRole('button',{name:'Open record status',exact:true}).click();
 await page.evaluate(async root=>{const {LocalRepository}=await import(root);LocalRepository.prototype.prepare=window.restorePrepare;},root);await page.getByRole('button',{name:'Check / retry the same operation',exact:true}).click();await expect(page.getByText(/Saved to this player on this device/)).toBeVisible();const s=await snap(page);expect(s.records).toHaveLength(1);expect(s.players).toHaveLength(1);
});
test('leaving quick creation before its result does not save or leave controls stuck busy',async({page})=>{
 await page.goto('/');await expect(page.locator('[data-start]')).toBeEnabled();await finish(page,false);await page.getByRole('button',{name:'Keep my progress',exact:true}).click();await page.getByRole('button',{name:'New player',exact:true}).click();
 await page.evaluate(async root=>{const {LocalRepository}=await import(root),create=LocalRepository.prototype.create;window.createGate=new Promise(resolve=>window.releaseCreate=resolve);LocalRepository.prototype.create=async function(...args){await window.createGate;return create.apply(this,args);};},root);
 await page.getByLabel('Nickname (optional)').fill('SYNTHETIC_CANCEL');await page.getByRole('button',{name:'Create player and save this mission',exact:true}).click();await page.getByRole('button',{name:'Go back',exact:true}).click();await page.evaluate(()=>window.releaseCreate());await expect(page.getByRole('button',{name:'Save for SYNTHETIC_CANCEL',exact:true})).toBeEnabled();expect((await snap(page)).records).toHaveLength(0);
});

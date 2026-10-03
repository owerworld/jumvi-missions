import {test,expect} from '@playwright/test';
for(const tr of [false,true])test(`personal controls reflow with a long nickname and enlarged text ${tr?'TR':'EN'}`,async({page})=>{
 await page.setViewportSize({width:320,height:844});await page.goto(tr?'/tr/':'/');await expect(page.locator('[data-start]')).toBeEnabled();
 const name='WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW';
 await page.locator('#profile-menu-toggle').click();await page.getByRole('button',{name:tr?'Oyuncu işlemleri':'Player options',exact:true}).click();
 await page.getByRole('button',{name:tr?'Yeni oyuncu':'New player',exact:true}).click();await page.getByLabel(tr?'Takma ad (isteğe bağlı)':'Nickname (optional)',{exact:true}).fill(name);
 await page.getByRole('button',{name:tr?'Oyuncu oluştur':'Create player',exact:true}).click();
 const fits=async()=>{expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);const overflow=await page.locator('.control').evaluateAll(nodes=>nodes.filter(n=>n.scrollWidth>n.clientWidth+2).map(n=>n.textContent));expect(overflow).toEqual([]);};
 await page.evaluate(()=>{document.documentElement.style.fontSize='200%';dispatchEvent(new Event('resize'));});await fits();
 await page.locator('.context-mission').click();await expect(page.locator('[data-start]')).toBeEnabled();await page.locator('[data-start]').click();await page.locator('.stop-action').click();
 await page.getByRole('button',{name:tr?'Tamamladığımı bildir':'Report that I completed it',exact:true}).click();await page.getByRole('button',{name:tr?'İlerlememi tut':'Keep my progress',exact:true}).click();await fits();
 const back=page.getByRole('button',{name:tr?'Kaydedilmemiş bildirimime dön':'Back to my unsaved report',exact:true});expect((await back.boundingBox()).height).toBeGreaterThanOrEqual(56);await back.click();await expect(page.locator('[data-view=report]')).toBeVisible();
});
test('empty local history does not offer an actionable delete-all operation',async({page})=>{
 await page.goto('/');await expect(page.locator('[data-start]')).toBeEnabled();await page.locator('#profile-menu-toggle').click();await page.getByRole('button',{name:'Player options',exact:true}).click();
 await expect(page.getByRole('button',{name:'Delete all local player and history data',exact:true})).toBeDisabled();
 await page.getByRole('button',{name:'New player',exact:true}).click();await page.getByRole('button',{name:'Create player',exact:true}).click();
 await expect(page.getByRole('button',{name:'Delete all local player and history data',exact:true})).toBeEnabled();
});

for(const reason of ['navigation','corrected history'])test(`a slow certificate does not open after ${reason}`,async({page})=>{
 await page.goto('/');await expect(page.locator('[data-start]')).toBeEnabled();
 await page.evaluate(async()=>{const root=document.querySelector('script[src$="/main.js"]').src.split('/client/')[0],{LocalRepository}=await import(root+'/client/repository/local.js'),r=new LocalRepository(),s=await r.snapshot(),p=await r.create({epoch:s.epoch,name:'Example player'}),catalog=await fetch(root+'/content/catalog.json').then(r=>r.json());for(const m of catalog.missions){const id='synthetic-'+m.id;await r.prepare({id,epoch:s.epoch,targetId:p.id,targetRevision:p.revision,report:{id,missionId:m.id,mechanicsVersion:'fixture',roundId:null,value:'complete',revision:1}});await r.commit(id,s.epoch)}r.close();});
 await page.locator('#profile-menu-toggle').click();await page.getByRole('button',{name:'Player options',exact:true}).click();await page.getByRole('button',{name:'View history: Example player',exact:true}).click();
 let resume,entered;const waiting=new Promise(ok=>entered=ok),released=new Promise(ok=>resume=ok);await page.route('**/assets/certificate/*.png',async route=>{entered();await released;await route.continue();});
 // Signal that image generation has actually finished; do not rely on a delay.
 await page.evaluate(()=>{const original=HTMLCanvasElement.prototype.toBlob;HTMLCanvasElement.prototype.toBlob=function(callback,...args){return original.call(this,blob=>{callback(blob);setTimeout(()=>window.certificateFinished=true,0);},...args);};});
 await page.getByRole('button',{name:'Preview certificate',exact:true}).click();await waiting;
 if(reason==='navigation'){await page.locator('.context-mission').click();await expect(page.locator('[data-view=entry]')).toBeVisible();}
 else await page.evaluate(async()=>{const root=document.querySelector('script[src$="/main.js"]').src.split('/client/')[0],{LocalRepository}=await import(root+'/client/repository/local.js'),r=new LocalRepository(),s=await r.snapshot(),record=s.records[0];await r.correctReport({id:record.id,epoch:s.epoch,revision:record.revision,value:'early'});r.close();});
 resume();
 await expect.poll(()=>page.evaluate(()=>window.certificateFinished)).toBe(true);await expect(page.getByRole('dialog')).toHaveCount(0);
 if(reason==='navigation')await expect(page.locator('[data-start]')).toBeEnabled();
});

test('dark ready button remains legible throughout loading-to-ready transition',async({page})=>{
 await page.emulateMedia({colorScheme:'dark'});await page.goto('/');await expect(page.locator('[data-start]')).toBeEnabled();await page.mouse.move(0,0);
 const colors=await page.locator('[data-start]').evaluate(button=>{
  button.disabled=true;getComputedStyle(button).backgroundColor;
  // Finish the disabled-state transition before changing readiness.
  for(const a of button.getAnimations())a.finish();
  button.disabled=false;getComputedStyle(button).backgroundColor;
  const animations=button.getAnimations();for(const a of animations){a.pause();a.currentTime=60;}
  const style=getComputedStyle(button);return {ink:style.color,background:style.backgroundColor};
 });
 const luminance=value=>{const c=value.match(/[\d.]+/g).slice(0,3).map(Number).map(x=>x/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);return c[0]*.2126+c[1]*.7152+c[2]*.0722;};
 const a=luminance(colors.ink),b=luminance(colors.background);expect((Math.max(a,b)+.05)/(Math.min(a,b)+.05)).toBeGreaterThanOrEqual(3);
});

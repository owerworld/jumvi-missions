import {test,expect,devices} from '@playwright/test';
import {readFileSync} from 'node:fs';
const release=JSON.parse(readFileSync('dist/release-manifest.json')).release;
for(const tr of [false,true])test(`appearance follows system, overrides, persists and reflows ${tr?'TR':'EN'}`,async({page})=>{
 await page.emulateMedia({colorScheme:'dark'});await page.goto(tr?'/tr/':'/');await expect(page.locator('[data-start]')).toBeEnabled();
 await expect(page.locator('html')).toHaveAttribute('data-theme','dark');await page.locator('#profile-menu-toggle').click();
 const select=page.locator('#appearance');await expect(select).toHaveValue('system');await select.selectOption('light');await expect(page.locator('html')).toHaveAttribute('data-theme','light');
 await page.reload();await page.locator('#profile-menu-toggle').click();await expect(select).toHaveValue('light');await select.selectOption('system');
 await page.emulateMedia({colorScheme:'light'});await expect(page.locator('html')).toHaveAttribute('data-theme','light');await page.emulateMedia({colorScheme:'dark'});await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
 for(const width of [320,360,375,390,393,402,412,430,440,852])for(const size of [100,200]){
  await page.setViewportSize({width,height:width===852?393:844});await page.evaluate(size=>{document.documentElement.style.fontSize=size+'%';dispatchEvent(new Event('resize'));},size);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);const b=await select.boundingBox();expect(b.width).toBeGreaterThan(100);
 }
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>{document.documentElement.style.fontSize='100%';dispatchEvent(new Event('resize'));});
 await page.screenshot({path:`review-assets/2026-10-03/pwa-theme/menu-${tr?'tr':'en'}-${test.info().project.name}.png`,fullPage:true});
 await page.locator('#profile-menu-toggle').press('Escape');await page.locator('[data-start]').click();await expect(page.locator('.stop-action')).toBeVisible();
 await page.locator('.stop-action').click();await expect(page.locator('[data-view=stopped]')).toBeVisible();
});
test('first installation prepares the selected mission without a reload',async({page})=>{
 await page.goto('/');await expect(page.locator('[data-start]')).toBeEnabled();
 const ready=await page.evaluate(async release=>{const o=await import(`/releases/${release}/client/offline.js`);await o.setupOffline();return o.prepareOffline('m07');},release);expect(ready).toBe(true);
});

test('dark appearance contrast in play, help, menu and discovery',async({page})=>{
 const {createRequire}=await import('node:module'),require=createRequire(import.meta.url);
 await page.emulateMedia({colorScheme:'dark',reducedMotion:'reduce'});await page.goto('/');await expect(page.locator('[data-start]')).toBeEnabled();
 const check=async()=>{await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')});const r=await page.evaluate(()=>axe.run('#app',{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}}));expect(r.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}))).toEqual([]);};
 await check();await page.locator('#profile-menu-toggle').click();await check();await page.locator('#profile-menu-toggle').press('Escape');
 await page.locator('[data-start]').click();await check();await page.locator('.active-control').first().click();await check();
 await page.getByRole('button',{name:'Back to this round',exact:true}).first().click();await page.locator('.stop-action').click();await check();await page.getByRole('button',{name:'Another mission',exact:true}).click();await check();
});

for(const name of ['iPhone 13 Mini','iPhone 16','iPhone 16 Pro Max','Galaxy S24','Pixel 8'])test(`touch journey on ${name} device preset (emulation)`,async({browser})=>{
 const context=await browser.newContext({...devices[name],colorScheme:'dark'}),page=await context.newPage();
 try{await page.goto('http://127.0.0.1:8919/');await expect(page.locator('[data-start]')).toBeEnabled();await page.locator('[data-start]').tap();
 for(const landscape of [false,true]){const v=devices[name].viewport;await page.setViewportSize(landscape?{width:v.height,height:v.width}:v);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);const stop=await page.locator('.stop-action').boundingBox();expect(stop.height).toBeGreaterThanOrEqual(64);}
 await page.locator('.active-control').first().tap();await expect(page.locator('[data-view=help]')).toBeVisible();await page.getByRole('button',{name:'Back to this round',exact:true}).first().tap();await page.locator('.stop-action').tap();await expect(page.locator('[data-view=stopped]')).toBeVisible();
 }finally{await context.close();}
});

test('V2 install metadata, scope, first-install offline and local theme isolation',async({browser})=>{
 test.setTimeout(90000);const {serveCoexist}=await import('../../tools/serve-v2-coexist.mjs'),{server,origin,state}=await serveCoexist(0),context=await browser.newContext(),page=await context.newPage();
 try{for(const path of ['/v2/','/v2/tr/']){
 await page.goto(origin+path);await expect(page.locator('[data-start]')).toBeEnabled();
 const manifest=await page.evaluate(async()=>fetch(document.querySelector('link[rel=manifest]').href).then(r=>r.json()));expect(manifest.id).toBe('/v2/');expect(manifest.scope).toBe('/v2/');expect(manifest.start_url).toBe(path);expect(manifest.name).toBe('JUMVI');expect(manifest.display).toBe('standalone');
 for(const icon of manifest.icons){const response=await context.request.get(origin+icon.src);expect(response.status()).toBe(200);const size=icon.sizes.split('x').map(Number);const dimensions=await page.evaluate(async src=>{const i=new Image();i.src=src;await i.decode();return [i.naturalWidth,i.naturalHeight];},icon.src);expect(dimensions).toEqual(size);}
 expect(await page.locator('link[rel=apple-touch-icon]').getAttribute('href')).toContain('/v2/releases/');
 await page.locator('#profile-menu-toggle').click();await page.locator('#appearance').selectOption('dark');expect(await page.evaluate(()=>localStorage.getItem('jumvi-v2:appearance.v1'))).toBe('dark');expect(await page.evaluate(()=>localStorage.getItem('appearance.v1'))).toBeNull();
 const ready=await page.evaluate(async()=>{const source=document.querySelector('script[src$="/main.js"]').src;const o=await import(new URL('offline.js',source));await o.setupOffline();return o.prepareOffline('m25');});expect(ready).toBe(true);
 }
 await page.reload();await expect(page.locator('[data-start]')).toBeEnabled();state.offline=true;await page.reload();await expect(page.locator('[data-start]')).toBeEnabled();await expect(page.locator('html')).toHaveAttribute('data-theme','dark');await page.locator('[data-start]').click();await page.locator('.stop-action').click();await expect(page.locator('[data-view=stopped]')).toBeVisible();
 }finally{await context.close();await new Promise(ok=>server.close(ok));}
});

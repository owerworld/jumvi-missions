import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
const release=JSON.parse(readFileSync('dist/release-manifest.json')).release;
test('EN/TR semantic shells load without legacy runtime or errors',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));const req=[];page.on('request',r=>req.push(new URL(r.url()).pathname));
 for(const [path,lang] of [['/','en-US'],['/tr','tr']]){await page.goto(path);await expect(page.locator('main')).toHaveAttribute('aria-busy','false');await expect(page.locator('html')).toHaveAttribute('lang',lang);await expect(page.locator('main h1')).toBeFocused();}
 expect(errors).toEqual([]);expect(req.filter(p=>['/app.js','/data.js','/tr/i18n.js','/service-worker.js'].includes(p))).toEqual([]);
});
test('all 17 skeletons have one heading and native controls, no data input',async({page})=>{
 await page.goto('/tr');await expect(page.locator('main')).toHaveAttribute('aria-busy','false');
 const result=await page.evaluate(async release=>{const {views}=await import(`/releases/${release}/client/views/index.js`);const ui=await fetch(`/releases/${release}/content/ui/tr.json`).then(r=>r.json());const fixture=await fetch(`/releases/${release}/content/missions/m25.json`).then(r=>r.json());const assetManifest=await fetch(`/releases/${release}/content/asset-manifest.json`).then(r=>r.json());return Object.entries(views).map(([name,view])=>{const n=view({ui,cp:fixture.locale.tr,assetManifest,audio:{snapshot(){return {preference:false};}},state:{mission:{ready:true},report:{value:'early'}},send(){}});document.querySelector('main').replaceChildren(n);return {name,h1:n.querySelectorAll('h1').length,invalid:n.querySelectorAll('[role=button]:not(button),[onclick]:not(button),input').length,targets:[...n.querySelectorAll('button')].every(b=>b.getBoundingClientRect().height>=56)};});},release);
 expect(result).toHaveLength(17);for(const r of result){expect(r.h1,r.name).toBe(1);expect(r.invalid,r.name).toBe(0);expect(r.targets,r.name).toBe(true);}
});
test('reload never resurrects active state from history',async({page})=>{await page.goto('/tr');await expect(page.locator('main')).toHaveAttribute('aria-busy','false');await page.evaluate(()=>history.replaceState({jumvi:true,screen:'active',hasRound:true},''));await page.reload();await expect(page.locator('section')).toHaveAttribute('data-view','interrupted');await expect(page.getByRole('button',{name:'Yeni tur başlat',exact:true})).toBeVisible();});

import {chromium,webkit} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {firstDay} from '../contract.mjs';
const require=createRequire(import.meta.url),out=new URL('../../review-assets/2026-10-04/private-insights/',import.meta.url);await mkdir(out,{recursive:true});
const results=[];
for(const [name,engine] of Object.entries({chromium,webkit})){
 const browser=await engine.launch();
 for(const width of [320,390,1280]){
  const page=await browser.newPage({viewport:{width,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8962/');await page.locator('#results[aria-busy=false]').waitFor();assert.match(await page.locator('#mode').textContent(),/ÖRNEK VERİ/);assert.equal(await page.locator('#missions tr').count(),36);
  const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#export-json').click()]);const report=JSON.parse(await readFile(await download.path(),'utf8'));assert.equal(report.mode,'demo');assert.equal(report.synthetic,true);assert.equal(report.period.locale,'all');assert.equal(report.activeRetentionDays,90);
  const before=await page.locator('.card b').first().textContent();await page.locator('#days').selectOption('7');await page.waitForFunction(start=>document.querySelector('#range').textContent.includes(start),firstDay(7));assert.notEqual(await page.locator('.card b').first().textContent(),before);
  await page.locator('#locale').selectOption('tr');await page.waitForFunction(()=>document.querySelector('#range').textContent.endsWith('tr'));
  await page.locator('#sort').selectOption('help_open');const values=await page.locator('#missions tr td:nth-child(4)').allTextContents();assert.deepEqual(values.map(Number),values.map(Number).sort((a,b)=>b-a));
  await page.getByText('Günlük sayıları tablo olarak aç',{exact:true}).click();assert.equal(await page.locator('#daily tr').count(),7);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')});const a11y=await page.evaluate(async()=>{const r=await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}});return r.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.length}));});assert.deepEqual(a11y,[]);
  await page.locator('#days').selectOption('28');await page.locator('#locale').selectOption('all');await page.locator('#results[aria-busy=false]').waitFor();await page.getByText('Günlük sayıları tablo olarak aç',{exact:true}).click();await page.locator('#sort').selectOption('mission_open');await page.evaluate(()=>scrollTo(0,0));
  await page.screenshot({path:new URL(`${name}-${width}.png`,out).pathname,fullPage:width===1280?false:true});
  await page.addStyleTag({content:'body{font-size:34px}'});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  assert.deepEqual(errors,[]);results.push({engine:name,width,exportVerified:true,filters:true,missionRows:36,noPageOverflow:true,axeViolations:a11y.length,bodyTextScale200NoPageOverflow:true,realPhone:false});await page.close();
 }
 const p=await browser.newPage();await p.goto('http://127.0.0.1:8962/');await p.locator('#results[aria-busy=false]').waitFor();await p.route('**/api/summary?**',r=>r.fulfill({status:503,body:'unavailable'}));await p.locator('#refresh').click();await p.locator('#error').waitFor({state:'visible'});assert.equal(await p.locator('#refresh').isEnabled(),true);assert.equal(await p.locator('#export-csv').isVisible(),false);results.push({engine:name,errorRecovery:true});await browser.close();
}
await writeFile(new URL('browser-results.json',out),JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));

import {chromium} from '@playwright/test';
import {serve} from '../../tools/serve-app.mjs';
import {resolve} from 'node:path';
import {writeFileSync} from 'node:fs';
const base=resolve('review-assets/2026-09-27'),server=await serve(8951),browser=await chromium.launch(),results=[];
try{
 for(const locale of ['tr','en-US'])for(const width of [320,390,430])for(const text of [100,200]){
  const context=await browser.newContext({viewport:{width,height:844},serviceWorkers:'block'}),page=await context.newPage();
  await page.goto('http://127.0.0.1:8951'+(locale==='tr'?'/tr':'/'));
  await page.locator('[data-start]:not([disabled])').waitFor();
  await page.getByRole('button',{name:locale==='tr'?'Başka uygun görev':'Find another suitable mission',exact:true}).click();
  await page.locator('[data-mission-id=m07] button').click();await page.locator('[data-start]:not([disabled])').waitFor();
  if(text===200)await page.evaluate(()=>{document.documentElement.style.fontSize='200%';dispatchEvent(new Event('resize'));});
  const snapshot=async name=>{
   const dimensions=await page.evaluate(()=>({innerWidth,innerHeight,scrollWidth:document.documentElement.scrollWidth,textSize:getComputedStyle(document.documentElement).fontSize}));
   if(dimensions.scrollWidth>dimensions.innerWidth+1)throw Error('Overflow '+JSON.stringify(dimensions));
   results.push({locale,width,text,screen:name,method:text===200?'document root font-size 200%; NOT browser zoom':'normal desktop viewport',...dimensions});
   await page.screenshot({path:resolve(base,`ss-layout-m07-${locale}-${width}-text${text}-${name}.png`),fullPage:true});
  };
  await snapshot('entry');await page.getByRole('button',{name:locale==='tr'?'Açıklama / yardım':'How to play / help',exact:true}).click();await snapshot('help');
  await page.getByRole('button',{name:locale==='tr'?'Göreve dön':'Back to the mission',exact:true}).first().click();await page.locator('[data-start]').click();await snapshot('active');
  await context.close();
 }
 writeFileSync(resolve(base,'ss-layout-m07-layout-measurements.json'),JSON.stringify(results,null,2));
 console.log('36 source screen captures; TR/EN 320/390/430 normal and 200% text; no overflow');
}finally{await browser.close();await new Promise(ok=>server.close(ok));}

import {chromium} from '@playwright/test';import {serve} from '../../tools/serve-app.mjs';import {writeFileSync} from 'node:fs';
const server=await serve(8952),browser=await chromium.launch(),out='review-assets/2026-09-28',measurements=[];
try{for(const locale of ['tr','en-US'])for(const width of [320,390,430])for(const text of [100,200]){
 const context=await browser.newContext({viewport:{width,height:844},serviceWorkers:'block'}),page=await context.newPage();await page.goto('http://127.0.0.1:8952'+(locale==='tr'?'/tr':'/'));await page.locator('[data-start]:not([disabled])').waitFor();
 await page.getByRole('button',{name:locale==='tr'?'Başka uygun görev':'Find another suitable mission',exact:true}).click();await page.locator('[data-mission-id=m01] button').click();await page.locator('[data-start]:not([disabled])').waitFor();
 if(text===200)await page.evaluate(()=>{document.documentElement.style.fontSize='200%';dispatchEvent(new Event('resize'));});
 for(const screen of ['entry','help','active']){
  if(screen==='help')await page.getByRole('button',{name:locale==='tr'?'Açıklama / yardım':'How to play / help',exact:true}).click();
  if(screen==='active'){await page.getByRole('button',{name:locale==='tr'?'Göreve dön':'Back to the mission',exact:true}).first().click();await page.locator('[data-start]').click();}
  await page.locator('img').evaluateAll(imgs=>Promise.all(imgs.map(i=>i.decode())));
  const measure=await page.evaluate(()=>({innerWidth,innerHeight,scrollWidth:document.documentElement.scrollWidth,fontSize:getComputedStyle(document.documentElement).fontSize,controls:[...document.querySelectorAll('.active-actions button')].map(b=>({text:b.textContent,...b.getBoundingClientRect().toJSON()}))}));
  if(measure.scrollWidth>width+1)throw Error('Overflow '+JSON.stringify(measure));measurements.push({locale,width,text,screen,...measure});await page.screenshot({path:`${out}/upright-m01-${locale}-${width}-text${text}-${screen}.png`,fullPage:true});
 }
 await context.close();}
 writeFileSync(`${out}/responsive-measurements.json`,JSON.stringify({method:'Desktop browser CSS viewport; 200% root font size separately from normal. Not browser zoom or physical phone QA.',measurements},null,2));console.log('36 current-build customer screen captures verified');
}finally{await browser.close();await new Promise(r=>server.close(r));}

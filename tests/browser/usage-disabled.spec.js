import {test,expect} from '@playwright/test';
import {serveCoexist} from '../../tools/serve-v2-coexist.mjs';
for(const locale of ['en-US','tr'])test(`V2 usage collector remains off through play/report ${locale}`,async({page})=>{
 const replica=await serveCoexist(0),outbound=[];
 page.on('request',request=>{if(request.method()==='POST'||/metrics|beacon/.test(request.url()))outbound.push(request.url());});
 try{
  await page.goto(replica.origin+(locale==='tr'?'/v2/tr/':'/v2/'));await expect(page.locator('[data-start]')).toBeEnabled();
  await page.getByRole('button',{name:locale==='tr'?'Açıklama / yardım':'How to play / help',exact:true}).click();await expect(page.locator('[data-view=help]')).toBeVisible();
  await page.goBack();await expect(page.locator('[data-start]')).toBeEnabled();await page.locator('[data-start]').click();await expect(page.locator('[data-view=active]')).toBeVisible();await page.locator('.stop-action').click();
  await page.getByRole('button',{name:locale==='tr'?'Tamamladığımı bildir':'Report that I completed it',exact:true}).click();await expect(page.locator('[data-view=report]')).toBeVisible();
  const disabled=await page.evaluate(async()=>{const root=document.querySelector('script[src$="/main.js"]').src.split('/client/')[0];return (await import(root+'/client/media/usage-counts.js')).USAGE_COLLECTION_ENABLED===false;});expect(disabled).toBe(true);expect(outbound).toEqual([]);
 }finally{await replica.stopOrigin();}
});

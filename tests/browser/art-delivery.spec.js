import {test,expect} from '@playwright/test';
import http from 'node:http';
import {readFileSync} from 'node:fs';
import {serveCoexist} from '../../tools/serve-v2-coexist.mjs';

test('real browser allows mission art and Start on its own origin, blocks foreign image embedding with or without referrer',async({page})=>{
 const app=await serveCoexist(0);
 const manifest=JSON.parse(readFileSync('dist-v2/v2/release-manifest.json'));
 const file=manifest.files.find(x=>x.path.endsWith('/m25/seated-editorial-v1.webp'));
 const foreign=http.createServer((req,res)=>{
  res.writeHead(200,{'Content-Type':'text/html','Referrer-Policy':req.url==='/no-referrer'?'no-referrer':'strict-origin-when-cross-origin'});
  res.end(`<!doctype html><title>Disposable embedding QA</title><img id="copy" src="${app.origin+file.path}" onload="this.dataset.result='loaded'" onerror="this.dataset.result='blocked'">`);
 });
 await new Promise(resolve=>foreign.listen(0,'127.0.0.1',resolve));
 try{
  for(const path of ['/','/no-referrer']){
   await page.goto('http://localhost:'+foreign.address().port+path);
   await expect(page.locator('#copy')).toHaveAttribute('data-result','blocked');
   // CORP rejection may expose requestfailed rather than response in the browser.
   // Verify the server's exact rejection separately, without weakening the DOM check.
   const denied=await page.request.get(app.origin+file.path,{headers:path==='/no-referrer'?{'Sec-Fetch-Site':'cross-site'}:{Referer:'http://localhost:'+foreign.address().port+'/'}});
   expect(denied.status()).toBe(403);
  }
  await page.goto(app.origin+'/v2/');
  await expect(page.locator('[data-start]')).toBeEnabled({timeout:30000});
  expect(await page.locator('main figure img').first().evaluate(img=>img.complete&&img.naturalWidth>0)).toBe(true);
  await page.locator('[data-start]').click();
  await expect(page.locator('[data-view=active]')).toBeVisible();
 }finally{
  await page.goto('about:blank').catch(()=>{});
  foreign.closeAllConnections();await new Promise(r=>foreign.close(r));
  app.server.closeAllConnections();await new Promise(r=>app.server.close(r));
 }
});

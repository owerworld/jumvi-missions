import {test,expect} from '@playwright/test';
import {openEntryOptions} from './helpers/entry-options.js';
for(const locale of ['en-US','tr'])test(`new print books are optional, readable and reachable: ${locale}`,async({page})=>{
 const tr=locale==='tr',pdfRequests=[];page.on('request',r=>{if(new URL(r.url()).pathname.endsWith('.pdf'))pdfRequests.push(r.url());});
 await page.setViewportSize({width:320,height:844});await page.goto(tr?'/tr/':'/');await expect(page.locator('[data-start]')).toBeEnabled();expect(pdfRequests).toEqual([]);
 await openEntryOptions(page);await page.getByRole('button',{name:tr?'Yetişkinler':'Grown-ups',exact:true}).click();
 const resources=page.locator('.parent-resources');await expect(resources).toBeVisible();expect(pdfRequests).toEqual([]);
 const home=resources.getByRole('link',{name:tr?'Evde baskı PDF’sini aç · 25,9 MB':'Open home-print PDF · 25.9 MB'});await expect(home).toHaveAttribute('target','_blank');await expect(home).toHaveAttribute('type','application/pdf');await expect(home).toHaveAttribute('href',/mission-book-home-print-en-US-v2.pdf$/);
 await resources.getByText(tr?'Matbaa için baskı dosyası':'For professional printing',{exact:true}).click();const master=resources.getByRole('link',{name:tr?'Matbaa PDF’sini aç':'Open print-master PDF'});await expect(master).toBeVisible();await expect(master).toHaveAttribute('href',/mission-book-print-master-en-US-v2.pdf$/);
 const r=await page.request.get(await master.getAttribute('href'));expect(r.status()).toBe(200);expect((await r.body()).length).toBe(26038811);
 await page.addStyleTag({content:'html{font-size:200%}'});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 for(const link of [home,master]){const box=await link.boundingBox();expect(box.width).toBeLessThanOrEqual(320);expect(box.height).toBeGreaterThanOrEqual(48);}
 expect(pdfRequests).toEqual([]); // request-context verification is not an automatic page download
 await page.getByRole('button',{name:tr?'Göreve dön':'Back to the mission',exact:true}).click();await expect(page.locator('[data-start]')).toBeEnabled();
});

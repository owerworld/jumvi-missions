import {test,expect} from '@playwright/test';
const open=async(page,tr=true)=>{await page.goto(tr?'/tr/':'/');await expect(page.locator('[data-start]')).toBeEnabled();};
const choose=async(page,id,tr=true)=>{await page.getByRole('button',{name:tr?'Başka uygun görev':'Find another suitable mission',exact:true}).click();await page.locator(`[data-mission-id=${id}] button`).click();await expect(page.locator('[data-start]')).toBeEnabled();};
for(const tr of [true,false])for(const width of [320,390,430])test(`R2 active text 200 reflow ${tr?'TR':'EN'} ${width}`,async({page})=>{
 await page.setViewportSize({width,height:844});await open(page,tr);await page.evaluate(()=>{document.documentElement.style.fontSize='200%';dispatchEvent(new Event('resize'));});await page.locator('[data-start]').click();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
 const boxes=await page.locator('.active-contact').evaluate(e=>{const a=e.firstElementChild.getBoundingClientRect(),p=e.querySelector('p').getBoundingClientRect();return {artBottom:a.bottom,textTop:p.top,textWidth:p.width,available:e.clientWidth};});
 expect(boxes.textTop).toBeGreaterThanOrEqual(boxes.artBottom-1);expect(boxes.textWidth).toBeGreaterThanOrEqual(boxes.available-1);
 for(const b of await page.locator('.active-control').all()){const r=await b.boundingBox();expect(r.x+r.width).toBeLessThanOrEqual(width);expect(r.height).toBeGreaterThanOrEqual(128);}
});
test('R2 browser back/forward restores mission and discovery reading positions',async({page})=>{
 await open(page);const other=page.getByRole('button',{name:'Başka uygun görev',exact:true});await other.scrollIntoViewIfNeeded();const entryY=await page.evaluate(()=>scrollY);await other.click();await expect(page.locator('[data-view=discovery]')).toBeVisible();await expect.poll(()=>page.evaluate(()=>scrollY)).toBe(0);
 const m30=page.locator('[data-mission-id=m30] button');await m30.scrollIntoViewIfNeeded();const listY=await page.evaluate(()=>scrollY);await m30.click();await expect(page.locator('[data-start]')).toBeEnabled();await page.goBack();await expect(page.locator('[data-view=discovery]')).toBeVisible();await expect.poll(()=>page.evaluate(()=>scrollY)).toBeCloseTo(listY,0);await expect(m30).toBeFocused();
 await page.goBack();await expect(page.locator('[data-view=entry]')).toBeVisible();await expect(page.locator('h1')).toHaveText('Sakin Yakala');await expect.poll(()=>page.evaluate(()=>scrollY)).toBeCloseTo(entryY,0);await page.goForward();await expect(page.locator('[data-view=discovery]')).toBeVisible();await expect.poll(()=>page.evaluate(()=>scrollY)).toBeCloseTo(listY,0);await page.goForward();await expect(page.locator('h1')).toHaveText('Sol mu Sağ mı?');
});
for(const tr of [true,false])for(const width of [320,390,430])for(const enlarged of [false,true])test(`R2 catalogue reflow ${tr?'TR':'EN'} ${width} text${enlarged?200:100}`,async({page})=>{
 test.setTimeout(120000);await page.setViewportSize({width,height:844});await open(page,tr);
 if(enlarged)await page.evaluate(()=>{document.documentElement.style.fontSize='200%';dispatchEvent(new Event('resize'));});
 for(let n=1;n<=36;n++){const id='m'+String(n).padStart(2,'0');await choose(page,id,tr);await page.locator('[data-start]').click();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth),id).toBeLessThanOrEqual(width);
  for(const b of await page.locator('.active-control').all()){const box=await b.boundingBox();expect(box.x+box.width,id).toBeLessThanOrEqual(width);expect(box.height,id).toBeGreaterThanOrEqual(enlarged?128:64);}
  await page.getByRole('button',{name:tr?'Turu durdur':'Stop this round',exact:true}).click();await page.getByRole('button',{name:tr?'Ayrıl':'Leave',exact:true}).click();
 }
});
test('R2 help new-entry, in-app return, late image layout and safe round Back',async({page})=>{
 await page.route('**/*.webp',async route=>{await new Promise(r=>setTimeout(r,40));await route.continue();});await open(page);const help=page.getByRole('button',{name:'Açıklama / yardım',exact:true});await help.scrollIntoViewIfNeeded();const y=await page.evaluate(()=>scrollY);await help.click();await expect.poll(()=>page.evaluate(()=>scrollY)).toBe(0);await page.getByRole('button',{name:'Göreve dön',exact:true}).first().click();await expect.poll(()=>page.evaluate(()=>scrollY)).toBeCloseTo(y,0);await expect(help).toBeFocused();await page.locator('[data-start]').click();await page.goBack();await expect(page.locator('[data-view=interrupted]')).toBeVisible();await page.goForward();await expect(page.locator('[data-view=active]')).toHaveCount(0);
});
test('R2 narrow Turkish Help wraps at a syllable, not a single orphan letter',async({page})=>{
 await page.setViewportSize({width:320,height:844});await open(page);await page.evaluate(()=>{document.documentElement.style.fontSize='200%';dispatchEvent(new Event('resize'));});await page.locator('[data-start]').click();const help=page.getByRole('button',{name:'Yardım / açıklama',exact:true});await expect(help).toHaveAccessibleName('Yardım / açıklama');expect(await help.locator('.control-label').textContent()).toContain('açık\u00adlama');
 const pieces=await help.locator('.control-label').evaluate(el=>{const n=el.firstChild,t=n.textContent,start=t.indexOf('açık');return [[start,start+4],[start+5,start+9]].map(([a,b])=>{const r=document.createRange();r.setStart(n,a);r.setEnd(n,b);return new Set([...r.getClientRects()].filter(x=>x.width>0).map(x=>x.y)).size;});});expect(pieces).toEqual([1,1]);
});

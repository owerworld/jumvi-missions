import {test,expect} from '@playwright/test';
for(const locale of ['tr','en-US'])test(`mission search and player filter preserve context ${locale}`,async({page})=>{
 await page.goto(locale==='tr'?'/tr':'/');await expect(page.locator('[data-start]')).toBeEnabled();
 await page.getByRole('button',{name:locale==='tr'?'Başka uygun görev':'Find another suitable mission',exact:true}).click();
 expect(await page.locator('#mission-search').evaluate(el=>el.getBoundingClientRect().height)).toBeGreaterThanOrEqual(56);
 const search=page.getByLabel(locale==='tr'?'Görev ara':'Search missions');await search.fill(locale==='tr'?'Heykel':'Statue');
 await expect(page.locator('.mission-list>li:visible')).toHaveCount(1);await page.locator('[data-mission-id=m05] button').click();await expect(page.locator('[data-start]')).toBeEnabled();
 await page.goBack();await expect(search).toHaveValue(locale==='tr'?'Heykel':'Statue');await expect(page.locator('.mission-list>li:visible')).toHaveCount(1);
 await page.getByRole('button',{name:locale==='tr'?'Filtreleri temizle':'Clear filters'}).click();await expect(page.locator('.mission-list>li:visible')).toHaveCount(36);
 await page.getByLabel(locale==='tr'?'Kaç oyuncu var?':'How many players?').selectOption('4');await expect(page.locator('[data-mission-id=m05]')).toBeHidden();await expect(page.locator('[data-mission-id=m20]')).toBeVisible();
 await page.screenshot({path:`review-assets/2026-09-25/menu-${locale}-390-normal.png`,fullPage:true});
 await page.setViewportSize({width:320,height:844});await page.evaluate(()=>document.documentElement.style.fontSize='200%');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 await page.screenshot({path:`review-assets/2026-09-25/menu-${locale}-320-text200.png`,fullPage:true});
});

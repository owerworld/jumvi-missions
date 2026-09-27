import {test,expect} from '@playwright/test';
for(const locale of ['tr','en-US'])test(`no search; optional player-count filter preserves context ${locale}`,async({page})=>{
 await page.goto(locale==='tr'?'/tr':'/');await expect(page.locator('[data-start]')).toBeEnabled();
 await page.getByRole('button',{name:locale==='tr'?'Başka uygun görev':'Find another suitable mission',exact:true}).click();
 await expect(page.locator('#mission-search')).toHaveCount(0);await expect(page.locator('.mission-list>li:visible')).toHaveCount(36);
 const filter=page.getByLabel(locale==='tr'?'Kaç oyuncu var?':'How many players?');await filter.selectOption('4');await expect(page.locator('[data-mission-id=m05]')).toBeHidden();await expect(page.locator('[data-mission-id=m20]')).toBeVisible();
 await page.locator('[data-mission-id=m20] button').click();await expect(page.locator('[data-start]')).toBeEnabled();await page.goBack();await expect(filter).toHaveValue('4');
 await page.getByRole('button',{name:locale==='tr'?'Filtreleri temizle':'Clear filters'}).click();await expect(page.locator('.mission-list>li:visible')).toHaveCount(36);
 await page.setViewportSize({width:320,height:844});await page.evaluate(()=>document.documentElement.style.fontSize='200%');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});

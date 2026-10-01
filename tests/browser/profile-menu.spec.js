import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
const release=JSON.parse(readFileSync('dist/release-manifest.json')).release;
for(const tr of [false,true])test(`top-right player menu, keyboard, local identity and reflow ${tr?'TR':'EN'}`,async({page})=>{
 await page.goto(tr?'/tr/':'/');await expect(page.locator('[data-start]')).toBeEnabled();
 const menu=page.locator('.profile-menu'),summary=menu.locator('summary');
 await expect(page.locator('.customer-header .profile-menu')).toHaveCount(1);
 await expect(menu).not.toHaveAttribute('open');
 const logo=await page.locator('.brand').boundingBox(),box=await summary.boundingBox();expect(box.x).toBeGreaterThanOrEqual(logo.x+logo.width);expect(box.y).toBeLessThan(120);expect(box.height).toBeGreaterThanOrEqual(56);
 await summary.focus();await page.keyboard.press('Enter');await expect(menu).toHaveAttribute('open');
 await page.getByRole('button',{name:tr?'Yetişkinler':'Grown-ups',exact:true}).click();await page.getByRole('button',{name:tr?'Göreve dön':'Back to the mission',exact:true}).click();await expect(menu).toHaveAttribute('open');
 await page.keyboard.press('Escape');await expect(menu).not.toHaveAttribute('open');await expect(summary).toBeFocused();
 const name='SYNTHETIC_LONG_NICKNAME';const id=await page.evaluate(async({release,name})=>{const {LocalRepository}=await import(`/releases/${release}/client/repository/local.js`),r=new LocalRepository(),s=await r.snapshot(),p=await r.create({epoch:s.epoch,name});r.close();return p.id;},{release,name});
 await page.reload();await expect(page.locator('[data-start]')).toBeEnabled();await summary.click();await page.locator('#session-player').selectOption(id);await expect(menu).toHaveAttribute('open');await expect(summary).toContainText(name);await expect(menu.locator('.profile-avatar')).toHaveText('S');
 for(const width of [320,390,430])for(const scale of [1,2]){await page.setViewportSize({width,height:844});await page.evaluate(scale=>{document.documentElement.style.fontSize=`${scale*100}%`;dispatchEvent(new Event('resize'));},scale);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);for(const node of await menu.locator('button,select,summary').all()){const b=await node.boundingBox();expect(b.x).toBeGreaterThanOrEqual(0);expect(b.x+b.width).toBeLessThanOrEqual(width+1);}}
 await page.evaluate(()=>{document.documentElement.style.fontSize='100%';dispatchEvent(new Event('resize'));});await page.setViewportSize({width:390,height:844});await summary.click();
 await page.getByRole('button',{name:tr?'Başka uygun görev':'Find another suitable mission',exact:true}).click();await expect(page.locator('.customer-header .profile-menu')).toHaveCount(1);await expect(summary).toContainText(name);await summary.click();await page.locator('#session-player').selectOption('');await expect(summary).toContainText(tr?'Menü':'Menu');
 await page.addScriptTag({content:readFileSync('node_modules/axe-core/axe.min.js','utf8')});expect((await page.evaluate(()=>window.axe.run(document.querySelector('main')))).violations).toEqual([]);
 await page.keyboard.press('Escape');await page.getByRole('button',{name:tr?'Göreve dön':'Back to the mission',exact:true}).first().click();await page.locator('[data-start]').click();await expect(menu).toHaveCount(0);await expect(page.locator('.active-actions button')).toHaveCount(2);
});

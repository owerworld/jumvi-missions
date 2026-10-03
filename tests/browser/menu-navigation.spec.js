import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
const release=JSON.parse(readFileSync('dist/release-manifest.json')).release;
for(const tr of [false,true]){
 test(`nested menus return to their source and browser Forward works ${tr?'TR':'EN'}`,async({page})=>{
  await page.goto(tr?'/tr/':'/');await expect(page.locator('[data-start]')).toBeEnabled();
  await page.getByRole('button',{name:tr?'Başka uygun görev':'Find another suitable mission',exact:true}).click();
  await page.locator('.profile-menu > summary').click();await page.getByRole('button',{name:tr?'Yetişkinler':'Grown-ups',exact:true}).click();
  await page.getByRole('button',{name:tr?'Oyuncular ve ilerleme':'Players & progress',exact:true}).click();
  for(const width of [320,390,430]){await page.setViewportSize({width,height:844});await page.evaluate(()=>{document.documentElement.style.fontSize='200%';dispatchEvent(new Event('resize'));});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);}await page.evaluate(()=>{document.documentElement.style.fontSize='100%';dispatchEvent(new Event('resize'));});
  await page.locator('.context-back').click();await expect(page.locator('[data-view=adult]')).toBeVisible();
  await page.locator('.context-back').click();await expect(page.locator('[data-view=discovery]')).toBeVisible();
  await expect(page.locator('.profile-menu')).toHaveAttribute('open');await page.getByRole('button',{name:tr?'Yetişkinler':'Grown-ups',exact:true}).click();
  await page.goBack();await expect(page.locator('[data-view=discovery]')).toBeVisible();await page.goForward();await expect(page.locator('[data-view=adult]')).toBeVisible();
 });
 test(`player detail returns to list and selected mission returns to catalogue ${tr?'TR':'EN'}`,async({page})=>{
  await page.goto(tr?'/tr/':'/');await expect(page.locator('[data-start]')).toBeEnabled();
  await page.evaluate(async release=>{const {LocalRepository}=await import(`/releases/${release}/client/repository/local.js`),r=new LocalRepository(),s=await r.snapshot();await r.create({epoch:s.epoch,name:'TEST PLAYER'});r.close();},release);await page.reload();await expect(page.locator('[data-start]')).toBeEnabled();
  await page.locator('.profile-menu > summary').click();await page.getByRole('button',{name:tr?'Oyuncu işlemleri':'Player options',exact:true}).click();
  await page.getByRole('button',{name:/TEST PLAYER/}).first().click();await expect(page.locator('.certificate-status')).toBeVisible();
  await page.locator('.context-back').click();await expect(page.locator('.certificate-status')).toHaveCount(0);await expect(page.getByRole('button',{name:/TEST PLAYER/}).first()).toBeVisible();
  await page.getByRole('button',{name:/TEST PLAYER/}).first().click();await page.goBack();await expect(page.locator('.certificate-status')).toHaveCount(0);await page.goForward();await expect(page.locator('.certificate-status')).toBeVisible();
  await page.locator('.context-mission').click();await expect(page.locator('[data-start]')).toBeEnabled();
  await page.getByRole('button',{name:tr?'Başka uygun görev':'Find another suitable mission',exact:true}).click();const target=page.locator('[data-mission-id=m30] button');await target.scrollIntoViewIfNeeded();const y=await page.evaluate(()=>scrollY);await target.click();await expect(page.locator('[data-start]')).toBeEnabled();
  await page.locator('.context-back').click();await expect(page.locator('[data-view=discovery]')).toBeVisible();await expect.poll(()=>page.evaluate(()=>scrollY)).toBeCloseTo(y,0);
 });
}

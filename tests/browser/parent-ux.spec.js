import {openEntryOptions} from './helpers/entry-options.js';
import {test,expect} from '@playwright/test';
for(const tr of [false,true]){
 const open=async page=>{await page.goto(tr?'/tr/':'/');await expect(page.locator('[data-start]')).toBeEnabled();};
 test(`parent UX: no duplicated seated setup and family stop copy ${tr?'TR':'EN'}`,async({page})=>{
  await open(page);await expect(page.locator('.setup')).not.toContainText(tr?'sandalyeye':'chair');
  await expect(page.locator('.entry-brief')).toContainText(tr?'kayış':'strap');
  await expect(page.locator('.entry-brief')).toContainText(tr?'yüz':'below face');
  await page.locator('[data-start]').click();await page.locator('.active-control').nth(1).click();
  await expect(page.locator('h1')).toHaveText(tr?'Tur durdu':'Round stopped');
 });
 test(`parent UX: optional group filtering and whole-card mission access ${tr?'TR':'EN'}`,async({page})=>{
  await open(page);await page.getByRole('button',{name:tr?'Başka uygun görev':'Find another suitable mission',exact:true}).click();
  await expect(page.locator('.featured-mission')).toHaveCount(0);
  await page.locator('.discovery-filters>summary').click();
  const group=page.getByRole('navigation',{name:tr?'Görev grupları':'Mission groups'});
  await group.getByRole('button',{name:tr?'Takım oyunu':'Team Up',exact:true}).click();
  await expect(page.locator('.mission-list>li:visible')).toHaveCount(6);
  await expect(page.locator('[data-mission-id=m20] button')).toContainText(tr?'Yengeç':'Crab');
  await page.locator('[data-mission-id=m20] button').click();await expect(page.locator('[data-start]')).toBeEnabled();
  await page.goBack();await expect(page.locator('.mission-list>li:visible')).toHaveCount(6);
  await group.getByRole('button',{name:tr?'Tüm görevler':'All missions',exact:true}).click();await expect(page.locator('.mission-list>li:visible')).toHaveCount(36);
 });
 test(`parent UX: adult return preserves mission without intermediary and parent resources stay outside the play flow ${tr?'TR':'EN'}`,async({page})=>{
  await open(page);await openEntryOptions(page);await page.getByRole('button',{name:tr?'Yetişkinler':'Grown-ups',exact:true}).click();
  await expect(page.locator('.product-help')).toHaveCount(0);await expect(page.locator('.parent-resources a').first()).toHaveAttribute('href',/mission-book-.*\.pdf$/);await expect(page.locator('.parent-resources a').last()).toHaveAttribute('href','mailto:support@jumvi.co');
  await expect(page.locator('[data-view=adult]')).not.toContainText(tr?'Paddle ve top':'paddle and ball');
  await page.getByRole('button',{name:tr?'Göreve dön':'Back to the mission',exact:true}).click();await expect(page.locator('[data-view=entry]')).toBeVisible();
  await openEntryOptions(page);await page.getByRole('button',{name:tr?'Oyuncu işlemleri':'Player options',exact:true}).click();
  await expect(page.locator('.certificate-status')).toHaveCount(0);
  await expect(page.getByRole('button',{name:tr?'Yeni oyuncu':'New player',exact:true})).toBeVisible();
 });
}

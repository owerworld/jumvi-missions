import {test,expect} from '@playwright/test';
import {openEntryOptions} from './helpers/entry-options.js';
for(const tr of [false,true]){
 test(`customer polish: compact first play without hidden rules ${tr?'TR':'EN'}`,async({page})=>{
  await page.goto(tr?'/tr/':'/');await expect(page.locator('[data-start]')).toBeEnabled();await page.evaluate(()=>document.fonts.ready);
  await expect(page.locator('.entry-brief')).toContainText(tr?'kayış':'strap');
  await expect(page.locator('.entry-brief')).toContainText(tr?'yüz':'below face');
  await expect(page.locator('.entry-rules li')).toHaveCount(2);
  expect((await page.locator('[data-start]').boundingBox()).y).toBeLessThan(820);
  await page.getByRole('button',{name:tr?'Açıklama / yardım':'How to play / help',exact:true}).click();
  const sound=page.getByRole('button',{name:tr?'Ses':'Sound',exact:true});
  expect((await sound.boundingBox()).y).toBeLessThan((await page.locator('#first-step').boundingBox()).y);
  await expect(sound).toHaveAttribute('aria-pressed','false');
 });
 test(`customer polish: browse before optional filters; certificate explanation ${tr?'TR':'EN'}`,async({page})=>{
  await page.goto(tr?'/tr/':'/');await expect(page.locator('[data-start]')).toBeEnabled();
  await page.getByRole('button',{name:tr?'Başka uygun görev':'Find another suitable mission',exact:true}).click();
  await expect(page.locator('.discovery-filters')).not.toHaveAttribute('open');
  await expect(page.locator('.mission-list>li:visible')).toHaveCount(36);
  expect((await page.locator('.mission-open').first().boundingBox()).y).toBeLessThan(650);
  await page.locator('.discovery-filters>summary').click();
  await page.getByLabel(tr?'Kaç oyuncu var?':'How many players?',{exact:true}).selectOption('4');
  await page.locator('[data-mission-id=m20] button').click();await expect(page.locator('[data-start]')).toBeEnabled();await page.goBack();
  await expect(page.locator('.discovery-filters')).toHaveAttribute('open');
  await expect(page.getByLabel(tr?'Kaç oyuncu var?':'How many players?',{exact:true})).toHaveValue('4');
  await page.getByRole('button',{name:tr?'Göreve dön':'Back to the mission',exact:true}).first().click();
  await openEntryOptions(page);await page.getByRole('button',{name:tr?'Oyuncu işlemleri':'Player options',exact:true}).click();
  await expect(page.locator('.progress-intro')).toContainText('36');
  await expect(page.locator('.progress-intro')).toContainText(tr?'farklı':'different');
  await expect(page.locator('.progress-intro')).toContainText(tr?'isteğe bağlı':'optional');
 });
}

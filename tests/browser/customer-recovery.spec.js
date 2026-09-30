import {openEntryOptions} from './helpers/entry-options.js';
import {test,expect} from '@playwright/test';
for(const tr of [true,false])test(`customer recovery: groups, essential rules and focused mission help ${tr?'TR':'EN'}`,async({page})=>{
 await page.goto(tr?'/tr/':'/');await expect(page.locator('[data-start]')).toBeEnabled();
 await page.getByRole('button',{name:tr?'Başka uygun görev':'Find another suitable mission',exact:true}).click();
 await expect(page.locator('.mission-group')).toHaveCount(6);
 await expect(page.locator('.mission-list>li:visible')).toHaveCount(36);
 await page.locator('[data-mission-id=m04] button').click();await expect(page.locator('[data-start]')).toBeEnabled();
 await expect(page.locator('.entry-rules li')).toHaveCount(5);
 await page.getByRole('button',{name:tr?'Açıklama / yardım':'How to play / help',exact:true}).click();
 await expect(page.locator('.product-help')).toHaveCount(0);
 await expect(page.locator('#first-step')).toContainText(tr?'Mavi':'blue');
 await expect(page.getByRole('button',{name:tr?'Göreve dön':'Back to the mission',exact:true}).first()).toBeVisible();
});

test('remaining filter respects the explicitly selected player and resets for guest',async({page})=>{
 await page.goto('/');await expect(page.locator('[data-start]')).toBeEnabled();
 const moduleRoot=(await page.locator('script[type=module]').getAttribute('src')).split('/client/')[0];
 const ids=await page.evaluate(async prefix=>{const {LocalRepository}=await import(prefix+'/client/repository/local.js'),r=new LocalRepository(),s=await r.snapshot(),a=await r.create({epoch:s.epoch,name:'SYNTHETIC_FILTER_A'}),b=await r.create({epoch:s.epoch,name:'SYNTHETIC_FILTER_B'});const op=await r.prepare({id:'filter-complete',epoch:s.epoch,targetId:a.id,targetRevision:a.revision,report:{id:'filter-report',missionId:'m25',mechanicsVersion:'synthetic',revision:1,roundId:null,value:'complete'}});await r.commit(op.id,s.epoch);r.close();return [a.id,b.id];},moduleRoot);
 await page.reload();await expect(page.locator('[data-start]')).toBeEnabled();await page.getByRole('button',{name:'Find another suitable mission',exact:true}).click();
 await expect(page.getByLabel('Not completed yet',{exact:true})).toBeDisabled();
 await openEntryOptions(page);await page.locator('#session-player').selectOption(ids[0]);await expect(page.locator('[data-mission-id=m25] .mission-completed')).toBeVisible();
 await page.getByLabel('Not completed yet',{exact:true}).check();await expect(page.locator('[data-mission-id=m25]')).toBeHidden();await expect(page.locator('.mission-list>li:visible')).toHaveCount(35);
 await openEntryOptions(page);await page.locator('#session-player').selectOption(ids[1]);await expect(page.locator('.mission-list>li:visible')).toHaveCount(36);await expect(page.locator('.mission-completed')).toHaveCount(0);
 await openEntryOptions(page);await page.locator('#session-player').selectOption('');await expect(page.getByLabel('Not completed yet',{exact:true})).not.toBeChecked();await expect(page.getByLabel('Not completed yet',{exact:true})).toBeDisabled();await expect(page.locator('.mission-list>li:visible')).toHaveCount(36);
});

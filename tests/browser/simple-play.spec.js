import {test,expect} from '@playwright/test';
import {openEntryOptions} from './helpers/entry-options.js';
for(const tr of [true,false])test(`simple first QR; parent resources; help and post-play ${tr?'TR':'EN'}`,async({page})=>{
 await page.goto(tr?'/tr/':'/');await expect(page.locator('[data-start]')).toBeEnabled();
 const entry=page.locator('[data-view=entry]');await expect(entry.locator('button:visible')).toHaveCount(3);await expect(entry.locator('.entry-menu')).not.toHaveAttribute('open');
 await expect(entry.locator('.journey-count,.certificate-status,.parent-resources')).toHaveCount(0);
 const actions=entry.locator('.entry-actions button');await expect(actions.nth(0)).toHaveText(tr?'Başla→':'Start→');
 await openEntryOptions(page);await page.getByRole('button',{name:tr?'Yetişkinler':'Grown-ups',exact:true}).click();
 const parent=page.locator('[data-view=adult]');await expect(parent.locator('.parent-resources')).toBeVisible();await expect(parent.locator('.local-details')).not.toHaveAttribute('open');
 const pdf=parent.getByRole('link',{name:tr?'Türkçe PDF’yi aç':'Open English PDF'});const r=await page.request.get(await pdf.getAttribute('href'));expect(r.status()).toBe(200);expect(r.headers()['content-type']).toContain('application/pdf');expect((await r.body()).subarray(0,5).toString()).toBe('%PDF-');
 await expect(parent.getByRole('link',{name:'support@jumvi.co'})).toHaveAttribute('href','mailto:support@jumvi.co');await parent.locator('.parent-resources details summary').first().click();await expect(parent.locator('.parent-resources details').first()).toHaveAttribute('open');
 await page.getByRole('button',{name:tr?'Göreve dön':'Back to the mission',exact:true}).click();await expect(page.locator('.entry-menu')).toHaveAttribute('open');await expect(page.getByRole('button',{name:tr?'Yetişkinler':'Grown-ups',exact:true})).toBeFocused();
 await page.locator('.entry-menu>summary').click();await page.getByRole('button',{name:tr?'Açıklama / yardım':'How to play / help',exact:true}).click();await expect(page.locator('#first-step')).toBeVisible();await page.getByRole('button',{name:tr?'Göreve dön':'Back to the mission',exact:true}).first().click();
 await page.locator('[data-start]').click();await expect(page.locator('.active-control:visible')).toHaveCount(2);await page.locator('.stop-action').click();await page.getByRole('button',{name:tr?'Tamamladığımı bildir':'Report that I completed it',exact:true}).click();await expect(page.locator('[data-view=report]')).toBeVisible();await expect(page.getByRole('button',{name:tr?'İlerlememi tut':'Keep my progress',exact:true})).toBeVisible();
});

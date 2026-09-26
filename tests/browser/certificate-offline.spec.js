import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
const root=`/releases/${JSON.parse(readFileSync('dist/release-manifest.json')).release}`;
test('certificate backdrop remains optional and works offline after its first verified fetch',async({page,context})=>{
 await page.goto('/tr');await expect(page.locator('[data-start]')).toBeEnabled();
 await page.evaluate(()=>navigator.serviceWorker.ready);
 await page.reload();await expect(page.locator('[data-start]')).toBeEnabled();
 const draw=()=>page.evaluate(async root=>{const {certificatePng}=await import(root+'/client/certificate.js');return (await certificatePng('tr','QA YEREL')).blob.size;},root);
 expect(await draw()).toBeGreaterThan(10000);await context.setOffline(true);expect(await draw()).toBeGreaterThan(10000);
});

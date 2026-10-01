export async function openEntryOptions(page){
 await page.waitForFunction(()=>document.querySelector('main')?.getAttribute('aria-busy')==='false');
 const menu=page.locator('.entry-menu');
 if(await menu.count()&&await menu.getAttribute('open')===null)await menu.locator('summary').click();
}

import {test,expect} from '@playwright/test';
for(const tr of [false,true]){
 const open=async(page,id)=>{await page.goto(tr?'/tr/':'/');await expect(page.locator('[data-start]')).toBeEnabled();await page.getByRole('button',{name:tr?'Başka uygun görev':'Find another suitable mission',exact:true}).click();await page.locator(`[data-mission-id=${id}] button`).click();await expect(page.locator('[data-start]')).toBeEnabled();await page.getByRole('button',{name:tr?'Açıklama / yardım':'How to play / help',exact:true}).click();};
 test(`short family Help headings preserve full mechanics ${tr?'TR':'EN'}`,async({page})=>{
  await open(page,'m07');const cards=page.locator('.steps>li');
  await expect(page.locator('#first-step')).toHaveText(tr?'Yumuşak bir yay çiz':'Toss a gentle rainbow');
  await expect(cards.nth(0).locator('img')).toHaveAttribute('alt',/A/);
  await expect(cards.nth(0)).not.toContainText(tr?'5 temiz yaydan sonra geri adım at.':'After 5 clean arcs, step back.');
  await expect(cards.nth(2)).toContainText(tr?'Boş elini kullan.':'Use your free hand.');
  await expect(cards.nth(3)).toContainText(tr?'5':'5');
  await expect(page.locator('.product-help')).toHaveCount(0);
  await page.getByRole('button',{name:tr?'Göreve dön':'Back to the mission',exact:true}).first().click();await expect(page.locator('[data-view=entry]')).toBeVisible();
 });
 test(`short Help keeps hand transfer, landing and reset boundaries ${tr?'TR':'EN'}`,async({page})=>{
  test.setTimeout(60000);
  for(const id of ['m04','m20','m30','m35']){
   await open(page,id);const shown=await page.locator('[data-view=help]').innerText();
   const captions=await page.locator('.steps>li>h2').allTextContents();expect(captions.every(t=>t.split(/\s+/).length<=9)).toBe(true);
   if(id==='m04')expect(shown).toContain(tr?'Topu tutmaya devam et.':'Keep hold of the ball.');
   if(id==='m20')expect(shown).toMatch(tr?/[Kk]esik/:/dashed/);
   if(id==='m30'){expect(shown).toContain(tr?'kendi':'own');expect(shown).toContain(tr?'sayılmaz':'do not count');}
   if(id==='m35')expect(shown).toContain(tr?'Yere inene kadar top paddle’da kalsın.':'Keep the ball on the paddle until you land.');
  }
 });
}

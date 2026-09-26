import {test,expect} from '@playwright/test';
import {mkdirSync} from 'node:fs';

test('customer review captures are synthetic and keep real play optional',async({page})=>{
 const out='review-assets/2026-09-25/screenshots';mkdirSync(out,{recursive:true});
 await page.setViewportSize({width:390,height:844});
 await page.goto('/tr');await expect(page.locator('[data-start]')).toBeEnabled();
 await page.screenshot({path:`${out}/entry-390-tr.png`,fullPage:true});
 await page.getByRole('button',{name:'Açıklama / yardım',exact:true}).click();
 await expect(page.locator('#first-step')).toBeVisible();
 await expect(page.locator('.canonical-steps')).toHaveCount(0);
 await page.screenshot({path:`${out}/help-390-tr.png`,fullPage:true});
 await page.getByRole('button',{name:'Göreve dön',exact:true}).first().click();
 await page.getByRole('button',{name:'Başla',exact:true}).click();
 await expect(page.locator('[data-view=active]')).toBeVisible();
 await page.screenshot({path:`${out}/active-390-tr.png`,fullPage:true});
 await page.getByRole('button',{name:'Turu durdur',exact:true}).click();
 await page.getByRole('button',{name:'Tamamladığımı bildir',exact:true}).click();
 await page.getByRole('button',{name:'Kişisel geçmişe ekle',exact:true}).click();
 await page.getByRole('button',{name:'Yeni oyuncu',exact:true}).click();
 await page.getByLabel('Takma ad (isteğe bağlı)').fill('QA ÖRNEK');
 await page.getByRole('button',{name:'Oyuncu oluştur',exact:true}).click();
 await page.getByRole('radio',{name:'QA ÖRNEK'}).check();
 await page.getByRole('button',{name:'Seçili oyuncuya kaydet',exact:true}).click();
 await expect(page.getByText(/seçili oyuncunun yerel geçmişine eklendi/)).toBeVisible();
 await page.getByRole('button',{name:'Oyuncu işlemleri',exact:true}).click();
 await expect(page.getByText('1 farklı görev için 1 tamamlandı bildirimi · 0 erken bırakıldı bildirimi')).toBeVisible();
 await page.screenshot({path:`${out}/history-390-tr-synthetic.png`,fullPage:true});
 await page.getByRole('button',{name:'Geçmişi gör: QA ÖRNEK'}).click();
 await expect(page.getByRole('heading',{name:'Yerel bildirimler'})).toBeVisible();
 await page.screenshot({path:`${out}/history-detail-390-tr-synthetic.png`,fullPage:true});
});

test('saved-report summary and history actions reflow at 320 CSS px with 200% text',async({page})=>{
 await page.setViewportSize({width:320,height:844});await page.goto('/tr');
 await page.evaluate(async()=>{
  document.documentElement.style.fontSize='200%';
  const root=document.querySelector('script[type=module]').src.split('/client/')[0];
  const {LocalRepository}=await import(root+'/client/repository/local.js');
  const r=new LocalRepository(),s=await r.snapshot();await r.create({epoch:s.epoch,name:'QA ÖRNEK'});r.close();
 });
 await page.getByRole('button',{name:'Oyuncu işlemleri',exact:true}).click();
 await expect(page.getByRole('button',{name:'Geçmişi gör: QA ÖRNEK'})).toBeVisible();
 const result=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,buttons:[...document.querySelectorAll('.history-item button')].map(b=>({text:b.textContent,rect:b.getBoundingClientRect().toJSON()}))}));
 expect(result.width).toBe(320);expect(result.scrollWidth).toBeLessThanOrEqual(321);
 for(const b of result.buttons){expect(b.rect.left).toBeGreaterThanOrEqual(0);expect(b.rect.right).toBeLessThanOrEqual(321);}
});

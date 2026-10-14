const {chromium,expect}=require('@playwright/test');
const {randomBytes}=require('node:crypto');
const {execFileSync}=require('node:child_process');
const fs=require('node:fs');
fs.mkdirSync('.impeccable/review',{recursive:true});
const base=process.env.TEST_WEB_URL||'http://localhost:5187';
// Idioma por dominio: el inglés en el host de SITE_URL_EN (resuelto a 127.0.0.1 contra localhost).
const englishHost=new URL(process.env.TEST_SITE_URL_EN||'https://en.tueventofun.orb.local').hostname;
const local=/^(localhost|127\.0\.0\.1)$/.test(new URL(base).hostname);
const baseEn=process.env.TEST_WEB_URL_EN||(local?`http://${englishHost}:${new URL(base).port||80}`:`https://${englishHost}`);
const sql=q=>execFileSync('docker',['compose','exec','-T','postgres','psql','-U','tuevento','-d','tueventofun','-Atc',q],{encoding:'utf8'});
(async()=>{const browser=await chromium.launch({headless:true,args:local?[`--host-resolver-rules=MAP ${englishHost} 127.0.0.1`]:[]});const context=await browser.newContext();const page=await context.newPage();let id;const errors=[];page.on('pageerror',e=>errors.push(e.message));try{
 const n=Date.now();const response=await context.request.post(base+'/api/auth/register',{headers:{'X-TuEvento-Client':'1'},data:{firstName:'Prueba',lastName:'Dueño',email:`owner-${n}@example.invalid`,username:`owner_${n}`,phone:'+527770000000',password:randomBytes(20).toString('hex')}});expect(response.ok()).toBe(true);id=(await response.json()).id;
 sql(`UPDATE users SET is_owner=true WHERE id='${id}'`);
 for(const [width,height] of [[1512,1000],[390,844]]){
 await page.setViewportSize({width,height});await page.goto(base+'/administracion');await expect(page.getByRole('heading',{name:'El pulso de TuEventoFun'})).toBeVisible();await expect(page.locator('.owner-totals')).toBeVisible();await page.getByLabel('Periodo',{exact:true}).selectOption('7');await expect(page.locator('.owner-totals')).toBeVisible();await page.evaluate(()=>document.fonts.ready);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:`.impeccable/review/owner-${width}.png`,fullPage:true});
 await page.goto(base+'/descargas');await expect(page.getByRole('heading',{name:'Tu celebración, siempre contigo.'})).toBeVisible();await expect(page.getByText('Preparando la primera versión. Aún no hay una descarga publicada.')).toHaveCount(2);await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})))});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:`.impeccable/review/downloads-${width}.png`,fullPage:true});
 }
 await page.goto(baseEn+'/descargas');await expect(page.getByRole('heading',{name:'Your celebration, always with you.'})).toBeVisible();
 expect(errors).toEqual([]);fs.writeFileSync('qa-artifacts/owner-browser-results.json',JSON.stringify({passed:true,viewports:[1512,390],errors},null,2));console.log('PASS owner role, date filter, desktop/mobile, empty downloads, English, no overflow/errors');
}finally{if(id){sql(`DELETE FROM activity WHERE user_id='${id}'`);sql(`DELETE FROM users WHERE id='${id}' AND email LIKE 'owner-%@example.invalid'`)}await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});

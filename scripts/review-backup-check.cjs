const {chromium}=require('playwright-core'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
async function main(){
 const {makeBackup}=await import('../src/sind-review-backup.mjs'),m=JSON.parse(fs.readFileSync('data/sind/risk-events.json')),id=m.events[0].id;
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||path.join(process.env.LOCALAPPDATA,'ms-playwright/chromium-1228/chrome-win64/chrome.exe'),headless:true,args:['--enable-webgl','--ignore-gpu-blocklist']});
 try{
  const page=await browser.newPage({viewport:{width:2560,height:1440}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:4173/analysis.html',{waitUntil:'networkidle'});await page.locator('#loading').waitFor({state:'hidden',timeout:60000});await page.locator('#play').click();await page.locator('#toggle-analysis').click();await page.locator('[data-analysis-tab="risks"]').click();await page.locator('#event-review summary').first().click();
  await page.locator('[data-event]').first().click();await page.locator('#review-note').fill('保留原记录');await page.locator('#save-review').click();
  await page.getByText('备份与恢复',{exact:true}).click();
  const upload=async backup=>page.locator('#import-review-json').setInputFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});
  const backup=makeBackup(m,{[id]:{status:'uncertain',note:'测试恢复备注'}});
  await upload({...backup,sourceSha256:'wrong'});await page.waitForFunction(()=>document.getElementById('import-feedback').textContent.includes('不匹配'));assert.equal(await page.locator('#apply-review-import').isDisabled(),true);
  await upload(backup);await page.waitForFunction(()=>document.getElementById('import-feedback').textContent.includes('校验通过'));
  await page.locator('#apply-review-import').click();assert.equal(await page.locator('#review-note').inputValue(),'保留原记录');
  await upload(backup);await page.waitForFunction(()=>document.getElementById('import-feedback').textContent.includes('校验通过'));await page.locator('#import-policy').selectOption('overwrite');await page.locator('#apply-review-import').click();assert.equal(await page.locator('#review-note').inputValue(),'测试恢复备注');
  const pending=page.waitForEvent('download');await page.locator('#export-review-json').click();const d=await pending;await d.saveAs('docs/visual-check/review-backup.json');assert.equal(JSON.parse(fs.readFileSync('docs/visual-check/review-backup.json')).reviews[id].note,'测试恢复备注');
  await page.locator('#event-kind').selectOption('cross');assert.equal(await page.locator('[data-event]').count(),m.events.filter(e=>e.kinds.includes('cross')).length);
  await page.getByText('阈值敏感性分析',{exact:true}).click();assert.equal(await page.locator('#sensitivity-body tr').count(),12);await page.locator('#sensitivity-body').scrollIntoViewIfNeeded();await page.screenshot({path:'docs/visual-check/sensitivity.png'});
  assert.deepEqual(errors,[]);const report={wrongVersionRejected:true,preserveDefault:true,overwriteExplicit:true,jsonRoundTrip:true,categoryFilter:true,sensitivityRows:12,errors};fs.writeFileSync('docs/visual-check/review-backup-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});

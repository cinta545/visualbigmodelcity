const {chromium}=require('playwright-core'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
async function main(){
 const m=JSON.parse(fs.readFileSync('data/sind/risk-events.json')),event=m.events[0];
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||path.join(process.env.LOCALAPPDATA,'ms-playwright/chromium-1228/chrome-win64/chrome.exe'),headless:true,args:['--enable-webgl','--ignore-gpu-blocklist']});
 try{
  const page=await browser.newPage({viewport:{width:2560,height:1440}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  async function open(){await page.goto('http://127.0.0.1:4173/analysis.html',{waitUntil:'networkidle'});await page.locator('#loading').waitFor({state:'hidden',timeout:60000});await page.locator('#play').click();await page.locator('#toggle-analysis').click();await page.locator('[data-analysis-tab="risks"]').click();await page.locator('#event-review > summary').click();await page.locator('[data-event]').first().waitFor();}
  await open();assert.equal(await page.locator('[data-event]').count(),m.events.length);await page.locator('[data-event]').first().click();
  assert.ok(Math.abs(Number(await page.locator('#time').inputValue())-event.minTimeMs)<=10);
  await page.locator('#review-status').selectOption('uncertain');await page.locator('#review-note').fill('自动验收临时备注：无法判断');await page.locator('#save-review').click();assert.match(await page.locator('#review-feedback').innerText(),/已保存/);
  await open();await page.locator('[data-event]').first().click();assert.equal(await page.locator('#review-note').inputValue(),'自动验收临时备注：无法判断');
  await page.locator('#event-filter').selectOption('uncertain');assert.equal(await page.locator('[data-event]').count(),1);
  await page.locator('#speed').selectOption('4');await page.locator('#event-play').click();
  await page.waitForFunction(()=>document.getElementById('play').textContent==='播放',{},{timeout:30000});
  assert.ok(Math.abs(Number(await page.locator('#time').inputValue())-Math.min(m.durationMs,event.endMs+2000))<=10);
  await page.locator('#event-min').click();await page.screenshot({path:'docs/visual-check/events.png'});
  const pending=page.waitForEvent('download');await page.locator('#export-events').click();const d=await pending;await d.saveAs('docs/visual-check/events.csv');assert.ok(fs.readFileSync('docs/visual-check/events.csv','utf8').includes('自动验收临时备注'));
  assert.deepEqual(errors,[]);const report={events:m.events.length,persistence:true,filter:true,clipAutoPause:true,export:true,errors};fs.writeFileSync('docs/visual-check/events-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});

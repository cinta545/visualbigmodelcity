const {chromium}=require('playwright-core');
const path=require('node:path'),fs=require('node:fs'),assert=require('node:assert/strict');
async function main(){
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||path.join(process.env.LOCALAPPDATA,'ms-playwright/chromium-1228/chrome-win64/chrome.exe'),headless:true,args:['--enable-webgl','--ignore-gpu-blocklist']});
 try{
  const page=await browser.newPage({viewport:{width:2560,height:1440}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const data=JSON.parse(fs.readFileSync('data/sind/replay.json','utf8'));
  await page.goto('http://127.0.0.1:4173/analysis.html',{waitUntil:'networkidle'});await page.locator('#loading').waitFor({state:'hidden',timeout:60000});await page.locator('#play').click();
  async function seek(t){await page.locator('#time').fill(String(t));await page.locator('#time').dispatchEvent('input');}
  await seek(120000);await page.locator('#toggle-analysis').click();
  const active=data.tracks.filter(t=>t.samples[0][0]<=120000&&t.samples.at(-1)[0]>=120000);
  assert.equal(Number(await page.locator('#metric-active').innerText()),active.length);
  assert.equal(Number(await page.locator('#metric-seen').innerText()),data.tracks.filter(t=>t.samples[0][0]<=120000).length);
  await page.screenshot({path:'docs/visual-check/metrics.png'});
  await page.locator('[data-analysis-tab="objects"]').click();await page.locator('#object-type').selectOption('bus');
  assert.equal(await page.locator('[data-track]').count(),active.filter(t=>t.type==='bus').length);
  const selected=active.find(t=>t.type==='bus');await page.locator(`[data-track="${selected.id}"]`).click();
  await page.locator('[data-view="overhead"]').click();await page.waitForTimeout(300);
  await page.screenshot({path:'docs/visual-check/analysis.png'});
  const pending=page.waitForEvent('download');await page.locator('#export-observation').click();const download=await pending;
  await download.saveAs('docs/visual-check/history.csv');
  const lines=fs.readFileSync('docs/visual-check/history.csv','utf8').trim().split(/\r?\n/).slice(1);
  const expected=selected.samples.filter(s=>s[0]>110000&&s[0]<=120000);
  assert.equal(lines.length,expected.length);
  lines.forEach((line,i)=>assert.deepEqual(line.split(',').slice(3).map(Number),expected[i]));
  await page.locator('#show-history').uncheck();await page.locator('#show-history').check();
  await page.locator('#object-scope').selectOption('all');await page.locator('#object-type').selectOption('all');
  const future=data.tracks.find(t=>t.samples[0][0]>200000);await page.locator('#object-search').fill(future.id);
  assert.equal(await page.locator('[data-track]').count(),1);await page.locator('[data-track]').click();
  assert.equal(await page.locator('#focus-object').isDisabled(),true);
  await page.locator('#jump-observation').click();
  assert.equal(await page.locator('#focus-object').isDisabled(),false);assert.equal(await page.locator('#play').innerText(),'播放');
  assert.match(await page.locator('#inspection').innerText(),/当前可见/);
  assert.deepEqual(errors,[]);
  const report={metrics:true,searchAndFilters:true,historyCsvRows:lines.length,csvMatchesSource:true,futureObjectJump:true,errors};
  fs.writeFileSync('docs/visual-check/analysis-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});

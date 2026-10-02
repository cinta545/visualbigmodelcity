const {chromium}=require('playwright-core');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
async function main(){
 const {assessRisks,riskCsv}=await import('../src/sind-risk.mjs');
 const data=JSON.parse(fs.readFileSync('data/sind/replay.json','utf8')),audit=JSON.parse(fs.readFileSync('data/sind/risk-audit.json','utf8'));
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||path.join(process.env.LOCALAPPDATA,'ms-playwright/chromium-1228/chrome-win64/chrome.exe'),headless:true,args:['--enable-webgl','--ignore-gpu-blocklist']});
 try{
  const page=await browser.newPage({viewport:{width:2560,height:1440}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:4173/analysis.html',{waitUntil:'networkidle'});await page.locator('#loading').waitFor({state:'hidden',timeout:60000});await page.locator('#play').click();await page.locator('#toggle-analysis').click();await page.locator('[data-analysis-tab="risks"]').click();
  for(const kind of ['cross','rear','vulnerable']){
   const example=audit.examples[kind];await page.locator('#time').fill(String(example.timeMs));await page.locator('#time').dispatchEvent('input');
   const events=assessRisks(data.tracks,example.timeMs);assert.equal(await page.locator('[data-risk]').count(),events.length);
   await page.locator(`[data-risk="${example.key}"]`).click();assert.ok((await page.locator('#risk-detail').innerText()).includes(example.ttcS.toFixed(2)+' s'));
   await page.waitForTimeout(200);await page.screenshot({path:`docs/visual-check/risk-${kind}.png`});
   const pending=page.waitForEvent('download');await page.locator('#export-risks').click();const download=await pending,target=`docs/visual-check/risk-${kind}.csv`;await download.saveAs(target);
   assert.equal(fs.readFileSync(target,'utf8'),riskCsv(events));
  }
  await page.locator('#show-risks').uncheck();await page.locator('#show-risks').check();
  await page.locator('#time').fill('120000');await page.locator('#time').dispatchEvent('input');assert.match(await page.locator('#risk-detail').innerText(),/不满足条件/);
  assert.deepEqual(errors,[]);const report={kinds:['cross','rear','vulnerable'],candidateCounts:true,csvMatchesCalculation:true,expiredSelectionCleared:true,errors};fs.writeFileSync('docs/visual-check/risk-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});

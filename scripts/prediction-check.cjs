const {chromium}=require('playwright-core');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
async function main(){
 const {predict,evaluate}=await import('../src/sind-prediction.mjs');
 const data=JSON.parse(fs.readFileSync('data/sind/replay.json','utf8'));
 const track=data.tracks.find(t=>t.type==='car'&&t.samples.some(r=>Math.abs(r[0]-120000)<100&&Math.hypot(r[3],r[4])>3)&&predict(t,120000,'ca').points);
 assert.ok(track);
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||path.join(process.env.LOCALAPPDATA,'ms-playwright/chromium-1228/chrome-win64/chrome.exe'),headless:true,args:['--enable-webgl','--ignore-gpu-blocklist']});
 try{
  const page=await browser.newPage({viewport:{width:2560,height:1440}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:4173/analysis.html',{waitUntil:'networkidle'});await page.locator('#loading').waitFor({state:'hidden',timeout:60000});await page.locator('#play').click();
  await page.locator('#time').fill('120000');await page.locator('#time').dispatchEvent('input');await page.locator('#toggle-analysis').click();await page.locator('[data-analysis-tab="objects"]').click();
  await page.locator('#object-search').fill(track.id);await page.locator(`[data-track="${track.id}"]`).click();await page.locator('[data-view="overhead"]').click();
  for(const model of ['cv','ca','dca','ctrv']){
   await page.locator('#prediction-model').selectOption(model);
   const f=predict(track,120000,model),scores=evaluate(track,f);
   assert.match(await page.locator('#prediction-status').innerText(),new RegExp((f.anchorMs/1000).toFixed(3)));
   for(const score of scores)if(score.errorM!==null)assert.ok((await page.locator('#prediction-errors').innerText()).includes(score.errorM.toFixed(2)+' m'));
   const pending=page.waitForEvent('download');await page.locator('#export-prediction').click();const download=await pending;const target=`docs/visual-check/prediction-${model}.csv`;await download.saveAs(target);
   const rows=fs.readFileSync(target,'utf8').trim().split(/\r?\n/).slice(1);assert.equal(rows.length,31);
   rows.forEach((row,i)=>{const cols=row.split(',');assert.equal(cols[0],track.id);assert.equal(cols[1],model);assert.equal(Number(cols[2]),f.anchorMs);assert.equal(Number(cols[4]),f.points[i][1]);assert.equal(Number(cols[5]),f.points[i][2]);});
  }
  await page.locator('#show-prediction').uncheck();await page.locator('#show-prediction').check();await page.waitForTimeout(300);await page.screenshot({path:'docs/visual-check/prediction.png'});
  await page.locator('#object-search').fill('');await page.locator('#object-type').selectOption('pedestrian');await page.locator('[data-track]').first().click();
  assert.equal(await page.locator('#export-prediction').isDisabled(),true);assert.match(await page.locator('#prediction-status').innerText(),/请选择机动车/);
  assert.deepEqual(errors,[]);const report={models:['cv','ca','dca','ctrv'],trackId:track.id,anchorMs:predict(track,120000).anchorMs,csvRowsPerModel:31,errors};fs.writeFileSync('docs/visual-check/prediction-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});

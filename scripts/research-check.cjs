const {chromium}=require('playwright-core'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
async function main(){
 const report=JSON.parse(fs.readFileSync('data/sind/research-evaluation.json'));
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||path.join(process.env.LOCALAPPDATA,'ms-playwright/chromium-1228/chrome-win64/chrome.exe'),headless:true,args:['--enable-webgl','--ignore-gpu-blocklist']});
 try{
  const page=await browser.newPage({viewport:{width:2560,height:1440}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:4173/analysis.html',{waitUntil:'networkidle'});await page.locator('#loading').waitFor({state:'hidden',timeout:60000});await page.locator('#play').click();await page.locator('#toggle-analysis').click();await page.locator('#research-panel summary').click();
  await page.locator('#research-results tr').first().waitFor();assert.match(await page.locator('#research-status').innerText(),/仅开发样例/);
  for(const motion of ['all','moving','low_speed'])for(const weight of ['sample','track']){
   await page.locator('#research-motion').selectOption(motion);await page.locator('#research-weight').selectOption(weight);
   const expected=report.groups.filter(g=>g.split==='development'&&(motion==='all'?g.dimension==='all':g.dimension==='motion'&&g.value===motion));
   assert.equal(await page.locator('#research-results tr').count(),report.models.length*3);
   const cells=await page.locator('#research-results tr').first().locator('td').allTextContents();
   assert.equal(Number(cells[2]),expected[0].n);assert.ok(Math.abs(Number(cells[4])-(weight==='track'?expected[0].trackMacroAdeM:expected[0].adeM))<.00051);
  }
  await page.locator('#research-motion').selectOption('all');
  for(const source of report.sources){
   await page.locator('#research-record').selectOption(source.id);
   const expected=report.byRecording[source.id].find(g=>g.dimension==='all'&&g.horizonS===1&&g.model==='cv');
   assert.equal(Number(await page.locator('#research-results tr').first().locator('td').nth(2).innerText()),expected.n);
  }
  await page.locator('#research-record').selectOption('Chongqing/6_22_NR_1');await page.locator('#research-motion').selectOption('type:bus');
  assert.equal(await page.locator('#research-results tr').first().locator('td').nth(4).innerText(),'—');
  await page.locator('#research-record').selectOption('Changchun/changchun_pudong_507_009');await page.locator('#research-motion').selectOption('futureMotion:direction_change_15deg');
  await page.screenshot({path:'docs/visual-check/research.png'});
  const pending=page.waitForEvent('download');await page.getByText('下载报告 JSON',{exact:true}).click();const d=await pending;await d.saveAs('docs/visual-check/research-download.json');assert.deepEqual(JSON.parse(fs.readFileSync('docs/visual-check/research-download.json')),report);
  assert.deepEqual(errors,[]);const result={strataAndWeights:6,citySwitches:report.sources.length,emptyClass:true,reportDownload:true,developmentStatus:true,errors};fs.writeFileSync('docs/visual-check/research-report.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});

const {chromium}=require('playwright-core');
const path=require('node:path');
const fs=require('node:fs');
const assert=require('node:assert/strict');
async function main(){
 const executablePath=process.env.CHROMIUM_PATH||path.join(process.env.LOCALAPPDATA,'ms-playwright/chromium-1228/chrome-win64/chrome.exe');
 const out=path.resolve('docs/visual-check');fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({executablePath,headless:true,args:['--enable-webgl','--ignore-gpu-blocklist']});
 try{
  const page=await browser.newPage({viewport:{width:2560,height:1440},deviceScaleFactor:1});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',msg=>{if(msg.type()==='error')errors.push(msg.text()+' '+msg.location().url);});
  await page.goto('http://127.0.0.1:4173',{waitUntil:'networkidle'});
  await page.locator('#loading').waitFor({state:'hidden',timeout:60000});
  await page.locator('#play').click();
  await page.locator('#time').fill('120000');await page.locator('#time').dispatchEvent('input');
  await page.locator('[data-view="sample"]').click();await page.waitForTimeout(250);
  await page.screenshot({path:path.join(out,'corner.png')});
  for(const view of ['street','overview','junction','overhead']){
   await page.locator(`[data-view="${view}"]`).click();
   await page.waitForTimeout(350);
   await page.screenshot({path:path.join(out,view+'.png')});
  }
  // This point is the westbound bus in the inspected 120 s overhead screenshot.
  await page.mouse.click(895,742);
  assert.ok(await page.locator('#analysis').isVisible(),'object picking did not open details');
  assert.match(await page.locator('#inspection').innerText(),/Tianjin\/8_2_1\/.+bus/);
  await page.locator('#toggle-analysis').click();
  const before=await page.locator('#time').inputValue();await page.waitForTimeout(250);
  assert.equal(await page.locator('#time').inputValue(),before,'paused clock changed');
  await page.locator('#play').click();await page.waitForTimeout(300);await page.locator('#play').click();
  assert.ok(Number(await page.locator('#time').inputValue())>Number(before),'play did not advance');
  await page.locator('#toggle-analysis').click();assert.ok(await page.locator('#analysis').isVisible());
  await page.locator('#time').fill('9680');await page.locator('#time').dispatchEvent('input');
  assert.equal(await page.locator('#signal-0 span').innerText(),'黄灯');
  await page.locator('#time').fill('12680');await page.locator('#time').dispatchEvent('input');
  assert.equal(await page.locator('#signal-0 span').innerText(),'红灯');
  await page.locator('#time').fill('120000');await page.locator('#time').dispatchEvent('input');
  await page.locator('#speed').selectOption('2');
  await page.locator('#play').click();await page.waitForTimeout(450);await page.locator('#play').click();
  assert.ok(Number(await page.locator('#time').inputValue())>120300,'2x playback did not advance');
  const downloadPromise=page.waitForEvent('download');await page.locator('#capture').click();
  const download=await downloadPromise;await download.saveAs(path.join(out,'export.png'));
  const report={viewport:'2560x1440',errors,playPauseSeek:true,objectPicking:true,signalBoundaries:true,doubleSpeed:true,screenshotExport:download.suggestedFilename(),signalText:await page.locator('#signals').innerText(),note:'Headless Chromium: visual/function checks only; not an RTX 4060 performance benchmark.'};
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));assert.deepEqual(errors,[]);
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});

const {chromium}=require('playwright-core'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--use-angle=d3d11']});try{
 const page=await browser.newPage({viewport:{width:2560,height:1440}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/src/city-home.mjs',async route=>{const response=await route.fetch(),body=(await response.text()).replace('function renderScene(',`window.xianAudit=()=>{playing=false;const wards=[];current.district.root.traverse(o=>{if(o.userData.wardKind)wards.push(o.userData.wardKind);});return {wards,tracks:current.data.tracks.length,fov:camera.fov,recording:current.config.recording};};function renderScene(`);await route.fulfill({response,body});});
 await page.goto('http://127.0.0.1:4173/?city=xian');await page.waitForSelector('#loading[hidden]',{state:'attached',timeout:90000});
 const audit=await page.evaluate(()=>window.xianAudit());assert.deepEqual(audit.wards,['changle','qujiang','pagoda','bell']);assert.equal(audit.tracks,439);assert.equal(audit.fov,10);
 await page.waitForTimeout(2200);await page.screenshot({path:'artifacts/xian-four-wards.png'});
 await page.locator('#fullscreen').click();assert.equal(await page.locator('#traffic-charts').isVisible(),false);assert.equal(await page.locator('.view-dock').isVisible(),false);await page.screenshot({path:'artifacts/xian-four-wards-focused.png'});
 await page.locator('#fullscreen').click();assert.equal(await page.locator('.view-dock').isVisible(),true);
 for(const view of ['sample','overhead']){await page.locator(`[data-view="${view}"]`).click();await page.waitForTimeout(1800);await page.screenshot({path:`artifacts/xian-four-wards-${view}.png`});}
 await page.locator('#reset').click();await page.waitForTimeout(1200);assert.equal((await page.evaluate(()=>window.xianAudit())).fov,10);assert.deepEqual(errors,[]);console.log(JSON.stringify({...audit,errors}));
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

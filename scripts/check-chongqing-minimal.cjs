const {chromium}=require('playwright-core'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--use-angle=d3d11']});try{
 const page=await browser.newPage({viewport:{width:2560,height:1440}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/src/city-home.mjs',async r=>{const response=await r.fetch(),body=(await response.text()).replace('function renderScene(',`window.hillsideView=()=>{playing=false;transition=null;camera.position.set(-250,95,-50);controls.target.set(-145,4,-140);controls.update();};window.terrainView=()=>{playing=false;transition=null;camera.position.set(165,72,155);controls.target.set(100,-3,70);controls.update();};window.nightAudit=()=>{playing=false;const prototypes=new Set();let dashedBoundaries=0;current.district.root.traverse(o=>{if(o.isLine&&o.material?.isLineDashedMaterial)dashedBoundaries++;if(o.userData.prototype)prototypes.add(o.userData.prototype);});return {prototypes:[...prototypes],dashedBoundaries,buildings:current.config.buildings.length,kinds:[...new Set(current.config.buildings.filter(b=>b.landmark).map(b=>b.landmarkKind))]};};function renderScene(`);await r.fulfill({response,body});});
 await page.goto('http://127.0.0.1:4173/?city=chongqing');await page.waitForSelector('#loading[hidden]',{state:'attached',timeout:90000});
 const audit=await page.evaluate(()=>window.nightAudit());assert.ok(audit.buildings>100);assert.equal(audit.kinds.length,9);assert.equal(audit.dashedBoundaries,0);assert.equal(audit.prototypes.length,5);
 await page.locator('#fullscreen').click();
 assert.equal(await page.locator('#traffic-charts').isVisible(),false);
 assert.equal(await page.locator('#flow-panel').isVisible(),false);
 assert.equal(await page.evaluate(()=>document.fullscreenElement===null),true);
 await page.locator('#fullscreen').click();
 assert.equal(await page.locator('#traffic-charts').isVisible(),true);
 assert.equal(await page.locator('#flow-panel').isVisible(),true);
 await page.waitForTimeout(2500);await page.screenshot({path:'artifacts/chongqing-minimal-night.png'});
 for(const view of ['sample','street']){await page.locator('[data-view="'+view+'"]').click();await page.waitForTimeout(1500);await page.screenshot({path:'artifacts/chongqing-minimal-'+view+'.png'});}
 await page.evaluate(()=>window.terrainView());await page.waitForTimeout(1200);await page.screenshot({path:'artifacts/chongqing-terrain.png'});
 await page.evaluate(()=>window.hillsideView());await page.waitForTimeout(1200);await page.screenshot({path:"artifacts/chongqing-hillside.png"});
 assert.deepEqual(errors,[]);console.log(JSON.stringify({...audit,errors}));
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

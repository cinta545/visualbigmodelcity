const {chromium}=require('playwright-core'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--use-angle=d3d11']});try{
 const page=await browser.newPage({viewport:{width:2560,height:1440}}),errors=[],results=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/src/city-home.mjs',async route=>{const response=await route.fetch(),body=(await response.text()).replace('function renderScene(',`window.roadAudit=()=>{playing=false;following=false;transition=null;const [x,y]=current.config.center;camera.fov=40;camera.updateProjectionMatrix();camera.position.set(x,205,-y+.1);controls.target.set(x,0,-y);controls.update();return {city:current.config.city,profiles:current.config.extensionAxes.filter(a=>a.alignment).length,tracks:current.data.tracks.length};};function renderScene(`);await route.fulfill({response,body});});
 await page.goto('http://127.0.0.1:4173/?city=tianjin');await page.waitForSelector('#loading[hidden]',{state:'attached',timeout:90000});
 for(const city of ['tianjin','changchun','chongqing','xian']){
  if(city!=='tianjin'){await page.locator(`[data-city="${city}"]`).click();await page.waitForFunction(id=>document.body.dataset.city===id&&document.getElementById('loading').hidden,city,{timeout:90000});}
  const audit=await page.evaluate(()=>window.roadAudit());assert.equal(audit.profiles,4);results.push(audit);
  await page.waitForTimeout(1300);await page.screenshot({path:`artifacts/${city}-road-alignment.png`});
 }
 assert.deepEqual(errors,[]);console.log(JSON.stringify({results,errors}));
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

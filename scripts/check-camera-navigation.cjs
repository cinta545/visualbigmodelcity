const {chromium}=require('playwright-core'),assert=require('node:assert/strict');
const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--use-angle=d3d11','--enable-webgl']});
 try{
  const page=await browser.newPage({viewport:{width:1600,height:900}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/src/city-home.mjs',async route=>{
   const response=await route.fetch(),body=(await response.text()).replace('try{const catalog=',`window.cameraCheck=()=>({eye:camera.position.toArray(),target:controls.target.toArray(),distance:camera.position.distanceTo(controls.target)});try{const catalog=`);
   await route.fulfill({response,body});
  });
  await page.goto('http://127.0.0.1:4173/');
  await page.waitForSelector('#loading[hidden]',{state:'attached',timeout:60000});
  for(const city of ['tianjin','changchun','chongqing','xian']){
   await page.locator(`button[data-city="${city}"]`).click();
   await page.waitForFunction(c=>document.querySelector('#scene').dataset.city===c,city,{timeout:60000});
   await page.waitForSelector('#loading[hidden]',{state:'attached',timeout:60000});
   await page.waitForTimeout(1100);
   const start=await page.evaluate(()=>cameraCheck());
   await page.mouse.move(1040,430);await page.mouse.wheel(0,-180);await page.waitForTimeout(400);
   const zoom=await page.evaluate(()=>cameraCheck());
   assert.ok(zoom.distance<start.distance*.9,`${city} zoom`);
   assert.ok(distance(start.target,zoom.target)>.01,`${city} pointer anchor`);
   await page.mouse.dblclick(1000,460);await page.waitForTimeout(1100);
   const focus=await page.evaluate(()=>cameraCheck());assert.ok(distance(zoom.target,focus.target)>.01,`${city} focus`);
   await page.mouse.move(800,480);await page.mouse.down({button:'right'});await page.mouse.move(960,520,{steps:12});await page.mouse.up({button:'right'});await page.waitForTimeout(700);
   const pan=await page.evaluate(()=>cameraCheck());assert.ok(distance(focus.target,pan.target)>1,`${city} right pan`);
   await page.mouse.down({button:'middle'});await page.mouse.move(1020,520,{steps:8});await page.mouse.up({button:'middle'});await page.waitForTimeout(700);
   const middle=await page.evaluate(()=>cameraCheck());assert.ok(distance(pan.target,middle.target)>.1,`${city} middle pan`);
   await page.keyboard.down('ArrowRight');await page.waitForTimeout(400);await page.keyboard.up('ArrowRight');
   const moved=await page.evaluate(()=>cameraCheck());assert.ok(distance(middle.target,moved.target)>.1,`${city} keys`);
   await page.keyboard.down('PageUp');await page.waitForTimeout(400);await page.keyboard.up('PageUp');
   const raised=await page.evaluate(()=>cameraCheck());assert.ok(raised.target[1]>moved.target[1],`${city} rise`);
   await page.locator('[data-view="overview"]').click();await page.waitForTimeout(1100);
   const reset=await page.evaluate(()=>cameraCheck());assert.ok(distance(reset.target,start.target)<.1,`${city} preset reset`);
   console.log(`${city}: cursor zoom, double-click focus, two-button pan, keyboard move, height and preset passed`);
  }
  assert.deepEqual(errors,[]);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

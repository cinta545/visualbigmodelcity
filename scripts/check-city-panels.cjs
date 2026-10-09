const {chromium}=require('playwright-core'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--use-angle=d3d11']});
 try{
  const page=await browser.newPage({viewport:{width:2560,height:1440}}),errors=[],results=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:4173/?city=xian');
  await page.waitForSelector('#loading[hidden]',{state:'attached',timeout:90000});
  for(const city of ['xian','tianjin','changchun','chongqing']){
   if(city!=='xian'){
    await page.locator(`[data-city="${city}"]`).click();
    await page.waitForFunction(id=>document.body.dataset.city===id&&document.getElementById('loading').hidden,city,{timeout:90000});
   }
   await page.waitForTimeout(1900);
   assert.equal(await page.locator('.view-dock img:visible').count(),5);
   const style=await page.evaluate(()=>({background:getComputedStyle(document.querySelector('header')).backgroundColor,cardWidth:document.querySelector('.view-dock button').getBoundingClientRect().width}));
   assert.equal(style.cardWidth,150);assert.equal(style.background,'rgba(32, 48, 43, 0.6)');
   await page.screenshot({path:`artifacts/${city}-unified-panels.png`});
   await page.locator('#fullscreen').click();
   for(const selector of ['.view-dock','#traffic-charts','#flow-panel'])assert.equal(await page.locator(selector).isVisible(),false);
   assert.equal(await page.locator('#fullscreen').innerText(),'恢复面板');
   await page.locator('#fullscreen').click();
   for(const selector of ['.view-dock','#traffic-charts','#flow-panel'])assert.equal(await page.locator(selector).isVisible(),true);
   results.push({city,...style,hideRestore:true});
  }
  assert.deepEqual(errors,[]);console.log(JSON.stringify({results,errors}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

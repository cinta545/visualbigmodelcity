const {chromium}=require('playwright-core'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--use-angle=d3d11']});
 try{
  const page=await browser.newPage({viewport:{width:1600,height:900}}),errors=[],results=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.route('**/src/city-home.mjs',async route=>{
   const response=await route.fetch(),body=(await response.text()).replace('function renderScene(',`
   window.polishAudit=()=>{
    playing=false;transition=null;const fits=[],waters=[];
    current.district.root.traverse(o=>{
     if(o.userData.plotFit){const b=current.config.buildings.find(b=>b.id===o.userData.plotFit.id),box=new THREE.Box3().setFromObject(o);
      fits.push({id:b.id,inside:box.min.x>=b.bounds[0]-.01&&box.max.x<=b.bounds[2]+.01&&-box.max.z>=b.bounds[1]-.01&&-box.min.z<=b.bounds[3]+.01});}
     if(o.isWater)waters.push({name:o.name,time:o.material.uniforms.time.value,visible:o.visible});
    });return {city:current.config.city,fits,waters};
   };
   window.polishWaterView=()=>{transition=null;const waters=[];current.district.root.traverse(o=>{if(o.isWater)waters.push(o);});
    const water=waters[0],box=new THREE.Box3().setFromObject(water),c=box.getCenter(new THREE.Vector3()),s=box.getSize(new THREE.Vector3()).length();
    camera.position.copy(c).add(new THREE.Vector3(s*.1,s*.30,s*.65));controls.target.copy(c);controls.update();};
   function renderScene(`);
   await route.fulfill({response,body});
  });
  await page.goto('http://127.0.0.1:4173/?start=120000');await page.waitForSelector('#loading[hidden]',{state:'attached',timeout:90000});
  for(const city of ['tianjin','changchun','chongqing','xian']){
   await page.locator(`button[data-city="${city}"]`).click();await page.waitForFunction(c=>document.body.dataset.city===c&&document.getElementById('loading').hidden,city,{timeout:90000});
   await page.waitForTimeout(900);const audit=await page.evaluate(()=>window.polishAudit());
   assert.ok(audit.fits.every(f=>f.inside),JSON.stringify(audit));assert.ok(audit.waters.every(w=>w.visible));
   await page.screenshot({path:`artifacts/polish-${city}-overview.png`});
   await page.locator('[data-view="sample"]').click();await page.waitForTimeout(1000);await page.screenshot({path:`artifacts/polish-${city}-detail.png`});
   if(audit.waters.length){await page.evaluate(()=>window.polishWaterView());await page.waitForTimeout(700);
    const next=await page.evaluate(()=>window.polishAudit());assert.ok(next.waters.every((w,i)=>w.visible&&w.time>audit.waters[i].time));
    await page.screenshot({path:`artifacts/polish-${city}-water.png`});}
   results.push(audit);
  }
  assert.deepEqual(errors,[]);console.log(JSON.stringify({results,errors}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

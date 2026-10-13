const {chromium}=require('playwright-core'),fs=require('node:fs'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--enable-webgl','--ignore-gpu-blocklist','--use-angle=d3d11']});
 try{
  const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/src/city-home.mjs',async route=>{const response=await route.fetch(),source=(await response.text()).replace('try{const catalog=',`window.__paperCheck=(id,ms)=>{playing=false;following=false;transition=null;time=ms;selected=id;$('object').hidden=false;lastHUD=-1e6;updateParticipants();updateHUD();return {count:forecastGeometry.drawRange.count,capacity:forecastBuffer.count}};try{const catalog=`);await route.fulfill({response,body:source});});
  for(const city of (process.argv.includes('--analysis-only')?[]:['tianjin','changchun','chongqing','xian'])){
   const data=JSON.parse(fs.readFileSync(city==='tianjin'?'data/sind/replay.json':`data/sind/records/${city}.json`));
   const track=data.tracks.find(t=>['car','bus','truck'].includes(t.type)&&t.samples.at(-1)[0]-t.samples[0][0]>10000&&t.samples.some(p=>p[0]>t.samples[0][0]+3500&&p[0]<t.samples.at(-1)[0]-5000&&Math.hypot(p[3],p[4])>1));
   assert.ok(track);const anchor=track.samples.find(p=>p[0]>track.samples[0][0]+3500&&p[0]<track.samples.at(-1)[0]-5000&&Math.hypot(p[3],p[4])>1)[0];
   const response=await fetch('http://127.0.0.1:4173/api/prediction/stdg-lstm',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({city,trackId:track.id,timeMs:anchor})}),result=await response.json();
   assert.equal(response.status,200,JSON.stringify(result));assert.equal(result.points.length,51);assert.equal(result.modes.length,6);assert.ok(result.modes.every(m=>m.points.length===51));assert.ok(Math.abs(result.modes.reduce((s,m)=>s+m.probability,0)-1)<1e-5);assert.ok(result.points.flat().every(Number.isFinite));
   await page.goto(`http://127.0.0.1:4173/?city=${city}&start=${anchor}`);await page.waitForSelector('#loading[hidden]',{state:'attached',timeout:60000});
   assert.equal(await page.locator('select[id*=prediction-model]').count(),0);
   await page.evaluate(({id,ms})=>window.__paperCheck(id,ms),{id:track.id,ms:anchor});
   await page.waitForFunction(()=>document.getElementById('prediction-detail').textContent.includes('未来5秒'),null,{timeout:45000});
   const draw=await page.evaluate(({id,ms})=>window.__paperCheck(id,ms),{id:track.id,ms:anchor});assert.equal(draw.count,51);assert.ok(draw.capacity>=51);
   assert.equal(await page.locator('#prediction-chart path').count(),9);
   if(city==='tianjin')await page.screenshot({path:'artifacts/stdg-lstm-home.png'});
   console.log(JSON.stringify({city,epoch:result.epoch,points:result.points.length,modes:result.modes.length,inferenceMs:result.inferenceMs}));
  }
  await page.route('**/src/sind-home.mjs',async route=>{const response=await route.fetch(),source=(await response.text()).replace('try{',`window.__paperAnalysis=(id,ms)=>{time=ms;playing=false;selectObject(id);return {count:forecastGeometry.drawRange.count,capacity:forecastPositions.count}};try{`);await route.fulfill({response,body:source});});
  const analysisData=JSON.parse(fs.readFileSync('data/sind/replay.json')),analysisTrack=analysisData.tracks.find(t=>t.type==='car'&&t.samples.at(-1)[0]-t.samples[0][0]>10000),ms=analysisTrack.samples.find(s=>s[0]>analysisTrack.samples[0][0]+3500)[0];
  await page.goto('http://127.0.0.1:4173/analysis.html');await page.waitForSelector('#loading[hidden]',{state:'attached',timeout:60000});
  assert.equal(await page.locator('select[id*=prediction-model],#gate-panel').count(),0);
  await page.waitForFunction(()=>document.querySelectorAll('#research-results tr').length===2);
  assert.ok((await page.locator('#research-status').textContent()).includes('第'+JSON.parse(fs.readFileSync('models/stdg-lstm/report.json')).bestEpoch+'轮'));
  await page.evaluate(({id,ms})=>window.__paperAnalysis(id,ms),{id:analysisTrack.id,ms});try{await page.waitForFunction(()=>document.getElementById('prediction-status').textContent.includes('未来 5 秒'),null,{timeout:45000});}catch(e){console.error(await page.locator('#prediction-status').textContent(),errors);throw e;}
  const analysisDraw=await page.evaluate(({id,ms})=>window.__paperAnalysis(id,ms),{id:analysisTrack.id,ms});assert.equal(analysisDraw.count,51);assert.ok(analysisDraw.capacity>=51);assert.ok((await page.locator('#prediction-errors').textContent()).includes('5 秒'));
  const downloadPromise=page.waitForEvent('download');await page.locator('#export-prediction').click();const download=await downloadPromise;await download.saveAs('artifacts/stdg-lstm-prediction.csv');assert.equal(fs.readFileSync('artifacts/stdg-lstm-prediction.csv','utf8').trim().split(/\r?\n/).length,52);
  assert.deepEqual(errors,[]);
  console.log(process.argv.includes('--analysis-only')?'Single-method analysis report, five-second errors/export and browser errors checked.':'Four-city single-method API/UI, five-second chart, 3D line, analysis report/export and browser errors checked.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

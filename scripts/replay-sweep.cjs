const {chromium}=require('playwright-core');
const path=require('node:path');
const fs=require('node:fs');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||path.join(process.env.LOCALAPPDATA,'ms-playwright/chromium-1228/chrome-win64/chrome.exe')});
 try{
  const page=await browser.newPage({viewport:{width:2560,height:1440}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:4173',{waitUntil:'networkidle'});
  await page.locator('#loading').waitFor({state:'hidden'});await page.locator('#play').click();
  const result=await page.evaluate(async()=>{
   const data=await(await fetch('/data/sind/replay.json')).json(),input=document.getElementById('time'),canvas=document.getElementById('scene');
   const times=[];for(let t=0;t<data.meta.durationMs;t+=15000)times.push(t);times.push(data.meta.durationMs);
   const failures=[],passes=[];
   for(let pass=0;pass<2;pass++){
    for(const t of times){
     input.value=t;input.dispatchEvent(new Event('input'));const actualTime=Number(input.value);
     const expected=data.tracks.filter(track=>track.samples[0][0]<=actualTime&&track.samples.at(-1)[0]>=actualTime).length;
     const actual=Number(canvas.dataset.active);if(actual!==expected)failures.push({pass,t:actualTime,expected,actual});
     await new Promise(requestAnimationFrame);
    }
    passes.push({modelCount:Number(canvas.dataset.modelCount),samples:times.length});
   }
   return {passes,failures,durationMs:data.meta.durationMs};
  });
  assert.deepEqual(errors,[]);assert.deepEqual(result.failures,[]);
  assert.equal(result.passes[1].modelCount,result.passes[0].modelCount,'model allocation grew on identical second sweep');
  assert.ok(result.passes[0].modelCount<150,'unexpectedly large model pool');
  const report={...result,errors,note:'Two 15-second-step timeline sweeps; not a continuous 20-minute run or GPU benchmark.'};
  fs.mkdirSync('docs/visual-check',{recursive:true});fs.writeFileSync('docs/visual-check/sweep.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

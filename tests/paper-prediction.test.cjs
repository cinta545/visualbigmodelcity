const test=require('node:test'),assert=require('node:assert/strict');
test('Only the trained paper method is exposed by every prediction page',async()=>{
 const fs=require('node:fs'),module=await import('../src/sind-prediction.mjs');
 for(const name of ['predict','baselineModels','baselineProtocol'])assert.equal(name in module,false);
 for(const file of ['index.html','analysis.html','sind-3d.html']){
  const html=fs.readFileSync(file,'utf8');assert.ok(html.includes('data-prediction-method="stdg-lstm"'));
  assert.ok(!/id="(?:home-)?prediction-model"/.test(html));assert.ok(!html.includes('id="gate-panel"'));
 }
});
test('Paper predictor sends only city identity and a causal anchor, rejecting stale selections',async()=>{
 const {createPaperPredictor}=await import('../src/paper-prediction.mjs');const pending=[],requests=[];
 const client=createPaperPredictor(()=>{},(url,options)=>{requests.push(JSON.parse(options.body));return new Promise(resolve=>pending.push(resolve));});
 const track={id:'Tianjin/test/1',samples:[[3000,0,0,1,0,0],[3100,1,0,1,0,0],[3200,999,999,999,999,0]]};
 assert.ok(client.get('tianjin',track,3150).reason);assert.deepEqual(requests[0],{city:'tianjin',trackId:track.id,timeMs:3100});
 const other={...track,id:'Tianjin/test/2'};client.get('tianjin',other,3150);
 pending[0]({ok:true,json:async()=>({anchorMs:3100,points:[[3100,0,0],[8100,1,1]]})});await new Promise(resolve=>setImmediate(resolve));
 assert.ok(client.get('tianjin',other,3150).reason,'old identity cannot populate new result');
 pending[1]({ok:true,json:async()=>({anchorMs:3100,points:[[3100,0,0],[8100,2,2]],horizonSeconds:5})});await new Promise(resolve=>setImmediate(resolve));
 assert.equal(client.get('tianjin',other,3150).horizonSeconds,5);assert.ok(client.get('tianjin',other,5000).reason);client.reset();
});
test('Five-second forecast evaluation keeps incomplete truth unknown',async()=>{
 const {evaluate}=await import('../src/sind-prediction.mjs');const samples=Array.from({length:81},(_,i)=>[i*100,i/10,0,1,0,0]);
 const points=Array.from({length:51},(_,i)=>[3000+i*100,3+i/10,0]);
 assert.deepEqual(evaluate({samples},{anchorMs:3000,points}).map(r=>r.errorM),[0,0,0,0,0]);
 assert.equal(evaluate({samples:samples.slice(0,70)},{anchorMs:3000,points}).at(-1).errorM,null);
});
test('New observation anchor retries after a history error without the old retry delay',async()=>{
 const {createPaperPredictor}=await import('../src/paper-prediction.mjs');let calls=0;
 const client=createPaperPredictor(()=>{},async()=>{calls++;return {ok:false,json:async()=>({reason:'历史不足'})};});
 const track={id:'Tianjin/test/1',samples:[[1000,0,0,1,0,0],[4000,3,0,1,0,0]]};
 client.get('tianjin',track,1000);await new Promise(resolve=>setImmediate(resolve));
 assert.equal(client.get('tianjin',track,1000).reason,'历史不足');assert.equal(calls,1);
 client.get('tianjin',track,4000);assert.equal(calls,2);await new Promise(resolve=>setImmediate(resolve));client.reset();
});

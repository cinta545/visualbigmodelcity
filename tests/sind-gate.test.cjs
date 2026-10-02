const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
test('gate features are causal including future modification and truncation',async()=>{
 const {gateFeatures}=await import('../src/sind-gate.mjs');
 const past=Array.from({length:11},(_,i)=>[i*100,i/10,0,1+i/10,.1*i,0]);
 const track={type:'car',samples:past};const expected=gateFeatures(track,1050);
 assert.deepEqual(gateFeatures({...track,samples:[...past,[1100,999,999,999,-999,2]]},1050),expected);
 assert.equal(gateFeatures(track,300),null);assert.equal(gateFeatures(track,1400),null);
});
test('cost tree learns past-feature partition and stays constant when features cannot split',async()=>{
 const {trainGate,applyGate,gateProtocol}=await import('../src/sind-gate.mjs');
 const rows=Array.from({length:20},(_,i)=>({recording:'train',trackId:String(i),features:[i,0,0,0,0],errors:i<10?[0,5,5,5]:[5,5,0,5]}));
 const tree=trainGate(rows,{...gateProtocol,maxDepth:1,minLeafAnchors:2,quantiles:[.5]});
 assert.equal(applyGate(tree,[0,0,0,0,0]),'cv');assert.equal(applyGate(tree,[19,0,0,0,0]),'dca');
 const constant=trainGate(rows.map(r=>({...r,features:[0,0,0,0,0]})));assert.equal(constant.feature,undefined);
});
test('leave-recording-out reports disjoint folds and identical evaluation populations',()=>{
 const r=JSON.parse(fs.readFileSync('data/sind/gate-evaluation.json')),baseline=JSON.parse(fs.readFileSync('data/sind/research-evaluation.json'));
 assert.equal(r.folds.length,4);
 for(const f of r.folds){
  assert.equal(f.trainingRecords.length,3);assert.ok(!f.trainingRecords.includes(f.heldOut));
  assert.equal(f.testAnchors,Object.values(f.chosen).reduce((a,b)=>a+b,0));
  assert.equal(f.gate.n,f.dca.n);assert.equal(f.gate.tracks,f.dca.tracks);
  const expected=baseline.byRecording[f.heldOut].find(g=>g.model==='dca'&&g.horizonS===3&&g.dimension==='all');assert.equal(f.dca.n,expected.n);assert.ok(Math.abs(f.dca.fdeM-expected.fdeM)<1e-9);
 }
});

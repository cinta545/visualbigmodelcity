const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{createHash}=require('node:crypto');
test('Four-city cases retain source provenance, causal risk anchors and continuous verification windows',async()=>{
 const {continuousWindow}=await import('../src/city-risk-cases.mjs'),{assessRisks}=await import('../src/sind-risk.mjs');
 const manifest=JSON.parse(fs.readFileSync('data/sind/cities/risk-cases.json')),catalog=JSON.parse(fs.readFileSync('data/sind/cities/catalog.json'));
 for(const city of catalog){const source=fs.readFileSync('.'+city.tracks),tracks=JSON.parse(source).tracks,lookup=new Map(tracks.map(t=>[t.id,t])),index=manifest.cities[city.id];assert.equal(index.sourceSha256,createHash('sha256').update(source).digest('hex'));assert.ok(index.cases.some(e=>e.kind==='cross'));assert.ok(index.cases.some(e=>e.kind==='rear'));
  for(const e of index.cases){const pair=e.trackIds.map(id=>lookup.get(id)),focus=lookup.get(e.focusId);assert.ok(continuousWindow(focus,e.anchorMs-3000,e.anchorMs+5000));assert.ok(pair.every(t=>continuousWindow(t,e.anchorMs,e.anchorMs+5000)));const event=assessRisks(pair,e.anchorMs).find(v=>v.kind===e.kind);assert.ok(event);assert.ok(Math.abs(event.ttcS-e.ttcS)<1e-8);const past=pair.map(t=>({...t,samples:t.samples.filter(p=>p[0]<=e.anchorMs)}));assert.equal(assessRisks(past,e.anchorMs).find(v=>v.kind===e.kind).ttcS,event.ttcS);}
 }
});
test('Case playback is bounded and actual future reveal stops at a data gap',async()=>{
 const {caseClock,caseTruth,caseError,continuousWindow}=await import('../src/city-risk-cases.mjs');const track={samples:Array.from({length:81},(_,i)=>[i*100,i,0,10,0,0])},entry={anchorMs:3000};
 assert.equal(caseClock(7900,200,entry),8000);assert.equal(caseClock(2000,0,entry),3000);assert.equal(caseTruth(track,3000,3450).length,5);
 const forecast={anchorMs:3000,points:track.samples.slice(30)};assert.equal(caseError(track,forecast,5000).mean,0);assert.equal(caseError(track,forecast,3000),null);
 const gap={samples:track.samples.filter(p=>p[0]<4000||p[0]>4500)};assert.equal(continuousWindow(gap,3000,5000),false);assert.equal(caseTruth(gap,3000,5000).at(-1)[0],3900);
});
test('Resetting the predictor rejects an old response even when the same case is reselected',async()=>{
 const {createPaperPredictor}=await import('../src/paper-prediction.mjs');const pending=[],request=()=>new Promise(resolve=>pending.push(resolve)),predictor=createPaperPredictor(()=>{},request),track={id:'test/1',samples:[[3000,0,0]]};
 predictor.get('test',track,3000);predictor.reset();predictor.get('test',track,3000);pending[0]({ok:true,json:async()=>({anchorMs:3000,points:[[3000,99,99]]})});await new Promise(r=>setImmediate(r));assert.equal(predictor.get('test',track,3000).points,undefined);
 pending[1]({ok:true,json:async()=>({anchorMs:3000,points:[[3000,1,1]]})});await new Promise(r=>setImmediate(r));assert.equal(predictor.get('test',track,3000).points[0][1],1);
});

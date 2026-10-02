const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
test('research split guards reject recording and group leakage',async()=>{
 const {validateRecords}=await import('../src/sind-research.mjs');
 const a={id:'a',path:'a.json',group:'session1',split:'train'};
 assert.equal(validateRecords([a]),false);
 assert.throws(()=>validateRecords([a,{...a,id:'b',path:'b.json',split:'test'}]));
 assert.throws(()=>validateRecords([a,{...a,group:'other'}]));
 assert.equal(validateRecords([a,{id:'b',path:'b',group:'session2',split:'validation'},{id:'c',path:'c',group:'session3',split:'test'}]),true);
});
test('ADE uses future points and macro averages avoid long-track weighting',async()=>{
 const {trajectoryErrors,summarizeErrors,auditRecording}=await import('../src/sind-research.mjs');
 const samples=Array.from({length:11},(_,i)=>[i*100,0,0,0,0,0]),points=samples.map(r=>[r[0],r[0]/1000,0]);
 const e=trajectoryErrors({samples},{anchorMs:0,points},1);assert.ok(Math.abs(e.adeM-.55)<1e-12);assert.equal(e.fdeM,1);
 assert.equal(trajectoryErrors({samples:samples.filter((_,i)=>i<3||i>7)},{anchorMs:0,points},1),null);
 const s=summarizeErrors([{recording:'r',trackId:'a',adeM:0,fdeM:0},{recording:'r',trackId:'a',adeM:0,fdeM:0},{recording:'r',trackId:'b',adeM:6,fdeM:6}]);assert.equal(s.adeM,2);assert.equal(s.trackMacroAdeM,3);
 assert.ok(auditRecording({tracks:[{id:'r/a',type:'car',length:4,width:2,samples:[samples[0],samples[0]]}]},'r').errors.length);
});
test('development report has paired samples and eligibility accounting',()=>{
 const r=JSON.parse(fs.readFileSync('data/sind/research-evaluation.json'));
 assert.equal(r.independentSplitConfigured,false);assert.equal(r.sources[0].audit.rows,166065);
 const e=r.sources[0].eligibility;
 for(const h of [1,2,3]){assert.equal(e.anchors,e.missingHistory+e.missingTruth[h]+e.eligible[h]);const rows=r.groups.filter(g=>g.dimension==='all'&&g.horizonS===h);assert.equal(rows.length,4);for(const row of rows)assert.equal(row.n,rows[0].n);}
});
test('multi-city aggregation preserves per-record denominators and disjoint motion strata',()=>{
 const r=JSON.parse(fs.readFileSync('data/sind/research-evaluation.json'));
 assert.equal(r.sources.length,4);assert.equal(r.sources.reduce((n,s)=>n+s.audit.rows,0),972997);
 assert.equal(r.sources.reduce((n,s)=>n+s.audit.tracks,0),2757);
 for(const h of [1,2,3])for(const model of ['cv','ca','dca','ctrv']){
  const total=r.groups.find(g=>g.dimension==='all'&&g.horizonS===h&&g.model===model);
  let n=0,sum=0;
  for(const source of r.sources){
   const groups=r.byRecording[source.id].filter(g=>g.horizonS===h&&g.model===model),all=groups.find(g=>g.dimension==='all');
   n+=all.n;sum+=all.fdeM*all.n;
   for(const dimension of ['motion','type','futureMotion'])assert.equal(groups.filter(g=>g.dimension===dimension).reduce((s,g)=>s+g.n,0),all.n);
   const e=source.eligibility;assert.equal(e.anchors,e.missingHistory+e.missingTruth[h]+e.eligible[h]);
  }
  assert.equal(n,total.n);assert.ok(Math.abs(sum/n-total.fdeM)<1e-9);
 }
});
test('failure case export reproduces its prediction from causal history',async()=>{
 const {predict}=await import('../src/sind-prediction.mjs');
 const report=JSON.parse(fs.readFileSync('data/sind/research-failure-cases.json'));
 for(const c of report.cases){
  const prediction=predict({id:c.trackId,type:c.type,samples:c.samples.filter(s=>s[0]<=c.anchorMs)},c.anchorMs,c.model);
  prediction.points.forEach((p,i)=>p.forEach((v,k)=>assert.ok(Math.abs(v-c.prediction[i][k])<1e-9)));
 }
});

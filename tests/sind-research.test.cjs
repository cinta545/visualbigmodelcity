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

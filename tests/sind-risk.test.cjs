const test=require('node:test'),assert=require('node:assert/strict');
const make=(id,x,y,vx,vy,yaw=0,type='car')=>({id,type,length:4,width:2,samples:[[0,x,y,vx,vy,yaw]]});
test('continuous envelope TTC detects crossing and rear-end without adjacent-lane false positive',async()=>{
 const {assessRisks}=await import('../src/sind-risk.mjs');
 const rear=assessRisks([make('a',0,0,10,0),make('b',14,0,5,0)],0)[0];
 assert.equal(rear.kind,'rear');assert.equal(rear.ttcS,2);assert.equal(rear.gapM,10);assert.equal(rear.closingMps,5);
 assert.equal(assessRisks([make('a',0,0,10,0),make('b',14,3,5,0)],0).length,0);
 assert.equal(assessRisks([make('a',0,0,5,0),make('b',14,0,10,0)],0).length,0);
 const cross=assessRisks([make('a',-10,0,5,0),make('b',0,-10,0,5,Math.PI/2)],0)[0];
 assert.equal(cross.kind,'cross');assert.ok(Math.abs(cross.ttcS-1.4)<1e-10);
 assert.equal(assessRisks([make('a',-10,0,5,0),make('b',0,-30,0,5,Math.PI/2)],0).length,0);
});
test('risk uses past observations, aligns timestamps causally, and labels assumptions',async()=>{
 const {assessRisks,riskState}=await import('../src/sind-risk.mjs');
 const a=make('a',0,0,10,0),b=make('b',14,0,5,0);
 const expected=assessRisks([a,b],50);a.samples.push([100,999,999,999,999,2]);
 assert.deepEqual(assessRisks([a,b],50),expected);assert.equal(riskState(b,50).p[0],14.25);
 assert.equal(riskState(b,251),null);assert.equal(riskState(b,-1),null);
 const ped=make('p',10,0,0,0,0,'pedestrian');
 const e=assessRisks([make('a',0,0,5,0),ped],0)[0];assert.equal(e.kind,'vulnerable');assert.equal(e.b.assumedSize,true);
 assert.equal(assessRisks([ped,make('p2',10,0,0,0,0,'pedestrian')],0).length,0);
 assert.equal(assessRisks([make('a',0,0,0,0),make('b',1,0,0,0)],0)[0].kind,'overlap');
});

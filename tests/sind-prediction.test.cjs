const test=require('node:test'),assert=require('node:assert/strict');
const track=(samples,type='car')=>({id:'test',type,samples});
test('prediction does not read interpolated or future observations',async()=>{
 const {predict}=await import('../src/sind-prediction.mjs');
 const past=Array.from({length:11},(_,i)=>[i*100,i/10,0,1,0,0]);
 const a=track([...past,[1100,1000,1000,1000,1000,0]]),b=track([...past,[1100,-1000,-1000,-1000,-1000,0]]);
 for(const model of ['cv','ca','dca','ctrv']){
  assert.deepEqual(predict(a,1050,model),predict(b,1050,model));
  assert.deepEqual(predict(a,1050,model),predict(track(past),1050,model));
 }
 assert.equal(predict(a,1050).anchorMs,1000);
 assert.deepEqual(predict(a,1050).points.at(-1),[4000,4,0]);
 assert.ok(predict(track(past),1300).reason);
 assert.ok(predict(track(past,'pedestrian'),1000).reason);
});
test('CTRV recovers a circular path including wrapped velocity headings',async()=>{
 const {predict}=await import('../src/sind-prediction.mjs');
 const speed=4,omega=.4,theta=3;
 const samples=Array.from({length:11},(_,i)=>{const t=i/10,h=theta+omega*t;return [t*1000,speed/omega*(Math.sin(h)-Math.sin(theta)),speed/omega*(Math.cos(theta)-Math.cos(h)),speed*Math.cos(h),speed*Math.sin(h),h];});
 const f=predict(track(samples),1000,'ctrv');assert.ok(Math.abs(f.turnRateRadS-omega)<1e-12);assert.equal(f.turnFallback,false);
 const end=theta+omega*4;assert.ok(Math.abs(f.points.at(-1)[1]-speed/omega*(Math.sin(end)-Math.sin(theta)))<1e-10);assert.ok(Math.abs(f.points.at(-1)[2]-speed/omega*(Math.cos(theta)-Math.cos(end)))<1e-10);
 const slow=track(samples.map(r=>[r[0],r[1],r[2],0,0,r[5]]));const fallback=predict(slow,1000,'ctrv');assert.equal(fallback.turnFallback,true);assert.deepEqual(fallback.points,predict(slow,1000,'cv').points);
});
test('DCA integrates exponentially decaying acceleration with a fixed time constant',async()=>{
 const {predict}=await import('../src/sind-prediction.mjs');
 const samples=Array.from({length:11},(_,i)=>{const t=i/10;return [t*1000,t*t,0,2*t,0,0];});
 const f=predict(track(samples),1000,'dca');assert.equal(f.dampingTauS,1);
 assert.ok(Math.abs(f.points.at(-1)[1]-(1+2*3+2*(3-1+Math.exp(-3))))<1e-10);
 assert.ok(predict(track(samples),1000,'bad').reason);
});
test('CA recovers constant acceleration and evaluation rejects incomplete truth',async()=>{
 const {predict,evaluate}=await import('../src/sind-prediction.mjs');
 const t=track(Array.from({length:41},(_,i)=>{const s=i/10;return [i*100,s*s,0,2*s,0,0];}));
 const f=predict(t,1000,'ca');
 assert.ok(Math.abs(f.acceleration[0]-2)<1e-10);
 assert.ok(evaluate(t,f).every(s=>s.errorM<1e-10));
 assert.ok(predict(t,200,'ca').reason);
 const short=track(t.samples.filter(r=>r[0]<=2000));
 assert.equal(evaluate(short,f)[1].errorM,null);
 const gap=track(t.samples.filter(r=>r[0]<1500||r[0]>1900));
 assert.ok(evaluate(gap,f).every(s=>s.errorM===null));
 assert.ok(predict(track([[0,0,0,0,0,0],[1000,1,0,1,0,0]]),1000,'ca').reason);
});

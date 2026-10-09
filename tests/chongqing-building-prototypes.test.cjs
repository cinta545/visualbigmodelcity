const test=require('node:test'),assert=require('node:assert/strict');
test('Chongqing building volumes preserve plot bounds and open courtyards and ground passages',async()=>{
 const {buildingVolumes}=await import('../src/chongqing-building-prototypes.mjs');
 const cases=[['oldstreet','commercial'],['courtyard','commercial'],['courtyard','residential'],['courtyard','office'],['tower','office']];
 const types=new Set();
 for(const [architecture,kind]of cases){
  const plan=buildingVolumes({architecture,kind,bounds:[-10,-9,10,9],height:30});types.add(plan.type);
  for(const [x,y,z,w,h,d]of plan.parts){assert.ok(w>0&&h>0&&d>0);assert.ok(Math.abs(x)+w/2<=10+.001);assert.ok(Math.abs(z)+d/2<=9+.001);assert.ok(y>=0&&y+h<=30+.001);}
  if(kind==='commercial'||kind==='office'&&architecture==='courtyard'){
   const blocked=plan.parts.some(([x,y,z,w,h,d])=>Math.abs(x)<w/2&&1>y&&1<y+h&&Math.abs(4-z)<d/2);
   assert.equal(blocked,false,'ground-level courtyard or passage must be open');
  }
 }
 assert.equal(types.size,5);
});

const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
test('Unified Changchun paint covers four approaches with paired yellow and phased white lines',async()=>{
 const {unifiedRoadMarkings,onRoad}=await import('../src/city-road-continuation.mjs');
 const c=JSON.parse(fs.readFileSync('data/sind/cities/changchun.json')),before=JSON.stringify(c),paint=unifiedRoadMarkings(c);
 for(const app of c.approaches){
  const lines=paint.filter(s=>s.approach===app.id);
  assert.deepEqual([...new Set(lines.map(s=>s.offset))],[-3.5,-.17,.17,3.5]);
  for(const s of lines){
   assert.ok(onRoad(c,s.a)&&onRoad(c,s.b));
   if(s.color==='white'&&s.station>=18)assert.ok((s.station-18)%10<4);
  }
  for(const offset of [-.17,.17]){
   const yellow=lines.filter(s=>s.offset===offset);
   assert.ok(yellow.length>500);
   for(let i=1;i<yellow.length;i++)assert.ok(Math.hypot(...yellow[i].a.map((v,k)=>v-yellow[i-1].b[k]))<1e-8,'yellow stays continuous across survey seam');
  }
 }
 assert.equal(JSON.stringify(c),before,'rendering must not rewrite source maps or events');
});

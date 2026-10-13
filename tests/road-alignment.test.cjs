const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
test('Four-city road joins match measured lateral edges and preserve surveyed maps',async()=>{
 const {continuationPoint,unifiedRoadMarkings,onRoad,markingRibbons}=await import('../src/city-road-continuation.mjs');
 const plans=JSON.parse(fs.readFileSync('data/sind/cities/road-alignment.json'));
 for(const city of Object.keys(plans)){
  const source=JSON.parse(fs.readFileSync(`data/sind/cities/${city}.json`)),before=JSON.stringify(source),plan=plans[city];
  assert.equal(plan.profiles.length,4);
  const c={...source,extension:plan.extension,extensionAxes:source.extensionAxes.map((a,i)=>({...a,alignment:plan.profiles[i]}))};
  for(const axis of c.extensionAxes){
   const p=axis.alignment;assert.ok(p.left<p.right&&p.end>p.start);
   const [a,b]=axis.points,L=Math.hypot(b[0]-a[0],b[1]-a[1]),n=[-(b[1]-a[1])/L,(b[0]-a[0])/L];
   for(const [s,offset] of [[p.start,(p.left+p.right)/2],[p.end,0]]){
    const q=continuationPoint(axis,s);assert.ok(Math.abs((q[0]-a[0])*n[0]+(q[1]-a[1])*n[1]-offset)<1e-7);
   }
   assert.ok(Math.hypot(...continuationPoint(axis,p.end-.001).map((v,i)=>v-continuationPoint(axis,p.end+.001)[i]))<.003);
  }
  const paint=unifiedRoadMarkings(c);assert.ok(paint.length>100);
  for(const s of paint){assert.ok(onRoad(c,s.a)&&onRoad(c,s.b));}
  for(const app of c.approaches){
   for(const offset of [-.17,.17]){
    const line=paint.filter(s=>s.approach===app.id&&s.offset===offset&&s.station>=24);
    assert.ok(line.length>500,city+' has a continuous center line beyond the stop area');
    for(let i=1;i<line.length;i++)assert.ok(Math.hypot(line[i].a[0]-line[i-1].b[0],line[i].a[1]-line[i-1].b[1])<1e-8,city+' has no displaced join');
   }
   const white=paint.filter(s=>s.approach===app.id&&s.color==='white'&&s.station>=18);
   for(const s of white)assert.ok((s.station-18)%10<4,city+' keeps one dash phase');
  }
  // Every far solid stripe must be one ribbon, rather than individually
  // shaded boxes. Its divider follows the same alignment as the carriageway.
  const ribbons=markingRibbons(paint);
  for(const axis of c.extensionAxes){
   const [a,b]=axis.points,L=Math.hypot(b[0]-a[0],b[1]-a[1]),d=[(b[0]-a[0])/L,(b[1]-a[1])/L],n=[-d[1],d[0]];
   const app=c.approaches.reduce((best,v)=>Math.hypot(v.center[0]-a[0],v.center[1]-a[1])<Math.hypot(best.center[0]-a[0],best.center[1]-a[1])?v:best);
   for(const offset of [-.17,.17]){
    const far=paint.filter(s=>s.approach===app.id&&s.offset===offset&&((s.a[0]-a[0])*d[0]+(s.a[1]-a[1])*d[1])>=axis.alignment.start);
    assert.ok(far.length>500);
    for(const s of far){const station=(s.a[0]-a[0])*d[0]+(s.a[1]-a[1])*d[1],q=continuationPoint(axis,station);
     assert.ok(Math.hypot(s.a[0]-q[0]-n[0]*offset,s.a[1]-q[1]-n[1]*offset)<1e-7,city+' paint follows road alignment');}
    assert.equal(ribbons.filter(r=>r.approach===app.id&&r.offset===offset&&r.points.some(p=>(p[0]-a[0])*d[0]+(p[1]-a[1])*d[1]>axis.alignment.end)).length,1,city+' has one joined far stripe');
   }
  }
  for(const r of ribbons){assert.equal(r.positions.length,r.points.length*6);assert.equal(r.indices.length,(r.points.length-1)*6);assert.ok(r.positions.every(Number.isFinite));}
  assert.equal(JSON.stringify(source),before);
 }
});

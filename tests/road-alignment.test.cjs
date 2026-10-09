const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
test('Four-city road joins match measured lateral edges and preserve surveyed maps',async()=>{
 const {continuationPoint,continuationPaint,onRoad,onSurveyRoad}=await import('../src/city-road-continuation.mjs');
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
  const paint=continuationPaint(c);assert.ok(paint.length>100);
  for(const s of paint){assert.ok(onRoad(c,s.a)&&onRoad(c,s.b));assert.ok(!onSurveyRoad(c,s.a)&&!onSurveyRoad(c,s.b));}
  assert.equal(JSON.stringify(source),before);
 }
});

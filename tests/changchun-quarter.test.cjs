const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
test('Changchun landmark plan preserves six exhibits, low background and a connected scenic railway',()=>{
 const source=JSON.parse(fs.readFileSync('data/sind/cities/changchun.json'));
 const quarter=JSON.parse(fs.readFileSync('data/sind/cities/changchun-quarter.json'));
 assert.equal(quarter.designOnly,true);assert.equal(new Set(quarter.buildings.map(b=>b.id)).size,quarter.buildings.length);
 assert.equal(quarter.buildings.filter(b=>b.landmark).length,6);
 for(const id of ['changchun-0','changchun-1','changchun-2']){const b=quarter.buildings.find(b=>b.id===id);assert.ok(b.bounds[2]-b.bounds[0]>=35);assert.ok(b.verticalBoost>1);}
 assert.equal(quarter.planVersion,'landmark-elevated');assert.ok(quarter.forest);assert.ok(quarter.groves.length>50);assert.ok(quarter.tramRailHeight>=7);assert.ok(quarter.tramPiers.length>5);assert.equal(quarter.audit.piersAvoidTraffic,true);assert.ok(quarter.tramRail[0][0]<source.center[0]-190&&quarter.tramRail.at(-1)[0]>source.center[0]+190);assert.ok(quarter.tramRail.length>50);
 for(let i=1;i<quarter.tramRail.length;i++)assert.ok(Math.hypot(...quarter.tramRail[i].map((v,j)=>v-quarter.tramRail[i-1][j]))<12);
 for(let i=0;i<quarter.buildings.length;i++){
  const a=quarter.buildings[i];assert.ok(a.bounds.every(Number.isFinite));assert.ok(a.bounds[2]>a.bounds[0]&&a.bounds[3]>a.bounds[1]);
  if(!a.landmark)assert.ok(a.height<=9.8);
  for(const b of quarter.buildings.slice(i+1))assert.ok(a.bounds[2]<=b.bounds[0]||b.bounds[2]<=a.bounds[0]||a.bounds[3]<=b.bounds[1]||b.bounds[3]<=a.bounds[1],`${a.id} overlaps ${b.id}`);
 }
 for(const field of ['tracks','signals','flowEvents','road','extension'])assert.equal(Object.hasOwn(quarter,field),false);
});

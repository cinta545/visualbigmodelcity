const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
test('Chongqing neon-night plan keeps nine landmark kinds, continuous terraced blocks and a spanning cableway',()=>{
 const quarter=JSON.parse(fs.readFileSync('data/sind/cities/chongqing-quarter.json'));
 assert.equal(quarter.designOnly,true);assert.equal(quarter.planVersion,'reference-terraced-night');
 assert.equal(new Set(quarter.buildings.map(b=>b.id)).size,quarter.buildings.length);
 const roles={};for(const b of quarter.buildings)roles[b.quarterRole]=(roles[b.quarterRole]||0)+1;
 assert.equal(roles.landmark,10);assert.ok(roles.infill>100);assert.equal(roles.skyline||0,0);assert.ok(quarter.scenicRail.height>=10);assert.ok(quarter.scenicRail.piers.length>0);
 const kinds=new Set(quarter.buildings.filter(b=>b.quarterRole==='landmark').map(b=>b.landmarkKind));
 for(const kind of ['hongya','raffles','baixiang','liziba','luohan','shancheng','jiefangbei','erchang','cableway'])assert.ok(kinds.has(kind),kind);
 // The nine exhibits must rise above the everyday fabric the way the source art shows.
 for(let i=0;i<quarter.buildings.length;i++){
  const a=quarter.buildings[i];assert.ok(a.bounds.every(Number.isFinite));assert.ok(a.bounds[2]>a.bounds[0]&&a.bounds[3]>a.bounds[1]);
  if(a.quarterRole==='infill')assert.ok(a.height>=7.4&&a.height<=82);
  for(const b of quarter.buildings.slice(i+1))assert.ok(a.bounds[2]<=b.bounds[0]||b.bounds[2]<=a.bounds[0]||a.bounds[3]<=b.bounds[1]||b.bounds[3]<=a.bounds[1],`${a.id} overlaps ${b.id}`);
 }
 assert.equal(quarter.terrain.depth,7);assert.equal(quarter.terrain.avoidsTraffic,true);const road=quarter.terrain.road;assert.ok(Math.abs(road[0][2])<1e-9);assert.ok(Math.abs(road.at(-1)[2])<1e-9);assert.ok(Math.min(...road.map(p=>p[2]))<=-6.9);assert.ok(road.every(p=>p.every(Number.isFinite)));
 const lower=quarter.buildings.filter(b=>b.surfaceHeight<0);assert.ok(lower.length>0);assert.ok(lower.every(b=>b.surfaceHeight===-quarter.terrain.depth));
 for(const architecture of ['oldstreet','courtyard','tower'])assert.ok(quarter.buildings.some(b=>b.architecture===architecture));
 assert.deepEqual(quarter.terrain.plateaus.map(p=>p.height),[3.5,7]);
 for(const level of [3.5,7])assert.ok(quarter.buildings.some(b=>b.surfaceHeight===level));
 assert.equal(quarter.terrain.connections.length,2);
 assert.equal(quarter.terrain.slopeMeshes.length,2);
 for(let i=0;i<2;i++){
  const vertices=quarter.terrain.slopeMeshes[i],{height,base}=quarter.terrain.plateaus[i];
  assert.ok(vertices.length>90&&vertices.length%9===0);
  assert.ok(vertices.every(Number.isFinite));
  const elevations=vertices.filter((_,index)=>index%3===1);
  assert.ok(elevations.every(y=>y>=base-1e-4&&y<=height+1e-4));
  assert.ok(elevations.some(y=>y>base+.5&&y<height-.5),'slope needs intermediate elevations');
 }
 const lowerVertices=quarter.terrain.lowerMesh;
 assert.ok(lowerVertices.length>90&&lowerVertices.length%9===0&&lowerVertices.every(Number.isFinite));
 const grades=lowerVertices.filter((_,i)=>i%3===1);
 assert.ok(grades.every(y=>y>=-7&&y<=0));
 assert.ok(grades.some(y=>y>-6&&y<-1));
 assert.ok(quarter.terrain.plants.length>20&&quarter.terrain.plants.every(p=>p.every(Number.isFinite)));
 for(const connection of quarter.terrain.connections){const [a,b]=connection.points;assert.ok(a.every(Number.isFinite)&&b.every(Number.isFinite));assert.ok(Math.hypot(a[0]-b[0],a[1]-b[1])>=Math.abs(a[2]-b[2])*8);}
 assert.equal(quarter.audit.overlaps,0);assert.ok(quarter.audit.clearance>=5);assert.equal(quarter.audit.sourceRoadsUnchanged,true);
 assert.ok(quarter.audit.cableClearance>5);assert.ok(quarter.audit.bridgeClearance>5);
 const [s0,s1]=quarter.cableway.stations,span=Math.hypot(s0[0]-s1[0],s0[1]-s1[1]);
 assert.ok(span>=170&&span<=340,span);assert.ok(quarter.cableway.towerHeight>=20);
 assert.equal(quarter.mountains.length,0);assert.ok(quarter.bridge.deckY>=30&&quarter.bridge.pylons.length===2);
 for(const field of ['tracks','signals','flowEvents','road','extension','ways','crosswalks'])assert.equal(Object.hasOwn(quarter,field),false);
});

const test=require("node:test"),assert=require("node:assert/strict");
const {DistrictEngine}=require("../server/district-engine");
const {SceneStore}=require("../server/store");
const seed=require("../server/district-seed");
test("core district does not auto-generate extra intersections or incidents",()=>{
 const e=new DistrictEngine(seed),map=e.getMapSnapshot();
 assert.equal(map.intersections.length,1);assert.equal(map.signals.length,1);assert.equal(map.fleet.length,60);assert.equal(map.events.length,0);
 assert.equal(e.getOverview().derived.corridors.length,0);
});
test("15 simulated minutes: signal cycles, queues, red stop line and inbound gaps",()=>{
 const e=new DistrictEngine(seed),s=e.state.seed,seen=new Set();let queued=false;
 for(let step=0;step<18000;step++){
  const before=s.fleet.map(v=>({s:v.s,generation:v.generation}));
  e.stepTraffic(.05);const phase=s.signals[0].currentPhase;seen.add(phase);
  for(let i=0;i<s.fleet.length;i++){
   const v=s.fleet[i],old=before[i];assert.ok(Number.isFinite(v.position.x)&&Number.isFinite(v.position.y)&&v.velocity>=0);
   if(old.s+v.length/2<v.stopS-.1&&v.s+v.length/2>v.stopS&&old.generation===v.generation)assert.equal(phase,v.approach+"_GREEN","red crossing "+v.id);
   if(v.velocity<.2&&v.s<v.stopS)queued=true;
  }
  if(step%10===0)for(const a of ["W","E","N","S"])for(let lane=0;lane<3;lane++){
   const cars=s.fleet.filter(v=>v.approach===a&&v.lane===lane&&v.s<v.stopS).sort((a,b)=>a.s-b.s);
   for(let i=1;i<cars.length;i++)assert.ok(cars[i].s-cars[i-1].s>(cars[i].length+cars[i-1].length)/2+.5,"overlapping queue");
  }
 }
 assert.equal(seen.size,12);assert.ok(queued);assert.ok(s.fleet.every(v=>v.generation>=1),"all cars complete a route");
});
test("paused simulation keeps positions and phase unchanged",()=>{
 const e=new DistrictEngine(seed);e.togglePlayback();const before=JSON.stringify(e.getMapSnapshot().fleet);const phase=e.getMapSnapshot().signalState.phase;
 e.tick(10);assert.equal(JSON.stringify(e.getMapSnapshot().fleet),before);assert.equal(e.getMapSnapshot().signalState.phase,phase);
});
test("new district resumes from its ledger with lane routing intact",()=>{
 const store=new SceneStore(":memory:");const e=new DistrictEngine(seed,{store});e.tick(1);e.persistCheckpoint();
 const position=e.state.seed.fleet[0].progress;
 const resumed=new DistrictEngine(seed,{store});
 assert.equal(resumed.state.seed.fleet[0].progress,position);
 assert.ok(resumed.state.seed.fleet.every(v=>v.distances.length===v.route.length&&v.approach&&Number.isFinite(v.stopS)));
 resumed.tick(.1);store.close();
});
test("display speeds and per-approach states match traffic state",()=>{
 const e=new DistrictEngine(seed);for(let i=0;i<100;i++)e.stepTraffic(.05);e.refresh("test");
 const map=e.getMapSnapshot(),entities=e.getEntities("vehicle","").items;
 for(const v of map.fleet){const entity=entities.find(x=>x.id===v.id);assert.equal(entity.stats["速度"],Math.round(v.velocity*3.6)+" km/h");}
 assert.equal(Object.values(map.signalState.approaches).filter(c=>c==="green").length,1);
});


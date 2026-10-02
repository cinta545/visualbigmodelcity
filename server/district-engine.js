const { TwinEngine } = require("./twin-engine");
const layout=require("../shared/district.json");
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
function sample(v,s){
 const ds=v.distances,pts=v.route;
 let i=1;while(i<ds.length-1&&ds[i]<s)i++;
 const t=clamp((s-ds[i-1])/(ds[i]-ds[i-1]||1),0,1),a=pts[i-1],b=pts[i];
 return {x:a[0]+(b[0]-a[0])*t,y:a[1]+(b[1]-a[1])*t,heading:Math.atan2(-(b[1]-a[1]),b[0]-a[0])};
}
class DistrictEngine extends TwinEngine {
 prepareSeed(){this.state.seed=JSON.parse(JSON.stringify(this.originSeed));}
 bootstrapFromStore(){
  if(!this.store)return false;
  const snapshot=this.store.loadScene();
  if(!snapshot||snapshot.scene.metadata?.version!==layout.id)return false;
  const ok=super.bootstrapFromStore();
  if(ok){const saved=this.state.seed;
   this.state.seed={...JSON.parse(JSON.stringify(this.originSeed)),fleet:this.originSeed.fleet.map(v=>({...v,...saved.fleet.find(s=>s.id===v.id)})),signals:saved.signals,devices:saved.devices};
  }return ok;
 }
 seedRuntimeDefaults(){super.seedRuntimeDefaults();this.initializeTraffic();}
 recomputeRuntimeFields(){super.recomputeRuntimeFields();this.initializeTraffic();}
 initializeTraffic(){
  for(const v of this.state.seed.fleet){v.s=v.progress*v.routeLength;v.velocity=0;v.effectiveSpeed=0;v.position=sample(v,v.s);v.heading=v.position.heading;v.generation=0;}
  this.state.meta.tickIntervalSeconds=.1;
 }
 buildCorridorStates(){return [];}
 buildRecommendations(){return [];}
 computeDerived(){
  const speeds=this.state.seed.fleet.map(v=>v.effectiveSpeed||0);
  const result=super.computeDerived();
  this.state.seed.fleet.forEach((v,i)=>v.effectiveSpeed=speeds[i]);
  for(const road of this.state.seed.roads){
   const vehicles=this.state.seed.fleet.filter(v=>v.roadId===road.id);
   const stopped=vehicles.filter(v=>(v.velocity||0)<.4&&v.s<v.stopS);
   const metric=result.roadMetrics[road.id];
   metric.vehicleCount=vehicles.length;
   metric.avgSpeed=vehicles.reduce((s,v)=>s+(v.effectiveSpeed||0),0)/(vehicles.length||1);
   metric.queueLength=stopped.length?Math.round(Math.max(...stopped.map(v=>v.stopS-v.s+v.length/2))):0;
   metric.load=clamp(stopped.length/(road.laneCount/2*8),0,1);
   metric.saturation=metric.load;
  }
  const metrics=Object.values(result.roadMetrics);
  result.metrics[0].value=Math.round(metrics.reduce((s,m)=>s+m.load,0)/metrics.length*100);
  result.metrics[0].label="进口排队占用";
  result.metrics[1].value=Math.round(speeds.reduce((s,v)=>s+v,0)/(speeds.length||1));
  result.corridors=[];
  return result;
 }
 tick(seconds){
  if(this.state.meta.playback!=="running")return;
  const steps=Math.max(1,Math.ceil(seconds/.05)),dt=seconds/steps;
  for(let n=0;n<steps;n++)this.stepTraffic(dt);
  this.state.meta.tick++;this.state.meta.clockMinutes+=seconds/60;
  this.state.meta.lastTickAt=Date.now();
  this.refresh("tick");
  if(this.store&&this.state.meta.tick%120===0)this.persistCheckpoint();
 }
 stepTraffic(dt){
  const seed=this.state.seed,signal=seed.signals[0];
  signal.elapsed+=dt;
  while(signal.elapsed>=signal.phases[signal.phaseIndex].duration){
   signal.elapsed-=signal.phases[signal.phaseIndex].duration;
   const next=(signal.phaseIndex+1)%signal.phases.length;
   // Keep all-red until vehicles already committed have cleared the conflict area.
   if(signal.phases[next].color==="green"&&seed.fleet.some(v=>v.s>v.stopS&&v.s<v.exitS+v.length/2)){signal.elapsed=signal.phases[signal.phaseIndex].duration-dt;break;}
   signal.phaseIndex=next;
  }
  const phase=signal.phases[signal.phaseIndex];signal.currentPhase=phase.code;signal.currentColor=phase.color;
  const proposals=[];
  for(const v of seed.fleet){
   let gap=Infinity,desired=v.turn!=="straight"&&v.s>v.stopS-12&&v.s<v.exitS?5.2:10;
   let leaderSpeed=desired;
   for(const other of seed.fleet){
    if(v===other)continue;
    let delta=Infinity;
    if(v.approach===other.approach&&v.lane===other.lane&&v.s<v.stopS+2&&other.s<other.exitS)delta=other.s-v.s;
    if(v.approach===other.approach&&v.lane===other.lane&&v.turn===other.turn)delta=other.s-v.s;
    if(v.s>=v.exitS&&other.s>=other.exitS&&v.exitKey===other.exitKey)delta=(other.s-other.exitS)-(v.s-v.exitS);
    if(delta>0){const g=delta-(v.length+other.length)/2-2;if(g<gap){gap=g;leaderSpeed=other.velocity;}}
   }
   const green=phase.code===v.approach+"_GREEN";
   if(!green&&v.s<=v.stopS-v.length/2){const g=v.stopS-v.length/2-v.s-.6;if(g<gap){gap=g;leaderSpeed=0;}}
   if(Number.isFinite(gap))desired=Math.min(desired,Math.sqrt(Math.max(0,2*2.6*gap)),Math.max(0,leaderSpeed+(gap-(2+v.velocity*1.15))*.45));
   let velocity=clamp(v.velocity+clamp(desired-v.velocity,-3.5*dt,1.8*dt),0,10);
   let advance=velocity*dt;if(Number.isFinite(gap))advance=Math.min(advance,Math.max(0,gap));
   proposals.push({v,velocity:advance/dt,s:v.s+advance});
  }
  for(const p of proposals){const v=p.v;v.s=p.s;v.velocity=p.velocity;
   if(v.s>v.routeLength+v.length){
    const clear=seed.fleet.every(o=>o===v||o.approach!==v.approach||o.lane!==v.lane||o.s>v.length+o.length+5);
    if(clear){v.s=0;v.velocity=0;v.generation++;}
   }
   v.progress=Math.min(v.s/v.routeLength,.99999);v.position=sample(v,Math.min(v.s,v.routeLength));v.heading=v.position.heading;
   v.effectiveSpeed=v.velocity*3.6;v.status=v.velocity<.2?"queued":"moving";
  }
 }
 buildEntities(){
  const entities=super.buildEntities();
  for(const e of entities){if(e.type!=="vehicle")continue;
   const v=this.state.seed.fleet.find(v=>v.id===e.id);if(!v)continue;
   e.motion={speed:v.velocity,heading:v.heading,turn:v.turn,turning:v.s>v.stopS-15&&v.s<v.exitS,braking:v.velocity<1,generation:v.generation};
   e.stats["速度"]=Math.round(v.effectiveSpeed)+" km/h";e.description=v.status==="queued"?"停止线前排队":"车道内行驶";
  }return entities;
 }
 getMapSnapshot(){
  const map=super.getMapSnapshot();map.layout=layout;
  const signal=this.state.seed.signals[0];map.signalState={phase:signal.currentPhase,remaining:Math.max(0,Math.ceil(signal.phases[signal.phaseIndex].duration-signal.elapsed)),approaches:{}};
  for(const a of ["W","E","N","S"])map.signalState.approaches[a]=signal.currentPhase===a+"_GREEN"?"green":signal.currentPhase===a+"_YELLOW"?"yellow":"red";
  return map;
 }
}
module.exports={DistrictEngine,sample};


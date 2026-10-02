const layout = require("../shared/district.json");
const dirs = { W:[1,0], E:[-1,0], N:[0,1], S:[0,-1] };
const names = {W:"西进口",E:"东进口",N:"北进口",S:"南进口"};
const add=(a,b,k=1)=>[a[0]+b[0]*k,a[1]+b[1]*k];
const mul=(a,k)=>[a[0]*k,a[1]*k];
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
function routeFor(approach,lane,turn){
 const d=dirs[approach], right=[-d[1],d[0]], offset=2.75+lane*3.5;
 const out=turn==="left"?[d[1],-d[0]]:turn==="right"?right:d;
 const or=[-out[1],out[0]], exitOffset=turn==="left"?2.75:6.25;
 const a=add(mul(d,-200),right,offset), b=add(mul(d,-30),right,offset);
 const c=add(mul(out,35),or,turn==="straight"?offset:exitOffset);
 const end=add(mul(out,200),or,turn==="straight"?offset:exitOffset);
 const p1=add(b,d,turn==="straight"?20:24),p2=add(c,out,-24);
 const points=[a,b];
 for(let i=1;i<=32;i++){const t=i/32,u=1-t;points.push([u*u*u*b[0]+3*u*u*t*p1[0]+3*u*t*t*p2[0]+t*t*t*c[0],u*u*u*b[1]+3*u*u*t*p1[1]+3*u*t*t*p2[1]+t*t*t*c[1]]);}
 points.push(end);
 let total=0;const distances=[0];
 for(let i=1;i<points.length;i++){total+=distance(points[i-1],points[i]);distances.push(total);}
 return {route:points,distances,routeLength:total,stopS:170,exitS:total-165,approach,lane,turn,exitKey:out.join(",")+":"+ (turn==="straight"?offset:exitOffset)};
}
const roads=Object.entries(dirs).map(([key,d])=>({id:"R-"+key,name:(d[0]?"清和路":"云杉街")+" · "+names[key],type:"roadSegment",functionalClass:d[0]?"primary":"secondary",laneCount:d[0]?6:4,speedLimit:40,capacity:d[0]?1800:1200,points:[mul(d,-200),[0,0]],tags:["虚构街区","车道级仿真"]}));
const phases=[];
for(const a of Object.keys(dirs)){
 phases.push({code:a+"_GREEN",color:"green",duration:18},{code:a+"_YELLOW",color:"yellow",duration:3},{code:a+"_CLEAR",color:"red",duration:6});
}
const fleet=[];
for(const [approach,d] of Object.entries(dirs)){
 const lanes=d[0]?3:2;
 for(let lane=0;lane<lanes;lane++) for(let i=0;i<6;i++){
 const turn=lane===0?"left":lane===2?"right":(!d[0]&&i%3===0?"right":"straight");
 const path=routeFor(approach,lane,turn);
 const idx=fleet.length,subType=idx%17===0?"bus":idx%13===0?"truck":idx%4===0?"suv":"car";
 const start=15+i*23;
 fleet.push({id:"V-D"+String(idx+1).padStart(3,"0"),name:({car:"轿车",suv:"SUV",bus:"公交车",truck:"厢式货车"})[subType]+" "+(idx+1),type:"vehicle",subType,priority:subType==="bus"?"transit":subType==="truck"?"freight":"general",roadId:"R-"+approach,speed:36,progress:start/path.routeLength,status:"moving",loop:true,length:subType==="bus"?11:subType==="truck"?7:4.6,...path});
 }
}
module.exports={
 scenarioName:layout.name+"城市街区",metadata:{region:"清和街区",version:layout.id,district:true,description:"虚构中国城市街区，车道级交通仿真"},roads,
 intersections:[{id:"I-CORE",name:"清和路与云杉街交叉口",type:"intersection",controlMode:"fixed-direction-phases",position:[0,0],connectedRoads:roads.map(r=>r.id),approachCount:4,saturationWarning:.8}],
 signals:[{id:"SC-CORE",name:"核心路口信号控制机",type:"signalController",intersectionId:"I-CORE",position:[-17,18],cycleLength:phases.reduce((s,p)=>s+p.duration,0),coordinationGroup:"清和路口",controllerVendor:"本地仿真",phases}],
 devices:Object.keys(dirs).map((a,i)=>({id:"CAM-"+a,name:names[a]+"监控",type:"camera",roadId:"R-"+a,position:[[32,16],[-32,-16],[12,-34],[-12,34]][i],status:"online",coverage:28,capability:"video-ai",latencyMs:25,healthScore:98,sampleRate:"25 fps"})),
 stops:[{id:"STOP-E",name:"清和里站",roadId:"R-W",position:[85,16],line:"101路",passengerLoad:0,dwellSeconds:0}],
 fleet,events:[],zones:[{id:"ZONE-CORE",name:"清和街区",position:[0,0],roads:roads.map(r=>r.id),demandIndex:40,parkingPressure:30,pedestrianFlow:0}]
};
module.exports.routeFor=routeFor;


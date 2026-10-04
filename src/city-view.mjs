import {buildingProfile} from './city-architecture.mjs';
export function segmentHitsBox(start,end,min,max){
 let enter=0,exit=1;
 for(let i=0;i<3;i++){const delta=end[i]-start[i];if(Math.abs(delta)<1e-9){if(start[i]<min[i]||start[i]>max[i])return false;continue;}let a=(min[i]-start[i])/delta,b=(max[i]-start[i])/delta;if(a>b)[a,b]=[b,a];enter=Math.max(enter,a);exit=Math.min(exit,b);if(enter>exit)return false;}
 return exit>0&&enter<1;
}
export function overviewView(config){
 const [x,y]=config.center,base=Math.atan2(78,64),targets=[[x,1,-y],...config.approaches.flatMap(a=>a.points.map(p=>[p[0],1,-p[1]]))];
 const boxes=config.buildings.map((b,i)=>{const height=buildingProfile(b,i,config.center).height;return {min:[b.bounds[0]-1,0,-b.bounds[3]-1],max:[b.bounds[2]+1,height+4,-b.bounds[1]+1]};});
 let best=null;
 for(const offset of [0,.35,-.35,.7,-.7,1.05,-1.05,Math.PI])for(const height of [85,100,115,135]){
  const p=[x+Math.cos(base+offset)*104,height,-y+Math.sin(base+offset)*104],blocked=targets.filter(t=>boxes.some(b=>segmentHitsBox(p,t,b.min,b.max))).length,score=blocked*10000+height+Math.abs(offset)*8;
  if(!best||score<best.score)best={p,t:[x,0,-y],score,blocked};
 }
 return best;
}

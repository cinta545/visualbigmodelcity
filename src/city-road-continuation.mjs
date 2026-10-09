function inRing(p,ring){
 let inside=false;
 for(let i=0,j=ring.length-1;i<ring.length;j=i++){
  const a=ring[i],b=ring[j];
  if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;
 }
 return inside;
}
export function continuationPoint(axis,station,fraction=0){
 const [a,b]=axis.points,L=Math.hypot(b[0]-a[0],b[1]-a[1]),d=[(b[0]-a[0])/L,(b[1]-a[1])/L],n=[-d[1],d[0]];
 const p=axis.alignment;
 let left=-axis.width/2,right=axis.width/2;
 if(p){let t=Math.max(0,Math.min(1,(station-p.start)/(p.end-p.start)));t=t*t*(3-2*t);left=p.left*(1-t)+left*t;right=p.right*(1-t)+right*t;}
 const offset=(left+right)/2+fraction*(right-left);
 return [a[0]+d[0]*station+n[0]*offset,a[1]+d[1]*station+n[1]*offset];
}
export function onSurveyRoad(config,p){
 const g=config.roadSurface||config.road,polygons=g.type==='Polygon'?[g.coordinates]:g.coordinates;
 return polygons.some(rings=>inRing(p,rings[0])&&!rings.slice(1).some(r=>inRing(p,r)));
}
export function continuationPaint(config){
 const result=[];
 for(const axis of config.extensionAxes||[]){
  const [a,b]=axis.points,L=Math.hypot(b[0]-a[0],b[1]-a[1]);
  for(const fraction of [-.25,-.12/axis.width,.12/axis.width,.25]){
   const yellow=Math.abs(fraction)<.1;
   for(let s=axis.alignment?.start||0;s<L;s+=.5){
    if(!yellow&&((s%8)+8)%8>=4)continue;
    const p=continuationPoint(axis,s,fraction),q=continuationPoint(axis,Math.min(s+.5,L),fraction);
    if(onSurveyRoad(config,p)||onSurveyRoad(config,q)||!onRoad(config,p)||!onRoad(config,q))continue;
    result.push({a:p,b:q,color:yellow?'yellow':'white',width:.12});
   }
  }
 }
 return result;
}
export function onRoad(config,p){
 return [config.roadSurface||config.road,config.extension].some(g=>{
  const polygons=g.type==='Polygon'?[g.coordinates]:g.coordinates;
  return polygons.some(rings=>inRing(p,rings[0])&&!rings.slice(1).some(r=>inRing(p,r)));
 });
}
// Presentation-only paint: one alignment and dash phase across the survey seam.
export function unifiedRoadMarkings(config){
 const paint=[];
 for(const axis of config.extensionAxes){
  const [a,b]=axis.points,L=Math.hypot(b[0]-a[0],b[1]-a[1]),d=[(b[0]-a[0])/L,(b[1]-a[1])/L],n=[-d[1],d[0]];
  const app=config.approaches.reduce((best,item)=>{
   const distance=Math.hypot(item.center[0]-a[0],item.center[1]-a[1]);
   return !best||distance<best.distance?{item,distance}:best;
  },null).item;
  // The inner stop-line endpoint borders opposing traffic.
  const start=app.points.reduce((best,p)=>Math.hypot(p[0]-config.center[0],p[1]-config.center[1])<Math.hypot(best[0]-config.center[0],best[1]-config.center[1])?p:best);
  const s0=(start[0]-a[0])*d[0]+(start[1]-a[1])*d[1],o0=(start[0]-a[0])*n[0]+(start[1]-a[1])*n[1],span=L-s0,blend=Math.min(span,-s0+30);
  const point=(t,offset)=>{
   const u=Math.min(1,t/blend),shift=o0*(1-u*u*(3-2*u))+offset;
   return [a[0]+d[0]*(s0+t)+n[0]*shift,a[1]+d[1]*(s0+t)+n[1]*shift];
  };
  for(const offset of [-3.5,-.17,.17,3.5]){
   const yellow=Math.abs(offset)<1,width=yellow?.15:.14;
   for(let t=0;t<span;t+=.25){
    // Solid 18 m near the stop line, then 4 m paint / 6 m gaps.
    if(!yellow&&t>=18&&(t-18)%10>=4)continue;
    const end=Math.min(t+.25,span),p=point(t,offset),q=point(end,offset);
    if(![t,(t+end)/2,end].every(v=>[-width/2,width/2].every(edge=>onRoad(config,point(v,offset+edge)))))continue;
    paint.push({a:p,b:q,width,color:yellow?'yellow':'white',approach:app.id,offset,station:t});
   }
  }
 }
 return paint;
}

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
export function onRoad(config,p){
 return [config.roadSurface||config.road,config.extension].some(g=>{
  const polygons=g.type==='Polygon'?[g.coordinates]:g.coordinates;
  return polygons.some(rings=>inRing(p,rings[0])&&!rings.slice(1).some(r=>inRing(p,r)));
 });
}
export function insideRoadSeam(config,p){
 const g=config.roadSeams;if(!g)return false;
 const polygons=g.type==='Polygon'?[g.coordinates]:g.coordinates;
 return polygons.some(rings=>inRing(p,rings[0])&&!rings.slice(1).some(r=>inRing(p,r)));
}
// Shared vertices for a whole solid stripe or dash, instead of thousands of
// short overlapping boxes with separately shaded ends.
export function markingRibbons(segments){
 const runs=[];let run;
 for(const s of segments){
  const same=run&&run.color===s.color&&run.approach===s.approach&&run.offset===s.offset&&Math.hypot(run.points.at(-1)[0]-s.a[0],run.points.at(-1)[1]-s.a[1])<1e-7;
  if(!same){run={color:s.color,approach:s.approach,offset:s.offset,width:s.width,points:[s.a]};runs.push(run);}
  run.points.push(s.b);
 }
 return runs.map(r=>{
  const positions=[],indices=[];
  r.points.forEach((p,i)=>{
   const a=r.points[Math.max(0,i-1)],b=r.points[Math.min(r.points.length-1,i+1)],l=Math.hypot(b[0]-a[0],b[1]-a[1]),nx=-(b[1]-a[1])/l*r.width/2,ny=(b[0]-a[0])/l*r.width/2;
   positions.push(p[0]+nx,.045,-p[1]-ny,p[0]-nx,.045,-p[1]+ny);
   if(i)indices.push((i-1)*2,(i-1)*2+1,i*2,i*2,(i-1)*2+1,i*2+1);
  });
  return {...r,positions,indices};
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
  const s0=(start[0]-a[0])*d[0]+(start[1]-a[1])*d[1],span=L-s0,profile=axis.alignment;
  const blend=Math.max(.25,Math.min(span,(profile?.start??30)-s0));
  let o0=(start[0]-a[0])*n[0]+(start[1]-a[1])*n[1];
  const pointAt=(t,offset,initial)=>{
   const station=s0+t;
   if(profile&&station>=profile.start){const p=continuationPoint(axis,station);return [p[0]+n[0]*offset,p[1]+n[1]*offset];}
   const u=Math.min(1,t/blend),endShift=profile?(profile.left+profile.right)/2:0;
   const shift=initial+(endShift-initial)*(u*u*(3-2*u))+offset;
   return [a[0]+d[0]*station+n[0]*shift,a[1]+d[1]*station+n[1]*shift];
  };
  // A surveyed stop-line tip can touch a narrow median. Keep both yellow
  // strokes on asphalt with the smallest lateral correction to display paint.
  const clearance=shift=>{
   let misses=0;
   for(let t=0;t<Math.min(24,span);t+=.25){
    for(const edge of [-.245,.245])if(!onRoad(config,pointAt(t,edge,shift)))misses++;
   }return misses;
  };
  const base=o0;let misses=clearance(base);
  if(misses)for(const delta of [-.25,.25,-.5,.5,-.75,.75,-1,1]){const count=clearance(base+delta);if(count<misses){o0=base+delta;misses=count;}if(!misses)break;}
  const point=(t,offset)=>pointAt(t,offset,o0);
  const offsets=axis.width>25?[-7,-3.5,-.17,.17,3.5,7]:[-3.5,-.17,.17,3.5];
  for(const offset of offsets){
   const yellow=Math.abs(offset)<1,width=yellow?.15:.14;
   for(let t=0;t<span;t+=.25){
    // Solid 18 m near the stop line, then 4 m paint / 6 m gaps.
    if(!yellow&&t>=18&&(t-18)%10>=4)continue;
    const end=Math.min(t+.25,span),p=point(t,offset),q=point(end,offset);
    if(![t,(t+end)/2,end].every(v=>[-width/2,0,width/2].every(edge=>onRoad(config,point(v,offset+edge)))))continue;
    paint.push({a:p,b:q,width,color:yellow?'yellow':'white',approach:app.id,offset,station:t});
   }
  }
 }
 return paint;
}

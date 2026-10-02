import {predict,baselineModels} from './sind-prediction.mjs';
import {upperBound} from './sind-clock.mjs';
export const gateProtocol={version:'causal-cost-tree-v1',target:'3s FDE',maxDepth:2,minLeafAnchors:200,quantiles:[.2,.4,.6,.8],minRelativeGain:.01,weighting:'equal recording, then equal track, then equal anchor',features:['speed','acceleration','longitudinalAcceleration','absoluteTurnRate','turnFallback'],validation:'leave one entire recording out; fixed hyperparameters; exploratory data'};
export function gateFeatures(track,time){
 const ca=predict(track,time,'ca'),ctrv=predict(track,time,'ctrv');if(!ca.points||!ctrv.points)return null;
 const r=track.samples[upperBound(track.samples,time)-1],speed=Math.hypot(r[3],r[4]),[ax,ay]=ca.acceleration;
 return [speed,Math.hypot(ax,ay),speed>.00001?(ax*r[3]+ay*r[4])/speed:0,Math.abs(ctrv.turnRateRadS),Number(ctrv.turnFallback)];
}
export function applyGate(tree,features){return tree.feature===undefined?tree.model:applyGate(features[tree.feature]<=tree.threshold?tree.left:tree.right,features);}
export function trainGate(rows,protocol=gateProtocol){
 if(!rows.length)throw Error('No training anchors');
 const groups=new Map();for(const r of rows){if(!groups.has(r.recording))groups.set(r.recording,new Map());const tracks=groups.get(r.recording);tracks.set(r.trackId,(tracks.get(r.trackId)||0)+1);}
 const weighted=rows.map(r=>({...r,weight:1/(groups.size*groups.get(r.recording).size*groups.get(r.recording).get(r.trackId))}));
 function leaf(xs){const costs=baselineModels.map((_,i)=>xs.reduce((s,r)=>s+r.weight*r.errors[i],0)),cost=Math.min(...costs);return {model:baselineModels[costs.indexOf(cost)],cost,n:xs.length};}
 function grow(xs,depth){
  const result=leaf(xs);if(depth>=protocol.maxDepth||xs.length<2*protocol.minLeafAnchors)return result;
  let best;
  for(let feature=0;feature<gateProtocol.features.length;feature++){
   const sorted=xs.map(r=>r.features[feature]).sort((a,b)=>a-b);
   for(const threshold of new Set(protocol.quantiles.map(q=>sorted[Math.floor((sorted.length-1)*q)]))){
    const left=[],right=[];for(const r of xs)(r.features[feature]<=threshold?left:right).push(r);
    if(Math.min(left.length,right.length)<protocol.minLeafAnchors)continue;
    const cost=leaf(left).cost+leaf(right).cost;
    if(cost<result.cost*(1-protocol.minRelativeGain)&&(!best||cost<best.cost))best={feature,threshold,cost,left,right};
   }
  }
  if(!best)return result;
  return {feature:best.feature,featureName:gateProtocol.features[best.feature],threshold:best.threshold,n:xs.length,left:grow(best.left,depth+1),right:grow(best.right,depth+1)};
 }
 return grow(weighted,0);
}

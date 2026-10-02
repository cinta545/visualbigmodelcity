import fs from 'node:fs';
import {predict,evaluate,motorTypes} from '../src/sind-prediction.mjs';
const data=JSON.parse(fs.readFileSync('data/sind/replay.json','utf8'));
const totals={cv:[[],[],[]],ca:[[],[],[]]};let anchors=0;
for(const track of data.tracks.filter(t=>motorTypes.includes(t.type))){
 let last=-Infinity;
 for(const row of track.samples){
  if(row[0]-last<1000)continue;last=row[0];anchors++;
  const forecasts=['cv','ca'].map(model=>predict(track,row[0],model));
  if(forecasts.some(f=>!f.points))continue;
  const scores=forecasts.map(f=>evaluate(track,f));
  for(let i=0;i<3;i++)if(scores.every(s=>s[i].errorM!==null))for(let m=0;m<2;m++)totals[['cv','ca'][m]][i].push(scores[m][i].errorM);
 }
}
const report={recording:'Tianjin/8_2_1',protocol:'Descriptive public-sample baseline, not held-out generalization. Observation anchors at least 1000 ms apart per track. Both models use identical eligible anchors per horizon; CA requires continuous history >=500 ms. Endpoint Euclidean error in meters, not ADE. No training or future input.',motorTypes,anchorsConsidered:anchors,results:Object.fromEntries(Object.entries(totals).map(([model,horizons])=>[model,horizons.map((errors,i)=>{errors.sort((a,b)=>a-b);return {seconds:i+1,n:errors.length,meanEndpointErrorM:errors.length?errors.reduce((a,b)=>a+b,0)/errors.length:null,p95EndpointErrorM:errors.length?errors[Math.ceil(errors.length*.95)-1]:null};})]))};
fs.writeFileSync('data/sind/baseline-evaluation.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));

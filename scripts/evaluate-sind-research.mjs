import {sampleTrack} from '../src/sind-clock.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {predict,motorTypes,baselineModels,baselineProtocol} from '../src/sind-prediction.mjs';
import {validateRecords,auditRecording,trajectoryErrors,summarizeErrors} from '../src/sind-research.mjs';
const configPath=process.argv[2]||'shared/research-datasets.json',config=JSON.parse(fs.readFileSync(configPath));
const ready=validateRecords(config.records),p=config.protocol;
if(p.anchorStrideMs!==1000||p.futureStepMs!==100||JSON.stringify(p.horizonsS)!=='[1,2,3]'||p.maxGapMs!==250||p.movingThresholdMps!==.5)throw Error('Unsupported protocol: change implementation and version before changing evaluation settings');
const hash=b=>createHash('sha256').update(b).digest('hex'),sources=[],details=[],hashSplits=new Map();
for(const record of config.records){
 const bytes=fs.readFileSync(path.resolve(record.path)),sha=hash(bytes),data=JSON.parse(bytes);
 if(hashSplits.has(sha))throw Error('Duplicate content across recording entries');hashSplits.set(sha,record.split);
 const audit=auditRecording(data,record.id);if(audit.errors.length)throw Error(JSON.stringify({record:record.id,audit}));
 const eligibility={ctrvFallbackAnchors:0,anchors:0,missingHistory:0,missingTruth:{1:0,2:0,3:0},eligible:{1:0,2:0,3:0}};
 for(const track of data.tracks.filter(t=>motorTypes.includes(t.type))){
  let last=-Infinity;
  for(const row of track.samples){
   if(row[0]-last<p.anchorStrideMs)continue;last=row[0];eligibility.anchors++;
   const forecasts=baselineModels.map(model=>predict(track,row[0],model));if(forecasts.some(f=>!f.points)){eligibility.missingHistory++;continue;}
   if(forecasts.find(f=>f.model==='ctrv').turnFallback)eligibility.ctrvFallbackAnchors++;
   for(const horizonS of p.horizonsS){
    const scores=forecasts.map(f=>trajectoryErrors(track,f,horizonS));
    if(scores.some(s=>!s)){eligibility.missingTruth[horizonS]++;continue;}eligibility.eligible[horizonS]++;
    const end=sampleTrack(track,row[0]+horizonS*1000),v0=Math.hypot(row[3],row[4]),v1=Math.hypot(end[3],end[4]);
    const angleDeg=Math.abs(Math.atan2(row[3]*end[4]-row[4]*end[3],row[3]*end[3]+row[4]*end[4]))*180/Math.PI;
    const futureMotion=v0<.5||v1<.5?'low_speed_endpoint':angleDeg>=15?'direction_change_15deg':'direction_change_under15deg';
    for(let i=0;i<forecasts.length;i++)details.push({recording:record.id,split:record.split,trackId:track.id,type:track.type,motion:Math.hypot(row[3],row[4])<.5?'low_speed':'moving',anchorMs:row[0],horizonS,futureMotion,model:forecasts[i].model,...scores[i]});
   }
  }
 }
 sources.push({...record,sha256:sha,audit,eligibility});
}
function buildGroups(subset){
 const groups=[];
 for(const split of [...new Set(subset.map(r=>r.split))])for(const model of baselineModels)for(const horizonS of p.horizonsS){
  const rows=subset.filter(r=>r.split===split&&r.model===model&&r.horizonS===horizonS);
  for(const [dimension,values]of [['all',['all']],['motion',['low_speed','moving']],['type',motorTypes],['futureMotion',['low_speed_endpoint','direction_change_15deg','direction_change_under15deg']]])for(const value of values)groups.push({split,model,horizonS,dimension,value,...summarizeErrors(rows.filter(r=>dimension==='all'||r[dimension]===value))});
 }
 return groups;
}
const groups=buildGroups(details),byRecording=Object.fromEntries(sources.map(s=>[s.id,buildGroups(details.filter(r=>r.recording===s.id))]));
const pairedTrackComparison=sources.map(s=>{
 const rows=details.filter(r=>r.recording===s.id&&r.horizonS===3&&['cv','ca'].includes(r.model)),tracks=new Map();
 for(const r of rows){if(!tracks.has(r.trackId))tracks.set(r.trackId,{cv:[],ca:[]});tracks.get(r.trackId)[r.model].push(r.fdeM);}
 const mean=xs=>xs.reduce((n,x)=>n+x,0)/xs.length;
 const deltas=[...tracks.values()].map(t=>mean(t.ca)-mean(t.cv));
 return {recording:s.id,tracks:deltas.length,caBetterTracks:deltas.filter(d=>d<-1e-9).length,cvBetterTracks:deltas.filter(d=>d>1e-9).length,tiedTracks:deltas.filter(d=>Math.abs(d)<=1e-9).length,meanCaMinusCvFdeM:mean(deltas)};
});
const worstCases=[...details].filter(r=>r.horizonS===3).sort((a,b)=>b.fdeM-a.fdeM).slice(0,100);
const codeFiles=['src/sind-prediction.mjs','src/sind-clock.mjs','src/sind-research.mjs','scripts/evaluate-sind-research.mjs'];
const report={version:config.version,protocol:p,models:baselineModels,baselineProtocol,independentSplitConfigured:ready,status:ready?'split-configured-not-trained':'development-only-no-independent-test',sources,codeHashes:Object.fromEntries(codeFiles.map(file=>[file,hash(fs.readFileSync(file))])),groups,byRecording,pairedTrackComparison,worstCases,limitations:['No trained interaction model or held-out performance claim.','Groups are manually assigned: overlapping acquisition sessions must share a group.','ADE excludes anchor and averages future 100 ms points; FDE is endpoint distance.','Motion stratification uses anchor speed only; low_speed is not a stationary-event label.','Risk reviews are not accident ground truth.','futureMotion uses future endpoint velocity for retrospective diagnosis only, never model input. Net direction change is not a map-confirmed turning maneuver.','Each city has one public sample recording: city and recording effects cannot be separated.']};
fs.writeFileSync('data/sind/research-evaluation.json',JSON.stringify(report,null,2));
const columns=['recording','split','trackId','type','motion','anchorMs','horizonS','model','futureMotion','adeM','fdeM'];
const csvCell=v=>'"'+String(v).replaceAll('"','""')+'"';
fs.writeFileSync('data/sind/research-errors.csv','\uFEFF'+[columns,...details.map(r=>columns.map(c=>r[c]))].map(row=>row.map(csvCell).join(',')).join('\r\n'));
console.log(JSON.stringify({status:report.status,records:sources.length,detailRows:details.length,results:groups.filter(g=>g.dimension==='all')}));

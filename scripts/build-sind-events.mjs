import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {assessRisks,riskConfig} from '../src/sind-risk.mjs';
import {groupCandidates,eventConfig} from '../src/sind-events.mjs';
const source=fs.readFileSync('data/sind/replay.json'),data=JSON.parse(source);
function* frames(){for(let t=0;t<=data.meta.durationMs;t+=eventConfig.stepMs)yield {timeMs:t,candidates:assessRisks(data.tracks,t)};}
const snapshots=[...frames()],events=groupCandidates(snapshots),manifest={sourceSha256:createHash('sha256').update(source).digest('hex'),config:eventConfig,riskConfig,durationMs:data.meta.durationMs,events};
fs.writeFileSync('data/sind/risk-events.json',JSON.stringify(manifest,null,2));
const rows=[];
for(const horizonS of [1,1.5,2,3])for(const mergeGapMs of [100,300,500]){
 const subset=snapshots.map(f=>({...f,candidates:f.candidates.filter(c=>c.ttcS<=horizonS)}));
 const grouped=groupCandidates(subset,{...eventConfig,mergeGapMs});
 rows.push({horizonS,mergeGapMs,events:grouped.length,candidateSamples:grouped.reduce((n,e)=>n+e.sampleCount,0)});
}
fs.writeFileSync('data/sind/risk-sensitivity.json',JSON.stringify({sourceSha256:manifest.sourceSha256,config:eventConfig,riskConfig,rows},null,2));
console.log(JSON.stringify({events:events.length,candidateSamples:events.reduce((n,e)=>n+e.sampleCount,0),stepMs:eventConfig.stepMs,mergeGapMs:eventConfig.mergeGapMs}));

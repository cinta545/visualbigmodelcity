import fs from 'node:fs';
import {assessRisks,riskConfig} from '../src/sind-risk.mjs';
const data=JSON.parse(fs.readFileSync('data/sind/replay.json','utf8')),counts={},examples={};let frames=0;
for(let time=0;time<=data.meta.durationMs;time+=1000){
 frames++;for(const event of assessRisks(data.tracks,time)){counts[event.kind]=(counts[event.kind]||0)+1;if(!examples[event.kind]&&event.ttcS>0)examples[event.kind]={timeMs:time,key:event.key,ttcS:event.ttcS};}
}
const report={protocol:'One-second snapshots of causal CV fixed-heading envelope candidates. Counts are pair-snapshots, not unique conflicts, accidents, labels or predictive accuracy.',config:riskConfig,frames,counts,examples};
fs.writeFileSync('data/sind/risk-audit.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));

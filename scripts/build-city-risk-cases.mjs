import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {assessRisks,riskConfig} from '../src/sind-risk.mjs';
import {continuousWindow} from '../src/city-risk-cases.mjs';
const catalog=JSON.parse(fs.readFileSync('data/sind/cities/catalog.json')),output={version:1,stepMs:500,mergeGapMs:1000,selection:'first eligible anchor per pair and kind episode; 3s past and 5s observed future',riskConfig,cities:{}};
for(const city of catalog){
 const source=fs.readFileSync('.'+city.tracks),data=JSON.parse(source),tracks=data.tracks,byId=new Map(tracks.map(t=>[t.id,t])),cases=[],last=new Map();
 for(let time=3000;time<city.durationMs-5000;time+=500){
  const active=tracks.filter(t=>samplePresent(t,time));
  for(const event of assessRisks(active,time)){
   if(!['cross','rear'].includes(event.kind)||event.ttcS<.1)continue;
   const key=event.key+'/'+event.kind;let episode=last.get(key);if(!episode||time-episode.endMs>1000){episode={endMs:time,captured:false};last.set(key,episode);}episode.endMs=time;if(episode.captured)continue;
   const pair=[byId.get(event.a.id),byId.get(event.b.id)],focus=pair.find(t=>['car','bus','truck','motorcycle','tricycle'].includes(t.type)&&continuousWindow(t,time-3100,time+5000));
   if(!focus||!pair.every(t=>continuousWindow(t,time,time+5000)))continue;
   const anchorMs=focus.samples.filter(p=>p[0]<=time).at(-1)[0];
   const anchored=assessRisks(active,anchorMs).find(e=>e.key===event.key&&e.kind===event.kind);if(!anchored)continue;
   cases.push({id:key+'@'+anchorMs,kind:event.kind,anchorMs,trackIds:pair.map(t=>t.id),focusId:focus.id,ttcS:anchored.ttcS});episode.captured=true;
  }
 }
 output.cities[city.id]={sourceSha256:createHash('sha256').update(source).digest('hex'),durationMs:city.durationMs,cases};console.log(city.id,cases.length);
}
function samplePresent(t,time){return t.samples[0][0]<=time&&t.samples.at(-1)[0]>=time;}
fs.writeFileSync('data/sind/cities/risk-cases.json',JSON.stringify(output));

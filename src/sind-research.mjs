import {sampleTrack,upperBound} from './sind-clock.mjs';
export function validateRecords(records){
 const ids=new Set(),groups=new Map(),paths=new Set();
 if(!records.length)throw Error('No recordings configured');
 for(const r of records){
  if(!r.id||!r.group||!r.path||!['development','train','validation','test'].includes(r.split))throw Error('Invalid recording configuration');
  if(ids.has(r.id)||paths.has(r.path))throw Error('Duplicate recording or path');ids.add(r.id);paths.add(r.path);
  if(groups.has(r.group)&&groups.get(r.group)!==r.split)throw Error('Recording group crosses data splits');groups.set(r.group,r.split);
 }
 return ['train','validation','test'].every(split=>records.some(r=>r.split===split));
}
export function auditRecording(data,recordingId){
 const errors=[],ids=new Set();let rows=0,gaps=0;
 for(const t of data.tracks||[]){
  if(ids.has(t.id))errors.push(`Duplicate ID: ${t.id}`);ids.add(t.id);
  if(!t.id?.startsWith(recordingId+'/'))errors.push(`ID outside recording: ${t.id}`);
  if(!t.samples?.length){errors.push(`Empty track: ${t.id}`);continue;}
  if(t.type!=='pedestrian'&&!(t.length>0&&t.width>0))errors.push(`Invalid dimensions: ${t.id}`);
  for(let i=0;i<t.samples.length;i++){
   const r=t.samples[i];rows++;if(r.length!==6||!r.every(Number.isFinite))errors.push(`Invalid row: ${t.id}/${i}`);
   if(i){const gap=r[0]-t.samples[i-1][0];if(gap<=0)errors.push(`Non-increasing time: ${t.id}/${i}`);if(gap>250)gaps++;}
  }
 }
 if(!rows)errors.push('No observations');
 return {tracks:ids.size,rows,gapsOver250Ms:gaps,errors};
}
export function trajectoryErrors(track,forecast,horizonS){
 const end=forecast.anchorMs+horizonS*1000,rows=track.samples,start=upperBound(rows,forecast.anchorMs)-1;
 if(start<0||end>rows.at(-1)[0])return null;
 for(let i=start+1;i<rows.length&&rows[i-1][0]<end;i++)if(rows[i][0]-rows[i-1][0]>250)return null;
 const errors=[];
 for(const p of forecast.points.slice(1,horizonS*10+1)){const truth=sampleTrack(track,p[0]);if(!truth)return null;errors.push(Math.hypot(p[1]-truth[1],p[2]-truth[2]));}
 if(errors.length!==horizonS*10)return null;
 return {adeM:errors.reduce((a,b)=>a+b,0)/errors.length,fdeM:errors.at(-1)};
}
export function summarizeErrors(rows){
 if(!rows.length)return {n:0,tracks:0,adeM:null,fdeM:null,p95FdeM:null,trackMacroAdeM:null,trackMacroFdeM:null};
 const tracks=new Map();for(const r of rows){const key=r.recording+'/'+r.trackId;if(!tracks.has(key))tracks.set(key,[]);tracks.get(key).push(r);}
 const avg=(xs,k)=>xs.reduce((n,r)=>n+r[k],0)/xs.length,sorted=rows.map(r=>r.fdeM).sort((a,b)=>a-b);
 const means=[...tracks.values()].map(xs=>({adeM:avg(xs,'adeM'),fdeM:avg(xs,'fdeM')}));
 return {n:rows.length,tracks:tracks.size,adeM:avg(rows,'adeM'),fdeM:avg(rows,'fdeM'),p95FdeM:sorted[Math.ceil(sorted.length*.95)-1],trackMacroAdeM:avg(means,'adeM'),trackMacroFdeM:avg(means,'fdeM')};
}

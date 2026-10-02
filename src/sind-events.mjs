export const eventConfig={stepMs:100,mergeGapMs:300,version:'cv-obb-events-v1'};
export function groupCandidates(frames,config=eventConfig){
 const active=new Map(),events=[];
 for(const {timeMs,candidates} of frames){
  for(const c of candidates){
   let e=active.get(c.key);
   if(!e||timeMs-e.endMs>config.mergeGapMs){
    e={id:`${c.key}@${timeMs}`,pairKey:c.key,trackIds:c.key.split('|'),startMs:timeMs,endMs:timeMs,minTimeMs:timeMs,minTtcS:c.ttcS,sampleCount:0,kinds:[]};active.set(c.key,e);events.push(e);
   }
   e.endMs=timeMs;e.sampleCount++;if(!e.kinds.includes(c.kind))e.kinds.push(c.kind);
   if(c.ttcS<e.minTtcS){e.minTtcS=c.ttcS;e.minTimeMs=timeMs;}
  }
 }
 return events;
}
export const reviewLabels={pending:'待复核',plausible:'保留候选',dismissed:'排除候选',uncertain:'无法判断'};
const cell=value=>{let s=String(value??'');if(/^[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};
export function eventsCsv(manifest,reviews){
 const header=['source_sha256','method_version','step_ms','merge_gap_ms','event_id','track_a','track_b','start_ms','end_ms','min_ttc_time_ms','min_ttc_s','candidate_samples','kinds','review_status','review_note'];
 return '\uFEFF'+[header,...manifest.events.map(e=>[manifest.sourceSha256,manifest.config.version,manifest.config.stepMs,manifest.config.mergeGapMs,e.id,...e.trackIds,e.startMs,e.endMs,e.minTimeMs,e.minTtcS,e.sampleCount,e.kinds.join('|'),reviews[e.id]?.status||'pending',reviews[e.id]?.note||''])].map(row=>row.map(cell).join(',')).join('\r\n');
}

import {createEventReview} from './sind-event-review.mjs';
import {upperBound} from './sind-clock.mjs';
import {motorTypes} from './sind-prediction.mjs';
export const riskConfig={horizonS:3,urgentS:1.5,maxAgeMs:250,parallelDeg:30,pedestrianSizeM:.6};
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1];
export function riskState(track,time){
 const r=track.samples[upperBound(track.samples,time)-1];
 if(!r||time-r[0]>riskConfig.maxAgeMs)return null;
 const pedestrian=track.type==='pedestrian',length=pedestrian ? riskConfig.pedestrianSizeM : track.length,width=pedestrian ? riskConfig.pedestrianSizeM : track.width;
 if(!(length>0&&width>0))return null;
 const yaw=pedestrian?Math.atan2(r[4],r[3]):r[5],age=(time-r[0])/1000;
 return {id:track.id,type:track.type,anchorMs:r[0],p:[r[1]+r[3]*age,r[2]+r[4]*age],v:[r[3],r[4]],u:[Math.cos(yaw),Math.sin(yaw)],w:[-Math.sin(yaw),Math.cos(yaw)],length,width,assumedSize:pedestrian};
}
const radius=(a,axis)=>Math.abs(dot(a.u,axis))*a.length/2+Math.abs(dot(a.w,axis))*a.width/2;
// Continuous separating-axis sweep of fixed-heading rectangles under constant velocity.
// Returns first envelope contact in [0, horizon]; no time-step collision approximation.
export function contactTime(a,b,horizon=3){
 const d=b.p.map((v,i)=>v-a.p[i]),v=b.v.map((x,i)=>x-a.v[i]);let enter=0,exit=horizon;
 for(const axis of [a.u,a.w,b.u,b.w]){
  const p=dot(d,axis),speed=dot(v,axis),r=radius(a,axis)+radius(b,axis);
  if(Math.abs(speed)<1e-9){if(Math.abs(p)>r)return null;continue;}
  let t1=(-r-p)/speed,t2=(r-p)/speed;if(t1>t2)[t1,t2]=[t2,t1];
  enter=Math.max(enter,t1);exit=Math.min(exit,t2);if(enter>exit)return null;
 }
 return enter;
}
export function assessRisks(tracks,time){
 const states=tracks.map(t=>riskState(t,time)).filter(Boolean),events=[];
 for(let i=0;i<states.length;i++)for(let j=i+1;j<states.length;j++){
  const a=states[i],b=states[j];if(!motorTypes.includes(a.type)&&!motorTypes.includes(b.type))continue;
  const ttc=contactTime(a,b,riskConfig.horizonS);if(ttc===null)continue;
  const angle=Math.acos(Math.max(-1,Math.min(1,dot(a.u,b.u))))*180/Math.PI;
  let kind='other',gapM=null,closingMps=null;
  if(ttc===0)kind='overlap';
  else if(!motorTypes.includes(a.type)||!motorTypes.includes(b.type))kind='vulnerable';
  else if(angle<=riskConfig.parallelDeg){
   const d=b.p.map((v,k)=>v-a.p[k]),follower=dot(d,a.u)>=0?a:b,leader=follower===a?b:a;
   const delta=leader.p.map((v,k)=>v-follower.p[k]);
   gapM=dot(delta,follower.u)-radius(follower,follower.u)-radius(leader,follower.u);
   closingMps=dot(follower.v.map((v,k)=>v-leader.v[k]),follower.u);
   const lateral=Math.abs(dot(delta,follower.w));
   if(gapM>0&&closingMps>0&&lateral<radius(follower,follower.w)+radius(leader,follower.w))kind='rear';
  }else if(angle<150)kind='cross';
  const centers=[a,b].map(s=>s.p.map((p,k)=>p+s.v[k]*ttc));
  events.push({key:[a.id,b.id].sort().join('|'),timeMs:time,kind,ttcS:ttc,angleDeg:angle,gapM,closingMps,priority:ttc===0?'核查':ttc<=riskConfig.urgentS?'优先关注':'关注',a,b,centers});
 }
 return events.sort((a,b)=>a.ttcS-b.ttcS||a.key.localeCompare(b.key));
}
export const riskNames={rear:'追尾候选',cross:'交叉冲突候选',vulnerable:'行人 / 非机动车交互',overlap:'当前包络重叠',other:'其他方向接近'};
export function riskCsv(events){
 const header='time_ms,track_a,track_b,type_a,type_b,kind,ttc_s,angle_deg,longitudinal_gap_m,closing_mps,anchor_a_ms,anchor_b_ms,assumed_pedestrian_size,horizon_s,model';
 return '\uFEFF'+header+'\r\n'+events.map(e=>[e.timeMs,e.a.id,e.b.id,e.a.type,e.b.type,e.kind,e.ttcS,e.angleDeg,e.gapM??'',e.closingMps??'',e.a.anchorMs,e.b.anchorMs,e.a.assumedSize||e.b.assumedSize,3,'CV_fixed_heading_OBB'].join(',')).join('\r\n');
}
export function createRiskUI(tracks,handlers){
 const $=id=>document.getElementById(id);let events=[],selected=null;
 createEventReview(handlers,key=>{selected=key;handlers.focusRisk(events.find(e=>e.key===key));render();});
 $('risk-list').onclick=e=>{const button=e.target.closest('[data-risk]');if(!button)return;selected=button.dataset.risk;const event=events.find(e=>e.key===selected);handlers.focusRisk(event);render();};
 $('show-risks').onchange=()=>render();
 $('export-risks').onclick=()=>{const url=URL.createObjectURL(new Blob([riskCsv(events)],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=`SinD-risk-${events[0]?.timeMs??0}ms.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 function render(){
  $('risk-list').replaceChildren(...events.map(e=>{const b=document.createElement('button');b.dataset.risk=e.key;b.className=selected===e.key?'selected':'';b.textContent=`${e.priority} · ${riskNames[e.kind]}\n${e.a.id.split('/').at(-1)} ↔ ${e.b.id.split('/').at(-1)} · TTC ${e.ttcS.toFixed(2)} s`;return b;}));
  const event=events.find(e=>e.key===selected);handlers.risk($('show-risks').checked?event:null);
  $('risk-detail').textContent=event?`${event.a.id} ↔ ${event.b.id}\n${riskNames[event.kind]} · 航向夹角 ${event.angleDeg.toFixed(1)}°\n恒速包络首次接触 TTC ${event.ttcS.toFixed(2)} s${event.gapM===null?'':`\n纵向净距 ${event.gapM.toFixed(2)} m · 接近速度 ${event.closingMps.toFixed(2)} m/s`}\n${event.a.assumedSize||event.b.assumedSize?'含行人：使用 0.6 × 0.6 m 假设包络。':''}\n橙框标出双方，橙线为恒速外推，圆环为接触时双方中心。`:selected?'所选候选在当前时刻已不满足条件。':'点击候选定位双方；橙线显示双方恒速外推，圆环标记预计接触时的中心位置。';
 }
 return {update(time){events=assessRisks(tracks,time);$('risk-summary').textContent=`${(time/1000).toFixed(1)} s · ${events.length} 对当前候选（非累计事件数）${events.length?'':'；不表示无风险'}`;$('export-risks').disabled=!events.length;render();}};
}

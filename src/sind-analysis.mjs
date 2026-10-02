import {loadResearchReport} from './sind-research-ui.mjs';
import {createRiskUI} from './sind-risk.mjs';
import {createPredictionUI} from './sind-prediction.mjs';
import {sampleTrack,upperBound} from './sind-clock.mjs';
export const labels={car:'轿车',bus:'公交车',truck:'货车',motorcycle:'摩托车',bicycle:'自行车',tricycle:'三轮车',pedestrian:'行人'};
export function summarize(tracks,time){
 const counts=Object.fromEntries(Object.keys(labels).map(k=>[k,0]));let active=0,seen=0,speedSum=0,autoCount=0,slowAutos=0;
 for(const track of tracks){
  if(track.samples[0][0]<=time)seen++;
  const s=sampleTrack(track,time);if(!s)continue;active++;counts[track.type]=(counts[track.type]||0)+1;
  if(['car','bus','truck'].includes(track.type)){const v=Math.hypot(s[3],s[4]);autoCount++;speedSum+=v;if(v<.5)slowAutos++;}
 }
 return {active,seen,counts,autoCount,slowAutos,meanAutoKmh:autoCount?speedSum/autoCount*3.6:null};
}
export function historySegments(track,time,windowMs=10000){
 if(!track)return [];
 const rows=track.samples,segments=[];let current=[];
 for(let i=upperBound(rows,time-windowMs);i<rows.length&&rows[i][0]<=time;i++){
  if(current.length&&rows[i][0]-current.at(-1)[0]>250){segments.push(current);current=[];}
  current.push(rows[i]);
 }
 if(current.length)segments.push(current);
 return segments;
}
export function matchingTracks(tracks,{query='',type='all',scope='current',time=0}={}){
 query=query.trim().toLowerCase();
 return tracks.filter(t=>(type==='all'||t.type===type)&&(!query||t.id.toLowerCase().includes(query)||(labels[t.type]||t.type).includes(query))&&(scope==='all'||sampleTrack(t,time)));
}
export function observationCsv(track,time){
 const rows=historySegments(track,time).flat();
 return '\uFEFFrecording,track_id,type,timestamp_ms,x_m,y_m,vx_mps,vy_mps,yaw_rad\r\n'+rows.map(r=>[track.id.slice(0,track.id.lastIndexOf('/')),track.id.split('/').at(-1),track.type,...r].join(',')).join('\r\n');
}

export function createAnalysis(data,handlers){
 const $=id=>document.getElementById(id),byId=new Map(data.tracks.map(t=>[t.id,t]));let selected=null,lastTime=0,lastKey='',lastListKey='';
 loadResearchReport();
 const prediction=createPredictionUI(handlers.forecast);
 const risks=createRiskUI(data.tracks,handlers);
 function tab(name){document.querySelectorAll('[data-analysis-tab]').forEach(b=>{b.classList.toggle('active',b.dataset.analysisTab===name);b.setAttribute('aria-selected',String(b.dataset.analysisTab===name));});document.querySelectorAll('[data-analysis-panel]').forEach(el=>el.hidden=el.dataset.analysisPanel!==name);}
 document.querySelectorAll('[data-analysis-tab]').forEach(b=>b.onclick=()=>tab(b.dataset.analysisTab));
 for(const id of ['object-search','object-type','object-scope'])$(id).addEventListener('input',()=>{lastListKey='';update(lastTime,true);});
 $('object-list').onclick=e=>{const button=e.target.closest('[data-track]');if(button)handlers.select(button.dataset.track);};
 $('jump-observation').onclick=()=>{const t=byId.get(selected);if(t)handlers.seek(t.samples[0][0]);};
 $('focus-object').onclick=()=>handlers.focus(selected);
 $('show-history').onchange=()=>handlers.history($('show-history').checked);
 $('export-observation').onclick=()=>{
  const track=byId.get(selected);if(!track)return;
  const url=URL.createObjectURL(new Blob([observationCsv(track,lastTime)],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');
  a.href=url;a.download=`SinD-${track.id.split('/').at(-1)}-${Math.floor(lastTime)}ms-history.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 };
 function update(time,force=false){
  lastTime=time;const key=Math.floor(time/200)+':'+selected;
  if(!force&&key===lastKey)return;lastKey=key;
  const m=summarize(data.tracks,time);$('metric-active').textContent=m.active;$('metric-seen').textContent=m.seen;
  $('metric-speed').textContent=m.meanAutoKmh===null?'—':m.meanAutoKmh.toFixed(1);$('metric-slow').textContent=m.slowAutos;
  $('class-counts').textContent=Object.entries(labels).map(([k,label])=>`${label} ${m.counts[k]}`).join(' · ');
  $('analysis-time').textContent=`统计时刻 ${(time/1000).toFixed(1)} s`;
  const filtered=matchingTracks(data.tracks,{query:$('object-search').value,type:$('object-type').value,scope:$('object-scope').value,time});
  const listKey=filtered.map(t=>t.id).join('|')+selected;
  if(listKey!==lastListKey){
   lastListKey=listKey;$('object-list').replaceChildren(...filtered.slice(0,80).map(t=>{const button=document.createElement('button');button.type='button';button.dataset.track=t.id;button.className=t.id===selected?'selected':'';button.textContent=`${t.id.split('/').at(-1)} · ${labels[t.type]}`;return button;}));
   $('object-result').textContent=`${filtered.length} 个结果${filtered.length>80?'，显示前 80 个，请输入 ID 缩小范围':''}`;
  }
  const track=byId.get(selected),sample=track&&sampleTrack(track,time);
  prediction.update(track,time);risks.update(time);
  for(const id of ['jump-observation','export-observation'])$(id).disabled=!track;
  $('focus-object').disabled=!sample;
  if(track){
   $('inspection').textContent=`${track.id} · ${track.type}\n${labels[track.type]} · ${sample?'当前可见':'当前时刻不在观测范围'}\n观测区间 ${(track.samples[0][0]/1000).toFixed(2)}–${(track.samples.at(-1)[0]/1000).toFixed(2)} s\n${track.type==='pedestrian'?'尺寸：数据未提供':`长 ${track.length.toFixed(2)} m · 宽 ${track.width.toFixed(2)} m`}\n${sample?`速度 ${(Math.hypot(sample[3],sample[4])*3.6).toFixed(2)} km/h\n位置 x=${sample[1].toFixed(2)} m，y=${sample[2].toFixed(2)} m`:''}`;
   const history=historySegments(track,time);$('history-info').textContent=`过去 10 秒：${history.reduce((n,s)=>n+s.length,0)} 条观测；黄色为历史轨迹，缺口不连线。`;
  }else{$('inspection').textContent='点击场景或列表中的对象';$('history-info').textContent='选择对象后显示过去 10 秒轨迹。';}
 }
 return {update,select(id){selected=byId.has(id)?id:null;tab('objects');lastKey='';update(lastTime,true);}};
}

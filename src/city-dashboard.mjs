import {trafficTree} from './city-traffic-tree.mjs';
import {directionChart,errorChart} from './city-chart-graphics.mjs';
import {flowAt} from './city-flow.mjs';
import {trafficSnapshot} from './city-observation.mjs';
import {assessRisks,riskNames} from './sind-risk.mjs';
import {caseLabels,caseTruth,caseError} from './city-risk-cases.mjs';
import {createPaperPredictor} from './paper-prediction.mjs';
const $=id=>document.getElementById(id),palette={car:'#a0d4e4',bus:'#729eaf',truck:'#8cabbc',motorcycle:'#85b7ca',tricycle:'#547f94',bicycle:'#b4ced8'},labels={car:'轿车',bus:'公交车',truck:'货车',motorcycle:'摩托车',tricycle:'三轮车',bicycle:'自行车'};
export function createCityDashboard(handlers){
 let treeRows=[],treeSignature='',treeSelected=null;
 $('tree-tabs').onclick=e=>{const b=e.target.closest('[data-tree-index]');if(!b)return;const id=treeRows[Number(b.dataset.treeIndex)]?.id;treeSelected=treeSelected===id?null:id;renderTree();};
 function renderTree(){ $('traffic-tree').innerHTML=trafficTree(treeRows,treeSelected);$('tree-tabs').replaceChildren(...treeRows.map((r,i)=>{const b=document.createElement('button');b.dataset.treeIndex=i;b.textContent=r.label;b.setAttribute('aria-pressed',String(treeSelected===r.id));return b;}));}
 let latestPrediction=null;const paper=createPaperPredictor(()=>{if(latestPrediction)prediction(...latestPrediction);});
 let activeCase=null,caseData=null,context=null,caseKind='cross',caseBin=null;
 let lastRisk=-Infinity,lastCity='',events=[],selectedEvent=null,typeFilter=null;
 function applyFilter(type){if(type){exitCase();selectedEvent=null;}typeFilter=type;handlers.filter?.(type);for(const b of $('vehicle-legend').querySelectorAll('[data-type]'))b.setAttribute('aria-pressed',String(b.dataset.type===type));$('vehicle-filter').hidden=!type;$('vehicle-filter-name').textContent=type?`仅显示${labels[type]}`:'';}
 $('vehicle-legend').onclick=$('vehicle-donut').onpointerup=e=>{const item=e.target.closest('[data-type]');if(item)applyFilter(typeFilter===item.dataset.type?null:item.dataset.type);};
 $('clear-vehicle-filter').onclick=()=>applyFilter(null);
 function markRisk(){for(const b of $('risk-candidates').querySelectorAll('[data-risk]'))b.setAttribute('aria-pressed',String(b.dataset.risk===selectedEvent));}
 $('clear-risk').onclick=()=>{exitCase();selectedEvent=null;markRisk();handlers.risk(null,false);};

 function exitCase(){activeCase=null;for(const b of $('case-list').querySelectorAll('button'))b.setAttribute('aria-pressed','false');paper.reset();latestPrediction=null;$('case-review').hidden=true;$('prediction-error-chart').hidden=true;$('prediction-legend').textContent='灰蓝为历史 · 青色为预测';handlers.case?.(null);handlers.truth?.([]);}
 function selectCase(entry){
  if(!context)return;const {data,config}=context,pair=data.tracks.filter(t=>entry.trackIds.includes(t.id));
  const event=assessRisks(pair,entry.anchorMs).find(e=>e.kind===entry.kind);if(!event)return;
  paper.reset();applyFilter(null);activeCase=entry;selectedEvent=null;$('case-review').hidden=false;
  handlers.case?.(entry,event);renderCases();
 }
 function renderCases(){
  const all=(caseData?.cases||[]).filter(e=>e.kind===caseKind),duration=caseData?.durationMs||1,bins=Array.from({length:24},()=>[]);
  all.forEach(e=>bins[Math.min(23,Math.floor(e.anchorMs/duration*24))].push(e));const max=Math.max(1,...bins.map(b=>b.length));
  $('case-timeline').innerHTML=bins.map((b,i)=>`<rect role="button" tabindex="0" aria-label="${Math.round(i/24*duration/1000)} 秒附近，${b.length} 个候选" data-case-bin="${i}" x="${i*10.5+4}" y="${48-Math.max(3,b.length/max*38)}" width="8" height="${Math.max(3,b.length/max*38)}" rx="1" fill="${caseBin===i?'#c1f2f0':'#72dcd7'}" opacity="${b.length?1:.2}"><title>${Math.round(i/24*duration/1000)} 秒附近：${b.length} 个候选</title></rect>`).join('')+'<text x="4" y="63" fill="#bacac5" font-size="9">记录开始</text><text x="256" y="63" text-anchor="end" fill="#bacac5" font-size="9">记录结束</text>';
  const entries=(caseBin===null?all:bins[caseBin]);$('case-count').textContent=`${({cross:'车辆交汇',rear:'跟车过近'})[caseKind]} · ${all.length} 个候选${caseBin===null?'':' · 所选时段 '+entries.length+' 个'}`;
  const scroll=$('case-list').scrollTop;
  $('case-list').replaceChildren(...entries.map((e,i)=>{const b=document.createElement('button');b.dataset.caseId=e.id;b.textContent=`${(e.anchorMs/1000).toFixed(1)} 秒 · ${e.trackIds.map(id=>id.split('/').at(-1)).join(' ↔ ')} · 接近 ${e.ttcS.toFixed(1)} 秒`;b.setAttribute('aria-pressed',String(activeCase?.id===e.id));b.onclick=()=>selectCase(e);return b;}));
  $('case-list').scrollTop=scroll;
  if(!entries.length)$('case-list').textContent='该时段未检出可对照的案例';
 }
 document.querySelectorAll('[data-case-kind]').forEach(b=>b.onclick=()=>{caseKind=b.dataset.caseKind;caseBin=null;document.querySelectorAll('[data-case-kind]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));renderCases();});
 $('case-timeline').onclick=e=>{const b=e.target.closest('[data-case-bin]');if(b){const n=Number(b.dataset.caseBin);caseBin=caseBin===n?null:n;renderCases();}};
 $('case-timeline').onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.target.dispatchEvent(new MouseEvent('click',{bubbles:true}));}};
 $('case-exit').onclick=()=>{exitCase();handlers.risk(null,false);renderCases();};
 $('case-anchor').onclick=()=>{if(activeCase)handlers.caseSeek?.(activeCase.anchorMs,false);};
 $('case-end').onclick=()=>{if(activeCase)handlers.caseSeek?.(activeCase.anchorMs+5000,false);};
 $('case-play').onclick=()=>{if(activeCase)handlers.caseSeek?.(activeCase.anchorMs,true);};

 function prediction(track,time,city){
  const replayTime=activeCase?context.time:time;if(activeCase&&context){track=context.data.tracks.find(t=>t.id===activeCase.focusId);time=activeCase.anchorMs;}
  latestPrediction=track?[track,time,city]:null;
  document.body.classList.toggle('vehicle-selected',!!track);
  const chart=$('prediction-chart');if(!track){chart.innerHTML='';handlers.forecast([]);return;}
  const forecast=paper.get(city,track,time);
  if(!forecast.points){chart.innerHTML='';$('prediction-detail').textContent=forecast.reason;handlers.forecast([]);handlers.truth?.([]);$('prediction-error-chart').hidden=true;return;}
  $('prediction-error-chart').hidden=!activeCase;
  const truth=activeCase?caseTruth(track,time,replayTime):[];handlers.truth?.(truth);
  const history=track.samples.filter(p=>p[0]<=time&&p[0]>=time-3000),points=[...truth,...history,...forecast.points,...(forecast.modes||[]).flatMap(m=>m.points)];
  const xs=points.map(p=>p[1]),ys=points.map(p=>p[2]),xmin=Math.min(...xs),xmax=Math.max(...xs),ymin=Math.min(...ys),ymax=Math.max(...ys),scale=Math.min(240/Math.max(4,xmax-xmin),90/Math.max(4,ymax-ymin)),cx=(xmin+xmax)/2,cy=(ymin+ymax)/2;
  const xy=p=>[140+(p[1]-cx)*scale,65-(p[2]-cy)*scale];
  const path=(ps,history=false)=>ps.map((p,i)=>`${!i||history&&p[0]-ps[i-1][0]>250?'M':'L'}${xy(p).join(',')}`).join(' ');
  const anchor=xy(forecast.points[0]),modes=(forecast.modes||[]).map(m=>`<path d="${path(m.points)}" fill="none" stroke="#72dcd7" stroke-width="1" opacity="${.15+.35*m.probability}"/>`).join('');chart.innerHTML=`<path d="M20 65H260 M140 15V115" stroke="#ffffff12"/>${modes}${truth.length?`<path d="${path(truth)}" fill="none" stroke="#f2ede2" stroke-width="2"/>`:""}<path d="${path(history,true)}" fill="none" stroke="#8cabbc" stroke-width="2"/><path d="${path(forecast.points)}" fill="none" stroke="#72dcd7" stroke-width="2" stroke-dasharray="5 3"/><circle cx="${anchor[0]}" cy="${anchor[1]}" r="3" fill="#f0ede1"/>`;
  const last=forecast.points.at(-1),first=forecast.points[0];$('prediction-detail').textContent=`未来${forecast.horizonSeconds}秒位移 ${Math.hypot(last[1]-first[1],last[2]-first[2]).toFixed(1)} 米${forecast.modes?` · ${forecast.modes.length}种候选 · 最高概率${Math.round(forecast.modes[0].probability*100)}%`:''}`;handlers.forecast(forecast.points);
  if(activeCase){const scores=[1,2,3,4,5].filter(seconds=>time+seconds*1000<=replayTime).map(seconds=>({seconds,error:caseError(track,forecast,time+seconds*1000)?.last})).filter(s=>s.error!==undefined);$('prediction-error-chart').innerHTML=scores.length?'<div class="caption">预测偏差 · 米</div>'+errorChart(scores):'';const error=caseError(track,forecast,replayTime),elapsed=Math.max(0,Math.min(5,(replayTime-time)/1000));$('case-status').textContent=`${caseLabels[activeCase.kind]} · 后续 ${elapsed.toFixed(1)} / 5 秒`;$('prediction-legend').textContent='灰蓝历史 · 青色预测 · 白色实际后续';$('prediction-detail').textContent=`固定在 ${(time/1000).toFixed(1)} 秒预测${error?` · 已观测 ${error.seconds.toFixed(1)} 秒 · 平均偏差 ${error.mean.toFixed(2)} 米 · 当前偏差 ${error.last.toFixed(2)} 米`:' · 等待后续记录对照'}`;}

 }
 return {setCases(manifest){caseData=manifest;caseBin=null;renderCases();},exitCase,
 update(data,config,time,track){context={data,config,time};if(activeCase){$('case-status').textContent=`${caseLabels[activeCase.kind]} · 后续 ${Math.max(0,(time-activeCase.anchorMs)/1000).toFixed(1)} / 5 秒`;}

  const snapshot=trafficSnapshot(data.tracks,time),entries=Object.entries(palette).filter(([k])=>snapshot.categories[k]>0),total=snapshot.vehicles,circumference=2*Math.PI*47;let offset=0;
  const arcs=entries.map(([k,color])=>{const length=snapshot.categories[k]/Math.max(1,total)*circumference,arc=`<circle data-type="${k}" style="cursor:pointer" cx="65" cy="65" r="47" fill="none" stroke="${color}" stroke-width="12" stroke-dasharray="${length} ${circumference-length}" stroke-dashoffset="${-offset}" transform="rotate(-90 65 65)"><title>${labels[k]} ${snapshot.categories[k]} 辆</title></circle>`;offset+=length;return arc;}).join('');
  $('vehicle-donut').innerHTML=`<circle cx="65" cy="65" r="47" fill="none" stroke="#ffffff12" stroke-width="12"/>${arcs}<text x="65" y="64" text-anchor="middle" fill="#e5eeea" font-size="26">${total}</text><text x="65" y="83" text-anchor="middle" fill="#9fb6bb" font-size="10">当前车辆</text>`;
  for(const [k,color]of Object.entries(palette)){let button=$('vehicle-legend').querySelector(`[data-type="${k}"]`);if(!button){button=document.createElement('button');button.dataset.type=k;button.innerHTML=`<i style="background:${color}"></i><span></span>`;$('vehicle-legend').append(button);}button.hidden=!snapshot.categories[k]&&typeFilter!==k;button.setAttribute('aria-pressed',String(typeFilter===k));button.querySelector('span').textContent=`${labels[k]} ${snapshot.categories[k]}`;}
  $('moving-count').textContent=snapshot.moving;$('slow-count').textContent=snapshot.slow;$('mean-speed').textContent=snapshot.meanKmh===null?'—':snapshot.meanKmh.toFixed(1);
  $('motion-note').textContent=`当前行人 ${snapshot.categories.pedestrian} 名`;$('slow-count').parentElement.title='机动车速度低于每秒零点五米';
  const flow=flowAt(config,time);
  $('direction-chart').innerHTML=directionChart(config.approaches.map(a=>({label:a.name,value:flow.approaches[a.id].recent})));
  $('stat-current').textContent=total;$('stat-flow').textContent=flow.recent;$('flow-total').textContent=`本轮累计 ${flow.total} 辆`;
  treeRows=config.approaches.map(a=>({id:a.id,label:a.name,value:flow.approaches[a.id].recent}));const signature=JSON.stringify(treeRows);if(signature!==treeSignature){treeSignature=signature;if(!treeRows.some(r=>r.id===treeSelected))treeSelected=null;renderTree();}
  if(lastCity!==config.city||Math.abs(time-lastRisk)>=500){
   if(lastCity!==config.city)selectedEvent=null;lastCity=config.city;lastRisk=time;
   events=assessRisks(snapshot.active,time);const groups=[['cross','车辆交汇'],['rear','跟车过近'],['vulnerable','人车接近']],counts=groups.map(([kind])=>events.filter(e=>e.kind===kind).length),peak=Math.max(1,...counts);
   $('stat-risk').textContent=counts.reduce((a,b)=>a+b,0);
   $('risk-bars').innerHTML=groups.map(([kind,label],i)=>`<div class="risk-metric"><span>${label}</span><div class="risk-meter"><i style="width:${counts[i]/peak*100}%"></i></div><strong>${counts[i]}</strong></div>`).join('');
   const candidates=events.filter(e=>['cross','rear','vulnerable'].includes(e.kind)).slice(0,3);
   $('risk-candidates').replaceChildren(...candidates.map(e=>{const b=document.createElement('button');b.textContent=`${e.a.id.split('/').at(-1).replace(/^P(?=\d)/,'行人')} ↔ ${e.b.id.split('/').at(-1).replace(/^P(?=\d)/,'行人')} · ${e.ttcS.toFixed(1)} 秒接近`;b.title=riskNames[e.kind];b.dataset.risk=e.key;b.setAttribute('aria-pressed',String(selectedEvent===e.key));b.onclick=()=>{exitCase();applyFilter(null);selectedEvent=e.key;markRisk();handlers.risk(e,true);};return b;}));
   if(!candidates.length){const p=document.createElement('p');p.textContent='当前未检出上述候选';$('risk-candidates').append(p);}
   const selected=events.find(e=>e.key===selectedEvent&&['cross','rear','vulnerable'].includes(e.kind))||null;if(!selected)selectedEvent=null;if(!activeCase)handlers.risk(selected,false);
  }
  prediction(track,time,config.city);return snapshot;
 },reset(){treeSelected=null;treeSignature='';document.body.classList.remove('vehicle-selected');exitCase();context=null;caseData=null;renderCases();latestPrediction=null;paper.reset();applyFilter(null);lastRisk=-Infinity;lastCity='';selectedEvent=null;handlers.risk(null,false);handlers.forecast([]);}};
}

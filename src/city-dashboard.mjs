import {trafficSnapshot,flowTrend} from './city-observation.mjs';
import {assessRisks,riskNames} from './sind-risk.mjs';
import {predict} from './sind-prediction.mjs';
const $=id=>document.getElementById(id),palette={car:'#92cbbd',bus:'#9daed0',truck:'#d2b58b',motorcycle:'#8fb0b8',tricycle:'#b5a6c7',bicycle:'#b8c694'},labels={car:'轿车',bus:'公交车',truck:'货车',motorcycle:'摩托车',tricycle:'三轮车',bicycle:'自行车'};
export function createCityDashboard(handlers){
 let lastRisk=-Infinity,lastCity='',events=[],selectedEvent=null;
 function prediction(track,time){
  const chart=$('prediction-chart');if(!track){chart.innerHTML='';handlers.forecast([]);return;}
  const forecast=predict(track,time,$('home-prediction-model').value);
  if(!forecast.points){chart.innerHTML='';$('prediction-detail').textContent=forecast.reason;handlers.forecast([]);return;}
  const history=track.samples.filter(p=>p[0]<=time&&p[0]>=time-5000),points=[...history,...forecast.points];
  const xs=points.map(p=>p[1]),ys=points.map(p=>p[2]),xmin=Math.min(...xs),xmax=Math.max(...xs),ymin=Math.min(...ys),ymax=Math.max(...ys),scale=Math.min(240/Math.max(4,xmax-xmin),90/Math.max(4,ymax-ymin)),cx=(xmin+xmax)/2,cy=(ymin+ymax)/2;
  const xy=p=>[140+(p[1]-cx)*scale,65-(p[2]-cy)*scale];
  const path=(ps,history=false)=>ps.map((p,i)=>`${!i||history&&p[0]-ps[i-1][0]>250?'M':'L'}${xy(p).join(',')}`).join(' ');
  const anchor=xy(forecast.points[0]);chart.innerHTML=`<path d="M20 65H260 M140 15V115" stroke="#ffffff12"/><path d="${path(history,true)}" fill="none" stroke="#d2b58b" stroke-width="2"/><path d="${path(forecast.points)}" fill="none" stroke="#83cebf" stroke-width="2" stroke-dasharray="5 3"/><circle cx="${anchor[0]}" cy="${anchor[1]}" r="3" fill="#f0ede1"/>`;
  const last=forecast.points.at(-1),first=forecast.points[0];$('prediction-detail').textContent=`三秒位移 ${Math.hypot(last[1]-first[1],last[2]-first[2]).toFixed(1)} 米${forecast.turnFallback?' · 低速时采用恒速':''}`;handlers.forecast(forecast.points);
 }
 return {update(data,config,time,track){
  const snapshot=trafficSnapshot(data.tracks,time),entries=Object.entries(palette).filter(([k])=>snapshot.categories[k]>0),total=snapshot.vehicles,circumference=2*Math.PI*47;let offset=0;
  const arcs=entries.map(([k,color])=>{const length=snapshot.categories[k]/Math.max(1,total)*circumference,arc=`<circle cx="65" cy="65" r="47" fill="none" stroke="${color}" stroke-width="12" stroke-dasharray="${length} ${circumference-length}" stroke-dashoffset="${-offset}" transform="rotate(-90 65 65)"><title>${labels[k]} ${snapshot.categories[k]} 辆</title></circle>`;offset+=length;return arc;}).join('');
  $('vehicle-donut').innerHTML=`<circle cx="65" cy="65" r="47" fill="none" stroke="#ffffff12" stroke-width="12"/>${arcs}<text x="65" y="64" text-anchor="middle" fill="#e5eeea" font-size="26">${total}</text><text x="65" y="83" text-anchor="middle" fill="#9fb6bb" font-size="10">当前车辆</text>`;
  $('vehicle-legend').innerHTML=entries.map(([k,color])=>`<span><i style="background:${color}"></i>${labels[k]} ${snapshot.categories[k]}</span>`).join('')||'<span>暂无车辆</span>';
  $('moving-count').textContent=snapshot.moving;$('slow-count').textContent=snapshot.slow;$('mean-speed').textContent=snapshot.meanKmh===null?'—':snapshot.meanKmh.toFixed(1);
  $('motion-note').textContent=`当前行人 ${snapshot.categories.pedestrian} 名`;$('slow-count').parentElement.title='机动车速度低于每秒零点五米';
  const bins=flowTrend(config.flowEvents,time),max=Math.max(1,...bins.map(b=>b.count)),barWidth=18;
  $('flow-trend').innerHTML=`<path d="M5 89H255 M5 49H255 M5 9H255" stroke="#ffffff12"/>`+bins.map((b,i)=>{const x=9+(12-bins.length+i)*20,h=b.count/max*65;return `<rect x="${x}" y="${89-h}" width="${barWidth-3}" height="${h}" rx="2" fill="${i===bins.length-1?'#dab986':'#7caeaa'}"><title>${(b.start/1000).toFixed(0)} 至 ${(b.end/1000).toFixed(0)} 秒：${b.count} 辆</title></rect><text x="${x+7}" y="${84-h}" text-anchor="middle" fill="#c7d7d7" font-size="9">${b.count}</text>`;}).join('');
  if(lastCity!==config.city||Math.abs(time-lastRisk)>=500){
   if(lastCity!==config.city)selectedEvent=null;lastCity=config.city;lastRisk=time;
   events=assessRisks(snapshot.active,time);const groups=[['cross','交叉冲突'],['rear','追尾接近'],['vulnerable','慢行交互']],counts=groups.map(([kind])=>events.filter(e=>e.kind===kind).length),peak=Math.max(1,...counts);
   $('risk-bars').innerHTML=groups.map(([kind,label],i)=>`<div class="risk-row"><span>${label}</span><span><i style="width:${counts[i]/peak*100}%"></i></span><b>${counts[i]}</b></div>`).join('');
   const candidates=events.filter(e=>['cross','rear','vulnerable'].includes(e.kind)).slice(0,3);
   $('risk-candidates').replaceChildren(...candidates.map(e=>{const b=document.createElement('button');b.textContent=`${e.a.id.split('/').at(-1)} ↔ ${e.b.id.split('/').at(-1)} · ${e.ttcS.toFixed(1)} 秒接近`;b.title=riskNames[e.kind];b.onclick=()=>{selectedEvent=e.key;handlers.risk(e,true);};return b;}));
   if(!candidates.length){const p=document.createElement('p');p.textContent='当前未检出上述候选';$('risk-candidates').append(p);}
   handlers.risk(events.find(e=>e.key===selectedEvent)||null,false);
  }
  prediction(track,time);return snapshot;
 },reset(){lastRisk=-Infinity;lastCity='';selectedEvent=null;handlers.risk(null,false);handlers.forecast([]);}};
}

import {upperBound,sampleTrack} from './sind-clock.mjs';
import {createPaperPredictor} from './paper-prediction.mjs';
export const motorTypes=['car','bus','truck','motorcycle','tricycle'];
export function evaluate(track,forecast){
 if(!forecast.points)return [];
 const rows=track.samples,start=upperBound(rows,forecast.anchorMs)-1;
 return [1,2,3,4,5].map(seconds=>{
  const p=forecast.points[seconds*10];let valid=true;
  for(let i=start+1;i<rows.length&&rows[i-1][0]<p[0];i++)if(rows[i][0]-rows[i-1][0]>250){valid=false;break;}
  const truth=valid?sampleTrack(track,p[0]):null;
  return {seconds,errorM:truth?Math.hypot(p[1]-truth[1],p[2]-truth[2]):null};
 });
}
export function createPredictionUI(onForecast){
 const $=id=>document.getElementById(id);let track,time=0;const paper=createPaperPredictor(()=>update(track,time));
 function update(nextTrack,nextTime){
  track=nextTrack;time=nextTime;const forecast=track?paper.get(track.id.split('/')[0].toLowerCase(),track,time):{reason:'请选择机动车'},scores=evaluate(track,forecast);
  $('prediction-status').textContent=forecast.reason||`预测起点 ${(forecast.anchorMs/1000).toFixed(3)} s · 未来 ${forecast.horizonSeconds} 秒`;
  $('prediction-errors').textContent=scores.map(s=>`${s.seconds} 秒：${s.errorM===null?'无连续真值':s.errorM.toFixed(2)+' m'}`).join(' / ');
  onForecast($('show-prediction').checked?forecast.points||[]:[]);
  $('export-prediction').disabled=!forecast.points;
  $('export-prediction').onclick=()=>{
   if(!forecast.points)return;
   const header='track_id,model,anchor_ms,horizon_s,predicted_x_m,predicted_y_m,endpoint_error_m';
   const csv='\uFEFF'+header+'\r\n'+forecast.points.map((p,i)=>[track.id,forecast.model,forecast.anchorMs,i/10,p[1],p[2],scores.find(s=>s.seconds===i/10)?.errorM??''].join(',')).join('\r\n');
   const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=`SinD-${track.id.split('/').at(-1)}-${forecast.model}-${forecast.anchorMs}ms-prediction.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
 }
 $('show-prediction').onchange=()=>update(track,time);
 return {update};
}

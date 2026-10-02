import {upperBound,sampleTrack} from './sind-clock.mjs';
export const motorTypes=['car','bus','truck','motorcycle','tricycle'];
export const baselineModels=['cv','ca','dca','ctrv'];
export const baselineProtocol={version:'four-baselines-v1',historyMs:1000,minHistoryMs:500,dampingTauS:1,turnMinSpeedMps:.5,turnRateEstimator:'OLS unwrapped velocity direction; CV fallback if any history speed < 0.5 m/s',selection:'Fixed exploratory settings; not tuned by city'};
// Predict from a causal observation anchor, never from the replay interpolator.
export function predict(track,time,model='cv'){
 if(!baselineModels.includes(model))return {reason:'未知预测模型'};
 if(!track||!motorTypes.includes(track.type))return {reason:'请选择机动车（轿车、公交、货车、摩托车或三轮车）'};
 const rows=track.samples,index=upperBound(rows,time)-1,a=rows[index];
 if(!a||time-a[0]>250)return {reason:'当前没有足够新近的观测'};
 let ax=0,ay=0,omega=0,turnFallback=false;
 if(model!=='cv'){
  let start=index;while(start>0&&a[0]-rows[start-1][0]<=1000&&rows[start][0]-rows[start-1][0]<=250)start--;
  const history=rows.slice(start,index+1);
  if(history.length<3||a[0]-history[0][0]<500)return {reason:'此模型需要至少 0.5 秒连续历史'};
  const ts=history.map(r=>(r[0]-a[0])/1000),mean=ts.reduce((s,t)=>s+t,0)/ts.length;
  const denominator=ts.reduce((s,t)=>s+(t-mean)**2,0);
  ax=history.reduce((s,r,i)=>s+(ts[i]-mean)*r[3],0)/denominator;
  ay=history.reduce((s,r,i)=>s+(ts[i]-mean)*r[4],0)/denominator;
  if(model==='ctrv'){
   ax=ay=0;turnFallback=history.some(r=>Math.hypot(r[3],r[4])<baselineProtocol.turnMinSpeedMps);
   if(!turnFallback){
    const headings=[];
    for(const r of history){const heading=Math.atan2(r[4],r[3]),previous=headings.at(-1);headings.push(previous===undefined?heading:previous+Math.atan2(Math.sin(heading-previous),Math.cos(heading-previous)));}
    omega=headings.reduce((s,h,i)=>s+(ts[i]-mean)*h,0)/denominator;
   }
  }
 }
 const points=Array.from({length:31},(_,i)=>{
  const t=i/10;
  if(model==='ctrv'&&Math.abs(omega)>1e-8){const theta=Math.atan2(a[4],a[3]),speed=Math.hypot(a[3],a[4]);return [a[0]+t*1000,a[1]+speed/omega*(Math.sin(theta+omega*t)-Math.sin(theta)),a[2]+speed/omega*(Math.cos(theta)-Math.cos(theta+omega*t))];}
  const tau=baselineProtocol.dampingTauS,factor=model==='dca'?tau*(t+tau*Math.expm1(-t/tau)):.5*t*t;
  return [a[0]+t*1000,a[1]+a[3]*t+ax*factor,a[2]+a[4]*t+ay*factor];
 });
 return {model,anchorMs:a[0],points,acceleration:[ax,ay],...(model==='ctrv'?{turnRateRadS:omega,turnFallback}:{}),...(model==='dca'?{dampingTauS:baselineProtocol.dampingTauS}:{})};
}
export function evaluate(track,forecast){
 if(!forecast.points)return [];
 const rows=track.samples,start=upperBound(rows,forecast.anchorMs)-1;
 return [1,2,3].map(seconds=>{
  const p=forecast.points[seconds*10];let valid=true;
  for(let i=start+1;i<rows.length&&rows[i-1][0]<p[0];i++)if(rows[i][0]-rows[i-1][0]>250){valid=false;break;}
  const truth=valid?sampleTrack(track,p[0]):null;
  return {seconds,errorM:truth?Math.hypot(p[1]-truth[1],p[2]-truth[2]):null};
 });
}
export function createPredictionUI(onForecast){
 const $=id=>document.getElementById(id);let track,time=0;
 function update(nextTrack,nextTime){
  track=nextTrack;time=nextTime;const forecast=predict(track,time,$('prediction-model').value),scores=evaluate(track,forecast);
  $('prediction-status').textContent=forecast.reason||`预测起点 ${(forecast.anchorMs/1000).toFixed(3)} s · 未来 3 秒${forecast.turnFallback?' · 低速历史，CTRV 回退恒速':''}`;
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
 $('prediction-model').onchange=$('show-prediction').onchange=()=>update(track,time);
 return {update};
}

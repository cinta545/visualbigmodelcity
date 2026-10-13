import {upperBound} from './sind-clock.mjs';
export function createPaperPredictor(onReady=()=>{},request=fetch){
 let generation=0,active='',pending=null,last=null,error=null,failedAt=0,failedKey='';
 return {get(city,track,time){
  const identity=city+'/'+track.id,anchor=track.samples[upperBound(track.samples,time)-1];
  if(identity!==active){active=identity;pending=null;last=null;error=null;}
  if(!anchor||time-anchor[0]>250)return {reason:'当前没有足够新近的观测'};
  const epoch=Math.floor(anchor[0]/500),key=identity+'/'+epoch;
  if(error&&failedKey!==key)error=null;
  const available=last&&last.anchorMs<=time&&time-last.anchorMs<=750;
  if(!pending&&(!last||last.key!==key)&&(!error||Date.now()-failedAt>5000)){
   pending=key;const token=generation;
   request('/api/prediction/stdg-lstm',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({city,trackId:track.id,timeMs:anchor[0]})}).then(async response=>{const result=await response.json();if(!response.ok)throw new Error(result.reason||'论文模型服务不可用');if(token===generation&&active===identity&&pending===key){last={...result,key};error=null;}}).catch(e=>{if(token===generation&&active===identity&&pending===key){error=e.message;failedAt=Date.now();failedKey=key;}}).finally(()=>{if(token===generation&&active===identity&&pending===key){pending=null;onReady();}});
  }
  return available?last:{reason:error||'正在计算五秒多模态轨迹…'};
 },reset(){generation++;active='';pending=null;last=null;error=null;}};
}

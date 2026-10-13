import {sampleTrack,upperBound} from './sind-clock.mjs';
export const caseLabels={cross:'交叉冲突',rear:'追尾接近'};
export function continuousWindow(track,start,end){
 if(!sampleTrack(track,start)||!sampleTrack(track,end))return false;
 const rows=track.samples;
 for(let i=Math.max(1,upperBound(rows,start));i<rows.length&&rows[i-1][0]<end;i++)if(rows[i][0]-rows[i-1][0]>250)return false;
 return true;
}
export function caseTruth(track,anchor,time){
 const end=Math.min(anchor+5000,time),result=[];
 for(let t=anchor;t<=end+.001;t+=100){if(!continuousWindow(track,anchor,t))break;const p=sampleTrack(track,t);if(p)result.push(p);}
 return result;
}
export function caseClock(time,dt,entry){return Math.min(entry.anchorMs+5000,Math.max(entry.anchorMs,time+dt));}
export function caseError(track,forecast,time){
 if(!forecast.points)return null;
 const points=forecast.points.filter(p=>p[0]>forecast.anchorMs&&p[0]<=time),errors=[];
 for(const p of points){if(!continuousWindow(track,forecast.anchorMs,p[0]))break;const truth=sampleTrack(track,p[0]);errors.push(Math.hypot(p[1]-truth[1],p[2]-truth[2]));}
 return errors.length?{mean:errors.reduce((a,b)=>a+b,0)/errors.length,last:errors.at(-1),seconds:errors.length/10}:null;
}

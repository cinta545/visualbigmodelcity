import {upperBound,sampleTrack} from './sind-clock.mjs';
import {motorTypes} from './sind-prediction.mjs';
export function prepareObservation(track){
 const rows=track.samples,segments=[];let start=0;
 for(let i=1;i<=rows.length;i++)if(i===rows.length||rows[i][0]-rows[i-1][0]>250){segments.push([rows[start][0],rows[i-1][0]]);start=i;}
 return segments;
}
export function observationOpacity(segments,time,fadeMs=700){
 const i=upperBound(segments,time)-1,segment=segments[i];if(!segment||time>segment[1])return 0;
 // Fade within measured time only; neither freeze nor extrapolate at the endpoint.
 const duration=segment[1]-segment[0];if(duration===0)return 1;
 const ramp=Math.min(fadeMs,duration/3),f=Math.max(0,Math.min(1,(time-segment[0])/ramp,(segment[1]-time)/ramp));return f*f*(3-2*f);
}
export function trafficSnapshot(tracks,time){
 const categories={car:0,bus:0,truck:0,motorcycle:0,tricycle:0,bicycle:0,pedestrian:0};let moving=0,slow=0,speedSum=0;
 const active=[];for(const t of tracks){const s=sampleTrack(t,time);if(!s)continue;categories[t.type]=(categories[t.type]||0)+1;active.push(t);if(motorTypes.includes(t.type)){const speed=Math.hypot(s[3],s[4]);speedSum+=speed;if(speed>=.5)moving++;else slow++;}}
 const vehicles=Object.entries(categories).reduce((n,[type,count])=>n+(type==='pedestrian'?0:count),0),motor=moving+slow;
 return {categories,vehicles,motor,moving,slow,meanKmh:motor?speedSum/motor*3.6:null,active};
}
export function flowTrend(events,time,bins=12,widthMs=10000){
 // Fixed bins: never include future events; early bins before recording zero are absent.
 const end=Math.floor(time/widthMs)*widthMs,result=[];
 for(let i=bins-1;i>=0;i--){const start=end-i*widthMs;if(start<0)continue;result.push({start,end:Math.min(time,start+widthMs),count:0});}
 for(const event of events){if(event[0]>time)break;const row=result.find(b=>event[0]>=b.start&&(event[0]<b.start+widthMs));if(row)row.count++;}return result;
}
export function observationHull(tracks){
 const points=[];for(const t of tracks)for(let i=0;i<t.samples.length;i+=10)points.push(t.samples[i].slice(1,3));for(const t of tracks)points.push(t.samples.at(-1).slice(1,3));
 points.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);const cross=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]);
 const lower=[],upper=[];for(const p of points){while(lower.length>1&&cross(lower.at(-2),lower.at(-1),p)<=0)lower.pop();lower.push(p);}for(const p of points.slice().reverse()){while(upper.length>1&&cross(upper.at(-2),upper.at(-1),p)<=0)upper.pop();upper.push(p);}lower.pop();upper.pop();return lower.concat(upper);
}

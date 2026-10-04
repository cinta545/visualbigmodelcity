import {sampleTrack} from './sind-clock.mjs';
const autos=new Set(['car','bus','truck']);
// Offline presentation metadata only. Never use this full-record classification in prediction.
export function isLongStatic(track){
 if(!autos.has(track.type)||track.samples.length<2)return false;
 const rows=track.samples;if(rows.at(-1)[0]-rows[0][0]<30000)return false;
 let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
 for(const s of rows){if(Math.hypot(s[3],s[4])>=.5)return false;minX=Math.min(minX,s[1]);maxX=Math.max(maxX,s[1]);minY=Math.min(minY,s[2]);maxY=Math.max(maxY,s[2]);}
 return Math.hypot(maxX-minX,maxY-minY)<1;
}
export function busyStart(tracks,duration){
 const cars=tracks.filter(t=>autos.has(t.type)&&!isLongStatic(t));let best=0,score=-1;
 for(let time=1000;time<duration-10000;time+=2000){let value=0;
  for(const offset of [0,2000,4000,6000,8000])for(const track of cars){const s=sampleTrack(track,time+offset);if(s&&Math.hypot(s[3],s[4])>=.5)value+=offset===0?5:1;}
  if(value>score){score=value;best=time;}
 }return best;
}

export function flowAt(scene,time){
 const counts=Object.fromEntries(scene.approaches.map(a=>[a.id,{total:0,recent:0}]));
 for(const event of scene.flowEvents){if(event[0]>time)break;const c=counts[event[1]];if(!c)continue;c.total++;if(event[0]>time-60000)c.recent++;}
 return {approaches:counts,total:Object.values(counts).reduce((n,c)=>n+c.total,0),recent:Object.values(counts).reduce((n,c)=>n+c.recent,0),windowSeconds:Math.min(60,time/1000)};
}
export function loopTime(time,duration){return duration>0?((time%duration)+duration)%duration:0;}

// Sample only within observed lifetimes. Do not bridge missing data > 250 ms.
export function upperBound(rows, time) {
  let lo=0, hi=rows.length;
  while(lo<hi){const mid=(lo+hi)>>>1;if(rows[mid][0]<=time)lo=mid+1;else hi=mid;}
  return lo;
}
export function sampleTrack(track,time){
  const rows=track.samples;
  if(!rows.length || time<rows[0][0] || time>rows.at(-1)[0])return null;
  const i=upperBound(rows,time)-1,a=rows[i],b=rows[i+1];
  if(!b || a[0]===time)return a.slice();
  if(b[0]-a[0]>250)return null;
  const f=(time-a[0])/(b[0]-a[0]);
  const yaw=a[5]+Math.atan2(Math.sin(b[5]-a[5]),Math.cos(b[5]-a[5]))*f;
  return [time,...[1,2,3,4].map(k=>a[k]+(b[k]-a[k])*f),yaw];
}
export function sampleSignals(events,time){
  const i=upperBound(events,time)-1;
  return i<0?null:events[i].slice(1);
}

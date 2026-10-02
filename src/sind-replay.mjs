import {sampleTrack,sampleSignals,upperBound} from './sind-clock.mjs';
const $=id=>document.getElementById(id), canvas=$('map'),ctx=canvas.getContext('2d');
let data,time=0,playing=false,last=performance.now();
const colors={car:'#75b7f5',truck:'#75b7f5',bus:'#b09eff',pedestrian:'#7cdbac'};
function draw(){
 if(!data)return;
 const dpr=Math.min(devicePixelRatio,2),w=canvas.clientWidth,h=canvas.clientHeight;
 if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}
 ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='#172732';ctx.fillRect(0,0,w,h);
 const [x0,y0,x1,y1]=data.meta.bounds,s=Math.min((w-50)/(x1-x0),(h-50)/(y1-y0));
 const point=(x,y)=>[w/2+(x-(x0+x1)/2)*s,h/2-(y-(y0+y1)/2)*s];
 for(const way of data.ways){
  const type=way.tags.type;if(['virtual','traffic_light','traffic_sign'].includes(type))continue;
  ctx.strokeStyle=type==='curbstone'?'#6f8896':type==='wait_line'?'#d6be70':'#b9c6c9';
  ctx.lineWidth=type==='stop_line'?2:1;ctx.setLineDash(way.tags.subtype==='dashed'?[5,5]:[]);
  ctx.beginPath();way.points.forEach((p,i)=>ctx[i?'lineTo':'moveTo'](...point(...p)));ctx.stroke();
 }
 ctx.setLineDash([]);let active=0;
 for(const track of data.tracks){
  const sample=sampleTrack(track,time);if(!sample)continue;active++;
  const color=colors[track.type]||'#edb46c';
  if($('trails').checked){
   ctx.strokeStyle=color;ctx.globalAlpha=.35;ctx.lineWidth=1;ctx.beginPath();
   const rows=track.samples;let first=true;
   for(let i=upperBound(rows,time-3000);i<rows.length&&rows[i][0]<=time;i++){
    if(i>0&&rows[i][0]-rows[i-1][0]>250)first=true;
    ctx[first?'moveTo':'lineTo'](...point(rows[i][1],rows[i][2]));first=false;
   }ctx.stroke();ctx.globalAlpha=1;
  }
  const [x,y]=point(sample[1],sample[2]);ctx.save();ctx.translate(x,y);ctx.rotate(-sample[5]);ctx.fillStyle=color;
  if(track.type==='pedestrian'){ctx.beginPath();ctx.arc(0,0,Math.max(2,.3*s),0,Math.PI*2);ctx.fill();}
  else {ctx.fillRect(-track.length*s/2,-track.width*s/2,track.length*s,track.width*s);ctx.fillStyle='#eef5fa';ctx.fillRect(track.length*s/2-1,-track.width*s/2,1,track.width*s);}
  ctx.restore();
 }
 $('status').textContent=`当前 ${active} 个交通参与者 · 历史回放`;
 const signals=sampleSignals(data.signals,time);
 $('signals').replaceChildren(...Array.from({length:8},(_,i)=>{const el=document.createElement('div');el.className='signal';const c=signals?.[i],labels={0:'红灯',1:'绿灯',3:'黄灯'},colors={0:'#f06669',1:'#64d49b',3:'#efd478'};const bulb=document.createElement('i');bulb.style.background=colors[c]||'#687581';el.append(bulb,`X${i+1} ${labels[c]||'未知'}`);return el;}));
 $('time').value=time;$('clock').textContent=`${(time/1000).toFixed(1)} / ${(data.meta.durationMs/1000).toFixed(1)} s`;
}
$('play').onclick=()=>{if(time>=data.meta.durationMs)time=0;playing=!playing;$('play').textContent=playing?'暂停':'播放';};
$('time').oninput=e=>{time=Number(e.target.value);draw();};
$('trails').onchange=draw;window.addEventListener('resize',draw);
function animate(now){const dt=Math.min(now-last,200);last=now;if(data&&playing){time=Math.min(data.meta.durationMs,time+dt*Number($('speed').value));if(time===data.meta.durationMs){playing=false;$('play').textContent='播放';}draw();}requestAnimationFrame(animate);}requestAnimationFrame(animate);
try{const response=await fetch('/data/sind/replay.json');if(!response.ok)throw Error('样例尚未导入，请运行 python scripts/prepare-sind.py');data=await response.json();$('time').max=data.meta.durationMs;$('play').disabled=false;$('time').disabled=false;$('details').textContent=`记录 8_2_1 · ${data.meta.tracks} 条轨迹 · ${data.meta.signalEvents} 次灯色记录`;draw();}catch(error){$('status').textContent='加载未完成';$('error').textContent=error.message;}

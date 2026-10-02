import './sind-color.mjs';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {createVehicle} from './district/models.js';
import {groundMaterial} from './district/materials.js';
import {createCorner,createMappedSignal} from './sind-corner.mjs';
import {addCrosswalks} from './sind-markings.mjs';
import {createVulnerableActor,animateActor} from './sind-actors.mjs';
import {createAnalysis,historySegments} from './sind-analysis.mjs';
import {sampleTrack,sampleSignals,upperBound} from './sind-clock.mjs';
const $=id=>document.getElementById(id);
const scene=new THREE.Scene();scene.background=new THREE.Color(0xcbdde0);
scene.fog=new THREE.Fog(0xcbdde0,160,450);
const renderer=new THREE.WebGLRenderer({canvas:$('scene'),antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputEncoding=THREE.sRGBEncoding;
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.75;
const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment();
scene.environment=pmrem.fromScene(room,.04).texture;room.dispose?.();pmrem.dispose();
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
const camera=new THREE.PerspectiveCamera(48,1,.1,800);
const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.maxPolarAngle=Math.PI/2-.015;controls.minDistance=2;controls.maxDistance=220;
scene.add(new THREE.HemisphereLight(0xd9e9ff,0x8a9273,.42));
const sun=new THREE.DirectionalLight(0xfff2d8,1.2);sun.position.set(-40,90,30);sun.castShadow=true;sun.shadow.mapSize.set(4096,4096);
Object.assign(sun.shadow.camera,{left:-85,right:85,top:85,bottom:-85,near:1,far:250});sun.shadow.normalBias=.03;scene.add(sun);
const material=(color)=>new THREE.MeshStandardMaterial({color,roughness:.83});
const grey=material(0x68736e),dark=material(0x273732),skin=material(0xc49a77),orange=material(0xb8743f);
function box(parent,w,h,d,x,y,z,mat){const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;}
box(scene,400,.2,400,15,-.21,-16,material(0x9ca69a));
const objects=new Map(),pools=new Map(),signalHeads=[],pickable=[];
let data,site,baseline,surface,pavements,time=0,playing=true,last=performance.now(),selected=null,center=new THREE.Vector3(15,0,-16),lastHUD=-1;
let analysis,historyEnabled=true,lastHistoryKey='',clipEnd=null;
const historyGeometry=new THREE.BufferGeometry(),historyLine=new THREE.LineSegments(historyGeometry,new THREE.LineBasicMaterial({color:0xd4a327,depthTest:false}));
const historyPositions=new THREE.BufferAttribute(new Float32Array(12000),3);historyGeometry.setAttribute('position',historyPositions);historyGeometry.setDrawRange(0,0);
historyLine.renderOrder=10;scene.add(historyLine);
const selectedBox=new THREE.BoxHelper(new THREE.Object3D(),0xd4a327);selectedBox.visible=false;scene.add(selectedBox);
const forecastGeometry=new THREE.BufferGeometry();
const forecastPositions=new THREE.BufferAttribute(new Float32Array(93),3);forecastGeometry.setAttribute('position',forecastPositions);forecastGeometry.setDrawRange(0,0);
const forecastLine=new THREE.Line(forecastGeometry,new THREE.LineBasicMaterial({color:0x168ee8,depthTest:false}));forecastLine.renderOrder=11;scene.add(forecastLine);
function drawForecast(points){forecastPositions.array.fill(0);points.forEach((p,i)=>forecastPositions.setXYZ(i,p[1],.18,-p[2]));forecastPositions.needsUpdate=true;forecastGeometry.setDrawRange(0,points.length);forecastGeometry.computeBoundingSphere();forecastLine.visible=points.length>0;}
const riskGeometry=new THREE.BufferGeometry(),riskPositions=new THREE.BufferAttribute(new Float32Array(12),3);
riskGeometry.setAttribute('position',riskPositions);riskGeometry.setDrawRange(0,0);
const riskLines=new THREE.LineSegments(riskGeometry,new THREE.LineBasicMaterial({color:0xe56825,depthTest:false}));riskLines.renderOrder=12;scene.add(riskLines);
const riskMarkers=[0,1].map(()=>{const m=new THREE.Mesh(new THREE.RingGeometry(.7,1,32),new THREE.MeshBasicMaterial({color:0xe56825,side:THREE.DoubleSide,depthTest:false}));m.rotation.x=-Math.PI/2;m.visible=false;m.renderOrder=12;scene.add(m);return m;});
let activeRisk=null;
const riskBoxes=[0,1].map(()=>{const b=new THREE.BoxHelper(new THREE.Object3D(),0xe56825);b.visible=false;scene.add(b);return b;});
function updateRiskBoxes(){riskBoxes.forEach((box,i)=>{const object=activeRisk&&objects.get([activeRisk.a.id,activeRisk.b.id][i]);box.visible=!!object;if(object)box.setFromObject(object);});}
function drawRisk(event){activeRisk=event;updateRiskBoxes();riskLines.visible=!!event;riskMarkers.forEach(m=>m.visible=!!event);if(!event)return;[event.a,event.b].forEach((s,i)=>{const p=event.centers[i];riskPositions.setXYZ(i*2,s.p[0],.24,-s.p[1]);riskPositions.setXYZ(i*2+1,p[0],.24,-p[1]);riskMarkers[i].position.set(p[0],.25,-p[1]);});riskPositions.needsUpdate=true;riskGeometry.setDrawRange(0,4);riskGeometry.computeBoundingSphere();}
function focusRisk(event){if(!event)return;const x=(event.a.p[0]+event.b.p[0])/2,z=-(event.a.p[1]+event.b.p[1])/2;controls.target.set(x,0,z);camera.position.set(x,Math.max(35,Math.hypot(event.a.p[0]-event.b.p[0],event.a.p[1]-event.b.p[1])*1.3),z+.1);controls.update();}
function selectObject(id){selected=id;$('analysis').hidden=false;$('toggle-analysis').setAttribute('aria-expanded','true');analysis?.select(id);lastHistoryKey='';update();}
function focusObject(id){const g=objects.get(id);if(!g)return;const offset=new THREE.Vector3(9,7,11);camera.position.copy(g.position).add(offset);controls.target.copy(g.position);controls.update();}
function updateHistory(){
 const key=selected+':'+Math.floor(time/100)+':'+historyEnabled;
 if(key!==lastHistoryKey){
  lastHistoryKey=key;const track=data.tracks.find(t=>t.id===selected),vertices=[];
  if(historyEnabled)for(const segment of historySegments(track,time))for(let i=1;i<segment.length;i++){const a=segment[i-1],b=segment[i];vertices.push(a[1],.13,-a[2],b[1],.13,-b[2]);}
  historyPositions.array.fill(0);historyPositions.array.set(vertices.slice(0,historyPositions.array.length));historyPositions.needsUpdate=true;
  historyGeometry.setDrawRange(0,Math.min(vertices.length,historyPositions.array.length)/3);historyGeometry.computeBoundingSphere();historyLine.visible=vertices.length>0;
 }
 const object=objects.get(selected);selectedBox.visible=!!object;if(object)selectedBox.setFromObject(object);
}
function buildMap(){
 const asphalt=groundMaterial('asphalt',.25,.25);asphalt.color.setHex(0x9ba5ad);
 const polygons=surface.type==='Polygon'?[surface.coordinates]:surface.coordinates;
 for(const rings of polygons){
  const shape=new THREE.Shape(rings[0].map(p=>new THREE.Vector2(...p)));
  for(const ring of rings.slice(1))shape.holes.push(new THREE.Path(ring.map(p=>new THREE.Vector2(...p))));
  const mesh=new THREE.Mesh(new THREE.ShapeGeometry(shape),asphalt);mesh.rotation.x=-Math.PI/2;mesh.receiveShadow=true;scene.add(mesh);
 }
 for(const binding of baseline.signalBindings)signalHeads.push(createMappedSignal(scene,binding));
 for(const corner of [site,...(site.additionalCorners||[])])createCorner(scene,corner,pavements[corner.id]);
 addCrosswalks(scene,data.ways);
 for(const way of data.ways){
  if(way.tags.type==='traffic_light'||way.tags.type==='zebra_marking')continue;
  if(way.tags.type==='virtual')continue;
  const curb=way.tags.type==='curbstone',width=curb?.16:way.tags.type==='stop_line'?.3:.1;
  const paint=curb?material(0xc9c8b8):material(0xf0eee0);
  for(let i=1;i<way.points.length;i++){
   const a=way.points[i-1],b=way.points[i],length=Math.hypot(b[0]-a[0],b[1]-a[1]),angle=Math.atan2(b[1]-a[1],b[0]-a[0]);
   const dashed=way.tags.subtype==='dashed';
   for(let start=0;start<length;start+=dashed?4:length+1){
    const len=dashed?Math.min(2,length-start):length;
    const mid=start+len/2,mesh=box(scene,len,curb?.15:.025,width,a[0]+Math.cos(angle)*mid,curb?.04:.025,-a[1]-Math.sin(angle)*mid,paint);mesh.rotation.y=angle;
   }
  }
 }
}
function createParticipant(track){
 const pool=pools.get(track.type)||[];let g=pool.pop();
 if(!g){
  const visual=['car','bus','truck'].includes(track.type)?createVehicle({id:track.id,subType:track.type,displayLabel:'城市公交'},pickable.length):createVulnerableActor(track.type);
  const bounds=new THREE.Box3().setFromObject(visual),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
  visual.position.set(-center.x,-bounds.min.y,-center.z);
  const paints=new Set();visual.traverse(o=>{if(o.material?.isMeshPhysicalMaterial)paints.add(o.material);});
  g=new THREE.Group();g.add(visual);g.userData={...visual.userData,nominalSize:size,paints};scene.add(g);pickable.push(g);
 }
 g.scale.set(1,1,1);
 if(track.type!=='pedestrian'){g.scale.x=track.length/g.userData.nominalSize.x;g.scale.z=track.width/g.userData.nominalSize.z;}
 const palette=[0xe4e2d8,0x486777,0x9eaaa9,0x333e46,0x857367];
 let hash=0;for(const ch of track.id)hash=(hash*31+ch.charCodeAt(0))>>>0;
 for(const paint of g.userData.paints)paint.color.setHex(track.type==='bus'?0xbacac1:track.type==='truck'?0xd3d4ca:palette[hash%palette.length]);
 g.userData.track=track;g.visible=true;objects.set(track.id,g);return g;
}
function update(){
 let active=0,pedestrians=0;
 for(const [id,g]of objects){
  if(sampleTrack(g.userData.track,time))continue;
  g.visible=false;objects.delete(id);const type=g.userData.track.type;
  if(!pools.has(type))pools.set(type,[]);pools.get(type).push(g);
 }
 for(const track of data.tracks){
  const s=sampleTrack(track,time);let g=objects.get(track.id);
  if(!s){if(g)g.visible=false;continue;}
  if(!g)g=createParticipant(track);g.visible=true;active++;if(track.type==='pedestrian')pedestrians++;
  g.position.set(s[1],0,-s[2]);g.rotation.y=track.type==='pedestrian'?Math.atan2(s[4],s[3]):s[5];
  // Integrate observed displacement so changing speed does not jump the wheel angle.
  const k=Math.max(0,upperBound(track.samples,time)-1),a=track.samples[k];
  const distance=track.distance[k]+Math.hypot(s[1]-a[1],s[2]-a[2]);
  animateActor(g,distance,Math.hypot(s[3],s[4]));
 }
 const states=sampleSignals(data.signals,time);
 for(const head of signalHeads)for(let i=0;i<3;i++){const on=states?.[head.id-1]===[0,3,1][i];head.bulbs[i].emissiveIntensity=on?2:0;head.bulbs[i].color.setHex(on?[0xe83b30,0xf4b830,0x38ae62][i]:0x17211c);}
 if(Math.abs(time-lastHUD)>80||!playing){
  lastHUD=time;$('scene').dataset.active=String(active);$('scene').dataset.modelCount=String(pickable.length);$('counts').textContent=`${active-pedestrians} 辆车 · ${pedestrians} 名行人`;
  $('time').value=time;$('clock').textContent=`${(time/1000).toFixed(1)} / ${(data.meta.durationMs/1000).toFixed(1)} s`;
  for(let i=0;i<8;i++){const c=states?.[i],el=$('signal-'+i);el.querySelector('i').style.background=({0:'#de6658',1:'#3b9a6b',3:'#ddb340'})[c]||'#888';el.querySelector('span').textContent=({0:'红灯',1:'绿灯',3:'黄灯'})[c]||'未知';}
 }
 analysis?.update(time,!playing);updateHistory();updateRiskBoxes();
}
function view(mode){
 controls.target.copy(center);
 if(mode==='overhead')camera.position.copy(center).add(new THREE.Vector3(0,100,.1));
 else if(site?.views[mode]){camera.position.fromArray(site.views[mode].position);controls.target.fromArray(site.views[mode].target);}
 else camera.position.copy(center).add(new THREE.Vector3(64,58,67));
 controls.update();document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===mode));
}
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>view(b.dataset.view));
$('toggle-analysis').onclick=()=>{const hidden=$('analysis').hidden=!$('analysis').hidden;$('toggle-analysis').setAttribute('aria-expanded',String(!hidden));};
$('capture').onclick=()=>{renderer.render(scene,camera);renderer.domElement.toBlob(blob=>{if(!blob)return;const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`SinD-Tianjin-${(time/1000).toFixed(1)}s.png`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});};
$('play').onclick=()=>{if(!data)return;clipEnd=null;if(time>=data.meta.durationMs)time=0;playing=!playing;$('play').textContent=playing?'暂停':'播放';};
$('time').oninput=e=>{clipEnd=null;time=Number(e.target.value);lastHUD=-1000;lastHistoryKey='';update();};
let down;
renderer.domElement.addEventListener('pointerdown',e=>down=[e.clientX,e.clientY]);
renderer.domElement.addEventListener('pointerup',e=>{if(!data||!down||Math.hypot(e.clientX-down[0],e.clientY-down[1])>5)return;const ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2(e.clientX/innerWidth*2-1,1-e.clientY/innerHeight*2),camera);const hit=ray.intersectObjects(pickable.filter(g=>g.visible),true)[0];if(hit){let g=hit.object;while(g&&!g.userData.track)g=g.parent;selectObject(g?.userData.track.id);}});
function resize(){renderer.setSize(innerWidth,innerHeight,false);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();}window.addEventListener('resize',resize);resize();view('overview');
function animate(now){requestAnimationFrame(animate);const dt=Math.min(now-last,200);last=now;if(data&&playing){time=Math.min(time+dt*Number($('speed').value),clipEnd??data.meta.durationMs);if(clipEnd!==null&&time>=clipEnd){playing=false;clipEnd=null;$('play').textContent='播放';}if(time===data.meta.durationMs){playing=false;$('play').textContent='重播';}update();}controls.update();renderer.render(scene,camera);}requestAnimationFrame(animate);
try{
 [data,site,baseline,surface,pavements]=await Promise.all(['/data/sind/replay.json','/shared/sind-visual-site.json','/data/sind/scene-baseline.json','/data/sind/road-surface.json','/data/sind/pavements.json'].map(async url=>{const r=await fetch(url);if(!r.ok)throw Error(`数据加载失败 ${r.status}: ${url}`);return r.json();}));
 if(baseline.fixedFurnitureCollidingTracks.length)throw Error('场景碰撞检查未通过');
 for(const track of data.tracks){track.distance=[0];for(let i=1;i<track.samples.length;i++){const a=track.samples[i-1],b=track.samples[i];track.distance.push(track.distance[i-1]+(b[0]-a[0]>250?0:Math.hypot(b[1]-a[1],b[2]-a[2])));}}
 analysis=createAnalysis(data,{playClip:(start,end)=>{time=start;clipEnd=end;playing=true;$('play').textContent='暂停';lastHistoryKey='';update();},risk:drawRisk,focusRisk,forecast:drawForecast,select:selectObject,focus:focusObject,history:value=>{historyEnabled=value;lastHistoryKey='';updateHistory();},seek:value=>{clipEnd=null;time=value;playing=false;$('play').textContent='播放';lastHUD=-1000;lastHistoryKey='';update();focusObject(selected);}});
 buildMap();view('overview');$('time').max=data.meta.durationMs;$('time').disabled=false;$('play').disabled=false;$('loading').hidden=true;update();
}catch(e){$('loading').textContent=e.message;console.error(e);}

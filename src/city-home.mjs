import {updateVehicleDetail,followVehicle,focusDaylightShadow} from './city-render-quality.mjs';
import {humanVariantForTrack} from './city-human-appearance.mjs';
import './sind-color.mjs';
import {loadHumanAssets,createHumanWalker,attachHumanRider,posedBounds} from './city-humans.mjs';
import {isLongStatic,busyStart} from './city-presentation.mjs';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {createDaylight,usesRefinedPresentation} from './city-lighting.mjs';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {createVehicle} from './district/models.js';
import {createRefinedVehicle} from './city-vehicles.mjs';
import {createVulnerableActor,animateActor} from './sind-actors.mjs';
import {buildDistrict} from './city-district.mjs';
import {textPanel} from './district/materials.js';
import {sampleTrack,sampleSignals,upperBound} from './sind-clock.mjs';
import {flowAt,loopTime} from './city-flow.mjs';
import {prepareObservation,observationOpacity,observationHull} from './city-observation.mjs';
import {motorTypes} from './sind-prediction.mjs';
import {overviewView} from './city-view.mjs';
import {createCityDashboard} from './city-dashboard.mjs';
const $=id=>document.getElementById(id),scene=new THREE.Scene();
scene.background=new THREE.Color(0xc4dbe5);scene.fog=new THREE.Fog(0xc4dbe5,260,620);
const renderer=new THREE.WebGLRenderer({canvas:$('scene'),antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputEncoding=THREE.sRGBEncoding;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.72;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
const room=new RoomEnvironment(),pmrem=new THREE.PMREMGenerator(renderer);scene.environment=pmrem.fromScene(room,.04).texture;room.dispose?.();pmrem.dispose();
const daylight=createDaylight(renderer),legacyEnvironment=scene.environment;
const hemisphere=new THREE.HemisphereLight(0xdceeff,0x8d9580,.5);scene.add(hemisphere);
const sun=new THREE.DirectionalLight(0xfff0d7,1.35);sun.castShadow=true;sun.shadow.mapSize.set(4096,4096);Object.assign(sun.shadow.camera,{left:-155,right:155,top:155,bottom:-155,near:1,far:420});sun.shadow.normalBias=.025;scene.add(sun,sun.target);
const camera=new THREE.PerspectiveCamera(48,1,.1,1300),controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.maxPolarAngle=Math.PI/2-.01;controls.minDistance=1.5;controls.maxDistance=440;
const objects=new Map(),pools=new Map(),pickable=[],cache=new Map(),clocks=new Map();
const selection=new THREE.BoxHelper(new THREE.Object3D(),0x88c9bb);selection.visible=false;scene.add(selection);
let followState={};
let current=null,time=0,last=performance.now(),playing=true,selected=null,following=false,transition=null,request=0,lastHUD=-1,views={},dimStatic=false,vehicleFilter=null,activeRisk=null;
const names={car:'轿车',bus:'公交车',truck:'货车',pedestrian:'行人',bicycle:'自行车',motorcycle:'摩托车',tricycle:'三轮车'};
const forecastGeometry=new THREE.BufferGeometry(),forecastLine=new THREE.Line(forecastGeometry,new THREE.LineBasicMaterial({color:0x55b9b0,depthTest:false}));forecastLine.renderOrder=12;forecastLine.visible=false;scene.add(forecastLine);
const forecastBuffer=new THREE.BufferAttribute(new Float32Array(93),3);forecastGeometry.setAttribute('position',forecastBuffer);forecastGeometry.setDrawRange(0,0);
function drawForecast(points){forecastLine.visible=points.length>0;points.forEach((p,i)=>forecastBuffer.setXYZ(i,p[1],.2,-p[2]));forecastBuffer.needsUpdate=true;forecastGeometry.setDrawRange(0,points.length);if(points.length)forecastGeometry.computeBoundingSphere();}
const riskMarkers=[0,1].map(()=>{const mesh=new THREE.Mesh(new THREE.RingGeometry(1.1,1.4,36),new THREE.MeshBasicMaterial({color:0xdfab71,side:THREE.DoubleSide,depthTest:false}));mesh.rotation.x=-Math.PI/2;mesh.visible=false;mesh.renderOrder=11;scene.add(mesh);return mesh;});
const riskPathsGeometry=new THREE.BufferGeometry(),riskPathsBuffer=new THREE.BufferAttribute(new Float32Array(12),3);riskPathsGeometry.setAttribute('position',riskPathsBuffer);riskPathsGeometry.setDrawRange(0,0);
const riskPaths=new THREE.LineSegments(riskPathsGeometry,new THREE.LineBasicMaterial({color:0xe1ab6a,depthTest:false}));riskPaths.renderOrder=11;riskPaths.visible=false;scene.add(riskPaths);
const riskBoxes=[0,1].map(()=>{const box=new THREE.BoxHelper(new THREE.Object3D(),0xe1ab6a);box.visible=false;box.material.transparent=true;scene.add(box);return box;});
function updateRiskBoxes(){riskBoxes.forEach((box,i)=>{const object=activeRisk&&objects.get([activeRisk.a.id,activeRisk.b.id][i]);box.visible=!!object&&object.visible;if(object){box.setFromObject(object);box.material.opacity=object.userData.opacity;}});}
function drawRisk(event,focus){
 activeRisk=event;riskPaths.visible=!!event;$('risk-inspection').hidden=!event;
 riskMarkers.forEach((m,i)=>{m.visible=!!event;if(event)m.position.set(event.centers[i][0],.17,-event.centers[i][1]);});
 if(event){const states=[event.a,event.b];states.forEach((s,i)=>{riskPathsBuffer.setXYZ(i*2,s.p[0],.21,-s.p[1]);riskPathsBuffer.setXYZ(i*2+1,s.p[0]+s.v[0]*3,.21,-s.p[1]-s.v[1]*3);});riskPathsBuffer.needsUpdate=true;riskPathsGeometry.setDrawRange(0,4);riskPathsGeometry.computeBoundingSphere();
 $('risk-inspection-text').textContent=`${names[event.a.type]} ${event.a.id.split('/').at(-1)} ↔ ${names[event.b.type]} ${event.b.id.split('/').at(-1)}\n预计 ${event.ttcS.toFixed(2)} 秒后包络接触\n橙线：双方恒速预测 · 圆环：接触时中心`;
 if(focus){selected=event.a.type==='pedestrian'||event.a.type==='bicycle'?event.b.id:event.a.id;$('object').hidden=false;const x=(event.a.p[0]+event.b.p[0])/2,z=-(event.a.p[1]+event.b.p[1])/2,span=Math.hypot(event.a.p[0]-event.b.p[0],event.a.p[1]-event.b.p[1]);following=false;transition=null;controls.target.set(x,0,z);camera.position.set(x+Math.max(23,span*.7),Math.max(28,span),z+Math.max(27,span*.7));lastHUD=-1e6;}}
 updateRiskBoxes();
}
const dashboard=createCityDashboard({forecast:drawForecast,risk:drawRisk,filter:type=>{vehicleFilter=type;const g=objects.get(selected);if(type&&g?.userData.track.type!==type){selected=null;following=false;selection.visible=false;$('object').hidden=true;drawForecast([]);}if(type)drawRisk(null,false);if(current&&objects.size)updateParticipants();lastHUD=-1e6;}});

function createParticipant(track){
 const humanSample=['pedestrian','bicycle','motorcycle','tricycle'].includes(track.type),humanVariant=humanVariantForTrack(track.id);
 const poolKey=humanSample?'human-'+track.type+'-'+humanVariant:usesRefinedPresentation(current.config.city)&&['car','bus','truck'].includes(track.type)?'refined-'+track.type:track.type;
 const pool=pools.get(poolKey)||[];let g=pool.pop();
 if(!g){
  const visual=humanSample?(track.type==='pedestrian'?createHumanWalker(humanVariant):attachHumanRider(createVulnerableActor(track.type,{rider:false}),humanVariant,track.type)):poolKey.startsWith('refined-')?createRefinedVehicle(track.type):['car','bus','truck'].includes(track.type)?createVehicle({id:track.id,subType:track.type,displayLabel:'城市公交'},pickable.length):createVulnerableActor(track.type);
  const bounds=humanSample?posedBounds(visual):new THREE.Box3().setFromObject(visual,true),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
  visual.position.set(-center.x,-bounds.min.y,-center.z);
  const paints=new Set(),clones=new Map(),fadeMaterials=[];visual.traverse(o=>{if(!o.material)return;const clone=original=>{if(!clones.has(original)){const copy=original.clone();copy.transparent=true;clones.set(original,copy);fadeMaterials.push({material:copy,opacity:original.opacity,depthWrite:original.depthWrite});if(copy.isMeshPhysicalMaterial)paints.add(copy);}return clones.get(original);};o.material=Array.isArray(o.material)?o.material.map(clone):clone(o.material);});
  g=new THREE.Group();g.add(visual);g.userData={...visual.userData,nominalSize:size,paints,fadeMaterials,poolKey};scene.add(g);pickable.push(g);
 }
 g.scale.set(1,poolKey==='refined-truck'?THREE.MathUtils.clamp(track.length/7,.74,1.14):1,1);
 if(track.type!=='pedestrian'){g.scale.x=track.length/g.userData.nominalSize.x;g.scale.z=track.width/g.userData.nominalSize.z;}
 const palette=[0xe4e2d8,0x486777,0x9eaaa9,0x333e46,0x857367];
 let hash=0;for(const ch of track.id)hash=(hash*31+ch.charCodeAt(0))>>>0;
 for(const paint of g.userData.paints)paint.color.setHex(track.type==='bus'?0xbacac1:track.type==='truck'?0xd3d4ca:palette[hash%palette.length]);
 g.userData.track=track;g.userData.lastPoseTime=-Infinity;g.visible=true;objects.set(track.id,g);return g;
}

function release(){for(const g of objects.values()){g.visible=false;const type=g.userData.poolKey;if(!pools.has(type))pools.set(type,[]);pools.get(type).push(g);}objects.clear();}
function updateParticipants(){
 for(const [id,g]of objects)if(!sampleTrack(g.userData.track,time)){g.visible=false;objects.delete(id);const type=g.userData.poolKey;if(!pools.has(type))pools.set(type,[]);pools.get(type).push(g);}
 for(const track of current.data.tracks){const s=sampleTrack(track,time);if(!s)continue;const g=objects.get(track.id)||createParticipant(track),speed=Math.hypot(s[3],s[4]),opacity=observationOpacity(track.observationSegments,time)*(dimStatic&&speed<.5?.18:1);const inspecting=selected===track.id||!!activeRisk&&[activeRisk.a.id,activeRisk.b.id].includes(track.id);g.visible=opacity>.005&&(!vehicleFilter||track.type===vehicleFilter)&&(!current.hideParked||!track.presentationStatic||inspecting);g.userData.opacity=opacity;for(const entry of g.userData.fadeMaterials){entry.material.opacity=entry.opacity*opacity;entry.material.depthWrite=opacity>.98&&entry.depthWrite;}g.position.set(s[1],0,-s[2]);g.rotation.y=track.type==='pedestrian'?Math.atan2(s[4],s[3]):s[5];const k=Math.max(0,upperBound(track.samples,time)-1),a=track.samples[k];const distance=camera.position.distanceTo(g.position),near=updateVehicleDetail(g,distance,inspecting),now=performance.now();if(g.visible&&(near||now-g.userData.lastPoseTime>=100)){animateActor(g,track.distance[k]+Math.hypot(s[1]-a[1],s[2]-a[2]),Math.hypot(s[3],s[4]));g.userData.lastPoseTime=now;}}
 const object=objects.get(selected);selection.visible=!!object&&object.visible;if(object){selection.material.transparent=true;selection.material.opacity=object.userData.opacity;selection.setFromObject(object);}
 else if(selected){selected=null;following=false;$('object').hidden=true;drawForecast([]);}
 if(activeRisk&&(!objects.has(activeRisk.a.id)||!objects.has(activeRisk.b.id)))drawRisk(null,false);updateRiskBoxes();
}
function updateHUD(){
 const states=sampleSignals(current.config.signals,time);
 for(const h of current.district.signalHeads)for(let i=0;i<3;i++){const on=states?.[h.id-1]===[0,3,1][i];h.bulbs[i].emissiveIntensity=on?2:0;h.bulbs[i].color.setHex(on?[0xe83b30,0xf4b830,0x38ae62][i]:0x17211c);}
 if(Math.abs(time-lastHUD)<150)return;lastHUD=time;
 const stats=flowAt(current.config,time);$('flow-recent').textContent=stats.recent;$('flow-total').textContent=`本轮累计 ${stats.total} 辆`;
 for(const a of current.config.approaches){const c=stats.approaches[a.id],row=$('approach-'+a.id);row.querySelector('em').textContent=`${c.recent} / ${c.total}`;row.querySelector('i').style.width=Math.min(100,c.recent/Math.max(1,stats.recent)*100)+'%';}
 current.config.signalLabels.forEach((_,i)=>{const el=$('signal-'+i),s=states?.[i];el.dataset.state=s??'';el.querySelector('b').textContent=({0:'红',1:'绿',3:'黄'})[s]||'未记录';});
 const snapshot=dashboard.update(current.data,current.config,time,objects.get(selected)?.userData.track);$('focus-moving').disabled=![...objects.values()].some(g=>{if(!g.visible||!motorTypes.includes(g.userData.track.type))return false;const s=sampleTrack(g.userData.track,time);return s&&Math.hypot(s[3],s[4])>=.5;});const obj=objects.get(selected);if(obj){const t=obj.userData.track,s=sampleTrack(t,time);$('object-title').textContent=names[t.type]||'交通参与者';$('object-info').textContent=`编号 ${t.id.split('/').at(-1)} · 速度 ${(Math.hypot(s[3],s[4])*3.6).toFixed(1)} 千米/时`;}
 $('scene').dataset.time=time.toFixed(1);$('scene').dataset.active=objects.size;$('scene').dataset.fading=[...objects.values()].filter(g=>g.userData.opacity>0&&g.userData.opacity<.98).length;$('scene').dataset.city=current.config.city;
}
function setViews(config,featured){
 const [x,y]=config.center,c=[x,0,-y],b=featured.bounds,bx=(b[0]+b[2])/2,bz=-(b[1]+b[3])/2,side=featured.front==='north'?-1:1;
 views={overview:overviewView(config),junction:{p:[x+46,32,-y+51],t:[x,1,-y]},overhead:{p:[x,225,-y+.1],t:c},sample:{p:[bx+30,15,bz+side*35],t:[bx,6,bz]},street:{p:[bx+8,1.7,bz+side*18],t:[bx-9,2,bz+side*11]}};
}
function view(name,instant=false){if(!views[name])return;following=false;const v=views[name];if(instant){camera.position.fromArray(v.p);controls.target.fromArray(v.t);controls.update();}else transition={start:performance.now(),p:camera.position.clone(),t:controls.target.clone(),endP:new THREE.Vector3(...v.p),endT:new THREE.Vector3(...v.t)};document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===name));}
function thumbnails(){
 const size=renderer.getSize(new THREE.Vector2()),ratio=renderer.getPixelRatio(),aspect=camera.aspect;renderer.setPixelRatio(1);renderer.setSize(280,160,false);camera.aspect=280/160;camera.updateProjectionMatrix();const auto=renderer.shadowMap.autoUpdate;renderer.shadowMap.autoUpdate=false;
 const p=camera.position.clone(),t=controls.target.clone(),thumb=document.createElement('canvas');thumb.width=280;thumb.height=160;const ctx=thumb.getContext('2d');
 for(const b of document.querySelectorAll('[data-view]')){const v=views[b.dataset.view];camera.position.fromArray(v.p);controls.target.fromArray(v.t);controls.update();renderer.render(scene,camera);ctx.drawImage(renderer.domElement,0,0,280,160);b.querySelector('img').src=thumb.toDataURL('image/jpeg',.8);}
 renderer.setPixelRatio(ratio);renderer.setSize(size.x,size.y,false);camera.aspect=aspect;camera.updateProjectionMatrix();renderer.shadowMap.autoUpdate=auto;camera.position.copy(p);controls.target.copy(t);controls.update();renderer.render(scene,camera);
}
async function json(url){const r=await fetch(url);if(!r.ok)throw Error('城市数据加载失败');return r.json();}
async function loadCity(entry){
 const token=++request;$('loading').hidden=false;$('loading').textContent=`正在加载${entry.name}的道路与街区…`;
 try{
  await loadHumanAssets();if(token!==request)return;
  let cached=cache.get(entry.id);if(!cached){const [config,data]=await Promise.all([json(entry.scene),json(entry.tracks)]);if(token!==request)return;
   for(const t of data.tracks){t.presentationStatic=config.city==='chongqing'&&isLongStatic(t);t.observationSegments=prepareObservation(t);t.distance=new Float32Array(t.samples.length);for(let i=1;i<t.samples.length;i++){const a=t.samples[i-1],b=t.samples[i];t.distance[i]=t.distance[i-1]+(b[0]-a[0]>250?0:Math.hypot(b[1]-a[1],b[2]-a[2]));}}
   const observedRadius=data.tracks.reduce((r,t)=>t.samples.reduce((v,s)=>Math.max(v,Math.hypot(s[1]-config.center[0],s[2]-config.center[1])+(t.type==='pedestrian'?.4:Math.hypot(t.length,t.width)/2)),r),0);const district=buildDistrict(scene,config,observedRadius),labels=new THREE.Group();district.root.add(labels);labels.visible=false;
   for(const a of config.approaches){const [x,y]=a.center;textPanel(labels,a.name,x,2.5,-y,7,1.3,{background:'#163342',color:'#d8f7ed'});}
   const hull=observationHull(data.tracks),boundaryPoints=hull.map(p=>new THREE.Vector3(p[0],.095,-p[1]));if(boundaryPoints.length){boundaryPoints.push(boundaryPoints[0].clone());const boundary=new THREE.Line(new THREE.BufferGeometry().setFromPoints(boundaryPoints),new THREE.LineDashedMaterial({color:0x5d9c8c,transparent:true,opacity:.8,dashSize:1.2,gapSize:.7}));boundary.computeLineDistances();district.root.add(boundary);}
   cached={config,data,district,labels,hideParked:config.city==='chongqing',start:config.city==='chongqing'?busyStart(data.tracks,config.durationMs):0};cache.set(entry.id,cached);
  }
  if(token!==request)return;if(current)clocks.set(current.config.city,time);release();for(const c of cache.values())c.district.root.visible=false;current=cached;current.district.root.visible=true;
  const refined=usesRefinedPresentation(entry.id);scene.background=refined?daylight.sky:new THREE.Color(0xc4dbe5);scene.environment=refined?daylight.environment:legacyEnvironment;
  renderer.toneMappingExposure=refined?.83:.72;hemisphere.intensity=refined?.38:.5;sun.intensity=refined?1.7:1.35;sun.shadow.normalBias=refined?.008:.025;sun.shadow.bias=refined?-.00006:0;
  const shadowSpan=refined?105:155;Object.assign(sun.shadow.camera,{left:-shadowSpan,right:shadowSpan,top:shadowSpan,bottom:-shadowSpan});sun.shadow.camera.updateProjectionMatrix();
  time=clocks.get(entry.id)??current.start;$('parked-visibility').hidden=entry.id!=='chongqing';$('parked-visibility').setAttribute('aria-pressed',String(!current.hideParked));$('parked-visibility').textContent=current.hideParked?'显示长期静止车辆':'隐藏长期静止车辆';const initial=new URLSearchParams(location.search).get('start');if(initial&&!clocks.size)time=loopTime(Number(initial)||0,current.config.durationMs);
  selected=null;following=false;transition=null;selection.visible=false;dashboard.reset();$('object').hidden=true;$('city-name').textContent=entry.name;
  document.querySelectorAll('[data-city]').forEach(b=>b.classList.toggle('active',b.dataset.city===entry.id));
  $('approaches').innerHTML='<div class="caption">进口方向<span style="float:right">近六十秒 / 累计</span></div>'+current.config.approaches.map(a=>`<div class="direction" id="approach-${a.id}"><span>${a.name}</span><em>—</em><div class="bar"><i></i></div></div>`).join('');
  $('signals').innerHTML=current.config.signalLabels.map((s,i)=>`<span class="signal" id="signal-${i}"><i></i>${s} · <b></b></span>`).join('');
  $('flow-layer').setAttribute('aria-pressed',String(current.labels.visible));
  const [x,y]=current.config.center;sun.position.set(x-80,180,-y+95);sun.target.position.set(x,0,-y);if(refined){if(!current.reflection)current.reflection=daylight.capture(scene,current.config.center);scene.environment=current.reflection.texture;}setViews(current.config,current.district.featured);view('overview',true);lastHUD=-1e6;updateParticipants();updateHUD();$('loading').hidden=true;last=performance.now();thumbnails();
  const expected=current;setTimeout(()=>{if(current===expected&&!transition)thumbnails();},1800);
 }catch(e){if(token===request){$('loading').hidden=false;$('loading').textContent=e.message;}console.error(e);}
}
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>view(b.dataset.view));
$('play').onclick=()=>{playing=!playing;$('play').textContent=playing?'暂停':'继续';lastHUD=-1e6;if(current)updateHUD();};
$('reset').onclick=()=>view('overview');$('flow-layer').onclick=()=>{if(!current)return;current.labels.visible=!current.labels.visible;$('flow-layer').setAttribute('aria-pressed',String(current.labels.visible));};
$('dismiss').onclick=()=>{selected=null;following=false;selection.visible=false;$('object').hidden=true;drawForecast([]);};
$('parked-visibility').onclick=()=>{if(!current)return;current.hideParked=!current.hideParked;$('parked-visibility').setAttribute('aria-pressed',String(!current.hideParked));$('parked-visibility').textContent=current.hideParked?'显示长期静止车辆':'隐藏长期静止车辆';updateParticipants();lastHUD=-1e6;updateHUD();};
$('dim-static').onclick=()=>{dimStatic=!dimStatic;$('dim-static').setAttribute('aria-pressed',String(dimStatic));if(current)updateParticipants();};
$('toggle-charts').onclick=()=>{const hidden=document.body.classList.toggle('charts-hidden');$('toggle-charts').setAttribute('aria-pressed',String(!hidden));};
$('home-prediction-model').onchange=()=>{lastHUD=-1e6;if(current)updateHUD();};
$('follow').onclick=()=>{const g=objects.get(selected);if(!g)return;transition=null;following=true;followState={};};
$('focus-moving').onclick=()=>{const active=[...objects.values()].filter(g=>g.visible&&motorTypes.includes(g.userData.track.type)).map(g=>({g,s:sampleTrack(g.userData.track,time)})).filter(o=>o.s&&Math.hypot(o.s[3],o.s[4])>=.5).sort((a,b)=>Math.hypot(b.s[3],b.s[4])-Math.hypot(a.s[3],a.s[4]));if(!active.length)return;selected=active[0].g.userData.track.id;$('object').hidden=false;$('follow').click();lastHUD=-1e6;updateHUD();};
$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{}};
$('capture').onclick=()=>{renderer.render(scene,camera);renderer.domElement.toBlob(blob=>{if(!blob)return;const a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;a.download=`${current?.config.name||'城市'}交通.png`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});};
let down;renderer.domElement.addEventListener('pointerdown',e=>{transition=null;following=false;down=[e.clientX,e.clientY];});
renderer.domElement.addEventListener('pointerup',e=>{if(!down||Math.hypot(e.clientX-down[0],e.clientY-down[1])>5)return;const ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2(e.clientX/innerWidth*2-1,1-e.clientY/innerHeight*2),camera);const hit=ray.intersectObjects(pickable.filter(g=>g.visible&&g.userData.opacity>.05),true)[0];if(hit){let g=hit.object;while(g&&!g.userData.track)g=g.parent;selected=g.userData.track.id;$('object').hidden=false;lastHUD=-1e6;updateHUD();}});
function resize(){renderer.setSize(innerWidth,innerHeight,false);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();}addEventListener('resize',resize);resize();
function animate(now){requestAnimationFrame(animate);const dt=Math.min(200,now-last);last=now;if(current){if(playing)time=loopTime(time+dt,current.config.durationMs);updateParticipants();updateHUD();}if(transition){const f=Math.min(1,(now-transition.start)/850),ease=f*f*(3-2*f);camera.position.lerpVectors(transition.p,transition.endP,ease);controls.target.lerpVectors(transition.t,transition.endT,ease);if(f===1)transition=null;}if(following&&objects.get(selected)?.visible)followVehicle(camera,controls.target,objects.get(selected),dt/1000,followState);controls.update();if(current)focusDaylightShadow(sun,camera,controls.target);renderer.render(scene,camera);}requestAnimationFrame(animate);
try{const catalog=await json('/data/sind/cities/catalog.json');for(const c of catalog){const b=document.createElement('button');b.textContent=c.name;b.dataset.city=c.id;b.onclick=()=>loadCity(c);$('cities').append(b);}await loadCity(catalog.find(c=>c.id===new URLSearchParams(location.search).get('city'))||catalog[0]);}catch(e){$('loading').textContent=e.message;console.error(e);}

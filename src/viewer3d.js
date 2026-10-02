import * as THREE from "three";
import {OrbitControls} from "three/addons/controls/OrbitControls.js";
import {RoomEnvironment} from "three/addons/environments/RoomEnvironment.js";
import {createEnvironment} from "./district/environment.js";
import {createVehicle,createSignals} from "./district/models.js";
export class SemanticTwin3D{
 constructor(canvas){
 this.canvas=canvas;this.entityObjects=new Map();this.mapConstructed=false;this.keys=new Set();this.mode="overview";this.clock=new THREE.Clock();this.pickables=[];this.lastFrame=performance.now();this.frameCount=0;
 this.scene=new THREE.Scene();this.scene.background=new THREE.Color(0xc9dbe1);this.scene.fog=new THREE.Fog(0xc9dbe1,220,650);
 this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:"high-performance"});
 this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));this.renderer.outputEncoding=THREE.sRGBEncoding;
 this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=.72;
 this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 this.camera=new THREE.PerspectiveCamera(48,1,.12,1600);this.camera.position.set(104,98,123);
 this.controls=new OrbitControls(this.camera,canvas);this.controls.target.set(0,0,0);this.controls.enableDamping=true;this.controls.maxPolarAngle=Math.PI/2-.025;this.controls.minDistance=4;this.controls.maxDistance=470;
 this.scene.add(new THREE.HemisphereLight(0xd6e6ed,0x8c8b70,.55));
 this.sun=new THREE.DirectionalLight(0xfff0d5,1.35);this.sun.position.set(-80,145,75);this.sun.castShadow=true;
 const shadow=this.sun.shadow;shadow.mapSize.set(4096,4096);shadow.camera.left=-130;shadow.camera.right=130;shadow.camera.top=130;shadow.camera.bottom=-130;shadow.camera.near=1;shadow.camera.far=400;shadow.normalBias=.025;shadow.bias=-.00005;this.scene.add(this.sun);this.scene.add(this.sun.target);
 const pmrem=new THREE.PMREMGenerator(this.renderer),room=new RoomEnvironment();this.env=pmrem.fromScene(room,.04);this.scene.environment=this.env.texture;pmrem.dispose();room.dispose?.();
 this.selection=new THREE.BoxHelper(new THREE.Mesh(new THREE.BoxGeometry(1,1,1)),0xd6a652);this.selection.visible=false;this.scene.add(this.selection);
 this.resize=()=>{const w=canvas.clientWidth,h=canvas.clientHeight;this.renderer.setSize(w,h,false);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();};window.addEventListener("resize",this.resize);this.resize();
 this.bindInput();this.animate();
 }
 bindInput(){
 document.querySelectorAll("[data-view]").forEach(b=>b.addEventListener("click",()=>this.setView(b.dataset.view)));
 document.getElementById("scene-export")?.addEventListener("click",()=>{this.renderer.render(this.scene,this.camera);this.canvas.toBlob(blob=>{if(!blob)return;const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="qinghe-"+this.mode+".png";a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);},"image/png");});
 document.getElementById("scene-clean")?.addEventListener("click",()=>document.body.classList.toggle("scene-clean"));
 document.getElementById("scene-data")?.addEventListener("click",()=>{this.dataVisible=!this.dataVisible;if(this.trafficOverlay)this.trafficOverlay.visible=this.dataVisible;document.getElementById("scene-data").setAttribute("aria-pressed",String(!!this.dataVisible));});
 document.querySelectorAll(".dock-btn").forEach(b=>b.addEventListener("click",()=>document.body.classList.add("analysis-open")));
 document.getElementById("close-analysis")?.addEventListener("click",()=>document.body.classList.remove("analysis-open"));
 window.addEventListener("keydown",e=>{if(e.target.matches("input,textarea"))return;if(["KeyW","KeyA","KeyS","KeyD","ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(e.code)&&this.mode==="street")e.preventDefault();this.keys.add(e.code);if(e.code==="Escape"){document.body.classList.remove("scene-clean","analysis-open");if(this.mode==="street")this.setView("overview");}});
 window.addEventListener("keyup",e=>this.keys.delete(e.code));window.addEventListener("blur",()=>this.keys.clear());
 let pointer=null;
 this.canvas.addEventListener("pointerdown",e=>{pointer={x:e.clientX,y:e.clientY};this.drag=pointer;});
 this.canvas.addEventListener("pointermove",e=>{if(this.mode==="street"&&e.buttons&&this.drag){this.yaw-=(e.clientX-this.drag.x)*.003;this.pitch=THREE.MathUtils.clamp(this.pitch-(e.clientY-this.drag.y)*.003,-1.2,1.2);this.drag={x:e.clientX,y:e.clientY};}});
 this.canvas.addEventListener("pointerup",e=>{this.drag=null;if(!pointer||Math.hypot(pointer.x-e.clientX,pointer.y-e.clientY)>5)return;
 const rect=this.canvas.getBoundingClientRect(),ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1),this.camera);
 const hit=ray.intersectObjects(this.pickables,true)[0];if(hit){let obj=hit.object;while(obj&&!obj.userData.entityId)obj=obj.parent;if(obj){this.canvas.dispatchEvent(new CustomEvent("entity-pick",{detail:obj.userData.entityId}));document.body.classList.add("inspecting");}}
 });
 }
 buildMap(map){
 if(!map?.layout||this.mapConstructed)return;
 const environment=createEnvironment(this.scene,map.layout);this.environment=environment.group;this.colliders=environment.colliders;
 this.signals=createSignals(this.scene);this.pickables.push(...this.signals.poles);
 this.mapConstructed=true;
 this.trafficOverlay=new THREE.Group();this.trafficOverlay.visible=false;this.scene.add(this.trafficOverlay);this.roadOverlays=new Map();
 for(const road of map.roads){const [a,b]=road.points,len=Math.hypot(a[0]-b[0],a[1]-b[1]);const m=new THREE.Mesh(new THREE.PlaneGeometry(len-34,.75),new THREE.MeshBasicMaterial({color:0x3caa93,transparent:true,opacity:.8,depthWrite:false}));m.rotation.x=-Math.PI/2;m.rotation.z=Math.atan2(-(b[1]-a[1]),b[0]-a[0]);m.position.set((a[0]+b[0])/2,.065,(a[1]+b[1])/2);this.trafficOverlay.add(m);this.roadOverlays.set(road.id,m);}
 this.updateMapState(map);document.getElementById("scene-loading")?.classList.add("hidden");
 }
 updateMapState(map){
 this.playback=map.meta?.playback;
 if(!map.signalState||!this.signals)return;const s=map.signalState;
 for(const [a,color]of Object.entries(s.approaches)){
 for(const bulbs of this.signals.heads[a])bulbs.forEach((m,i)=>{const on=["red","yellow","green"][i]===color;m.color.setHex(on?[0xad291b,0xdca529,0x29915b][i]:0x17201c);m.emissiveIntensity=on?2.6:0;});
 const el=document.getElementById("lamp-"+a);if(el){el.dataset.color=color;el.querySelector("strong").textContent=({red:"红灯",green:"通行",yellow:"黄灯"})[color];}
 }
 document.getElementById("phase-seconds").textContent=s.remaining+" s";
 document.getElementById("scene-vehicles").textContent=map.fleet.length;
 document.getElementById("scene-queue").textContent=map.fleet.filter(v=>v.status==="queued").length;
 }
 updateEntities(entities,selectedId,visibleIds,filterActive){
 this.selectedId=selectedId;const visible=new Set(visibleIds);
 for(const e of entities){if(e.type!=="vehicle")continue;
 let obj=this.entityObjects.get(e.id);
 if(!obj){obj=createVehicle(e,this.entityObjects.size);this.entityObjects.set(e.id,obj);this.scene.add(obj);this.pickables.push(obj);}
 const p=e.geometry.position,now=performance.now();const target=new THREE.Vector3(p.x,0,p.y);
 if(!obj.userData.to||obj.userData.generation!==e.motion?.generation||obj.position.distanceTo(target)>35){obj.position.copy(target);obj.rotation.y=e.motion?.heading||0;}
 obj.userData.from=obj.position.clone();obj.userData.to=target;obj.userData.receivedAt=now;
 obj.userData.generation=e.motion?.generation;obj.userData.motion=e.motion;
 obj.visible=!filterActive||visible.has(e.id);
 }
 const selected=this.entityObjects.get(selectedId);this.selection.visible=!!selected&&selected.visible;
 if(selected)this.selection.setFromObject(selected);
 }
 updateRoadMetrics(metrics){for(const [id,mesh]of this.roadOverlays||[]){const load=metrics[id]?.load||0;mesh.material.color.setHex(load>.7?0xcb5b41:load>.35?0xd1a449:0x439781);}}
 focusEntity(id){const obj=this.entityObjects.get(id);if(!obj)return;this.mode="detail";this.controls.enabled=true;this.fly={position:obj.position.clone().add(new THREE.Vector3(-12,7,13)),target:obj.position.clone()};}
 setView(mode){
 this.mode=mode;this.controls.enabled=mode!=="street";this.keys.clear();this.fly=null;
 document.querySelectorAll("[data-view]").forEach(b=>b.classList.toggle("active",b.dataset.view===mode));
 const hint=document.getElementById("scene-hint");hint.textContent=mode==="street"?"拖动观察 · WASD 行走 · Esc 返回总览":"拖动旋转 · 滚轮缩放 · 点击车辆查看详情";
 if(mode==="street"){this.camera.position.set(-19,1.84,32);this.yaw=-.32;this.pitch=.025;document.body.classList.add("scene-clean");}
 else{document.body.classList.remove("scene-clean");
 const views={overview:[[104,98,123],[0,0,0]],junction:[[-48,32,50],[0,0,0]],shop:[[-22,4,38],[-44,2,33]]};
 const v=views[mode]||views.overview;this.fly={position:new THREE.Vector3(...v[0]),target:new THREE.Vector3(...v[1])};
 }
 }
 moveStreet(dt){
 const forward=new THREE.Vector3(-Math.sin(this.yaw),0,-Math.cos(this.yaw)),right=new THREE.Vector3(Math.cos(this.yaw),0,-Math.sin(this.yaw)),v=new THREE.Vector3();
 if(this.keys.has("KeyW")||this.keys.has("ArrowUp"))v.add(forward);if(this.keys.has("KeyS")||this.keys.has("ArrowDown"))v.sub(forward);
 if(this.keys.has("KeyD")||this.keys.has("ArrowRight"))v.add(right);if(this.keys.has("KeyA")||this.keys.has("ArrowLeft"))v.sub(right);
 if(v.lengthSq()){v.normalize().multiplyScalar(dt*(this.keys.has("ShiftLeft")?8:3));const pos=this.camera.position.clone().add(v);
 if(Math.abs(pos.x)<190&&Math.abs(pos.z)<190&&!this.colliders?.some(b=>pos.x>b.minX-.35&&pos.x<b.maxX+.35&&pos.z>b.minZ-.35&&pos.z<b.maxZ+.35)){this.camera.position.copy(pos);}
 }
 this.camera.position.y=1.84;this.camera.rotation.order="YXZ";this.camera.rotation.set(this.pitch,this.yaw,0);
 }
 animate(){
 requestAnimationFrame(()=>this.animate());const dt=Math.min(this.clock.getDelta(),.05),now=performance.now();
 for(const o of this.entityObjects.values()){
 const u=o.userData;if(u.to){const t=THREE.MathUtils.clamp((now-u.receivedAt)/100,0,1);o.position.lerpVectors(u.from,u.to,t);}
 if(u.motion){const difference=THREE.MathUtils.euclideanModulo(u.motion.heading-o.rotation.y+Math.PI,Math.PI*2)-Math.PI;o.rotation.y+=difference*Math.min(1,dt*16);
 if(this.playback==="running")for(const wheel of u.wheels)wheel.rotation.z-=u.motion.speed*dt/.34;
 u.brake.emissiveIntensity=u.motion.braking?1.4:.16;u.indicator.emissiveIntensity=u.motion.turning&&u.motion.turn!=="straight"&&Math.floor(now/400)%2?2:0;
 }
 }
 if(this.mode==="street")this.moveStreet(dt);else{
 if(this.fly){this.camera.position.lerp(this.fly.position,dt*4);this.controls.target.lerp(this.fly.target,dt*4);if(this.camera.position.distanceTo(this.fly.position)<.08)this.fly=null;}
 this.controls.update();
 }
 if(this.selection.visible){const obj=this.entityObjects.get(this.selectedId);if(obj)this.selection.setFromObject(obj);}
 this.renderer.render(this.scene,this.camera);
 this.frameCount++;if(now-this.lastFrame>1000){document.getElementById("scene-fps").textContent=Math.round(this.frameCount*1000/(now-this.lastFrame))+" FPS";this.frameCount=0;this.lastFrame=now;}
 }
}


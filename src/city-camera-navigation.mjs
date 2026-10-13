import * as THREE from 'three';

// Scale both the eye and orbit centre around the pointed-at world position.
// The anchor keeps the same screen projection instead of drifting toward the junction.
export function zoomAroundPoint(camera,target,point,factor,minDistance,maxDistance){
 const distance=camera.position.distanceTo(target);
 if(distance<1e-6)return;
 const scale=THREE.MathUtils.clamp(distance*factor,minDistance,maxDistance)/distance;
 camera.position.sub(point).multiplyScalar(scale).add(point);
 target.sub(point).multiplyScalar(scale).add(point);
}
export function attachCityNavigation({camera,controls,canvas,scene,onManual=()=>{},onFocus}){
 const ray=new THREE.Raycaster(),pointer=new THREE.Vector2(),keys=new Set(),ground=new THREE.Plane(new THREE.Vector3(0,1,0),0);
 canvas.tabIndex=0;canvas.style.outline='none';
 canvas.title='左键拖动旋转；右键或中键拖动平移；滚轮缩放鼠标指向区域；双击切换观察中心；方向键移动，翻页键升降';
 controls.screenSpacePanning=true;controls.mouseButtons.MIDDLE=THREE.MOUSE.PAN;
 const visible=o=>{for(let p=o;p;p=p.parent)if(!p.visible)return false;return true;};
 function pointAt(event){
  const rect=canvas.getBoundingClientRect();pointer.set((event.clientX-rect.left)/rect.width*2-1,1-(event.clientY-rect.top)/rect.height*2);ray.setFromCamera(pointer,camera);
  const meshes=[];scene.traverse(o=>{if(o.isMesh&&visible(o)&&!o.isSprite&&(o.material?.depthWrite!==false||o.isWater))meshes.push(o);});
  const hit=ray.intersectObjects(meshes,false)[0];
  if(hit)return hit.point;
  ground.constant=-controls.target.y;
  return ray.ray.intersectPlane(ground,new THREE.Vector3())||controls.target.clone();
 }
 canvas.addEventListener('pointerdown',()=>{canvas.focus({preventScroll:true});keys.clear();onManual();});
 canvas.addEventListener('wheel',event=>{
  event.preventDefault();event.stopImmediatePropagation();onManual();
  const delta=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?canvas.clientHeight:1);
  zoomAroundPoint(camera,controls.target,pointAt(event),Math.exp(THREE.MathUtils.clamp(delta,-200,200)*.0015),controls.minDistance,controls.maxDistance);
  controls.update();
 },{passive:false,capture:true});
 canvas.addEventListener('dblclick',event=>{
  event.preventDefault();onManual();const target=pointAt(event),offset=camera.position.clone().sub(controls.target);
  const distance=THREE.MathUtils.clamp(offset.length()*.55,8,70),eye=target.clone().add(offset.normalize().multiplyScalar(distance));
  if(onFocus)onFocus(eye,target);else{camera.position.copy(eye);controls.target.copy(target);controls.update();}
 });
 const navigationKeys=new Set(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','PageUp','PageDown','KeyW','KeyA','KeyS','KeyD','KeyQ','KeyE']);
 canvas.addEventListener('keydown',event=>{if(!navigationKeys.has(event.code)||event.ctrlKey||event.metaKey||event.altKey)return;event.preventDefault();keys.add(event.code);onManual();});
 window.addEventListener('keyup',event=>keys.delete(event.code));window.addEventListener('blur',()=>keys.clear());canvas.addEventListener('blur',()=>keys.clear());
 return {update(dt){
  if(!keys.size)return;
  const forward=camera.getWorldDirection(new THREE.Vector3());forward.y=0;if(forward.lengthSq()<.0001)forward.set(0,0,-1);forward.normalize();
  const right=new THREE.Vector3().crossVectors(forward,new THREE.Vector3(0,1,0)),move=new THREE.Vector3();
  const pressed=(...codes)=>codes.some(code=>keys.has(code));
  if(pressed('ArrowUp','KeyW'))move.add(forward);if(pressed('ArrowDown','KeyS'))move.sub(forward);
  if(pressed('ArrowRight','KeyD'))move.add(right);if(pressed('ArrowLeft','KeyA'))move.sub(right);
  if(pressed('PageUp','KeyE'))move.y+=1;if(pressed('PageDown','KeyQ'))move.y-=1;
  const speed=THREE.MathUtils.clamp(camera.position.distanceTo(controls.target)*.45,3,100);
  move.normalize().multiplyScalar(speed*Math.min(dt,.1));camera.position.add(move);controls.target.add(move);
 }};
}

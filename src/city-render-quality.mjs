import * as THREE from 'three';

export function updateVehicleDetail(root,distance,inspect=false){
 const state=root.userData;
 if(!state.detailNodes){state.detailNodes=[];root.traverse(o=>{if(['vehicle-near-detail','vehicle-far-detail'].includes(o.name))state.detailNodes.push(o);});}
 const near=inspect||distance<(state.nearDetail===false?65:80);
 if(near!==state.nearDetail){for(const o of state.detailNodes)o.visible=o.name==='vehicle-near-detail'?near:!near;state.nearDetail=near;}
 return near;
}

export function followVehicle(camera,target,object,dt,state){
 const desired=object.position.clone().add(new THREE.Vector3(0,.7,0));
 const jump=state.last&&state.last.distanceTo(object.position)>35;
 const blend=1-Math.exp(-4*Math.min(dt,.2));
 const heading=object.quaternion.clone();if(!state.heading||jump)state.heading=heading;else state.heading.slerp(heading,blend*.65);
 const offset=new THREE.Vector3(-10,6,10).applyQuaternion(state.heading);
 const end=desired.clone().add(offset);
 if(jump){camera.position.copy(end);target.copy(desired);}else{camera.position.lerp(end,blend);target.lerp(desired,blend);}
 state.last=object.position.clone();
}

export function focusDaylightShadow(sun,camera,target){
 const distance=camera.position.distanceTo(target),span=THREE.MathUtils.clamp(distance*.8,42,105);
 // Quantized focus reduces movement of shadow texels during a slow camera pan.
 const step=2*span/4096,x=Math.round(target.x/step)*step,z=Math.round(target.z/step)*step;
 sun.target.position.set(x,0,z);sun.position.set(x-80,180,z+95);
 if(Math.abs(sun.shadow.camera.right-span)>.5){Object.assign(sun.shadow.camera,{left:-span,right:span,top:span,bottom:-span});sun.shadow.camera.updateProjectionMatrix();}
}

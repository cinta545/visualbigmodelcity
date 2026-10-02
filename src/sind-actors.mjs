import * as THREE from 'three';
const cache=new Map();
function material(color){if(!cache.has(color))cache.set(color,new THREE.MeshStandardMaterial({color,roughness:.72}));return cache.get(color);}
const metal=material(0x394644),rubber=material(0x222b2b),skin=material(0xc09877);
function mesh(parent,geometry,mat,position){const m=new THREE.Mesh(geometry,mat);m.position.set(...position);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
function bar(parent,a,b,r,mat){const from=new THREE.Vector3(...a),to=new THREE.Vector3(...b),delta=to.clone().sub(from);const m=mesh(parent,new THREE.CylinderGeometry(r,r,delta.length(),8),mat,from.clone().add(to).multiplyScalar(.5).toArray());m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());return m;}
function box(parent,size,position,mat){return mesh(parent,new THREE.BoxGeometry(...size),mat,position);}
export function createVulnerableActor(type){
 const root=new THREE.Group(),shirt=material(type==='pedestrian'?0x4e766a:0x556f86),trousers=material(0x41464a);
 const head=new THREE.SphereGeometry(.12,14,10);
 if(type==='pedestrian'){
  mesh(root,new THREE.CapsuleGeometry(.16,.34,4,10),shirt,[0,1.13,0]);
  mesh(root,head,skin,[.015,1.63,0]);
  mesh(root,new THREE.SphereGeometry(.122,12,8,0,Math.PI*2,0,Math.PI*.5),material(0x3b352f),[.015,1.67,0]);
  const limbs=[];
  for(const side of [-1,1]){
   const leg=new THREE.Group();leg.position.set(0,.86,side*.10);root.add(leg);
   bar(leg,[0,0,0],[0,-.7,0],.065,trousers);box(leg,[.25,.10,.12],[.055,-.74,0],rubber);limbs.push({part:leg,side,amount:.38});
   const arm=new THREE.Group();arm.position.set(0,1.38,side*.21);root.add(arm);
   bar(arm,[0,0,0],[0,-.48,0],.046,shirt);mesh(arm,new THREE.SphereGeometry(.047,8,6),skin,[0,-.52,0]);limbs.push({part:arm,side:-side,amount:.26});
  }
  root.userData.limbs=limbs;return root;
 }
 const motor=type==='motorcycle',tricycle=type==='tricycle',paint=material(motor?0x526a71:tricycle?0x7b8a78:0xb18549),wheels=[];
 const radius=motor?.29:.32;
 const positions=tricycle?[[-.62,radius,-.4],[-.62,radius,.4],[.64,radius,0]]:[[-.65,radius,0],[.65,radius,0]];
 for(const position of positions){
  const wheel=new THREE.Group();wheel.position.set(...position);root.add(wheel);
  mesh(wheel,new THREE.TorusGeometry(radius,motor?.085:.033,8,24),rubber,[0,0,0]);
  mesh(wheel,new THREE.TorusGeometry(radius-.045,.012,6,20),metal,[0,0,0]);
  for(let i=0;i<8;i++){const angle=i*Math.PI/4;bar(wheel,[0,0,0],[Math.cos(angle)*(radius-.055),Math.sin(angle)*(radius-.055),0],.006,metal);}
  wheels.push(wheel);
 }
 for(const [a,b]of [[[-.65,radius,0],[-.15,.85,0]],[[-.15,.85,0],[0,.38,0]],[[0,.38,0],[-.65,radius,0]],[[-.15,.85,0],[.45,.9,0]],[[.45,.9,0],[0,.38,0]],[[.45,.9,0],[.65,radius,0]],[[.45,.9,0],[.49,1.1,0]]])bar(root,a,b,motor?.045:.025,paint);
 bar(root,[.49,1.1,-.25],[.49,1.1,.25],.02,metal);
 box(root,[.35,.08,.22],[-.18,.96,0],rubber);
 if(motor){box(root,[.45,.24,.36],[.16,.73,0],paint);box(root,[.62,.17,.3],[-.42,.7,0],paint);mesh(root,new THREE.SphereGeometry(.075,12,8),material(0xe3ddbe),[.53,.98,0]);}
 if(tricycle){box(root,[.7,.42,.82],[-.66,.66,0],paint);box(root,[.59,.04,.69],[-.66,.89,0],material(0x685444));}
 // Rider pose is a visual approximation; motion still comes exclusively from data.
 bar(root,[-.18,1.05,0],[.08,1.38,0],.14,shirt);mesh(root,head,skin,[.16,1.57,0]);
 if(motor)mesh(root,new THREE.SphereGeometry(.145,12,8,0,Math.PI*2,0,Math.PI*.6),material(0xd5d6c9),[.16,1.62,0]);
 for(const side of [-1,1]){
  bar(root,[.02,1.33,side*.16],[.49,1.1,side*.23],.045,shirt);
  bar(root,[-.17,1,side*.11],[.18,.7,side*.14],.065,trousers);
  bar(root,[.18,.7,side*.14],[0,.43,side*.15],.05,trousers);
  box(root,[.22,.075,.1],[.04,.42,side*.15],rubber);
 }
 root.userData.wheels=wheels;root.userData.wheelRadius=radius;return root;
}

export function animateActor(root,distance,speed){
 for(const wheel of root.userData.wheels||[])wheel.rotation.z=-distance/(root.userData.wheelRadius||.34);
 const phase=distance*Math.PI*2/1.35;
 for(const limb of root.userData.limbs||[])limb.part.rotation.z=speed>.1?Math.sin(phase)*limb.side*limb.amount:0;
}

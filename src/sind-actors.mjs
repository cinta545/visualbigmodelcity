import {addSmallVehicleBody} from './city-small-vehicles.mjs';
import * as THREE from 'three';
const cache=new Map();
function material(color){if(!cache.has(color))cache.set(color,new THREE.MeshStandardMaterial({color,roughness:.72}));return cache.get(color);}
const metal=material(0x394644),rubber=material(0x222b2b),skin=material(0xc09877);
function mesh(parent,geometry,mat,position){const m=new THREE.Mesh(geometry,mat);m.position.set(...position);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
function bar(parent,a,b,r,mat){const from=new THREE.Vector3(...a),to=new THREE.Vector3(...b),delta=to.clone().sub(from);const m=mesh(parent,new THREE.CylinderGeometry(r,r,delta.length(),8),mat,from.clone().add(to).multiplyScalar(.5).toArray());m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());return m;}
function box(parent,size,position,mat){return mesh(parent,new THREE.BoxGeometry(...size),mat,position);}
function rounded(parent,size,position,mat){const m=mesh(parent,new THREE.SphereGeometry(1,16,12),mat,position);m.scale.set(...size);return m;}
function face(root,position,helmet=false){
 const [x,y,z]=position;rounded(root,[.106,.139,.105],[x,y,z],skin);
 mesh(root,new THREE.SphereGeometry(helmet?.13:.108,16,10,0,Math.PI*2,0,Math.PI*.58),material(helmet?0xd3d6cc:0x302c29),[x-.012,y+.045,z]);
 rounded(root,[.027,.031,.023],[x+.105,y-.015,z],skin);
 for(const side of [-1,1])rounded(root,[.025,.037,.018],[x,y-.007,z+side*.106],skin);
}
export function createVulnerableActor(type,{rider=true}={}){
 const root=new THREE.Group(),shirt=material(type==='pedestrian'?0x4e766a:0x556f86),trousers=material(0x41464a);
 if(type==='pedestrian'){
  const torso=mesh(root,new THREE.CapsuleGeometry(.16,.31,6,14),shirt,[0,1.17,0]);torso.scale.set(.8,1,1.15);
  rounded(root,[.125,.125,.17],[0,.91,0],trousers);bar(root,[0,1.44,0],[0,1.52,0],.055,skin);face(root,[.012,1.64,0]);
  bar(root,[.129,1.04,0],[.129,1.36,0],.006,material(0x8caaa0));
  const limbs=[];
  for(const side of [-1,1]){
   const leg=new THREE.Group();leg.position.set(0,.86,side*.10);root.add(leg);
   bar(leg,[0,0,0],[.016,-.34,0],.068,trousers);rounded(leg,[.065,.072,.065],[.016,-.34,0],trousers);
   const shin=new THREE.Group();shin.position.set(.016,-.34,0);leg.add(shin);bar(shin,[0,0,0],[0,-.34,0],.052,trousers);rounded(shin,[.145,.057,.073],[.048,-.395,0],rubber);box(shin,[.23,.025,.14],[.045,-.438,0],material(0x858582));limbs.push({part:leg,side,amount:.34,knee:shin});
   const arm=new THREE.Group();arm.position.set(0,1.38,side*.21);root.add(arm);
   bar(arm,[0,0,0],[.015,-.25,0],.048,shirt);bar(arm,[.015,-.25,0],[.07,-.46,0],.038,shirt);rounded(arm,[.04,.06,.035],[.073,-.50,0],skin);limbs.push({part:arm,side:-side,amount:.22});
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
  if(motor||tricycle){
   for(const side of [-1,1]){
    mesh(wheel,new THREE.TorusGeometry(radius-.02,.008,6,32),material(0x505b59),[0,0,side*(motor?.071:.025)]);
    const hub=mesh(wheel,new THREE.CylinderGeometry(.06,.06,.035,16),metal,[0,0,side*.04]);hub.rotation.x=Math.PI/2;
   }
  }
  wheels.push(wheel);
 }
 for(const [a,b]of [[[-.65,radius,0],[-.15,.85,0]],[[-.15,.85,0],[0,.38,0]],[[0,.38,0],[-.65,radius,0]],[[-.15,.85,0],[.45,.9,0]],[[.45,.9,0],[0,.38,0]],[[.45,.9,0],[.65,radius,0]],[[.45,.9,0],[.49,1.1,0]]])bar(root,a,b,motor?.045:.025,paint);
 bar(root,[.49,1.1,-.25],[.49,1.1,.25],.02,metal);
 if(!motor&&!tricycle)box(root,[.35,.08,.22],[-.18,.96,0],rubber);
 for(const side of [-1,1]){bar(root,[.45,.9,side*.055],[.65,radius,side*.055],motor?.027:.017,metal);bar(root,[.49,1.1,side*.17],[.49,1.1,side*.27],.026,rubber);}
 for(const x of [-.65,.65]){const fender=mesh(root,new THREE.TorusGeometry(radius+.042,.019,6,28,Math.PI),paint,[x,radius,0]);fender.scale.z=motor?3.2:1.6;}
 bar(root,[-.33,.93,0],[-.43,.88,0],.017,metal);rounded(root,[.027,.037,.062],[-.44,.88,0],material(0xa92e28));
 if(!motor&&!tricycle){
  mesh(root,new THREE.TorusGeometry(.115,.013,6,24),metal,[0,.38,.06]);
  for(const y of [.285,.475])bar(root,[-.65,radius,.06],[0,y,.06],.009,metal);
  const crank=new THREE.Group();crank.position.set(0,.38,0);root.add(crank);for(const side of [-1,1]){bar(crank,[0,0,side*.075],[side*.13,0,side*.075],.012,metal);box(crank,[.10,.027,.09],[side*.13,0,side*.12],rubber);}root.userData.crank=crank;
 }
 if(motor||tricycle)addSmallVehicleBody(root,type);
 if(motor||tricycle)for(const side of [-1,1]){const spread=motor?.24:.21;bar(root,[.04,.36,0],[.04,.36,side*spread],.017,metal);box(root,[.24,.035,.12],[.10,.37,side*spread],rubber);}
 if(!rider){root.userData.wheels=wheels;root.userData.wheelRadius=radius;return root;}
 // Rider pose is a visual approximation; motion still comes exclusively from data.
 bar(root,[-.18,1.05,0],[.08,1.38,0],.13,shirt);face(root,[.16,1.57,0],motor);
 for(const side of [-1,1]){
  bar(root,[.02,1.33,side*.16],[.25,1.13,side*.20],.047,shirt);bar(root,[.25,1.13,side*.20],[.49,1.1,side*.23],.035,shirt);rounded(root,[.042,.037,.035],[.49,1.1,side*.23],skin);
  const thigh=bar(root,[-.17,1,side*.11],[.18,.7,side*.14],.065,trousers);
  const shin=bar(root,[.18,.7,side*.14],[0,.43,side*.15],.05,trousers);
  const shoe=box(root,[.22,.075,.1],[.04,.42,side*.15],rubber);
  if(!motor&&!tricycle){root.userData.pedalLegs??=[];root.userData.pedalLegs.push({side,thigh,shin,shoe,thighLength:Math.hypot(.35,-.3,.03),shinLength:Math.hypot(-.18,-.27,.01)});}
 }
 root.userData.wheels=wheels;root.userData.wheelRadius=radius;return root;
}

export function animateActor(root,distance,speed){
 root.userData.animateHuman?.(distance,speed);
 for(const wheel of root.userData.wheels||[])wheel.rotation.z=-distance/(root.userData.wheelRadius||.34);
 const phase=distance*Math.PI*2/1.35;
 for(const limb of root.userData.limbs||[]){limb.part.rotation.z=speed>.1?Math.sin(phase)*limb.side*limb.amount:0;if(limb.knee)limb.knee.rotation.z=speed>.1?Math.max(0,-Math.sin(phase)*limb.side)*.45:0;}
 if(root.userData.crank){const angle=-distance*Math.PI*2/4.1;root.userData.crank.rotation.z=angle;
  for(const leg of root.userData.pedalLegs||[]){const hip=new THREE.Vector3(-.17,1,leg.side*.12),foot=new THREE.Vector3(leg.side*.13*Math.cos(angle),.38+leg.side*.13*Math.sin(angle),leg.side*.12),delta=foot.clone().sub(hip),d=delta.length(),a=(.42*.42-.40*.40+d*d)/(2*d),h=Math.sqrt(Math.max(0,.42*.42-a*a)),dir=delta.clone().normalize(),knee=hip.clone().addScaledVector(dir,a).add(new THREE.Vector3(-dir.y,dir.x,0).multiplyScalar(h));
   for(const [part,start,end,length]of [[leg.thigh,hip,knee,leg.thighLength],[leg.shin,knee,foot,leg.shinLength]]){const v=end.clone().sub(start);part.position.copy(start).add(end).multiplyScalar(.5);part.scale.y=v.length()/length;part.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize());}leg.shoe.position.copy(foot).add(new THREE.Vector3(.035,.043,0));
  }
 }
}

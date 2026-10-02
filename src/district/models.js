import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import {box,cylinder,mat,textPanel} from "./materials.js";
const wheelGeo=new THREE.CylinderGeometry(.34,.34,.23,20);
const hubGeo=new THREE.CylinderGeometry(.21,.21,.245,12);
const tire=mat(0x222728,.94),chrome=mat(0xb9c3c3,.25,.78),glass=mat(0x294650,.17,.45);
const palette=[0xe4e2d8,0x486777,0x9eaaa9,0xd9d6cc,0x333e46,0x857367,0xb5bdbd,0x637565];
function rounded(g,x,y,z,w,h,d,m,r=.14){
 const mesh=new THREE.Mesh(new RoundedBoxGeometry(w,h,d,3,r),m);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;g.add(mesh);return mesh;
}
function sideWindow(g,pts,z){
 const s=new THREE.Shape();pts.forEach((p,i)=>i?s.lineTo(...p):s.moveTo(...p));s.closePath();
 const m=new THREE.Mesh(new THREE.ShapeGeometry(s),glass);m.position.z=z;m.material.side=THREE.DoubleSide;g.add(m);
}
export function createVehicle(entity,index){
 const g=new THREE.Group(),bus=entity.subType==="bus",truck=entity.subType==="truck",suv=entity.subType==="suv";
 const length=bus?11:truck?7:4.6,width=bus?2.5:truck?2.3:1.82;
 const body=new THREE.MeshPhysicalMaterial({color:bus?0xbacac1:truck?0xd3d4ca:palette[index%palette.length],roughness:.3,metalness:.38,clearcoat:.8,clearcoatRoughness:.23});
 const brake=new THREE.MeshStandardMaterial({color:0x8e211b,emissive:0xff2114,emissiveIntensity:.2,roughness:.4});
 const indicator=new THREE.MeshStandardMaterial({color:0xc79839,emissive:0xffa400,emissiveIntensity:0});
 if(bus){
 rounded(g,0,1.65,0,length,2.5,width,body,.17);
 rounded(g,.1,2.2,0,length-.65,1.2,width+.025,glass,.09);
 for(let x=-4.3;x<4.8;x+=1.25)box(g,x,2.2,0,.085,1.2,width+.06,body);
 box(g,0,.94,0,length,.32,width+.02,mat(0x527f70));
 box(g,4.55,1.5,width/2+.025,1.1,2.35,.04,glass);
 textPanel(g,entity.displayLabel||"101 清和里",5.52,2.83,0,2,.35,{rotation:Math.PI/2,background:"#161c19",foreground:"#d9ba66",font:90});
 }else if(truck){
 rounded(g,2.35,1.35,0,2.25,1.85,width,body,.15);
 rounded(g,2.7,1.94,0,1.56,.73,width+.025,glass,.1);
 rounded(g,-1.2,1.8,0,4.25,2.65,width,mat(0xe1dfd4),.05);
 for(let x=-3;x<.8;x+=.42)box(g,x,1.8,width/2+.01,.035,2.4,.02,mat(0xbec3bc));
 }else{
 rounded(g,0,.73,0,length,.76,width,body,.2);
 rounded(g,.98,1.03,0,1.42,.16,width*.91,body,.08);
 const roofY=suv?1.76:1.55;
 const profile=new THREE.Shape();profile.moveTo(-1.52,1);profile.lineTo(-.96,roofY);profile.lineTo(.48,roofY);profile.lineTo(1.26,1.01);profile.closePath();
 const cabin=new THREE.Mesh(new THREE.ExtrudeGeometry(profile,{depth:width*.84,bevelEnabled:true,bevelSize:.06,bevelThickness:.04,bevelSegments:2,steps:1}),body);
 cabin.position.z=-width*.42;cabin.castShadow=true;g.add(cabin);
 for(const sign of [-1,1]){
 sideWindow(g,[[-1.33,1.07],[-.88,roofY-.1],[-.25,roofY-.1],[-.25,1.07]],sign*(width*.42+.065));
 sideWindow(g,[[-.13,1.07],[-.13,roofY-.1],[.43,roofY-.1],[1.06,1.07]],sign*(width*.42+.065));
 box(g,-.8,.93,sign*(width/2+.01),.2,.04,.045,chrome);
 box(g,.63,.93,sign*(width/2+.01),.2,.04,.045,chrome);
 rounded(g,.93,1.12,sign*(width/2+.15),.3,.15,.2,body,.05);
 box(g,-.34,.66,sign*(width/2+.009),.015,.36,.008,mat(0x636a68));
 }
 for(const [low,high] of [[1.32,.54],[-1.60,-1.04]]){
 const geometry=new THREE.BufferGeometry();geometry.setAttribute("position",new THREE.Float32BufferAttribute([low,1.09,-width*.39,low,1.09,width*.39,high,roofY+.08,width*.39,high,roofY+.08,-width*.39],3));geometry.setIndex([0,1,2,0,2,3]);geometry.computeVertexNormals();g.add(new THREE.Mesh(geometry,glass));
 }
 }
 const wheels=[];const axle=bus?3.6:truck?2.15:1.43,rScale=bus?1.3:truck?1.22:1;
 for(const x of [-axle,axle])for(const sign of [-1,1]){
 const wheel=new THREE.Group();wheel.position.set(x,.36*rScale,sign*(width/2-.04));wheel.scale.setScalar(rScale);
 const rubber=new THREE.Mesh(wheelGeo,tire);rubber.rotation.x=Math.PI/2;wheel.add(rubber);
 const hub=new THREE.Mesh(hubGeo,chrome);hub.rotation.x=Math.PI/2;wheel.add(hub);g.add(wheel);wheels.push(wheel);
 }
 for(const side of [-1,1]){
 rounded(g,length/2+.015,bus?1.05:.8,side*width*.32,.035,.14,width*.23,mat(0xe6e7cb,.2),.01);
 rounded(g,-length/2-.015,bus?1.2:.8,side*width*.34,.03,.17,width*.19,brake,.01);
 box(g,side>0?length/2:-length/2,.78,width*.42,.04,.08,.15,indicator);
 }
 box(g,length/2+.026,.5,0,.02,.18,.63,mat(0x628176));
 box(g,-length/2-.026,.5,0,.02,.18,.63,mat(0x628176));
 box(g,length/2+.018,.65,0,.03,.16,width*.36,mat(0x313a3b));
 g.userData={entityId:entity.id,type:"vehicle",wheels,brake,indicator,length};return g;
}
export function createSignals(scene){
 const root=new THREE.Group();scene.add(root);const heads={};const poles=[];
 for(const [approach,angle,lanes,half] of [["W",0,3,11.5],["E",Math.PI,3,11.5],["N",-Math.PI/2,2,8],["S",Math.PI/2,2,8]]){
 const g=new THREE.Group();g.rotation.y=angle;root.add(g);g.userData.entityId="SC-CORE";
 const steel=mat(0x8b9491,.35,.75);cylinder(g,-22,3.15,half+1.4,.13,6.3,steel,16);
 box(g,-22,.3,half+1.4,.5,.6,.5,0x92968e);
 const arm=cylinder(g,-22,6.1,half/2+.7,.085,half+1.4,steel,12);arm.rotation.x=Math.PI/2;
 heads[approach]=[];
 for(let lane=0;lane<lanes;lane++){
 const z=2.75+lane*3.5;
 box(g,-22,5.53,z,.32,1.28,.48,mat(0x232b2a));
 const bulbs=[];
 for(let i=0;i<3;i++){
 const y=5.93-i*.4;const color=[0xf33728,0xffbc36,0x28c775][i];
 const material=new THREE.MeshStandardMaterial({color:0x15201c,emissive:color,emissiveIntensity:0,roughness:.4});
 const lamp=new THREE.Mesh(new THREE.CircleGeometry(.145,24),material);lamp.rotation.y=-Math.PI/2;lamp.position.set(-22.168,y,z);g.add(lamp);bulbs.push(material);
 const hood=new THREE.Mesh(new THREE.CylinderGeometry(.175,.175,.3,20,1,true,0,Math.PI*1.15),mat(0x27302d));
 hood.rotation.z=Math.PI/2;hood.position.set(-22.29,y+.03,z);g.add(hood);
 }
 heads[approach].push(bulbs);
 }
 poles.push(g);
 }
 return {root,heads,poles};
}


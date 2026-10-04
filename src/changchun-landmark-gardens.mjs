import * as THREE from 'three';
import {box,cylinder} from './district/materials.js';
import {landmarkMaterial} from './changchun-landmark-materials.mjs';

const stone=landmarkMaterial(0xd9d3bf,.86,'stone'),blue=landmarkMaterial(0x345970,.62,'glaze'),bronze=landmarkMaterial(0x667263,.6,'paint'),gold=landmarkMaterial(0xb99851,.68,'glaze');
const water=new THREE.MeshStandardMaterial({color:0x456c77,roughness:.23,metalness:.25});
function rod(root,a,b,r,m=stone){
 const p=new THREE.Vector3(...a),q=new THREE.Vector3(...b),delta=q.clone().sub(p);
 const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r,r,delta.length(),10),m);
 mesh.position.copy(p.add(q).multiplyScalar(.5));mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);
}
function star(root,x,y,z,r,material){
 const shape=new THREE.Shape();for(let i=0;i<10;i++){const a=Math.PI/2+i*Math.PI/5,rr=i%2?r*.43:r;const px=Math.cos(a)*rr,py=Math.sin(a)*rr;i?shape.lineTo(px,py):shape.moveTo(px,py);}shape.closePath();
 const mesh=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:.07,bevelEnabled:false}),material);mesh.position.set(x,y,z);root.add(mesh);
}
export function memorialTower(root){
 box(root,0,.08,0,15,.16,14,stone);
 for(let i=0;i<4;i++)box(root,0,.2+i*.21,0,8.2-i*.8,.23,6.9-i*.7,stone);
 box(root,0,2.15,0,3.9,2.75,3.4,stone);
 for(const x of [-3.45,3.45]){
  box(root,x,1.38,0,1.1,1.45,2.4,stone);box(root,x,2.47,0,.55,1.25,.65,stone);
  cylinder(root,x,3.15,0,.3,.15,stone,12);cylinder(root,x,3.32,0,.18,.23,stone,12);
 }
 for(let i=0;i<5;i++){
  const width=2.85-i*.31,base=3.42+i*2.18;
  box(root,0,base+1.1,0,width,2.2,width*.8,stone);
  for(const x of [-1,1])box(root,x*(width/2-.07),base+1.1,width*.4+.025,.09,2.17,.08,stone);
  box(root,0,base+.05,0,width+.08,.1,width*.8+.08,stone);
 }
 box(root,0,4.48,1.26,1.95,1.95,.17,stone);
 const wreath=new THREE.Mesh(new THREE.TorusGeometry(.48,.08,8,32),gold);wreath.position.set(0,4.5,1.39);root.add(wreath);star(root,0,4.5,1.41,.36,bronze);
 box(root,0,12.85,.70,.89,1.12,.12,bronze);star(root,0,12.85,.78,.39,gold);
 box(root,0,14.4,0,1.45,.24,1.25,stone);
 // Sculptural aircraft silhouette from the user's illustration; never a replay actor.
 const plane=new THREE.Group();plane.position.y=14.8;root.add(plane);
 const body=new THREE.Mesh(new THREE.SphereGeometry(1,16,10),bronze);body.scale.set(.20,.22,1.55);plane.add(body);
 box(plane,0,0,.04,4.15,.12,.61,bronze);box(plane,0,.10,-1.07,1.48,.10,.32,bronze);box(plane,0,.40,-1.08,.10,.72,.43,bronze);
 for(const x of [-.63,.63])box(plane,x,-.13,.16,.22,.24,.88,bronze);
}
function fence(root,a,b){
 const p=new THREE.Vector3(...a),q=new THREE.Vector3(...b),distance=p.distanceTo(q),count=Math.ceil(distance/.75);
 for(let i=0;i<=count;i++){
  const v=p.clone().lerp(q,i/count);cylinder(root,v.x,v.y+.5,v.z,.075,1,stone,10);
  const cap=new THREE.Mesh(new THREE.SphereGeometry(.12,10,8),stone);cap.position.set(v.x,v.y+1.04,v.z);root.add(cap);
 }
 for(const h of [.25,.83])rod(root,[a[0],a[1]+h,a[2]],[b[0],b[1]+h,b[2]],.045);
}
export function watersidePavilion(root){
 box(root,0,.08,-.7,17,.16,12.5,stone);box(root,0,.17,-.7,16.4,.05,11.9,water);
 cylinder(root,-2,.47,-1,3.35,.68,blue,8);cylinder(root,-2,.83,-1,3.55,.16,stone,8);
 // Octagonal pavilion with pale wall panels and arched window tracery.
 for(let i=0;i<8;i++){
  const a=i*Math.PI/4+Math.PI/8,b=a+Math.PI/4;
  const x=-2+Math.cos(a)*2.7,z=-1+Math.sin(a)*2.7;
  cylinder(root,x,2.65,z,.135,3.65,stone,12);box(root,x,4.38,z,.38,.22,.38,stone);
  rod(root,[x,4.22,z],[-2+Math.cos(b)*2.7,4.22,-1+Math.sin(b)*2.7],.13);
  if(i===1)continue;
  const aa=[x,.93,z],bb=[-2+Math.cos(b)*2.7,.93,-1+Math.sin(b)*2.7];fence(root,aa,bb);
  const face=new THREE.Group(),angle=(a+b)/2;
  face.position.set(-2+Math.cos(angle)*2.48,0,-1+Math.sin(angle)*2.48);face.rotation.y=Math.PI/2-angle;root.add(face);
  box(face,0,2.12,0,1.95,2.42,.15,stone);
  box(face,0,2.3,.092,.82,1.58,.035,blue);
  for(const xx of [-.45,.45])box(face,xx,2.26,.13,.065,1.6,.06,stone);
  box(face,0,2.28,.13,.045,1.55,.07,stone);box(face,0,2.36,.13,.84,.05,.07,stone);
  for(let j=0;j<12;j++){
   const t=j*Math.PI/12,u=(j+1)*Math.PI/12;
   rod(face,[Math.cos(t)*.45,2.73+Math.sin(t)*.45,.13],[Math.cos(u)*.45,2.73+Math.sin(u)*.45,.13],.035);
  }
  for(let j=0;j<12;j++){
   const t=j/12,u=(j+1)/12,arch=s=>2.85+Math.sin(s*Math.PI)*.86;
   rod(root,[THREE.MathUtils.lerp(aa[0],bb[0],t),arch(t),THREE.MathUtils.lerp(aa[2],bb[2],t)],[THREE.MathUtils.lerp(aa[0],bb[0],u),arch(u),THREE.MathUtils.lerp(aa[2],bb[2],u)],.045);
  }
 }
 const profile=[[3.6,4.48],[3.4,4.39],[2.85,4.57],[1.8,4.91],[.64,5.55],[.12,5.87]].map(([r,y])=>new THREE.Vector2(r,y));
 const roof=new THREE.Mesh(new THREE.LatheGeometry(profile,8),blue);roof.position.set(-2,0,-1);roof.material.side=THREE.DoubleSide;roof.castShadow=roof.receiveShadow=true;root.add(roof);
 for(let i=0;i<8;i++){
  const a=i*Math.PI/4;for(let j=1;j<profile.length;j++)rod(root,[-2+Math.sin(a)*profile[j-1].x,profile[j-1].y,-1+Math.cos(a)*profile[j-1].x],[-2+Math.sin(a)*profile[j].x,profile[j].y,-1+Math.cos(a)*profile[j].x],.045,stone);
 }
 cylinder(root,-2,6.32,-1,.06,1.06,stone,10);cylinder(root,-2,5.87,-1,.2,.28,stone,12);
 box(root,-2,.88,4.43,2.05,.23,5.3,stone);
 for(const x of [-3.04,-.96])fence(root,[x,1,1.86],[x,1,7.08]);
 for(let i=0;i<5;i++)box(root,-2,(.18+i*.16)/2,8.55-i*.32,2.4,.18+i*.16,.35,stone);
}

import {mergeBufferGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import * as THREE from 'three';
import {box,cylinder,mat,textPanel} from './district/materials.js';

import {landmarkMaterial,prepareLandmarkMaterials,landmarkSurfaceUV} from './changchun-landmark-materials.mjs';

import {memorialTower,watersidePavilion} from './changchun-landmark-gardens.mjs';

import {heritageTram} from './changchun-heritage-tram.mjs';

// Architectural interpretations of the supplied front-view illustration.
// Site positions and scale are designed, not the landmarks' actual coordinates.
export const changchunLandmarks={
 'changchun-0':{kind:'state',name:'伪满国务院旧址'},
 'changchun-1':{kind:'geology',name:'地质宫博物馆'},
 'changchun-2':{kind:'palace',name:'伪满皇宫博物院'},
 'changchun-3':{kind:'memorial',name:'苏军纪念塔'},
 'changchun-4':{kind:'pavilion',name:'日月湾亭阁'},
 'changchun-5':{kind:'tram',name:'54路复古有轨电车 · 静态展示'},
};
const stone=landmarkMaterial(0xd8c6a3,.87,'stone'),cream=landmarkMaterial(0xe0d6ba,.88,'plaster'),brick=landmarkMaterial(0x987253,.9,'brick'),dark=mat(0x324447,.42,.15),green=landmarkMaterial(0x315c4e,.67,'glaze'),yellow=landmarkMaterial(0xc99932,.59,'glaze'),red=landmarkMaterial(0x863b31,.78,'paint'),slate=landmarkMaterial(0x41494a,.73,'glaze'),plinth=landmarkMaterial(0xb7ac92,.93,'stone');
function bar(root,a,b,r,material){const from=new THREE.Vector3(...a),to=new THREE.Vector3(...b),d=to.clone().sub(from);const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r,r,d.length(),8),material);mesh.position.copy(from.add(to).multiplyScalar(.5));mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);}
function windowBay(root,x,y,z,w,h,frame=stone){
 const sign=z<0?-1:1;
 box(root,x,y,z,w+.16,h+.16,.13,frame);box(root,x,y,z+sign*.075,w,h,.035,dark);
 box(root,x,y,z+sign*.10,.045,h,.035,frame);box(root,x,y+.1,z+sign*.10,w,.045,.035,frame);
 box(root,x,y-h/2-.1,z+sign*.13,w+.26,.09,.28,frame);
}
function windows(root,x0,x1,levels,z,w=.48,h=1.04,frame=stone){
 const count=Math.max(2,Math.floor((x1-x0)/1.12));for(const y of levels)for(let i=0;i<count;i++)windowBay(root,x0+(i+.5)*(x1-x0)/count,y,z,w,h,frame);
}
function column(root,x,z,base,height,r=.18,material=stone){
 box(root,x,base+.1,z,r*3,.2,r*3,material);cylinder(root,x,base+height/2,z,r,height-.25,material,16);
 for(const yy of [base+.25,base+height-.25]){
  const collar=new THREE.Mesh(new THREE.TorusGeometry(r*1.06,r*.12,6,16),material);collar.rotation.x=Math.PI/2;collar.position.set(x,yy,z);root.add(collar);
 }
 box(root,x,base+height-.10,z,r*2.8,.18,r*2.8,material);box(root,x,base+height+.02,z,r*3.3,.10,r*3.3,material);
}
function steps(root,x,z,width,height,count=5){for(let i=0;i<count;i++)box(root,x,height*(i+.5)/count,z-i*.29,width,height/count,.31+(count-1-i)*.58,stone);}

// Curved hip roof with upturned corners, rolled tile courses and a raised ridge.
function roof(root,x,z,width,depth,y,rise,material){
 const vertices=[],indices=[],samples=20;
 const rings=[[1,1,0],[.88,.88,.035],[.69,.48,.52],[.54,.025,1]];
 for(let r=0;r<rings.length;r++){
  const [sx,sz,up]=rings[r];
  for(let side=0;side<4;side++)for(let i=0;i<samples;i++){
   const t=i/samples,corners=[[-1,-1],[1,-1],[1,1],[-1,1]],a=corners[side],b=corners[(side+1)%4];
   const xx=THREE.MathUtils.lerp(a[0],b[0],t),zz=THREE.MathUtils.lerp(a[1],b[1],t),curl=r===0?.19+.30*Math.pow(Math.abs(t*2-1),7):0;
   vertices.push(x+xx*width*sx/2,y+up*rise+curl,z+zz*depth*sz/2);
  }
 }
 const n=samples*4;for(let r=0;r<3;r++)for(let j=0;j<n;j++){const a=r*n+j,b=r*n+(j+1)%n,c=b+n,d=a+n;indices.push(a,c,b,a,d,c);}
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geo.setIndex(indices);geo.computeVertexNormals();
 const m=new THREE.Mesh(geo,material);m.material.side=THREE.DoubleSide;m.castShadow=m.receiveShadow=true;root.add(m);
 // Visible tiles follow each roof slope rather than a flat painted roof texture.
 for(const side of [-1,1])for(let xx=-width*.45;xx<=width*.45;xx+=.25){
  const curve=new THREE.CurvePath();const points=rings.map(([sx,sz,up],i)=>new THREE.Vector3(x+xx*sx,y+up*rise+(i===0?.19+.30*Math.pow(Math.abs(xx/(width/2)),7):0)+.018,z+side*depth*sz/2));
  for(let j=1;j<points.length;j++)curve.add(new THREE.LineCurve3(points[j-1],points[j]));
  const tile=new THREE.Mesh(new THREE.TubeGeometry(curve,12,.014,4,false),material);root.add(tile);
 }
 bar(root,[x-width*.29,y+rise+.06,z],[x+width*.29,y+rise+.06,z],.065,material);
 for(const side of [-1,1])bar(root,[x+side*width*.29,y+rise+.06,z],[x+side*width*.30,y+rise+.29,z],.06,material);
 for(const side of [-1,1])box(root,x,y-.02,z+side*depth*.44,width*.9,.12,.17,stone);
 // Recessed fascia, shallow brackets and round tile-end caps under the eaves.
 for(const side of [-1,1]){
  box(root,x,y-.14,z+side*depth*.43,width*.88,.10,.19,material);
  for(let xx=-width*.4;xx<=width*.4;xx+=.48){
   box(root,x+xx,y-.20,z+side*depth*.43,.09,.14,.30,stone);
   const cap=new THREE.Mesh(new THREE.SphereGeometry(.04,8,6),material);cap.position.set(x+xx,y+.18,z+side*depth*.5);cap.scale.set(1,1,.4);root.add(cap);
  }
 }
}
function wing(root,x,width,h,roofMaterial,roofRise=1){
 box(root,x,h/2+.5,0,width,h,8,cream);box(root,x,.38,0,width+.2,.75,8.2,plinth);
 windows(root,x-width/2+.2,x+width/2-.2,[2,4.1],4.04,.5,1.2);
 windows(root,x-width/2+.2,x+width/2-.2,[2,4.1],-4.09,.5,1.2);
 roof(root,x,0,width+.55,8.6,h+.5,roofRise,roofMaterial);
}
function stateBuilding(root){
 for(const side of [-1,1]){
  const x=side*7.7;box(root,x,3.3,0,7.9,5.8,8,brick);box(root,x,.42,0,8,.8,8.15,stone);
  windows(root,x-3.6,x+3.6,[2,3.9,5.6],4.045,.38,1.05);windows(root,x-3.6,x+3.6,[2,3.9,5.6],-4.08,.38,1.05);
  box(root,x,5.65,0,8,1.05,8.1,cream);windows(root,x-3.6,x+3.6,[5.6],4.10,.38,.65);
  roof(root,x,0,8.2,8.5,6.3,.55,slate);
  box(root,side*11.2,3.3,0,.55,6,8.2,stone);
 }
 box(root,0,4.35,0,7.9,8.1,9.2,brick);box(root,0,.4,1,8.4,.8,10.8,stone);
 steps(root,0,7.8,8.5,.85,5);
 box(root,0,5.12,6.3,8.7,.45,3.2,stone);
 for(let x=-3.3;x<=3.4;x+=1.32)column(root,x,6.8,.8,4.05,.23);
 for(const x of [-2.55,0,2.55]){box(root,x,1.9,4.66,1.1,2.25,.12,dark);windowBay(root,x,3.78,4.7,.74,.9);}
 for(let i=0;i<4;i++)box(root,0,5.6+i*.44,5.65,8.25-i*1.05,.45,2.25-i*.17,stone);
 box(root,0,9.7,.15,4.5,4.4,4.7,brick);
 for(const x of [-2.08,2.08]){box(root,x,9.8,2.57,.34,4.2,.45,stone);box(root,x,7.7,2.6,.65,1.1,.8,stone);}
 for(const x of [-.62,0,.62])windowBay(root,x,9.9,2.55,.37,2.25);
 box(root,0,11.92,.15,4.8,.3,5,stone);roof(root,0,.15,5.25,5.5,12.15,.75,slate);
 roof(root,0,.15,4.45,4.65,13.12,1.05,slate);cylinder(root,0,14.38,.15,.105,.45,slate,12);
}
function geologyBuilding(root){
 for(const side of [-1,1]){
  wing(root,side*7.7,7.6,4.85,green,.85);
  box(root,side*7.7,3.63,5.15,7.3,.28,1.9,cream);
  for(let i=0;i<6;i++)column(root,side*7.7-3.1+i*1.24,5.6,.55,2.9,.14,cream);
 }
 box(root,0,3.75,0,7.6,6.6,9.3,cream);box(root,0,.36,0,8,.7,9.65,stone);
 for(const x of [-3.1,3.1])windows(root,x-.45,x+.45,[1.55,2.85,4.3,5.6],4.7,.4,.65);
 for(const floor of [.7,3.55]){
  for(const x of [-1.7,-.56,.56,1.7])column(root,x,5.15,floor,2.45,.125,red);
  for(const x of [-1.15,0,1.15])windowBay(root,x,floor+1.2,4.73,.68,1.85,red);
 }
 box(root,0,3.46,5.1,4.55,.16,1.35,stone);
 for(let i=0;i<9;i++)box(root,-2.08+i*.52,3.91,5.73,.055,.7,.055,green);
 for(const y of [3.65,4.2])box(root,0,y,5.73,4.3,.085,.08,green);
 roof(root,0,.1,8.4,10.2,7,1.55,green);
 steps(root,0,6.65,5.4,.65,4);
}
function palaceBuilding(root){
 box(root,0,3.5,0,16.5,6.1,9,cream);box(root,0,.44,0,16.9,.85,9.4,stone);
 for(const side of [-1,1])windows(root,side<0?-7.7:3.4,side<0?-3.4:7.7,[2.1,4.75],4.55,.67,1.55);
 windows(root,-7.8,7.8,[2.1,4.75],-4.57,.6,1.4);
 box(root,0,4,2.1,6.5,7.1,6.1,cream);roof(root,0,0,17.4,10,6.65,1.55,yellow);
 // Central triangular pediment over the projecting entrance.
 const shape=new THREE.Shape();shape.moveTo(-3.6,7);shape.lineTo(0,10.1);shape.lineTo(3.6,7);shape.closePath();
 const face=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:.25,bevelEnabled:false}),cream);face.position.z=5.45;face.castShadow=true;root.add(face);
 bar(root,[-3.8,7.02,5.7],[0,10.35,5.7],.13,yellow);bar(root,[0,10.35,5.7],[3.8,7.02,5.7],.13,yellow);
 box(root,0,7,5.65,7.6,.17,.6,stone);
 const emblem=new THREE.Mesh(new THREE.TorusGeometry(.23,.065,8,12),yellow);emblem.position.set(0,8.55,5.73);root.add(emblem);
 cylinder(root,0,10.48,5.7,.085,.32,yellow,10);
 box(root,0,2.02,5.85,5.25,3.3,1.65,stone);box(root,0,1.8,6.7,1.7,2.6,.12,mat(0x594834));
 for(const x of [-.48,.48])for(const y of [1.2,2.3])box(root,x,y,6.78,.67,.82,.035,mat(0x745f41));
 for(const x of [-1.12,1.12])box(root,x,1.83,6.77,.27,2.8,.25,cream);
 roof(root,0,5.85,6.1,2.7,3.8,.8,yellow);steps(root,0,8,5.4,.55,4);
 for(const x of [-1.7,0,1.7])windowBay(root,x,5.65,5.22,.55,.9);
}

function masonryCorners(root,x,z,height){
 for(let y=.9;y<height;y+=.42){
  const wide=Math.round(y/.42)%2===0;
  box(root,x,y,z,wide?.52:.34,.37,.16,stone);
 }
}
function railing(root,x,z0,z1,y0,y1){
 for(let i=0;i<4;i++){
  const t=i/3,z=THREE.MathUtils.lerp(z0,z1,t),y=THREE.MathUtils.lerp(y0,y1,t);
  column(root,x,z,y,.63,.046,stone);
 }
 bar(root,[x,y0+.7,z0],[x,y1+.7,z1],.045,stone);
}
function landmarkOrnaments(root,kind){
 if(kind==='state'){
  // Stepped stone shoulders around the central tower, seen in the reference.
  for(const sign of [-1,1]){
   const x=sign*3.05;
   box(root,x,7.06,4.78,1.28,.64,.8,stone);
   const profile=[[0,.0],[.36,0],[.36,.35],[.24,.55],[.22,1.15],[.13,1.38],[.13,1.53],[0,1.53]].map(p=>new THREE.Vector2(...p));
   const ornament=new THREE.Mesh(new THREE.LatheGeometry(profile,16),stone);ornament.position.set(x,7.36,4.78);ornament.castShadow=true;root.add(ornament);
   masonryCorners(root,sign*3.76,4.64,8.3);
   for(const y of [1.03,5.04,6.13])box(root,sign*7.7,y,4.14,7.6,.10,.21,stone);
  }
  for(let row=0;row<2;row++)for(let col=0;col<5;col++)box(root,-2+col,7.15+row*.5,4.68,.93,.43,.10,stone);
  for(const x of [-1.63,1.63])windowBay(root,x,10.1,2.56,.22,2.7,stone);
  for(const x of [-3.88,3.88])railing(root,x,8.35,6.6,.15,.78);
 }else if(kind==='geology'){
  // Repeated geometric balcony panels and layered lintels beneath the main eaves.
  for(let i=0;i<8;i++){
   const x=-1.82+i*.52;
   box(root,x,3.91,5.76,.36,.045,.035,stone);
   for(const dx of [-.16,.16])box(root,x+dx,3.91,5.76,.035,.31,.035,stone);
   for(const yy of [3.76,4.06])box(root,x,yy,5.76,.36,.035,.035,stone);
  }
  for(const x of [-1.7,-.56,.56,1.7]){
   box(root,x,6.22,5.17,.46,.13,.45,red);box(root,x,6.37,5.17,.64,.12,.57,stone);
  }
  for(const sign of [-1,1])for(const y of [.85,3.16,5.15])box(root,sign*7.7,y,4.12,7.45,.09,.16,stone);
  for(const x of [-2.48,2.48])railing(root,x,7.28,6.18,.12,.56);
 }else{
  for(const x of [-8.15,-3.12,3.12,8.15])masonryCorners(root,x,Math.abs(x)>4?4.61:5.22,6.65);
  for(const y of [.87,3.37,6.43]){
   box(root,0,y,4.61,16.65,.13,.20,stone);
   box(root,0,y,5.23,6.65,.13,.20,stone);
  }
  // A floral rosette and an inset second outline make the pediment readable nearby.
  bar(root,[-3.08,7.23,5.72],[0,9.92,5.72],.04,stone);bar(root,[0,9.92,5.72],[3.08,7.23,5.72],.04,stone);
  for(let i=0;i<8;i++){
   const angle=i*Math.PI/4,petal=new THREE.Mesh(new THREE.SphereGeometry(1,8,6),yellow);
   petal.scale.set(.065,.13,.035);petal.rotation.z=-angle;petal.position.set(Math.sin(angle)*.23,8.55+Math.cos(angle)*.23,5.78);root.add(petal);
  }
  for(const x of [-.11,.11])bar(root,[x,1.55,6.85],[x,1.93,6.85],.018,slate);
  for(const x of [-2.48,2.48])railing(root,x,8.65,7.32,.10,.50);
 }
}

export function createChangchunLandmark(parent,b){
 const spec=changchunLandmarks[b.id];if(!spec)return null;
 const root=new THREE.Group();root.name='长春特色建筑 · '+spec.name;
 ({state:stateBuilding,geology:geologyBuilding,palace:palaceBuilding,memorial:memorialTower,pavilion:watersidePavilion,tram:heritageTram})[spec.kind](root,{connectedRail:spec.kind==='tram'});
 const building=['state','geology','palace'].includes(spec.kind);
 if(building)landmarkOrnaments(root,spec.kind);
 const sideWidth=spec.kind==='palace'?16.5:23.5,sideLevels=spec.kind==='state'?[2,3.9,5.6]:[2,4.1];
 if(building)for(const sign of [-1,1]){
  const facade=new THREE.Group();windows(facade,-3.2,3.2,sideLevels,0,.48,1.0);facade.rotation.y=sign*Math.PI/2;facade.position.x=sign*(sideWidth/2+.02);root.add(facade);
 }

 // A small physical plaque gives context without claiming geographic accuracy.
 const signX=building?0:4.5,signY=building?.5:.75;
 if(!building&&spec.kind!=='tram'){
  box(root,signX,signY,8.71,3.8,.6,.15,stone);
  for(const dx of [-1.45,1.45])box(root,signX+dx,.31,8.71,.12,.62,.14,slate);
 }
 if(spec.kind!=='tram')textPanel(root,spec.name,signX,signY,8.8,3.6,.36,{background:'#52615a',font:130,proportional:true});
 prepareLandmarkMaterials(root);
 // Merge roof tiles, columns and other static non-instanced geometry by material.
 root.updateMatrixWorld(true);const groups=new Map(),remove=[];
 root.traverse(o=>{if(!o.isMesh||o.isInstancedMesh||o.geometry.type==='PlaneGeometry')return;const geo=(o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone()).applyMatrix4(o.matrixWorld);landmarkSurfaceUV(geo);if(!groups.has(o.material))groups.set(o.material,[]);groups.get(o.material).push(geo);remove.push(o);});
 const ownedGeometry=new Set(remove.filter(o=>o.geometry.type!=='BoxGeometry').map(o=>o.geometry));
 for(const o of remove)o.removeFromParent();for(const geometry of ownedGeometry)geometry.dispose();
 for(const [material,geometries]of groups){const mesh=new THREE.Mesh(mergeBufferGeometries(geometries,false),material);mesh.castShadow=mesh.receiveShadow=!material.transparent;root.add(mesh);for(const g of geometries)g.dispose();}
 const [x0,y0,x1,y1]=b.bounds;const scale=Math.min((x1-x0)/24,(y1-y0)/20);root.scale.set(scale,scale*(b.verticalBoost||1),scale);
 root.position.set((x0+x1)/2,b.baseHeight||0,-(y0+y1)/2);if(b.front==='north')root.rotation.y=Math.PI;if(b.rotation!==undefined)root.rotation.y=b.rotation;
 root.userData.landmark={...spec,designedPlacement:true};parent.add(root);return root;
}

import {windowReveal,roofServices,masonryFacade,lowHipRoof} from './city-building-detail.mjs';
import {addGrass,addFineFoliage} from './changchun-planting.mjs';
import {landmarkMaterial,prepareLandmarkMaterials,landmarkSurfaceUV} from './changchun-landmark-materials.mjs';
import * as THREE from 'three';
import {box,cylinder,mat,batchStatic,textPanel} from './district/materials.js';
import {addForecourtPaving} from './city-paving.mjs';
import {addStreetTrees} from './city-trees.mjs';

// A designed forest-city / heritage quarter, not a reconstruction of real sites.
const stone=mat(0xc9c0aa,.91),roof=mat(0x535b57,.88),glass=mat(0x586c6c,.36,.08);
const parkPlots=new Set([10,11,19,20,27,29,37,38]);
export function changchunContextProfile(index){
 return {park:parkPlots.has(index),height:index<16?8.4+(index%3)*2.8:index<27?11.2+(index%3)*2.8:16.8+(index%4)*2.8};
}
function window(root,x,y,z,w=1.02,h=1.45){
 windowReveal(root,x,y,z,w,h,stone,glass,1,.24);
}
export function changchunContextBuilding(parent,b,index){
 const profile=b.quarterRole?{park:b.quarterRole==='park',height:b.height}:changchunContextProfile(index);if(profile.park)return;
 const root=new THREE.Group(),h=profile.height,w=b.quarterRole?b.bounds[2]-b.bounds[0]-1:index<16?20:19,d=b.quarterRole?Math.max(8,b.bounds[3]-b.bounds[1]-4):13;
 const color=[0xb19d82,0xa58970,0xc2b7a0,0xa9ada1][index%4],wall=landmarkMaterial(color,.9,index%4<2?'brick':'plaster');
 // A recessed interior and four pierced masonry walls replace the solid building block.
 box(root,0,h/2,0,w-1.1,h,d-1.1,wall);box(root,0,.42,0,w+.2,.84,d+.2,stone);
 for(const side of [-1,1]){
  const facade=new THREE.Group();facade.rotation.y=side<0?Math.PI:0;root.add(facade);
  const shell=new THREE.Group();shell.position.z=d/2;facade.add(shell);const openings=[];
  for(let y=4.7;y<h-.8;y+=2.8)for(let x=-w/2+1.4;x<w/2-1;x+=2.05)openings.push({x,y,width:1.02,height:1.45});
  for(let x=-w/2+1.65;x<w/2-1;x+=2.75)openings.push({x,y:1.94,width:1.95,height:2.20});
  landmarkSurfaceUV(masonryFacade(shell,w,h,openings,wall).geometry);
  for(let y=4.7;y<h-.8;y+=2.8){for(let x=-w/2+1.4;x<w/2-1;x+=2.05)window(facade,x,y,d/2+.04);box(facade,0,y-1.15,d/2+.09,w,.10,.22,stone);}
  for(let x=-w/2+1.65;x<w/2-1;x+=2.75){window(facade,x,1.94,d/2+.07,1.95,2.20);box(facade,x,3.18,d/2+.43,2.35,.12,.8,roof);}
 }
 for(const side of [-1,1]){
  const facade=new THREE.Group();facade.position.x=side*w/2;facade.rotation.y=side*Math.PI/2;root.add(facade);
  const openings=[];for(let y=4.7;y<h-.8;y+=2.8)for(let x=-d/2+1.5;x<d/2-1;x+=2.2)openings.push({x,y,width:1.02,height:1.45});
  landmarkSurfaceUV(masonryFacade(facade,d,h,openings,wall).geometry);
  for(let y=4.7;y<h-.8;y+=2.8)for(let x=-d/2+1.5;x<d/2-1;x+=2.2)window(facade,x,y,.035);
 }
 for(const yy of [3.5,h-.25,h+.12])box(root,0,yy,0,w+.35,.17,d+.35,stone);
 if(w>13&&index%3!==2){
  // Two storeys of projecting glazed bays break the flat street elevation.
  for(const y of [4.7,7.5].filter(y=>y<h-1)){
   const bay=new THREE.Group();bay.position.set(0,y-1.15,d/2+.78);root.add(bay);
   masonryFacade(bay,3.6,2.3,[{x:0,y:1.15,width:2.8,height:1.65}],wall,.32);
   windowReveal(bay,0,1.15,.025,2.8,1.65,stone,glass,1,.23);
   for(const side of [-1,1])box(bay,side*1.72,1.15,-.40,.16,2.3,.8,wall);
   box(bay,0,.06,-.32,3.85,.20,1.05,stone);box(bay,0,2.28,-.32,3.85,.18,1.05,stone);
  }
 }
 if(h<13&&index%3===0){
  lowHipRoof(root,0,h+.15,0,w+.6,d+1,roof,{rise:1.3,ridgeRatio:.22});
 }else if(h<13&&index%3===1){
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute([-w/2-.3,h,-d/2-.5, w/2+.3,h,-d/2-.5, w/2+.3,h+1.5,0,-w/2-.3,h+1.5,0,-w/2-.3,h,d/2+.5,w/2+.3,h,d/2+.5],3));geometry.setIndex([0,2,1,0,3,2,3,5,2,3,4,5,0,4,3,1,2,5]);geometry.computeVertexNormals();const mesh=new THREE.Mesh(geometry,roof);mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);
 }else box(root,0,h+.22,0,w+.5,.24,d+.5,roof);
 if(h<13&&index%3===1&&index%2===0){
  const attic=new THREE.Group();attic.position.set(0,h+.55,d*.24);root.add(attic);
  for(const side of [-1,1])box(attic,side*1.51,.67,-.52,.18,1.35,1.05,wall);
  masonryFacade(attic,3.2,1.35,[{x:0,y:.67,width:1.45,height:.84}],wall,.25);
  windowReveal(attic,0,.67,.025,1.45,.84,stone,glass,1,.18);
  for(const side of [-1,1])box(attic,side*.84,1.61,-.35,1.90,.16,1.7,roof).rotation.z=side*-.45;
 }
 const labels=index===6?['光影书屋','春城影像馆','胶片咖啡']:index===7?['汽车文化工坊','城市书房','老街茶馆']:['丁香书店','街角咖啡','春城小馆'];
 for(let j=0;j<(w<15?1:3);j++)textPanel(root,labels[j],w<15?0:(j-1)*w*.30,3.50,d/2+.20,Math.min(3.8,w*.3),.38,{background:'#4b5b4f',foreground:'#ede0c5',font:140,proportional:true});
 roofServices(root,0,h,0,w,d,{heritage:h<13});
 prepareLandmarkMaterials(root);
 if(h<13&&w>12){const chimneyX=-w*.28,chimneyZ=-d*.18;box(root,chimneyX,h+1.1,chimneyZ,.65,2.2,.65,wall);box(root,chimneyX,h+2.24,chimneyZ,.82,.13,.82,stone);}
 batchStatic(root);const [x0,y0,x1,y1]=b.bounds;root.position.set((x0+x1)/2,0,-(y0+y1)/2);if(b.front==='north')root.rotation.y=Math.PI;parent.add(root);
 root.userData.changchunContext={height:h,designed:true};
}
export function changchunLandscape(parent,buildings){
 const root=new THREE.Group(),trees=[],pines=[],shrubs=[];parent.add(root);
 for(const [i,b]of buildings.entries()){
  const [x0,y0,x1,y1]=b.bounds,x=(x0+x1)/2,z=-(y0+y1)/2,side=b.front==='north'?-1:1;
  const park=b.quarterRole?b.quarterRole==='park':parkPlots.has(i),landmark=i<6,pw=x1-x0,pd=y1-y0;
  if(park){
   addGrass(root,x,z,pw,pd);
   addForecourtPaving(root,x,z,3.2,20);addForecourtPaving(root,x,z+side*4,23.8,2.4);
   const ring=new THREE.Mesh(new THREE.RingGeometry(3.1,4.0,48),stone);ring.rotation.x=-Math.PI/2;ring.position.set(x,.05,z-3*side);root.add(ring);
   for(const dx of [-8,-4,4,8])for(const dz of [-6,6])trees.push([x+dx,z+dz]);
   for(const dx of [-8,8])pines.push([x+dx,z]);
   for(const dx of [-5,5]){box(root,x+dx,.42,z+side*4,2,.16,.6,roof);for(const leg of [-.75,.75])box(root,x+dx+leg,.2,z+side*4,.13,.4,.5,stone);}
  }else if(landmark){
   if(b.baseHeight)continue;
   // A small entrance path replaces the rectangular plot border.
   addForecourtPaving(root,x,z+side*(pd/2-1),4,3);
   for(const dx of [-pw/2-1.3,pw/2+1.3])for(const dz of [-pd*.3,pd*.3])shrubs.push([x+dx,z+dz]);
   for(const dx of [-pw*.38,pw*.38])trees.push([x+dx,z-side*(pd/2+1)]);
  }else{
   addForecourtPaving(root,x,z+side*(pd/2-1.2),Math.min(6,pw),1.6);
   for(const dx of [-pw/2+.65,pw/2-.65])trees.push([x+dx,z-side*(pd/2-1.0)]);
  }
  // Two staggered rows per street side, wholly within the existing plot margin.
  for(const dx of [-pw*.34,pw*.34])if(landmark||!b.quarterRole)trees.push([x+dx,z+side*(pd/2+.7)]);

 }
 addFineFoliage(root,shrubs);
 for(const [x,z]of pines)cylinder(root,x,2.5,z,.14,5,mat(0x615a49),8);
 addFineFoliage(root,pines,true);
 batchStatic(root);addStreetTrees(root,trees,{height:1.55,spread:1.55,fineLeaves:true});
 root.userData.changchunLandscape={trees:trees.length+pines.length,parks:buildings.some(b=>b.quarterRole)?0:parkPlots.size};
}

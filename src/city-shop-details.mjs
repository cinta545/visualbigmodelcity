import * as THREE from 'three';
import {box,cylinder,mat,textPanel} from './district/materials.js';

let shrubGeometry,shrubMaterial;
function addShrub(root,x,z,index){
 if(!shrubGeometry){
  const shape=new THREE.Shape();shape.moveTo(0,-.07);shape.quadraticCurveTo(-.052,0,0,.09);shape.quadraticCurveTo(.052,0,0,-.07);
  shrubGeometry=new THREE.ShapeGeometry(shape,3);shrubMaterial=mat(0xffffff,.88);shrubMaterial.side=THREE.DoubleSide;
 }
 const leaves=new THREE.InstancedMesh(shrubGeometry,shrubMaterial,210),dummy=new THREE.Object3D();let seed=731+index*131;
 const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 for(let stem=0;stem<7;stem++){
  const angle=stem*2.4,xx=x+Math.cos(angle)*.13,zz=z+Math.sin(angle)*.13;
  cylinder(root,xx,.97,zz,.011,.37+(stem%3)*.05,mat(0x716549),6);
 }
 for(let i=0;i<210;i++){
  const angle=rand()*Math.PI*2,r=Math.sqrt(rand()),y=rand();
  dummy.position.set(x+Math.cos(angle)*r*.3,.87+y*.43,z+Math.sin(angle)*r*.27);
  dummy.rotation.set(.3+rand()*1.8,angle,rand()-.5);dummy.scale.setScalar(.75+rand()*.5);dummy.updateMatrix();leaves.setMatrixAt(i,dummy.matrix);
  leaves.setColorAt(i,new THREE.Color().setHSL(.23+rand()*.055,.28+rand()*.2,.16+rand()*.13));
 }
 leaves.castShadow=leaves.receiveShadow=true;root.add(leaves);
}

// Designed shop fittings, kept inside the existing one-metre frontage margin.
export function shopDetails(root,left,right,z,index){
 const width=right-left,bay=(width-.8)/4,door=left+.4+2.5*bay;
 const steel=mat(0x697673,.32,.65),dark=mat(0x36443f),stone=mat(0xc9c2b2),rubber=mat(0x505951);
 // Door leaf, transom, paired pull handles and a flush threshold.
 box(root,door,2.72,z+.075,bay-.06,.045,.07,steel);
 box(root,door,1.5,z+.085,.035,2.45,.065,steel);
 box(root,door+bay/2-.035,1.5,z+.085,.045,2.45,.07,steel);
 for(const dx of [-.16,.16]){
  cylinder(root,door+dx,1.38,z+.19,.018,.42,steel,8);
  for(const y of [1.2,1.56])box(root,door+dx,y,z+.135,.035,.035,.12,steel);
 }
 box(root,door,.265,z+.3,bay-.08,.025,.6,stone);
 box(root,door,.035,z+.69,Math.min(1.5,bay),.035,.45,rubber);
 for(let i=0;i<9;i++)box(root,door-.63+i*.157,.055,z+.69,.012,.006,.4,dark);
 textPanel(root,'营业中',door,2.38,z+.105,.44,.16,{background:'#e6e0d1',foreground:'#43564c',font:78});
 // Eye-level safety marks on the glazing, with a separate upper transom.
 for(let i=0;i<4;i++){
  const x=left+.4+(i+.5)*bay;
  box(root,x,2.72,z+.055,bay-.08,.04,.05,steel);
  for(const dx of [-.19,0,.19])box(root,x+dx,1.13,z+.047,.075,.035,.009,stone);
 }
 // Address plaque is a designed shop number, not an asserted real-world address.
 textPanel(root,String(index+1).padStart(2,'0')+'号',left+.25,2.5,z+.335,.3,.18,{background:'#315365',font:82});
 const px=right-.75;
 box(root,px,.4,z+.48,.65,.76,.62,mat(0x727b6c));
 box(root,px,.79,z+.48,.59,.035,.56,mat(0x4a4d36));
 addShrub(root,px,z+.48,index);
 // Shallow canopy brackets and underside luminaires; daylight needs no point lights.
 for(const dx of [.75,width-.75]){
  box(root,left+dx,3.85,z+.35,.055,.22,.72,steel);
  box(root,left+dx,3.895,z+.57,.36,.018,.1,mat(0xe5d7af));
 }
}

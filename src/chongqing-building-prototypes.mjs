import * as THREE from 'three';
import {box,mat,textPanel} from './district/materials.js';
import {landmarkMaterial,prepareLandmarkMaterials} from './changchun-landmark-materials.mjs';

// Each body occupies a different plan; courtyards and passages remain genuinely open.
export function buildingVolumes(b){
 const w=b.bounds[2]-b.bounds[0],d=b.bounds[3]-b.bounds[1],h=b.height;
 if(b.architecture==='oldstreet')return {type:'连排老街',parts:[
  [-w*.28,0,0,w*.44,h,d],[w*.28,0,0,w*.44,h*.84,d],
  [0,3.2,-d*.2,w*.12,h*.7-3.2,d*.6]]};
 if(b.architecture==='tower')return {type:'退台办公塔楼',parts:[
  [0,0,0,w,6.8,d],[0,6.8,0,w*.7,h*.68-6.8,d*.76],
  [w*.08,h*.68,-d*.06,w*.48,h*.32,d*.58]]};
 if(b.kind==='residential')return {type:'错位住宅板楼',parts:[
  [-w*.29,0,d*.13,w*.38,h,d*.72],[w*.29,0,-d*.13,w*.38,h*.86,d*.72],
  [0,0,0,w*.2,h*.7,d*.28]]};
 if(b.kind==='office')return {type:'双翼办公楼',parts:[
  [-w*.29,0,0,w*.4,h,d],[w*.29,0,0,w*.4,h*.86,d],
  [0,h*.35,-d*.15,w*.18,h*.18,d*.5]]};
 return {type:'开口院落商业',parts:[
  [-w*.36,0,0,w*.28,h,d],[w*.36,0,0,w*.28,h*.84,d],
  [0,0,-d*.38,w*.44,h*.65,d*.24]]};
}

export function createBuildingPrototype(b,helpers){
 const {nightFacade,metreUV,mergeStaticByMaterial,glowBox,shopNames}=helpers;
 const root=new THREE.Group(),plan=buildingVolumes(b),old=b.architecture==='oldstreet';
 root.name=plan.type;root.userData.prototype=plan.type;
 const facade=nightFacade(old?'oldstreet':b.kind,true).material.clone();
 facade.color.setHex(old?[0xcbbba3,0xbaa48d,0xd0c9ba][b.variant%3]:b.kind==='office'?0x8b9da6:0xa8a99c);
 facade.emissiveIntensity=old?.15:.12;
 const trim=mat(old?0x726759:0x526066,.86),roof=landmarkMaterial(0x41494b,.92,'slate'),metal=mat(0x38464a,.65,.35);
 for(const [x,y,z,w,h,d] of plan.parts){
  const body=new THREE.Mesh(metreUV(new THREE.BoxGeometry(w,h,d),old?[9,10.2]:[16,12]),facade);
  body.position.set(x,y+h/2,z);body.castShadow=body.receiveShadow=true;root.add(body);
  box(root,x,y+h+.13,z,w,.26,d,roof);
  for(const dz of [-d/2,d/2])box(root,x,y+h+.38,z+dz,w,.5,.16,trim);
  for(const dx of [-w/2,w/2])box(root,x+dx,y+h+.38,z,.16,.5,d,trim);
  if(old){
   for(const dx of [-w/2+.13,w/2-.13])box(root,x+dx,y+h/2,z+d/2+.08,.23,h,.18,trim);
   box(root,x,y+h-.12,z+d/2+.17,w,.28,.5,trim);
   if(b.variant%3===0||b.variant%3===2&&x<0){
    const ridge=new THREE.Mesh(new THREE.ConeGeometry(1,1,4),roof);
    ridge.position.set(x,y+h+.85,z);ridge.rotation.y=Math.PI/4;ridge.scale.set(w*.72,1.2,d*.72);ridge.castShadow=true;root.add(ridge);
   }else box(root,x,y+h+.65,z-d*.18,w*.4,1,d*.3,trim);
  }else if(b.kind==='office'){
   for(let dx=-w/2+.6;dx<w/2;dx+=1.7)box(root,x+dx,y+h/2,z+d/2+.1,.09,h,.15,metal);
  }else{
   for(let level=y+3.4;level<y+h-.7;level+=3.4){
    box(root,x,level,z+d/2+.15,w,.12,.55,trim);
    box(root,x,level+.9,z+d/2+.42,w,.055,.055,metal);
    for(let dx=-w/2+.2;dx<w/2;dx+=.8)box(root,x+dx,level+.46,z+d/2+.42,.04,.88,.04,metal);
   }
  }
  // Shop bays belong to the grounded wings; overhead connectors stay open underneath.
  if(y===0&&(old||b.kind==='commercial')){
   glowBox(root,x,1.45,z+d/2+.08,w*.76,2.2,.1,0xffcd96,.4);
   for(const dx of [-w*.38,0,w*.38])box(root,x+dx,1.45,z+d/2+.15,.075,2.3,.12,metal);
   textPanel(root,shopNames[(b.variant+Math.round(x*3)+shopNames.length*10)%shopNames.length],x,2.85,z+d/2+.16,w*.84,.45,{background:'#54453a',font:90,proportional:true});
   box(root,x,3.2,z+d/2+.4,w*.9,.13,.8,trim);
  }
 }
 if(plan.type==='开口院落商业'){
  const [x0,y0,x1,y1]=b.bounds,w=x1-x0,d=y1-y0;
  box(root,0,.03,d*.1,w*.43,.06,d*.7,landmarkMaterial(0x73766d,.96,'stone'));
  box(root,0,.35,0,w*.2,.7,d*.2,trim);
  box(root,0,.8,0,w*.18,.3,d*.18,mat(0x3c5746,.98));
 }
 prepareLandmarkMaterials(root);mergeStaticByMaterial(root);
 root.position.set((b.bounds[0]+b.bounds[2])/2,b.surfaceHeight||0,-(b.bounds[1]+b.bounds[3])/2);
 root.rotation.y=b.rotation||0;return root;
}

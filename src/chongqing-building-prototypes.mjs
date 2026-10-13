import {roofServices,lowHipRoof} from './city-building-detail.mjs';
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
  const arcade=y===0&&(old||b.kind==='commercial'||b.kind==='office')&&h>5;
  const lower=arcade?3.25:0;
  const body=new THREE.Mesh(metreUV(new THREE.BoxGeometry(w,h-lower,d),old?[9,10.2]:[16,12]),facade);
  body.position.set(x,y+lower+(h-lower)/2,z);body.castShadow=body.receiveShadow=true;root.add(body);
  if(arcade){
   box(root,x,1.58,z-d*.08,w*.86,3.16,d*.75,trim);
   for(let px=x-w*.44;px<=x+w*.45;px+=Math.max(2.8,w/5)){
    box(root,px,1.62,z+d/2-.18,.30,3.25,.48,trim);
    box(root,px,.18,z+d/2-.18,.48,.36,.62,roof);
   }
   box(root,x,.08,z+d*.39,w,.16,d*.20,roof);
  }
  box(root,x,y+h+.13,z,w,.26,d,roof);
  // Only the topmost roofs carry services; connectors underneath taller wings
  // previously had pipes and equipment intersecting those wings.
  if(y===0&&h>=b.height*.8)roofServices(root,x,y+h,z,w,d,{heritage:old});
  // Match actual window centres to the metre-scaled facade texture; keep its room glow.
  const tile=old?[9,10.2]:[16,12],columns=old?3:5,rows=old?3:4;
  const ww=tile[0]*(old?66:b.kind==='office'?100:78)/640,hh=tile[1]*(old?94:b.kind==='office'?90:70)/480;
  for(let py=y+h/2+(Math.ceil((3.6-h/2)/(tile[1]/rows)-.5)+.5)*(tile[1]/rows);py<Math.min(y+h-1,y+13);py+=tile[1]/rows){
   for(let px=x+(Math.ceil(-w/2/(tile[0]/columns)-.5)+.5)*(tile[0]/columns);px<x+w/2-.4;px+=tile[0]/columns){
    if(px<x-w/2+.4)continue;
    for(const sign of [-1,1]){
     // Open trim only: the existing texture/emissive window remains visible inside.
     const zz=z+sign*(d/2+.07);for(const dx of [-ww/2-.035,ww/2+.035])box(root,px+dx,py,zz,.065,hh+.12,.14,trim);
     box(root,px,py-hh/2-.07,zz+sign*.055,ww+.24,.10,.26,trim);
     if(old&&b.variant%3===1){box(root,px+ww*.55,py-hh*.48,zz+sign*.18,.46,.34,.38,metal);for(let v=0;v<3;v++)box(root,px+ww*.55,py-hh*.48-.1+v*.1,zz+sign*.38,.39,.025,.025,trim);}
    }
   }
  }
  for(const dz of [-d/2,d/2])box(root,x,y+h+.38,z+dz,w,.5,.16,trim);
  for(const dx of [-w/2,w/2])box(root,x+dx,y+h+.38,z,.16,.5,d,trim);
  // Continuous parapet coping and a shadow joint give the roof a constructed edge.
  for(const sign of [-1,1]){
   box(root,x,y+h+.65,z+sign*d/2,w+.20,.065,.26,roof);
   box(root,x+sign*w/2,y+h+.65,z,.26,.065,d+.20,roof);
   box(root,x,y+.28,z+sign*(d/2+.035),w,.38,.07,trim);
  }
  if(old){
   for(const dx of [-w/2+.13,w/2-.13])box(root,x+dx,y+h/2,z+d/2+.08,.23,h,.18,trim);
   box(root,x,y+h-.12,z+d/2+.17,w,.28,.5,trim);
   if(b.variant%3===0||b.variant%3===2&&x<0){
    lowHipRoof(root,x,y+h+.68,z,w+.24,d+.24,roof,{rise:.55+(b.variant%4)*.14,ridgeRatio:.18+(b.variant%3)*.09});
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
   glowBox(root,x,1.45,z+d/2-.50,w*.76,2.2,.1,0xffcd96,.4);
   for(const dx of [-w*.38,0,w*.38])box(root,x+dx,1.45,z+d/2-.43,.075,2.3,.12,metal);
   textPanel(root,shopNames[(b.variant+Math.round(x*3)+shopNames.length*10)%shopNames.length],x,2.85,z+d/2+.16,w*.84,.45,{background:'#54453a',font:90,proportional:true});
   box(root,x,3.2,z+d/2+.4,w*.9,.13,.8,trim);
   // Recessed shop door, a separate kick plate and handles remain below the signage.
   const doorX=x+w*.23,front=z+d/2-.40;
   for(const dx of [-.4,.4])box(root,doorX+dx,1.32,front,.035,2.1,.045,metal);
   box(root,doorX,2.38,front,.84,.045,.045,metal);
   box(root,doorX,.32,front,.84,.25,.045,trim);
   box(root,doorX+.25,1.22,front+.045,.026,.28,.025,metal);
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

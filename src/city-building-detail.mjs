import * as THREE from 'three';
import {box,mat,cylinder} from './district/materials.js';

// These shallow elements stay close to the existing facade; no plot or road moves.
const reveal=mat(0x383d3c,.94),metal=mat(0x59625e,.68,.3),dark=mat(0x243139,.34,.12);
export function lowHipRoof(root,x,y,z,w,d,material,{rise=Math.min(1.1,Math.min(w,d)*.10),ridgeRatio=.25}={}){
 const ridge=w*ridgeRatio;
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute([
  x-w/2,y,z-d/2,x+w/2,y,z-d/2,x+w/2,y,z+d/2,x-w/2,y,z+d/2,
  x-ridge,y+rise,z,x+ridge,y+rise,z],3));
 geometry.setIndex([0,4,5,0,5,1,1,5,2,2,5,4,2,4,3,3,4,0]);geometry.computeVertexNormals();
 const roof=new THREE.Mesh(geometry,material);roof.name='低坡四面屋顶 · 连续屋脊';roof.castShadow=roof.receiveShadow=true;root.add(roof);
 box(root,x,y+rise+.015,z,ridge*2+.10,.075,.15,material);
 for(const side of [-1,1])box(root,x,y-.035,z+side*d/2,w,.10,.13,material);
 return roof;
}
export function fitLandmarkToPlot(root,b,{horizontal=1,vertical=horizontal}={}){
 root.updateMatrixWorld(true);
 const bounds=new THREE.Box3().setFromObject(root),angle=b.rotation??(b.front==='north'?Math.PI:0),c=Math.cos(angle),s=Math.sin(angle);
 let extentX=0,extentZ=0;
 for(const x of [bounds.min.x,bounds.max.x])for(const z of [bounds.min.z,bounds.max.z]){
  extentX=Math.max(extentX,Math.abs(c*x+s*z));extentZ=Math.max(extentZ,Math.abs(-s*x+c*z));
 }
 const scale=Math.min(horizontal,((b.bounds[2]-b.bounds[0])/2-.25)/extentX,((b.bounds[3]-b.bounds[1])/2-.25)/extentZ);
 const heightScale=vertical*scale/horizontal;
 root.scale.set(scale,heightScale,scale);root.rotation.y=angle;
 root.userData.plotFit={id:b.id,horizontal:scale,vertical:heightScale,rotation:angle};
 return scale;
}
export function masonryFacade(root,w,h,openings,material,depth=.32){
 const shape=new THREE.Shape();shape.moveTo(-w/2,0);shape.lineTo(w/2,0);shape.lineTo(w/2,h);shape.lineTo(-w/2,h);shape.closePath();
 for(const {x,y,width,height,arched=false} of openings){
  const hole=new THREE.Path(),bottom=y-height/2,r=width/2;hole.moveTo(x-r,bottom);
  if(arched){const shoulder=bottom+height-r;hole.lineTo(x-r,shoulder);hole.absarc(x,shoulder,r,Math.PI,0,true);}
  else{hole.lineTo(x-r,y+height/2);hole.lineTo(x+r,y+height/2);}
  hole.lineTo(x+r,bottom);hole.closePath();shape.holes.push(hole);
 }
 const geometry=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false,curveSegments:archedCurveSegments(openings)});geometry.translate(0,0,-depth);
 const wall=new THREE.Mesh(geometry,material);wall.castShadow=wall.receiveShadow=true;root.add(wall);return wall;
}
function archedCurveSegments(openings){return openings.some(o=>o.arched)?12:1;}
export function windowReveal(root,x,y,z,w,h,frame,glass=dark,sign=1,inset=0){
 if(!inset)box(root,x,y,z+sign*.016,w+.15,h+.15,.035,reveal);
 else{
  for(const side of [-1,1])box(root,x+side*(w/2+.015),y,z-sign*inset/2,.035,h,inset,frame);
  for(const side of [-1,1])box(root,x,y+side*(h/2+.015),z-sign*inset/2,w,.035,inset,frame);
 }
 box(root,x,y,z+sign*(.045-inset),w,h,.025,glass);
 for(const dx of [-w/2-.045,w/2+.045])box(root,x+dx,y,z+sign*.10,.085,h+.18,.18,frame);
 for(const dy of [-h/2-.045,h/2+.045])box(root,x,y+dy,z+sign*.10,w+.17,.085,.18,frame);
 box(root,x,y,z+sign*(.076-inset),.035,h,.035,frame);
 box(root,x,y+h*.06,z+sign*(.076-inset),w,.035,.035,frame);
 // Separate opening leaves from the masonry reveal, with a shallow lower panel and latch.
 for(const side of [-1,1]){
  box(root,x+side*w*.245,y,z+sign*(.069-inset),w*.44,h*.91,.012,glass);
  box(root,x+side*.048,y-h*.08,z+sign*(.105-inset),.018,.09,.025,metal);
 }
 box(root,x,y+h/2+.115,z+sign*.13,w+.24,.04,.23,frame);
 box(root,x,y-h/2-.12,z+sign*.17,w+.28,.10,.34,frame);
 // Small drip groove underneath the projecting sill.
 box(root,x,y-h/2-.17,z+sign*.27,w+.17,.017,.025,reveal);
}
export function roofServices(root,x,y,z,w,d,{heritage=false}={}){
 const px=x+w*.26,pz=z-d*.22;
 if(!heritage){
  box(root,px,y+.35,pz,Math.min(1.8,w*.2),.70,Math.min(1.05,d*.18),metal);
  for(let i=0;i<4;i++)box(root,px,y+.14+i*.12,pz+Math.min(.525,d*.09)+.018,Math.min(1.5,w*.16),.033,.025,reveal);
  cylinder(root,x-w*.22,y+.38,z-d*.23,.10,.76,metal,8);
  cylinder(root,x-w*.22,y+.79,z-d*.23,.15,.065,metal,8);
 }
 // Gutters and drain pipes, kept within the building's edge rather than street space.
 for(const sign of [-1,1]){
  box(root,x,y-.10,z+sign*(d/2+.06),w+.1,.11,.13,metal);
  cylinder(root,x+w/2-.10,y/2,z+sign*(d/2+.07),.045,Math.max(.1,y-.2),metal,8);
  for(let yy=1.2;yy<y;yy+=3)box(root,x+w/2-.10,yy,z+sign*(d/2+.10),.12,.045,.10,metal);
  // The pipe bends into the gutter and terminates against the wall, rather than floating.
  const elbow=cylinder(root,x+w/2-.10,y-.13,z+sign*(d/2-.015),.047,.19,metal,8);elbow.rotation.x=Math.PI/2;
  const shoe=cylinder(root,x+w/2-.10,.18,z+sign*(d/2+.13),.047,.14,metal,8);shoe.rotation.x=Math.PI/2;
 }
}

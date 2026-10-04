import * as THREE from 'three';
import {box,cylinder,mat,batchStatic} from './district/materials.js';

export function addLandmarkLabels(root,buildings){
 const group=new THREE.Group(),names=['伪满国务院旧址','地质宫博物馆','伪满皇宫博物院','苏军纪念塔','日月湾亭阁','54路复古电车'];
 for(let i=0;i<6;i++){
  const b=buildings.find(b=>b.id===`changchun-${i}`);if(!b)continue;
  const c=document.createElement('canvas');c.width=512;c.height=96;const ctx=c.getContext('2d');
  ctx.fillStyle='rgba(29,48,42,.89)';ctx.beginPath();ctx.roundRect(2,2,508,82,12);ctx.fill();ctx.fillStyle='#d5bd85';ctx.fillRect(20,17,4,49);
  ctx.font='500 39px Microsoft YaHei, sans-serif';ctx.fillStyle='#f5f0e2';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(names[i],270,44,446);
  const map=new THREE.CanvasTexture(c);map.encoding=THREE.sRGBEncoding;
  const marker=new THREE.Sprite(new THREE.SpriteMaterial({map,depthTest:false,depthWrite:false}));marker.position.set((b.bounds[0]+b.bounds[2])/2,(b.baseHeight||0)+b.height+4,-(b.bounds[1]+b.bounds[3])/2);marker.scale.set(21,3.94,1);marker.renderOrder=20;group.add(marker);
 }
 group.visible=false;root.add(group);return group;
}

export function addScenicRail(root,points,height=0,piers=[]){
 if(!points?.length)return;
 const group=new THREE.Group(),steel=mat(0x626760,.39,.65),timber=mat(0x73644f,.95),gravel=mat(0x9b9b84,.97);
 group.name='长春景观电车轨道';let sleeperDistance=0;
 const deck=mat(0x8b928b,.8),railing=mat(0x536660,.48,.5);
 for(const [x,y]of piers){cylinder(group,x,(height-.65)/2,-y,.42,height-.65,deck,12);box(group,x,height-.83,-y,3.3,.36,.8,deck);}
 for(let i=1;i<points.length;i++){
  const a=points[i-1],b=points[i],dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy);if(length<.001)continue;
  const angle=Math.atan2(dy,dx),x=(a[0]+b[0])/2,z=-(a[1]+b[1])/2,nx=-dy/length,nz=-dx/length;
  box(group,x,height+.14,z,length+.035,.12,2.6,gravel,angle);
  for(const side of [-1,1]){box(group,x+nx*side*.72,height+.30,z+nz*side*.72,length+.02,.15,.075,steel,angle);box(group,x+nx*side*.72,height+.39,z+nz*side*.72,length+.02,.035,.12,steel,angle);}
  for(let d=sleeperDistance;d<length;d+=.62)box(group,a[0]+dx*d/length,height+.22,-a[1]-dy*d/length,.18,.10,2.22,timber,angle);
  if(height>0){
   box(group,x,height-.325,z,length+.02,.65,3.6,deck,angle);
   for(const side of [-1,1]){
    for(const level of [.45,1.1])box(group,x+nx*side*1.72,height+level,z+nz*side*1.72,length+.02,.065,.06,railing,angle);
    cylinder(group,a[0]+nx*side*1.72,height+.55,-a[1]+nz*side*1.72,.035,1.1,railing,8);
   }
  }
  sleeperDistance=((sleeperDistance-length)%.62+.62)%.62;
 }
 batchStatic(group);group.userData.scenicRail={designOnly:true,points:points.length};root.add(group);
}

import * as THREE from 'three';
import {box,cylinder,mat,groundMaterial,batchStatic,textPanel} from './district/materials.js';
import {createCorner,createMappedSignal} from './sind-corner.mjs';
import {addCrosswalks} from './sind-markings.mjs';
export function addSurface(root,geo,material,height=0,uvDirection=null){
 const polygons=geo.type==='Polygon'?[geo.coordinates]:geo.type==='MultiPolygon'?geo.coordinates:[];
 for(const rings of polygons){const shape=new THREE.Shape(rings[0].map(p=>new THREE.Vector2(...p)));for(const ring of rings.slice(1))shape.holes.push(new THREE.Path(ring.map(p=>new THREE.Vector2(...p))));const mesh=new THREE.Mesh(new THREE.ShapeGeometry(shape),material);if(uvDirection){const uv=mesh.geometry.attributes.uv,pos=mesh.geometry.attributes.position;for(let i=0;i<uv.count;i++)uv.setXY(i,pos.getX(i)*uvDirection[0]+pos.getY(i)*uvDirection[1],0);uv.needsUpdate=true;}mesh.rotation.x=-Math.PI/2;mesh.position.y=height;mesh.receiveShadow=true;root.add(mesh);}
}
function facade(tint){
 const c=document.createElement('canvas');c.width=256;c.height=512;const ctx=c.getContext('2d');ctx.fillStyle=tint||'#b2bbb8';ctx.fillRect(0,0,256,512);
 for(let y=16;y<512;y+=48)for(let x=12;x<256;x+=48){ctx.fillStyle='#839caa';ctx.fillRect(x,y,27,31);ctx.fillStyle='#365665';ctx.fillRect(x+2,y+2,23,25);ctx.fillStyle='#b0c2c5';ctx.fillRect(x+13,y+2,2,25);ctx.fillStyle='#dddcd1';ctx.fillRect(x-2,y+32,31,3);}
 const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;t.anisotropy=8;return new THREE.MeshStandardMaterial({map:t,roughness:.65,metalness:.12});
}
export function buildDistrict(scene,config){
 const root=new THREE.Group();scene.add(root);const [cx,cy]=config.center;
 box(root,cx,-.22,-cy,1100,.3,1100,mat(0x91a18b));
 addSurface(root,config.paving,groundMaterial('paving',.28,.28),-.015);
 const asphalt=groundMaterial('asphalt',.22,.22);asphalt.color.setHex(0xa1a6a8);addSurface(root,config.roadSurface||config.road,asphalt);addSurface(root,config.extension,asphalt,-.008);
 const lines=new THREE.Group();root.add(lines);const white=mat(0xf3efdf),curb=mat(0xc8c8b9);
 for(const way of config.ways){
  if(!['curbstone','line_thin','line_thick','stop_line','guard_rail'].includes(way.tags.type))continue;
  const isCurb=way.tags.type==='curbstone',rail=way.tags.type==='guard_rail';
  for(let i=1;i<way.points.length;i++){
   const a=way.points[i-1],b=way.points[i],angle=Math.atan2(b[1]-a[1],b[0]-a[0]),length=Math.hypot(b[0]-a[0],b[1]-a[1]);if(length<.001)continue;
   const dashed=way.tags.subtype==='dashed';for(let start=0;start<length;start+=dashed?5:length+1){const len=dashed?Math.min(2.6,length-start):length,mid=start+len/2;box(lines,a[0]+Math.cos(angle)*mid,rail?.7:isCurb?.08:.032,-a[1]-Math.sin(angle)*mid,len,rail?.18:isCurb?.18:.025,way.tags.type==='stop_line'?.34:isCurb?.18:.11,isCurb?curb:white,angle);}
  }
 }
 for(const axis of config.extensionAxes||[]){const [a,b]=axis.points,angle=Math.atan2(b[1]-a[1],b[0]-a[0]),length=Math.hypot(b[0]-a[0],b[1]-a[1]),dx=Math.cos(angle),dy=Math.sin(angle);
  for(const offset of [-axis.width/2+.2,-axis.width/4,-.12,.12,axis.width/4,axis.width/2-.2]){const dashed=Math.abs(Math.abs(offset)-axis.width/4)<.01;for(let start=0;start<length;start+=dashed?8:length+1){const len=dashed?Math.min(4,length-start):length,mid=start+len/2;box(lines,a[0]+dx*mid-dy*offset,.027,-a[1]-dy*mid-dx*offset,len,.02,.12,Math.abs(offset)<1?mat(0xd5b86d):white,angle);}}
 }
 batchStatic(lines);addCrosswalks(root,config.ways);
 if(config.crosswalks.length){
  const c=document.createElement('canvas');c.width=32;c.height=2;const ctx=c.getContext('2d');ctx.fillStyle='#eeecdf';ctx.fillRect(0,0,16,2);const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(.85,.85);t.encoding=THREE.sRGBEncoding;const paint=new THREE.MeshStandardMaterial({map:t,alphaTest:.5,roughness:.9});
  for(const geometry of config.crosswalks){const ring=geometry.coordinates[0];let best=[1,0],longest=0;for(let i=1;i<ring.length;i++){const dx=ring[i][0]-ring[i-1][0],dy=ring[i][1]-ring[i-1][1],l=Math.hypot(dx,dy);if(l>longest){longest=l;best=[dx/l,dy/l];}}addSurface(root,geometry,paint,.037,best);}
 }
 const facadeMaterials=['#bac0ba','#b5b6ab','#a3b0b5'].map(t=>[facade(t),facade(t),mat(0xa4aaa4),mat(0xa4aaa4),facade(t),facade(t)]),far=new THREE.Group();root.add(far);const trees=[];let featured;
 for(const [i,b]of config.buildings.entries()){
  const facadeMaterial=facadeMaterials[i%3];const height=Math.min(b.height,Math.hypot((b.bounds[0]+b.bounds[2])/2-cx,(b.bounds[1]+b.bounds[3])/2-cy)<100?25:42);const [x0,y0,x1,y1]=b.bounds,x=(x0+x1)/2,y=(y0+y1)/2,w=x1-x0,d=y1-y0;
  box(far,x,-.015,-y,w+1.9,.04,d+1.9,mat(0x809471));
  if(b.detail){
   const shops=[['拾光咖啡','城市书房','邻里便利'],['社区药房','鲜果食集','麦香面包'],['城市展厅','轻食工坊','生活美学']][i%3];
   const site={id:b.id,building:{...b,shops,color:['#c6c1b4','#b8c0bc','#bac4c7'][i%3]},fixedFurniture:[]};createCorner(root,site,{type:'Polygon',coordinates:[[[x0-1,y0-1],[x1+1,y0-1],[x1+1,y1+1],[x0-1,y1+1],[x0-1,y0-1]]]});
   if(!featured)featured=b;
  }else{
   box(far,x,height/2,-y,w,height,d,facadeMaterial);box(far,x,height+.4,-y,w+.5,.8,d+.5,mat(0xc9cdc7));box(far,x,3,-y,w+1.8,6,d+1.8,mat(0xc2bcac));
   for(const dx of [-4,4])box(far,x+dx,height+1.3,-y,3,1.3,2.4,mat(0x778888));
   if(i%7===0)box(far,x,height+2,-y,w*.72,3,d*.72,mat(0x91a4a6));
  }
  // Landscaping sits within each audited building's surrounding block.
  for(const dx of [-8,0,8])trees.push([x+dx,-y+(b.front==='north'?-1:1)*(d/2+3)]);
 }
 batchStatic(far);
 const trunks=new THREE.InstancedMesh(new THREE.CylinderGeometry(.12,.2,3.8,10),mat(0x786952),trees.length),crowns=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,0),mat(0x597647),trees.length*260),dummy=new THREE.Object3D();
 let seed=37;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 trees.forEach(([x,z],i)=>{dummy.position.set(x,1.9,z);dummy.scale.set(1,1,1);dummy.rotation.set(0,0,0);dummy.updateMatrix();trunks.setMatrixAt(i,dummy.matrix);for(let j=0;j<260;j++){const angle=random()*Math.PI*2,v=random()*2-1,r=Math.cbrt(random()),u=Math.sqrt(1-v*v);dummy.position.set(x+Math.cos(angle)*u*r*1.45,4.25+v*r*1.4,z+Math.sin(angle)*u*r*1.45);dummy.scale.set(.28,.13,.22);dummy.rotation.set(random()*3,random()*6,random()*3);dummy.updateMatrix();crowns.setMatrixAt(i*260+j,dummy.matrix);crowns.setColorAt(i*260+j,new THREE.Color().setHSL(.23+random()*.04,.22,.32+random()*.18));}});trunks.castShadow=crowns.castShadow=true;root.add(trunks,crowns);
 const lights=new THREE.Group();root.add(lights);
 for(const b of config.buildings.slice(0,16)){const x=b.bounds[0]+1,y=b.front==='north'?b.bounds[3]+1:b.bounds[1]-1;const metal=mat(0x607378,.35,.7);cylinder(lights,x,3.5,-y,.07,7,metal,8);box(lights,x+.5,6.95,-y,1.25,.09,.25,metal);box(lights,x+.82,6.9,-y,.5,.05,.24,mat(0xf1ecd6));}
 batchStatic(lights);
 const signalHeads=config.signalBindings.map(b=>createMappedSignal(root,b));
 return {root,signalHeads,featured};
}

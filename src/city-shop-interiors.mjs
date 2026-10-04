import {furnitureContact,interiorWallMaterial} from './city-interior-shading.mjs';
import * as THREE from 'three';
import {box,cylinder,mat,textPanel} from './district/materials.js';

const surfaces=new Map();
export function shopSurface(kind,color){
 const key=kind+color;if(surfaces.has(key))return surfaces.get(key);
 const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
 const ctx=canvas.getContext('2d'),pixels=ctx.createImageData(256,256);let seed=314159;
 for(let y=0;y<256;y++)for(let x=0;x<256;x++){
  seed=(Math.imul(seed,1664525)+1013904223)>>>0;
  const noise=(seed/4294967296-.5),grain=kind==='wood'?Math.sin(x*.22+Math.sin(y*.025)*2)*16:kind==='metal'?Math.sin(y*2.1)*4:0;
  const v=190+grain+noise*(kind==='stone'?20:8),i=(y*256+x)*4;
  pixels.data.set([v,v,v,255],i);
 }
 ctx.putImageData(pixels,0,0);const texture=new THREE.CanvasTexture(canvas);
 texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.anisotropy=4;
 const material=new THREE.MeshStandardMaterial({color,roughness:kind==='metal'?.38:.8,metalness:kind==='metal'?.7:0,bumpMap:texture,bumpScale:kind==='stone'?.012:.004,roughnessMap:texture,envMapIntensity:.45});
 surfaces.set(key,material);return material;
}

export function shopInterior(parent,{left,right,z,depth,name}){
 const root=new THREE.Group();root.position.set((left+right)/2,0,z);
 root.scale.set(Math.min(1,(right-left-1)/8),1,Math.min(1,(depth-.5)/6.8));parent.add(root);
 const wood=shopSurface('wood',0x99734f),pale=shopSurface('stone',0xd7ccb7),steel=shopSurface('metal',0x596864);
 const colors=[0x8e5146,0xd0b688,0x688477,0x627e90,0xc7bc9e],book= /书/.test(name),food=/咖啡|轻食|面包/.test(name),gallery=/展厅|美学/.test(name);
 box(root,0,.255,-3.4,8,.025,6.4,mat(0xc0b29a));
 box(root,0,2.35,-6.5,8,4.2,.12,interiorWallMaterial());
 furnitureContact(root,0,-6.15,8,.9);
 for(const x of [-4,4])box(root,x,2.35,-3.4,.1,4.2,6.4,interiorWallMaterial());
 const counter=(x,w)=>{furnitureContact(root,x,-3.65,w+1,1.6);box(root,x,.83,-3.65,w,1.12,.75,wood);box(root,x,1.42,-3.65,w+.12,.07,.9,pale);};
 const shelf=(x,w,books)=>{
  furnitureContact(root,x,-5.9,w+.5,1.1);
  for(const dx of [-w/2,w/2])box(root,x+dx,1.5,-5.9,.07,2.45,.48,wood);
  for(let row=0;row<4;row++){
   const y=.43+row*.6;box(root,x,y,-5.9,w,.055,.5,wood);
   const count=Math.floor(w/(books?.14:.34));
   for(let k=0;k<count;k++){
    const xx=x-w/2+.12+k*(w-.24)/count,h=books?.28+(k%4)*.055:.22+(k%3)*.06;
    box(root,xx,y+.03+h/2,-5.88,books?.095:.22,h,books?.3:.23,mat(colors[(k+row)%colors.length]));
    if(books)box(root,xx,y+h*.65,-5.72,.067,.018,.009,pale);
   }
  }
 };
 if(book){
  shelf(-2,3.4,true);shelf(2,3.4,true);
  furnitureContact(root,-1.7,-1.8,3.2,1.7);
  box(root,-1.7,.97,-1.8,2.6,.12,1.15,wood);
  for(const x of [-2.7,-.7])box(root,x,.61,-1.8,.12,.65,.85,steel);
  for(let i=0;i<7;i++)box(root,-2.65+i*.3,1.07+(i%2)*.02,-1.8,.23,.08,.38,mat(colors[i%5]));
  counter(2.5,1.6);
 }else if(food){
  counter(-.6,5.3);shelf(0,6.9,false);
  // Espresso machine, two group heads, cups, and a menu behind the counter.
  box(root,-1.6,1.72,-3.65,1.12,.52,.52,steel);
  box(root,-1.6,1.72,-3.35,.94,.21,.025,mat(0x253832));
  for(const x of [-1.9,-1.45]){cylinder(root,x,1.52,-3.3,.075,.12,pale,12);box(root,x,1.65,-3.28,.025,.08,.16,steel);}
  textPanel(root,/面包/.test(name)?'每日现烤':'咖啡 · 茶饮',1.9,2.8,-6.41,2.3,.55,{background:'#334b42',font:130,proportional:true});
  for(const x of [-2.6,-.6]){
   furnitureContact(root,x,-1.55,1.8,1.3);
   cylinder(root,x,.99,-1.55,.46,.07,wood,20);cylinder(root,x,.63,-1.55,.055,.65,steel,10);
   cylinder(root,x,1.075,-1.55,.065,.1,pale,12);
   for(const dx of [-.63,.63]){box(root,x+dx,.64,-1.55,.35,.075,.38,wood);box(root,x+dx,.44,-1.55,.08,.4,.3,steel);box(root,x+dx,.9,-1.72,.35,.48,.045,wood);}
  }
 }else if(gallery){
  for(let i=0;i<3;i++){
   const x=-2.5+i*2.5;furnitureContact(root,x,-2.8,1.4,1.4);box(root,x,.65,-2.8,.9,.78,.9,pale);
   const sculpture=new THREE.Mesh(new THREE.TorusKnotGeometry(.25,.085,40,8),mat(colors[i],.42,.2));
   sculpture.position.set(x,1.48,-2.8);sculpture.castShadow=true;root.add(sculpture);
   box(root,x,2.5,-6.36,1.65,1.6,.06,wood);box(root,x,2.5,-6.31,1.4,1.35,.02,mat(colors[i]));
  }
 }else{
  shelf(-1.2,5.2,false);counter(2.5,1.6);
  // Retail refrigerated cabinet and a low produce/product display.
  furnitureContact(root,-3,-3.8,1.8,1.5);
  box(root,-3,1.48,-3.8,1.2,2.4,.85,steel);
  for(let row=0;row<4;row++){
   box(root,-3,.55+row*.52,-3.32,1.02,.055,.035,pale);
   for(let k=0;k<4;k++)cylinder(root,-3.36+k*.24,.71+row*.52,-3.43,.065,.25,mat(colors[k]),8);
  }
  furnitureContact(root,-.7,-1.75,2.9,1.5);
  box(root,-.7,.69,-1.75,2.3,.85,.9,wood);
  for(let i=0;i<12;i++)box(root,-1.6+(i%6)*.35,1.17,-1.95+Math.floor(i/6)*.35,.26,.13,.25,mat(colors[i%5]));
 }
 // Pendant fittings are geometry only; they add no dynamic light passes.
 for(const x of [-2,2]){
  cylinder(root,x,3.35,-2.3,.012,1.1,steel,8);
  const shade=new THREE.Mesh(new THREE.ConeGeometry(.25,.22,16,1,true),mat(0xb89a69,.5,.4));shade.position.set(x,2.8,-2.3);root.add(shade);
 }
 return root;
}

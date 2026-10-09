import * as THREE from 'three';

// Shared, deterministic surface maps. Dimensions below are in scene metres.
const textures=new Map();
export function landmarkMaterial(color,roughness,surface){
 const material=new THREE.MeshStandardMaterial({color,roughness,envMapIntensity:.28});
 material.userData.landmarkSurface=surface;return material;
}
function surfaceMaps(kind){
 if(textures.has(kind))return textures.get(kind);
 const size=512,canvases=Array.from({length:3},()=>{const c=document.createElement('canvas');c.width=c.height=size;return c;});
 const contexts=canvases.map(c=>c.getContext('2d')),images=contexts.map(c=>c.createImageData(size,size));
 let seed=34781;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const tones=Array.from({length:32},()=>random());
 const cloud=Array.from({length:256},()=>random()-.5);
 const patch=(x,y)=>{
  const gx=x/32,gy=y/32,ix=Math.floor(gx),iy=Math.floor(gy);
  const smooth=t=>t*t*(3-2*t),u=smooth(gx-ix),v=smooth(gy-iy);
  const at=(a,b)=>cloud[(b%16)*16+(a%16)];
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(at(ix,iy),at(ix+1,iy),u),THREE.MathUtils.lerp(at(ix,iy+1),at(ix+1,iy+1),u),v);
 };
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const row=Math.floor(y/64),xx=(x+(row%2)*64)%size,col=Math.floor(xx/128);
  const edge=Math.min(xx%128,127-xx%128,y%64,63-y%64),grain=random()-.5;
  const broad=patch(x,y);
  let value=239+grain*12+broad*3,height=160+grain*18,rough=235;
  if(kind==='brick'){
   const joint=edge<2,bevel=edge<4;
   value=joint?177:224+tones[row*4+col]*26+grain*12-(bevel?8:0);
   height=joint?65:bevel?115:190+grain*28;rough=joint?250:229+grain*14;
  }else if(kind==='stone'){
   value=236+grain*20+broad*4;height=165+grain*38;rough=244+grain*10;
  }else if(kind==='glaze'){
   value=242+grain*5+broad*6;height=175+grain*7;rough=185+broad*18+grain*6;
  }else if(kind==='paint'){
   value=244+grain*4+broad*2;height=170+grain*6;rough=219+grain*9;
  }else if(kind==='wood'){
   const fibre=Math.sin(x*.52+Math.sin(y*.024)*2+Math.sin(x*.037)*3);
   value=228+fibre*15+grain*6+broad*8;height=165+fibre*12+grain*8;rough=224+fibre*10;
  }else if(kind==='slate'){
   const tileX=(x+(Math.floor(y/48)%2)*32)%64,tileY=y%48,seam=tileX<2||tileY<3;
   value=seam?167:228+grain*10+broad*8;height=seam?70:180+tileY*.5;rough=224+grain*12;
  }
  const i=(y*size+x)*4;
  for(const [k,v]of [[0,value],[1,height],[2,rough]])images[k].data.set([v,v,v,255],i);
 }
 contexts.forEach((ctx,i)=>ctx.putImageData(images[i],0,0));
 const maps=canvases.map(c=>{const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=8;t.repeat.set(1/(kind==='brick'?.96:1.2),1/(kind==='brick'?.6:1.2));return t;});
 maps[0].encoding=THREE.sRGBEncoding;textures.set(kind,maps);return maps;
}
export function prepareLandmarkMaterials(root){
 root.traverse(o=>{
  const material=o.material,kind=material?.userData?.landmarkSurface;
  if(!kind||material.map)return;
  [material.map,material.bumpMap,material.roughnessMap]=surfaceMaps(kind);
  material.bumpScale=kind==='brick'?.009:kind==='stone'?.004:kind==='glaze'?.0015:.002;
  material.needsUpdate=true;
 });
}

// Bake metre-scaled UVs after local transforms, before merging static geometry.
// Each triangle uses one projection, avoiding seams inside a triangle.
export function landmarkSurfaceUV(geometry){
 const p=geometry.attributes.position,n=geometry.attributes.normal,uv=new Float32Array(p.count*2);
 for(let i=0;i<p.count;i+=3){
  const normal=new THREE.Vector3();for(let j=0;j<3;j++)normal.add(new THREE.Vector3().fromBufferAttribute(n,i+j));
  const ax=Math.abs(normal.x),ay=Math.abs(normal.y),az=Math.abs(normal.z);
  for(let j=0;j<3;j++){
   const k=i+j;uv[k*2]=ax>ay&&ax>az?p.getZ(k):p.getX(k);
   uv[k*2+1]=ay>ax&&ay>az?p.getZ(k):p.getY(k);
  }
 }
 geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));
}

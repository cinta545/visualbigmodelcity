import * as THREE from 'three';

let contactMaterial,wallMaterial;
const plane=new THREE.PlaneGeometry(1,1);

// Authored ambient shading for static shop furniture, not a real-time AO pass.
export function furnitureContact(root,x,z,width,depth){
 if(!contactMaterial){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=128;
  const ctx=canvas.getContext('2d'),gradient=ctx.createRadialGradient(64,64,8,64,64,64);
  gradient.addColorStop(0,'rgba(32,27,20,.32)');gradient.addColorStop(.5,'rgba(32,27,20,.18)');gradient.addColorStop(1,'rgba(32,27,20,0)');
  ctx.fillStyle=gradient;ctx.fillRect(0,0,128,128);
  const map=new THREE.CanvasTexture(canvas);map.encoding=THREE.sRGBEncoding;
  contactMaterial=new THREE.MeshBasicMaterial({map,transparent:true,depthWrite:false,toneMapped:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
 }
 const mesh=new THREE.Mesh(plane,contactMaterial);mesh.rotation.x=-Math.PI/2;
 mesh.position.set(x,.27,z);mesh.scale.set(width,depth,1);root.add(mesh);
}

export function interiorWallMaterial(){
 if(wallMaterial)return wallMaterial;
 const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
 const ctx=canvas.getContext('2d'),image=ctx.createImageData(256,256);
 for(let y=0;y<256;y++)for(let x=0;x<256;x++){
  const edge=Math.min(x,255-x)/128,vertical=Math.min(y,255-y)/128;
  const shade=1-.17*Math.exp(-edge*7)-.12*Math.exp(-vertical*8),i=(y*256+x)*4;
  image.data.set([216*shade,208*shade,191*shade,255],i);
 }
 ctx.putImageData(image,0,0);const map=new THREE.CanvasTexture(canvas);map.encoding=THREE.sRGBEncoding;
 wallMaterial=new THREE.MeshStandardMaterial({map,roughness:.95,envMapIntensity:.22});return wallMaterial;
}

import * as THREE from 'three';

let leafMap,needleMap,grassMaterial;
export function foliageMap(needle=false){
 if(needle?needleMap:leafMap)return needle?needleMap:leafMap;
 const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d');
 let seed=812;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 ctx.strokeStyle='#a2b08b';ctx.lineWidth=1.3;ctx.beginPath();ctx.moveTo(64,118);ctx.lineTo(62,14);ctx.stroke();
 for(let i=0;i<(needle?65:16);i++){
  const y=18+random()*90,side=i%2?1:-1,x=64+side*(8+random()*29);
  const tone=Math.round(184+random()*64);ctx.fillStyle=`rgb(${tone},${tone},${Math.round(tone*.91)})`;ctx.strokeStyle=ctx.fillStyle;
  if(needle){ctx.lineWidth=1.4;ctx.beginPath();ctx.moveTo(64,y+13);ctx.lineTo(x+side*12,y-8);ctx.stroke();}
  else {ctx.beginPath();ctx.ellipse(x,y,7+random()*3,13+random()*4,side*.65,0,Math.PI*2);ctx.fill();ctx.lineWidth=.7;ctx.strokeStyle='#c6cbb8';ctx.beginPath();ctx.moveTo(x-side*4,y+8);ctx.lineTo(x+side*4,y-8);ctx.stroke();}
 }
 const map=new THREE.CanvasTexture(c);map.encoding=THREE.sRGBEncoding;map.anisotropy=4;
 if(needle)needleMap=map;else leafMap=map;return map;
}
export function grassSurfaceMaterial(){
 if(!grassMaterial){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const ctx=canvas.getContext('2d'),pixels=ctx.createImageData(256,256);
  let seed=1927;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let y=0;y<256;y++)for(let x=0;x<256;x++){const value=random(),k=(y*256+x)*4;pixels.data.set([81+value*28,103+value*37,63+value*24,255],k);}ctx.putImageData(pixels,0,0);
  for(let i=0;i<8500;i++){const x=random()*256,y=random()*256;ctx.strokeStyle=i%3?'#84966a':'#56694a';ctx.lineWidth=.5;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+random()*2-1,y-2-random()*3);ctx.stroke();}
  const map=new THREE.CanvasTexture(canvas);map.wrapS=map.wrapT=THREE.RepeatWrapping;map.repeat.setScalar(.5);map.encoding=THREE.sRGBEncoding;map.anisotropy=8;
  grassMaterial=new THREE.MeshStandardMaterial({map,roughness:1,envMapIntensity:.12});
 }
 return grassMaterial;
}
export function addGrass(root,x,z,w,d,height=.025){
 grassSurfaceMaterial();
 const geometry=new THREE.PlaneGeometry(w,d),uv=geometry.attributes.uv;
 for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*w+x,uv.getY(i)*d-z);
 const mesh=new THREE.Mesh(geometry,grassMaterial);mesh.rotation.x=-Math.PI/2;mesh.position.set(x,height,z);mesh.receiveShadow=true;root.add(mesh);
}
export function addFineFoliage(root,positions,needle=false){
 const count=needle?650:420,geometry=new THREE.PlaneGeometry(1,1),material=new THREE.MeshStandardMaterial({map:foliageMap(needle),alphaTest:.4,side:THREE.DoubleSide,color:needle?0x668165:0x8aab71,roughness:.94});
 const mesh=new THREE.InstancedMesh(geometry,material,positions.length*count),dummy=new THREE.Object3D();
 let seed=9301;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 positions.forEach(([x,z],i)=>{
  for(let j=0;j<count;j++){
   const a=random()*Math.PI*2,v=random()*2-1,r=Math.cbrt(random()),rad=Math.sqrt(1-v*v);
   if(needle){const level=j%4,spread=1.8-level*.30;dummy.position.set(x+Math.cos(a)*r*spread,3.7+level*.92+v*.58,z+Math.sin(a)*r*spread);dummy.scale.setScalar(.42+random()*.26);}
   else {dummy.position.set(x+Math.cos(a)*rad*r*1.35,.56+v*r*.47,z+Math.sin(a)*rad*r*.63);dummy.scale.setScalar(.24+random()*.13);}
   dummy.rotation.set(random()*Math.PI,random()*6.28,random()*Math.PI);dummy.updateMatrix();mesh.setMatrixAt(i*count+j,dummy.matrix);
   mesh.setColorAt(i*count+j,new THREE.Color().setHSL(needle?.29:.25,.20+random()*.12,.40+random()*.18));
  }
 });
 mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);
}

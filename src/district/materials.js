import {pedestrianPavingMaterial} from '../city-paving.mjs';
import * as THREE from "three";
const colors={asphalt:0x41474a,stone:0xb9b5a8,curb:0xc6c3b8,white:0xeee9d9,yellow:0xd4a741,metal:0x697173,dark:0x222b2d,glass:0x61818b,green:0x597b41};
const materials=new Map();
export function mat(color,roughness=.78,metalness=0){
 const key=[color,roughness,metalness].join(":");if(!materials.has(key))materials.set(key,new THREE.MeshStandardMaterial({color,roughness,metalness,envMapIntensity:.35}));return materials.get(key);
}
const cube=new THREE.BoxGeometry(1,1,1);
export function box(parent,x,y,z,w,h,d,material,rotation=0){
 const m=new THREE.Mesh(cube,typeof material==="number"||typeof material==="string"?mat(material):material);
 m.position.set(x,y,z);m.scale.set(w,h,d);m.rotation.y=rotation;m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
}
export function cylinder(parent,x,y,z,r,h,material,segments=12){
 const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,segments),typeof material==="number"?mat(material):material);
 mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
}
export function textPanel(parent,text,x,y,z,w,h,{background="#28483e",foreground="#f3efe2",rotation=0,font=64,proportional=false}={}){
 const canvas=document.createElement("canvas");canvas.width=proportional?2048:1024;canvas.height=proportional?Math.max(64,Math.round(2048*h/w)):256;
 const ctx=canvas.getContext("2d");ctx.fillStyle=background;ctx.fillRect(0,0,canvas.width,canvas.height);
 ctx.fillStyle=foreground;ctx.textAlign="center";ctx.textBaseline="middle";ctx.font="600 "+(font*canvas.height/256)+"px Microsoft YaHei, sans-serif";
 ctx.fillText(text,canvas.width/2,canvas.height*.508,canvas.width*.93);
 const tex=new THREE.CanvasTexture(canvas);tex.encoding=THREE.sRGBEncoding;tex.anisotropy=8;
 const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshStandardMaterial({map:tex,roughness:.7}));
 mesh.position.set(x,y,z);mesh.rotation.y=rotation;parent.add(mesh);return mesh;
}
function noiseTexture(type){
 const c=document.createElement("canvas");c.width=c.height=512;const ctx=c.getContext("2d");
 let seed=729;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 const im=ctx.createImageData(512,512);
 for(let i=0;i<im.data.length;i+=4){const v=(type==="asphalt"?100:180)+(rand()-.5)*(type==="asphalt"?65:14);im.data[i]=v;im.data[i+1]=v;im.data[i+2]=v;im.data[i+3]=255;}ctx.putImageData(im,0,0);
 if(type==="paving"){ctx.strokeStyle="#96958e";ctx.lineWidth=2;
 for(let y=0;y<=512;y+=64){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(512,y);ctx.stroke();
 for(let x=(y/64%2)*64;x<512;x+=128){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x,y+64);ctx.stroke();}}
 }
 const tex=new THREE.CanvasTexture(c);tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.anisotropy=8;tex.encoding=THREE.sRGBEncoding;return tex;
}
export function groundMaterial(type,repeatX,repeatY){
 if(type==="paving")return pedestrianPavingMaterial();
 const tex=noiseTexture(type);tex.repeat.set(repeatX,repeatY);
 const material=new THREE.MeshStandardMaterial({map:tex,color:type==="asphalt"?0x9c9c9c:0xe2ddce,roughness:.94,envMapIntensity:.2});
 if(type==="asphalt"){const loader=new THREE.TextureLoader(); for(const [name,field] of [["Diffuse","map"],["nor_gl","normalMap"],["rough","roughnessMap"]]){loader.load("/assets/textures/asphalt_01/"+name+".jpg",t=>{t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(repeatX,repeatY);t.anisotropy=8;if(name==="Diffuse")t.encoding=THREE.sRGBEncoding;material[field]=t;material.normalScale.set(.3,.3);material.needsUpdate=true;});}} return material;
}
export function batchStatic(root){
 root.updateMatrixWorld(true);const groups=new Map(),remove=[];
 root.traverse(o=>{if(!o.isMesh||o.geometry!==cube)return;const key=(Array.isArray(o.material)?o.material.map(m=>m.uuid).join(","):o.material.uuid)+":"+o.castShadow;
 if(!groups.has(key))groups.set(key,{material:o.material,cast:o.castShadow,transforms:[]});
 groups.get(key).transforms.push(o.matrixWorld.clone());remove.push(o);
 });
 for(const o of remove)o.removeFromParent();
 for(const g of groups.values()){const mesh=new THREE.InstancedMesh(cube,g.material,g.transforms.length);g.transforms.forEach((m,i)=>mesh.setMatrixAt(i,m));mesh.castShadow=g.cast;mesh.receiveShadow=true;root.add(mesh);}
}
export {colors};


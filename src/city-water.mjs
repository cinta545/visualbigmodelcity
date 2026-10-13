import * as THREE from 'three';
import {Water} from 'three/addons/objects/Water.js';

let normals;
export function waterNormals(){
 if(normals)return normals;
 const size=256,data=new Uint8Array(size*size*4);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const a=x/size*Math.PI*2,b=y/size*Math.PI*2;
  const dx=.07*Math.cos(a*3+b*2)+.035*Math.cos(a*7-b*5);
  const dy=.05*Math.cos(a*3+b*2)-.025*Math.cos(a*7-b*5);
  const n=new THREE.Vector3(-dx,-dy,1).normalize(),i=(y*size+x)*4;
  data[i]=Math.round((n.x*.5+.5)*255);data[i+1]=Math.round((n.y*.5+.5)*255);data[i+2]=Math.round((n.z*.5+.5)*255);data[i+3]=255;
 }
 normals=new THREE.DataTexture(data,size,size);normals.wrapS=normals.wrapT=THREE.RepeatWrapping;
 normals.magFilter=THREE.LinearFilter;normals.minFilter=THREE.LinearMipmapLinearFilter;normals.generateMipmaps=true;normals.needsUpdate=true;return normals;
}
export function createCityWater(geometry,{color=0x589e96,resolution=768}={}){
 const water=new Water(geometry,{textureWidth:resolution,textureHeight:resolution,waterNormals:waterNormals(),sunDirection:new THREE.Vector3(-.5,.8,.35).normalize(),sunColor:0xfff3da,waterColor:color,distortionScale:3,alpha:.95,fog:true});
 water.name='池水 · 动态波纹与岸景反射';water.userData.noMerge=true;water.userData.waterSurface=true;water.castShadow=false;water.receiveShadow=true;
 water.material.transparent=true;water.material.depthWrite=false;
 // Fresh water reflects about 2% head-on, with stronger reflection at grazing angles.
 water.material.fragmentShader=water.material.fragmentShader.replace('float rf0 = 0.3;','float rf0 = 0.02;').replace('vec3( 1.5, 1.0, 1.5 )','vec3( 1.0, 1.0, 1.0 )').replace('* getShadowMask()', '* (0.45 + 0.55 * getShadowMask())');
 water.material.fragmentShader=water.material.fragmentShader.replace('vec3 diffuseLight = vec3(0.0);',`surfaceNormal = normalize(surfaceNormal + vec3(
  0.075 * sin(worldPosition.x * 2.8 + worldPosition.z * 1.63 + 1.2 * sin(worldPosition.z * .43) + time * 1.4)
   + .025 * cos(worldPosition.x * 6.7 - worldPosition.z * 4.3 - time * 1.1),
  0.0, 0.06 * cos(worldPosition.z * 3.15 - worldPosition.x * 1.42 + 1.3 * sin(worldPosition.x * .37) - time * 1.7)));
  vec3 diffuseLight = vec3(0.0);`).replace('#include <tonemapping_fragment>','#include <tonemapping_fragment>\n#include <encodings_fragment>');
  water.material.fragmentShader=water.material.fragmentShader.replace('100.0, 2.0, 0.5','85.0, 0.65, 0.4');
  water.material.uniforms.size.value=18;
 const reflect=water.onBeforeRender;
 water.onBeforeRender=function(...args){
  this.material.uniforms.time.value=performance.now()/1000*.35;
  // Other pools must not recursively render their own reflection cameras.
  const hidden=[];args[1].traverse(o=>{if(o!==this&&o.isWater&&o.visible){hidden.push(o);o.visible=false;}});
  try{reflect.apply(this,args);}finally{for(const o of hidden)o.visible=true;}
 };
 return water;
}

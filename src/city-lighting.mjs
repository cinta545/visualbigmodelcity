import * as THREE from 'three';
export const usesRefinedPresentation=city=>['tianjin','changchun','chongqing','xian'].includes(city);

// A static, local reflection probe represents the modeled district, not live imagery.
export function createDaylight(renderer){
 const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=512;
 const ctx=canvas.getContext('2d'),gradient=ctx.createLinearGradient(0,0,0,512);
 for(const [stop,color]of [[0,'#729fc5'],[.36,'#a5c9e1'],[.50,'#dce8ec'],[.56,'#a5aaa4'],[1,'#6e7772']])gradient.addColorStop(stop,color);
 ctx.fillStyle=gradient;ctx.fillRect(0,0,1024,512);
 const sky=new THREE.CanvasTexture(canvas);sky.mapping=THREE.EquirectangularReflectionMapping;sky.encoding=THREE.sRGBEncoding;
 const pmrem=new THREE.PMREMGenerator(renderer),fallback=pmrem.fromEquirectangular(sky);
 return {sky,environment:fallback.texture,capture(scene,center){
  const target=new THREE.WebGLCubeRenderTarget(256,{type:THREE.HalfFloatType,generateMipmaps:true,minFilter:THREE.LinearMipmapLinearFilter});
  const probe=new THREE.CubeCamera(.3,800,target);probe.position.set(center[0],2.6,-center[1]);
  const previous=scene.environment;scene.environment=fallback.texture;
  try{probe.update(renderer,scene);const result=pmrem.fromCubemap(target.texture);return result;}finally{scene.environment=previous;target.dispose();}
 }};
}

export function refineRoadMaterial(material){
 material.color.setHex(0xb1b8be);material.roughness=.97;material.envMapIntensity=.12;
 // Desaturate the existing licensed asphalt scan; retain its aggregate and normal maps.
 material.onBeforeCompile=shader=>{
  shader.vertexShader='varying vec2 roadWorld;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nroadWorld=(modelMatrix*vec4(transformed,1.0)).xz;');
  shader.fragmentShader='varying vec2 roadWorld;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
   float aggregate=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
   float weathering=.96+.025*sin(roadWorld.x*.19+sin(roadWorld.y*.23))+.015*sin(roadWorld.y*.63+roadWorld.x*.31);
   diffuseColor.rgb=mix(diffuseColor.rgb,vec3(aggregate),.88)*vec3(.97,1.,1.025)*weathering;`);
 };
 material.customProgramCacheKey=()=> 'city-dry-asphalt-v1';
 return material;
}

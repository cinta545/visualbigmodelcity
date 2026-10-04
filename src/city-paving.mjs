import * as THREE from 'three';

let pavement;
// One 2.4 m tile contains 600 x 300 mm staggered paving slabs.
export function pedestrianPavingMaterial(){
 if(pavement)return pavement;
 const size=512,color=document.createElement('canvas'),height=document.createElement('canvas');
 color.width=color.height=height.width=height.height=size;
 const ctx=color.getContext('2d'),hctx=height.getContext('2d'),image=ctx.createImageData(size,size),relief=hctx.createImageData(size,size);
 let seed=93217;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const tones=Array.from({length:32},()=> (rand()-.5)*12);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const row=Math.floor(y/64),shift=row%2*64,xx=(x+shift)%size,col=Math.floor(xx/128),u=xx%128,v=y%64;
  const edge=Math.min(u,127-u,v,63-v),joint=edge<1,bevel=edge<3;
  const grain=(rand()-.5)*10,value=joint?115:176+tones[row*4+col]+grain-(bevel?9:0),i=(y*size+x)*4;
  image.data.set([value+4,value+3,value,255],i);
  const elevation=joint?75:bevel?155:205+grain*.4;relief.data.set([elevation,elevation,elevation,255],i);
 }
 ctx.putImageData(image,0,0);hctx.putImageData(relief,0,0);
 const map=new THREE.CanvasTexture(color),bump=new THREE.CanvasTexture(height);map.encoding=THREE.sRGBEncoding;
 for(const t of [map,bump]){t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.setScalar(1/2.4);t.anisotropy=8;}
 pavement=new THREE.MeshStandardMaterial({map,bumpMap:bump,bumpScale:.008,roughness:.92,envMapIntensity:.18});return pavement;
}

export function addForecourtPaving(root,x,z,width,depth){
 const geometry=new THREE.PlaneGeometry(width,depth),uv=geometry.attributes.uv;
 // Metre-based UVs retain slab size on every building frontage.
 for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*width+x-width/2,uv.getY(i)*depth-z-depth/2);
 const mesh=new THREE.Mesh(geometry,pedestrianPavingMaterial());mesh.rotation.x=-Math.PI/2;
 mesh.position.set(x,.032,z);mesh.receiveShadow=true;root.add(mesh);return mesh;
}

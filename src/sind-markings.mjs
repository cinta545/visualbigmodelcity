import * as THREE from 'three';
export function clipToSpan(points,axis,min,max){
 let polygon=points;
 for(const [bound,sign]of [[min,1],[max,-1]]){
  const output=[];
  for(let i=0;i<polygon.length;i++){
   const a=polygon[i],b=polygon[(i+1)%polygon.length],ina=sign*(a[axis]-bound)>=0,inb=sign*(b[axis]-bound)>=0;
   if(ina)output.push(a);
   if(ina!==inb){const t=(bound-a[axis])/(b[axis]-a[axis]);output.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);}
  }
  polygon=output;
 }
 return polygon;
}
// The map supplies crosswalk edges, not individual paint stripes. Keep those edges
// unchanged and use a repeating paint texture inside their bounded polygon.
export function addCrosswalks(scene,ways){
 const canvas=document.createElement('canvas');canvas.width=32;canvas.height=2;
 const ctx=canvas.getContext('2d');ctx.fillStyle='#e6e2d7';ctx.fillRect(0,0,16,2);
 const texture=new THREE.CanvasTexture(canvas);texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(1/1.1,1);texture.anisotropy=8;texture.encoding=THREE.sRGBEncoding;
 const material=new THREE.MeshStandardMaterial({map:texture,alphaTest:.5,roughness:.94,polygonOffset:true,polygonOffsetFactor:-1});
 for(const direction of ['N','S','E','W']){
  const boundaries=['outside','inside'].map(position=>ways.find(w=>w.tags.type==='zebra_marking'&&w.tags.direction===direction&&w.tags.position===position)?.points);
  if(boundaries.some(x=>!x?.length))continue;
  const a=boundaries[0],b=boundaries[1].slice();
  if(Math.hypot(a[0][0]-b[0][0],a[0][1]-b[0][1])>Math.hypot(a[0][0]-b.at(-1)[0],a[0][1]-b.at(-1)[1]))b.reverse();
  const axis=['N','S'].includes(direction)?0:1;
  const min=Math.max(Math.min(...a.map(p=>p[axis])),Math.min(...b.map(p=>p[axis])));
  const max=Math.min(Math.max(...a.map(p=>p[axis])),Math.max(...b.map(p=>p[axis])));
  // Paint only within the shared span; map edge extensions at corner curves
  // are not extra zebra stripes and would overlap the adjacent crossing.
  const polygon=clipToSpan([...a,...b.reverse()],axis,min,max);
  if(polygon.length<3)continue;
  const shape=new THREE.Shape(polygon.map(p=>new THREE.Vector2(...p))),geometry=new THREE.ShapeGeometry(shape);
  const pos=geometry.attributes.position,uv=geometry.attributes.uv;
  for(let i=0;i<pos.count;i++)uv.setXY(i,['N','S'].includes(direction)?pos.getX(i):pos.getY(i),0);
  const mesh=new THREE.Mesh(geometry,material);mesh.rotation.x=-Math.PI/2;mesh.position.y=.031;mesh.receiveShadow=true;scene.add(mesh);
 }
}

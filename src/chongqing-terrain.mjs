import * as THREE from 'three';
import {mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
import {box,cylinder,mat,batchStatic} from './district/materials.js';
import {landmarkMaterial,landmarkSurfaceUV,prepareLandmarkMaterials} from './changchun-landmark-materials.mjs';

// Landscape only: the surveyed carriageway and replay coordinates stay at y=0.
export function addChongqingTerrain(parent,terrain){
 if(!terrain)return;
 const root=new THREE.Group();root.name='重庆右下街区 · 七米下沉地形';parent.add(root);
 const stone=landmarkMaterial(0x626d67,.96,'brick'),asphalt=mat(0x202933,.97),walk=landmarkMaterial(0x727974,.95,'stone'),metal=mat(0x526661,.65,.25),paint=mat(0xcbb98b,.9);
 const mesh=(vertices,material)=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.computeVertexNormals();landmarkSurfaceUV(g);material.side=THREE.DoubleSide;const m=new THREE.Mesh(g,material);m.castShadow=m.receiveShadow=true;root.add(m);return m;};
 const quad=(a,b,c,d,m)=>mesh([...a,...c,...b,...a,...d,...c],m);
 const grass=mat(0x34483b,.99);
 const hillside=(vertices)=>{
  const raw=new THREE.BufferGeometry();raw.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  const geometry=mergeVertices(raw,.001);raw.dispose();geometry.computeVertexNormals();
  const pos=geometry.attributes.position,uv=new Float32Array(pos.count*2);
  for(let i=0;i<pos.count;i++){uv[i*2]=pos.getX(i);uv[i*2+1]=pos.getZ(i);}
  geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));
  const m=new THREE.Mesh(geometry,grass);m.castShadow=m.receiveShadow=true;root.add(m);
 };
 const surface=(geometry,height,material)=>{
  const polys=geometry.type==='Polygon'?[geometry.coordinates]:geometry.coordinates;
  for(const rings of polys){if(!rings.length)continue;const shape=new THREE.Shape(rings[0].map(p=>new THREE.Vector2(...p)));
   for(const ring of rings.slice(1))shape.holes.push(new THREE.Path(ring.map(p=>new THREE.Vector2(...p))));
   const g=new THREE.ShapeGeometry(shape);g.rotateX(-Math.PI/2);landmarkSurfaceUV(g);const m=new THREE.Mesh(g,material);m.position.y=height;m.receiveShadow=true;root.add(m);
  }
 };
 for(const vertices of terrain.slopeMeshes||[])if(vertices.length)hillside(vertices);
 if(terrain.lowerMesh?.length)hillside(terrain.lowerMesh);
 for(const patch of terrain.landscape||[])surface(patch.geometry,patch.height+.025,grass);
 // Uneven clusters use instanced rounded crowns; the ground underneath provides
 // the actual hillside shape, rather than foliage hiding a rectangular plinth.
 const foliage=[mat(0x304835,.98),mat(0x3d513c,.98),mat(0x293f36,.98)],crownGeometry=new THREE.IcosahedronGeometry(1,2),dummy=new THREE.Object3D();
 for(let variant=0;variant<foliage.length;variant++){
  const crowns=[];
  for(const [x,y,h,tree,seed] of terrain.plants||[]){if(seed%3!==variant)continue;
   if(tree){cylinder(root,x,h+1.9,-y,.13,3.8,mat(0x534638,.96),7);
    for(let k=0;k<3;k++)crowns.push([x+Math.cos(k*2.1)*.65,h+3.7+k*.45,-y+Math.sin(k*2.1)*.65,1.5+seed*.09,1.35,1.45]);
   }else crowns.push([x,h+.65,-y,1.25+seed*.12,.7,1.1]);
  }
  if(!crowns.length)continue;const trees=new THREE.InstancedMesh(crownGeometry,foliage[variant],crowns.length);
  crowns.forEach(([x,y,z,sx,sy,sz],i)=>{dummy.position.set(x,y,z);dummy.scale.set(sx,sy,sz);dummy.updateMatrix();trees.setMatrixAt(i,dummy.matrix);});trees.castShadow=trees.receiveShadow=true;root.add(trees);
 }
 for(const plateau of terrain.plateaus||[]){
  const polys=plateau.geometry.type==='Polygon'?[plateau.geometry.coordinates]:plateau.geometry.coordinates;
  for(const rings of polys){
   const shape=new THREE.Shape(rings[0].map(p=>new THREE.Vector2(...p)));
   for(const ring of rings.slice(1))shape.holes.push(new THREE.Path(ring.map(p=>new THREE.Vector2(...p))));
   const top=new THREE.Mesh(new THREE.ShapeGeometry(shape),walk);top.rotation.x=-Math.PI/2;top.position.y=plateau.height;top.receiveShadow=true;root.add(top);
   for(const ring of rings)for(let i=1;i<ring.length;i++){
    const a=ring[i-1],b=ring[i],length=Math.hypot(b[0]-a[0],b[1]-a[1]);if(length<.05)continue;
    quad([a[0],plateau.height,-a[1]],[b[0],plateau.height,-b[1]],[b[0],plateau.base,-b[1]],[a[0],plateau.base,-a[1]],stone);
    const entry=(terrain.connections||[]).some(c=>c.points.some(p=>p[2]===plateau.height&&Math.hypot((a[0]+b[0])/2-p[0],(a[1]+b[1])/2-p[1])<4.5));
    if(!entry&&!plateau.skirt)box(root,(a[0]+b[0])/2,plateau.height+.04,-(a[1]+b[1])/2,length,.16,.45,walk,Math.atan2(b[1]-a[1],b[0]-a[0]));
   }
  }
 }
 for(const connection of terrain.connections||[]){
  const [a,b]=connection.points,dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy),nx=-dy/length,nz=-dx/length;
  const p=(t,o)=>[a[0]+dx*t+nx*o,a[2]+(b[2]-a[2])*t+.06,-a[1]-dy*t+nz*o];
  quad(p(0,-1.3),p(1,-1.3),p(1,1.3),p(0,1.3),walk);
  const underside=(t,o)=>{const v=p(t,o);v[1]-=.18;return v;};
  quad(underside(0,1.4),underside(1,1.4),underside(1,3.2),underside(0,3.2),stone);
  const steps=Math.ceil(Math.abs(a[2]-b[2])/.175),angle=Math.atan2(dy,dx);
  for(let i=0;i<steps;i++){
   const t=(i+.5)/steps,v=p(t,2.3),y=a[2]+(b[2]-a[2])*(i/steps);
   box(root,v[0],y-.09,v[2],length/steps+.015,.18,1.8,stone,angle);
  }
  for(const offset of [-1.4,3.3])for(let i=0;i<12;i++){
   const v=p(i/11,offset);cylinder(root,v[0],v[1]+.5,v[2],.035,1,metal,6);
   if(i<11){const q=p((i+1)/11,offset),dir=new THREE.Vector3(q[0]-v[0],q[1]-v[1],q[2]-v[2]);const rail=new THREE.Mesh(new THREE.CylinderGeometry(.035,.035,dir.length(),6),metal);rail.position.set((v[0]+q[0])/2,(v[1]+q[1])/2+1,(v[2]+q[2])/2);rail.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),dir.normalize());root.add(rail);}
  }
 }
 const path=terrain.road;
 const point=(i,offset,up=0)=>{const p=path[i],a=path[Math.max(0,i-1)],b=path[Math.min(path.length-1,i+1)],l=Math.hypot(b[0]-a[0],b[1]-a[1]);return [p[0]-(b[1]-a[1])/l*offset,p[2]+up,-p[1]-(b[0]-a[0])/l*offset];};
 const flat=path.map((p,i)=>p[2]<=-terrain.depth+.01?i:-1).filter(i=>i>=0);
 const stairLast=flat.length>20?flat[Math.floor((flat.length-21)/2)]+20:null;
 const exit=stairLast===null?null:point(stairLast,10);
 const polygons=terrain.cut.type==='Polygon'?[terrain.cut.coordinates]:terrain.cut.coordinates;
 for(const rings of terrain.lowerMesh?[]:polygons)for(const ring of rings){
  for(let i=1;i<ring.length;i++){
   const a=ring[i-1],b=ring[i],dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy),angle=Math.atan2(dy,dx);
   if(len<.01)continue;
   const midpoint=[(a[0]+b[0])/2,(a[1]+b[1])/2];
   const entrances=[[path[0],path[1]],[path.at(-1),path.at(-2)]];
   if(entrances.some(([p,q])=>{
    const tx=q[0]-p[0],ty=q[1]-p[1],l=Math.hypot(tx,ty);
    return Math.hypot(midpoint[0]-p[0],midpoint[1]-p[1])<30&&Math.abs(((midpoint[0]-p[0])*tx+(midpoint[1]-p[1])*ty)/l)<.15;
   }))continue;
   // Double sided walls remain visible from either end of the curved road.
   const wall=quad([a[0],0,-a[1]],[b[0],0,-b[1]],[b[0],-terrain.depth,-b[1]],[a[0],-terrain.depth,-a[1]],stone);wall.material.side=THREE.DoubleSide;
   // Recessed-looking horizontal courses break up the tall retaining face.
   for(const y of [-2.3,-4.6])box(root,midpoint[0],y,-midpoint[1],len,.07,.06,metal,angle).castShadow=false;
   // Leave an opening at the stair landing instead of railing across its exit.
   if(exit&&Math.hypot(midpoint[0]-exit[0],-midpoint[1]-exit[2])<2)continue;
   box(root,(a[0]+b[0])/2,.06,-(a[1]+b[1])/2,len,.18,.5,walk,angle);
   box(root,(a[0]+b[0])/2,.92,-(a[1]+b[1])/2,len,.07,.07,metal,angle);
   for(let s=0;s<len;s+=2.7)cylinder(root,a[0]+dx*s/len,.48,-a[1]-dy*s/len,.035,.96,metal,6);
  }
 }
 let distance=0;
 for(let i=1;i<path.length;i++){
  quad(point(i-1,-4.5,.03),point(i,-4.5,.03),point(i,4.5,.03),point(i-1,4.5,.03),asphalt).castShadow=false;
  for(const side of [-1,1])quad(point(i-1,side*4.5,.12),point(i,side*4.5,.12),point(i,side*7.2,.12),point(i-1,side*7.2,.12),walk);
  if(path[i-1][2]<=-6.99&&path[i][2]<=-6.99)
   quad(point(i-1,-7.2,.12),point(i,-7.2,.12),point(i,-13,.12),point(i-1,-13,.12),walk).castShadow=false;
  for(const side of [-1,1]){
   quad(point(i-1,side*4.5,.03),point(i,side*4.5,.03),point(i,side*4.5,.16),point(i-1,side*4.5,.16),walk);
   if(i%4===0)quad(point(i-1,side*4.65,.125),point(i,side*4.65,.125),point(i,side*4.85,.125),point(i-1,side*4.85,.125),metal);
  }
  const p=path[i-1],q=path[i],len=Math.hypot(q[0]-p[0],q[1]-p[1]);
  if(distance%7<3.5)quad(point(i-1,-.08,.045),point(i,-.08,.045),point(i,.08,.045),point(i-1,.08,.045),paint);
  distance+=len;
 }
 // A stair flight follows the flat lower promenade; its top landing bridges to the rim.
 if(flat.length>20){
  const first=flat[Math.floor((flat.length-21)/2)],last=first+20,steps=40;
  for(let i=0;i<steps;i++){
   const at=first+(last-first)*i/steps,index=Math.floor(at),f=at-index;
   // A diagonal flight reaches the landscape rim instead of ending in the bank.
   const offset=7.4+10.6*i/steps;
   const p=point(index,offset),q=point(index+1,offset),angle=Math.atan2(-(q[2]-p[2]),q[0]-p[0]);
   const t=(i+1)/steps,progress=t<.45?t/.9:t<=.55?.5:.5+(t-.55)/.9;
   const h=(terrain.depth-.12)*progress;
   box(root,p[0]+(q[0]-p[0])*f,-terrain.depth+.12+h/2,p[2]+(q[2]-p[2])*f,Math.hypot(q[0]-p[0],q[2]-p[2])*(last-first)/steps+.025,h,2.1,stone,angle);
   if(i%4===0)for(const side of [-1,1]){
    const a=point(index,offset+side),b=point(index+1,offset+side);
    cylinder(root,a[0]+(b[0]-a[0])*f,-terrain.depth+.12+h+.5,a[2]+(b[2]-a[2])*f,.035,1,metal,6);
   }
   for(const side of [-1,1]){
    const a=point(index,offset+side),b=point(index+1,offset+side);
    box(root,a[0]+(b[0]-a[0])*f,-terrain.depth+.12+h+1,a[2]+(b[2]-a[2])*f,.8,.065,.065,metal,angle);
   }
  }
  const p=point(last,18),q=point(last+1,18),angle=Math.atan2(-(q[2]-p[2]),q[0]-p[0]);
  box(root,p[0],-.08,p[2],2.1,.16,3.8,walk,angle);
 }
 // Small planted beds articulate the lower terrace without a field of point lights.
 for(let k=12;k<flat.length-10;k+=17){
  const i=flat[k],p=point(i,-17),q=point(i+1,-17),angle=Math.atan2(-(q[2]-p[2]),q[0]-p[0]);
  if((terrain.buildings||[]).some(b=>{const [x0,y0,x1,y1]=b.bounds;return p[0]>x0-3&&p[0]<x1+3&&-p[2]>y0-3&&-p[2]<y1+3;}))continue;
  box(root,p[0],-terrain.depth+.25,p[2],5,.5,2.4,stone,angle);
  box(root,p[0],-terrain.depth+.65,p[2],4.7,.45,2.1,mat(0x304d3e,.98),angle);
  const bench=point(i,-13);
  box(root,bench[0],-terrain.depth+.45,bench[2],3,.18,.65,mat(0x625448,.9),angle);
  for(const along of [-1.05,1.05])box(root,bench[0]+Math.cos(angle)*along,-terrain.depth+.2,bench[2]-Math.sin(angle)*along,.12,.4,.5,metal,angle);
  const back=point(i,-13.3);
  box(root,back[0],-terrain.depth+.85,back[2],3,.55,.1,mat(0x625448,.9),angle);
 }
 prepareLandmarkMaterials(root);batchStatic(root);root.userData.terrain={depth:terrain.depth,designOnly:true};return root;
}

import {shopInterior,shopSurface} from './city-shop-interiors.mjs';
import {shopDetails} from './city-shop-details.mjs';
import * as THREE from 'three';
import {box,cylinder,mat,textPanel,groundMaterial,batchStatic} from './district/materials.js';

// Designed scenery. All horizontal positions use the audited site configuration.
export function createCorner(scene,site,pavement){
 const root=new THREE.Group();root.name='Designed corner: '+site.id;scene.add(root);
 const stone=shopSurface('stone',site.building.color||0xd0c8b7),trim=shopSurface('stone',0xe6e0d2),metal=shopSurface('metal',0x475554),wood=shopSurface('wood',0x89654a);
 const glass=new THREE.MeshPhysicalMaterial({color:0x9ab0b1,roughness:.08,metalness:0,envMapIntensity:.65,transparent:true,opacity:.18,depthWrite:false,side:THREE.DoubleSide});
 const upperGlass=new THREE.MeshStandardMaterial({color:0x4f6970,roughness:.24,metalness:.55});
 const [x0,y0,x1,y1]=site.building.bounds,w=x1-x0,d=y1-y0,cx=(x0+x1)/2,cz=-(y0+y1)/2,h=site.building.height;
 const polygons=pavement.type==='Polygon'?[pavement.coordinates]:pavement.coordinates;
 const pavingMaterial=groundMaterial('paving',.25,.25);
 for(const rings of polygons){
  const shape=new THREE.Shape(rings[0].map(p=>new THREE.Vector2(...p)));
  for(const ring of rings.slice(1))shape.holes.push(new THREE.Path(ring.map(p=>new THREE.Vector2(...p))));
  const plaza=new THREE.Mesh(new THREE.ShapeGeometry(shape),pavingMaterial);
  plaza.rotation.x=-Math.PI/2;plaza.position.y=.012;plaza.receiveShadow=true;root.add(plaza);
 }
 const buildingRoot=new THREE.Group();root.add(buildingRoot);
 // A recessed ground floor with actual interior space instead of opaque shop boxes.
 box(buildingRoot,cx,.13,cz,w,.24,d,stone);
 box(buildingRoot,cx,2.45,-y1,w,4.6,.3,trim);
 for(const x of [x0,x1])box(buildingRoot,x,2.45,cz,.35,4.6,d,trim);
 box(buildingRoot,cx,4.65,cz,w+.3,.35,d+.3,stone);
 box(buildingRoot,cx,(h+4.8)/2,cz,w,h-4.8,d,stone);
 const shops=site.building.shops||['青禾咖啡','城市书房','邻里便利'];
 const signColors=['#344b42','#746453','#526673'];
 for(let j=0;j<3;j++){
  const left=x0+j*w/3,right=left+w/3,mid=(left+right)/2,z=-y0;
  box(buildingRoot,left,2.25,z,.45,4.4,.65,trim);
  box(buildingRoot,right,2.25,z,.45,4.4,.65,trim);
  box(buildingRoot,mid,3.55,z+.1,w/3-.45,.7,.35,stone);
  textPanel(buildingRoot,shops[j],mid,3.55,z+.285,w/3-1,.52,{background:signColors[j],font:150,proportional:true});
  // Glass bays and separately framed entrance doors.
  for(let bay=0;bay<4;bay++){
   const bx=left+.4+(bay+.5)*(w/3-.8)/4,bw=(w/3-.8)/4;
   const pane=new THREE.Mesh(new THREE.PlaneGeometry(bw-.065,2.9),glass);pane.position.set(bx,1.73,z+.04);buildingRoot.add(pane);
   box(buildingRoot,bx-bw/2,1.73,z+.05,.06,2.9,.08,metal);
   box(buildingRoot,bx,3.16,z+.05,bw,.065,.08,metal);
   box(buildingRoot,bx,.29,z+.05,bw,.065,.08,metal);

  }
  box(buildingRoot,mid,3.98,z+.55,w/3-.1,.14,1.5,trim);
  for(let k=0;k<12;k++)box(buildingRoot,left+.25+k*.81,4.12,z+.4,.055,.18,1.15,wood);
  shopDetails(buildingRoot,left,right,z,j);
  shopInterior(buildingRoot,{left,right,z,depth:d,name:shops[j]});
 }
 for(const xx of [x0+.22,x1-.22]){
  cylinder(buildingRoot,xx,h/2,-y0+.38,.045,h-.3,metal,10);
  for(let yy=1;yy<h;yy+=2.8)box(buildingRoot,xx,yy,-y0+.37,.14,.055,.13,metal);
 }
 for(let j=0;j<=3;j++){
  const xx=x0+j*w/3;
  box(buildingRoot,xx,.48,-y0+.34,.46,.48,.08,mat(0x9a9c90));
  for(let yy=.85;yy<3.2;yy+=.55)box(buildingRoot,xx,yy,-y0+.332,.44,.012,.012,mat(0x92978c));
 }
 // Upper floor windows have recess surrounds, mullions, ledges and service details.
 for(let floor=0;floor<Math.floor((h-4.7)/3.05);floor++){
  const yy=6.35+floor*3.05;
  box(buildingRoot,cx,yy-1.24,-y0+.06,w,.16,.32,site.building.kind==='office'?metal:trim);
  for(let j=0;j<Math.floor((w-2)/3.25)+1;j++){
   const xx=x0+1.8+j*3.25;
   for(const zz of [-y0-.01,-y1+.01]){
    const front=zz>-y0-.1,sgn=front?1:-1;
    box(buildingRoot,xx,yy,zz+sgn*.05,2.22,2.12,.1,metal);
    box(buildingRoot,xx,yy,zz+sgn*.12,2.02,1.94,.035,upperGlass);
    box(buildingRoot,xx,yy,zz+sgn*.16,.06,1.96,.055,trim);
    box(buildingRoot,xx,yy-1.12,zz+sgn*.16,2.4,.14,.4,trim);
    if(site.building.kind==='residential'&&j%2===0){
     box(buildingRoot,xx,yy-1.1,zz+sgn*.52,2.5,.14,.85,trim);
     box(buildingRoot,xx,yy-.4,zz+sgn*.94,2.5,.055,.055,metal);
     for(let rail=0;rail<7;rail++)box(buildingRoot,xx-1.15+rail*.38,yy-.75,zz+sgn*.94,.025,.68,.025,metal);
    }
   }
  }
  for(let j=0;j<4;j++){
   const zz=-y0-2-j*3.5;
   box(buildingRoot,x0-.06,yy,zz,.12,1.95,2.25,upperGlass);
   box(buildingRoot,x0-.14,yy-1.08,zz,.36,.15,2.4,trim);
  }
 }
 box(buildingRoot,cx,h+.12,cz,w+.5,.22,d+.5,trim);
 box(buildingRoot,cx,h+.31,cz,w-1,.18,d-1,mat(0x6c7771));
 for(const xx of [x0+.25,x1-.25])box(buildingRoot,xx,h+.55,cz,.18,.7,d,stone);
 for(const zz of [-y0-.25,-y1+.25])box(buildingRoot,cx,h+.55,zz,w,.7,.18,stone);
 for(let i=0;i<3;i++){
  const xx=cx-5+i*4;box(buildingRoot,xx,h+.8,cz,2.4,.9,2,mat(0xa4ada9));
  for(let k=0;k<8;k++)box(buildingRoot,xx,h+1.27,cz-.8+k*.22,2.12,.03,.06,metal);
 }
 if(site.building.front==='north'){buildingRoot.rotation.y=Math.PI;buildingRoot.position.set(2*cx,0,2*cz);}
 for(const f of site.fixedFurniture){
  const x=f.x,z=-f.y;
  if(f.type==='tree')tree(root,x,z);
  if(f.type==='bench'){
   for(let i=0;i<5;i++)box(root,x,.54,z-.25+i*.12,2.2,.07,.08,wood);
   for(const sx of [-.86,.86])box(root,x+sx,.28,z,.08,.5,.65,metal);
   for(let k=0;k<3;k++)box(root,x,.87+k*.12,z-.33,2.2,.08,.06,wood);
  }
  if(f.type==='planter'){
   box(root,x,.33,z,1.3,.66,1.3,stone);box(root,x,.67,z,1.1,.05,1.1,mat(0x514d38));
   for(let i=0;i<12;i++){const angle=i*2.4,leaf=new THREE.Mesh(new THREE.SphereGeometry(.22,8,6),mat(0x687a45));leaf.position.set(x+Math.cos(angle)*.35,.83+(i%3)*.12,z+Math.sin(angle)*.35);root.add(leaf);}
  }
 }
 batchStatic(root);return root;
}
function tree(root,x,z){
 const bark=mat(0x736551),foliage=mat(0xffffff,.9);foliage.side=THREE.DoubleSide;
 cylinder(root,x,2.15,z,.12,4.3,bark,12);
 const leafShape=new THREE.Shape();leafShape.moveTo(0,-.12);leafShape.quadraticCurveTo(-.09,-.02,0,.16);leafShape.quadraticCurveTo(.09,-.02,0,-.12);
 const leafGeometry=new THREE.ShapeGeometry(leafShape,5),leaves=new THREE.InstancedMesh(leafGeometry,foliage,2800),dummy=new THREE.Object3D();
 let seed=Math.round(x*173+z*37)>>>0;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 for(let branch=0;branch<6;branch++){
  const angle=branch*Math.PI/3,from=new THREE.Vector3(x,2.7,z),to=new THREE.Vector3(x+Math.cos(angle)*.9,4.5+(branch%2)*.4,z+Math.sin(angle)*.9);
  const delta=to.clone().sub(from),twig=new THREE.Mesh(new THREE.CylinderGeometry(.025,.07,delta.length(),8),bark);twig.position.copy(from).add(to).multiplyScalar(.5);twig.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());twig.castShadow=true;root.add(twig);
 }
 for(let i=0;i<2800;i++){
  const theta=rand()*Math.PI*2,v=rand()*2-1,r=Math.cbrt(rand()),horizontal=Math.sqrt(1-v*v);
  dummy.position.set(x+Math.cos(theta)*horizontal*r*1.55,4.45+v*r*1.45,z+Math.sin(theta)*horizontal*r*1.55);
  dummy.rotation.set(rand()*Math.PI,rand()*Math.PI,rand()*Math.PI);dummy.scale.set(1+rand()*.9,1+rand()*.8,1);dummy.updateMatrix();leaves.setMatrixAt(i,dummy.matrix);
  leaves.setColorAt(i,new THREE.Color().setHSL(.22+rand()*.08,.25+rand()*.25,.11+rand()*.16));
 }
 leaves.castShadow=true;leaves.receiveShadow=true;root.add(leaves);
 box(root,x,.025,z,1.6,.05,1.6,mat(0x6b7061));
 for(let i=0;i<9;i++)box(root,x-.66+i*.165,.06,z,.025,.04,1.4,mat(0x414d42));
}

export function createMappedSignal(scene,binding){
 const [x,y]=binding.position,[sx,sy]=binding.stopLineCenter;
 const root=new THREE.Group();root.position.set(x,0,-y);scene.add(root);
 const steel=mat(0x929b98,.32,.72),black=mat(0x202b2a,.68);
 cylinder(root,0,2.2,0,.09,4.4,steel,20);
 box(root,0,.16,0,.42,.32,.42,mat(0x9eaaa1));
 for(const bx of [-.13,.13])for(const bz of [-.13,.13])cylinder(root,bx,.335,bz,.025,.035,steel,8);
 const face=new THREE.Group();face.rotation.y=Math.atan2(sx-x,-(sy-y));root.add(face);
 box(face,0,4,0,.54,1.5,.27,black);box(face,0,4,-.03,.69,1.68,.06,black);
 const bulbs=[];
 for(let i=0;i<3;i++){
  const material=new THREE.MeshStandardMaterial({color:0x17211c,emissive:[0xe83b30,0xf4b830,0x38ae62][i],emissiveIntensity:0,roughness:.27});
  const lamp=new THREE.Mesh(new THREE.CircleGeometry(.155,32),material);lamp.position.set(0,4.48-i*.46,.143);face.add(lamp);bulbs.push(material);
  const hood=new THREE.Mesh(new THREE.CylinderGeometry(.185,.185,.32,24,1,true,0,Math.PI*1.35),black);
  hood.rotation.x=Math.PI/2;hood.position.set(0,4.48-i*.46,.24);face.add(hood);
 }
 textPanel(face,'灯'+binding.name.match(/\d+/)[0],0,3.04,.11,.48,.24,{font:115,background:'#42514b'});
 return {id:Number(binding.name.match(/\d+/)[0]),bulbs};
}

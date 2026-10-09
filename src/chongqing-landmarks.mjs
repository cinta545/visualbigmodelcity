import * as THREE from 'three';
import {box,cylinder,mat} from './district/materials.js';
import {landmarkMaterial,prepareLandmarkMaterials} from './changchun-landmark-materials.mjs';
import {glowBox,neonSign,neonStrip,metreUV,mergeStaticByMaterial,nightFacade} from './chongqing-night.mjs';

// Stylised three-dimensional readings of the nine supplied card illustrations.
// Placement and scale are designed; none of these are the sites' real coordinates.
export const chongqingLandmarkKinds={
 hongya:'洪崖洞',raffles:'来福士广场',baixiang:'白象居',liziba:'李子坝 · 穿楼轻轨',
 luohan:'罗汉寺',shancheng:'山城巷',jiefangbei:'解放碑',erchang:'鹅岭二厂',
};

const rock=landmarkMaterial(0x3a3f49,.95,'stone'),wood=landmarkMaterial(0x7a4a2c,.85,'wood'),
 cream=landmarkMaterial(0xd8cdb0,.8,'stone'),templeRed=landmarkMaterial(0x7a3630,.82,'paint'),
 brick=landmarkMaterial(0x8a4a38,.9,'brick'),plaster=landmarkMaterial(0x8f7f68,.88,'plaster'),
 tile=landmarkMaterial(0x24424c,.83,'slate'),tileGold=mat(0x8a6a2c,.5,.3),steelDark=mat(0x272e3d,.6,.5),
 woodDark=landmarkMaterial(0x4a3226,.85,'wood'),pavingDark=landmarkMaterial(0x3b403c,.94,'stone');
const gold='#ffd76e',pink='#ff4fa3',cyan='#29e0ff',orange='#ffa23e';

function lantern(root,x,y,z,r=.24,color=0xff5040){
 const mesh=new THREE.Mesh(new THREE.SphereGeometry(r,10,8),mat(0x793c30,.92));
 mesh.position.set(x,y,z);root.add(mesh);
 box(root,x,y-r-.06,z,r*1.4,.1,r*1.4,woodDark);
}
function pyramidRoof(root,x,z,y,w,d,rise,material=tile){
 const side=Math.max(w,d),geometry=new THREE.ConeGeometry(side/Math.SQRT2,rise,4,1).toNonIndexed();
 geometry.computeVertexNormals();geometry.userData.owned=true;
 const mesh=new THREE.Mesh(geometry,material);mesh.rotation.y=Math.PI/4;
 mesh.scale.set(w/side,1,d/side);mesh.position.set(x,y+rise/2,z);
 mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);
}
function facadeWall(root,x,y,z,w,h,d,kind,ox=0,oy=0){
 const geometry=metreUV(new THREE.BoxGeometry(w,h,d),[24,20],ox,oy);
 const mesh=new THREE.Mesh(geometry,nightFacade(kind,true).material);
 mesh.position.set(x,y,z);mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);
 for(const side of [-1,1]){
  for(let dx=-w/2+.5;dx<w/2;dx+=1.8)box(root,x+dx,y,z+side*(d/2+.06),.10,h,.15,steelDark);
  for(let yy=y-h/2+3;yy<y+h/2;yy+=3.2)box(root,x,yy,z+side*(d/2+.08),w,.12,.22,steelDark);
 }
 return mesh;
}

// 洪崖洞 — stilted timber tiers spread wide against a rock cliff, like the real one.
function hongya(root){
 // The cliff: a tall rough rock face wider than the tiers, so it reads past both flanks.
 // Overlapping faceted rock volumes avoid one large rectangular backdrop.
 for(let i=0;i<9;i++){
  const stoneMesh=new THREE.Mesh(new THREE.IcosahedronGeometry(1,1),rock);
  stoneMesh.scale.set(5.5,6+(i%3)*1.2,4.2);
  stoneMesh.position.set(-8+(i%3)*8,6+Math.floor(i/3)*8.2,-6.8-(i%2)*.6);
  stoneMesh.rotation.y=i*.47;stoneMesh.castShadow=stoneMesh.receiveShadow=true;stoneMesh.geometry.userData.owned=true;root.add(stoneMesh);
 }
 for(let tier=0;tier<7;tier++){
  const y=1+tier*3.3,w=20.5-tier*.5,zc=2.6-tier*.15,d=9.5-tier*.3;
  // Chunky stilt posts carry a cantilevered gallery in front of each storey.
  for(let i=0;i<7;i++)cylinder(root,-w/2+1.2+i*(w-2.4)/6,y-1.15,zc+d/2-.4,.24,2.4,woodDark,6);
  box(root,0,y-.05,zc+d/2+.7,w,.35,2.2,woodDark);
  box(root,0,y+1.35,zc,w,2.7,d,wood);
  box(root,0,y-.28,zc,w+.6,.4,d+2.6,tile);
  // Five discrete lit windows per tier — colour without a glare band.
  for(let i=0;i<5;i++){
   const wx=-w*.36+i*w*.18,wz=zc+d/2+.06,ww=w*.13;
   glowBox(root,wx,y+1.5,wz,ww,1.8,.1,0xffb35c,1.6);
   for(const dx of [-ww/2,0,ww/2])box(root,wx+dx,y+1.5,wz+.07,.07,1.9,.10,woodDark);
   box(root,wx,y+1.42,wz+.08,ww,.07,.12,woodDark);
  }
  if(tier%2===0)for(const xx of [-w*.32,0,w*.32])pyramidRoof(root,xx,zc+d/2+.4,y+2.72,w*.36,3.2,.85);
  for(let i=0;i<4;i++)cylinder(root,-w/2+.9+i*(w-1.8)/3,y+.65,zc+d/2+1.6,.08,1.3,woodDark,4);
  box(root,0,y+1.25,zc+d/2+1.6,w,.1,.1,woodDark);
  // Strings of oversized red lanterns — the silhouette Hongyadong is known for.
  for(const lx of [-w/2+.9,-w*.22,w*.22,w/2-.9])lantern(root,lx,y+1.75,zc+d/2+1.2,.45);
  glowBox(root,0,y+.12,zc+d/2+.7,w,.12,.1,0xffd9a0,1.1);
 }
 // Top terrace with two small pavilions — a street, not a single big pyramid.
 box(root,0,24.1,2,20,.5,10,tile);
 for(const px of [-6,6])pyramidRoof(root,px,px>0?3:1,26,6.5,5.6,1.9);
 for(const px of [-6,6])box(root,px,25.1,px>0?3:1,4.4,1.8,3.4,wood);
 glowBox(root,0,24.75,6.9,18,.14,.12,0xffd76e,1.5);
 for(const lx of [-8.5,-2.9,2.9,8.5])lantern(root,lx,26.2,7,.5);
 // A small gilded shrine crowns the cliff itself.
 pyramidRoof(root,0,-6.5,33.5,4.8,4,1.6);
 cylinder(root,0,34.9,-6.5,.12,1.8,tileGold,8);lantern(root,0,36.2,-6.5,.4);
 neonSign(root,'洪崖洞',-11.4,13,6.6,1.5,8,{color:gold,vertical:true,rotation:Math.PI/2});
 neonSign(root,'洪崖洞',0,23.2,8.2,8.5,1.5,{color:gold});
}

// 来福士 — four towers cradling a glowing horizontal crystal gallery.
function raffles(root){
 box(root,0,1.7,0,20,3.4,15,steelDark);
 glowBox(root,0,1.5,7.6,18,2.4,.16,0xffb066,1.15);
 const spots=[[-5.6,-3.6,40],[5.6,-3.6,45],[-5.6,3.6,45],[5.6,3.6,40]];
 for(const [x,z,h] of spots){
  facadeWall(root,x,3.4+h/2,z,5.6,h,5.6,'office',x*2,z*2);
  box(root,x,3.6+h+.3,z,6.2,.6,6.2,steelDark);
  glowBox(root,x,3.6+h+.7,z,.32,.32,.32,0xff4040,3);
  for(const [sx,sz] of [[-1,-1],[1,-1],[-1,1],[1,1]])
   box(root,x+sx*2.85,3.4+h/2,z+sz*2.85,.14,h,.14,neonStrip(0x29e0ff,1.9));
 }
 box(root,0,49.3,0,22,3,5,mat(0x22384e,.35,.6));
 for(const sx of [-1,1]){
  const end=new THREE.Mesh(new THREE.CylinderGeometry(1.5,1.5,5,12),mat(0x22384e,.35,.6));
  end.rotation.z=Math.PI/2;end.position.set(sx*11,49.3,0);end.castShadow=true;root.add(end);
 }
 glowBox(root,0,47.7,0,22,.22,5,0x29e0ff,1.5);
 for(const sz of [-1,1])glowBox(root,0,50.85,sz*2.5,22,.18,.18,0x29e0ff,2.2);
 neonSign(root,'来福士',0,5.3,7.85,4.4,.95,{color:cyan});
}

// 李子坝 — the resident tower the light-rail beam threads at its eighth floor.
function liziba(root){
 facadeWall(root,0,15,0,12,30,9,'residential');
 for(let y=4;y<30;y+=3.2){
  box(root,0,y,4.62,10.4,.16,.55,mat(0x3a4048,.8));
  glowBox(root,0,y+.5,4.66,9.6,.2,.4,0xffb066,.55);
 }
 box(root,0,16,1.2,20,1.5,2.7,mat(0xb9beb6,.55,.2));
 for(const sz of [-1,1])glowBox(root,0,16.05,1.2+sz*1.36,20,.16,.12,0x52ffa8,1.9);
 for(const sx of [-8.4,8.4]){cylinder(root,sx,8,1.2,.5,16,mat(0x9ea39c,.6,.3),10);box(root,sx,16.9,1.2,1.1,.4,2.9,mat(0x9ea39c,.6,.3));}
 const train=new THREE.Group();root.add(train);
 for(const sx of [-6.4,0,6.4]){
  box(train,sx,17.55,1.2,5.6,2.1,2.35,mat(0xdfe3e0,.5,.1));
  box(train,sx,17.1,1.2,5.6,.5,2.35,mat(0x2f7d5c,.6));
  glowBox(train,sx,18.35,1.2,5.7,.44,2.4,0x9fd8ff,1.5);
 }
 glowBox(train,9.35,17.6,1.2,.14,.3,.5,0xfff2d0,3);
 box(root,0,30.6,0,8.6,.5,6.6,mat(0x1d222b,.8));
 glowBox(root,2.6,31.1,-1,.26,.26,.26,0xff4040,3);
 neonSign(root,'李子坝',0,2.6,4.62,3.4,.8,{color:'#52ffa8'});
 neonSign(root,'李子坝站',0,19.4,2.62,3.2,.62,{color:gold});
}

// 白象居 — three linked towers joined by glowing sky-bridges.
function baixiang(root){
 const towers=[[-7,-1.5,10,26],[7,-1.5,10,29],[0,5.2,12,23]];
 for(const [x,z,w,h] of towers){
  facadeWall(root,x,h/2,z,w,h,9,'residential',x,z);
  box(root,x,h+.25,z,w+.4,.5,9.4,mat(0x1d222b,.8));
  if(h>26)glowBox(root,x-w/2+.7,h+.6,z,.26,.26,.26,0xff4040,3);
 }
 box(root,0,17,-1.5,15.6,2.1,2.6,mat(0x2c333d,.7));
 for(const sz of [-1,1])glowBox(root,0,18.15,-1.5+sz*1.2,15.2,.15,.15,0xff4fa3,2.2);
 box(root,0,19.6,2.2,2.6,2,4.6,mat(0x2c333d,.7));
 for(const sx of [-1,1])glowBox(root,sx*1.2,20.7,2.2,.15,.15,4.4,0xffd76e,2.2);
 glowBox(root,0,1.35,9.8,10.5,2.4,.14,0xffb066,1.05);
 neonSign(root,'白象居',11.6,12,1.4,1.1,5.2,{color:pink,vertical:true,rotation:Math.PI/2});
}

// 罗汉寺 — walled compound, double-eave hall and a five-storey pagoda.
function luohan(root){
 const wallT=landmarkMaterial(0x6a3028,.85,'brick');
 for(const [x,z,w,d] of [[-6.4,8.2,8.2,1],[6.4,8.2,8.2,1],[0,-8.2,21,1],[-10.4,0,1,17.4],[10.4,0,1,17.4]])box(root,x,1.3,z,w,2.6,d,wallT);
 for(const x of [-8,-4,4,8]){lantern(root,x,3,8.2,.2);lantern(root,x,3,-8.2,.2);}
 for(const x of [-10.4,10.4])for(const z of [-4,4])lantern(root,x,3,z,.2);
 for(const x of [-1.5,1.5]){box(root,x,2.1,8.85,.55,4.2,.55,templeRed);}
 box(root,0,4.35,8.85,3.7,.5,.9,tileGold);
 pyramidRoof(root,0,8.85,4.6,4.6,1.6,1,tile);
 neonSign(root,'罗汉寺',0,3.4,9.35,3.2,.72,{color:gold});
 box(root,0,.7,3.4,15.5,1.4,9.5,rock);
 box(root,0,4.2,3.4,14,5.6,8.6,templeRed);
 glowBox(root,0,3.6,7.85,11.5,.75,.14,0xffb35c,1.5);
 box(root,0,3,7.9,2.6,3,.3,mat(0x3a2418,.8));
 pyramidRoof(root,0,3.4,7.15,16.5,11.5,2.3);
 glowBox(root,0,6.9,8.3,16,.16,.16,0xffc75e,1.7);
 pyramidRoof(root,0,3.4,9.35,11.5,8,1.9);
 glowBox(root,0,9.1,7.3,11,.14,.14,0xffc75e,1.5);
 box(root,0,11.1,3.4,.9,1.2,.9,tileGold);lantern(root,0,12,3.4,.26,0xffd76e);
 for(let tier=0;tier<5;tier++){
  const y=1.2+tier*3.1,s=3.8-tier*.55;
  box(root,0,y+1,-5.2,s,2,s,templeRed);
  glowBox(root,0,y+.9,-5.2+s/2+.12,s*.7,.5,.1,0xffb35c,1.4);
  pyramidRoof(root,0,-5.2,y+2.05,s+1.6,s+1.6,1,tile);
 }
 cylinder(root,0,15.4,-5.2,.12,2.4,tileGold,8);lantern(root,0,16.8,-5.2,.22,0xffd76e);
 cylinder(root,0,.9,-1.6,.55,1.1,mat(0x4a3b28,.6,.3),10);
 glowBox(root,0,1.5,-1.6,.5,.25,.5,0xff8a3c,2.4);
}

// 山城巷 — stone steps and string-lit terraces climbing away from the street.
function shancheng(root){
 const terraces=[[5.6,.55],[2.2,1.75],[-1.2,2.95],[-4.8,4.15]];
 for(const [z,y] of terraces)box(root,0,y,z,19.5,1.1,4.6,rock);
 for(let i=0;i<9;i++)box(root,0,.35+i*.5,7.4-i*.9,2.4,.28,.95,pavingDark);
 for(const [z,y] of terraces)for(const x of [-5.6,5.6]){
  box(root,x,y+2.15,z,6.4,3.3,4,plaster);
  glowBox(root,x,y+2.3,z+2.05,5.4,.55,.1,0xffb35c,1.7);
  box(root,x,y+3.95,z,7,.4,4.6,tile);
  box(root,x,y+3.8,z+2.3,7,.18,.22,tileGold);
  glowBox(root,x,y+3.68,z+2.42,6.8,.12,.1,0xffc75e,1.6);
  pyramidRoof(root,x,z,y+4.15,7.4,5,1.2);
 }
 for(let i=0;i<7;i++){
  const a=new THREE.Vector3(-8.6+ (i%2)*17.2,7.4-i*.28,6-i*1.55),b=new THREE.Vector3(-8.6+((i+1)%2)*17.2,7.4-(i+1)*.28,6-(i+1)*1.55);
  const bar=new THREE.Mesh(new THREE.CylinderGeometry(.03,.03,a.distanceTo(b),4),neonStrip(0xffd76e,2.2));
  bar.position.copy(a.add(b).multiplyScalar(.5));bar.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),b.clone().sub(a).normalize());root.add(bar);
 }
 for(const z of [6.8,-1.4]){cylinder(root,-9.2,1.6,z,.09,3.2,woodDark,6);lantern(root,-9.2,3.5,z,.24);cylinder(root,9.2,1.6,z,.09,3.2,woodDark,6);lantern(root,9.2,3.5,z,.24);}
 for(const x of [-1.5,1.5]){box(root,x,2.6,7.9,.5,5.2,.5,rock);box(root,x,5,7.9,1.1,.5,.9,tileGold);}
 box(root,0,5.4,7.9,3.6,.5,.6,tileGold);
 neonSign(root,'山城巷',0,4.55,8.25,2.9,.7,{color:gold});
 neonSign(root,'老茶馆',5.6,3.3,7.65,2.4,.55,{color:pink});
}

// 解放碑 — the gilded monument on its own round plaza.
function jiefangbei(root){
 cylinder(root,0,.12,0,11,.24,pavingDark,36);
 cylinder(root,0,.3,0,9.4,.1,neonStrip(0xffd76e,1.5),36);
 cylinder(root,0,.32,0,8.7,.14,pavingDark,36);
 const plazaStone=landmarkMaterial(0x68736e,.95,'stone'),joint=mat(0x424c49,.97),leaf=mat(0x314c3d,.96);
 // Four planted arcs leave clear approaches and stay inside the existing plaza.
 for(let quadrant=0;quadrant<4;quadrant++){
  const start=quadrant*Math.PI/2-.23,end=start+.46;
  for(let j=0;j<9;j++){
   const angle=start+(end-start)*(j+.5)/9,x=Math.cos(angle)*9.9,z=Math.sin(angle)*9.9;
   box(root,x,.48,z,.55,.6,1.25,plazaStone,Math.PI/2-angle);
   const bush=new THREE.Mesh(new THREE.IcosahedronGeometry(.65,1),leaf);
   bush.position.set(x,.95,z);bush.scale.set(.8,.6,1);bush.castShadow=true;root.add(bush);
  }
 }
 for(let i=0;i<48;i++){
  const angle=i*Math.PI/24;
  box(root,Math.cos(angle)*9.7,.248,Math.sin(angle)*9.7,2.3,.014,.025,joint,-angle).castShadow=false;
 }
 for(const z of [-8,8])for(const x of [-3,3]){
  box(root,x,.65,z,2.1,.16,.55,woodDark);
  box(root,x,1,z+Math.sign(z)*.24,2.1,.5,.09,woodDark);
  for(const dx of [-.8,.8])box(root,x+dx,.43,z,.12,.35,.48,steelDark);
 }
 // Enlarge the monument itself while retaining the protected plaza footprint.
 const monument=new THREE.Group();monument.name='解放碑主体 · 放大 1.6 倍';root.add(monument);
 monument.scale.setScalar(1.6);root=monument;
 for(let i=0;i<4;i++)box(root,0,.5+i*.42,0,8-i*1.6,.5,8-i*1.6,cream);
 box(root,0,7.8,0,3.6,11.4,3.6,cream);
 for(const [sx,sz] of [[-1,-1],[1,-1],[-1,1],[1,1]]){
  box(root,sx*1.9,7.8,sz*1.9,.5,11.4,.5,cream);
  box(root,sx*1.55,7.8,sz*1.55,.2,11.4,.2,mat(0xb9ab8a,.75));
  glowBox(root,sx*1.86,7.8,sz*1.86,.13,11.4,.13,0xffd76e,1.9);
 }
 box(root,0,14.2,0,4.4,1.5,4.4,cream);
 for(const [sx,sz,rot] of [[0,2.21,0],[0,-2.21,Math.PI],[2.21,0,Math.PI/2],[-2.21,0,-Math.PI/2]]){
  const face=clockFace();face.position.set(sx,14.2,sz);face.rotation.y=rot;root.add(face);
 }
 box(root,0,15.5,0,3.2,1,3.2,cream);
 const dome=new THREE.Mesh(new THREE.SphereGeometry(1.7,14,10,0,Math.PI*2,0,Math.PI/2),mat(0xd9a94f,.35,.85));
 dome.material.emissive=new THREE.Color(0xcf8f2e);dome.material.emissiveIntensity=0;
 dome.position.set(0,16,0);dome.castShadow=true;root.add(dome);
 cylinder(root,0,17.6,0,.09,1.8,tileGold,8);lantern(root,0,18.6,0,.2,0xffd76e);
 neonSign(root,'解放碑',0,3.1,2.35,3.2,.8,{color:gold});
}
function clockFace(){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
 const ctx=canvas.getContext('2d');
 ctx.fillStyle='#101826';ctx.beginPath();ctx.arc(128,128,124,0,7);ctx.fill();
 ctx.strokeStyle='#e8d9a8';ctx.lineWidth=7;ctx.beginPath();ctx.arc(128,128,116,0,7);ctx.stroke();
 for(let i=0;i<12;i++){const a=i*Math.PI/6;ctx.fillStyle=i%3?'#cfe3ef':'#ffd76e';ctx.beginPath();ctx.arc(128+Math.cos(a)*96,128+Math.sin(a)*96,i%3?5:8,0,7);ctx.fill();}
 ctx.strokeStyle='#ffffff';ctx.lineCap='round';ctx.shadowColor='#bfe8ff';ctx.shadowBlur=12;
 ctx.lineWidth=9;ctx.beginPath();ctx.moveTo(128,128);ctx.lineTo(128+58*Math.cos(-Math.PI/3),128+58*Math.sin(-Math.PI/3));ctx.stroke();
 ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(128,128);ctx.lineTo(128+88*Math.cos(Math.PI*.7),128+88*Math.sin(Math.PI*.7));ctx.stroke();
 const tex=new THREE.CanvasTexture(canvas);tex.encoding=THREE.sRGBEncoding;
 return new THREE.Mesh(new THREE.CircleGeometry(1.55,24),new THREE.MeshBasicMaterial({map:tex}));
}

// 鹅岭二厂 — the brick creative plant under its tapering chimney.
function erchang(root){
 box(root,0,3.2,1.5,18,6.4,12,brick);
 for(let i=0;i<6;i++)glowBox(root,-7.5+i*3,3.4,7.55,1.5,1.7,.12,0xffc788,1.5);
 for(let i=0;i<3;i++){
  const slab=box(root,-5.9+i*5.9,7.5,1.5,5.6,.3,12.6,mat(0x5a5148,.8));
  slab.rotation.z=.24;
  glowBox(root,-5.9+i*5.9,7.95,1.5,4.6,.12,11.4,0x9fd8ff,.9);
 }
 for(const sz of [-1,1])glowBox(root,0,6.5,1.5+sz*6.1,17.6,.18,.18,0xffa23e,1.9);
 glowBox(root,0,3.1,7.6,17,2.2,.14,0xffb066,1.1);
 const stack=new THREE.Mesh(new THREE.CylinderGeometry(.75,1.15,30,12),brick);
 stack.position.set(6.6,15,-4.8);stack.castShadow=true;root.add(stack);stack.geometry.userData.owned=true;
 glowBox(root,6.6,29.6,-4.8,.3,.3,.3,0xff4040,3);
 for(const y of [1.5,6])box(root,6.6,y,-4.8,2.9,.5,2.9,mat(0x6a6258,.85));
 for(const [sx,sz] of [[-1,-1],[1,-1],[-1,1],[1,1]])cylinder(root,-6+sx*2.4,5,4.6+sz*1.6,.14,10,mat(0x3c4046,.6,.4),6);
 const tank=new THREE.Mesh(new THREE.CylinderGeometry(1.7,1.7,2.4,12),mat(0x4a525c,.6,.3));
 tank.position.set(-6,10.6,4.6);tank.castShadow=true;root.add(tank);tank.geometry.userData.owned=true;
 glowBox(root,-6,11.9,4.6,2.2,.16,2.2,0x29e0ff,1.4);
 neonSign(root,'鹅岭二厂',0,9.4,7.75,5.2,.95,{color:orange});
 neonSign(root,'二厂文创',-9.4,4,1.5,1.1,4.6,{color:cyan,vertical:true,rotation:Math.PI/2});
}

// 长江索道 — stations, sagging haul ropes and two slowly crossing cabins.
export function addChongqingCableway(parent,config){
 const {stations,towerHeight,cableY}=config.cableway;
 const root=new THREE.Group();parent.add(root);
 const frame=mat(0x7d352c,.55,.35),house=landmarkMaterial(0x8f7f68,.85,'plaster');
 const anchors=[];
 for(const [sx,sy] of stations){
  const x=sx,z=-sy;
  for(const side of [-1,1]){
   const leg=box(root,x+side*2.2,towerHeight/2,z,.55,towerHeight,.55,frame);
   leg.rotation.z=side*.13;
  }
  for(const y of [7,15,23])box(root,x,y,z,4.6,.5,.7,frame);
  box(root,x,towerHeight+.8,z,3.4,1.6,3,frame);
  const wheel=new THREE.Mesh(new THREE.TorusGeometry(1.15,.16,8,18),frame);
  wheel.position.set(x,towerHeight+1.8,z);root.add(wheel);
  glowBox(root,x,towerHeight+3.15,z,.2,.2,.2,0xff4040,3);
  box(root,x,1.6,z+3.6,6.5,3.2,4.6,house);
  glowBox(root,x,2.1,z+5.9,5.6,1.5,.14,0xffb066,1.4);
  for(let i=0;i<3;i++)cylinder(root,x-2.4+i*2.4,.9,z+3.6,.16,1.8,mat(0x3c4046,.5,.4),6);
  box(root,x,3.4,z+3.6,7,.5,5,mat(0x24424c,.7,.1));
  neonSign(root,'长江索道',x+3.6,4.6,z+3.6,1,3.8,{color:'#ff5a5a',vertical:true,rotation:Math.PI/2});
  anchors.push(new THREE.Vector3(x,towerHeight+1.8,z));
 }
 const span=anchors[0].distanceTo(anchors[1]);
 const direction=anchors[1].clone().sub(anchors[0]).normalize();
 for(const side of [-1,1]){
  const points=[];
  for(let i=0;i<=40;i++){
   const t=i/40,y=anchors[0].y-Math.sin(Math.PI*t)*(anchors[0].y-cableY);
   points.push(anchors[0].clone().lerp(anchors[1],t).add(new THREE.Vector3(-direction.z*side*.55,0,direction.x*side*.55)).setY(y));
  }
  // Moonlit steel haul ropes: thick enough to read at overview distance.
  root.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),48,.18,6),
   new THREE.MeshStandardMaterial({color:0x6b7690,roughness:.45,metalness:.55,emissive:0x39508a,emissiveIntensity:0})));
 }
 const cabins=[0,1].map(index=>{
  const group=new THREE.Group();group.userData.noMerge=true;root.add(group);
  box(group,0,-.55,0,.14,1.1,.14,mat(0x2c3038,.5,.5));
  box(group,0,-1.35,0,1.9,1.5,1.9,mat(0xc23a2e,.45,.15));
  box(group,0,-.68,0,2.02,.2,2.02,mat(0xe8e8e2,.5));
  glowBox(group,0,-1.15,0,1.95,.5,1.95,0xffd9a0,1.5);
  box(group,0,-2.2,0,1.7,.14,1.7,mat(0x2c3038,.6,.4));
  group.rotation.y=Math.atan2(direction.x,direction.z);
  return group;
 });
 const point=t=>anchors[0].clone().lerp(anchors[1],t).setY(anchors[0].y-Math.sin(Math.PI*t)*(anchors[0].y-cableY));
 const state={update(seconds){
  const cycle=(seconds/23)%2,f=cycle<1?cycle:2-cycle,ease=f*f*(3-2*f);
  cabins[0].position.copy(point(ease)).y-=.05;
  cabins[1].position.copy(point(1-ease)).y-=.05;
 },span:Math.round(span)};
 prepareLandmarkMaterials(root);
 mergeStaticByMaterial(root);
 return state;
}

export function createChongqingLandmark(parent,b){
 const kind=b.landmarkKind;
 if(!chongqingLandmarkKinds[kind])return null;
 const root=new THREE.Group();root.name='重庆特色建筑 · '+chongqingLandmarkKinds[kind];
 ({hongya,raffles,baixiang,liziba,luohan,shancheng,jiefangbei,erchang})[kind](root);
 prepareLandmarkMaterials(root);
 const [x0,y0,x1,y1]=b.bounds,scale=Math.min((x1-x0)/24,(y1-y0)/20),boost=b.verticalBoost||1;
 // Vertical boost lifts low monuments without distorting their neon lettering planes.
 if(boost!==1)root.traverse(o=>{if(o.isMesh&&o.geometry.type==='PlaneGeometry')o.scale.y/=boost;});
 mergeStaticByMaterial(root,scale,scale*boost);
 root.scale.set(scale,scale*boost,scale);
 root.position.set((x0+x1)/2,0,-(y0+y1)/2);
 if(b.front==='north')root.rotation.y=Math.PI;
 // Present the crafted facades toward the default southern bird's-eye camera.
 root.rotation.y=0;
 root.userData.chongqingLandmark={kind,name:chongqingLandmarkKinds[kind],designedPlacement:true};
 parent.add(root);return root;
}

// Changchun-style floating name plates, tuned to the neon night palette.
// items: [{x,z,topY,name}] — topY is the built landmark's world-space apex.
export function addChongqingLandmarkLabels(root,items){
 const group=new THREE.Group();
 for(const {x,z,topY,name} of items.filter(item=>['洪崖洞','来福士广场','解放碑'].includes(item.name))){
  const c=document.createElement('canvas');c.width=560;c.height=96;const ctx=c.getContext('2d');
  ctx.fillStyle='rgba(16,22,40,.9)';ctx.beginPath();ctx.roundRect(2,2,556,82,12);ctx.fill();
  ctx.strokeStyle='rgba(216,180,92,.55)';ctx.lineWidth=2;ctx.stroke();
  ctx.fillStyle='#d8b45c';ctx.fillRect(20,17,4,49);
  ctx.font='500 38px Microsoft YaHei, sans-serif';ctx.fillStyle='#f2ead6';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(name,292,44,492);
  const map=new THREE.CanvasTexture(c);map.encoding=THREE.sRGBEncoding;
  const marker=new THREE.Sprite(new THREE.SpriteMaterial({map,depthTest:false,depthWrite:false}));
  marker.position.set(x,topY+4.5,z);marker.scale.set(27,4.62,1);marker.renderOrder=20;group.add(marker);
 }
 group.visible=false;root.add(group);return group;
}

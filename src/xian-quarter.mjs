import * as THREE from 'three';
import {box,cylinder,mat,textPanel} from './district/materials.js';
import {landmarkMaterial,prepareLandmarkMaterials} from './changchun-landmark-materials.mjs';
import {mergeStaticByMaterial} from './chongqing-night.mjs';
import {addStreetTrees} from './city-trees.mjs';
import {addFineFoliage} from './changchun-planting.mjs';
import {createHumanWalker} from './city-humans.mjs';
import {createVulnerableActor} from './sind-actors.mjs';

// These are designed exhibition wards, not the real locations of the monuments.
const plaster=landmarkMaterial(0xd7c9ac,.96,'plaster'),stone=landmarkMaterial(0xa6a49a,.95,'stone'),brick=landmarkMaterial(0x887b69,.96,'brick'),red=landmarkMaterial(0x78352c,.87,'paint'),wood=landmarkMaterial(0x583b2a,.91,'wood'),slate=landmarkMaterial(0x394247,.9,'slate'),gold=mat(0xb49a60,.63,.2),dark=mat(0x282d2c,.96),green=mat(0x71835a,.98);
export function xianStoneRoad(){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=512;const ctx=canvas.getContext('2d');
 ctx.fillStyle='#555e5b';ctx.fillRect(0,0,512,512);
 for(let row=0;row<8;row++)for(let col=-1;col<5;col++){
  const x=col*128+(row%2)*64,y=row*64,t=(row*17+col*13+100)%7;
  ctx.fillStyle=`rgb(${111+t*2},${117+t*2},${110+t*2})`;ctx.fillRect(x+2,y+2,124,60);
  ctx.strokeStyle='rgba(222,220,198,.14)';ctx.strokeRect(x+5,y+5,118,54);
 }
 const texture=new THREE.CanvasTexture(canvas);texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(1/12,1/12);texture.encoding=THREE.sRGBEncoding;texture.anisotropy=8;
 return new THREE.MeshStandardMaterial({color:0xb0bbb6,map:texture,roughness:.94,metalness:0,bumpMap:texture,bumpScale:.025});
}
function culturalStele(root,x,z,title){
 box(root,x,.22,z,3,.44,1.4,stone);box(root,x,1.8,z,2.4,3.2,.5,stone);
 textPanel(root,title,x,2,z+.27,2,.75,{background:'#a6a08c',foreground:'#5b4734'});
 box(root,x,3.5,z,2.7,.25,.75,slate);
}
function bronzeDing(root,x,z){
 const bronze=mat(0x786949,.7,.45);
 for(let i=0;i<3;i++){const a=i*Math.PI*2/3;bar(root,[x+Math.cos(a)*.55,.15,z+Math.sin(a)*.55],[x+Math.cos(a)*.8,1.25,z+Math.sin(a)*.8],.13,bronze);}
 cylinder(root,x,1.5,z,1.1,1.1,bronze,24);cylinder(root,x,2.07,z,1.22,.16,bronze,24);
 cylinder(root,x,2.16,z,.94,.03,dark,24);
 for(const side of [-1,1]){bar(root,[x+side*.92,2,z],[x+side*.92,2.8,z],.11,bronze);bar(root,[x+side*.92,2.8,z-.32],[x+side*.92,2.8,z+.32],.11,bronze);}
}
function cloudInlay(root,x,z){
 const canvas=document.createElement('canvas');canvas.width=512;canvas.height=256;const ctx=canvas.getContext('2d');
 ctx.strokeStyle='#b8a779';ctx.lineWidth=4;
 for(let i=0;i<3;i++){const cx=85+i*160;ctx.beginPath();ctx.moveTo(cx-55,175);ctx.bezierCurveTo(cx-100,120,cx-30,80,cx-14,110);ctx.bezierCurveTo(cx-15,28,cx+80,60,cx+54,105);ctx.bezierCurveTo(cx+120,100,cx+90,170,cx+35,175);ctx.stroke();}
 const map=new THREE.CanvasTexture(canvas);map.encoding=THREE.sRGBEncoding;
 const m=mesh(root,new THREE.PlaneGeometry(19,8),new THREE.MeshStandardMaterial({map,transparent:true,depthWrite:false,roughness:1}));m.rotation.x=-Math.PI/2;m.position.set(x,.064,z);m.castShadow=false;
}
function warmPool(root,x,z){const light=new THREE.PointLight(0xffc07b,3,15,2);light.position.set(x,3.2,z);root.add(light);}
function courtyardBench(root,x,z,angle=0){
 const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=angle;root.add(g);
 for(const side of [-1,1])box(g,side*1.1,.28,0,.32,.56,.65,stone);
 box(g,0,.6,0,2.8,.15,.7,wood);box(g,0,.94,-.3,2.8,.55,.12,wood);
}
function dailyLife(root,kind){
 const points={changle:[[-8,29],[8,31],[-16,20],[15,22]],qujiang:[[-31,33],[31,32],[-37,-15],[26,-33]],pagoda:[[-5,12],[-5,18],[-7,27],[1,29]],bell:[[-6,0],[-2,3],[-7,10],[0,12],[-2,23],[2,26],[7,33],[9,35]]}[kind];
 const visitors=new THREE.Group();visitors.name='街区静态访客 · 场景装饰';visitors.userData.noMerge=true;visitors.userData.sceneryOnly=true;root.add(visitors);
 for(const [i,p] of points.entries()){const person=createHumanWalker(i%2);person.position.set(p[0],.12,p[1]);person.rotation.y=i*.9;visitors.add(person);}
 if(kind==='changle'){
  for(const side of [-1,1]){bed(root,side*25,18,4,10);courtyardBench(root,side*25,32);}
 }else if(kind==='qujiang'){
  for(const [x,z] of [[-25,35],[29,32],[-30,-32]]){courtyardBench(root,x+2,z+1,.3);streetLantern(root,x-2,z);}
 }else if(kind==='pagoda'){
  for(const side of [-1,1]){box(root,side*8,.55,24,.45,1.1,9,plaster);box(root,side*8,1.15,24,.7,.2,9,slate);streetLantern(root,side*8,18);}
  courtyardBench(root,-13,33);courtyardBench(root,30,33);
 }else{
  for(const side of [-1,1]){
   const stall=new THREE.Group();stall.position.set(side*10,0,25);root.add(stall);
   for(const x of [-1.5,1.5])for(const z of [-.8,.8])cylinder(stall,x,1.3,z,.05,2.6,wood,8);
   box(stall,0,2.6,0,3.4,.12,2.2,mat(side<0?0xb79565:0x8f4f38,.96));box(stall,0,.9,.3,2.8,1.1,1,wood);
   textPanel(stall,side<0?'长安茶点':'秦风手作',0,2.25,1.12,2.4,.45,{background:'#694a31',foreground:'#e0c69a'});
   for(let i=0;i<5;i++)cylinder(stall,-1+i*.5,1.52,.3,.13,.17,gold,8);
  }
  for(const x of [-27,-24,-21]){const bike=createVulnerableActor('bicycle',{rider:false});bike.position.set(x,.08,32);bike.rotation.y=.25;bike.userData.sceneryOnly=true;root.add(bike);}
  warmPool(root,-10,25);warmPool(root,10,25);
 }
}
function mesh(root,geometry,material){const m=new THREE.Mesh(geometry,material);m.castShadow=m.receiveShadow=true;root.add(m);return m;}
function bar(root,a,b,r,material){const p=new THREE.Vector3(...a),q=new THREE.Vector3(...b),v=q.clone().sub(p);const m=mesh(root,new THREE.CylinderGeometry(r,r,v.length(),6),material);m.position.copy(p.add(q).multiplyScalar(.5));m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize());return m;}
function roof(root,x,z,w,d,y,rise,detailed=true){
 const vertices=[],indices=[],n=12,rings=[[1,1,0],[.84,.82,.10],[.57,.34,.65],[.45,.015,1]];
 const corners=[[-1,-1],[1,-1],[1,1],[-1,1]];
 for(let k=0;k<rings.length;k++)for(let side=0;side<4;side++)for(let i=0;i<n;i++){
  const t=i/n,a=corners[side],b=corners[(side+1)%4],[sx,sz,h]=rings[k],curl=k===0?.18+.6*Math.pow(Math.abs(2*t-1),6):0;
  vertices.push(x+(a[0]+(b[0]-a[0])*t)*w*sx/2,y+rise*h+curl,z+(a[1]+(b[1]-a[1])*t)*d*sz/2);
 }
 const row=n*4;for(let k=0;k<3;k++)for(let i=0;i<row;i++){const a=k*row+i,b=k*row+(i+1)%row;indices.push(a,b+row,b,a,a+row,b+row);}
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setIndex(indices);geometry.computeVertexNormals();slate.side=THREE.DoubleSide;mesh(root,geometry,slate);
 for(const side of [-1,1])for(let xx=-w*.44;detailed&&xx<=w*.44;xx+=.55){
  const points=rings.map(([sx,sz,h],i)=>[x+xx*sx,y+rise*h+(i===0?.18+.6*Math.pow(Math.abs(xx/(w/2)),6):0)+.035,z+side*d*sz/2]);
  for(let k=1;k<points.length;k++)bar(root,points[k-1],points[k],.035,slate);
 }
 bar(root,[x-w*.23,y+rise+.07,z],[x+w*.23,y+rise+.07,z],.14,slate);
 for(const side of [-1,1]){
  bar(root,[x+side*w*.23,y+rise,z],[x+side*w*.25,y+rise+.65,z],.14,slate);box(root,x,y-.18,z+side*d*.43,w*.89,.25,.45,red);
  for(let xx=-w*.42;detailed&&xx<=w*.42;xx+=.7){
   box(root,x+xx,y-.36,z+side*d*.43,.12,.25,.65,wood);
   const cap=mesh(root,new THREE.SphereGeometry(.075,7,5),slate);cap.position.set(x+xx,y+.22,z+side*d*.5);cap.scale.z=.45;
  }
 }
}
function paving(root,x,z,w,d){
 const joint=mat(0x85877e,.98);
 // Broad slab courses and a perimeter frame make the courtyard legible nearby.
 for(let zz=-d/2;zz<=d/2;zz+=2.4){box(root,x,.105,z+zz,w,.016,.035,joint);
  const length=Math.min(2.4,d/2-zz);if(length>.05)for(let xx=-w/2+((Math.round(zz/2.4)%2)?1.6:0);xx<=w/2;xx+=3.2)box(root,x+xx,.105,z+zz+length/2,.035,.016,length,joint);
 }
 for(const side of [-1,1]){box(root,x+side*w/2,.12,z,.25,.04,d,stone);box(root,x,.12,z+side*d/2,w,.04,.25,stone);}
}
function bed(root,x,z,w,d){
 box(root,x,.19,z,w,.35,d,stone);box(root,x,.39,z,w-.3,.06,d-.3,green);
 addFineFoliage(root,Array.from({length:Math.max(2,Math.floor(w/2.8))},(_,i)=>[x-w*.38+i*w*.76/Math.max(1,Math.floor(w/2.8)-1),z]));
}
function stairs(root,x,z,w,h,count=7){for(let i=0;i<count;i++){const rise=h*(i+1)/count;box(root,x,rise/2,z-i*.45,w,rise,.5,stone);}}
function rail(root,x,z,w,y=1.1){box(root,x,y+.6,z,w,.13,.2,stone);box(root,x,y+.13,z,w,.1,.16,stone);for(let i=-w/2;i<=w/2;i+=1.5){box(root,x+i,y+.37,z,.13,.72,.13,stone);box(root,x+i,y+.87,z,.22,.16,.22,stone);}}
function lantern(root,x,y,z){cylinder(root,x,y,z,.29,.66,mat(0x9d3930,.8),10);cylinder(root,x,y+.37,z,.32,.08,gold,10);bar(root,[x,y-.36,z],[x,y-.72,z],.025,gold);}
function banner(root,x,z,name){
 cylinder(root,x,3.9,z,.075,7.8,red,10);cylinder(root,x,.22,z,.32,.44,stone,10);
 bar(root,[x-.2,7.45,z],[x+1.7,7.45,z],.065,wood);
 const canvas=document.createElement('canvas');canvas.width=160;canvas.height=512;const ctx=canvas.getContext('2d');
 ctx.fillStyle='#c3a576';ctx.fillRect(0,0,160,512);ctx.strokeStyle='#793c2b';ctx.lineWidth=9;ctx.strokeRect(9,9,142,494);ctx.lineWidth=2;ctx.strokeRect(21,21,118,470);
 ctx.fillStyle='#583b2c';ctx.font='46px KaiTi, STKaiti, serif';ctx.textAlign='center';ctx.textBaseline='middle';
 [...name].forEach((char,i)=>ctx.fillText(char,80,95+i*82));
 const map=new THREE.CanvasTexture(canvas);map.encoding=THREE.sRGBEncoding;
 const cloth=mesh(root,new THREE.PlaneGeometry(1.5,4,6,12),new THREE.MeshStandardMaterial({map,roughness:.95,side:THREE.DoubleSide}));
 const p=cloth.geometry.attributes.position;for(let i=0;i<p.count;i++)p.setZ(i,.08*Math.sin(p.getX(i)*4+p.getY(i)*2));cloth.geometry.computeVertexNormals();cloth.position.set(x+.8,5.25,z+.035);
 cylinder(root,x,7.9,z,.13,.2,gold,10);
}
function drumStone(root,x,z){
 box(root,x,.17,z,1.5,.34,1.15,stone);box(root,x,.77,z,.82,1.2,.68,stone);
 const drum=mesh(root,new THREE.CylinderGeometry(.57,.57,.65,24),stone);drum.rotation.x=Math.PI/2;drum.position.set(x,1.48,z);
 for(const side of [-1,1]){const rim=mesh(root,new THREE.TorusGeometry(.45,.055,6,24),stone);rim.position.set(x,1.48,z+side*.34);}
}
function streetLantern(root,x,z){
 cylinder(root,x,.17,z,.45,.34,stone,8);cylinder(root,x,2.1,z,.1,3.7,wood,10);
 box(root,x,4.1,z,.7,.9,.7,wood);box(root,x,4.1,z+.36,.46,.64,.035,mat(0xd4bd83,.85));
 const cap=mesh(root,new THREE.ConeGeometry(.65,.55,4),slate);cap.rotation.y=Math.PI/4;cap.position.set(x,4.85,z);
}
function hall(root,x,z,w,d,h,{tiers=1,name='',base=1}={}){
 box(root,x,base/2,z,w+2,base,d+2,stone);
 for(const side of [-1,1]){
  box(root,x,base-.08,z+side*(d/2+1),w+2,.14,.18,stone);
  for(let xx=-w/2;xx<w/2;xx+=2.4)box(root,x+xx,base/2,z+side*(d/2+1.01),.022,Math.max(.1,base-.16),.016,brick);
 }
 for(let tier=0;tier<tiers;tier++){
  const yy=base+tier*(h+2.2),ww=w*(1-tier*.14),dd=d*(1-tier*.16);
  box(root,x,yy+h/2,z,ww*.86,h,dd*.70,plaster);
  box(root,x,yy+.18,z+dd*.39,ww,.28,.55,red);
  for(const side of [-1,1]){
   box(root,x,yy+h-.15,z+side*dd*.43,ww,.45,.4,red);
   const count=Math.max(4,Math.round(ww/3.2));
   for(let i=0;i<=count;i++){
    const xx=x-ww*.44+i*ww*.88/count;cylinder(root,xx,yy+h/2,z+side*dd*.43,.17,h,red,10);
    box(root,xx,yy+h-.55,z+side*dd*.46,.5,.18,.75,wood);box(root,xx,yy+.1,z+side*dd*.43,.5,.2,.5,stone);
    // Layered timber brackets and a stone plinth keep columns readable nearby.
    box(root,xx,yy+h-.36,z+side*dd*.46,.85,.13,.55,red);
    box(root,xx,yy+h-.23,z+side*dd*.47,1.12,.12,.8,wood);
    box(root,xx,yy+.27,z+side*dd*.43,.4,.12,.4,stone);
    if(i<count){const mid=xx+ww*.44/count;box(root,mid,yy+h*.5,z+side*dd*.355,ww*.78/count,h*.74,.12,wood);
     for(let k=0;k<4;k++)box(root,mid-(ww*.3/count)+k*ww*.2/count,yy+h*.6,z+side*dd*.365,.06,h*.52,.08,gold);
     box(root,mid,yy+h*.37,z+side*dd*.37,ww*.76/count,.07,.09,red);
    }
   }
  }
  roof(root,x,z,ww+3,dd+3,yy+h,2.4+tier*.3);
  if(tier===0){
   const doorW=Math.min(3.2,ww*.2),doorH=h*.72,front=z+dd*.36+.1;
   box(root,x,yy+doorH/2,front,doorW+.3,doorH+.18,.13,dark);
   for(const side of [-1,1]){
    const dx=x+side*doorW/4;box(root,dx,yy+doorH/2,front+.09,doorW/2-.04,doorH,.12,red);
    for(let row=0;row<3;row++)for(let col=0;col<3;col++){
     const stud=mesh(root,new THREE.SphereGeometry(.038,6,4),gold);stud.position.set(dx-doorW*.17+col*doorW*.17,yy+doorH*.25+row*doorH*.23,front+.16);
    }
    const ring=mesh(root,new THREE.TorusGeometry(.12,.025,6,12),gold);ring.position.set(x+side*.24,yy+doorH*.46,front+.2);
   }
   box(root,x,yy+.05,front+.18,doorW+.4,.1,.5,stone);
  }
  if(tier)rail(root,x,z+dd*.51,ww+1,yy);
 }
 stairs(root,x,z+d/2+3.5,w*.43,base);
 if(name)textPanel(root,name,x,base+h-.85,z+d*.44+.3,w*.28,.85,{background:'#283a38',foreground:'#d8bc79',font:60});
}
function gate(root,z,name){
 for(const x of [-4.5,4.5]){box(root,x,2.2,z,2.2,4.4,1.4,plaster);cylinder(root,x,2.3,z+.8,.17,4.6,red,10);lantern(root,x,3.7,z+1.2);}
 box(root,0,4.15,z,11,.9,2,red);roof(root,0,z,13,4.3,4.6,1.1);textPanel(root,name,0,4.15,z+1.06,3,.65,{background:'#34413a',foreground:'#d8bc79'});
}
function enclosure(root,name,style='formal',accessSide=1){
 box(root,0,.025,0,84,.05,84,stone);
 for(const x of [-42,42]){
  const end=style==='garden'?8:42;
  const spans=x===accessSide*42?[[-42,-5],[5,end]]:[[-42,end]];
  for(const [a,b] of spans){const length=b-a,center=(a+b)/2;
   box(root,x,1.5,center,.7,3,length,plaster);box(root,x,3.02,center,1.25,.26,length,slate);box(root,x,.4,center,.9,.8,length,brick);}
  if(style==='garden'){const edge=new THREE.Group();root.add(edge);rail(edge,0,0,34,.15);edge.position.set(x,0,25);edge.rotation.y=Math.PI/2;}
  for(const z of [-35,-14,8]){box(root,x,1.5,z,1,3,1,brick);box(root,x,3.1,z,1.5,.22,1.5,slate);}
 }
 for(const z of [-42,42])for(const [x,w] of (z===42?[[-24,36],[24,36]]:[[0,84]])){
  if(z===42&&style!=='formal'){
   if(style==='garden')rail(root,x,z,w,.15);
   else if(style==='market'){box(root,x,.38,z,w,.7,.65,stone);for(const xx of [x-12,x+12])bed(root,xx,39.5,5,2.5);}
   else {box(root,x,.65,z,w,1.3,.65,brick);box(root,x,1.4,z,w,.18,.85,stone);}
  }else {
   if(z===42){
    // Real openings: four masonry pieces surround a wooden lattice window.
    const half=(w-3.4)/2;for(const side of [-1,1])box(root,x+side*(1.7+half/2),1.5,z,half,3,.7,plaster);
    box(root,x,.55,z,3.4,1.1,.7,plaster);box(root,x,2.65,z,3.4,.7,.7,plaster);
    for(const side of [-1,1]){box(root,x+side*1.62,1.7,z,.14,1.3,.2,wood);box(root,x,1.7+side*.6,z,3.3,.14,.2,wood);}
    for(let xx=-1.35;xx<1.4;xx+=.45)box(root,x+xx,1.7,z,.055,1.1,.1,wood);
    for(const yy of [1.4,2])box(root,x,yy,z,3.1,.055,.1,wood);
   }else box(root,x,1.5,z,w,3,.7,plaster);
   box(root,x,3.02,z,w,.26,1.25,slate);box(root,x,.4,z,w,.8,.9,brick);
  }
 }
 gate(root,42,name);
 const streetGate=new THREE.Group();gate(streetGate,0,name);streetGate.position.x=accessSide*42;streetGate.rotation.y=accessSide*Math.PI/2;root.add(streetGate);
 for(const side of [-1,1]){banner(root,side*12,38,name);drumStone(root,side*6.8,40);streetLantern(root,side*23,38);}
 for(const x of [-36,36])for(const z of [-36,36]){box(root,x,.08,z,9,.12,9,green);}
}
function gardenTrees(root,points){addStreetTrees(root,points,{height:1.3,spread:1.7,fineLeaves:true});}
function palace(root){
 enclosure(root,'长乐坊');hall(root,0,-6,34,23,6.6,{tiers:2,name:'长乐殿',base:1.8});
 for(const side of [-1,1]){
  for(const z of [-25,0,24]){const wing=new THREE.Group();root.add(wing);hall(wing,0,0,21,10,3.8,{base:.45});wing.position.set(side*31,0,z);wing.rotation.y=-side*Math.PI/2;}
  hall(root,side*22,-32,20,10,3.8,{base:.45});
 }
 for(const side of [-1,1])rail(root,side*13,10.5,10.5,1.8);
 paving(root,0,26,32,24);
 for(const side of [-1,1]){bed(root,side*21,30,7,4);bed(root,side*21,18,7,4);}
 gardenTrees(root,[[-20,24],[21,24],[-35,-34],[35,-34]]);
 cloudInlay(root,0,25);bronzeDing(root,-9,17);bronzeDing(root,9,17);
 for(const x of [-13,13])for(const z of [16,25,34]){streetLantern(root,x,z);lantern(root,x,4.1,z);}
 warmPool(root,-13,25);warmPool(root,13,25);
}
function pagoda(root){
 enclosure(root,'大雁塔苑','temple');const towerStone=landmarkMaterial(0xb99c70,.96,'brick');
 const x=-23,z=-16;box(root,x,.8,z,18,1.6,18,stone);
 for(let i=0;i<7;i++){
  const w=15-i*1.55,y=1.6+i*4.1;box(root,x,y+1.95,z,w,3.9,w,towerStone);
  for(const side of [-1,1]){box(root,x,y+1.75,z+side*(w/2+.025),1,1.65,.07,dark);box(root,x+side*(w/2+.025),y+1.75,z,.07,1.65,1,dark);}
  box(root,x,y+3.93,z,w+1,.3,w+1,towerStone);box(root,x,y+4.12,z,w+.45,.13,w+.45,towerStone);
  for(const side of [-1,1]){
   const arch=new THREE.Group();
   box(arch,-.6,y+1.6,0,.16,1.45,.12,towerStone);box(arch,.6,y+1.6,0,.16,1.45,.12,towerStone);
   for(let k=0;k<10;k++){const a=k*Math.PI/10,b=(k+1)*Math.PI/10;bar(arch,[Math.cos(a)*.6,y+2.3+Math.sin(a)*.6,0],[Math.cos(b)*.6,y+2.3+Math.sin(b)*.6,0],.085,towerStone);}
   arch.position.set(x,0,z+side*(w/2+.08));if(side<0)arch.rotation.y=Math.PI;root.add(arch);
  }
 }
 const tip=mesh(root,new THREE.ConeGeometry(1.7,2.7,4),towerStone);tip.position.set(x,31.5,z);tip.rotation.y=Math.PI/4;
 stairs(root,x,z+12,9,1.6);hall(root,15,-19,25,17,5.4,{name:'慈恩殿',base:1.2});hall(root,15,14,25,17,5.4,{base:1.2});
 hall(root,-25,24,16,12,3.8,{base:.5});
 paving(root,-5,20,6,38);paving(root,16,-2,29,7);
 gardenTrees(root,[[-33,-31],[-10,-32],[34,-28],[34,-7],[34,18],[-8,22],[-31,9],[-10,34]]);
 for(const [xx,zz] of [[-8,5],[30,32],[30,0]]){cylinder(root,xx,.14,zz,4,.26,stone,24);cylinder(root,xx,.28,zz,3.8,.06,green,24);addFineFoliage(root,[[xx-1.6,zz],[xx+1.6,zz]]);}
 culturalStele(root,-7,31,'雁塔题名');
 for(const x of [-4,5]){streetLantern(root,x,34);}
 for(const [xx,zz] of [[-32,4],[-12,-30],[30,28]]){bed(root,xx,zz,6,3);}
}
function bellWard(root){
 enclosure(root,'钟楼里','market',-1);hall(root,14,8,20,22,6.2,{tiers:2,name:'钟楼',base:3.2});
 for(const side of [-1,1])rail(root,14+side*8.5,21,7,3.2);
 for(const side of [-1,1])for(let i=0;i<4;i++){
  const group=new THREE.Group();root.add(group);hall(group,0,0,15,9,3.5,{base:.3});group.position.set(side*33,0,-29+i*17);group.rotation.y=-side*Math.PI/2;
  textPanel(group,['秦风茶馆','长安书肆','百味斋','锦绣坊'][i],0,2.8,4.12,5,.65,{background:'#583a2b',foreground:'#e0c18b'});
  lantern(group,-5,2.8,5);lantern(group,5,2.8,5);
 }
 hall(root,-9,-31,34,11,4,{name:'长安集',base:.5});hall(root,-17,26,23,12,3.8,{name:'秦风茶馆',base:.4});
 const canopy=mesh(root,new THREE.PlaneGeometry(15,4),mat(0xb9a27c,.92));canopy.rotation.x=-Math.PI*.36;canopy.position.set(-17,3.4,34);
 gardenTrees(root,[[-33,-35],[34,-35],[-32,35]]);
 paving(root,-7,4,24,35);bed(root,-8,-16,11,3);
 for(const x of [-16,-7,2]){box(root,x,1.05,-20,2.7,2.1,1.6,wood);roof(root,x,-20,3.4,2.3,2.2,.65);lantern(root,x,2.4,-18.6);}
 for(let i=0;i<4;i++){
  const x=[-30,-19,19,30][i];hall(root,x,37,9,5,2.7,{base:.12});
  textPanel(root,['秦腔茶社','长安食肆','碑帖书坊','唐锦铺','关中百味'][i],x,2.45,39.1,6,.7,{background:'#673b29',foreground:'#e4c18b'});
  lantern(root,x-3.8,2.8,40);lantern(root,x+3.8,2.8,40);
  for(let j=0;j<3;j++)box(root,x-2+j*2,.72,40,1.4,1.2,.7,mat([0xa67d4b,0x805a3a,0xc6ab77][j],.9));
  const awning=new THREE.Group();
  for(let k=0;k<8;k++)box(awning,-3.5+k,0,0,1,.045,1.6,k%2?wood:mat(0xc2a479,.96));
  awning.position.set(x,2.3,40);awning.rotation.x=.16;root.add(awning);
  for(const side of [-1,1])bar(root,[x+side*3.6,.15,40.6],[x+side*3.6,2.2,40.6],.045,wood);
 }
 warmPool(root,-16,36);warmPool(root,18,36);
}
function pavilion(root,x,z,size=10){
 cylinder(root,x,.32,z,size*.72,.46,stone,24);
 for(let i=0;i<8;i++){const angle=i*Math.PI/4;cylinder(root,x+Math.cos(angle)*size*.34,2.6,z+Math.sin(angle)*size*.34,.12,4.8,red,8);}
 roof(root,x,z,size,size,5,2);roof(root,x,z,size*.73,size*.73,7.5,1.5);
 cylinder(root,x,9.25,z,.13,.65,gold,8);
 for(let i=0;i<8;i++){
  const a=i*Math.PI/4,b=(i+1)*Math.PI/4,r=size*.34;
  if(i===1||i===5)continue;
  bar(root,[x+Math.cos(a)*r,.95,z+Math.sin(a)*r],[x+Math.cos(b)*r,.95,z+Math.sin(b)*r],.075,wood);
  const mx=x+(Math.cos(a)+Math.cos(b))*r/2,mz=z+(Math.sin(a)+Math.sin(b))*r/2;
  cylinder(root,mx,.65,mz,.055,.6,red,6);
 }
}
function willow(root,x,z){
 cylinder(root,x,3,z,.22,6,wood,9);const leaves=mat(0x7f9860,.96);
 for(let i=0;i<10;i++){const a=i*Math.PI/5,xx=x+Math.cos(a)*2.8,zz=z+Math.sin(a)*2.8;
  bar(root,[x,4.6,z],[xx,6.2,zz],.09,wood);
  for(let j=0;j<3;j++){
   const offset=(j-1)*.48,crown=mesh(root,new THREE.SphereGeometry(1,10,8),leaves);
   crown.position.set(xx+Math.cos(a+Math.PI/2)*offset,4.2-j*.35,zz+Math.sin(a+Math.PI/2)*offset);
   crown.scale.set(.44,1.8+j*.18,.48);crown.rotation.z=Math.cos(a)*.13;
   bar(root,[xx,6.2,zz],[crown.position.x,2.2-j*.3,crown.position.z],.02,leaves);
  }
 }
}
function park(root){
 enclosure(root,'曲江坊','garden',-1);box(root,0,.07,0,80,.05,80,green);
 const shape=new THREE.Shape();shape.moveTo(-26,-29);shape.bezierCurveTo(-39,-10,-35,15,-21,29);shape.bezierCurveTo(-5,37,28,34,31,17);shape.bezierCurveTo(40,-4,28,-31,12,-33);shape.bezierCurveTo(-1,-38,-16,-35,-26,-29);
 for(const [x,z,r] of [[-14,14,9],[16,-14,8],[10,20,7]]){const hole=new THREE.Path();hole.absarc(x,-z,r,0,Math.PI*2,true);shape.holes.push(hole);cylinder(root,x,.17,z,r+.6,.25,stone,32);cylinder(root,x,.32,z,r,.18,green,32);pavilion(root,x,z,9);}
 const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const ctx=canvas.getContext('2d'),pixels=ctx.createImageData(256,256);
 for(let y=0;y<256;y++)for(let x=0;x<256;x++){const i=(y*256+x)*4;pixels.data[i]=128+Math.sin((x+y)*Math.PI/16)*13;pixels.data[i+1]=128+Math.cos(y*Math.PI/16)*13;pixels.data[i+2]=255;pixels.data[i+3]=255;}ctx.putImageData(pixels,0,0);
 const normal=new THREE.CanvasTexture(canvas);normal.wrapS=normal.wrapT=THREE.RepeatWrapping;normal.repeat.set(.045,.045);
 const water=new THREE.MeshPhysicalMaterial({color:0x6c9992,roughness:.25,metalness:.18,clearcoat:1,clearcoatRoughness:.22,envMapIntensity:.7,normalMap:normal,normalScale:new THREE.Vector2(.16,.16)});
 const lake=mesh(root,new THREE.ShapeGeometry(shape,32),water);lake.rotation.x=-Math.PI/2;lake.position.y=.18;lake.castShadow=false;
 const shore=shape.getPoints(48),edge=[];
 const bank=(i,offset)=>{const p=shore[i],a=shore[(i+shore.length-2)%(shore.length-1)],b=shore[(i+1)%(shore.length-1)],dx=b.x-a.x,dz=-(b.y-a.y),length=Math.hypot(dx,dz);let nx=-dz/length,nz=dx/length;if(nx*p.x-nz*p.y<0){nx=-nx;nz=-nz;}return [p.x+nx*offset,.23,-p.y+nz*offset];};
 for(let i=1;i<shore.length;i++){const a=bank(i-1,0),b=bank(i,0),c=bank(i,1.6),d=bank(i-1,1.6);edge.push(...a,...c,...b,...a,...d,...c);}
 const bankGeometry=new THREE.BufferGeometry();bankGeometry.setAttribute('position',new THREE.Float32BufferAttribute(edge,3));bankGeometry.computeVertexNormals();stone.side=THREE.DoubleSide;mesh(root,bankGeometry,stone);
 // Narrow stone crossings link the islands instead of leaving isolated pavilions.
 for(const [a,b] of [[[-14,14],[-30,14]],[[16,-14],[30,-18]],[[10,20],[22,30]]]){
  const dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz),angle=-Math.atan2(dz,dx);
  box(root,(a[0]+b[0])/2,.35,(a[1]+b[1])/2,length,.24,2.4,stone,angle);
  for(let k=1;k<length;k+=2)for(const side of [-1,1]){const t=k/length;const x=a[0]+dx*t-dz/length*side*1.1,z=a[1]+dz*t+dx/length*side*1.1;cylinder(root,x,.92,z,.065,1.1,stone,7);}
 }
 hall(root,-23,-27,20,13,4.5,{name:'曲江亭',base:.55});
 const bridge=new THREE.Group();root.add(bridge);bridge.position.set(-5,0,32);bridge.rotation.y=-.35;
 for(let i=0;i<12;i++){const t=(i+.5)/12,y=.45+1.6*Math.sin(t*Math.PI);box(bridge,0,y,-7+t*14,4,.4,14/12+.02,stone);for(const side of [-1,1]){cylinder(bridge,side*1.9,y+.7,-7+t*14,.09,1.4,stone,8);box(bridge,side*1.9,y+1.35,-7+t*14,.17,.18,1.3,stone);}}
 for(const [x,z] of [[-34,-18],[-32,5],[32,25],[32,-22],[0,-34],[-21,33]])willow(root,x,z);
 gardenTrees(root,[[33,-34],[-35,28],[30,4],[-7,-32],[22,34]]);
 gardenTrees(root,[[-36,-29],[-36,-5],[-36,17],[-27,36],[0,37],[15,37],[36,35],[37,15],[37,-7],[22,-36],[8,-37],[-17,-37]]);
 addFineFoliage(root,[[-28,30],[-30,20],[-30,-10],[28,-27],[29,29],[18,33],[-17,-32],[5,-32],[31,10]]);
 for(let i=0;i<15;i++){const a=i*2.399,x=Math.cos(a)*32,z=Math.sin(a)*29;const rock=mesh(root,new THREE.IcosahedronGeometry(1,1),stone);rock.position.set(x,.55,z);rock.scale.set(1.4,.8,1.1);}
 culturalStele(root,22,32,'曲江流饮');
 const stream=new THREE.CatmullRomCurve3([new THREE.Vector3(-31,.22,24),new THREE.Vector3(-24,.22,30),new THREE.Vector3(-15,.22,28),new THREE.Vector3(-7,.22,33)]);
 const ribbon=mesh(root,new THREE.TubeGeometry(stream,32,.5,6,false),water);ribbon.scale.y=.15;ribbon.position.y=.2;ribbon.castShadow=false;
 for(const [x,z] of [[-28,29],[-18,33],[-10,31]]){box(root,x,.3,z,2,.6,.8,stone);}
}
function outerCourtyard(root,index){
 const h=3.1+(index%3)*.55;
 box(root,0,.06,0,18,.12,18,stone);
 const houses=index%3===0?[[0,-3,14,9]]:index%3===1?[[-3,-3,9,9],[5,-1,5,13]]:[[0,-4,14,7],[-6,3,4,7]];
 for(const [x,z,w,d] of houses){
  box(root,x,h/2,z,w,h,d,plaster);box(root,x,.2,z,w+.4,.4,d+.4,brick);
  roof(root,x,z,w+1.2,d+1.2,h,1.7,false);
  for(let xx=-w/2+1;xx<w/2;xx+=2.2){box(root,x+xx,1.7,z+d/2+.025,1.1,1.35,.08,wood);box(root,x+xx,1.7,z+d/2+.08,.045,1.3,.05,gold);}
  box(root,x,1.2,z+d/2+.1,1.3,2.4,.12,red);
 }
 for(const side of [-1,1]){box(root,side*8.7,.7,0,.35,1.4,17,plaster);box(root,side*8.7,1.45,0,.55,.15,17,slate);}
 box(root,0,.7,-8.5,17,1.4,.35,plaster);
 for(const side of [-1,1]){box(root,side*5.5,.65,8.5,6,1.3,.35,brick);box(root,side*5.5,1.35,8.5,6,.16,.55,slate);}
}
export function addXianQuarter(parent,plan){
 const root=new THREE.Group();root.name='西安 · 长安四坊';root.userData.xianWards=[];parent.add(root);
 for(const ward of plan.wards){
  const local=new THREE.Group();local.name=ward.name;local.userData.wardKind=ward.kind;
  ({changle:palace,qujiang:park,pagoda,bell:bellWard})[ward.kind](local);
  dailyLife(local,ward.kind);
  prepareLandmarkMaterials(local);mergeStaticByMaterial(local);
  local.position.set(ward.origin[0],0,-ward.origin[1]);local.rotation.y=ward.angle;root.add(local);root.userData.xianWards.push(ward.kind);
 }
 const context=new THREE.Group(),outerTrees=[];
 for(const [i,b] of plan.background.entries()){const local=new THREE.Group();outerCourtyard(local,i);
  local.position.set(b.origin[0],0,-b.origin[1]);local.rotation.y=b.angle+(i%4===0?Math.PI:0);context.add(local);
  if(i%4===0){const a=b.angle;outerTrees.push([b.origin[0]+Math.cos(a)*6-Math.sin(a)*6,-b.origin[1]-Math.sin(a)*6-Math.cos(a)*6]);}
 }
 prepareLandmarkMaterials(context);mergeStaticByMaterial(context);root.add(context);
 addStreetTrees(root,outerTrees,{height:1.1,spread:1.05,fineLeaves:false});
 const trees=[];
 for(const [index,item] of (plan.furniture||[]).entries()){
  const local=new THREE.Group();
  if(item.kind==='tree'){
   cylinder(local,0,.12,0,1.8,.24,stone,20);cylinder(local,0,.25,0,1.6,.035,green,20);
   trees.push([item.origin[0],-item.origin[1]]);
   if(index%2===0)streetLantern(local,1.6,0);
  }else if(item.kind==='planter'){
   box(local,0,.23,0,3.4,.46,1.8,stone);box(local,0,.47,0,3.1,.04,1.5,green);
   addFineFoliage(local,[[-.6,0],[.6,0]]);
   if(index%3===0){cylinder(local,1.3,1.7,0,.035,3.4,wood,8);
   textPanel(local,'长安',1.3,2.6,.05,.6,.9,{background:'#9a603d',foreground:'#ead6ac'});}
  }else{
   for(const x of [-1.3,1.3])box(local,x,.25,0,.35,.5,.8,stone);
   box(local,0,.56,0,3.2,.16,.85,wood);box(local,0,.92,-.32,3.2,.55,.13,wood);
  }
  prepareLandmarkMaterials(local);mergeStaticByMaterial(local);local.position.set(item.origin[0],0,-item.origin[1]);local.rotation.y=item.angle;root.add(local);
 }
 addStreetTrees(root,trees,{height:1.3,spread:1.15,fineLeaves:true});
 return root;
}

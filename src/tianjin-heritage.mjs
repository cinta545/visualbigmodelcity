import * as THREE from 'three';
import {box,cylinder,mat,textPanel} from './district/materials.js';
import {landmarkMaterial,prepareLandmarkMaterials} from './changchun-landmark-materials.mjs';
import {mergeStaticByMaterial} from './chongqing-night.mjs';
import {addStreetTrees} from './city-trees.mjs';

// Reference-inspired exhibits occupy existing audited plots, not actual landmark coordinates.
const stone=landmarkMaterial(0xd4bc91,.9,'stone'),cream=landmarkMaterial(0xe2d2ad,.95,'plaster');
const brick=landmarkMaterial(0x985944,.93,'brick'),tile=landmarkMaterial(0x854c36,.9,'slate');
const dark=mat(0x293b3b,.48),iron=mat(0x414940,.5,.55),gold=mat(0xb49559,.6,.35);
const timber=landmarkMaterial(0x604532,.87,'wood'),leaf=mat(0x61764f,.96);
function entrance(root,z,wood=timber){
 box(root,0,1.22,z,1.35,2.35,.12,wood);
 for(const x of [-.34,.34]){
  box(root,x,1.64,z+.075,.49,.85,.035,dark);
  box(root,x,.51,z+.075,.49,.55,.045,wood);
  for(const side of [-1,1])box(root,x+side*.255,1.23,z+.09,.045,2.15,.035,stone);
  box(root,x,1.16,z+.11,.055,2.2,.035,wood);
  rod(root,[x+(x<0?.2:-.2),.98,z+.16],[x+(x<0?.2:-.2),1.22,z+.16],.023,gold);
 }
 box(root,0,2.42,z+.07,1.55,.12,.19,stone);
}
function planter(root,x,z,width=1.4){
 box(root,x,.24,z,width,.48,.6,stone);box(root,x,.49,z,width-.12,.045,.48,timber);
 for(let i=0;i<5;i++){
  const px=x-width*.34+i*width*.17;
  const shrub=mesh(root,new THREE.SphereGeometry(.22,8,6),leaf,px,.65,z);shrub.scale.y=.75;
  mesh(root,new THREE.SphereGeometry(.045,6,4),mat(i%2?0xb57b7d:0xd9bf83,.9),px+.06,.78,z+.05);
 }
}
function shopfront(root,x,z,label){
 for(const dx of [-.6,.6]){
  box(root,x+dx,1.3,z,1.08,2.3,.045,dark);
  box(root,x+dx,1.3,z+.045,.055,2.3,.06,timber);
  box(root,x+dx,1.22,z+.045,1.1,.055,.06,timber);
  box(root,x+dx,.3,z+.045,1.1,.34,.07,timber);
 }
 for(const dx of [-1.2,0,1.2])box(root,x+dx,1.3,z+.08,.085,2.45,.12,timber);
 textPanel(root,label,x,2.68,z+.09,2.5,.36,{background:'#594435',foreground:'#eadac0'});
}
function mesh(root,geometry,material,x=0,y=0,z=0){const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;root.add(m);return m;}
function rod(root,a,b,r,material=stone){const p=new THREE.Vector3(...a),q=new THREE.Vector3(...b),v=q.clone().sub(p);const m=mesh(root,new THREE.CylinderGeometry(r,r,v.length(),8),material);m.position.copy(p.add(q).multiplyScalar(.5));m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize());}
function arch(root,x,y,z,w,h,trim=stone){
 const r=w/2,shoulder=h-r,shape=new THREE.Shape();shape.moveTo(-r,0);shape.lineTo(r,0);shape.lineTo(r,shoulder);shape.absarc(0,shoulder,r,0,Math.PI,false);shape.lineTo(-r,0);
 mesh(root,new THREE.ShapeGeometry(shape,14),dark,x,y,z);
 rod(root,[x-r,y,z+.04],[x-r,y+shoulder,z+.04],.075,trim);rod(root,[x+r,y,z+.04],[x+r,y+shoulder,z+.04],.075,trim);
 for(let i=0;i<12;i++){const a=i*Math.PI/12,b=(i+1)*Math.PI/12;rod(root,[x+Math.cos(a)*r,y+shoulder+Math.sin(a)*r,z+.04],[x+Math.cos(b)*r,y+shoulder+Math.sin(b)*r,z+.04],.075,trim);}
 for(let i=0;i<9;i++){
  const a=(i+.5)*Math.PI/9,block=box(root,x+Math.cos(a)*(r+.08),y+shoulder+Math.sin(a)*(r+.08),z+.07,.18,.15,.18,trim);
  block.rotation.z=a-Math.PI/2;
 }
 box(root,x,y+h+.04,z+.1,.22,.22,.23,trim);
 box(root,x,y+h*.43,z+.05,.05,h*.82,.05,trim);box(root,x,y+h*.48,z+.05,w,.055,.05,trim);
 box(root,x,y-.08,z+.08,w+.3,.16,.3,trim);
}
function hip(root,x,z,w,d,y,rise,material=tile){
 const v=[x-w/2,y,z-d/2,x+w/2,y,z-d/2,x+w/2,y,z+d/2,x-w/2,y,z+d/2,x-w*.22,y+rise,z,x+w*.22,y+rise,z];
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(v,3));g.setIndex([0,4,5,0,5,1,1,5,2,2,5,4,2,4,3,3,4,0]);g.computeVertexNormals();material.side=THREE.DoubleSide;mesh(root,g,material);
 for(const side of [-1,1])box(root,x,y,z+side*d/2,w,.18,.22,stone);
 rod(root,[x-w*.22,y+rise,z],[x+w*.22,y+rise,z],.1,material);
 for(const side of [-1,1])for(let xx=-w*.44;xx<=w*.44;xx+=.62){
  const ridgeX=x+THREE.MathUtils.clamp(xx,-w*.22,w*.22);
  rod(root,[x+xx,y+.04,z+side*d/2],[ridgeX,y+rise+.04,z],.035,material);
 }
}
function balcony(root,x,y,z,w){
 box(root,x,y,z,w,.22,1.3,stone);box(root,x,y+.95,z+.56,w,.12,.13,stone);
 for(let dx=-w/2;dx<=w/2;dx+=.5)box(root,x+dx,y+.5,z+.56,.08,.9,.08,stone);
 for(const side of [-1,1])rod(root,[x+side*(w/2-.45),y-.65,z-.32],[x+side*(w/2-.45),y,z+.4],.12,stone);
}
function frontage(root,w,d,floors,material=brick){
 const h=floors*3.3;box(root,0,h/2,0,w,h,d,material);
 for(let floor=0;floor<floors;floor++){
  const y=floor*3.3;
  for(const side of [-1,1]){
   const face=new THREE.Group();face.rotation.y=side<0?Math.PI:0;root.add(face);
   for(let x=-w/2+1.8;x<w/2-1;x+=3.6)arch(face,x,y+.55,d/2+.025,1.5,2.2);
   box(face,0,y+3.24,d/2+.08,w+.3,.17,.25,stone);
   box(face,0,y+3.06,d/2+.14,w+.5,.13,.38,cream);
   for(const x of [-w/2,w/2]){
    box(face,x,y+1.6,d/2+.14,.28,3.1,.16,stone);
    box(face,x,y+2.95,d/2+.18,.5,.2,.26,stone);
   }
  }
  for(const side of [-1,1]){const face=new THREE.Group();face.position.x=side*w/2;face.rotation.y=side*Math.PI/2;root.add(face);for(let x=-d/2+1.8;x<d/2-1;x+=3.6)arch(face,x,y+.55,.025,1.5,2.2);}
 }
 for(const x of [-w/2,w/2])box(root,x,h/2,d/2+.12,.35,h,.24,stone);
 box(root,0,.2,0,w+.4,.4,d+.4,stone);box(root,0,h+.15,0,w+.6,.3,d+.6,stone);
 for(const x of [-.8,.8])cylinder(root,x,1.3,d/2+.18,.11,2.6,stone,12);
 box(root,0,2.75,d/2+.22,2.4,.23,.48,stone);
 for(let i=0;i<4;i++){const height=(i+1)*.1;box(root,0,height/2,d/2+.9-i*.2,2.4,height,.24,stone);}
 entrance(root,d/2+.26);
 return h;
}
function dome(root,x,z,y,r,material=tile){
 cylinder(root,x,y-.45,z,r*.9,.9,stone,24);
 const cap=mesh(root,new THREE.SphereGeometry(r,24,12,0,Math.PI*2,0,Math.PI/2),material,x,y,z);cap.scale.y=1.1;
 cylinder(root,x,y+r*1.1+.25,z,.1,.5,gold,8);
 for(let i=0;i<8;i++){
  const a=i*Math.PI/4,points=[];
  for(let k=0;k<=10;k++){const t=k*Math.PI/20;points.push(new THREE.Vector3(x+Math.sin(t)*r*Math.cos(a),y+Math.cos(t)*r*1.1,z+Math.sin(t)*r*Math.sin(a)));}
  mesh(root,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),14,.025,5,false),gold);
 }
}
function minyuan(root){
 const rx=10,rz=7.6,n=28;
 for(const y of [4.4,8.9]){
  const shape=new THREE.Shape();shape.absellipse(0,0,10.35,7.95,0,Math.PI*2,false,0);
  const hole=new THREE.Path();hole.absellipse(0,0,8.3,5.9,0,Math.PI*2,true,0);shape.holes.push(hole);
  const slab=mesh(root,new THREE.ExtrudeGeometry(shape,{depth:.22,bevelEnabled:false,curveSegments:48}),stone);slab.rotation.x=-Math.PI/2;slab.position.y=y;
 }
 const field=mesh(root,new THREE.CircleGeometry(1,48),mat(0x809467,.94));field.rotation.x=-Math.PI/2;field.scale.set(8,5.5,1);field.position.y=.035;
 for(let i=0;i<n;i++){
  const a=i*2*Math.PI/n,b=(i+1)*2*Math.PI/n;
  for(const level of [0,4.5]){
   const x=Math.cos(a)*rx,z=Math.sin(a)*rz;
   cylinder(root,x,level+1.65,z,.22,3.3,stone,12);cylinder(root,x,level+.1,z,.35,.2,stone,12);
   cylinder(root,x,level+3.12,z,.32,.19,stone,12);
   const points=[];for(let k=0;k<=12;k++){const t=k/12,aa=a+(b-a)*t;points.push([Math.cos(aa)*rx,level+3.15+Math.sin(t*Math.PI)*.8,Math.sin(aa)*rz]);}
   for(let k=1;k<points.length;k++)rod(root,points[k-1],points[k],.13);
   const chord=Math.hypot((Math.cos(b)-Math.cos(a))*rx,(Math.sin(b)-Math.sin(a))*rz),panel=new THREE.Shape();
   panel.moveTo(-chord/2,level+4.3);panel.lineTo(-chord/2,level+3.15);
   for(let k=1;k<=16;k++){const t=k/16;panel.lineTo(-chord/2+t*chord,level+3.15+Math.sin(t*Math.PI)*.8);}
   panel.lineTo(chord/2,level+4.3);panel.closePath();
   const spandrel=mesh(root,new THREE.ExtrudeGeometry(panel,{depth:.28,bevelEnabled:false}),cream);
   spandrel.position.set((Math.cos(a)+Math.cos(b))*rx/2,0,(Math.sin(a)+Math.sin(b))*rz/2);
   spandrel.rotation.y=-Math.atan2((Math.sin(b)-Math.sin(a))*rz,(Math.cos(b)-Math.cos(a))*rx);
  }
  for(const y of [4.35,8.8])rod(root,[Math.cos(a)*rx,y,Math.sin(a)*rz],[Math.cos(b)*rx,y,Math.sin(b)*rz],.25);
  const mid=(a+b)/2,length=Math.hypot((Math.cos(b)-Math.cos(a))*rx,(Math.sin(b)-Math.sin(a))*rz);
  box(root,Math.cos(mid)*rx,8.55,Math.sin(mid)*rz,length+.08,.55,.45,cream,-Math.atan2((Math.sin(b)-Math.sin(a))*rz,(Math.cos(b)-Math.cos(a))*rx));
  rod(root,[Math.cos(a)*rx,9.25,Math.sin(a)*rz],[Math.cos(b)*rx,9.25,Math.sin(b)*rz],.08);
  cylinder(root,Math.cos(a)*rx,9.03,Math.sin(a)*rz,.08,.55,stone,8);
  mesh(root,new THREE.SphereGeometry(.12,8,6),stone,Math.cos(a)*rx,9.32,Math.sin(a)*rz);
 }
 for(const side of [-1,1]){box(root,0,4.7,side*7.6,3.6,9.4,2,cream);arch(root,0,.2,side*8.63,2.1,3.6);dome(root,0,side*7.6,9.4,1.7);}
 box(root,0,.055,0,2,.055,11,stone);box(root,0,.055,0,16,.055,1.2,stone);
 for(const x of [-4.5,4.5])for(const z of [-2.5,2.5]){
  cylinder(root,x,.15,z,.9,.3,stone,16);cylinder(root,x,.33,z,.8,.1,mat(0x6c8959,.94),16);
  cylinder(root,x,.7,z,.62,.65,mat(0x718a57,.94),12);
 }
 textPanel(root,'民园广场',0,5.2,8.65,3.3,.65,{background:'#a08561',foreground:'#f5e7c9'});
 entrance(root,8.66);
 for(const x of [-5,5]){
  box(root,x,.47,0,.6,.12,2.4,timber);
  for(const z of [-.85,.85])box(root,x,.23,z,.48,.46,.16,iron);
  box(root,x-.23,.75,0,.08,.55,2.4,timber);
 }
 for(const x of [-3.2,3.2])planter(root,x,4.5,1.7);
}
function porcelainMaterial(){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const ctx=canvas.getContext('2d');ctx.fillStyle='#e4dcc6';ctx.fillRect(0,0,256,256);
 for(let y=0;y<256;y+=16)for(let x=0;x<256;x+=16){ctx.strokeStyle='#9d9f97';ctx.lineWidth=1;ctx.strokeRect(x,y,16,16);ctx.strokeStyle=(x+y)%48===0?'#466890':'#a6b1b9';ctx.beginPath();ctx.arc(x+8,y+8,4,0,Math.PI*2);ctx.stroke();}
 const map=new THREE.CanvasTexture(canvas);map.wrapS=map.wrapT=THREE.RepeatWrapping;map.repeat.set(.8,.8);map.encoding=THREE.sRGBEncoding;
 const m=new THREE.MeshStandardMaterial({map,roughness:.43,metalness:.04,envMapIntensity:.65});m.userData.landmarkSurface='glaze';return m;
}
function porcelain(root){
 const china=porcelainMaterial(),blue=landmarkMaterial(0x476a90,.4,'glaze');
 frontage(root,16,12,3,china);
 hip(root,0,0,17,13,10,2.7,blue);
 for(const x of [-6,-2,2,6]){
  const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(x-1.8,10,6.65),new THREE.Vector3(x-1.5,11.2,6.65),new THREE.Vector3(x,12.1,6.3),new THREE.Vector3(x+1.5,11.2,6.65),new THREE.Vector3(x+1.8,10,6.65)]);
  mesh(root,new THREE.TubeGeometry(curve,20,.16,8,false),china);
  for(const y of [3.25,6.55,9.85]){const sweep=new THREE.CatmullRomCurve3([new THREE.Vector3(x-1.8,y,6.2),new THREE.Vector3(x,y-.5,6.8),new THREE.Vector3(x+1.8,y,6.2)]);mesh(root,new THREE.TubeGeometry(sweep,16,.13,8,false),china);}
 }
 for(const x of [-7,7])for(let y=.6;y<10;y+=.5){const bead=mesh(root,new THREE.SphereGeometry(.2,8,6),china,x,y,6.25);bead.scale.y=1.2;}
 // Blue-white ceramic bands stay legible beyond the tiny surface mosaic texture.
 for(const y of [.45,3.15,6.45,9.75])for(let i=0;i<32;i++)box(root,-7.75+i*.5,y,6.24,.36,.28,.08,i%3===0?blue:china);
 for(const x of [-7.9,7.9])for(let i=0;i<28;i++)box(root,x,.7+i*.33,6.23,.26,.23,.1,i%4===0?blue:china);
 for(const x of [-4.5,0,4.5]){
  const y=10.1+(x===0?.45:0);
  box(root,x,y+.8,4.1,2.6,1.6,.25,china);
  const cap=mesh(root,new THREE.SphereGeometry(1.3,20,10,0,Math.PI*2,0,Math.PI/2),china,x,y+1.6,4.1);cap.scale.z=.22;
  arch(root,x,y+.2,4.41,1.2,1.8,china);
  for(const side of [-1,1]){const ball=mesh(root,new THREE.SphereGeometry(.25,12,8),china,x+side*1.25,y+1.7,4.1);ball.scale.y=1.35;}
 }
 for(const x of [-6,6]){cylinder(root,x,10.5,-3,.4,1.1,china,16);dome(root,x,-3,11.05,.55,blue);}
 for(const x of [-5.6,-2,1.6,5.2])for(const y of [3.6,6.9]){
  const medallion=mesh(root,new THREE.TorusGeometry(.3,.07,7,20),china,x,y,6.22);
  for(let i=0;i<6;i++){const a=i*Math.PI/3,petal=mesh(root,new THREE.SphereGeometry(.08,8,6),blue,x+Math.cos(a)*.16,y+Math.sin(a)*.16,6.23);petal.scale.z=.45;}
 }
 for(const side of [-1,1]){box(root,side*6,.7,8,3.7,1.4,.6,china);for(let x=side*6-1.5;x<=side*6+1.5;x+=.5)cylinder(root,x,1.55,8,.15,.3,blue,8);}
 for(const side of [-1,1]){
  const face=new THREE.Group();face.position.x=side*8.02;face.rotation.y=side*Math.PI/2;root.add(face);
  for(const y of [.45,3.15,6.45,9.75])for(let i=0;i<24;i++)box(face,-5.75+i*.5,y,.09,.34,.22,.08,i%3===0?blue:china);
 }
 textPanel(root,'瓷房子',0,3,6.85,3,.65,{background:'#ebe0c9',foreground:'#41617c'});
}
function geda(root){
 frontage(root,16,12,4,brick);
 for(const y of [3.3,6.6,9.9])balcony(root,-3,y,6.8,7);
 for(const side of [-1,1])for(let y=.7;y<12.5;y+=.55)box(root,side*7.9,y,6.15,.5,.32,.35,stone);
 box(root,-3,14.2,0,9,2,8,cream);hip(root,-3,0,10,9,15.2,1.7);
 box(root,5,14.1,-3,4,1.8,5,brick);hip(root,5,-3,5,6,15,1.3);
 arch(root,0,.2,6.3,2.4,3);textPanel(root,'疙瘩楼',4,11,6.2,2,.6,{background:'#d5bc98',foreground:'#6c4636'});
 entrance(root,6.34);
 for(const y of [3.3,6.6,9.9]){
  box(root,-3,y+.28,7.1,4.7,.45,.46,stone);
  for(const x of [-4.8,-3,-1.2]){cylinder(root,x,y+.63,7.1,.27,.22,mat(0x72825c,.96),10);}
  box(root,4.7,y+1.45,6.43,3,2.4,.7,brick);
  arch(root,4.7,y+.5,6.81,1.5,2.1);
  box(root,4.7,y+2.77,6.45,3.3,.18,.85,stone);
 }
}
function stripedAwning(root,x,z){
 const g=new THREE.Group();g.position.set(x,2.4,z);g.rotation.x=.13;root.add(g);
 for(let i=0;i<8;i++)box(g,-1.75+i*.5,0,0,.5,.08,1.5,i%2?mat(0x697d67,.9):cream);
 for(const side of [-1,1])rod(root,[x+side*1.8,1.85,z-.3],[x+side*1.8,2.32,z+.65],.035,iron);
}
function italian(root){
 frontage(root,17,12,3,cream);hip(root,0,0,18,13,10,2.6);
 cylinder(root,0,10.8,5,2.5,3.5,cream,24);dome(root,0,5,12.5,2.6);
 for(const y of [3.3,6.6])balcony(root,0,y,6.6,8);
 for(let i=0;i<12;i++){const a=i*Math.PI*2/12;const local=new THREE.Group();local.position.set(Math.sin(a)*2.5,0,5+Math.cos(a)*2.5);local.rotation.y=a;arch(local,0,10.1,.05,.7,1.5);root.add(local);}
 textPanel(root,'意式风情街',0,3.05,7.35,5,.65,{background:'#9f7248',foreground:'#f7e6bd'});
 for(const x of [-5,5]){
  stripedAwning(root,x,6.8);cylinder(root,x,.75,7.9,.6,.13,stone,16);cylinder(root,x,.4,7.9,.055,.7,iron,8);
  for(const side of [-1,1]){
   const cx=x+side*1.1;box(root,cx,.48,7.9,.5,.08,.55,mat(0x8d6947,.93));
   box(root,cx,.76,7.66,.5,.5,.06,mat(0x8d6947,.93));
   for(const dx of [-.19,.19])for(const dz of [-.2,.2])rod(root,[cx+dx,.02,7.9+dz],[cx+dx,.45,7.9+dz],.025,iron);
  }
  cylinder(root,x,.86,7.9,.06,.1,cream,10);
 }
 textPanel(root,'津门咖啡',-5,2.95,6.8,3.4,.4,{background:'#765237',foreground:'#ead5af'});
 textPanel(root,'海河书房',5,2.95,6.8,3.4,.4,{background:'#765237',foreground:'#ead5af'});
 shopfront(root,-5,6.3,'津门咖啡');shopfront(root,5,6.3,'海河书房');
 for(const x of [-7.4,7.4])planter(root,x,7.5,1.1);
}
export function addTianjinHeritage(parent,config){
 const root=new THREE.Group();root.name='天津 · 津门历史街区';root.userData.tianjinHeritage=[];parent.add(root);
 const kinds=['民园广场','瓷房子','疙瘩楼','意式风情街'],builders=[minyuan,porcelain,geda,italian],trees=[];
 for(const [i,b] of config.buildings.entries()){
  const [x0,y0,x1,y1]=b.bounds,w=x1-x0,d=y1-y0,x=(x0+x1)/2,z=-(y0+y1)/2,local=new THREE.Group();
  if(i<4){builders[i](local);local.name=kinds[i];local.userData.heritageKind=kinds[i];root.userData.tianjinHeritage.push(kinds[i]);}
  else{
   const ww=Math.min(18,w-2),dd=Math.min(14,d-2),floors=2+i%3,h=frontage(local,ww,dd,floors,i%3===0?cream:brick);
   hip(local,0,0,ww+1,dd+1,h+.3,2.2);
   if(i%3===1)balcony(local,0,3.3,dd/2+.6,ww*.5);
   if(i%5===0){cylinder(local,ww/2-2,h+.5,dd/2-2,1.5,1.3,cream,16);dome(local,ww/2-2,dd/2-2,h+1.1,1.6);}
   if(i%4===0){
    const names=['津门茶铺','海河书屋','老街花坊','津味点心'];
    shopfront(local,-ww*.28,dd/2+.24,names[Math.floor(i/4)%names.length]);
    shopfront(local,ww*.28,dd/2+.24,names[(Math.floor(i/4)+1)%names.length]);
   }else if(i%4===2){
    for(const x of [-ww*.28,ww*.28])for(const side of [-1,1]){
     box(local,x+side*.94,4.92,dd/2+.2,.32,1.8,.09,timber);
     for(let k=0;k<7;k++)box(local,x+side*.94,4.2+k*.21,dd/2+.26,.3,.055,.055,stone);
    }
   }
  }
  const allowance=config.tianjinHeritagePlan?.plots.find(p=>p.id===b.id);
  const bounds=new THREE.Box3().setFromObject(local),limit=allowance?.allowedBounds||b.bounds,target=allowance?.targetScale||1;
  const maxX=Math.max(Math.abs(bounds.min.x),Math.abs(bounds.max.x)),maxZ=Math.max(Math.abs(bounds.min.z),Math.abs(bounds.max.z));
  const horizontal=Math.min(target,((limit[2]-limit[0])/2-.2)/maxX,((limit[3]-limit[1])/2-.2)/maxZ);
  const volumes=new THREE.Group();for(const child of [...local.children])volumes.add(child);local.add(volumes);
  volumes.scale.set(horizontal,allowance?.heightScale||1,horizontal);
  local.userData.heritageScale={horizontal,vertical:volumes.scale.y};local.userData.heritagePlot=b.id;
  prepareLandmarkMaterials(local);
  // Bake the enlargement before assigning the plot transform, avoiding double scale.
  mergeStaticByMaterial(local);
  local.position.set(x,0,z);local.rotation.y=b.front==='north'?Math.PI:0;root.add(local);
  // Tree positions stay inside the existing audited plot rather than encroaching on traffic.
  if(i===0)trees.push([x-4,z-2.5],[x+4,z+2.5]);
 }
 addStreetTrees(root,trees,{height:1.1,spread:1.05,fineLeaves:true});return root;
}

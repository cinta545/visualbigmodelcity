import * as THREE from "three";
import {box,cylinder,mat,textPanel,groundMaterial,batchStatic,colors} from "./materials.js";
const white=mat(colors.white),yellow=mat(colors.yellow),steel=mat(0x778181,.38,.7),glass=mat(0x69858a,.22,.4);
function slab(g,x,z,w,d,material,y=.02){const m=new THREE.Mesh(new THREE.PlaneGeometry(w,d),material);m.rotation.x=-Math.PI/2;m.position.set(x,y,z);m.receiveShadow=true;g.add(m);return m;}
function tree(g,x,z,i){
 cylinder(g,x,2.2,z,.15,4.2,0x6b6150);
 const leaves=mat([0x58783c,0x637f45,0x758b49][i%3]);
 for(let j=0;j<5;j++){const a=j*2.4;
 const crown=new THREE.Mesh(new THREE.IcosahedronGeometry(1.55+(j%2)*.5,2),leaves);
 crown.position.set(x+Math.cos(a)*.65,4.3+j*.38,z+Math.sin(a)*.7);crown.scale.set(1,1.08,1);crown.castShadow=true;crown.receiveShadow=true;g.add(crown);}
 box(g,x,.11,z,2.1,.2,2.1,0xaca99d);box(g,x,.23,z,1.65,.03,1.65,0x4c5140);
}
function bench(g,x,z,rotation=0){
 const b=new THREE.Group();b.position.set(x,0,z);b.rotation.y=rotation;g.add(b);
 for(let i=0;i<4;i++)box(b,0,.63,-.25+i*.16,2.2,.08,.12,0x92765b);
 box(b,0,1.05,-.38,2.2,.55,.08,0x92765b);
 for(const side of [-.85,.85]){box(b,side,.32,0,.08,.62,.62,steel);}
}
function building(g,b,colliders){
 const group=new THREE.Group();g.add(group);
 const wall=mat(b.color,.86),trim=mat(0xe4dfd1),window=mat(b.type==="office"?0x668189:0x5d7074,.2,.38);
 box(group,b.x,b.h/2+.25,b.z,b.w,b.h,b.d,wall);
 box(group,b.x,.4,b.z,b.w+.4,.5,b.d+.4,0xa7a296);
 const floors=Math.floor((b.h-4.7)/3.3);
 for(let floor=0;floor<floors;floor++){
 const y=6.2+floor*3.3;
 for(const side of [-1,1]){
 for(let x=-b.w/2+2;x<b.w/2-1;x+=3.6){
 box(group,b.x+x,y,b.z+side*(b.d/2+.055),2.25,1.95,.12,window).castShadow=false;
 box(group,b.x+x,y-1.06,b.z+side*(b.d/2+.16),2.45,.14,.32,trim);
 if(b.type==="residential"&&floor%2===0)box(group,b.x+x+.92,y-.65,b.z+side*(b.d/2+.42),.58,.48,.48,0xb4b1a4);
 }
 for(let z=-b.d/2+2;z<b.d/2-1;z+=3.6){
 box(group,b.x+side*(b.w/2+.055),y,b.z+z,.12,1.95,2.25,window).castShadow=false;
 box(group,b.x+side*(b.w/2+.16),y-1.06,b.z+z,.32,.14,2.45,trim);
 }
 }
 if(b.type==="office"){box(group,b.x,y+1.3,b.z,b.w+.15,.18,b.d+.15,trim);}
 }
 box(group,b.x,b.h+.35,b.z,b.w+.6,.5,b.d+.6,0xb0afa5);
 box(group,b.x,b.h+.64,b.z,b.w-1,.12,b.d-1,0x818986);
 for(let i=0;i<3;i++){box(group,b.x-b.w/4+i*4,b.h+1.2,b.z,2.6,1.1,2.4,0x9ca5a2);for(let k=0;k<5;k++)box(group,b.x-b.w/4+i*4,b.h+1.77,b.z-.9+k*.4,2.3,.02,.08,0x66716e);}
 // Both street-facing facades have real recesses, glazing and storefront frames.
 const signZ=b.z>0?-1:1;
 const shops=["清和咖啡","云杉便利","青禾书店","花间生活","清和面包"];
 const palettes=["#324d40","#aa7350","#485b65","#8b8270"];
 const count=Math.max(2,Math.floor(b.w/9));
 for(let i=0;i<count;i++){
 const x=b.x-b.w/2+(i+.5)*b.w/count,w=b.w/count-.6,z=b.z+signZ*(b.d/2+.1);
 box(group,x,2,z,w,3.1,.18,glass);
 box(group,x,1.92,z+signZ*.13,.09,3.15,.12,steel);
 box(group,x-w/2,2,z,.16,3.55,.26,trim);box(group,x+w/2,2,z,.16,3.55,.26,trim);
 box(group,x,.25,z+signZ*.38,w,.23,.85,0xc7c2b4);
 box(group,x,3.75,z+signZ*.44,w,.16,1.2,0xd0c6b0);
 const text=b.type==="office"&&i===0?b.name:shops[(i+parseInt(b.id.slice(1)))%shops.length];
 textPanel(group,text,x,4.23,z+signZ*.3,w,.78,{rotation:signZ<0?Math.PI:0,background:palettes[i%palettes.length],font:88});
 // Visible shallow interior furniture behind the glazing.
 box(group,x,1.3,z-signZ*.42,w-.5,1,.65,0xb09a7c);
 box(group,x+w*.3,2.4,z-signZ*.4,.8,1.1,.15,0xe4dfd0);
 }
 const sideX=b.x>0?-1:1;
 for(let z=b.z-b.d/2+3;z<b.z+b.d/2-1;z+=5){
 box(group,b.x+sideX*(b.w/2+.08),2,z,.18,3.2,4.4,glass);
 box(group,b.x+sideX*(b.w/2+.22),2,z-2.25,.2,3.6,.2,trim);
 }
 textPanel(group,b.name,b.x+sideX*(b.w/2+.25),4.25,b.z,b.d*.65,.8,{rotation:sideX*Math.PI/2,background:"#53605b",font:85});
 colliders.push({minX:b.x-b.w/2-.4,maxX:b.x+b.w/2+.4,minZ:b.z-b.d/2-.4,maxZ:b.z+b.d/2+.4});
}
function arrow(g,x,z,rotation,turn="straight"){
 const a=new THREE.Group();a.position.set(x,.047,z);a.rotation.y=rotation;g.add(a);
 box(a,0,0,0,.17,.015,2.5,white);
 const shape=new THREE.Shape();shape.moveTo(-.65,-.7);shape.lineTo(0,-2);shape.lineTo(.65,-.7);shape.lineTo(.14,-1);shape.lineTo(-.14,-1);shape.closePath();
 const m=new THREE.Mesh(new THREE.ShapeGeometry(shape),white);m.rotation.x=-Math.PI/2;a.add(m);
 if(turn!=="straight"){box(a,turn==="left"?-.6:.6,0,.3,1.2,.015,.17,white);}
}
function sidewalk(g,sx,sz){
 const shape=new THREE.Shape();
 shape.moveTo(10,200);shape.lineTo(200,200);shape.lineTo(200,13);shape.lineTo(22,13);
 shape.quadraticCurveTo(10,13,10,25);shape.lineTo(10,200);
 const geo=new THREE.ShapeGeometry(shape,24);
 // Shape coordinates are transformed to world XZ; UVs express world metres.
 const p=geo.attributes.position,uv=geo.attributes.uv;
 for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getY(i);p.setXYZ(i,x*sx,.19,z*sz);uv.setXY(i,x/5,z/5);}
 geo.computeVertexNormals();
 const mesh=new THREE.Mesh(geo,groundMaterial("paving",1,1));mesh.material.side=THREE.DoubleSide;mesh.receiveShadow=true;g.add(mesh);
 // Straight curbs with regular joints and rounded corner segments.
 for(let z=26;z<200;z+=1)box(g,sx*10,.13,sz*(z+.45),.25,.26,.88,0xc5c2b5);
 for(let x=23;x<200;x+=1)box(g,sx*(x+.45),.13,sz*13,.88,.26,.25,0xc5c2b5);
 for(let i=0;i<24;i++){const a=Math.PI+i*Math.PI/2/24,b=Math.PI+(i+1)*Math.PI/2/24;
 const x1=22+12*Math.cos(a),z1=25+12*Math.sin(a),x2=22+12*Math.cos(b),z2=25+12*Math.sin(b);
 box(g,(x1+x2)/2*sx,.13,(z1+z2)/2*sz,Math.hypot(x2-x1,z2-z1),.26,.25,0xc5c2b5,-Math.atan2((z2-z1)*sz,(x2-x1)*sx));}
 // Tactile strips stay on the sidewalk.
 box(g,sx*14,.204,sz*117,.48,.018,165,0xbca46b);
 box(g,sx*117,.204,sz*17,165,.018,.48,0xbca46b);
}
export function createEnvironment(scene,layout){
 const g=new THREE.Group();scene.add(g);const colliders=[];
 slab(g,0,0,1800,1800,mat(0xb3b9a8),-.15);
 slab(g,0,0,400,400,groundMaterial("asphalt",100,100),0);
 for(const sx of [-1,1])for(const sz of [-1,1])sidewalk(g,sx,sz);
 // Centre median ends before the pedestrian crossings.
 for(const sign of [-1,1]){
 box(g,sign*117,.19,0,164,.38,1.15,0xb7b6a8);box(g,sign*117,.4,0,161,.1,.85,0x637e46);
 box(g,0,.19,sign*117,1.15,.38,164,0xb7b6a8);box(g,0,.4,sign*117,.85,.1,161,0x637e46);
 for(const lane of [4.5,8])for(let x=34;x<198;x+=7)box(g,sign*(x+1.5),.025,lane,3,.015,.13,white);
 for(const lane of [-4.5,-8])for(let x=34;x<198;x+=7)box(g,sign*(x+1.5),.025,lane,3,.015,.13,white);
 for(const x of [-4.5,4.5])for(let z=34;z<198;z+=7)box(g,x,.025,sign*(z+1.5),.13,.015,3,white);
 for(const z of [-11.35,11.35])box(g,sign*117,.03,z,165,.015,.14,white);
 for(const x of [-7.85,7.85])box(g,x,.03,sign*117,.14,.015,165,white);
 // Crossings leave a central median gap.
 for(let z=-10.8;z<11;z+=1.15)box(g,sign*24,.035,z,3.5,.02,.52,white);
 for(let x=-7.4;x<8;x+=1.15)box(g,x,.035,sign*24,.52,.02,3.5,white);
 box(g,sign*30,.04,-sign*6.2,.45,.025,10.3,white);
 box(g,sign*4.5,.04,sign*30,6.5,.025,.45,white);
 for(let i=0;i<3;i++)arrow(g,sign*43,-sign*(2.75+3.5*i),sign>0?-Math.PI/2:Math.PI/2,i===0?"left":i===2?"right":"straight");
 for(let i=0;i<2;i++)arrow(g,sign*(2.75+3.5*i),sign*43,sign>0?0:Math.PI,i===0?"left":"straight");
 for(let k=0;k<5;k++){const pos=40+k*29;
 for(const side of [-1,1]){
 tree(g,sign*pos,side*18,k);
 tree(g,side*15,sign*(pos+12),k+1);
 // Slim road luminaires.
 cylinder(g,sign*(pos+10),4.5,side*12.7,.11,9,steel);
 box(g,sign*(pos+10),9,side*11,0.13,.13,3.4,steel);
 box(g,sign*(pos+10),8.97,side*9.6,.65,.15,1.05,0x353d3e);
 }
 }
}
 for(const b of layout.buildings)building(g,b,colliders);
 // Low background blocks, set behind the inspectable streets.
 for(let i=0;i<16;i++){const a=i*Math.PI/8,r=255+(i%3)*30,x=Math.cos(a)*r,z=Math.sin(a)*r,h=20+(i%5)*8;box(g,x,h/2,z,25,h,29,0xc3c7bd);}
 for(const sx of [-1,1])for(const sz of [-1,1]){
 cylinder(g,sx*24,.21,sz*20,.48,.025,0x6d726c,32);
 for(let k=0;k<7;k++)box(g,sx*(22.7+k*.15),.028,sz*12.2,.06,.015,.7,0x252f30);
 cylinder(g,sx*21,.71,sz*27,.28,1,0x66736a);
 for(let i=0;i<3;i++)cylinder(g,sx*(18+i*2),.62,sz*25,.07,.85,steel);
 }
 // Park at southeast and shelter on the eastbound curb.
 slab(g,87,53,33,31,mat(0x7a925a),.205);
 for(let i=0;i<5;i++)tree(g,74+i*6,66,i);
 bench(g,80,38);bench(g,90,38);
 for(const x of [79,89])cylinder(g,x,1.65,16.5,.055,2.9,steel);
 box(g,84,3.15,16.5,11,.16,2.8,0x485653);
 box(g,84,1.75,17.55,10,2.65,.06,glass);
 bench(g,83,17,Math.PI);
 textPanel(g,"清和里站  ·  101",84,2.7,15.04,7,.45,{rotation:Math.PI,background:"#38514c",font:85});
 // Street name signs.
 for(const sign of [-1,1]){
 cylinder(g,sign*17,2.35,-sign*19,.06,4.4,steel);
 textPanel(g,"清和路  QINGHE RD",sign*17,4.1,-sign*19+.09,2.8,.62,{font:67,background:"#276559"});
 }
 batchStatic(g);return {group:g,colliders};
}


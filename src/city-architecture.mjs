import {addForecourtPaving} from './city-paving.mjs';
import {shopSurface} from './city-shop-interiors.mjs';
import * as THREE from 'three';
import {box,mat} from './district/materials.js';
export function buildingProfile(building,index,center){
 const b=building.bounds,distance=Math.hypot((b[0]+b[2])/2-center[0],(b[1]+b[3])/2-center[1]);
 return {kind:building.kind==='office'&&index%7!==0?'residential':building.kind,height:building.detail?building.height:Math.min(building.height,distance<100?20+index%3*3:30+index%4*4)};
}
export function facadeSets(){
 const result={};
 for(const kind of ['residential','commercial','office']){
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=512;const ctx=canvas.getContext('2d'),office=kind==='office',warm=kind==='commercial';
  ctx.fillStyle=office?'#516a75':warm?'#b7aa94':'#bec0b5';ctx.fillRect(0,0,512,512);
  for(let row=0;row<8;row++){
   const y=row*64;ctx.fillStyle=office?'#a0afb0':'#999d92';ctx.fillRect(0,y+60,512,3);
   for(let col=0;col<8;col++){
    const x=col*64,w=office?56:34,h=office?55:39,left=x+(64-w)/2,top=y+8;
    ctx.fillStyle='#747f7c';ctx.fillRect(left-2,top-2,w+4,h+4);
    const glass=ctx.createLinearGradient(left,top,left+w,top+h);glass.addColorStop(0,office?'#78909a':'#819295');glass.addColorStop(.45,office?'#486373':'#52676c');glass.addColorStop(1,'#354c55');ctx.fillStyle=glass;ctx.fillRect(left,top,w,h);
    if(!office&&(row*3+col)%5===0){ctx.fillStyle='#b1b0a2';ctx.fillRect(left+2,top+2,w*.4,h-4);}
    ctx.fillStyle=office?'#9bafb5':'#c7cbc1';ctx.fillRect(left+w/2,top,2,h);ctx.fillStyle='#d5d0bf';if(!office)ctx.fillRect(left-3,top+h+3,w+6,3);
   }
  }
  const texture=new THREE.CanvasTexture(canvas);texture.encoding=THREE.sRGBEncoding;texture.anisotropy=8;
  const wall=new THREE.MeshStandardMaterial({map:texture,roughness:office?.3:.75,metalness:office?.35:.08,envMapIntensity:.35});const roof=mat(0x87918b,.94);result[kind]=[wall,wall,roof,roof,wall,wall];
 }
 return result;
}
// Details stay within the building footprint plus its audited five-metre margin.
export function buildingDetails(root,b,height,kind,index){
 const [x0,y0,x1,y1]=b.bounds,x=(x0+x1)/2,z=-(y0+y1)/2,w=x1-x0,d=y1-y0,side=b.front==='north'?-1:1,front=z+side*(d/2+.96),stone=mat(kind==='commercial'?0xb3a68e:0xb7c0b8),metal=mat(0x52676b,.4,.55),glass=mat(0x476772,.25,.4);
 // A glazed podium, framed doors and a projecting entrance canopy.
 for(let j=0;j<5;j++){const xx=x0+2.4+j*(w-4.8)/4;box(root,xx,2.1,front,3.3,3.4,.07,glass);box(root,xx-1.72,2.1,front+side*.08,.1,3.5,.12,metal);box(root,xx,2.1,front+side*.08,.055,3.4,.12,stone);}
 box(root,x,4.15,front+side*.35,w+.7,.16,1.5,stone);box(root,x,2,front+side*.15,.1,3.6,.12,metal);
 if(kind==='office'){
  for(let dx=-w/2+1;dx<w/2;dx+=3.6)for(const face of [-1,1])box(root,x+dx,height/2,z+face*(d/2+.12),.14,height,.25,metal);
 }else{
  for(let yy=8;yy<height-1;yy+=3.4){
   if(kind==='commercial')box(root,x,yy,z+side*(d/2+.2),w,.15,.4,stone);
   else for(const dx of [-w*.29,w*.29]){box(root,x+dx,yy-.9,z+side*(d/2+.37),3.1,.14,.85,stone);box(root,x+dx,yy-.45,z+side*(d/2+.8),3.1,.6,.08,metal);}
  }
 }
 // Coping hides the facade-to-roof seam, with service equipment kept behind it.
 for(const zz of [z-d/2,z+d/2])box(root,x,height+.45,zz,w,.6,.18,stone);
 for(const xx of [x-w/2,x+w/2])box(root,xx,height+.45,z,.18,.6,d,stone);
 box(root,x+4,height+.35,z-3,5,.12,3.4,mat(0x456578,.25,.45));
}
export function forecourtDetails(root,b,index,treeOffsets=[-8,0,8]){
 const [x0,y0,x1,y1]=b.bounds,x=(x0+x1)/2,z=-(y0+y1)/2,w=x1-x0,d=y1-y0,side=b.front==='north'?-1:1,front=z+side*(d/2+3),stone=mat(0xaaa99b),wood=shopSurface('wood',0x897659),metal=mat(0x485c5b,.4,.5);
 // Bands and furnishings are restricted to each building's cleared forecourt.
 addForecourtPaving(root,x,front,w,3.5);
 // Narrow edging stones stay inside the existing frontage strip.
 for(const dz of [-1.68,1.68])for(let offset=-w/2;offset<w/2;offset+=.6){
  const length=Math.min(.6,w/2-offset);box(root,x+offset+length/2,.04,front+dz,length-.008,.024,.12,stone);
 }
 for(const dx of treeOffsets){box(root,x+dx,.06,front,1.3,.1,1.3,stone);box(root,x+dx,.12,front,1.08,.025,1.08,mat(0x5d6650));for(let bar=0;bar<8;bar++)box(root,x+dx-.48+bar*.137,.14,front,.028,.025,1.03,metal);}
 for(const dx of [-4,4]){for(let slat=0;slat<4;slat++)box(root,x+dx,.5,front-.24+slat*.15,1.9,.06,.1,wood);for(const leg of [-.7,.7]){for(const dz of [-.24,.24])box(root,x+dx+leg,.26,front+dz,.07,.48,.07,metal);box(root,x+dx+leg,.05,front,.07,.06,.58,metal);}}
 for(const dx of [-4,4]){
  for(const leg of [-.7,.7])box(root,x+dx+leg,.77,front-side*.32,.055,.6,.055,metal);
  for(let slat=0;slat<3;slat++)box(root,x+dx,.74+slat*.12,front-side*.32,1.9,.085,.045,wood);
  for(const end of [-.82,.82]){
   box(root,x+dx+end,.65,front+side*.17,.045,.28,.045,metal);
   box(root,x+dx+end,.805,front-side*.015,.07,.045,.49,wood);
   box(root,x+dx+end,.057,front,.16,.025,.56,metal);
  }
 }
 for(const offset of [-.28,.28]){
  const xx=x+w/2-1+offset;
  box(root,xx,.49,front,.48,.86,.44,metal);box(root,xx,.96,front,.52,.07,.48,stone);
  box(root,xx,.79,front+side*.226,.32,.12,.012,mat(0x202c2a));
  box(root,xx,.6,front+side*.23,.23,.035,.014,mat(offset<0?0x668fa0:0x7e897a));
 }
 // Flush drainage beside the facade, inside the cleared building forecourt.
 const drain=front-side*1.18;
 box(root,x,.031,drain,w-.8,.025,.18,metal);
 for(let dx=-w/2+.5;dx<w/2-.4;dx+=.22)box(root,x+dx,.047,drain,.035,.01,.16,stone);
}

import * as THREE from 'three';
import {mergeBufferGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {box,cylinder,mat,batchStatic,textPanel} from './district/materials.js';
import {pedestrianPavingMaterial} from './city-paving.mjs';
import {addStreetTrees} from './city-trees.mjs';
import {RectAreaLightUniformsLib} from 'three/addons/lights/RectAreaLightUniformsLib.js';
import {createBuildingPrototype} from './chongqing-building-prototypes.mjs';
import {landmarkSurfaceUV,landmarkMaterial} from './changchun-landmark-materials.mjs';

// Designed quiet night: cool unlit surroundings, warm landmark interiors.
export const neonPalette=[0xff4fa3,0x29e0ff,0xffa23e,0xffd76e,0x52ffa8,0xff6ec7];
export const nightFog={color:0x0b1220,near:280,far:860};

const hash=(a,b=0)=>{let s=Math.imul(a^0x9e3779b9,73856093)^Math.imul(b+1,19349663);s=Math.imul(s^s>>>13,1274126177);return((s^s>>>16)>>>0)/4294967296;};

// Equirect night dome: indigo zenith, violet haze band, stars and a soft moon.
export function createNightSky(renderer){
 const w=2048,h=1024,canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
 const ctx=canvas.getContext('2d'),sky=ctx.createLinearGradient(0,0,0,h);
 for(const [stop,color] of [[0,'#05081c'],[.34,'#0b1130'],[.47,'#1b1a46'],[.52,'#10192a'],[.56,'#191b3a'],[1,'#0a0d1a']])sky.addColorStop(stop,color);
 ctx.fillStyle=sky;ctx.fillRect(0,0,w,h);
 const texture=new THREE.CanvasTexture(canvas);texture.mapping=THREE.EquirectangularReflectionMapping;texture.encoding=THREE.sRGBEncoding;
 const pmrem=new THREE.PMREMGenerator(renderer),environment=pmrem.fromEquirectangular(texture).texture;pmrem.dispose();
 return {sky:texture,environment};
}

// Bake metre-scaled facade UVs so lit windows keep real-world size on any wall.
export function metreUV(geometry,tile=[16,12],ox=0,oy=0){
 landmarkSurfaceUV(geometry);
 const uv=geometry.attributes.uv;
 for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)/tile[0]+ox,uv.getY(i)/tile[1]+oy);
 geometry.userData.owned=true;return geometry;
}

// Merge a finished group into few draw calls; per-material, plane signs stay separate.
export function mergeStaticByMaterial(root,uvScaleX=1,uvScaleY=1){
 root.updateMatrixWorld(true);const groups=new Map(),remove=[];
 root.traverse(o=>{
  if(!o.isMesh||o.isInstancedMesh||o.geometry.type==='PlaneGeometry')return;
  // Animated subtrees (cableway cabins) keep their own meshes and transforms.
  for(let p=o;p;p=p.parent)if(p.userData.noMerge)return;
  const geometry=(o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone()).applyMatrix4(o.matrixWorld);
  if(o.material.userData.landmarkSurface)landmarkSurfaceUV(geometry);
  if(uvScaleX!==1||uvScaleY!==1){const uv=geometry.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*uvScaleX,uv.getY(i)*uvScaleY);}
  if(!groups.has(o.material))groups.set(o.material,[]);groups.get(o.material).push(geometry);remove.push(o);
 });
 const owned=new Set(remove.filter(o=>o.geometry.userData.owned).map(o=>o.geometry));
 for(const o of remove)o.removeFromParent();
 for(const geometry of owned)geometry.dispose();
 for(const [material,geometries] of groups){
  const mesh=new THREE.Mesh(mergeBufferGeometries(geometries,false),material);
  mesh.castShadow=mesh.receiveShadow=!material.transparent;root.add(mesh);
  for(const g of geometries)g.dispose();
 }
}

// Solid-colour strip that reads as neon once bloom lifts everything above threshold.
const stripCache=new Map();
export function neonStrip(color,intensity=1.6){
 const key=color+':'+intensity;
 if(!stripCache.has(key))stripCache.set(key,new THREE.MeshStandardMaterial({color:0x0a0c12,emissive:0x000000,emissiveIntensity:0,roughness:.5}));
 return stripCache.get(key);
}
export function glowBox(parent,x,y,z,w,h,d,color,intensity=1.6,rotation=0){
 const interior=h>=.45&&Math.min(w,d)<.3&&Math.max(w,d)>1;
 const material=interior?new THREE.MeshStandardMaterial({color:0x756044,emissive:0xffcb83,emissiveIntensity:.28,roughness:.65}):mat(0x35414b,.76);
 return box(parent,x,y,z,w,h,d,material,rotation);
}

// Hand-lettered neon sign: glow comes from layered canvas passes, not post filters alone.
const signFonts='"Microsoft YaHei","PingFang SC",sans-serif';
export function neonSign(parent,text,x,y,z,w,h,{color='#ff4fa3',vertical=false,rotation=0,align='center'}={}){
 const cw=256,ch=vertical?1024:256,canvas=document.createElement('canvas');canvas.width=cw;canvas.height=ch;
 const ctx=canvas.getContext('2d'),rgb=hexToRgb(color),core=`rgba(255,255,255,.96)`,glow=t=>`rgba(${rgb[0]},${rgb[1]},${rgb[2]},${t})`;
 ctx.textAlign='center';ctx.textBaseline='middle';
 if(vertical){
  const chars=[...text],size=Math.min(170,900/Math.max(2,chars.length));
  ctx.font=`700 ${size}px ${signFonts}`;
  chars.forEach((c,i)=>{const y=140+i*(ch-240)/Math.max(1,chars.length-1);
   for(const [blur,color2,offset] of [[34,glow(.85),0],[16,glow(.9),0],[7,core,0]]){ctx.shadowColor=color2;ctx.shadowBlur=0;ctx.fillStyle=color2;ctx.fillText(c,cw/2,y+offset);}ctx.shadowBlur=0;});
 }else{
  ctx.font=`700 ${Math.min(150,2050/Math.max(2,text.length))}px ${signFonts}`;
  for(const [blur,color2] of [[30,glow(.85)],[14,glow(.95)],[6,core]]){ctx.shadowColor=color2;ctx.shadowBlur=0;ctx.fillStyle=color2;ctx.fillText(text,cw/2,ch*.53,text.length>7?cw*.92:cw*.8);}
 }
 const tex=new THREE.CanvasTexture(canvas);tex.encoding=THREE.sRGBEncoding;tex.anisotropy=4;
 const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshStandardMaterial({map:tex,roughness:.9,transparent:true,depthWrite:false,side:THREE.DoubleSide}));
 mesh.position.set(x,y,z);mesh.rotation.y=rotation;parent.add(mesh);return mesh;
}
function hexToRgb(color){const n=typeof color==='string'?parseInt(color.replace('#',''),16):color;return[n>>16&255,n>>8&255,n&255];}

// One facade set per everyday kind; map carries frames, emissive carries the lit rooms.
const facadeCache=new Map();
export function nightFacade(kind,landmark=false){
 const key=kind+landmark;
 if(facadeCache.has(key))return facadeCache.get(key);
 const lit=landmark?(kind==='oldstreet'?.22:.34):0;
 const cw=640,ch=480,cols=kind==='oldstreet'?3:5,rows=kind==='oldstreet'?3:4,cellW=cw/cols,cellH=ch/rows;
 const wall=document.createElement('canvas'),glow=document.createElement('canvas'),rough=document.createElement('canvas'),height=document.createElement('canvas');
 for(const canvas of [wall,glow,rough,height]){canvas.width=cw;canvas.height=ch;}
 const wctx=wall.getContext('2d'),gctx=glow.getContext('2d'),rctx=rough.getContext('2d'),hctx=height.getContext('2d');
 rctx.fillStyle='#ececec';rctx.fillRect(0,0,cw,ch);hctx.fillStyle='#aaaaaa';hctx.fillRect(0,0,cw,ch);
 const base={residential:'#31353f',commercial:'#2a2e37',office:'#222b37',oldstreet:'#8a8072'}[kind];
 wctx.fillStyle=base;wctx.fillRect(0,0,cw,ch);
 for(let i=0;i<900;i++){wctx.fillStyle=`rgba(255,255,255,${hash(i,kind.length)*.03})`;wctx.fillRect(hash(i,2)*cw,hash(i,4)*ch,3,3);}
 if(kind==='oldstreet'){
  wctx.strokeStyle='rgba(42,33,27,.12)';wctx.lineWidth=1;
  for(let y=0;y<ch;y+=12){
   wctx.beginPath();wctx.moveTo(0,y);wctx.lineTo(cw,y);wctx.stroke();
   for(let x=(y/12%2)*18;x<cw;x+=36){wctx.beginPath();wctx.moveTo(x,y);wctx.lineTo(x,y+12);wctx.stroke();}
  }
 }
 gctx.fillStyle='#000';gctx.fillRect(0,0,cw,ch);
 for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
  const x=c*cellW,y=r*cellH,wide=kind==='office';
  const ww=kind==='oldstreet'?66:wide?100:78,wh=kind==='oldstreet'?94:wide?90:70;
  const wx=x+(cellW-ww)/2,wy=y+(cellH-wh)/2;
  rctx.fillStyle='#888888';rctx.fillRect(wx-5,wy-5,ww+10,wh+10);rctx.fillStyle='#343434';rctx.fillRect(wx,wy,ww,wh);
  hctx.fillStyle='#d0d0d0';hctx.fillRect(wx-5,wy-5,ww+10,wh+10);hctx.fillStyle='#686868';hctx.fillRect(wx,wy,ww,wh);
  wctx.fillStyle='#454b58';wctx.fillRect(wx-5,wy-5,ww+10,wh+10);
  wctx.fillStyle='#111923';wctx.fillRect(wx-3,wy-3,ww+6,wh+8);
  const glass=wctx.createLinearGradient(wx,wy,wx,wy+wh);glass.addColorStop(0,'#131b28');glass.addColorStop(1,'#0b1017');
  wctx.fillStyle=glass;wctx.fillRect(wx,wy,ww,wh);
  wctx.fillStyle='rgba(120,140,170,.16)';wctx.fillRect(wx,wy,ww*.34,wh);
  wctx.fillStyle='#59606a';wctx.fillRect(wx+ww*.48,wy,3,wh);wctx.fillRect(wx,wy+wh*.53,ww,3);
  wctx.fillStyle='#71746d';wctx.fillRect(wx-6,wy+wh+3,ww+12,5);
  wctx.fillStyle='rgba(8,12,17,.2)';wctx.fillRect(wx-5,wy+wh+8,ww+10,7);
  const streak=wctx.createLinearGradient(0,wy+wh,0,y+cellH);
  streak.addColorStop(0,'rgba(6,10,12,.16)');streak.addColorStop(1,'rgba(6,10,12,0)');
  wctx.fillStyle=streak;wctx.fillRect(wx-6,wy+wh+8,4,cellH-wh-10);wctx.fillRect(wx+ww+2,wy+wh+8,4,cellH-wh-10);
  if(kind==='residential'){
   wctx.fillStyle='#2e343e';wctx.fillRect(wx-8,wy+wh*.77,ww+16,wh*.3);
   wctx.strokeStyle='#747b7b';wctx.lineWidth=2;wctx.strokeRect(wx-8,wy+wh*.77,ww+16,wh*.3);
   for(let k=0;k<8;k++)wctx.fillRect(wx-4+k*(ww+8)/7,wy+wh*.78,2,wh*.28);
  }
  const seed=hash(r*17+c,kind==='office'?5:kind==='commercial'?9:13);
  if(seed<lit){
   const tint=hash(r*31+c,7),half=hash(r*47+c,3)>.72,bright=.5+hash(r*53+c,19)*.55;
   // Colourful rooms return — pink, mint and cool blue — confined to window cells.
   const warmCut=kind==='residential'?.66:kind==='commercial'?.5:.42;
   const color='255,203,137';
   const grad=gctx.createLinearGradient(wx,wy,wx,wy+wh);
   grad.addColorStop(0,`rgba(${color},${bright})`);grad.addColorStop(half?.55:1,`rgba(${color},${bright*.75})`);grad.addColorStop(1,`rgba(${color},.18)`);
   gctx.fillStyle=grad;gctx.fillRect(wx+3,wy+3,ww-6,half?wh*.5:wh-6);
   // Curtains and mullions interrupt the room glow so panes do not read as flat yellow blocks.
   gctx.fillStyle='#000';gctx.fillRect(wx+ww*.48,wy+3,3,wh-6);gctx.fillRect(wx+3,wy+wh*.53,ww-6,3);
   gctx.fillStyle='rgba(0,0,0,.45)';gctx.fillRect(wx+3,wy+3,ww*.16,wh-6);gctx.fillRect(wx+ww*.78,wy+3,ww*.16,wh-6);
   if(hash(r*23+c,11)>.55){gctx.fillStyle='#000';gctx.fillRect(wx+ww*.25,wy+wh*.74,ww*.42,wh*.19);}
  }
 }
 const map=new THREE.CanvasTexture(wall),emissive=new THREE.CanvasTexture(glow),roughnessMap=new THREE.CanvasTexture(rough),bumpMap=new THREE.CanvasTexture(height);
 for(const t of [map,emissive,roughnessMap,bumpMap]){t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=8;}
 map.encoding=THREE.sRGBEncoding;
 const material=new THREE.MeshStandardMaterial({map,roughnessMap,bumpMap,bumpScale:.045,emissiveMap:emissive,emissive:0xffffff,emissiveIntensity:landmark?.4:0,roughness:.92,envMapIntensity:.35});
 facadeCache.set(key,{material});return facadeCache.get(key);
}

// Distant towers use a sparser, cooler variant so the ring reads as far depth.
let skylineMaterial=null;
export function nightSkylineMaterial(){
 if(skylineMaterial)return skylineMaterial;
 const cw=512,ch=512,wall=document.createElement('canvas'),glow=document.createElement('canvas');
 wall.width=glow.width=cw;wall.height=glow.height=ch;
 const wctx=wall.getContext('2d'),gctx=glow.getContext('2d');
 wctx.fillStyle='#1b2230';wctx.fillRect(0,0,cw,ch);gctx.fillStyle='#000';gctx.fillRect(0,0,cw,ch);
 for(let r=0;r<6;r++)for(let c=0;c<6;c++){
  const x=c*85+14,y=r*85+12,w=54,h=60;
  wctx.fillStyle='#2c3644';wctx.fillRect(x-4,y-4,w+8,h+8);
  const glass=wctx.createLinearGradient(x,y,x,y+h);glass.addColorStop(0,'#111a26');glass.addColorStop(1,'#0a0f16');
  wctx.fillStyle=glass;wctx.fillRect(x,y,w,h);
  if(hash(r*13+c,29)<.34){
   const color=hash(r*7+c,41)<.6?'150,200,255':'255,180,120';
   gctx.fillStyle=`rgba(${color},${.4+hash(r*3+c,43)*.5})`;gctx.fillRect(x+3,y+3,w-6,h-6);
  }
 }
 const map=new THREE.CanvasTexture(wall),emissive=new THREE.CanvasTexture(glow);
 for(const t of [map,emissive]){t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=4;}
 map.encoding=THREE.sRGBEncoding;
 skylineMaterial=new THREE.MeshStandardMaterial({map,emissiveMap:emissive,emissive:0xffffff,emissiveIntensity:.75,roughness:.95});
 return skylineMaterial;
}

const shopNames=['重庆火锅','山城小面','老巷串串','江湖菜馆','夜色酒吧','洪崖客栈','酸辣粉','麻辣烫','邻里便利','江景茶楼','小面大王','烤鱼万州','巷口烧烤','冰粉凉虾','老火锅','电竞网咖','宾馆住宿','土特产行'];

// The everyday fabric: dark towers with warm rooms, neon rooflines, lit shopfronts.
export function chongqingNightCity(parent,buildings){
 RectAreaLightUniformsLib.init();
 const fabric=new THREE.Group(),lights=new THREE.Group();parent.add(fabric,lights);
 const treePositions=[];
 for(const b of buildings){
  const base=b.surfaceHeight||0;
  if(b.quarterRole!=='infill'&&b.quarterRole!=='skyline')continue;
  if(b.architecture){
   parent.add(createBuildingPrototype(b,{nightFacade,metreUV,mergeStaticByMaterial,glowBox,shopNames}));
   if(b.variant%4===0&&base===0&&b.height<38){const [x0,y0,x1]=b.bounds;treePositions.push([(x0+x1)/2,-y0+2.5]);}
   continue;
  }
  const fabric=new THREE.Group(),lights=fabric;fabric.position.y=base;parent.add(fabric);
  const [x0,y0,x1,y1]=b.bounds,x=(x0+x1)/2,z=-(y0+y1)/2,w=(x1-x0)*(b.architecture==='tower'?.74:1),d=(y1-y0)*(b.architecture==='tower'?.82:1),h=b.height,side=b.front==='north'?-1:1,front=z+side*d/2;
  if(b.quarterRole==='skyline'){
   const geometry=metreUV(new THREE.BoxGeometry(w,h,d),[18,18],hash(b.variant,5)*18,hash(b.variant,9)*18);
   const mesh=new THREE.Mesh(geometry,nightSkylineMaterial());mesh.position.set(x,h/2,z);mesh.castShadow=false;fabric.add(mesh);
   glowBox(lights,x,h+.2,z,w*.96,.2,.2,neonPalette[b.variant%2?1:0],2.1);
   if(b.variant%3===0){cylinder(lights,x,h+4,z,.12,8,mat(0x30353f),6);glowBox(lights,x,h+8.2,z,.3,.3,.3,0xff4040,3);}
   continue;
  }
  const old=b.architecture==='oldstreet',tileSize=old?[9,10.2]:[16,12];
  const wallGeometry=metreUV(new THREE.BoxGeometry(w,h,d),tileSize,hash(b.variant,5)*tileSize[0],hash(b.variant,9)*tileSize[1]);
  const facade=nightFacade(old?'oldstreet':b.kind,true).material.clone();
  facade.color.setHex([0xaaa294,0x7f909e,0xa9917a,0x92a09c][b.variant%4]);facade.emissiveIntensity=.18;
  const wallMesh=new THREE.Mesh(wallGeometry,facade);
  wallMesh.position.set(x,h/2,z);wallMesh.castShadow=true;wallMesh.receiveShadow=true;fabric.add(wallMesh);
  if(b.architecture==='oldstreet')facade.color.setHex([0xc1a688,0xbaa994,0x9a8270,0xb9b4a4][b.variant%4]);
  if(b.architecture==='tower'){
   const wing=new THREE.Mesh(metreUV(new THREE.BoxGeometry(x1-x0,6.8,y1-y0),[16,12]),facade);
   wing.position.set(x,3.4,z);wing.castShadow=wing.receiveShadow=true;fabric.add(wing);
  }
  if(b.architecture==='oldstreet'){
   const masonry=landmarkMaterial(b.variant%2?0x776251:0x86847a,.94,b.variant%2?'brick':'stone');
   box(fabric,x,h-.25,front+side*.3,w+.18,.45,.55,masonry);
   for(const dx of [-w/2+.18,w/2-.18]){
    box(fabric,x+dx,h/2,front+side*.14,.35,h,.3,masonry);
    for(let y=4.4;y<h-.5;y+=3.4)box(fabric,x+dx,y,front+side*.25,.55,.22,.48,masonry);
   }
   // Deep eaves and a small pitched roof distinguish the older streets.
   if(b.variant%3===0){
    const roof=new THREE.Mesh(new THREE.ConeGeometry(1,1,4),landmarkMaterial(0x3f4749,.9,'slate'));
    roof.scale.set(w*.74,1.7,d*.74);roof.position.set(x,h+1.2,z);roof.rotation.y=Math.PI/4;roof.castShadow=true;fabric.add(roof);
   }
  }
  box(fabric,x,h+.22,z,w+.35,.45,d+.35,0x141821);
  const trim=mat(0x59666b,.86),dark=mat(0x25323a,.82),glass=mat(0x23333e,.22,.25);
  // Roof parapet surrounds a recessed roof rather than a single solid cap.
  for(const dz of [-d/2,d/2])box(fabric,x,h+.75,z+dz,w,.8,.22,trim);
  for(const dx of [-w/2,w/2])box(fabric,x+dx,h+.75,z,.22,.8,d,trim);
  box(fabric,x,1.45,front+side*.26,1.9,2.8,.12,glass);
  for(const dx of [-1,0,1])box(fabric,x+dx,1.45,front+side*.35,.07,2.8,.12,trim);
  box(fabric,x,2.95,front+side*.6,2.6,.18,1.3,dark);
  // Side elevations get floor relief and a downpipe, visible when orbiting.
  for(const edge of [-1,1]){
   box(fabric,x+edge*(w/2+.12),h/2,z-d*.3,.12,h,.12,dark);
   for(let y=3.4;y<h-1;y+=3.4)box(fabric,x+edge*(w/2+.09),y,z,.2,.1,d*.9,trim);
   if(b.variant%3===0)for(let y=5;y<h-2;y+=6.8){
    box(fabric,x+edge*(w/2+.4),y,z+d*.22,.65,.7,1.1,trim);
    for(let slot=0;slot<4;slot++)box(fabric,x+edge*(w/2+.74),y-.2+slot*.13,z+d*.22,.035,.035,.85,dark);
   }
  }
  // Quiet relief: recessed dark glass, parapet and broad vertical pilasters.
  for(const dx of [-w*.35,0,w*.35])box(fabric,x+dx,h/2,front+side*.16,.3,h,.26,mat(0x4b5662,.82));
  box(fabric,x,2,front+side*.15,w*.8,3,.3,mat(0x1e2a35,.4,.15));
  for(let level=4;level<h-1;level+=3.4){
   if(b.architecture==='oldstreet'||b.kind==='residential')box(fabric,x,level,front+.32,w*.94,.12,.4,mat(0x555d60,.85));
   for(const dx of [-w*.32,w*.32])box(fabric,x+dx,level+.55,front+.63,w*.23,.065,.06,mat(0x37454e,.65));
   if(b.kind==='residential'&&b.variant%2===0)for(const dx of [-w*.32,w*.32]){
    box(fabric,x+dx,level+.2,front+side*.65,w*.23,.18,1.15,dark);
    for(let k=0;k<6;k++)box(fabric,x+dx-w*.115+k*w*.23/5,level+.68,front+side*1.15,.045,.8,.045,trim);
    box(fabric,x+dx,level+1.08,front+side*1.15,w*.23,.065,.065,trim);
   }
  }
  box(fabric,x-w*.25,h+.8,z,3,1.2,2.3,mat(0x55616d,.86));
  if(b.variant%3===0){box(fabric,x+w*.18,h+1.1,z-d*.2,w*.40,2.2,d*.42,mat(0x58616a,.86));}
  if(b.variant%11===0&&h>24){
   const crown=new THREE.Mesh(new THREE.ConeGeometry(Math.min(w,d)*.32,3.6,4),mat(0x38484c,.82,.1));
   crown.position.set(x,h+2.6,z);crown.rotation.y=Math.PI/4;crown.castShadow=true;fabric.add(crown);
  }
  if(b.kind==='office'){
   for(const dx of [-w*.26,w*.26]){
    box(fabric,x+dx,h*.55,front+side*.35,w*.2,h*.72,.45,glass);
    for(let y=4;y<h-2;y+=3.4)box(fabric,x+dx,y,front+side*.62,w*.2,.09,.07,trim);
   }
  }
  if(b.variant%5===0)cylinder(fabric,x+w*.27,h+1.1,z+d*.22,1.1,2.2,mat(0x737c7e,.65),8);
  if(b.kind==='commercial'){
   for(const dx of [-w*.28,0,w*.28])glowBox(fabric,x+dx,1.6,front+.20,w*.22,2.3,.1,0xffcb83,.3).material.emissiveIntensity=.65;
   textPanel(fabric,shopNames[b.variant%shopNames.length],x,3.3,front+.3,w*.82,.75,{background:'#5e4030',font:120,proportional:true});
   box(fabric,x,4,front+.5,w*.95,.18,1.2,mat(0x35424e));
   if(old&&b.variant%2===0){
    const awning=[mat(0x655044,.9),mat(0x7a7460,.94)];
    for(let k=0;k<10;k++){
     const strip=box(fabric,x-w*.475+(k+.5)*w*.095,3.7,front+side*.72,w*.095,.085,1.15,awning[k%2]);
     strip.rotation.x=side*.13;
    }
    box(fabric,x,3.54,front+side*1.28,w*.95,.22,.06,awning[0]);
   }
   for(const dx of [-w*.28,0,w*.28]){
    for(const frame of [-w*.11,w*.11])box(fabric,x+dx+frame,1.6,front+.29,.09,2.4,.12,trim);
    box(fabric,x+dx,2.8,front+.29,w*.22,.12,.12,trim);
   }
  }
  if(b.variant%4===0&&h<38&&base===0){
   treePositions.push([x-w*.32,front+side*2.6],[x+w*.32,front+side*2.6]);
   for(const dx of [-w*.32,w*.32])box(fabric,x+dx,.16,front+side*2.6,1.9,.32,1.9,dark);
  }
  fabric.position.y=0;mergeStaticByMaterial(fabric);
  if(b.rotation){const pivot=new THREE.Group();parent.add(pivot);pivot.add(fabric);fabric.position.set(-x,0,-z);pivot.position.set(x,base,z);pivot.rotation.y=b.rotation;}
  else fabric.position.y=base;

 }
 mergeStaticByMaterial(fabric);
 batchStatic(lights);
 if(treePositions.length)addStreetTrees(parent,treePositions,{height:.9,spread:1.05,fineLeaves:true});
 // A few broad shop windows light their pavement and neighbouring walls.
 const litFronts=buildings.filter(b=>!b.landmark&&b.kind==='commercial'&&b.architecture==='oldstreet').sort((a,b)=>{
  const radius=v=>Math.hypot((v.bounds[0]+v.bounds[2])/2,(v.bounds[1]+v.bounds[3])/2);
  return radius(a)-radius(b);
 }).filter((b,i)=>i%3===0).slice(0,8);
 for(const b of litFronts){
  const [x0,y0,x1,y1]=b.bounds,x=(x0+x1)/2,z=-y0+.4,y=(b.surfaceHeight||0)+2;
  const area=new THREE.RectAreaLight(0xffcd96,8.5,(x1-x0)*.7,1.8);
  area.position.set(x,y,z);area.lookAt(x,y-1.6,z+6);parent.add(area);
 }
 return {fabric,lights};
}

// Ridge silhouettes and a stayed suspension span close the horizon behind the bowl.
export function addChongqingBackdrop(parent,config){
 const root=new THREE.Group();parent.add(root);
 const ridge=new THREE.MeshStandardMaterial({color:0x1c2340,roughness:1,flatShading:true});
 for(const [mx,my,base,height] of config.mountains||[]){
  const peak=new THREE.Mesh(new THREE.ConeGeometry(base,height,6,1),ridge);
  peak.position.set(mx,height/2-.3,-my);peak.rotation.y=hash(mx|0,my|0)*3;root.add(peak);
 }
 const {axis,deckY,pylons}=config.bridge,[ax,ay]=axis[0],[bx,by]=axis[1];
 const az=-ay,bz=-by,dx=bx-ax,dz=bz-az,span=Math.hypot(dx,dz),angle=Math.atan2(dz,dx),steel=mat(0x272e3d,.6,.5);
 const ux=dx/span,uz=dz/span,px=-uz,pz=ux;
 box(root,(ax+bx)/2,deckY,(az+bz)/2,span,1.7,9,steel,angle);
 for(const side of [-1,1])box(root,(ax+bx)/2,deckY+1.1,(az+bz)/2+side*4.2,span*.995,.22,.22,neonStrip(side<0?0x29e0ff:0xff4fa3,1.9),angle);
 for(let t=26;t<span-26;t+=34){
  const x=ax+ux*t,z=az+uz*t;
  glowBox(root,x,deckY+2.3,z,.3,.7,.3,0xffd9a0,2.2);
 }
 const towerTops=[];
 for(const [tx,ty] of pylons){
  const tz=-ty,t=ux*(tx-ax)+uz*(tz-az);
  for(const side of [-1,1]){
   const legX=tx+px*side*3.4,legZ=tz+pz*side*3.4;
   box(root,legX,deckY/2+2,legZ,2.4,deckY+4,2.4,steel);
   box(root,legX+px*side*1.2,deckY+11,legZ+pz*side*1.2,2,17,2,steel);
   glowBox(root,legX+px*side*1.2,deckY+19.8,legZ+pz*side*1.2,.4,.4,.4,0xff4040,3);
  }
  box(root,tx,deckY+6,tz,2.2,2.2,11.4,steel,angle);
  box(root,tx,deckY+15,tz,1.8,1.8,10.2,steel,angle);
  towerTops.push([tx,deckY+20,tz,t]);
 }
 // Main cables sweep pylon to pylon with a deck-skimming sag between.
 for(const side of [-1,1]){
  const points=[],s0=towerTops[0][3],s1=towerTops[1][3];
  for(let i=0;i<=30;i++){
   const t=i/30,along=s0+(s1-s0)*t,y=deckY+20-Math.sin(Math.PI*t)*(deckY+20-(deckY+3.2));
   points.push(new THREE.Vector3(ax+ux*along+px*side*4.6,y,az+uz*along+pz*side*4.6));
  }
  const cable=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),40,.14,6),steel);root.add(cable);
  for(let i=1;i<30;i++){
   const p=points[i],drop=p.y-(deckY+1.2);
   if(drop<2.5)continue;
   cylinder(root,p.x,deckY+1.2+drop/2,p.z,.045,drop,steel,4);
  }
 }
 batchStatic(root);
 return root;
}

// Slim luminaires with lit heads replace the daytime composite poles at night.
export function addNightLamps(parent,buildings){
 const root=new THREE.Group();parent.add(root);
 const pole=mat(0x2c323c,.5,.6);
 const street=buildings.filter(b=>b.quarterRole==='infill').slice(0,26);
 for(const b of street){
  const [x0,y0,x1,y1]=b.bounds,x=x0+1.4,z=-(b.front==='north'?y1+1.6:y0-1.6);
  cylinder(root,x,3.3,z,.08,6.6,pole,8);
  box(root,x,6.62,z,1.15,.12,.3,pole);
  glowBox(root,x+.42,6.5,z,.5,.16,.24,0xffe2b0,2.6);
 }
 batchStatic(root);return root;
}

// The surveyed junction gets its own pool of light so traffic reads clearly.
export function addJunctionLighting(parent,center){
 const root=new THREE.Group();parent.add(root);
 const [cx,cy]=center,z=-cy,pole=mat(0x2c323c,.5,.6);
 for(const [sx,sz] of [[-1,-1],[1,-1],[-1,1],[1,1]]){
  const x=cx+sx*15,zc=z+sz*15;
  cylinder(root,x,5,zc,.11,10,pole,8);
  box(root,x,10.1,zc,1.5,.14,.36,pole);
  glowBox(root,x+sz*0+sx*.5,9.9,zc+sz*.5,.66,.18,.3,0xffe2b0,2.8);
  // A soft warm pool on the asphalt beneath each head.
  const pool=new THREE.Mesh(new THREE.CircleGeometry(7,20),new THREE.MeshBasicMaterial({color:0xffdca8,transparent:true,opacity:.1,blending:THREE.AdditiveBlending,depthWrite:false}));
  pool.rotation.x=-Math.PI/2;pool.position.set(x,.06,zc);root.add(pool);
 }
 // One broad, faint wash across the whole junction keeps every actor legible.
 const wash=new THREE.Mesh(new THREE.CircleGeometry(26,24),new THREE.MeshBasicMaterial({color:0xbfd0ff,transparent:true,opacity:.07,blending:THREE.AdditiveBlending,depthWrite:false}));
 wash.rotation.x=-Math.PI/2;wash.position.set(cx,.05,z);root.add(wash);
 return root;
}

export function nightPavingMaterial(){
 return landmarkMaterial(0x5b6059,.96,'stone');
}

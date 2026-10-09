import {addChongqingTerrain} from './chongqing-terrain.mjs';
import {addXianQuarter,xianStoneRoad} from './xian-quarter.mjs';
import {addTianjinHeritage} from './tianjin-heritage.mjs';
import {landmarkMaterial,prepareLandmarkMaterials} from './changchun-landmark-materials.mjs';
import {addScenicRail,addLandmarkLabels} from './changchun-scenic-rail.mjs';
import {unifiedRoadMarkings,continuationPaint} from './city-road-continuation.mjs';
import {grassSurfaceMaterial,addFineFoliage} from './changchun-planting.mjs';
import {changchunContextBuilding,changchunLandscape} from './changchun-city-context.mjs';
import {createChangchunLandmark,changchunLandmarks} from './changchun-landmarks.mjs';
import * as THREE from 'three';
import {addStreetTrees} from './city-trees.mjs';
import {refineRoadMaterial,usesRefinedPresentation} from './city-lighting.mjs';
import {box,cylinder,mat,groundMaterial,batchStatic,textPanel} from './district/materials.js';
import {createCorner,createMappedSignal} from './sind-corner.mjs';
import {addCrosswalks} from './sind-markings.mjs';
import {buildingProfile,facadeSets,buildingDetails,forecourtDetails} from './city-architecture.mjs';
import {chongqingNightCity,addChongqingBackdrop,addNightLamps,nightPavingMaterial,neonStrip,addJunctionLighting} from './chongqing-night.mjs';
import {createChongqingLandmark,addChongqingCableway,addChongqingLandmarkLabels} from './chongqing-landmarks.mjs';
export function addSurface(root,geo,material,height=0,uvDirection=null){
 const polygons=geo.type==='Polygon'?[geo.coordinates]:geo.type==='MultiPolygon'?geo.coordinates:[];
 for(const rings of polygons){const shape=new THREE.Shape(rings[0].map(p=>new THREE.Vector2(...p)));for(const ring of rings.slice(1))shape.holes.push(new THREE.Path(ring.map(p=>new THREE.Vector2(...p))));const mesh=new THREE.Mesh(new THREE.ShapeGeometry(shape),material);if(uvDirection){const uv=mesh.geometry.attributes.uv,pos=mesh.geometry.attributes.position;for(let i=0;i<uv.count;i++)uv.setXY(i,pos.getX(i)*uvDirection[0]+pos.getY(i)*uvDirection[1],0);uv.needsUpdate=true;}mesh.rotation.x=-Math.PI/2;mesh.position.y=height;mesh.receiveShadow=true;root.add(mesh);}
}
export function buildDistrict(scene,config,observedRadius=Infinity){
 const root=new THREE.Group();scene.add(root);const [cx,cy]=config.center;
 const night=config.city==='chongqing';
 if(night&&config.terrain)addSurface(root,config.terrain.upperGround,landmarkMaterial(0x3f4545,.97,'stone'),-.07);else box(root,cx,-.22,-cy,(night?3000:1100),.3,(night?3000:1100),mat(night?0x3f4545:config.city==='xian'?0xb8aa91:0x91a18b,config.city==='xian'?.98:.78)).castShadow=false;
 addSurface(root,config.terrain?.upperPaving||config.paving,night?nightPavingMaterial():groundMaterial('paving',.28,.28),-.015);
 if(config.xianQuarter?.greenEdges)addSurface(root,config.xianQuarter.greenEdges,grassSurfaceMaterial(),.025);
 if(config.quarterGreenLand)addSurface(root,config.quarterGreenLand,grassSurfaceMaterial(),.024);
 const refined=usesRefinedPresentation(config.city),asphalt=config.xianQuarter?xianStoneRoad():groundMaterial('asphalt',refined?.5:.22,refined?.5:.22);if(!config.xianQuarter){asphalt.color.setHex(night?0x23262e:0xa1a6a8);if(refined)refineRoadMaterial(asphalt);}addSurface(root,config.roadSurface||config.road,asphalt);addSurface(root,config.extension,asphalt,-.008);
 const lines=new THREE.Group();root.add(lines);
 if(config.xianQuarter?.sceneryRoads)addSurface(root,config.xianQuarter.sceneryRoads,asphalt,-.008);
 // Road paint remains non-emissive at night.
 const white=config.xianQuarter?mat(0xaaa995):night?mat(0x929daa):mat(0xf3efdf),curb=night?mat(0x687581):mat(0xc8c8b9);
 if(config.alignedFootways)addSurface(root,config.alignedFootways,night?mat(0x49505e):groundMaterial('paving',.28,.28),.006);
 for(const way of config.ways){
  if((config.city==='changchun'||night)&&['line_thin','line_thick'].includes(way.tags.type))continue;
  if(!['curbstone','line_thin','line_thick','stop_line','guard_rail'].includes(way.tags.type))continue;
  const isCurb=way.tags.type==='curbstone',rail=way.tags.type==='guard_rail';
  for(let i=1;i<way.points.length;i++){
   const a=way.points[i-1],b=way.points[i],angle=Math.atan2(b[1]-a[1],b[0]-a[0]),length=Math.hypot(b[0]-a[0],b[1]-a[1]);if(length<.001)continue;
   const dashed=way.tags.subtype==='dashed';for(let start=0;start<length;start+=dashed?5:length+1){const len=dashed?Math.min(2.6,length-start):length,mid=start+len/2;box(lines,a[0]+Math.cos(angle)*mid,rail?.7:isCurb?.08:.032,-a[1]-Math.sin(angle)*mid,len,rail?.18:isCurb?.18:.025,way.tags.type==='stop_line'?.34:isCurb?.18:.11,isCurb?curb:white,angle);}
  }
 }
 for(const axis of config.extensionAxes||[]){const [a,b]=axis.points,angle=Math.atan2(b[1]-a[1],b[0]-a[0]),length=Math.hypot(b[0]-a[0],b[1]-a[1]),dx=Math.cos(angle),dy=Math.sin(angle);
  // Add the scenery's outer footways only beyond all observed actor positions.
  for(let start=4;!config.alignedFootways&&start<length;start+=2){const len=Math.min(2,length-start),mid=start+len/2,x=a[0]+dx*mid,y=a[1]+dy*mid;if(Math.hypot(x-cx,y-cy)<observedRadius+axis.width/2+5)continue;
   for(const side of [-1,1]){const offset=side*(axis.width/2+.17);box(lines,x-dy*offset,.08,-y-dx*offset,len,.16,.3,curb,angle);const walk=side*(axis.width/2+1.5);box(lines,x-dy*walk,.035,-y-dx*walk,len,.07,2.4,night?mat(0x49505e):mat(0xb6b6a8),angle);}
  }
 }
 if(config.city!=='changchun'){
  const yellow=night?mat(0xb8a068):mat(0xd5b86d);
  for(const s of continuationPaint(config))box(lines,(s.a[0]+s.b[0])/2,.027,-(s.a[1]+s.b[1])/2,Math.hypot(s.b[0]-s.a[0],s.b[1]-s.a[1]),.02,s.width,s.color==='yellow'?yellow:white,Math.atan2(s.b[1]-s.a[1],s.b[0]-s.a[0]));
 }
 if(config.city==='changchun'){
  const yellow=mat(0xe3b943);
  for(const segment of unifiedRoadMarkings(config)){
   const {a,b,width,color}=segment,len=Math.hypot(b[0]-a[0],b[1]-a[1]);
   box(lines,(a[0]+b[0])/2,.032,-(a[1]+b[1])/2,len,.025,width,color==='yellow'?yellow:white,Math.atan2(b[1]-a[1],b[0]-a[0]));
  }
 }
 batchStatic(lines);addCrosswalks(root,config.ways,config.xianQuarter?{color:'#b7b9a6',inlaid:true}:{});
 if(config.crosswalks.length){
  const c=document.createElement('canvas');c.width=32;c.height=2;const ctx=c.getContext('2d');ctx.fillStyle=config.xianQuarter?'#b7b9a6':'#eeecdf';ctx.fillRect(0,0,16,2);const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(.85,.85);t.encoding=THREE.sRGBEncoding;const paint=new THREE.MeshStandardMaterial({map:t,alphaTest:.5,roughness:.9});
  for(const geometry of config.crosswalks){const ring=geometry.coordinates[0];let best=[1,0],longest=0;for(let i=1;i<ring.length;i++){const dx=ring[i][0]-ring[i-1][0],dy=ring[i][1]-ring[i-1][1],l=Math.hypot(dx,dy);if(l>longest){longest=l;best=[dx/l,dy/l];}}addSurface(root,geometry,paint,.037,best);}
 }
 const facadeMaterials=facadeSets(),far=new THREE.Group();root.add(far);const trees=[];let featured;
 let cableway=null;const labelItems=[];
 if(config.xianQuarter){addXianQuarter(root,config.xianQuarter);featured=config.buildings.find(b=>b.kind==='changle');}
 if(config.city==='tianjin'){addTianjinHeritage(root,config);featured=config.buildings[0];}
 if(night){
  if(config.terrain){addSurface(root,config.terrain.cut,mat(0x38433c),-config.terrain.depth-.05);addChongqingTerrain(root,{...config.terrain,buildings:config.buildings});}
  chongqingNightCity(root,config.buildings);
  if(config.scenicRail)addScenicRail(root,config.scenicRail.points,config.scenicRail.height,config.scenicRail.piers);
  if(config.cableway)cableway=addChongqingCableway(root,config);
  if(config.mountains?.length)addChongqingBackdrop(root,config);


 }
 for(const [i,b]of config.buildings.entries()){
  if(config.xianQuarter||config.city==='tianjin')continue;
  if(night){
   if(b.quarterRole==='landmark'){
    const built=createChongqingLandmark(root,b),lx=(b.bounds[0]+b.bounds[2])/2,lz=-(b.bounds[1]+b.bounds[3])/2;
    if(built){if(!featured)featured=b;labelItems.push({x:lx,z:lz,topY:new THREE.Box3().setFromObject(built).max.y,name:b.name});}
    else labelItems.push({x:lx,z:lz,topY:34,name:b.name});
   }
   continue;
  }
  const {height,kind}=buildingProfile(b,i,config.center),facadeMaterial=facadeMaterials[kind];const [x0,y0,x1,y1]=b.bounds,x=(x0+x1)/2,y=(y0+y1)/2,w=x1-x0,d=y1-y0;
  if(config.city!=='changchun')box(far,x,-.015,-y,w+1.9,.04,d+1.9,mat(0x809471));
  const landmark=config.city==='changchun'&&changchunLandmarks[b.id];
  if(landmark){createChangchunLandmark(root,b);if(!featured)featured=b;}else if(config.city==='changchun'){changchunContextBuilding(root,b,i);}else if(b.detail){
   const shops=[['拾光咖啡','城市书房','邻里便利'],['社区药房','鲜果食集','麦香面包'],['城市展厅','轻食工坊','生活美学']][i%3];
   const site={id:b.id,building:{...b,shops,color:['#c6c1b4','#b8c0bc','#bac4c7'][i%3]},fixedFurniture:[]};createCorner(root,site,{type:'Polygon',coordinates:[[[x0-1,y0-1],[x1+1,y0-1],[x1+1,y1+1],[x0-1,y1+1],[x0-1,y0-1]]]});
   if(!featured)featured=b;
  }else{
   box(far,x,height/2,-y,w,height,d,facadeMaterial);box(far,x,height+.4,-y,w+.5,.8,d+.5,mat(0xc9cdc7));box(far,x,3,-y,w+1.8,6,d+1.8,mat(0xc2bcac));
   for(const dx of [-4,4])box(far,x+dx,height+1.3,-y,3,1.3,2.4,mat(0x778888));
   if(i%7===0)box(far,x,height+2,-y,w*.72,3,d*.72,mat(0x91a4a6));
  }
  if(config.city!=='changchun'&&!b.detail&&!landmark)buildingDetails(far,b,height,kind,i);if(config.city!=='changchun')forecourtDetails(far,b,i,landmark?[-10,10]:undefined);
  // Landscaping sits within each audited building's surrounding block.
  for(const dx of config.city==='changchun'?[]:landmark?[-10,10]:[-8,0,8])trees.push([x+dx,-y+(b.front==='north'?-1:1)*(d/2+3)]);
 }
 batchStatic(far);
 addStreetTrees(root,trees,config.city==='changchun'?{height:1.5,spread:1.5,fineLeaves:true}:{});
 if(config.city==='changchun')changchunLandscape(root,config.buildings);
 if(config.quarterGroves?.length)addStreetTrees(root,config.quarterGroves.map(([x,y])=>[x,-y]),{height:1.55,spread:1.45,fineLeaves:true});
 if(config.quarterCourtyardPlanting?.length){const points=config.quarterCourtyardPlanting;addStreetTrees(root,points.filter((p,i)=>i%3===0).map(([x,y])=>[x,-y]),{height:.9,spread:.85,fineLeaves:true});addFineFoliage(root,points.filter((p,i)=>i%3!==0).map(([x,y])=>[x,-y]));}
 if(config.quarterTramRail)addScenicRail(root,config.quarterTramRail,config.quarterTramRailHeight,config.quarterTramPiers);
 if(!night&&!config.xianQuarter){
  const lights=new THREE.Group();root.add(lights);
  for(const b of config.buildings.slice(0,16)){const x=b.bounds[0]+1,y=b.front==='north'?b.bounds[3]+1:b.bounds[1]-1;const metal=mat(0x607378,.35,.7);cylinder(lights,x,3.5,-y,.07,7,metal,8);box(lights,x+.5,6.95,-y,1.25,.09,.25,metal);box(lights,x+.82,6.9,-y,.5,.05,.24,mat(0xf1ecd6));}
  batchStatic(lights);
 }
 const signalHeads=config.signalBindings.map(b=>createMappedSignal(root,b));
 const landmarkLabels=config.quarterTramRail?addLandmarkLabels(root,config.buildings):night&&labelItems.length?addChongqingLandmarkLabels(root,labelItems):null;
 if(night)prepareLandmarkMaterials(root);
 return {root,signalHeads,featured,landmarkLabels,cableway};
}

import * as THREE from 'three';
import {FBXLoader} from 'three/addons/loaders/FBXLoader.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {humanVariants as variants} from './city-human-catalog.mjs';
const base='/assets/characters/rocketbox/';
const templates=[];let pending;
export function loadHumanAssets(){return pending??=(async()=>{
 const manager=new THREE.LoadingManager();manager.setURLModifier(url=>{if(!/\.tga$/i.test(url))return url;let name=url.split(/[\\/]/).at(-1).replace('_specular','_color');return base+name.replace('.tga',name.includes('opacity')?'.png':'.jpg');});manager.addHandler(/\.tga$/i,new THREE.TextureLoader(manager));
 const loader=new FBXLoader(manager),textures=new THREE.TextureLoader();
 const [walk,idle]=await Promise.all([loader.loadAsync(base+'m_walk_neutral.max.fbx'),loader.loadAsync(base+'m_idle_neutral_01.max.fbx')]);
 await Promise.all(variants.map(async (variant,index)=>{
 const [model,body,head,hair,bodyNormal,headNormal]=await Promise.all([loader.loadAsync(base+variant.file),...['body_color.jpg','head_color.jpg',variant.hair?'opacity_color.png':'head_color.jpg','body_normal.jpg','head_normal.jpg'].map(name=>textures.loadAsync(base+variant.prefix+'_'+name))]);
 for(const map of [body,head,hair]){map.encoding=THREE.sRGBEncoding;map.anisotropy=4;}
 const helpers=[];model.traverse(o=>{if(o.isLight||o.isCamera)helpers.push(o);if(!o.isMesh)return;o.castShadow=o.receiveShadow=true;o.frustumCulled=false;const convert=m=>{const opacity=m.name.includes('opacity'),face=m.name.includes('head');return new THREE.MeshStandardMaterial({name:m.name,map:opacity?hair:face?head:body,normalMap:opacity?null:face?headNormal:bodyNormal,normalScale:new THREE.Vector2(.3,.3),roughness:.88,metalness:0,alphaTest:opacity?.45:0,side:opacity?THREE.DoubleSide:THREE.FrontSide});};o.material=Array.isArray(o.material)?o.material.map(convert):convert(o.material);});for(const helper of helpers)helper.removeFromParent();
 const names=new Set();model.traverse(o=>{if(o.isBone){o.name=o.name.replace(/^Bip\d+/, 'Bip01');names.add(o.name);}});
 const rootHeight=model.getObjectByName('Bip01').position.y;
 const clean=(source,name)=>new THREE.AnimationClip(name,source.duration,source.tracks.filter(t=>names.has(t.name.split('.')[0])&&(t.name.endsWith('.quaternion')||t.name==='Bip01.position')).map(t=>{const c=t.clone();if(t.name==='Bip01.position')for(let i=0;i<c.values.length;i+=3){c.values[i]=0;c.values[i+2]=0;c.values[i+1]*=rootHeight/(t.values[1]||rootHeight);}return c;}));
 templates[index]={template:model,walkClip:clean(walk.animations[0],'walk'),idleClip:clean(idle.animations[0],'idle'),id:variant.id,profile:variant};
 }));
 })();}
function rig(variant=0){const {template,walkClip,idleClip,id,profile}=templates[variant]||{};if(!template)throw Error('人物资源尚未加载');const model=clone(template),root=new THREE.Group();model.scale.setScalar(.0098);model.rotation.y=Math.PI/2;root.add(model);const mixer=new THREE.AnimationMixer(model),idle=mixer.clipAction(idleClip),walk=mixer.clipAction(walkClip);idle.play();walk.play();walk.setEffectiveWeight(0);mixer.setTime(0);root.updateMatrixWorld(true);
 // Normalize actual posed height, preserving child limb proportions and feet at ground level.
 let bounds=posedBounds(root);model.scale.multiplyScalar(profile.height/(bounds.max.y-bounds.min.y));
 bounds=posedBounds(root);model.position.y-=bounds.min.y;root.updateMatrixWorld(true);
 const bones={};model.traverse(o=>{if(o.isBone)bones[o.name]=o;});return {root,model,mixer,idle,walk,bones,walkClip,id,profile};}
export function posedBounds(root){root.updateWorldMatrix(true,true);const bounds=new THREE.Box3(),v=new THREE.Vector3();root.traverse(o=>{if(!o.isMesh)return;if(o.isSkinnedMesh)o.skeleton.update();for(let i=0;i<o.geometry.attributes.position.count;i++){v.fromBufferAttribute(o.geometry.attributes.position,i);if(o.isSkinnedMesh)o.boneTransform(i,v);bounds.expandByPoint(v.applyMatrix4(o.matrixWorld));}});return bounds;}
export function createHumanWalker(variant=0){const r=rig(variant);if(r.profile.category==='older')addReadingGlasses(r);r.root.userData.animateHuman=(distance,speed)=>{const weight=THREE.MathUtils.clamp(speed/.65,0,1);r.walk.setEffectiveWeight(weight);r.idle.setEffectiveWeight(1-weight);r.mixer.setTime(distance/r.profile.stride*r.walkClip.duration);};r.root.userData.humanAsset=r.id;r.root.userData.humanCategory=r.profile.category;r.root.userData.humanHeight=r.profile.height;return r.root;}
function addReadingGlasses(r){
 const bounds=new THREE.Box3(),v=new THREE.Vector3();r.root.updateMatrixWorld(true);
 r.model.traverse(o=>{if(!o.isSkinnedMesh)return;o.skeleton.update();const index=o.skeleton.bones.indexOf(r.bones.Bip01_Head),indices=o.geometry.attributes.skinIndex,weights=o.geometry.attributes.skinWeight;
  for(let i=0;i<indices.count;i++){let weight=0;for(let j=0;j<4;j++)if(indices.array[i*4+j]===index)weight+=weights.array[i*4+j];if(weight<.5)continue;v.fromBufferAttribute(o.geometry.attributes.position,i);o.boneTransform(i,v);v.applyMatrix4(o.matrixWorld);bounds.expandByPoint(r.root.worldToLocal(v));}
 });
 if(bounds.isEmpty())return;
 const size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3()),x=bounds.max.x+.012,y=bounds.min.y+size.y*.6,spread=size.z*.23;
 const glasses=new THREE.Group(),material=new THREE.MeshStandardMaterial({color:0x444a4a,roughness:.4,metalness:.55});glasses.name='older-reading-glasses';
 for(const sign of [-1,1]){const rim=new THREE.Mesh(new THREE.TorusGeometry(size.z*.19,.0023,5,18),material);rim.position.set(x,y,center.z+sign*spread);rim.rotation.y=Math.PI/2;rim.scale.y=.8;glasses.add(rim);const arm=new THREE.Mesh(new THREE.BoxGeometry(size.x*.6,.003,.003),material);arm.position.set(x-size.x*.3,y,center.z+sign*(spread+size.z*.19));glasses.add(arm);}
 const bridge=new THREE.Mesh(new THREE.BoxGeometry(.003,.003,Math.max(.01,spread*2-size.z*.38)),material);bridge.position.set(x,y+.007,center.z);glasses.add(bridge);
 r.root.add(glasses);r.root.updateMatrixWorld(true);r.bones.Bip01_Head.attach(glasses);
}
function aim(bone,child,target){bone.updateWorldMatrix(true,true);const from=bone.getWorldPosition(new THREE.Vector3()),direction=child.getWorldPosition(new THREE.Vector3()).sub(from).normalize(),to=target.clone().sub(from).normalize(),world=bone.getWorldQuaternion(new THREE.Quaternion()),change=new THREE.Quaternion().setFromUnitVectors(direction,to);bone.quaternion.copy(bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(change.multiply(world)));bone.updateWorldMatrix(false,true);}
function solve(a,b,c,target,pole){const origin=a.getWorldPosition(new THREE.Vector3()),mid=b.getWorldPosition(new THREE.Vector3()),end=c.getWorldPosition(new THREE.Vector3()),l1=origin.distanceTo(mid),l2=mid.distanceTo(end),delta=target.clone().sub(origin),d=Math.min(delta.length(),l1+l2-.0001),dir=delta.normalize(),along=(l1*l1-l2*l2+d*d)/(2*d),height=Math.sqrt(Math.max(0,l1*l1-along*along)),perp=pole.clone().sub(origin);perp.addScaledVector(dir,-perp.dot(dir)).normalize();const joint=origin.clone().addScaledVector(dir,along).addScaledVector(perp,height);aim(a,b,joint);aim(b,c,target);}
export function attachHumanRider(bicycle,variant=0,type='bicycle'){const r=rig(variant);bicycle.add(r.root);const rest=new Map(Object.values(r.bones).map(b=>[b,{p:b.position.clone(),q:b.quaternion.clone()}]));bicycle.updateWorldMatrix(true,true);const neutralHead=bicycle.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(r.bones.Bip01_Head.getWorldQuaternion(new THREE.Quaternion()));
 bicycle.userData.animateHuman=distance=>{for(const [bone,s]of rest){bone.position.copy(s.p);bone.quaternion.copy(s.q);}bicycle.updateWorldMatrix(true,true);const world=p=>bicycle.localToWorld(new THREE.Vector3(...p)),handX=(bicycle.userData.handlebarX??.49)-.06;
  const hips=r.bones.Bip01,pelvis=r.bones.Bip01_Pelvis,shift=world([-.17,1.0,0]).sub(pelvis.getWorldPosition(new THREE.Vector3())),newPosition=hips.getWorldPosition(new THREE.Vector3()).add(shift);hips.position.copy(hips.parent.worldToLocal(newPosition));bicycle.updateWorldMatrix(true,true);
  aim(r.bones.Bip01_Spine,r.bones.Bip01_Neck,world(type==='bicycle'?(r.profile.category==='woman'?[.24,1.42,0]:[.10,1.52,0]):r.profile.category==='woman'?[.10,1.52,0]:[.015,1.56,0]));
  // Counter the torso pitch so the rider looks along the road, not into the tank.
  const head=r.bones.Bip01_Head;head.quaternion.copy(head.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(bicycle.getWorldQuaternion(new THREE.Quaternion()).multiply(neutralHead)));head.updateWorldMatrix(false,true);
  for(const [side,sign]of [['L',-1],['R',1]]){const cycling=type==='bicycle',angle=-distance*Math.PI*2/4.1,px=cycling?sign*.13*Math.cos(angle):.04,py=cycling?.38+sign*.13*Math.sin(angle):.38,spread=cycling?.14:type==='motorcycle'?.24:.21,foot=world([px,py+.08,sign*spread]);solve(r.bones['Bip01_'+side+'_Thigh'],r.bones['Bip01_'+side+'_Calf'],r.bones['Bip01_'+side+'_Foot'],foot,world([.6,.75,sign*.18]));aim(r.bones['Bip01_'+side+'_Foot'],r.bones['Bip01_'+side+'_Toe0'],world([px+.10,py+.025,sign*spread]));solve(r.bones['Bip01_'+side+'_UpperArm'],r.bones['Bip01_'+side+'_Forearm'],r.bones['Bip01_'+side+'_Hand'],world([handX,1.15,sign*.23]),world([.35,1.1,sign*.45]));aim(r.bones['Bip01_'+side+'_Hand'],r.bones['Bip01_'+side+'_Finger2'],world([handX+.08,1.10,sign*.23]));
   // Curl finger chains around the handlebar instead of leaving an open hand.
   for(let finger=1;finger<=4;finger++){const name='Bip01_'+side+'_Finger'+finger,a=r.bones[name],b=r.bones[name+'1'],c=r.bones[name+'2'];if(!a||!b||!c)continue;const z=bicycle.worldToLocal(a.getWorldPosition(new THREE.Vector3())).z;aim(a,b,world([handX+.086,1.087,z]));aim(b,c,world([handX+.057,1.073,z]));}
  }
 };bicycle.userData.riderPose=type;bicycle.userData.humanAsset=r.id;bicycle.userData.humanCategory=r.profile.category;bicycle.userData.humanHeight=r.profile.height;
 // Fit on the neutral upright head before applying the seated pose.
 if(type==='motorcycle')addRiderHelmet(bicycle,r);
 bicycle.userData.animateHuman(0);
 return bicycle;}
function addRiderHelmet(vehicle,r){
 vehicle.updateWorldMatrix(true,true);const bounds=new THREE.Box3(),v=new THREE.Vector3(),headBase=vehicle.worldToLocal(r.bones.Bip01_Head.getWorldPosition(new THREE.Vector3()));
 r.model.traverse(o=>{if(!o.isSkinnedMesh)return;o.skeleton.update();const head=o.skeleton.bones.indexOf(r.bones.Bip01_Head),indices=o.geometry.attributes.skinIndex,weights=o.geometry.attributes.skinWeight;
  const hairVertices=new Set();for(const group of o.geometry.groups){const material=Array.isArray(o.material)?o.material[group.materialIndex]:o.material;if(!material?.name.includes('opacity'))continue;for(let k=group.start;k<group.start+group.count;k++)hairVertices.add(o.geometry.index?o.geometry.index.array[k]:k);}
  for(let i=0;i<indices.count;i++){if(hairVertices.has(i))continue;let influence=0;for(let j=0;j<4;j++)if(indices.array[i*4+j]===head)influence+=weights.array[i*4+j];if(influence<.5)continue;
   v.fromBufferAttribute(o.geometry.attributes.position,i);o.boneTransform(i,v);v.applyMatrix4(o.matrixWorld);vehicle.worldToLocal(v);if(v.y<headBase.y-.018)continue;bounds.expandByPoint(v);
  }
 });
 if(bounds.isEmpty())return;const center=bounds.getCenter(new THREE.Vector3()),size=bounds.getSize(new THREE.Vector3());
 // A fitted open-face helmet: raised brow opening, lower ear/rear coverage.
 // Build in vehicle coordinates, then attach to the head so the fit follows its pose.
 const helmet=new THREE.Group();helmet.name='rider-helmet';helmet.userData.headSize=size.toArray();
 const rx=size.x*.62+.012,ry=size.y*.56,rz=size.z*.59+.009;
 center.x-=size.x*.07;center.y+=size.y*.045;
 const segments=40,rings=16,positions=[],indices=[],edge=[];
 const surface=(phi,t)=>new THREE.Vector3(center.x+rx*Math.cos(phi)*Math.sin(t),center.y+ry*Math.cos(t),center.z+rz*Math.sin(phi)*Math.sin(t));
 for(let j=0;j<=rings;j++)for(let i=0;i<=segments;i++){
  const phi=i/segments*Math.PI*2,front=Math.max(0,Math.cos(phi)),end=Math.PI*(.66-.29*front*front),v=surface(phi,end*j/rings);
  positions.push(v.x,v.y,v.z);if(j===rings)edge.push(v);
  if(j<rings&&i<segments){const a=j*(segments+1)+i,b=a+segments+1;indices.push(a,a+1,b,a+1,b+1,b);}
 }
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();
 const colors=[0x48555f,0xd6d3c8,0x985d48,0x5b7373],shell=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:colors[variants.indexOf(r.profile)%colors.length],roughness:.38,metalness:.08,side:THREE.DoubleSide}));
 shell.name='helmet-shell';shell.castShadow=shell.receiveShadow=true;helmet.add(shell);
 const trim=new THREE.MeshStandardMaterial({color:0x252a2d,roughness:.85});
 const rim=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(edge.slice(0,-1),true),80,.004,6,true),trim);rim.name='helmet-edge-trim';helmet.add(rim);
 // Short projecting brow, rather than a wide bowl-like brim.
 const brow=[];for(let i=0;i<=16;i++){const phi=-.72+i/16*1.44,end=Math.PI*(.66-.29*Math.cos(phi)**2),v=surface(phi,end);v.x+=.018;brow.push(v);}
 const peak=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(brow),24,.007,6,false),trim);peak.name='helmet-brow';helmet.add(peak);
 for(const sign of [-1,1]){
  const pivot=new THREE.Mesh(new THREE.CylinderGeometry(.014,.014,.006,12),trim);pivot.rotation.x=Math.PI/2;pivot.position.set(center.x+rx*.35,center.y-ry*.12,center.z+sign*rz*.94);pivot.name='helmet-side-fastener';helmet.add(pivot);
  const strap=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
   new THREE.Vector3(center.x-rx*.12,center.y-ry*.37,center.z+sign*rz*.92),
   new THREE.Vector3(center.x+rx*.3,bounds.min.y+size.y*.18,center.z+sign*rz*.55),
   new THREE.Vector3(center.x+rx*.38,bounds.min.y+size.y*.12,center.z)
  ]),12,.0035,5,false),trim);strap.name='helmet-chin-strap';helmet.add(strap);
 }
 vehicle.add(helmet);vehicle.updateMatrixWorld(true);r.bones.Bip01_Head.attach(helmet);
}

const driverTemplates=new Map();
export function createHumanDriver(type='car',variant=0){
 // Adult appearance only. Bake the seated pose once per cabin/appearance;
 // drivers need no per-frame skeleton updates and share geometry across vehicles.
 variant=variant%4;const key=type+'-'+variant;if(driverTemplates.has(key))return driverTemplates.get(key).clone(true);
 const layout={car:{scale:.85,hip:[.04,.77,-.38],neck:[.12,1.34,-.38],wheel:[.52,1.2,-.38],foot:[.84,.48,-.38]},bus:{scale:1,hip:[4.38,1.43,-.68],neck:[4.46,2.12,-.68],wheel:[4.86,1.88,-.68],foot:[5.12,1.08,-.68]},truck:{scale:.9,hip:[2.10,1.31,-.52],neck:[2.18,1.92,-.52],wheel:[2.73,1.72,-.52],foot:[2.95,.92,-.52]}}[type];
 if(!layout)throw Error('未知驾驶室类型');const r=rig(variant);r.root.scale.setScalar(layout.scale);r.root.updateMatrixWorld(true);
 const world=p=>r.root.parent?r.root.parent.localToWorld(new THREE.Vector3(...p)):new THREE.Vector3(...p);
 const hip=r.bones.Bip01,pelvis=r.bones.Bip01_Pelvis,shift=world(layout.hip).sub(pelvis.getWorldPosition(new THREE.Vector3()));hip.position.copy(hip.parent.worldToLocal(hip.getWorldPosition(new THREE.Vector3()).add(shift)));r.root.updateMatrixWorld(true);
 aim(r.bones.Bip01_Spine,r.bones.Bip01_Neck,world(layout.neck));
 for(const [side,sign]of [['L',-1],['R',1]]){
  const foot=[layout.foot[0],layout.foot[1],layout.foot[2]+sign*.12];
  solve(r.bones['Bip01_'+side+'_Thigh'],r.bones['Bip01_'+side+'_Calf'],r.bones['Bip01_'+side+'_Foot'],world(foot),world([layout.hip[0]+.45,layout.hip[1]-.10,layout.hip[2]+sign*.15]));
  aim(r.bones['Bip01_'+side+'_Foot'],r.bones['Bip01_'+side+'_Toe0'],world([foot[0]+.13,foot[1]-.03,foot[2]]));
  const radius=type==='car'?.125:.15;
  const hand=[layout.wheel[0]-.055,layout.wheel[1]+.035,layout.wheel[2]+sign*(radius+.015)];
  solve(r.bones['Bip01_'+side+'_UpperArm'],r.bones['Bip01_'+side+'_Forearm'],r.bones['Bip01_'+side+'_Hand'],world(hand),world([layout.hip[0]+.17,layout.wheel[1]-.24,layout.hip[2]+sign*.26]));
  aim(r.bones['Bip01_'+side+'_Hand'],r.bones['Bip01_'+side+'_Finger2'],world([layout.wheel[0]+.016,hand[1]-.012,hand[2]-sign*.018]));
  // Turn each palm toward the rim, retaining a relaxed wrist angle.
  const wrist=r.bones['Bip01_'+side+'_Hand'],middle=r.bones['Bip01_'+side+'_Finger2'],index=r.bones['Bip01_'+side+'_Finger1'],little=r.bones['Bip01_'+side+'_Finger4'];
  const origin=wrist.getWorldPosition(new THREE.Vector3()),axis=middle.getWorldPosition(new THREE.Vector3()).sub(origin).normalize();
  const normal=index.getWorldPosition(new THREE.Vector3()).sub(origin).cross(little.getWorldPosition(new THREE.Vector3()).sub(origin)).normalize();if(normal.y<0)normal.negate();
  const desired=new THREE.Vector3(0,0,-sign).addScaledVector(axis,sign*axis.z).normalize();normal.addScaledVector(axis,-normal.dot(axis)).normalize();
  const roll=Math.atan2(axis.dot(normal.clone().cross(desired)),normal.dot(desired)),rotation=new THREE.Quaternion().setFromAxisAngle(axis,roll).multiply(wrist.getWorldQuaternion(new THREE.Quaternion()));
  wrist.quaternion.copy(wrist.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(rotation));wrist.updateWorldMatrix(false,true);
  for(let finger=1;finger<=4;finger++){const name='Bip01_'+side+'_Finger'+finger,a=r.bones[name],b=r.bones[name+'1'],c=r.bones[name+'2'];if(!a||!b||!c)continue;const base=a.getWorldPosition(new THREE.Vector3()),y=base.y;aim(a,b,world([layout.wheel[0]+.022,y,layout.wheel[2]+sign*(radius-.004)]));aim(b,c,world([layout.wheel[0]+.003,y-.012,layout.wheel[2]+sign*(radius-.027)]));}
  const thumb=r.bones['Bip01_'+side+'_Finger0'],thumbMid=r.bones['Bip01_'+side+'_Finger01'],thumbTip=r.bones['Bip01_'+side+'_Finger02'];
  if(thumb&&thumbMid&&thumbTip){aim(thumb,thumbMid,world([layout.wheel[0]-.008,hand[1]-.026,layout.wheel[2]+sign*(radius-.009)]));aim(thumbMid,thumbTip,world([layout.wheel[0]+.01,hand[1]-.045,layout.wheel[2]+sign*(radius-.02)]));}
 }
 r.root.updateMatrixWorld(true);const baked=new THREE.Group();baked.name='vehicle-driver';
 r.model.traverse(o=>{if(!o.isSkinnedMesh)return;o.skeleton.update();const geometry=o.geometry.clone(),position=geometry.attributes.position,v=new THREE.Vector3();
  for(let i=0;i<position.count;i++){v.fromBufferAttribute(o.geometry.attributes.position,i);o.boneTransform(i,v);v.applyMatrix4(o.matrixWorld);position.setXYZ(i,v.x,v.y,v.z);}
  geometry.deleteAttribute('skinIndex');geometry.deleteAttribute('skinWeight');geometry.computeVertexNormals();geometry.computeBoundingSphere();
  const mesh=new THREE.Mesh(geometry,o.material);mesh.castShadow=mesh.receiveShadow=true;baked.add(mesh);
 });
 baked.userData.driverAsset=r.id;baked.userData.driverType=type;driverTemplates.set(key,baked);return baked.clone(true);
}

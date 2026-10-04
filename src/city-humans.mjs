import * as THREE from 'three';
import {FBXLoader} from 'three/addons/loaders/FBXLoader.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
const base='/assets/characters/rocketbox/';
const variants=[{file:"Male_Adult_01.fbx",prefix:"m002",id:"rocketbox-male-adult-01"},{file:"Male_Adult_02.fbx",prefix:"m003",id:"rocketbox-male-adult-02"}];
const templates=[];let pending;
export function loadHumanAssets(){return pending??=(async()=>{
 const manager=new THREE.LoadingManager();manager.setURLModifier(url=>{if(!/\.tga$/i.test(url))return url;let name=url.split(/[\\/]/).at(-1).replace('_specular','_color');return base+name.replace('.tga',name.includes('opacity')?'.png':'.jpg');});manager.addHandler(/\.tga$/i,new THREE.TextureLoader(manager));
 const loader=new FBXLoader(manager),textures=new THREE.TextureLoader();
 const [walk,idle]=await Promise.all([loader.loadAsync(base+'m_walk_neutral.max.fbx'),loader.loadAsync(base+'m_idle_neutral_01.max.fbx')]);
 await Promise.all(variants.map(async (variant,index)=>{
 const [model,body,head,hair,bodyNormal,headNormal]=await Promise.all([loader.loadAsync(base+variant.file),...['body_color.jpg','head_color.jpg','opacity_color.png','body_normal.jpg','head_normal.jpg'].map(name=>textures.loadAsync(base+variant.prefix+'_'+name))]);
 for(const map of [body,head,hair]){map.encoding=THREE.sRGBEncoding;map.anisotropy=4;}
 const helpers=[];model.traverse(o=>{if(o.isLight||o.isCamera)helpers.push(o);if(!o.isMesh)return;o.castShadow=o.receiveShadow=true;o.frustumCulled=false;const convert=m=>{const opacity=m.name.includes('opacity'),face=m.name.includes('head');return new THREE.MeshStandardMaterial({name:m.name,map:opacity?hair:face?head:body,normalMap:opacity?null:face?headNormal:bodyNormal,normalScale:new THREE.Vector2(.3,.3),roughness:.88,metalness:0,alphaTest:opacity?.45:0,side:opacity?THREE.DoubleSide:THREE.FrontSide});};o.material=Array.isArray(o.material)?o.material.map(convert):convert(o.material);});for(const helper of helpers)helper.removeFromParent();
 const names=new Set();model.traverse(o=>{if(o.isBone)names.add(o.name);});
 const clean=(source,name)=>new THREE.AnimationClip(name,source.duration,source.tracks.filter(t=>names.has(t.name.split('.')[0])&&(t.name.endsWith('.quaternion')||t.name==='Bip01.position')).map(t=>{const c=t.clone();if(t.name==='Bip01.position')for(let i=0;i<c.values.length;i+=3){c.values[i]=0;c.values[i+2]=0;}return c;}));
 templates[index]={template:model,walkClip:clean(walk.animations[0],'walk'),idleClip:clean(idle.animations[0],'idle'),id:variant.id};
 }));
 })();}
function rig(variant=0){const {template,walkClip,idleClip,id}=templates[variant]||{};if(!template)throw Error('人物资源尚未加载');const model=clone(template),root=new THREE.Group();model.scale.setScalar(.0098);model.rotation.y=Math.PI/2;root.add(model);const mixer=new THREE.AnimationMixer(model),idle=mixer.clipAction(idleClip),walk=mixer.clipAction(walkClip);idle.play();walk.play();walk.setEffectiveWeight(0);mixer.setTime(0);root.updateMatrixWorld(true);
 // Skinned vertex bounds must be evaluated in the posed skeleton, not the bind pose.
 let minY=Infinity;const v=new THREE.Vector3();model.traverse(o=>{if(!o.isSkinnedMesh)return;o.skeleton.update();for(let i=0;i<o.geometry.attributes.position.count;i++){v.fromBufferAttribute(o.geometry.attributes.position,i);o.boneTransform(i,v);v.applyMatrix4(o.matrixWorld);minY=Math.min(minY,v.y);}});model.position.y=-minY;
 const bones={};model.traverse(o=>{if(o.isBone)bones[o.name]=o;});return {root,model,mixer,idle,walk,bones,walkClip,id};}
export function posedBounds(root){root.updateWorldMatrix(true,true);const bounds=new THREE.Box3(),v=new THREE.Vector3();root.traverse(o=>{if(!o.isMesh)return;if(o.isSkinnedMesh)o.skeleton.update();for(let i=0;i<o.geometry.attributes.position.count;i++){v.fromBufferAttribute(o.geometry.attributes.position,i);if(o.isSkinnedMesh)o.boneTransform(i,v);bounds.expandByPoint(v.applyMatrix4(o.matrixWorld));}});return bounds;}
export function createHumanWalker(variant=0){const r=rig(variant);r.root.userData.animateHuman=(distance,speed)=>{const weight=THREE.MathUtils.clamp(speed/.65,0,1);r.walk.setEffectiveWeight(weight);r.idle.setEffectiveWeight(1-weight);r.mixer.setTime(distance/1.35*r.walkClip.duration);};r.root.userData.humanAsset=r.id;return r.root;}
function aim(bone,child,target){bone.updateWorldMatrix(true,true);const from=bone.getWorldPosition(new THREE.Vector3()),direction=child.getWorldPosition(new THREE.Vector3()).sub(from).normalize(),to=target.clone().sub(from).normalize(),world=bone.getWorldQuaternion(new THREE.Quaternion()),change=new THREE.Quaternion().setFromUnitVectors(direction,to);bone.quaternion.copy(bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(change.multiply(world)));bone.updateWorldMatrix(false,true);}
function solve(a,b,c,target,pole){const origin=a.getWorldPosition(new THREE.Vector3()),mid=b.getWorldPosition(new THREE.Vector3()),end=c.getWorldPosition(new THREE.Vector3()),l1=origin.distanceTo(mid),l2=mid.distanceTo(end),delta=target.clone().sub(origin),d=Math.min(delta.length(),l1+l2-.0001),dir=delta.normalize(),along=(l1*l1-l2*l2+d*d)/(2*d),height=Math.sqrt(Math.max(0,l1*l1-along*along)),perp=pole.clone().sub(origin);perp.addScaledVector(dir,-perp.dot(dir)).normalize();const joint=origin.clone().addScaledVector(dir,along).addScaledVector(perp,height);aim(a,b,joint);aim(b,c,target);}
export function attachHumanRider(bicycle,variant=0,type='bicycle'){const r=rig(variant);bicycle.add(r.root);const rest=new Map(Object.values(r.bones).map(b=>[b,{p:b.position.clone(),q:b.quaternion.clone()}]));
 bicycle.userData.animateHuman=distance=>{for(const [bone,s]of rest){bone.position.copy(s.p);bone.quaternion.copy(s.q);}bicycle.updateWorldMatrix(true,true);const world=p=>bicycle.localToWorld(new THREE.Vector3(...p));
  const hips=r.bones.Bip01,pelvis=r.bones.Bip01_Pelvis,shift=world([-.17,1.0,0]).sub(pelvis.getWorldPosition(new THREE.Vector3())),newPosition=hips.getWorldPosition(new THREE.Vector3()).add(shift);hips.position.copy(hips.parent.worldToLocal(newPosition));bicycle.updateWorldMatrix(true,true);
  aim(r.bones.Bip01_Spine,r.bones.Bip01_Neck,world([.10,1.52,0]));
  for(const [side,sign]of [['L',-1],['R',1]]){const cycling=type==='bicycle',angle=-distance*Math.PI*2/4.1,px=cycling?sign*.13*Math.cos(angle):.04,py=cycling?.38+sign*.13*Math.sin(angle):.38,spread=cycling?.14:type==='motorcycle'?.24:.21,foot=world([px,py+.08,sign*spread]);solve(r.bones['Bip01_'+side+'_Thigh'],r.bones['Bip01_'+side+'_Calf'],r.bones['Bip01_'+side+'_Foot'],foot,world([.6,.75,sign*.18]));aim(r.bones['Bip01_'+side+'_Foot'],r.bones['Bip01_'+side+'_Toe0'],world([px+.10,py+.025,sign*spread]));solve(r.bones['Bip01_'+side+'_UpperArm'],r.bones['Bip01_'+side+'_Forearm'],r.bones['Bip01_'+side+'_Hand'],world([.43,1.15,sign*.23]),world([.35,1.1,sign*.45]));aim(r.bones['Bip01_'+side+'_Hand'],r.bones['Bip01_'+side+'_Finger2'],world([.51,1.10,sign*.23]));
   // Curl finger chains around the handlebar instead of leaving an open hand.
   for(let finger=1;finger<=4;finger++){const name='Bip01_'+side+'_Finger'+finger,a=r.bones[name],b=r.bones[name+'1'],c=r.bones[name+'2'];if(!a||!b||!c)continue;const z=bicycle.worldToLocal(a.getWorldPosition(new THREE.Vector3())).z;aim(a,b,world([.516,1.087,z]));aim(b,c,world([.487,1.073,z]));}
  }
 };bicycle.userData.riderPose=type;bicycle.userData.humanAsset=r.id;bicycle.userData.animateHuman(0);
 if(type==='motorcycle')addRiderHelmet(bicycle,r);
 return bicycle;}
function addRiderHelmet(vehicle,r){
 vehicle.updateWorldMatrix(true,true);const bounds=new THREE.Box3(),v=new THREE.Vector3();
 r.model.traverse(o=>{if(!o.isSkinnedMesh)return;o.skeleton.update();const head=o.skeleton.bones.indexOf(r.bones.Bip01_Head),indices=o.geometry.attributes.skinIndex,weights=o.geometry.attributes.skinWeight;
  for(let i=0;i<indices.count;i++){let influence=0;for(let j=0;j<4;j++)if(indices.array[i*4+j]===head)influence+=weights.array[i*4+j];if(influence<.5)continue;
   v.fromBufferAttribute(o.geometry.attributes.position,i);o.boneTransform(i,v);v.applyMatrix4(o.matrixWorld);vehicle.worldToLocal(v);bounds.expandByPoint(v);
  }
 });
 if(bounds.isEmpty())return;const center=bounds.getCenter(new THREE.Vector3()),size=bounds.getSize(new THREE.Vector3());
 const shell=new THREE.Mesh(new THREE.SphereGeometry(1,24,16,0,Math.PI*2,0,Math.PI*.51),new THREE.MeshStandardMaterial({color:0xc6ccc7,roughness:.35,metalness:.12}));
 shell.name='rider-helmet';shell.position.copy(center);shell.position.x-=.035;shell.position.y+=.08;shell.scale.set(size.x*.62+.02,size.y*.46,size.z*.60+.014);shell.castShadow=true;shell.receiveShadow=true;vehicle.add(shell);
}

import {foliageMap} from './changchun-planting.mjs';
import * as THREE from 'three';
export function addStreetTrees(root,positions,{height=1,spread=1,fineLeaves=false}={}){
 let leaf=new THREE.BufferGeometry();leaf.setAttribute('position',new THREE.Float32BufferAttribute([0,.07,0,0,0,.9,.38,.015,.52,.5,0,0,.32,-.035,-.48,0,0,-.75,-.32,-.035,-.48,-.5,0,0,-.38,.015,.52],3));leaf.setIndex(Array.from({length:8},(_,i)=>[0,i+1,(i+1)%8+1]).flat());leaf.computeVertexNormals();
 if(fineLeaves){leaf.dispose();leaf=new THREE.PlaneGeometry(1,1);}
 const foliage=new THREE.MeshStandardMaterial({color:0xb7c8a9,roughness:.92,side:THREE.DoubleSide,...(fineLeaves?{map:foliageMap(),alphaTest:.4}:{})});
 const bark=new THREE.MeshStandardMaterial({color:0x726553,roughness:.96});
 const count=650,branchesPerTree=7,leaves=new THREE.InstancedMesh(leaf,foliage,positions.length*count),branches=new THREE.InstancedMesh(new THREE.CylinderGeometry(.045,.10,1,9),bark,positions.length*branchesPerTree),trunks=new THREE.InstancedMesh(new THREE.CylinderGeometry(.10,.19,3.3,12),bark,positions.length),dummy=new THREE.Object3D();
 let seed=37;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 positions.forEach(([x,z],i)=>{
  dummy.position.set(x,1.65,z);dummy.rotation.set(0,0,0);dummy.scale.set(1,1,1);dummy.updateMatrix();trunks.setMatrixAt(i,dummy.matrix);
  const lobes=[];for(let k=0;k<branchesPerTree;k++){const angle=k*Math.PI*2/branchesPerTree+random()*.25,end=new THREE.Vector3(x+Math.cos(angle)*(.65+random()*.35),3.9+random()*.75,z+Math.sin(angle)*(.65+random()*.35)),start=new THREE.Vector3(x,2.45+random()*.5,z),v=end.clone().sub(start);lobes.push(end);dummy.position.copy(start).add(end).multiplyScalar(.5);dummy.scale.set(1,v.length(),1);dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize());dummy.updateMatrix();branches.setMatrixAt(i*branchesPerTree+k,dummy.matrix);}
  for(let j=0;j<count;j++){const c=lobes[j%lobes.length],angle=random()*Math.PI*2,v=random()*2-1,r=Math.cbrt(random()),u=Math.sqrt(1-v*v);dummy.position.set(c.x+Math.cos(angle)*u*r*.70,c.y+v*r*.90,c.z+Math.sin(angle)*u*r*.70);const scale=fineLeaves?.55+random()*.15:.15+random()*.10;dummy.scale.set(scale,scale,scale);dummy.rotation.set(random()*3,random()*6,random()*3);dummy.updateMatrix();leaves.setMatrixAt(i*count+j,dummy.matrix);leaves.setColorAt(i*count+j,new THREE.Color().setHSL(.235+random()*.035,.25+random()*.1,.31+random()*.12));}
 });
 // Scale each tree around its own planting point, never the world origin.
 if(height!==1||spread!==1){
  const matrix=new THREE.Matrix4(),transforms=positions.map(([x,z])=>new THREE.Matrix4().makeTranslation(x,0,z).multiply(new THREE.Matrix4().makeScale(spread,height,spread)).multiply(new THREE.Matrix4().makeTranslation(-x,0,-z)));
  for(const [mesh,perTree]of [[trunks,1],[branches,branchesPerTree],[leaves,count]])for(let i=0;i<mesh.count;i++){
   mesh.getMatrixAt(i,matrix);matrix.premultiply(transforms[Math.floor(i/perTree)]);mesh.setMatrixAt(i,matrix);
  }
 }
 for(const mesh of [trunks,branches,leaves]){mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);}
 return {trunks,branches,leaves};
}

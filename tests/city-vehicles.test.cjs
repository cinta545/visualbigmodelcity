const test=require('node:test'),assert=require('node:assert/strict');
for(const type of ['car','bus','truck'])test(type+' refined vehicle clones retain independent wheel pivots, finite geometry and recorded footprint scaling',async()=>{
 const THREE=await import('three'),{createRefinedVehicle}=await import('../src/city-vehicles.mjs'),{animateActor}=await import('../src/sind-actors.mjs');
 const a=createRefinedVehicle(type),b=createRefinedVehicle(type);assert.equal(a.userData.wheels.length,4);
 for(let i=0;i<4;i++){assert.notEqual(a.userData.wheels[i],b.userData.wheels[i]);assert.equal(a.userData.wheels[i].parent,a);}
 a.traverse(o=>{if(o.geometry)assert.ok([...o.geometry.attributes.position.array].every(Number.isFinite));});
 const bounds=new THREE.Box3().setFromObject(a),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
 a.position.set(-center.x,-bounds.min.y,-center.z);const root=new THREE.Group();root.add(a);root.scale.set(4.7/size.x,1,1.9/size.z);root.userData=a.userData;
 const scaled=new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3());assert.ok(Math.abs(scaled.x-4.7)<1e-6);assert.ok(Math.abs(scaled.z-1.9)<1e-6);
 animateActor(root,3,2);assert.deepEqual(root.position.toArray(),[0,0,0]);assert.notEqual(a.userData.wheels[0].rotation.z,0);assert.ok(Math.abs(b.userData.wheels[0].rotation.z)<1e-12);
});

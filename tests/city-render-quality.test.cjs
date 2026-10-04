const test=require('node:test'),assert=require('node:assert/strict');
test('vehicle detail hysteresis reduces wheel geometry and inspection restores it',async()=>{
 const THREE=await import('three'),{createRefinedVehicle}=await import('../src/city-vehicles.mjs'),{updateVehicleDetail}=await import('../src/city-render-quality.mjs');
 for(const type of ['car','bus','truck']){const car=createRefinedVehicle(type);const count=()=>{let n=0;car.traverseVisible(o=>{if(o.geometry)n+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;});return n;};
 updateVehicleDetail(car,40);const near=count();updateVehicleDetail(car,90);const far=count();assert.ok(far<near*.85);assert.equal(updateVehicleDetail(car,72),false);assert.equal(updateVehicleDetail(car,60),true);assert.equal(updateVehicleDetail(car,200,true),true);assert.equal(count(),near);assert.equal(car.userData.wheels.length,4);
 }
});
test('following converges smoothly, handles record jumps and never moves the observed object',async()=>{
 const THREE=await import('three'),{followVehicle,focusDaylightShadow}=await import('../src/city-render-quality.mjs');
 const object=new THREE.Object3D(),camera=new THREE.PerspectiveCamera(),target=new THREE.Vector3(),state={};object.position.set(20,0,30);camera.position.set(100,50,100);
 const original=object.position.toArray(),end=new THREE.Vector3(10,6.7,40),before=camera.position.distanceTo(end);followVehicle(camera,target,object,1/60,state);assert.ok(camera.position.distanceTo(end)<before);assert.ok(camera.position.distanceTo(end)>0);
 for(let i=0;i<180;i++)followVehicle(camera,target,object,1/60,state);assert.ok(camera.position.distanceTo(end)<.01);assert.deepEqual(object.position.toArray(),original);
 object.position.x+=100;followVehicle(camera,target,object,1/60,state);assert.ok(target.distanceTo(object.position.clone().add(new THREE.Vector3(0,.7,0)))<1e-8);
 const sun=new THREE.DirectionalLight();focusDaylightShadow(sun,camera,target);assert.equal(sun.shadow.camera.right,42);camera.position.y=300;focusDaylightShadow(sun,camera,target);assert.equal(sun.shadow.camera.right,105);
});

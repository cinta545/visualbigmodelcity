const test=require('node:test');
const assert=require('node:assert/strict');
test('cursor zoom preserves off-centre projection and moves orbit centre',async()=>{
 const THREE=await import('three'),{zoomAroundPoint}=await import('../src/city-camera-navigation.mjs');
 const camera=new THREE.PerspectiveCamera(48,16/9,.1,1300),target=new THREE.Vector3(),point=new THREE.Vector3(12,3,4);
 camera.position.set(35,50,90);camera.lookAt(target);camera.updateMatrixWorld();
 const before=point.clone().project(camera),distance=camera.position.distanceTo(target);
 zoomAroundPoint(camera,target,point,.6,2,440);camera.lookAt(target);camera.updateMatrixWorld();
 const after=point.clone().project(camera);
 assert.ok(Math.abs(before.x-after.x)<1e-10&&Math.abs(before.y-after.y)<1e-10);
 assert.ok(target.length()>0);assert.ok(Math.abs(camera.position.distanceTo(target)-distance*.6)<1e-10);
 zoomAroundPoint(camera,target,point,1e-8,2,440);assert.ok(Math.abs(camera.position.distanceTo(target)-2)<1e-8);
 zoomAroundPoint(camera,target,point,1e8,2,440);assert.ok(Math.abs(camera.position.distanceTo(target)-440)<1e-8);
});

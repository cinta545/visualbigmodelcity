const test=require('node:test'),assert=require('node:assert/strict');
test('Rotated asymmetric landmark geometry fits its plot without changing its proportions',async()=>{
 const THREE=await import('three'),{fitLandmarkToPlot}=await import('../src/city-building-detail.mjs');
 for(const rotation of [0,Math.PI,.37]){
  const root=new THREE.Group(),body=new THREE.Mesh(new THREE.BoxGeometry(36,18,22));body.position.set(4,9,-3);root.add(body);
  const plot={id:'fit',bounds:[-13,-11,13,11],rotation};fitLandmarkToPlot(root,plot,{horizontal:1.7,vertical:1.9});
  const box=new THREE.Box3().setFromObject(root);assert.ok(box.min.x>=-12.75-1e-6&&box.max.x<=12.75+1e-6);
  assert.ok(box.min.z>=-10.75-1e-6&&box.max.z<=10.75+1e-6);
  assert.ok(Math.abs(root.scale.y/root.scale.x-1.9/1.7)<1e-10);
 }
});
test('Low pitched roofs have upward-facing surfaces and distinct restrained silhouettes',async()=>{
 const THREE=await import('three'),{lowHipRoof}=await import('../src/city-building-detail.mjs');
 const heights=new Set();for(const rise of [.55,.83,1.3]){
  const root=new THREE.Group(),roof=lowHipRoof(root,0,10,0,20,14,new THREE.MeshStandardMaterial(),{rise,ridgeRatio:.22});
  const p=roof.geometry.attributes.position,n=roof.geometry.attributes.normal;for(let i=0;i<n.count;i++)assert.ok(n.getY(i)>0);
  roof.geometry.computeBoundingBox();const box=roof.geometry.boundingBox;assert.equal(box.min.y,10);assert.ok(box.max.y<12);heights.add(box.max.y);
  assert.ok([...p.array].every(Number.isFinite));
 }assert.equal(heights.size,3);
});

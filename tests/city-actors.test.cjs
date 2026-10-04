const test=require('node:test'),assert=require('node:assert/strict');
test('bicycle feet follow pedals across a cycle without changing observed pose',async()=>{
 const THREE=await import('three'),{createVulnerableActor,animateActor}=await import('../src/sind-actors.mjs');const root=createVulnerableActor('bicycle');root.position.set(12,0,8);root.rotation.y=.6;
 for(let distance=0;distance<4.1;distance+=.1){animateActor(root,distance,2);root.updateMatrixWorld(true);assert.deepEqual(root.position.toArray(),[12,0,8]);assert.equal(root.rotation.y,.6);
  for(const leg of root.userData.pedalLegs){const angle=root.userData.crank.rotation.z;assert.ok(Math.abs(leg.shoe.position.y-(.38+leg.side*.13*Math.sin(angle)+.043))<1e-9);assert.ok(Math.abs(leg.shoe.position.x-(leg.side*.13*Math.cos(angle)+.035))<1e-9);assert.ok(leg.thigh.scale.y>0&&leg.shin.scale.y>0);}
  assert.ok(new THREE.Box3().setFromObject(root,true).min.y>-.06);
 }
});

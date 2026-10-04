const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
test('static batching preserves distinct six-face facade material sets',async()=>{
 const THREE=await import('three'),{box,batchStatic}=await import('../src/district/materials.js');
 const root=new THREE.Group(),a=new THREE.MeshStandardMaterial({color:0x123456}),b=new THREE.MeshStandardMaterial({color:0xabcdef});
 const first=[a,a,b,b,a,a],second=[b,b,a,a,b,b];box(root,0,1,0,1,2,1,first);box(root,3,1,0,1,2,1,second);box(root,6,1,0,1,2,1,first);batchStatic(root);
 assert.equal(root.children.length,2);assert.equal(root.children.find(m=>m.material===first).count,2);assert.equal(root.children.find(m=>m.material===second).count,1);
});
test('camera occlusion checks respect finite segments, parallel rays and building height',async()=>{
 const {segmentHitsBox}=await import('../src/city-view.mjs'),min=[-1,0,-1],max=[1,10,1];
 assert.equal(segmentHitsBox([-4,5,0],[4,5,0],min,max),true);
 assert.equal(segmentHitsBox([-4,12,0],[4,12,0],min,max),false);
 assert.equal(segmentHitsBox([-4,5,0],[-2,5,0],min,max),false);
 assert.equal(segmentHitsBox([0,20,0],[0,15,0],min,max),false);
 assert.equal(segmentHitsBox([0,20,0],[0,0,0],min,max),true);
});
test('all four overview cameras expose the junction center and every approach endpoint',async()=>{
 const {overviewView,segmentHitsBox}=await import('../src/city-view.mjs'),{buildingProfile}=await import('../src/city-architecture.mjs');
 for(const city of ['tianjin','changchun','chongqing','xian']){const config=JSON.parse(fs.readFileSync(`data/sind/cities/${city}.json`)),view=overviewView(config);assert.equal(view.blocked,0,city);
  const targets=[[config.center[0],1,-config.center[1]],...config.approaches.flatMap(a=>a.points.map(p=>[p[0],1,-p[1]]))];
  for(const [i,b]of config.buildings.entries()){const h=buildingProfile(b,i,config.center).height;for(const t of targets)assert.equal(segmentHitsBox(view.p,t,[b.bounds[0]-1,0,-b.bounds[3]-1],[b.bounds[2]+1,h+4,-b.bounds[1]+1]),false,city);}
 }
});

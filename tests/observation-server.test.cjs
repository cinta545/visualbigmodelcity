const test=require('node:test');
const assert=require('node:assert/strict');
const {createObservationServer}=require('../server/observation-server.cjs');
test('real-data server serves the scene and exposes no simulation actions',async()=>{
 const server=createObservationServer().listen(0,'127.0.0.1');
 await new Promise(resolve=>server.once('listening',resolve));
 const base=`http://127.0.0.1:${server.address().port}`;
 try{
  const health=await(await fetch(base+'/api/health')).json();assert.equal(health.mode,'historical-observation');
  for(const url of ['/','/src/sind-corner.mjs','/data/sind/road-surface.json','/shared/sind-visual-site.json'])assert.equal((await fetch(base+url)).status,200,url);
  for(const url of ['/workspace.html','/api/frame','/server/qinghe-district-v1.db'])assert.equal((await fetch(base+url)).status,404,url);
  assert.equal((await fetch(base+'/api/control/strategy',{method:'POST'})).status,404);
 }finally{await new Promise(resolve=>server.close(resolve));}
});

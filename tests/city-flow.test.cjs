const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
test('flow uses inward crossing events and a trailing sixty-second window; loops reset totals',async()=>{
 const {flowAt,loopTime}=await import('../src/city-flow.mjs');
 const s={approaches:[{id:'a'},{id:'b'}],flowEvents:[[0,'a'],[1,'a'],[60000,'b'],[60001,'a']]};
 assert.deepEqual(flowAt(s,60000).approaches,{a:{total:2,recent:1},b:{total:1,recent:1}});
 assert.equal(flowAt(s,59999).total,2);assert.equal(loopTime(100010,100000),10);
 assert.equal(flowAt(s,loopTime(100010,100000)).total,2);assert.equal(loopTime(0,0),0);assert.equal(loopTime(9676.34300967634,1201601.6016),9676.34300967634);assert.equal(loopTime(-10,100),90);
});
test('four city events lie on finite stop lines, use observed motor tracks and are unique',async()=>{
 const {sampleTrack}=await import('../src/sind-clock.mjs');
 const catalog=JSON.parse(fs.readFileSync('data/sind/cities/catalog.json'));
 assert.equal(catalog.length,4);
 for(const c of catalog){const s=JSON.parse(fs.readFileSync('.'+c.scene)),d=JSON.parse(fs.readFileSync('.'+c.tracks)),tracks=new Map(d.tracks.map(t=>[t.id,t])),seen=new Set();
  assert.equal(s.buildings.length,50);assert.ok(s.signals.some(e=>e.slice(1).includes(3)));
  let last=-Infinity;
  for(const [time,approach,id,type]of s.flowEvents){assert.ok(time>=last);last=time;assert.ok(['car','bus','truck','motorcycle','tricycle'].includes(type));assert.ok(!seen.has(approach+id));seen.add(approach+id);
   const p=sampleTrack(tracks.get(id),time);assert.ok(p);const [a,b]=s.approaches.find(a=>a.id===approach).points,dx=b[0]-a[0],dy=b[1]-a[1],u=((p[1]-a[0])*dx+(p[2]-a[1])*dy)/(dx*dx+dy*dy);
   assert.ok(u>=-1e-8&&u<=1+1e-8);assert.ok(Math.abs(dx*(p[2]-a[1])-dy*(p[1]-a[0]))<1e-6);
   const before=sampleTrack(tracks.get(id),time-.01),after=sampleTrack(tracks.get(id),time+.01);if(before&&after){const sign=Math.sign(dx*(s.center[1]-a[1])-dy*(s.center[0]-a[0]));assert.ok(sign*(dx*(after[2]-before[2])-dy*(after[1]-before[1]))>0);}
  }
 }
});

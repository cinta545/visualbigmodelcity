const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
test('fades stay inside contiguous recorded lifetimes and never bridge gaps',async()=>{
 const {prepareObservation,observationOpacity}=await import('../src/city-observation.mjs');
 const track={samples:Array.from({length:21},(_,i)=>[i*100,0,0,0,0,0]).concat([[3000,0,0,0,0,0],[3100,0,0,0,0,0]])};
 const segments=prepareObservation(track);assert.deepEqual(segments,[[0,2000],[3000,3100]]);
 assert.equal(observationOpacity(segments,-1),0);assert.equal(observationOpacity(segments,0),0);assert.equal(observationOpacity(segments,1000),1);
 assert.ok(observationOpacity(segments,1650)<observationOpacity(segments,1500));assert.ok(observationOpacity(segments,1650)>observationOpacity(segments,1900));assert.equal(observationOpacity(segments,2000),0);assert.equal(observationOpacity(segments,2500),0);assert.equal(observationOpacity(segments,3101),0);
 assert.ok(observationOpacity(segments,3050)>0);assert.deepEqual(track.samples.at(-1),[3100,0,0,0,0,0]);
});
test('traffic charts and trend preserve time bounds, class sums and partial bins',async()=>{
 const {trafficSnapshot,flowTrend}=await import('../src/city-observation.mjs');
 const make=(id,type,v,start=0,end=200)=>({id,type,samples:[[start,0,0,v,0,0],[end,1,0,v,0,0]]});
 const tracks=[make('a','car',3),make('b','car',0),make('c','bicycle',2),make('d','pedestrian',1),make('e','bus',5,300,400)];
 const s=trafficSnapshot(tracks,100);assert.equal(s.vehicles,3);assert.equal(s.moving,1);assert.equal(s.slow,1);assert.equal(s.meanKmh,5.4);assert.equal(s.categories.pedestrian,1);
 assert.equal(trafficSnapshot(tracks,250).active.length,0);
 const events=[[0],[9999],[10000],[10999],[12000],[999999]];
 assert.deepEqual(flowTrend(events,11000).map(b=>b.count),[2,2]);assert.deepEqual(flowTrend(events,0).map(b=>b.count),[1]);assert.equal(flowTrend(events,130000).length,12);
});
test('Chongqing stationary and moving source tracks remain faithful in replay',async()=>{
 const {sampleTrack}=await import('../src/sind-clock.mjs');
 const data=JSON.parse(fs.readFileSync('data/sind/records/chongqing.json'));
 const parked=data.tracks.find(t=>t.id==='Chongqing/6_22_NR_1/6');
 const a=sampleTrack(parked,10000),b=sampleTrack(parked,11000);assert.deepEqual(a.slice(1,5),b.slice(1,5));
 const moving=data.tracks.filter(t=>t.type==='car').find(t=>{const a=sampleTrack(t,10000),b=sampleTrack(t,11000);return a&&b&&Math.hypot(b[1]-a[1],b[2]-a[2])>.5;});assert.ok(moving);
});

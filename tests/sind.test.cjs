const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
test('observations have finite lifetimes and gaps are not invented',async()=>{
 const {sampleTrack}=await import('../src/sind-clock.mjs');
 const track={samples:[[100,0,0,1,0,3.13],[200,1,0,1,0,-3.13],[1000,9,0,1,0,0]]};
 assert.equal(sampleTrack(track,99),null);assert.equal(sampleTrack(track,1001),null);
 assert.equal(sampleTrack(track,150)[1],.5);assert.ok(Math.abs(sampleTrack(track,150)[5]-Math.PI)<.02);
 assert.equal(sampleTrack(track,500),null);assert.equal(sampleTrack(track,1000)[1],9);
});
test('signal uses last known state including pre-zero events and exact switch',async()=>{
 const {sampleSignals}=await import('../src/sind-clock.mjs');const events=[[-10,0,1],[100,1,0]];
 assert.equal(sampleSignals(events,-11),null);assert.deepEqual(sampleSignals(events,0),[0,1]);
 assert.deepEqual(sampleSignals(events,100),[1,0]);assert.deepEqual(sampleSignals(events,50),[0,1]);
});
test('converted public sample retains all rows, identities and timestamps',async()=>{
 const {sampleTrack,sampleSignals}=await import('../src/sind-clock.mjs');
 const data=JSON.parse(fs.readFileSync(path.join(__dirname,'../data/sind/replay.json'),'utf8'));
 assert.equal(data.tracks.length,677);assert.equal(new Set(data.tracks.map(t=>t.id)).size,677);
 assert.equal(data.tracks.reduce((n,t)=>n+t.samples.length,0),166065);
 assert.equal(data.signals.length,122);assert.ok(data.ways.length>0);
 for(const t of data.tracks){assert.deepEqual(sampleTrack(t,t.samples[0][0]),t.samples[0]);assert.equal(sampleTrack(t,t.samples.at(-1)[0]+1),null);}
 for(const event of data.signals)assert.deepEqual(sampleSignals(data.signals,event[0]),event.slice(1));
 assert.ok(data.ways.every(w=>w.points.every(p=>p.every(Number.isFinite))));
});
test('home uses the observation renderer and map provides named signal positions',()=>{
 const data=JSON.parse(fs.readFileSync(path.join(__dirname,'../data/sind/replay.json'),'utf8'));
 const ways=new Map(data.ways.map(w=>[w.id,w]));
 const lanes=data.relations.filter(r=>r.tags.type==='lanelet');assert.ok(lanes.length>0);
 for(const lane of lanes)for(const role of ['left','right'])assert.ok(ways.get(lane.members.find(m=>m.role===role)?.ref)?.points.length>=2);
 assert.deepEqual(data.ways.filter(w=>w.tags.type==='traffic_light').map(w=>w.tags.name).sort(),['Traffic light 2','Traffic light 4','Traffic light 6','Traffic light 8']);
 const replay=fs.readFileSync(path.join(__dirname,'../sind-3d.html'),'utf8');
 assert.ok(replay.includes('/src/city-home.mjs'));assert.ok(!replay.includes('src/app.js'));assert.ok(!replay.includes('socket.io'));
 const home=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
 assert.ok(home.includes('/src/city-home.mjs'));assert.ok(!home.includes('<iframe'));
 assert.ok(!home.includes('home-shell.mjs'));assert.ok(!home.includes('src/app.js'));
 const baseline=JSON.parse(fs.readFileSync(path.join(__dirname,'../data/sind/scene-baseline.json'),'utf8'));
 assert.deepEqual(baseline.fixedFurnitureCollidingTracks,[]);assert.ok(baseline.minConservativeClearanceM>1);
 assert.equal(baseline.signalBindings.length,4);
 const site=JSON.parse(fs.readFileSync(path.join(__dirname,'../shared/sind-visual-site.json'),'utf8'));
 assert.equal(Object.keys(baseline.designedCorners).length,1+site.additionalCorners.length);
 for(const corner of Object.values(baseline.designedCorners)){assert.deepEqual(corner.collidingTracks,[]);assert.ok(corner.clearanceM>1);}
 const paving=JSON.parse(fs.readFileSync(path.join(__dirname,'../data/sind/pavements.json'),'utf8'));
 assert.deepEqual(Object.keys(paving).sort(),Object.keys(baseline.designedCorners).sort());
});
test('participant categories have distinct geometry and cosmetic animation preserves observed root pose',async()=>{
 const {createVulnerableActor,animateActor}=await import('../src/sind-actors.mjs');
 for(const [type,count]of [['bicycle',2],['motorcycle',2],['tricycle',3]]){
  const actor=createVulnerableActor(type);assert.equal(actor.userData.wheels.length,count);
  actor.position.set(3,0,-4);animateActor(actor,12,2);assert.deepEqual(actor.position.toArray(),[3,0,-4]);
 }
 const pedestrian=createVulnerableActor('pedestrian');pedestrian.position.set(8,0,2);
 animateActor(pedestrian,.4,1);assert.ok(pedestrian.userData.limbs.some(l=>Math.abs(l.part.rotation.z)>.1));
 animateActor(pedestrian,.4,0);assert.ok(pedestrian.userData.limbs.every(l=>l.part.rotation.z===0));
 assert.deepEqual(pedestrian.position.toArray(),[8,0,2]);
});

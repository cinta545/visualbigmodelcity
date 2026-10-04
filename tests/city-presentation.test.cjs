const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
test('Chongqing presentation selects observed moving traffic and only hides long static tracks',async()=>{
 const {isLongStatic,busyStart}=await import('../src/city-presentation.mjs'),{sampleTrack}=await import('../src/sind-clock.mjs');
 const data=JSON.parse(fs.readFileSync('data/sind/records/chongqing.json')),tracks=data.tracks;
 assert.equal(tracks.filter(isLongStatic).length,22);
 const start=busyStart(tracks,1160961),moving=time=>tracks.filter(t=>['car','bus','truck'].includes(t.type)).filter(t=>{const s=sampleTrack(t,time);return s&&Math.hypot(s[3],s[4])>=.5;}).length;
 assert.ok(moving(start)>=8);assert.ok(moving(start)>moving(1000));
 const stopped={type:'car',samples:[[0,0,0,0,0],[31000,0,0,0,0]]};assert.equal(isLongStatic(stopped),true);
 assert.equal(isLongStatic({...stopped,samples:[...stopped.samples,[32000,2,0,1,0]]}),false);
 assert.equal(isLongStatic({...stopped,samples:[[0,0,0,0,0],[5000,0,0,0,0]]}),false);
});

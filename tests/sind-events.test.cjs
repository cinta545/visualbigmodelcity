const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{createHash}=require('node:crypto');
test('events merge the same pair across type changes but split long interruptions',async()=>{
 const {groupCandidates}=await import('../src/sind-events.mjs');
 const frame=(timeMs,kind='rear',ttcS=2)=>({timeMs,candidates:[{key:'a|b',kind,ttcS}]});
 const events=groupCandidates([frame(0),frame(100,'cross',1),frame(400),frame(800)]);
 assert.equal(events.length,2);assert.equal(events[0].sampleCount,3);assert.equal(events[0].minTimeMs,100);assert.deepEqual(events[0].kinds,['rear','cross']);assert.equal(events[1].startMs,800);
});
test('event index matches source and review CSV safely preserves notes',async()=>{
 const {eventsCsv}=await import('../src/sind-events.mjs');
 const m=JSON.parse(fs.readFileSync('data/sind/risk-events.json'));
 assert.equal(m.sourceSha256,createHash('sha256').update(fs.readFileSync('data/sind/replay.json')).digest('hex'));
 assert.equal(new Set(m.events.map(e=>e.id)).size,m.events.length);
 const e=m.events[0],csv=eventsCsv(m,{[e.id]:{status:'uncertain',note:'=SUM(1,2)\n"test"'}});
 assert.ok(csv.includes("'=SUM(1,2)"));assert.ok(csv.includes('""test""'));assert.ok(csv.includes('"uncertain"'));
 for(const e of m.events){assert.ok(e.startMs<=e.minTimeMs&&e.minTimeMs<=e.endMs);assert.ok(e.sampleCount>0);}
});

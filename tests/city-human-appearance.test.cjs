const test=require('node:test'),assert=require('node:assert/strict');
test('human appearance remains stable across reordered records and contains both models',async()=>{
 const {humanVariantForTrack}=await import('../src/city-human-appearance.mjs');
 const fs=require('node:fs'),data=JSON.parse(fs.readFileSync('data/sind/replay.json'));
 const ids=data.tracks.filter(t=>['pedestrian','bicycle'].includes(t.type)).map(t=>t.id);
 const initial=new Map(ids.map(id=>[id,humanVariantForTrack(id)]));
 assert.equal(new Set(initial.values()).size,2);
 for(const id of ids.reverse())assert.equal(humanVariantForTrack(id),initial.get(id));
});

const test=require('node:test'),assert=require('node:assert/strict');
test('human appearance stays stable and includes women, older people and children',async()=>{
 const {humanVariantForTrack}=await import('../src/city-human-appearance.mjs');
 const {humanVariants}=await import('../src/city-human-catalog.mjs');
 const fs=require('node:fs'),data=JSON.parse(fs.readFileSync('data/sind/replay.json'));
 const ids=data.tracks.filter(t=>['pedestrian','bicycle'].includes(t.type)).map(t=>t.id);
 const initial=new Map(ids.map(id=>[id,humanVariantForTrack(id)]));
 assert.equal(new Set(initial.values()).size,8);
 assert.deepEqual(new Set([...initial.values()].map(i=>humanVariants[i].category)),new Set(['adult','woman','older','child']));
 assert.ok(humanVariants.filter(v=>v.category==='child').every(v=>v.height<1.3));
 for(const id of ids)for(const type of ['bicycle','motorcycle','tricycle'])assert.ok(['adult','woman'].includes(humanVariants[humanVariantForTrack(id,type)].category));
 for(const id of ids.reverse())assert.equal(humanVariantForTrack(id),initial.get(id));
});

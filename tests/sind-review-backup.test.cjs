const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
test('backup round trip validates provenance and preserves conflicts by default',async()=>{
 const {makeBackup,validateBackup,mergeReviews}=await import('../src/sind-review-backup.mjs');
 const m=JSON.parse(fs.readFileSync('data/sind/risk-events.json')),id=m.events[0].id;
 const reviews={[id]:{status:'uncertain',note:'中文\n"引用"'}},backup=makeBackup(m,reviews);
 assert.deepEqual(validateBackup(m,JSON.parse(JSON.stringify(backup))),reviews);
 assert.throws(()=>validateBackup(m,{...backup,sourceSha256:'wrong'}));
 assert.throws(()=>validateBackup(m,{...backup,riskConfig:{...m.riskConfig,horizonS:2}}));
 assert.throws(()=>validateBackup(m,{...backup,reviews:{unknown:{status:'pending',note:''}}}));
 assert.throws(()=>validateBackup(m,{...backup,reviews:{[id]:{status:'accident',note:''}}}));
 assert.throws(()=>validateBackup(m,{...backup,reviews:{[id]:{status:'pending',note:'a'.repeat(2001)}}}));
 const existing={[id]:{status:'plausible',note:'keep'}};
 assert.deepEqual(mergeReviews(existing,reviews).reviews,existing);assert.equal(mergeReviews(existing,reviews).skipped,1);
 assert.deepEqual(mergeReviews(existing,reviews,true).reviews,reviews);
});
test('sensitivity baseline matches event index and wider merging does not increase counts',()=>{
 const m=JSON.parse(fs.readFileSync('data/sind/risk-events.json')),r=JSON.parse(fs.readFileSync('data/sind/risk-sensitivity.json'));
 assert.equal(r.sourceSha256,m.sourceSha256);assert.equal(r.rows.length,12);
 assert.equal(r.rows.find(x=>x.horizonS===3&&x.mergeGapMs===300).events,m.events.length);
 for(const h of [1,1.5,2,3]){const rows=r.rows.filter(x=>x.horizonS===h);assert.ok(rows[0].events>=rows[1].events&&rows[1].events>=rows[2].events);assert.equal(rows[0].candidateSamples,rows[2].candidateSamples);}
});

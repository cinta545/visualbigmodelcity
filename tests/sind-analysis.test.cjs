const test=require('node:test'),assert=require('node:assert/strict');
const tracks=[
 {id:'T/1',type:'car',samples:[[0,0,0,3,4,0],[100,1,0,3,4,0],[500,4,0,0,0,0]]},
 {id:'T/P1',type:'pedestrian',samples:[[0,0,0,0,1,0],[100,0,.1,0,1,0]]},
 {id:'T/2',type:'bus',samples:[[1000,0,0,0,0,0]]}
];
test('metrics exclude absent objects and do not label pedestrian speed as car speed',async()=>{
 const {summarize}=await import('../src/sind-analysis.mjs');
 const m=summarize(tracks,50);assert.equal(m.active,2);assert.equal(m.seen,2);assert.equal(m.autoCount,1);assert.equal(m.meanAutoKmh,18);
 const gap=summarize(tracks,300);assert.equal(gap.active,0);assert.equal(gap.meanAutoKmh,null);
 assert.equal(summarize(tracks,1000).slowAutos,1);
});
test('search scope and history preserve time boundaries and missing intervals',async()=>{
 const {matchingTracks,historySegments,observationCsv}=await import('../src/sind-analysis.mjs');
 assert.equal(matchingTracks(tracks,{type:'bus',time:0}).length,0);
 assert.equal(matchingTracks(tracks,{type:'bus',time:0,scope:'all'}).length,1);
 assert.equal(matchingTracks(tracks,{query:'行人',time:50}).length,1);
 assert.equal(historySegments(tracks[0],100).flat().length,2);
 assert.equal(historySegments(tracks[0],500).length,2);
 assert.equal(historySegments(tracks[0],11000).length,0);
 assert.ok(!observationCsv(tracks[0],100).includes(',500,'));
});

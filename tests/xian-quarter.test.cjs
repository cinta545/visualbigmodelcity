const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
test('Xi’an four wards retain the selected layout and original traffic sources',()=>{
 const plan=JSON.parse(fs.readFileSync('data/sind/cities/xian-quarter.json')),source=JSON.parse(fs.readFileSync('data/sind/cities/xian.json'));
 assert.deepEqual(plan.wards.map(w=>w.kind),['changle','qujiang','pagoda','bell']);
 assert.equal(plan.audit.sourceTracks,439);assert.equal(plan.audit.sourceRoadsUnchanged,true);assert.equal(plan.audit.wardsAvoidTraffic,true);
 const cs=Math.cos(plan.angle),sn=Math.sin(plan.angle),expected=[[-1,1],[1,1],[-1,-1],[1,-1]];
 plan.wards.forEach((w,i)=>{const dx=w.origin[0]-source.center[0],dy=w.origin[1]-source.center[1];assert.equal(Math.sign(cs*dx+sn*dy),expected[i][0]);assert.equal(Math.sign(-sn*dx+cs*dy),expected[i][1]);assert.ok(w.width>=80&&w.depth>=80);assert.equal(w.footprint.type,'Polygon');assert.ok(w.origin.every(Number.isFinite));});
 assert.ok(plan.background.length>=100&&plan.background.length<=300);
 assert.ok(['Polygon','MultiPolygon'].includes(plan.sceneryRoads.type));
 const extents=plan.background.map(b=>{const dx=b.origin[0]-source.center[0],dy=b.origin[1]-source.center[1];return Math.abs(cs*dx+sn*dy);});
 assert.ok(Math.max(...extents)>=300);
 assert.equal(plan.signalDisplayBindings.length,4);
 assert.ok(plan.signalDisplayBindings.every(b=>b.stateUnbound===true&&b.position.every(Number.isFinite)));
 assert.equal(source.signalBindings.length,0); // No unverified signal-group direction is invented.
 for(const field of ['road','tracks','signals','ways','flowEvents'])assert.equal(Object.hasOwn(plan,field),false);
});

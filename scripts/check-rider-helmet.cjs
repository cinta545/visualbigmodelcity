const {chromium}=require('playwright-core'),assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--use-angle=d3d11','--enable-webgl']});
 try{
  const page=await browser.newPage({viewport:{width:1600,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/helmet-preview',route=>route.fulfill({contentType:'text/html',body:'<html><head><script type="importmap">{"imports":{"three":"/node_modules/three/build/three.module.js","three/addons/":"/node_modules/three/examples/jsm/"}}</script></head><body style="margin:0;background:#dce1df"></body></html>'}));
  await page.goto('http://127.0.0.1:4173/helmet-preview');
  const report=await page.evaluate(async()=>{
   const THREE=await import('three'),{loadHumanAssets,attachHumanRider,posedBounds}=await import('/src/city-humans.mjs'),{humanVariants}=await import('/src/city-human-catalog.mjs'),{createVulnerableActor}=await import('/src/sind-actors.mjs');await loadHumanAssets();
   const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setSize(innerWidth,innerHeight);renderer.outputEncoding=THREE.sRGBEncoding;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;document.body.append(renderer.domElement);
   const scene=new THREE.Scene();scene.background=new THREE.Color(0xdce1df);scene.add(new THREE.HemisphereLight(0xe9f3ff,0x8b8978,.75));const sun=new THREE.DirectionalLight(0xffedda,2);sun.position.set(-3,9,5);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-8,right:8,top:5,bottom:-5});scene.add(sun);
   const floor=new THREE.Mesh(new THREE.PlaneGeometry(40,40),new THREE.MeshStandardMaterial({color:0xc8cec8,roughness:1}));floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;scene.add(floor);
   const camera=new THREE.PerspectiveCamera(30,innerWidth/innerHeight,.1,100);camera.position.set(0,3.5,8);camera.lookAt(0,1.3,0);const result=[];
   for(let i=0;i<4;i++){
    const rider=attachHumanRider(createVulnerableActor('motorcycle',{rider:false}),i,'motorcycle');rider.position.set((i-1.5)*1.5,0,0);rider.rotation.y=-Math.PI/2+.45;scene.add(rider);
    const helmet=rider.getObjectByName('rider-helmet');const positions=[];
    for(const d of [0,.8,2,.8]){rider.userData.animateHuman(d);rider.updateMatrixWorld(true);positions.push(helmet.getWorldPosition(new THREE.Vector3()).toArray());}
    result.push({variant:i,headSize:helmet.userData.headSize,parent:helmet.parent.name,shell:!!helmet.getObjectByName('helmet-shell'),trim:!!helmet.getObjectByName('helmet-edge-trim'),straps:helmet.children.filter(o=>o.name==='helmet-chin-strap').length,stable:positions[1].every((v,k)=>Math.abs(v-positions[3][k])<1e-9),finite:positions.flat().every(Number.isFinite)});
   }
   renderer.render(scene,camera);return result;
  });
  for(const row of report){assert.equal(row.parent,'Bip01_Head');assert.ok(row.shell&&row.trim&&row.stable&&row.finite);assert.equal(row.straps,2);}
  assert.deepEqual(errors,[]);await page.screenshot({path:'artifacts/helmet-preview.png'});fs.writeFileSync('artifacts/helmet-preview.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

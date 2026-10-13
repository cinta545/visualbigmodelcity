const {chromium}=require('playwright-core'),assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--use-angle=d3d11','--enable-webgl']});
 try{
  const page=await browser.newPage({viewport:{width:1600,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/driver-preview',route=>route.fulfill({contentType:'text/html',body:'<html><head><script type="importmap">{"imports":{"three":"/node_modules/three/build/three.module.js","three/addons/":"/node_modules/three/examples/jsm/"}}</script></head><body style="margin:0;background:#dce1df"></body></html>'}));
  await page.goto('http://127.0.0.1:4173/driver-preview');
  const report=await page.evaluate(async()=>{
   const THREE=await import('three'),{loadHumanAssets,createHumanDriver,posedBounds}=await import('/src/city-humans.mjs'),{humanVariants}=await import('/src/city-human-catalog.mjs'),{createRefinedVehicle}=await import('/src/city-vehicles.mjs'),{updateVehicleDetail}=await import('/src/city-render-quality.mjs');await loadHumanAssets();
   const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setSize(innerWidth,innerHeight);renderer.outputEncoding=THREE.sRGBEncoding;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;document.body.append(renderer.domElement);
   const scene=new THREE.Scene();scene.background=new THREE.Color(0xdce1df);scene.add(new THREE.HemisphereLight(0xe9f3ff,0x8b8978,.75));const sun=new THREE.DirectionalLight(0xffedda,2);sun.position.set(-3,9,5);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-8,right:8,top:5,bottom:-5});scene.add(sun);
   const floor=new THREE.Mesh(new THREE.PlaneGeometry(40,40),new THREE.MeshStandardMaterial({color:0xc8cec8,roughness:1}));floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;scene.add(floor);
   const camera=new THREE.PerspectiveCamera(32,innerWidth/innerHeight,.1,100);camera.position.set(7,3,-8);camera.lookAt(0,1,0);const result=[];
   for(const [i,type]of ['car','bus','truck'].entries()){
    const vehicle=createRefinedVehicle(type),driver=createHumanDriver(type,i),detail=vehicle.children.find(o=>o.name==='vehicle-near-detail');detail.add(driver);vehicle.position.set(0,0,i*5);scene.add(vehicle);
    const bounds=posedBounds(driver);result.push({type,asset:driver.userData.driverAsset,bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},meshes:driver.children.length,static:driver.children.every(o=>o.isMesh&&!o.isSkinnedMesh),shared:createHumanDriver(type,i).children[0].geometry===driver.children[0].geometry});
   }
   for(const type of ['car','bus','truck'])for(let variant=0;variant<4;variant++){
    const vehicle=createRefinedVehicle(type),driver=createHumanDriver(type,variant);vehicle.children.find(o=>o.name==='vehicle-near-detail').add(driver);
    updateVehicleDetail(vehicle,200);let far=false;vehicle.traverseVisible(o=>{if(o.name==='vehicle-driver')far=true;});updateVehicleDetail(vehicle,200,true);let near=false;vehicle.traverseVisible(o=>{if(o.name==='vehicle-driver')near=true;});if(far||!near)throw Error('驾驶员细节切换失败');
    const bounds=posedBounds(driver);result.push({type,variant,height:bounds.max.y,clearanceCheck:true});if(![...bounds.min.toArray(),...bounds.max.toArray()].every(Number.isFinite))throw Error('驾驶员坐姿无效');
   }
   window.driverPreview={scene,camera,renderer};
   renderer.render(scene,camera);return result;
  });
  for(const row of report){if(row.clearanceCheck){assert.ok(row.height<(row.type==='car'?1.54:row.type==='bus'?2.9:2.4));continue;}assert.ok(row.static&&row.shared);assert.ok(row.meshes>0);assert.ok([...row.bounds.min,...row.bounds.max].every(Number.isFinite));}
  assert.deepEqual(errors,[]);for(const [i,type]of ['car','bus','truck'].entries()){
   await page.evaluate(({i,type})=>{const {scene,camera,renderer}=window.driverPreview;for(const o of scene.children)if(o.type==='Group')o.visible=Math.abs(o.position.z-i*5)<.01;const x=type==='car'?0:type==='bus'?4.4:2.1,y=type==='car'?1.1:type==='bus'?2:1.7;camera.position.set(x+3.4,y+1.05,i*5-3.6);camera.lookAt(x,y,i*5-.35);renderer.render(scene,camera);},{i,type});
   await page.screenshot({path:`artifacts/driver-${type}.png`});
  }fs.writeFileSync('artifacts/driver-preview.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

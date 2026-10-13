const {chromium}=require('playwright-core'),assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--use-angle=d3d11','--enable-webgl']});
 try{
  const page=await browser.newPage({viewport:{width:1600,height:760}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/human-diversity-preview',route=>route.fulfill({contentType:'text/html',body:'<html><head><script type="importmap">{"imports":{"three":"/node_modules/three/build/three.module.js","three/addons/":"/node_modules/three/examples/jsm/"}}</script></head><body style="margin:0;background:#dce1df"></body></html>'}));
  await page.goto('http://127.0.0.1:4173/human-diversity-preview');
  const report=await page.evaluate(async()=>{
   const THREE=await import('three'),{loadHumanAssets,createHumanWalker,posedBounds}=await import('/src/city-humans.mjs'),{humanVariants}=await import('/src/city-human-catalog.mjs');await loadHumanAssets();
   const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setSize(innerWidth,innerHeight);renderer.outputEncoding=THREE.sRGBEncoding;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;document.body.append(renderer.domElement);
   const scene=new THREE.Scene();scene.background=new THREE.Color(0xdce1df);scene.add(new THREE.HemisphereLight(0xe9f3ff,0x8b8978,.75));const sun=new THREE.DirectionalLight(0xffedda,2);sun.position.set(-3,9,5);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-8,right:8,top:5,bottom:-5});scene.add(sun);
   const floor=new THREE.Mesh(new THREE.PlaneGeometry(40,40),new THREE.MeshStandardMaterial({color:0xc8cec8,roughness:1}));floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;scene.add(floor);
   const camera=new THREE.PerspectiveCamera(34,innerWidth/innerHeight,.1,100);camera.position.set(0,3,11);camera.lookAt(0,.95,0);const result=[];
   for(let i=0;i<humanVariants.length;i++){
    const profile=humanVariants[i],walker=createHumanWalker(i),idle=posedBounds(walker),base=[(i-3.5)*1.15,0,0];walker.position.fromArray(base);walker.rotation.y=-Math.PI/2;scene.add(walker);
    let minY=Infinity,maxY=-Infinity,finite=true;for(let d=0;d<3;d+=.15){walker.userData.animateHuman(d,1.1);const bounds=posedBounds(walker);minY=Math.min(minY,bounds.min.y);maxY=Math.max(maxY,bounds.min.y);finite&&=[...bounds.min.toArray(),...bounds.max.toArray()].every(Number.isFinite);}
    walker.userData.animateHuman(.38+i*.12,1.1);result.push({id:profile.id,category:profile.category,height:idle.max.y-idle.min.y,targetHeight:profile.height,idleGround:idle.min.y,minY,maxY,finite,rootStable:walker.position.toArray().every((v,k)=>v===base[k])});
   }
   renderer.render(scene,camera);return result;
  });
  for(const row of report){assert.ok(row.finite&&row.rootStable);assert.ok(Math.abs(row.height-row.targetHeight)<.001);assert.ok(Math.abs(row.idleGround)<.001);assert.ok(row.minY>-.12&&row.maxY<.15,JSON.stringify(row));}
  assert.deepEqual(errors,[]);await page.screenshot({path:'artifacts/human-diversity.png'});fs.writeFileSync('artifacts/human-diversity.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeBufferGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// A reusable visual shell. Recorded dimensions and poses are applied by city-home.
const paint=new THREE.MeshPhysicalMaterial({color:0xd9dfdf,metalness:.52,roughness:.26,clearcoat:1,clearcoatRoughness:.16});
const material=(color,roughness,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
const glass=material(0x263c49,.12,.45),rubber=material(0x171a1c,.86),trim=material(0x252a2d,.48),alloy=material(0xc4cbd0,.24,.85),disc=material(0x777b7d,.6,.72),red=material(0x961e24,.22),lens=material(0xd9e3e5,.16,.35),plate=material(0x36667e,.52);
// Head and tail lamps self-illuminate so every vehicle reads instantly after dark.
red.emissive=new THREE.Color(0xff2a20);red.emissiveIntensity=2.6;
lens.emissive=new THREE.Color(0xfff3d8);lens.emissiveIntensity=2.4;
glass.side=THREE.DoubleSide;
const cabinGlass=new THREE.MeshStandardMaterial({color:0x607680,roughness:.12,metalness:.08,transparent:true,opacity:.44,depthWrite:false,side:THREE.DoubleSide,envMapIntensity:.7});
function mesh(g,geo,mat,p=[0,0,0]){const m=new THREE.Mesh(geo,mat);m.position.fromArray(p);m.castShadow=m.receiveShadow=true;g.add(m);return m;}
function box(g,p,s,m,r=.02){return mesh(g,new RoundedBoxGeometry(...s,2,r),m,p);}
function line(g,points,m,r=.008){return mesh(g,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),Math.max(8,points.length*4),r,4,false),m);}
function quad(g,points,m){const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(points.flat(),3));geo.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,1,0,1,1,0,1],2));geo.setIndex([0,1,2,0,2,3]);geo.computeVertexNormals();return mesh(g,geo,m);}
function combine(g){g.updateMatrixWorld(true);const groups=new Map();for(const child of [...g.children]){if(!child.isMesh)continue;let geo=child.geometry.index?child.geometry.toNonIndexed():child.geometry.clone();geo.applyMatrix4(child.matrix);if(!groups.has(child.material))groups.set(child.material,[]);groups.get(child.material).push(geo);g.remove(child);child.geometry.dispose();}for(const [m,geos]of groups){mesh(g,mergeBufferGeometries(geos),m).castShadow=!(m.transparent&&m.opacity<1);for(const geo of geos)geo.dispose();}}
function glazing(g,a,b){
 const points=[],uv=[],idx=[];
 for(let i=0;i<=8;i++){const t=.065+i/8*.87,x=THREE.MathUtils.lerp(a[0],b[0],t),y=THREE.MathUtils.lerp(a[1],b[1],t),w=THREE.MathUtils.lerp(a[2],b[2],t);
  for(let j=0;j<=12;j++){const u=.05+j/12*.90;points.push(x,y+Math.sin(u*Math.PI)*.055+.009,(u*2-1)*w);uv.push(t,u);}}
 for(let i=0;i<8;i++)for(let j=0;j<12;j++){const n=i*13+j;idx.push(n,n+1,n+14,n,n+14,n+13);}
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(points,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(idx);geo.computeVertexNormals();mesh(g,geo,cabinGlass).castShadow=false;
}
function wheel(){const g=new THREE.Group();mesh(g,new THREE.TorusGeometry(.268,.087,12,40),rubber);for(const side of [-1,1]){
 const z=side*.082;mesh(g,new THREE.TorusGeometry(.221,.015,8,32),alloy,[0,0,z]);
 const rotor=mesh(g,new THREE.CylinderGeometry(.183,.183,.012,32),disc,[0,0,z*.7]);rotor.rotation.x=Math.PI/2;
 for(let i=0;i<5;i++){const a=i*Math.PI*2/5;for(const offset of [-.018,.018]){const spoke=box(g,[Math.sin(a)*.137,Math.cos(a)*.137,z],[.024,.17,.023],alloy,.008);spoke.rotation.z=-a+offset*5;}mesh(g,new THREE.SphereGeometry(.014,6,4),trim,[Math.sin(a)*.06,Math.cos(a)*.06,z+side*.013]);}
 const hub=mesh(g,new THREE.CylinderGeometry(.05,.05,.026,16),alloy,[0,0,z]);hub.rotation.x=Math.PI/2;
}combine(g);return wheelLevels(g,.355,.16);}
function wheelLevels(g,radius,width){
 const high=new THREE.Group();high.name='vehicle-near-detail';for(const child of [...g.children])high.add(child);g.add(high);
 const low=new THREE.Group();low.name='vehicle-far-detail';const tyre=mesh(low,new THREE.CylinderGeometry(radius,radius,width,12),rubber);tyre.rotation.x=Math.PI/2;
 for(const side of [-1,1]){const cap=mesh(low,new THREE.CircleGeometry(radius*.65,10),alloy,[0,0,side*(width/2+.001)]);if(side<0)cap.rotation.y=Math.PI;}
 low.visible=false;g.add(low);g.userData.isWheel=true;return g;
}
const templates=new Map();
const fleetStripe=material(0x42796c,.4,.22),cargoPaint=material(0xd7d8d3,.48,.28),amber=material(0xcb8732,.28);
function heavyWheel(){
 const g=new THREE.Group();mesh(g,new THREE.TorusGeometry(.365,.115,12,40),rubber);
 for(const sign of [-1,1]){const z=sign*.104;
  mesh(g,new THREE.TorusGeometry(.286,.019,8,32),alloy,[0,0,z]);
  const hub=mesh(g,new THREE.CylinderGeometry(.25,.25,.028,32),alloy,[0,0,z]);hub.rotation.x=Math.PI/2;
  const cap=mesh(g,new THREE.CylinderGeometry(.095,.095,.075,20),disc,[0,0,z]);cap.rotation.x=Math.PI/2;
  for(let i=0;i<8;i++){const a=i*Math.PI/4;const hole=mesh(g,new THREE.CircleGeometry(.033,10),trim,[Math.sin(a)*.191,Math.cos(a)*.191,z+sign*.017]);if(sign<0)hole.rotation.y=Math.PI;mesh(g,new THREE.SphereGeometry(.018,8,6),alloy,[Math.sin(a)*.119,Math.cos(a)*.119,z+sign*.026]);}
 }combine(g);return wheelLevels(g,.48,.22);
}
function archBody(g,left,right,bottom,top,width,axles,m){
 const s=new THREE.Shape();s.moveTo(left,bottom);s.lineTo(left,top);s.lineTo(right,top);s.lineTo(right,bottom);
 for(const x of [...axles].sort((a,b)=>b-a)){s.lineTo(x+.55,bottom);for(let i=0;i<=24;i++){const a=i*Math.PI/24;s.lineTo(x+.55*Math.cos(a),bottom+.55*Math.sin(a));}}
 s.lineTo(left,bottom);s.closePath();mesh(g,new THREE.ExtrudeGeometry(s,{depth:width-.06,bevelEnabled:true,bevelSegments:3,steps:1,bevelSize:.03,bevelThickness:.03}),m,[0,0,-width/2+.03]);
}
function fleetWheels(g,axles,z){const wheels=[];for(const x of axles)for(const sign of [-1,1]){const w=heavyWheel();w.position.set(x,.48,sign*z);g.add(w);wheels.push(w);}return wheels;}
function bus(){const g=new THREE.Group(),axles=[-3.1,3.5];
 archBody(g,-5.48,5.48,.48,1.22,2.46,axles,paint);
 box(g,[0,2.09,0],[10.96,1.77,2.46],paint,.13);
 box(g,[0,.44,0],[9.9,.20,1.96],trim,.04);
 box(g,[-1.4,3.08,0],[2.9,.20,1.75],cargoPaint,.08);
 for(let x=-2.4;x<-.4;x+=.18)box(g,[x,3.189,0],[.06,.008,1.30],trim,.003);
 for(const sign of [-1,1]){
  const z=sign*1.243;box(g,[-.08,2.19,z],[10.15,1.22,.025],trim,.055);
  for(let x=-4.46;x<4.8;x+=1.14){if(sign>0&&(Math.abs(x-4.65)<.6||Math.abs(x+.75)<.6))continue;box(g,[x,2.21,sign*1.265],[1.025,1.03,.018],glass,.027);box(g,[x,2.52,sign*1.279],[1.02,.018,.014],alloy,.002);}
  box(g,[0,1.39,z],[10.68,.18,.02],fleetStripe,.008);
  for(const x of [-4.9,-1.9,.8,4.9]){box(g,[x,.82,sign*1.264],[.12,.045,.022],amber,.009);}
  for(const x of [-4.65,-1.8,.35])line(g,[[x,1.2,sign*1.266],[x,.64,sign*1.266]],trim,.004);
  for(let i=0;i<7;i++)box(g,[-4.46,1.02+i*.042,sign*1.269],[1.22,.019,.018],trim,.004);
  line(g,[[5.15,2.74,sign*1.17],[5.58,2.75,sign*1.36],[5.60,2.39,sign*1.39]],trim,.025);
  box(g,[5.6,2.32,sign*1.39],[.16,.31,.15],trim,.03);box(g,[5.507,2.32,sign*1.39],[.013,.245,.106],glass,.008);
 }
 // Right-hand passenger doors; painted lower panels and independent glazed leaves.
 for(const x of [4.65,-.75]){box(g,[x,1.54,1.284],[1.12,2.02,.04],trim,.018);for(const dx of [-.275,.275]){box(g,[x+dx,1.84,1.311],[.51,1.36,.016],glass,.012);box(g,[x+dx,.73,1.314],[.51,.35,.018],paint,.008);}box(g,[x,.54,1.30],[1.06,.075,.11],alloy,.009);}
 box(g,[5.493,2.20,0],[.027,1.24,2.16],trim,.07);box(g,[5.513,2.19,0],[.019,1.10,2.03],glass,.045);
 box(g,[5.49,2.85,0],[.035,.19,1.62],trim,.03);
 for(const z of [-.52,.50])line(g,[[5.532,1.69,z-.23],[5.535,2.09,z+.10]],trim,.011);
 box(g,[-5.49,2.24,0],[.028,.89,2.02],glass,.05);
 for(const sign of [-1,1]){box(g,[5.50,1.03,sign*.91],[.04,.26,.31],trim,.04);box(g,[5.526,1.075,sign*.91],[.014,.13,.23],lens,.025);box(g,[-5.51,1.05,sign*1.04],[.024,.38,.17],red,.024);}
 for(const x of [-5.52,5.52])box(g,[x,.75,0],[.018,.15,.52],plate,.009);
 box(g,[5.49,.54,0],[.05,.13,2.05],trim,.018);
 combine(g);g.userData={wheels:fleetWheels(g,axles,1.11),wheelRadius:.48,length:11,detailProfile:'city-refined'};return g;
}
function truck(){const g=new THREE.Group(),axles=[-2.03,2.27];
 box(g,[0,.60,0],[6.66,.23,1.85],trim,.04);
 archBody(g,1.10,3.46,.49,1.18,2.22,[2.27],paint);
 box(g,[2.29,1.71,0],[2.35,1.19,2.22],paint,.15);
 box(g,[3.478,1.83,0],[.026,.70,1.94],trim,.06);box(g,[3.494,1.85,0],[.014,.60,1.81],glass,.04);
 for(const sign of [-1,1]){
  box(g,[2.14,1.87,sign*1.125],[1.48,.65,.018],glass,.04);
  line(g,[[1.34,2.18,sign*1.14],[1.34,1.09,sign*1.14],[2.94,1.09,sign*1.14]],trim,.005);
  box(g,[1.59,1.42,sign*1.139],[.23,.045,.028],trim,.01);
  box(g,[1.58,.78,sign*1.17],[.48,.075,.27],alloy,.009);
  line(g,[[3.04,2.12,sign*1.07],[3.06,2.12,sign*1.36],[3.05,1.76,sign*1.36]],trim,.022);
  box(g,[3.05,1.83,sign*1.37],[.17,.35,.14],trim,.025);box(g,[2.951,1.83,sign*1.37],[.016,.28,.10],glass,.008);
  box(g,[-.42,.71,sign*.98],[.97,.34,.31],disc,.06);
  box(g,[-2.04,.99,sign*1.04],[1.18,.07,.29],trim,.025);
  box(g,[-2.64,.62,sign*1.04],[.04,.61,.28],rubber,.009);
 }
 box(g,[-1.19,2.09,0],[4.42,2.19,2.29],cargoPaint,.025);
 for(const sign of [-1,1]){
  for(let x=-3.28;x<.94;x+=.18)box(g,[x,2.10,sign*1.155],[.022,1.98,.026],cargoPaint,.006);
  for(const y of [1.03,3.16])box(g,[-1.19,y,sign*1.164],[4.40,.055,.038],alloy,.005);
  for(const x of [-3.35,.96])box(g,[x,2.10,sign*1.166],[.05,2.13,.04],alloy,.005);
 }
 for(const z of [-.57,.57]){box(g,[-3.422,2.09,z],[.016,2.07,1.09],cargoPaint,.008);line(g,[[-3.445,1.14,z],[-3.445,3.02,z]],alloy,.018);box(g,[-3.47,1.78,z],[.035,.05,.26],trim,.009);}
 line(g,[[-3.44,1.06,0],[-3.44,3.12,0]],trim,.008);
 box(g,[-3.4,.51,0],[.13,.12,2.18],alloy,.008);
 box(g,[3.489,1.05,0],[.025,.28,1.21],trim,.025);
 for(const y of [.96,1.04,1.12])box(g,[3.51,y,0],[.015,.022,1.11],alloy,.003);
 for(const sign of [-1,1]){box(g,[3.49,.80,sign*.85],[.035,.19,.29],lens,.025);box(g,[-3.44,.78,sign*.91],[.03,.15,.29],red,.012);}
 for(const x of [-3.46,3.51])box(g,[x,.62,0],[.02,.14,.48],plate,.008);
 for(const z of [-.50,.43])line(g,[[3.516,1.57,z-.20],[3.52,1.84,z+.10]],trim,.009);
 combine(g);g.userData={wheels:fleetWheels(g,axles,1.015),wheelRadius:.48,length:7,detailProfile:'city-refined'};return g;
}
function sedan(){const g=new THREE.Group();
 // The lower silhouette has actual wheel openings instead of tyres intersecting a box.
 const s=new THREE.Shape();s.moveTo(-2.3,.39);s.lineTo(-2.3,.77);s.quadraticCurveTo(-2.2,.99,-1.83,1.02);s.lineTo(-1.38,1.04);s.lineTo(1.26,1.04);s.quadraticCurveTo(2.22,1.02,2.3,.79);s.lineTo(2.3,.39);s.lineTo(1.84,.39);
 for(const center of [1.43,-1.43]){if(center<0)s.lineTo(center+.41,.39);for(let i=0;i<=24;i++){const a=i*Math.PI/24;s.lineTo(center+.41*Math.cos(a),.39+.41*Math.sin(a));}}s.lineTo(-2.3,.39);s.closePath();
 mesh(g,new THREE.ExtrudeGeometry(s,{depth:1.66,bevelEnabled:true,bevelSegments:3,steps:1,bevelSize:.045,bevelThickness:.05,curveSegments:16}),paint,[0,0,-.83]);
 box(g,[0,.33,0],[3.98,.12,1.46],trim,.04);
 const hoodPoints=[],hoodUV=[],hoodIndices=[];
 for(let i=0;i<=16;i++){const t=.04+i/16*.81,x=(1-t)*(1-t)*1.26+2*(1-t)*t*2.22+t*t*2.3,y=(1-t)*(1-t)*1.04+2*(1-t)*t*1.02+t*t*.79;
  for(let j=0;j<=12;j++){const u=j/12;hoodPoints.push(x,y+.008+Math.sin(u*Math.PI)*.018,(u*2-1)*.76);hoodUV.push(t,u);}}
 for(let i=0;i<16;i++)for(let j=0;j<12;j++){const n=i*13+j;hoodIndices.push(n,n+1,n+14,n,n+14,n+13);}
 const hood=new THREE.BufferGeometry();hood.setAttribute('position',new THREE.Float32BufferAttribute(hoodPoints,3));hood.setAttribute('uv',new THREE.Float32BufferAttribute(hoodUV,2));hood.setIndex(hoodIndices);hood.computeVertexNormals();mesh(g,hood,paint);
 box(g,[-1.84,1.00,0],[.75,.04,1.61],paint,.018);
 // Narrower roof, tapered cabin and individually inset glazing.
 const sections=[[-1.48,1.04,.83],[-.85,1.49,.66],[.43,1.51,.66],[1.22,1.04,.83]];
 const vertices=[],indices=[];for(const [x,y,w]of sections)for(let j=0;j<=12;j++){const t=j/12;vertices.push(x,y+Math.sin(t*Math.PI)*.055,(t*2-1)*w);}
 for(let i=1;i<2;i++)for(let j=0;j<12;j++){const a=i*13+j;indices.push(a,a+1,a+14,a,a+14,a+13);}
 const roof=new THREE.BufferGeometry();roof.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));roof.setAttribute('uv',new THREE.Float32BufferAttribute(vertices.flatMap((_,i)=>i%3===0?[0,0]:[]),2));roof.setIndex(indices);roof.computeVertexNormals();mesh(g,roof,paint);
 for(const sign of [-1,1]){
  line(g,[[-1.47,1.045,sign*.831],[-.85,1.49,sign*.661],[.43,1.51,sign*.661],[1.22,1.045,sign*.831]],paint,.027);
  line(g,[[-.21,1.075,sign*.835],[-.21,1.48,sign*.673]],trim,.036);
  quad(g,[[-1.31,1.10,sign*.816],[-.81,1.435,sign*.690],[-.26,1.447,sign*.692],[-.26,1.10,sign*.816]],cabinGlass).castShadow=false;
  quad(g,[[-.16,1.10,sign*.816],[-.16,1.447,sign*.692],[.40,1.459,sign*.685],[1.07,1.10,sign*.816]],cabinGlass).castShadow=false;
  line(g,[[-1.34,1.075,sign*.843],[-.25,1.075,sign*.843],[1.13,1.075,sign*.843]],alloy);
  for(const x of [-1.18,-.21,1.06])line(g,[[x,1.05,sign*.884],[x-.035,.86,sign*.884],[x-.08,.46,sign*.884]],trim,.004);
  for(const x of [-.94,.71])box(g,[x,.966,sign*.899],[.19,.035,.024],alloy,.012);
  box(g,[.82,1.105,sign*.91],[.16,.035,.20],trim,.012);box(g,[.84,1.135,sign*1.005],[.26,.115,.18],paint,.035);box(g,[.739,1.143,sign*1.005],[.012,.075,.14],glass,.005);
  line(g,[[-1.02,.40,sign*.88],[0,.40,sign*.88],[1.01,.40,sign*.88]],paint,.027);
 }
 glazing(g,sections[2],sections[3]);
 glazing(g,sections[0],sections[1]);
 for(const z of [-.37,.28])line(g,[[1.12,1.105,z-.20],[1.08,1.132,z+.15]],trim,.009);
 box(g,[2.351,.54,0],[.035,.20,.94],trim,.012);
 for(let i=0;i<4;i++)box(g,[2.373,.47+i*.045,0],[.016,.012,.87],alloy,.004);
 for(const sign of [-1,1]){box(g,[2.29,.82,sign*.61],[.075,.14,.43],trim,.03);box(g,[2.333,.837,sign*.61],[.023,.085,.35],lens,.014);box(g,[-2.305,.83,sign*.60],[.04,.145,.46],red,.025);box(g,[-2.331,.851,sign*.60],[.009,.025,.37],lens,.004);}
 for(const x of [-2.35,2.35])box(g,[x,.65,0],[.022,.115,.43],plate,.008);
 box(g,[-2.29,.415,0],[.06,.09,1.35],trim,.024);
 const interior=new THREE.Group();interior.name='vehicle-near-detail';g.add(interior);
 const upholstery=material(0x303536,.93);
 for(const x of [-.72,.15])for(const z of [-.39,.39]){
  box(interior,[x,1.075,z],[.43,.22,.47],upholstery,.06);
  box(interior,[x-.16,1.235,z],[.13,.31,.44],upholstery,.045);
  box(interior,[x-.16,1.405,z],[.13,.15,.23],upholstery,.04);
 }
 box(interior,[.88,1.08,0],[.34,.13,1.4],trim,.04);
 const steering=mesh(interior,new THREE.TorusGeometry(.125,.016,8,24),trim,[.68,1.2,-.38]);steering.rotation.y=Math.PI/2;
 combine(interior);
 combine(g);const wheels=[];for(const x of [-1.43,1.43])for(const z of [-.85,.85]){const w=wheel();w.position.set(x,.355,z);g.add(w);wheels.push(w);}
 g.userData={wheels,wheelRadius:.355,length:4.6,detailProfile:'city-refined'};return g;
}
export function createRefinedVehicle(type='car'){if(!['car','bus','truck'].includes(type))throw new Error('Unsupported vehicle type');if(!templates.has(type))templates.set(type,({car:sedan,bus,truck})[type]());const template=templates.get(type),g=template.clone(true);g.userData={...template.userData,wheels:g.children.filter(c=>c.userData.isWheel)};
 return g;}
export function createRefinedCar(){return createRefinedVehicle('car');}

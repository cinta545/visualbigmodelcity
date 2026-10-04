import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {box,textPanel} from './district/materials.js';
import {landmarkMaterial} from './changchun-landmark-materials.mjs';

const green=landmarkMaterial(0x254f3c,.58,'paint'),cream=landmarkMaterial(0xe0c99a,.65,'paint'),red=landmarkMaterial(0x8d3934,.65,'paint');
const metal=new THREE.MeshStandardMaterial({color:0x343b3c,metalness:.6,roughness:.48});
const glass=new THREE.MeshStandardMaterial({color:0x506367,roughness:.21,metalness:.1,transparent:true,opacity:.48,depthWrite:false});
const wood=landmarkMaterial(0x78593d,.81,'paint'),stone=landmarkMaterial(0xb5afa0,.9,'stone');
const lamp=new THREE.MeshStandardMaterial({color:0xe4dcc4,roughness:.3});
function rounded(root,x,y,z,w,h,d,m,r=.08){const mesh=new THREE.Mesh(new RoundedBoxGeometry(w,h,d,3,r),m);mesh.position.set(x,y,z);mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);return mesh;}
function rod(root,a,b,r,m=metal){const p=new THREE.Vector3(...a),q=new THREE.Vector3(...b),v=q.clone().sub(p);const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r,r,v.length(),12),m);mesh.position.copy(p.add(q).multiplyScalar(.5));mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize());root.add(mesh);return mesh;}

// A heritage exhibit in a designed plot. It is not registered as a traffic actor.
export function heritageTram(root,options={}){
 if(!options.connectedRail)box(root,0,.06,0,20,.12,9,stone);
 const tram=new THREE.Group();tram.rotation.y=Math.PI/2;root.add(tram);
 if(!options.connectedRail)for(let z=-8.5;z<=8.5;z+=.58){
  box(tram,0,.16,z,2.3,.15,.21,wood);
  for(const x of [-.72,.72])box(tram,x,.26,z,.24,.07,.22,metal);
 }
 if(!options.connectedRail)for(const x of [-.72,.72]){box(tram,x,.31,0,.085,.14,18,metal);box(tram,x,.39,0,.13,.045,18,metal);}
 if(!options.connectedRail)for(const z of [-9,9]){box(tram,0,.75,z,2,.16,.20,metal);for(const x of [-.8,.8])rod(tram,[x,.25,z],[x,.9,z],.055);}
 box(tram,0,.95,0,2.25,.28,10.9,metal);
 for(const z of [-3.45,3.45]){
  rounded(tram,0,.7,z,1.85,.45,1.65,metal);
  for(const dz of [-.6,.6]){
   rod(tram,[-.95,.69,z+dz],[.95,.69,z+dz],.10);
   for(const x of [-.74,.74]){
    const wheel=new THREE.Mesh(new THREE.CylinderGeometry(.30,.30,.13,24),metal);wheel.rotation.z=Math.PI/2;wheel.position.set(x,.69,z+dz);tram.add(wheel);
   }
  }
 }
 rounded(tram,0,1.35,0,2.48,.67,11.65,green,.15);
 rounded(tram,0,1.77,0,2.50,.16,11.63,red,.065);
 rounded(tram,0,3.26,0,2.55,.43,11.78,cream,.19);
 box(tram,0,1.87,0,2.24,.08,11.25,wood);
 for(const side of [-1,1]){
  for(let i=0;i<11;i++){
   const z=-5.1+i*1.02;
   box(tram,side*1.20,2.46,z,.12,1.24,.085,cream);
   if(i<10){
    const pane=box(tram,side*1.205,2.47,z+.51,.026,1.07,.92,glass);pane.castShadow=false;
    box(tram,side*1.22,2.62,z+.51,.035,.04,.92,cream);
   }
  }
  for(const y of [1.91,3.02])box(tram,side*1.20,y,0,.14,.12,10.5,cream);
  // Closed twin-leaf entrance, with recessed steps and brass grab rails.
  const doorZ=3.58;
  for(const dz of [-.27,.27]){
   box(tram,side*1.265,2.05,doorZ+dz,.08,1.97,.51,cream);
   box(tram,side*1.315,2.40,doorZ+dz,.018,1.02,.37,glass).castShadow=false;
   box(tram,side*1.315,1.49,doorZ+dz,.018,.62,.37,green);
  }
  box(tram,side*1.3,1.05,doorZ,.32,.09,1.15,metal);
  for(const dz of [-.68,.68])rod(tram,[side*1.34,1.45,doorZ+dz],[side*1.34,2.7,doorZ+dz],.023,cream);
  for(const z of [-3.8,-2.25,-.7,.85]){
   rounded(tram,side*.79,2.04,z,.54,.16,.83,wood,.035);
   rounded(tram,side*1.02,2.35,z,.13,.64,.83,wood,.035);
  }
  textPanel(tram,'54路',side*1.267,1.36,-.65,1.18,.34,{rotation:side*Math.PI/2,background:'#254f3c',font:160,proportional:true});
 }
 for(const side of [-1,1]){
  const end=new THREE.Group();end.position.z=side*5.8;if(side<0)end.rotation.y=Math.PI;tram.add(end);
  rounded(end,0,2.39,0,2.36,1.30,.15,cream,.13);
  for(const x of [-.72,0,.72]){
   box(end,x,2.4,.085,.60,1.02,.03,glass).castShadow=false;
   rod(end,[x-.19,1.94,.12],[x+.14,2.35,.12],.017);
  }
  rounded(end,0,3.01,.12,.87,.26,.10,red,.09);
  textPanel(end,'54路',0,3.01,.18,.68,.19,{background:'#8d3934',font:160,proportional:true});
  const bezel=new THREE.Mesh(new THREE.TorusGeometry(.17,.035,8,24),metal);bezel.position.set(0,1.35,.15);end.add(bezel);
  const headlight=new THREE.Mesh(new THREE.SphereGeometry(.14,16,10),lamp);headlight.scale.z=.35;headlight.position.set(0,1.35,.17);end.add(headlight);
  rounded(end,0,.99,.23,1.82,.16,.19,metal,.045);
 }
 for(const z of [-3.8,-2.4,2.4,3.8])rounded(tram,0,3.53,z,.66,.16,.44,metal,.05);
 // Raised diamond pantograph: static sculpture, no overhead electrification claim.
 box(tram,0,3.52,0,1.05,.15,1.45,metal);
 for(const x of [-.42,.42]){
  rod(tram,[x,3.6,-.62],[x,4.24,.42],.04);rod(tram,[x,4.24,.42],[x,4.9,-.28],.04);
  rod(tram,[x,3.6,.62],[x,4.24,-.42],.04);rod(tram,[x,4.24,-.42],[x,4.9,-.28],.04);
 }
 rod(tram,[-.76,4.93,-.28],[.76,4.93,-.28],.055);
}

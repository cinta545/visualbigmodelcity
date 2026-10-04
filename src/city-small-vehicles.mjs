import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeBufferGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

const metal=new THREE.MeshStandardMaterial({color:0x53605e,roughness:.36,metalness:.7});
const dark=new THREE.MeshStandardMaterial({color:0x202b2c,roughness:.84});
const paint=new THREE.MeshStandardMaterial({color:0x536f79,roughness:.3,metalness:.25});
const cargo=new THREE.MeshStandardMaterial({color:0x798777,roughness:.57,metalness:.24});
const lens=new THREE.MeshStandardMaterial({color:0xe4e5d5,roughness:.18,metalness:.22});
const red=new THREE.MeshStandardMaterial({color:0xa63529,roughness:.25});
const amber=new THREE.MeshStandardMaterial({color:0xc48e31,roughness:.3});
const templates=new Map();

function add(parent,geometry,material,p){const m=new THREE.Mesh(geometry,material);m.position.set(...p);m.castShadow=m.receiveShadow=true;parent.add(m);return m;}
function block(root,p,size,material,r=.025){return add(root,new RoundedBoxGeometry(...size,2,Math.min(r,...size.map(v=>v/3))),material,p);}
function rod(root,a,b,r,material=metal){const from=new THREE.Vector3(...a),to=new THREE.Vector3(...b),d=to.clone().sub(from);const m=add(root,new THREE.CylinderGeometry(r,r,d.length(),10),material,from.add(to).multiplyScalar(.5).toArray());m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());return m;}
function disk(root,p,r,depth,material){const m=add(root,new THREE.CylinderGeometry(r,r,depth,24),material,p);m.rotation.z=Math.PI/2;return m;}

export function addSmallVehicleBody(root,type){
 if(!templates.has(type)){
  const parts=new THREE.Group(),motor=type==='motorcycle';
  block(parts,[-.25,.92,0],[motor?.63:.38,.115,motor?.3:.27],dark,.05);
  // Seat base and piping separate the cushion from the bodywork.
  block(parts,[-.25,.855,0],[motor?.6:.35,.025,motor?.28:.25],metal,.009);
  if(motor){
   block(parts,[.13,.75,0],[.46,.27,.32],paint,.10);
   block(parts,[-.44,.72,0],[.5,.23,.28],paint,.065);
   block(parts,[-.1,.49,0],[.3,.19,.27],dark,.05);
   for(const side of [-1,1]){
    for(let i=0;i<5;i++)block(parts,[-.12,.44+i*.028,side*.145],[.24,.009,.022],metal,.003);
    rod(parts,[-.58,.35,side*.12],[-.38,.74,side*.12],.024);
    for(let i=0;i<6;i++){
     const ring=add(parts,new THREE.TorusGeometry(.032,.007,6,12),metal,[-.54+i*.025,.43+i*.045,side*.12]);ring.rotation.x=Math.PI/2;
    }
   }
   rod(parts,[-.66,.35,.18],[-.2,.4,.18],.048,dark);
   rod(parts,[-.64,.35,.18],[-.32,.385,.18],.052);
  }else{
   // Open cargo bed: floor, thin corrugated walls, corner posts and rear gate.
   block(parts,[-.66,.48,0],[.7,.065,.82],cargo,.012);
   for(let i=0;i<6;i++)block(parts,[-.94+i*.112,.519,0],[.103,.02,.74],new THREE.MeshStandardMaterial({color:i%2?0x88745b:0x927d60,roughness:.9}),.003);
   for(const side of [-1,1]){
    block(parts,[-.66,.69,side*.397],[.7,.37,.027],cargo,.008);
    rod(parts,[-1,.89,side*.4],[-.32,.89,side*.4],.02);
    for(let i=0;i<5;i++)block(parts,[-.94+i*.14,.69,side*.416],[.016,.29,.015],cargo,.004);
    for(const x of [-.995,-.325])rod(parts,[x,.5,side*.4],[x,.89,side*.4],.017);
    block(parts,[-1.025,.61,side*.29],[.015,.09,.13],red,.006);
    block(parts,[-1.035,.77,side*.29],[.025,.12,.05],metal,.008);
   }
   for(const x of [-1.0,-.32])block(parts,[x,.69,0],[.025,.37,.8],cargo,.008);
   for(const zz of [-.24,.24])rod(parts,[-1.025,.515,zz-.055],[-1.025,.515,zz+.055],.018);
   rod(parts,[-.62,.32,-.4],[-.62,.32,.4],.035);
  }
  // Headlamp housing, lens, indicators, instrument pod and brake levers.
  disk(parts,[.51,.98,0],motor?.1:.075,.12,dark);disk(parts,[.579,.98,0],motor?.085:.061,.018,lens);
  block(parts,[.43,1.135,0],[.12,.04,.13],dark,.014);
  block(parts,[.43,1.158,0],[.08,.007,.085],metal,.006);
  for(const side of [-1,1]){
   disk(parts,[.53,.96,side*.17],.03,.035,amber);
   rod(parts,[.49,1.1,side*.16],[.55,1.08,side*.28],.008);
   rod(parts,[.48,1.1,side*.19],[.45,1.32,side*.29],.009);
   const mirror=block(parts,[.45,1.35,side*.3],[.04,.095,.14],dark,.025);
   mirror.rotation.y=side*.2;
   const face=block(parts,[.426,1.35,side*.3],[.009,.077,.12],new THREE.MeshStandardMaterial({color:0xa8bcc1,metalness:.9,roughness:.12}),.012);face.rotation.y=side*.2;
  }
  // Merge static body parts by material; wheel pivots remain in the parent model.
  parts.updateMatrixWorld(true);const groups=new Map();parts.traverse(o=>{if(!o.isMesh)return;const g=(o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone()).applyMatrix4(o.matrixWorld);if(!groups.has(o.material))groups.set(o.material,[]);groups.get(o.material).push(g);});
  const merged=new THREE.Group();for(const [material,geometries]of groups){const m=add(merged,mergeBufferGeometries(geometries,false),material,[0,0,0]);m.name='small-vehicle-body';for(const g of geometries)g.dispose();}
  templates.set(type,merged);
 }
 root.add(templates.get(type).clone(true));root.userData.smallVehicleDetail=type;
}

import * as T from 'three';
import {batchStatic} from './scene-batching.js';
import source from './transport-source.json' with {type:'json'};
import {project} from './geography.js';
import {trainMotion,stationGroundHeight,stationCanMove} from './transport-math.js';

export const metroEntrances=source.entrances.map(p=>({...p,...project(p.lat,p.lon),name:'Acesso Trianon–Masp',type:'metro'}));
export function makeSign(text,width=5,height=.65,color='#12623e'){
 const c=document.createElement('canvas');c.width=1024;c.height=128;const g=c.getContext('2d');g.fillStyle=color;g.fillRect(0,0,c.width,c.height);g.fillStyle='#fff';g.font='bold 45px Arial';g.textAlign='center';g.textBaseline='middle';g.fillText(text,512,64);const texture=new T.CanvasTexture(c);texture.colorSpace=T.SRGBColorSpace;return new T.Mesh(new T.PlaneGeometry(width,height),new T.MeshBasicMaterial({map:texture,side:T.DoubleSide}));
}
export function createMetro(scene){
 const root=new T.Group();root.name='Trianon Masp station study';root.visible=false;scene.add(root);root.userData.colliders=[];
 const concrete=new T.MeshStandardMaterial({color:'#92958f',roughness:.94}),floor=new T.MeshStandardMaterial({color:'#a3a39b',roughness:.84}),edge=new T.MeshStandardMaterial({color:'#c5ab48',roughness:.8}),steel=new T.MeshStandardMaterial({color:'#8c9597',metalness:.8,roughness:.33}),dark=new T.MeshStandardMaterial({color:'#151f24',roughness:.6}),glass=new T.MeshStandardMaterial({color:'#172d37',metalness:.45,roughness:.19}),light=new T.MeshStandardMaterial({color:'#f0f1d9',emissive:'#e8f4d9',emissiveIntensity:1.4});
 const geo=new T.BoxGeometry(1,1,1);function box(parent,x,y,z,w,h,d,mat){const m=new T.Mesh(geo,mat);m.position.set(x,y+h/2,z);m.scale.set(w,h,d);m.receiveShadow=true;parent.add(m);return m;}
 box(root,0,-.45,0,10,.45,140,floor);for(const x of [-4.75,4.75])box(root,x,.005,0,.35,.025,138,edge);
 for(const side of [-1,1]){const x=side*7.15;box(root,x,-1.25,0,4,.2,900,dark);for(const rail of [-.8,.8])box(root,x+rail,-.97,0,.1,.16,900,steel);for(let z=-420;z<420;z+=.85)box(root,x,-1.07,z,2.2,.16,.22,concrete);box(root,side*9.8,-1.3,0,.45,9,920,concrete);box(root,side*9.6,4.6,0,.4,1.8,140,dark);}
 box(root,0,7,0,20,.5,150,concrete);for(let z=-60;z<=60;z+=12){for(const x of [-2.3,2.3]){const col=new T.Mesh(new T.CylinderGeometry(.32,.37,6.9,16),concrete);col.position.set(x,3.45,z);root.add(col);}box(root,0,6.65,z,19,.3,.45,concrete);for(const x of [-5,5])box(root,x,5.9,z,.12,.08,7,light);}
 // Two distribution mezzanines and stairs, matching the documented arrangement; dimensions approximate.
 for(const side of [-1,1]){box(root,0,5.7,side*67,10,.3,13,concrete);for(let i=0;i<30;i++)box(root,0,i*.2,side*(49+i*.55),3,.2,.55,floor);for(let i=0;i<3;i++)box(root,-2+i*2,6,side*70,1.1,.9,.4,steel);const exit=makeSign('SAÍDA ↑ AVENIDA PAULISTA',5,.6);exit.position.set(0,7.05,side*70);root.add(exit);}
 for(const z of [-45,-15,15,45]){const sign=makeSign('TRIANON–MASP  •  2 VERDE',5,.55);sign.position.set(0,4.7,z);root.add(sign);for(const x of [-3,3]){box(root,x,.45,z,1.6,.08,.5,steel);box(root,x,.5,z+.22,1.6,.5,.05,steel);}}
 const ambient=new T.HemisphereLight('#f3f2dc','#4d5152',2.2);root.add(ambient);for(const z of [-50,0,50]){const p=new T.PointLight('#f0f4de',160,42,2);p.position.set(0,5,z);root.add(p);}
 const trains=[],stripe=new T.MeshStandardMaterial({color:'#185b52',roughness:.45,metalness:.35}),dummy=new T.Object3D();
 for(const side of [-1,1]){const train=new T.Group(),doors=[],leaves=new T.InstancedMesh(geo,steel,72),windows=new T.InstancedMesh(geo,glass,72);train.add(leaves,windows);leaves.frustumCulled=windows.frustumCulled=false;root.add(train);train.position.x=side*7.15;
  for(let car=0;car<6;car++){const cz=(car-2.5)*21.7;box(train,0,-.56,cz,3.15,3.15,20.9,steel);box(train,0,.15,cz,3.19,.18,20.9,stripe);box(train,0,2.62,cz,2.9,.18,20.4,dark);for(const wheelZ of [-7,7])for(const x of [-.85,.85]){const wheel=new T.Mesh(new T.CylinderGeometry(.37,.37,.16,14),steel);wheel.rotation.z=Math.PI/2;wheel.position.set(x,-.74,cz+wheelZ);train.add(wheel);}
   for(const x of [-1.586,1.586]){for(const dz of [-8.4,-3.15,2.1,7.35]){box(train,x,.75,cz+dz,.018,1,1.5,glass);}for(const dz of [-5.8,-.5,4.8]){for(const sign of [-1,1]){doors.push({x,z:cz+dz+sign*.36,sign});}}}
   if(car===0||car===5){const z=cz+(car===0?-10.47:10.47);box(train,0,1,z,2.7,1.05,.02,glass);for(const x of [-1.15,1.15])box(train,x,.3,z,.25,.2,.04,light);}
  }batchStatic(train);trains.push({root:train,doors,side,leaves,windows});
 }
 batchStatic(root);
 let elapsed=0,motion=trainMotion(0);return {root,source,entrances:metroEntrances,get motion(){return motion;},update(dt,active){if(!active)return;elapsed+=dt;for(let i=0;i<trains.length;i++){const t=trains[i],m=trainMotion(elapsed+i*28);t.root.position.z=m.position*t.side;t.doors.forEach((d,j)=>{dummy.position.set(d.x,1.375,d.z+d.sign*m.doors*.65);dummy.scale.set(.025,2.25,.7);dummy.updateMatrix();t.leaves.setMatrixAt(j,dummy.matrix);dummy.position.y=1.65;dummy.position.x=d.x+Math.sign(d.x)*.018;dummy.scale.set(.025,.85,.49);dummy.updateMatrix();t.windows.setMatrixAt(j,dummy.matrix);});t.leaves.instanceMatrix.needsUpdate=t.windows.instanceMatrix.needsUpdate=true;if(!i)motion=m;}},groundHeight:stationGroundHeight,canMove:stationCanMove};
}
export function addMetroEntrances(parent){const group=new T.Group();parent.add(group);const metal=new T.MeshStandardMaterial({color:'#253736',metalness:.65,roughness:.4});for(const p of metroEntrances){const sign=makeSign('M  TRIANON–MASP  ↓',4,.65);sign.position.set(p.x,15,p.z);group.add(sign);for(const dx of [-2,2]){const pole=new T.Mesh(new T.CylinderGeometry(.045,.06,3,12),metal);pole.position.set(p.x+dx,13.5,p.z);group.add(pole);}const landing=new T.Mesh(new T.BoxGeometry(4,.06,3),new T.MeshStandardMaterial({color:'#424a48',roughness:.9}));landing.position.set(p.x,12.12,p.z);group.add(landing);}return group;}

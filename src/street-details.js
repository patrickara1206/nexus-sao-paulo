import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {roadRecords,inTrianon,trianonEntrance} from './geography.js';
import {joinRoads,sampleRoute,routeDistance} from './transport-math.js';
import {batchStatic} from './scene-batching.js';

// Furniture is reference-quality CC0 scenery, with indicative placement rather than surveyed positions.
export function addStreetDetails(parent,colliders){
 const root=new T.Group();parent.add(root);const concrete=new T.MeshStandardMaterial({color:'#b0b1a6',roughness:.91}),paint=new T.MeshStandardMaterial({color:'#d9d8cd',roughness:.87}),geometry=new T.BoxGeometry(1,1,1);
 function box(x,y,z,w,h,d,material,yaw=0){const mesh=new T.Mesh(geometry,material);mesh.position.set(x,y,z);mesh.scale.set(w,h,d);mesh.rotation.y=yaw;mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);}
 const routes=joinRoads(roadRecords.filter(r=>r.name==='Avenida Paulista'&&!r.tunnel&&r.layer>=0)).slice(0,2);
 const lampPositions=[];
 for(const route of routes){const center=routeDistance(route,0,0).along;for(let d=center-270;d<center+270;d+=30){const p=sampleRoute(route,d,8.1);lampPositions.push(p);}for(let d=center-300;d<center+300;d+=4){const p=sampleRoute(route,d,6.8);box(p.x,12.09,p.z,.22,.14,3.96,concrete,p.yaw);}}
 // Align markings with mapped crossing streets; paint details remain an approximation.
 for(const name of ['Rua Peixoto Gomide','Rua Pamplona']){const crossing=roadRecords.filter(r=>r.name===name);for(const route of routes){let best;for(const r of crossing)for(const p of r.points){const q=routeDistance(route,...p);if(!best||q.distance<best.distance)best=q;}if(!best||best.distance>18)continue;const p=sampleRoute(route,best.along);for(const sign of [-1,1])for(let lane=-5.2;lane<6;lane+=1.4){const x=p.x+p.dx*sign*12+p.dz*lane,z=p.z+p.dz*sign*12-p.dx*lane;box(x,12.083,z,.65,.014,3.1,paint,p.yaw);}}}
 batchStatic(root);const loader=new GLTFLoader();
 const poleMaterial=new T.MeshStandardMaterial({color:'#626f72',metalness:.6,roughness:.48}),luminaire=new T.MeshStandardMaterial({color:'#c3cac7',roughness:.4,metalness:.5});for(const p of lampPositions){box(p.x,15.2,p.z,.13,6.4,.13,poleMaterial);const reach=2.1;box(p.x-p.dz*reach/2,18.3,p.z+p.dx*reach/2,reach,.09,.09,poleMaterial,p.yaw-Math.PI/2);box(p.x-p.dz*reach,18.18,p.z+p.dx*reach,.75,.13,.3,luminaire,p.yaw-Math.PI/2);}batchStatic(root);
 const benches=loader.loadAsync('/assets/props/painted_wooden_bench.glb').then(g=>{const b=new T.Box3().setFromObject(g.scene),scale=1.7/b.getSize(new T.Vector3()).x;for(let i=-3;i<=3;i++){const x=trianonEntrance.x+i*5,z=trianonEntrance.z+10;if(!inTrianon(x,z))continue;const item=g.scene.clone(true);item.scale.setScalar(scale);item.position.set(x,12.12-b.min.y*scale,z);root.add(item);item.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});colliders.push({x,z,w:1.9,d:.8});}});
 return Promise.allSettled([benches]);
}

import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {inTrianon, trianonEntrance} from './geography.js';
import {sampleRoute, routeDistance} from './transport-math.js';
import {PAULISTA_WIDTH, nearPaulistaCrossing, paulistaCrossings, paulistaRoutes} from './street-layout.js';
import {batchStatic} from './scene-batching.js';

// Placement uses the modeled road widths. Street furniture and actual markings are approximate.
export function addStreetDetails(parent, colliders) {
 const root = new T.Group();
 root.name = 'Paulista pavement and street furniture';
 parent.add(root);
 const concrete = new T.MeshStandardMaterial({color: '#a6a69b', roughness: .91});
 const paint = new T.MeshStandardMaterial({color: '#deddd3', roughness: .87});
 const tactile = new T.MeshStandardMaterial({color: '#b58b4d', roughness: .9});
 const poleMaterial = new T.MeshStandardMaterial({color: '#626f72', metalness: .6, roughness: .48});
 const luminaire = new T.MeshStandardMaterial({color: '#c3cac7', roughness: .4, metalness: .5});
 const geometry = new T.BoxGeometry(1, 1, 1);

 function box(point, y, width, height, length, material, castShadow = true) {
  const mesh = new T.Mesh(geometry, material);
  mesh.position.set(point.x, y, point.z);
  mesh.scale.set(width, height, length);
  mesh.rotation.y = point.yaw;
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;
  root.add(mesh);
 }

 const halfWidth = PAULISTA_WIDTH / 2;
 for (const route of paulistaRoutes) {
  const center = routeDistance(route, 0, 0).along;
  for (let distance = center - 290; distance <= center + 290; distance += 4) {
   if (nearPaulistaCrossing(route, distance, 13)) continue;
   for (const direction of [-1, 1]) {
    const curb = sampleRoute(route, distance, direction * (halfWidth + .23));
    box(curb, 12.07, .19, .13, 3.96, concrete);
   }
  }
  for (let distance = center - 280; distance <= center + 280; distance += 9) {
   if (nearPaulistaCrossing(route, distance, 16)) continue;
   for (const offset of [-3.25, 3.25]) {
    // The avenue already has its central dashed line; mark the adjacent lane divisions.
    box(sampleRoute(route, distance, offset), 12.072, .12, .014, 3.3, paint, false);
   }
  }
  for (let distance = center - 285; distance <= center + 285; distance += 32) {
   if (nearPaulistaCrossing(route, distance, 18)) continue;
   const pole = sampleRoute(route, distance, -halfWidth - 1.45);
   const arm = sampleRoute(route, distance, -halfWidth - .4);
   const head = sampleRoute(route, distance, -halfWidth + .65);
   box(pole, 15.2, .13, 6.4, .13, poleMaterial);
   box(arm, 18.3, 2.1, .09, .09, poleMaterial);
   box(head, 18.18, .68, .12, .29, luminaire);
  }
 }

 for (const {route, stop, along} of paulistaCrossings) {
  box(sampleRoute(route, stop), 12.082, PAULISTA_WIDTH - .7, .015, .38, paint, false);
  for (const crosswalk of [along - 7, along + 7]) {
   for (let offset = -5.65; offset <= 5.7; offset += 1.05) {
    box(sampleRoute(route, crosswalk, offset), 12.083, .53, .016, 3.15, paint, false);
   }
   for (const direction of [-1, 1]) {
    const ramp = sampleRoute(route, crosswalk, direction * (halfWidth + .47));
    box(ramp, 12.071, .58, .024, 2.9, tactile, false);
   }
  }
 }
 batchStatic(root);
 const loader = new GLTFLoader();
 const benches = loader.loadAsync('/assets/props/painted_wooden_bench.glb').then(g => {
  const bounds = new T.Box3().setFromObject(g.scene);
  const scale = 1.7 / bounds.getSize(new T.Vector3()).x;
  for (let index = -3; index <= 3; index++) {
   const x = trianonEntrance.x + index * 5;
   const z = trianonEntrance.z + 10;
   if (!inTrianon(x, z)) continue;
   const item = g.scene.clone(true);
   item.scale.setScalar(scale);
   item.position.set(x, 12.12 - bounds.min.y * scale, z);
   root.add(item);
   item.traverse(mesh => {
    if (mesh.isMesh) {
     mesh.castShadow = true;
     mesh.receiveShadow = true;
    }
   });
   colliders.push({x, z, w: 1.9, d: .8});
  }
 });
 return Promise.allSettled([benches]);
}

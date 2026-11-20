import * as T from 'three';
import {batchStatic} from './scene-batching.js';

const unitBox = new T.BoxGeometry(1, 1, 1);
const doorCenters = [-6.6, 0, 6.6];
const windowCenters = [-8.8, -3.45, 3.45, 8.8];
const halfLength = 10.46;
const floorHeight = .05;
const roofHeight = 2.6;

function material(color, roughness = .7, metalness = 0) {
 return new T.MeshStandardMaterial({color, roughness, metalness});
}

function box(group, x, y, z, width, height, depth, mat) {
 const mesh = new T.Mesh(unitBox, mat);
 mesh.position.set(x, y + height / 2, z);
 mesh.scale.set(width, height, depth);
 group.add(mesh);
 return mesh;
}

export function createTrainMaterials() {
 return {
  steel: material('#aab6b7', .49, .73),
  trim: material('#c7d2d1', .55, .39),
  stripe: material('#1b6a55', .52, .22),
  rubber: material('#192225', .83),
  smokedGlass: material('#21353b', .21, .41),
  interior: material('#c3c6bc', .73),
  seats: material('#255e57', .54),
  warmLight: new T.MeshBasicMaterial({color: '#f1f3e1', toneMapped: false}),
  headlights: new T.MeshBasicMaterial({color: '#fff4da', toneMapped: false}),
  tailLights: new T.MeshBasicMaterial({color: '#942d28'}),
 };
}

function addCarInterior(train, center, mats) {
 box(train, 0, -.46, center, 3.10, .49, halfLength * 2, mats.rubber);
 box(train, 0, floorHeight, center, 3.08, .045, halfLength * 2, mats.interior);
 box(train, 0, roofHeight - .14, center, 3.09, .2, halfLength * 2, mats.steel);
 box(train, 0, roofHeight + .06, center, 2.67, .11, halfLength * 2 - .4, mats.trim);
 box(train, 0, roofHeight - .2, center, .15, .06, 18.5, mats.warmLight);
 for (const side of [-1, 1]) {
  for (const z of windowCenters) {
   box(train, side * 1.12, .45, center + z, .72, .13, 1.92, mats.seats);
   box(train, side * 1.45, .53, center + z, .11, .53, 1.92, mats.seats);
  }
  for (const z of doorCenters) {
   box(train, side * .68, .09, center + z - .94, .055, 2.36, .055, mats.trim);
   box(train, side * 1.53, .05, center + z, .13, .08, 1.72, mats.trim);
  }
 }
}

function addCarSide(train, center, side, mats, doorPositions) {
 const x = side * 1.49;
 const openings = [
  ...windowCenters.map(z => ({z, width: 1.74, door: false})),
  ...doorCenters.map(z => ({z, width: 1.73, door: true})),
 ].sort((a, b) => a.z - b.z);
 let previous = -halfLength;
 for (const opening of openings) {
  const left = opening.z - opening.width / 2;
  const right = opening.z + opening.width / 2;
  box(train, x, floorHeight, center + (previous + left) / 2, .16, roofHeight - floorHeight, left - previous, mats.steel);
  box(train, x + side * .084, .33, center + (previous + left) / 2, .02, .18, left - previous, mats.stripe);
  const bottom = opening.door ? .09 : 1.05;
  const top = opening.door ? 2.32 : 2.04;
  box(train, x, floorHeight, center + opening.z, .16, bottom - floorHeight, opening.width, mats.steel);
  box(train, x, top, center + opening.z, .16, roofHeight - top, opening.width, mats.steel);
  if (!opening.door) {
   box(train, x + side * .08, .33, center + opening.z, .02, .18, opening.width, mats.stripe);
   box(train, x + side * .07, bottom, center + opening.z, .05, top - bottom, opening.width, mats.rubber);
   box(train, x + side * .1, bottom + .06, center + opening.z, .02, top - bottom - .12, opening.width - .12, mats.smokedGlass);
  } else {
   for (const direction of [-1, 1]) {
    doorPositions.push({x: side * 1.584, z: center + opening.z + direction * .428, direction});
    box(train, x + side * .076, .09, center + opening.z + direction * .864, .055, 2.22, .026, mats.rubber);
   }
  }
  previous = right;
 }
 box(train, x, floorHeight, center + (previous + halfLength) / 2, .16, roofHeight - floorHeight, halfLength - previous, mats.steel);
 box(train, x + side * .084, .33, center + (previous + halfLength) / 2, .02, .18, halfLength - previous, mats.stripe);
}

function addTrainEnd(train, center, direction, leading, mats) {
 const z = center + direction * halfLength;
 box(train, 0, .03, z, 3.11, 2.55, .075, mats.steel);
 box(train, 0, .9, z + direction * .045, 2.72, 1.36, .025, mats.rubber);
 box(train, 0, 1.27, z + direction * .066, 2.56, .87, .025, mats.smokedGlass);
 box(train, 0, .77, z + direction * .07, 2.75, .16, .03, mats.stripe);
 box(train, 0, .08, z + direction * .09, 2.78, .26, .19, mats.rubber);
 for (const side of [-1, 1]) {
  box(train, side * 1.1, .55, z + direction * .067, .39, .18, .037, mats.rubber);
  box(train, side * 1.1, .575, z + direction * .093, .32, .11, .024, leading ? mats.headlights : mats.tailLights);
 }
}

export function createMetroTrain(parent, travelDirection, materials) {
 const train = new T.Group();
 train.position.x = travelDirection * 7.15;
 parent.add(train);
 const positions = [];
 const wheelGeometry = new T.CylinderGeometry(.37, .37, .16, 14);
 for (let car = 0; car < 6; car++) {
  const center = (car - 2.5) * 21.7;
  addCarInterior(train, center, materials);
  for (const side of [-1, 1]) {
   addCarSide(train, center, side, materials, positions);
   for (const position of [-7, 7]) {
    const wheel = new T.Mesh(wheelGeometry, materials.rubber);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(side * .88, -.73, center + position);
    train.add(wheel);
   }
  }
  if (car === 0 || car === 5) {
   const direction = car === 0 ? -1 : 1;
   addTrainEnd(train, center, direction, direction === travelDirection, materials);
  }
  if (car < 5) {
   box(train, 0, .04, center + 10.85, 1.75, 2.45, .82, materials.rubber);
   for (let fold = 0; fold < 3; fold++) box(train, 0, .06, center + 10.62 + fold * .21, 1.82, 2.45, .043, materials.trim);
  }
 }
 batchStatic(train);

 const leaves = new T.InstancedMesh(unitBox, materials.steel, positions.length);
 const windows = new T.InstancedMesh(unitBox, materials.smokedGlass, positions.length);
 const gaskets = new T.InstancedMesh(unitBox, materials.rubber, positions.length);
 const scratch = new T.Object3D();
 train.add(leaves, windows, gaskets);
 for (const mesh of [leaves, windows, gaskets]) {
  mesh.frustumCulled = false;
  mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
 }
 let lastOpen = -1;

 return {
  update(motion) {
   train.position.z = motion.position * travelDirection;
   if (motion.doors === lastOpen) return;
   lastOpen = motion.doors;
   positions.forEach(({x, z, direction}, index) => {
    z += direction * motion.doors * .82;
    scratch.position.set(x, 1.204, z);
    scratch.scale.set(.039, 2.244, .849);
    scratch.updateMatrix();
    leaves.setMatrixAt(index, scratch.matrix);
    scratch.position.set(x + Math.sign(x) * .023, 1.64, z);
    scratch.scale.set(.025, .99, .62);
    scratch.updateMatrix();
    gaskets.setMatrixAt(index, scratch.matrix);
    scratch.position.x += Math.sign(x) * .018;
    scratch.scale.set(.014, .90, .54);
    scratch.updateMatrix();
    windows.setMatrixAt(index, scratch.matrix);
   });
   for (const mesh of [leaves, windows, gaskets]) mesh.instanceMatrix.needsUpdate = true;
  },
 };
}

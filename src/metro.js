import * as T from 'three';
import {pbrMaterial} from './lab.js';
import {batchStatic} from './scene-batching.js';
import {createMetroTrain, createTrainMaterials} from './metro-train.js';
import source from './transport-source.json' with {type:'json'};
import {project} from './geography.js';
import {trainMotion, stationGroundHeight, stationCanMove} from './transport-math.js';

export const metroEntrances = source.entrances.map(point => ({
 ...point, ...project(point.lat, point.lon), name: 'Acesso Trianon–Masp', type: 'metro',
}));

const unitBox = new T.BoxGeometry(1, 1, 1);
const destinations = ['Vila Madalena', 'Vila Prudente'];

function material(color, roughness = .8, metalness = 0) {
 return new T.MeshStandardMaterial({color, roughness, metalness});
}

function box(parent, x, y, z, w, h, d, mat, textured = false) {
 const geometry = textured ? new T.BoxGeometry(w, h, d) : unitBox;
 if (textured) {
  // Box faces keep the same two-metre texture scale even on a 140 m platform.
  const normal = geometry.attributes.normal;
  const uv = geometry.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
   const end = Math.abs(normal.getZ(i)) > .5;
   const top = Math.abs(normal.getY(i)) > .5;
   uv.setXY(i, uv.getX(i) * (top || end ? w : d) / 2, uv.getY(i) * (top ? d : h) / 2);
  }
 }
 const mesh = new T.Mesh(geometry, mat);
 mesh.position.set(x, y + h / 2, z);
 if (!textured) mesh.scale.set(w, h, d);
 mesh.receiveShadow = true;
 parent.add(mesh);
 return mesh;
}

function signCanvas(width, height) {
 const canvas = document.createElement('canvas');
 canvas.width = Math.min(2048, Math.round(width / height * 128));
 canvas.height = 128;
 return canvas;
}

function signMesh(canvas, width, height) {
 const texture = new T.CanvasTexture(canvas);
 texture.colorSpace = T.SRGBColorSpace;
 return new T.Mesh(new T.PlaneGeometry(width, height), new T.MeshBasicMaterial({map: texture, toneMapped: false}));
}

export function makeSign(text, width = 5, height = .65, color = '#12623e') {
 const canvas = signCanvas(width, height);
 const context = canvas.getContext('2d');
 context.fillStyle = color;
 context.fillRect(0, 0, canvas.width, canvas.height);
 context.fillStyle = '#f8f9f3';
 context.font = 'bold 70px Arial';
 context.textAlign = 'center';
 context.textBaseline = 'middle';
 context.fillText(text, canvas.width / 2, 66, canvas.width - 36);
 const group = new T.Group();
 const front = signMesh(canvas, width, height);
 const back = front.clone();
 back.rotation.y = Math.PI;
 group.add(front, back);
 return group;
}

function createArrivalBoard(parent, z, mats) {
 const width = 4.25;
 const height = .98;
 const canvas = signCanvas(width, height);
 const context = canvas.getContext('2d');
 const front = signMesh(canvas, width, height);
 const back = front.clone();
 front.position.set(0, 3.67, z + .071);
 back.position.set(0, 3.67, z - .071);
 back.rotation.y = Math.PI;
 parent.add(front, back);
 box(parent, 0, 3.14, z, width + .09, height + .1, .13, mats.dark);
 for (const x of [-1.7, 1.7]) box(parent, x, 4.18, z, .05, 2.77, .05, mats.dark);
 let lastText = '';

 return function updateBoard(motions) {
  const arrivals = motions.map(motion => {
   if (motion.phase === 'boarding') return 'Embarque';
   const seconds = motion.phase === 'approaching' ? motion.remaining : motion.remaining + 18;
   return `${seconds} s`;
  });
  const text = arrivals.join('/');
  if (text === lastText) return;
  lastText = text;
  context.fillStyle = '#101c21';
  context.fillRect(0, 0, canvas.width, 128);
  context.fillStyle = '#18724f';
  context.fillRect(0, 0, canvas.width, 29);
  context.fillStyle = '#f1f5eb';
  context.textBaseline = 'middle';
  context.textAlign = 'left';
  context.font = 'bold 18px Arial';
  context.fillText('2  VERDE  |  TRIANON–MASP', 18, 15);
  for (const [i, arrival] of arrivals.entries()) {
   const y = 55 + i * 42;
   context.fillStyle = '#e2eae1';
   context.textAlign = 'left';
   context.font = '25px Arial';
   context.fillText(destinations[i], 18, y);
   context.fillStyle = '#bce9a4';
   context.textAlign = 'right';
   context.font = 'bold 25px Arial';
   context.fillText(arrival, canvas.width - 18, y);
  }
  front.material.map.needsUpdate = true;
 };
}

function stationMaterials() {
 const concrete = pbrMaterial('concrete_pavement');
 concrete.color.set('#a3a69b');
 concrete.normalScale.set(.38, .38);
 const floor = pbrMaterial('concrete_pavement');
 floor.color.set('#b5b5aa');
 floor.normalScale.set(.37, .37);
 return {
  concrete, floor,
  edge: material('#c9a649'), steel: material('#899a9d', .41, .69),
  dark: material('#222e2e'), stripe: material('#16724e', .57),
  rail: material('#a4b1b2', .47, .61), furniture: material('#394c48', .72, .25),
  light: new T.MeshBasicMaterial({color: '#f1f5e7', toneMapped: false}),
 };
}

function addTracks(root, mats) {
 const {concrete, steel, dark, stripe} = mats;
 for (const side of [-1, 1]) {
  const x = side * 7.15;
  box(root, x, -1.25, 0, 4, .2, 900, dark);
  for (const rail of [-.8, .8]) box(root, x + rail, -.97, 0, .1, .16, 900, steel);
  for (let z = -130; z < 130; z += .87) box(root, x, -1.07, z, 2.2, .16, .22, dark);
  box(root, side * 9.8, -1.3, 0, .45, 9, 920, concrete, true);
  box(root, side * 9.54, 2.9, 0, .09, .28, 139, stripe);
  box(root, side * 9.56, 4.6, 0, .29, 1.8, 140, dark);
  for (let z = -66; z < 68; z += 6) box(root, side * 9.55, -.9, z, .08, 3.8, .04, dark);
  const sign = makeSign('TRIANON–MASP', 5.2, .54);
  sign.position.set(side * 9.48, 3.58, -18);
  sign.rotation.y = Math.PI / 2;
  root.add(sign);
 }
}

function addPlatform(root, mats) {
 const {concrete, floor, edge, dark, light} = mats;
 box(root, 0, -.45, 0, 10, .45, 140, floor, true);
 for (const x of [-4.75, 4.75]) box(root, x, .005, 0, .35, .025, 138, edge);
 const tactile = new T.InstancedMesh(new T.CylinderGeometry(.018, .018, .009, 6), edge, 2100);
 const bump = new T.Object3D();
 let index = 0;
 for (const side of [-1, 1]) {
  for (let i = 0; i < 350; i++) {
   for (let row = 0; row < 3; row++) {
    bump.position.set(side * (4.62 + row * .07), .038, -69.8 + i * .4);
    bump.updateMatrix();
    tactile.setMatrixAt(index++, bump.matrix);
   }
  }
 }
 root.add(tactile);

 box(root, 0, 7, 0, 20, .5, 100, concrete, true);
 for (const side of [-1, 1]) box(root, 0, 9.05, side * 62, 20, .5, 24, concrete, true);
 for (let z = -60; z <= 60; z += 12) {
  const outer = Math.abs(z) > 48;
  const height = outer ? 9.2 : 7;
  for (const x of [-2.3, 2.3]) {
   const column = new T.Mesh(new T.CylinderGeometry(.36, .41, height, 16), concrete);
   column.position.set(x, height / 2, z);
   column.receiveShadow = true;
   root.add(column);
   box(root, x, .02, z, .82, .13, .82, dark);
  }
  box(root, 0, height - .36, z, 19, .3, .45, concrete, true);
  for (const x of [-4.65, 4.65]) {
   const lightHeight = outer ? 8.0 : 5.9;
   box(root, x, lightHeight + .025, z, .18, .13, 7.0, dark);
   box(root, x, lightHeight, z, .13, .035, 6.85, light);
  }
 }
}

function addMezzanine(root, side, mats) {
 const {concrete, floor, rail, dark} = mats;
 box(root, 0, 5.7, side * 69.6, 9.2, .3, 8.2, concrete, true);
 for (let i = 0; i < 30; i++) {
  const z = side * (49 + i * .55);
  box(root, 0, i * .2, z, 2.93, .2, .56, floor);
  box(root, 0, (i + 1) * .2 + .004, z - side * .21, 2.88, .018, .052, dark);
 }
 const slope = Math.atan2(5.8, 15.95);
 for (const x of [-1.48, 1.48]) {
  const handrail = box(root, x, 3.94, side * 57, .055, .055, 17, rail);
  handrail.rotation.x = -side * slope;
  box(root, x, 6.86, side * 69.4, .055, .055, 7.85, rail);
  for (let i = 0; i < 30; i += 3) box(root, x, (i + 1) * .2, side * (49 + i * .55), .046, .86, .046, rail);
 }
 for (const x of [-2.8, 2.8]) {
  box(root, x, 6, side * 69.6, .055, 1.03, 7.5, rail);
  box(root, x, 6, side * 65.7, 2.5, 1.03, .055, rail);
 }
 box(root, 0, 6, side * 73.45, 9.2, 3.3, .35, concrete, true);
 const exit = makeSign('SAÍDA  ↑  AVENIDA PAULISTA', 4.2, .49, '#274f42');
 exit.position.set(0, 8.48, side * 71.1);
 root.add(exit);
}

function addFurniture(root, mats) {
 const footprints = [];
 for (const z of [-33, -11, 26, 42]) {
  const side = z < 0 ? -1 : 1;
  const x = side * 3.38;
  box(root, x, .44, z, .51, .095, 2.0, mats.furniture);
  box(root, x + side * .24, .48, z, .075, .39, 2.0, mats.furniture);
  for (const offset of [-.72, .72]) box(root, x, .03, z + offset, .37, .44, .12, mats.steel);
  box(root, x, 0, z + 1.55, .38, .68, .37, mats.dark);
  footprints.push({x, z, hx: .49, hz: 1.25}, {x, z: z + 1.55, hx: .38, hz: .39});
 }
 return footprints;
}

export function createMetro(scene) {
 const root = new T.Group();
 root.name = 'Trianon Masp station study';
 root.visible = false;
 root.userData.colliders = [];
 scene.add(root);
 const mats = stationMaterials();
 addTracks(root, mats);
 addPlatform(root, mats);
 for (const side of [-1, 1]) addMezzanine(root, side, mats);
 const furniture = addFurniture(root, mats);
 const boards = [-29, 8, 35].map(z => createArrivalBoard(root, z, mats));

 root.add(new T.HemisphereLight('#f3f6ed', '#606c69', .92));
 for (const z of [-50, -17, 17, 50]) {
  const light = new T.PointLight('#f3f8ee', 153, 26, 2);
  light.position.set(0, 5, z);
  root.add(light);
 }
 for (const side of [-1, 1]) {
  const light = new T.PointLight('#e3f5f1', 82, 18, 2);
  light.position.set(0, 8.65, side * 66);
  root.add(light);
 }

 const trainMaterials = createTrainMaterials();
 const trains = [-1, 1].map(side => createMetroTrain(root, side, trainMaterials));
 batchStatic(root);
 let elapsed = 0;
 let motion = trainMotion(0);

 function updateStation() {
  const motions = [trainMotion(elapsed), trainMotion(elapsed + 28)];
  trains.forEach((train, i) => train.update(motions[i]));
  boards.forEach(board => board(motions));
  motion = motions.find(train => train.phase === 'boarding') || motions.find(train => train.phase === 'approaching') || motions[0];
 }

 updateStation();
 return {
  root, source, entrances: metroEntrances,
  get motion() {return motion;},
  update(dt, active) {
   if (!active) return;
   elapsed += dt;
   updateStation();
  },
  groundHeight: stationGroundHeight,
  canMove(x, z) {
   return stationCanMove(x, z) && !furniture.some(footprint => Math.abs(x - footprint.x) < footprint.hx && Math.abs(z - footprint.z) < footprint.hz);
  },
 };
}

export function addMetroEntrances(parent) {
 const group = new T.Group();
 const metal = material('#344b4b', .43, .65);
 const stone = material('#778481');
 parent.add(group);
 for (const point of metroEntrances) {
  const entrance = new T.Group();
  entrance.position.set(point.x, 12.06, point.z);
  group.add(entrance);
  const sign = makeSign('M  TRIANON–MASP  ↓', 4, .55);
  sign.position.set(0, 2.65, 0);
  entrance.add(sign);
  for (const x of [-2.05, 2.05]) {
   box(entrance, x, 0, 0, .075, 2.67, .075, metal);
   box(entrance, x, .04, 0, .22, .33, 2.8, stone);
   box(entrance, x, 1.04, 0, .045, .045, 2.8, metal);
   for (const z of [-1.36, 1.36]) box(entrance, x, .35, z, .045, .73, .045, metal);
  }
  box(entrance, 0, -.035, 0, 4.12, .07, 2.8, stone);
  batchStatic(entrance);
 }
 return group;
}

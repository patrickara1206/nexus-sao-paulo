import {readFileSync, statSync} from 'node:fs';
import {join} from 'node:path';
import {Accessor, Document, NodeIO} from '@gltf-transform/core';
import {BufferGeometry, Float32BufferAttribute} from 'three';

const human = 'public/assets/human';
const source = process.argv[2];
if (!source) throw new Error('Passe o diretório clothes/male_casualsuit04 do pacote CC0 MakeHuman.');

function readObj(path) {
 const vertices = [], uvs = [], faces = [];
 let group = '';
 for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
  const [tag, ...values] = line.trim().split(/\s+/);
  if (tag === 'v') vertices.push(values.slice(0, 3).map(Number));
  if (tag === 'vt') uvs.push(values.slice(0, 2).map(Number));
  if (tag === 'g') group = values[0];
  if (tag === 'f') faces.push({group, corners: values.map(value => value.split('/').map(index => Number(index) - 1))});
 }
 return {vertices, uvs, faces};
}

function readTarget(name) {
 const target = new Map();
 for (const line of readFileSync(join(human, name + '.target'), 'utf8').split(/\r?\n/)) {
  const [index, ...delta] = line.trim().split(/\s+/).map(Number);
  if (delta.length === 3 && [index, ...delta].every(Number.isFinite)) target.set(index, delta);
 }
 return target;
}

const base = readObj(join(human, 'base.obj'));
const clothes = readObj(join(source, 'male_casualsuit04.obj'));
const female = readTarget('caucasian-female-young');
const male = readTarget('caucasian-male-young');
const bulk = readTarget('universal-male-young-averagemuscle-averageweight');
const femaleBase = base.vertices.map((position, i) => position.map((value, axis) => value + (female.get(i)?.[axis] ?? 0)));
const maleBase = base.vertices.map((position, i) =>
 position.map((value, axis) => value + (male.get(i)?.[axis] ?? 0) + (bulk.get(i)?.[axis] ?? 0)));
const bodyFaces = base.faces.filter(face => face.group === 'body');
const bodyHeights = bodyFaces.flatMap(({corners}) => corners.map(([i]) => base.vertices[i][1]));
const low = Math.min(...bodyHeights), scale = 1.78 / (Math.max(...bodyHeights) - low);
const convert = ([x, y, z]) => [x * scale, (y - low) * scale, -z * scale];

const definition = readFileSync(join(source, 'male_casualsuit04.mhclo'), 'utf8');
const [anchorsAndRules, deleted] = definition.split(/^delete_verts\s*$/m);
const [, references] = anchorsAndRules.split(/^verts 0\s*$/m);
const anchors = references.trim().split(/\r?\n/).map(line => line.trim().split(/\s+/).map(Number));
if (anchors.length !== clothes.vertices.length) throw new Error('A malha e o arquivo de ajuste têm contagens diferentes.');
const axes = ['x', 'y', 'z'].map(axis => {
 const [, first, last, baseline] = definition.match(new RegExp('^' + axis + '_scale (\\d+) (\\d+) ([\\d.]+)$', 'm'));
 return [Number(first), Number(last), Number(baseline)];
});

function fit(vertices) {
 const offsetScale = axes.map(([first, last, baseline], axis) =>
  Math.abs(vertices[first][axis] - vertices[last][axis]) / baseline);
 return anchors.map(([a, b, c, wa, wb, wc, dx, dy, dz]) => convert([dx, dy, dz].map((offset, axis) =>
  vertices[a][axis] * wa + vertices[b][axis] * wb + vertices[c][axis] * wc + offset * offsetScale[axis])));
}

const firstFit = fit(femaleBase);
const secondFit = fit(maleBase);
const covered = new Set();
for (const entry of deleted.matchAll(/(\d+)(?:\s*-\s*(\d+))?/g)) {
 for (let i = Number(entry[1]); i <= Number(entry[2] ?? entry[1]); i++) covered.add(i);
}
const hiddenBodyTriangles = [];
let triangle = 0;
for (const {corners} of bodyFaces) {
 for (let i = 1; i < corners.length - 1; i++) {
  if ([corners[0], corners[i + 1], corners[i]].every(([index]) => covered.has(index))) {
   hiddenBodyTriangles.push(triangle);
  }
  triangle++;
 }
}

// Split the two sewn pieces without cutting through their overlapping hems.
const parent = clothes.vertices.map((_, i) => i);
function component(i) {
 let root = i;
 while (parent[root] !== root) root = parent[root];
 parent[i] = root;
 return root;
}
for (const {corners} of clothes.faces) {
 const root = component(corners[0][0]);
 for (const [index] of corners) parent[component(index)] = root;
}
const pieces = Map.groupBy(clothes.faces, ({corners}) => component(corners[0][0]));
const [shirt, trousers] = [...pieces.values()].sort((a,b) => highest(b) - highest(a));
if (pieces.size !== 2) throw new Error('Esperava duas peças de roupa no modelo original.');
function highest(faces) {
 return Math.max(...faces.flatMap(({corners}) => corners.map(([index]) => clothes.vertices[index][1])));
}

const doc = new Document(), buffer = doc.createBuffer();
const scene = doc.createScene().setExtras({hiddenBodyTriangles});
const material = doc.createMaterial('Tecido fosco').setMetallicFactor(0).setRoughnessFactor(.91).setDoubleSided(true);
if (process.argv[3]) {
 const weave = doc.createTexture('Detalhes do tecido').setImage(readFileSync(process.argv[3])).setMimeType('image/jpeg');
 material.setBaseColorTexture(weave);
}
const accessor = (type, array) => doc.createAccessor().setBuffer(buffer).setType(type).setArray(array);
function normals(positions, indices) {
 const geo = new BufferGeometry().setAttribute('position', new Float32BufferAttribute(positions, 3));
 geo.setIndex(indices);
 geo.computeVertexNormals();
 return geo.attributes.normal.array;
}
function addPiece(name, faces) {
 const unique = new Map(), positions = [], endPositions = [], uvs = [], indices = [];
 for (const {corners} of faces) {
  const face = corners.map(([vertex, uv]) => {
   const key = vertex + '/' + uv;
   if (unique.has(key)) return unique.get(key);
   const index = unique.size;
   unique.set(key, index);
   positions.push(...firstFit[vertex]);
   endPositions.push(...secondFit[vertex]);
   uvs.push(clothes.uvs[uv][0], 1 - clothes.uvs[uv][1]);
   return index;
  });
  for (let i = 1; i < face.length - 1; i++) indices.push(face[0], face[i + 1], face[i]);
 }
 const startNormals = normals(positions, indices);
 const endNormals = normals(endPositions, indices);
 const float = values => accessor(Accessor.Type.VEC3, new Float32Array(values));
 const primitive = doc.createPrimitive().setMaterial(material)
  .setAttribute('POSITION', float(positions))
  .setAttribute('NORMAL', float(startNormals))
  .setAttribute('TEXCOORD_0', accessor(Accessor.Type.VEC2, new Float32Array(uvs)))
  .setIndices(accessor(Accessor.Type.SCALAR, new Uint16Array(indices)));
 primitive.addTarget(doc.createPrimitiveTarget()
  .setAttribute('POSITION', float(endPositions.map((n, i) => n - positions[i])))
  .setAttribute('NORMAL', float(endNormals.map((n, i) => n - startNormals[i]))));
 scene.addChild(doc.createNode(name).setMesh(doc.createMesh(name).addPrimitive(primitive).setWeights([0])));
}
addPiece('Shirt', shirt);
addPiece('Trousers', trousers);
const output = join(human, 'casual-outfit.glb');
await new NodeIO().write(output, doc);
console.log({maskedTriangles: hiddenBodyTriangles.length, bytes: statSync(output).size});

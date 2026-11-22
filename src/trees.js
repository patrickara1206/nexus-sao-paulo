import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

let treeAssets;
const barkMinimum = -.01747;
const treeHeight = 4.55;

// Layer photographed leaves into boughs around the existing woody mesh.
// A shared card mesh uses hundreds of triangles where the source used millions.
function crownGeometry() {
 const positions = [], uv = [], indices = [];
 const card = new T.Vector3();
 const rotation = new T.Euler(0, 0, 0, 'YXZ');
 const rings = [
  {count: 6, y: 2.66, x: .76, z: 1.02, width: 1.08, height: .82},
  {count: 9, y: 3.27, x: .93, z: 1.12, width: 1.26, height: .93},
  {count: 7, y: 3.83, x: .62, z: .81, width: 1.17, height: .81},
  {count: 3, y: 4.16, x: .32, z: .47, width: .94, height: .65},
 ];
 let branch = 0;
 for (const ring of rings) {
  for (let i = 0; i < ring.count; i++) {
   const angle = i / ring.count * 2 * Math.PI + ring.y * .93;
   const magnitude = .92 + Math.sin(branch * 1.63) * .15;
   const x = Math.cos(angle) * ring.x * magnitude + .08;
   const y = ring.y + Math.cos(branch * 1.15) * .18;
   const z = .52 + Math.sin(angle) * ring.z * magnitude;
   for (let layer = 0; layer < 4; layer++) {
    const base = positions.length / 3;
    rotation.set((layer % 2 ? .74 : -.36) + Math.sin(branch) * .23,
     angle + layer * 1.77, Math.sin(branch * 1.22 + layer) * .42, 'YXZ');
    const variant = (branch + layer) % 4;
    const u0 = (variant % 2) * .5;
    const v0 = Math.floor(variant / 2) * .5;
    for (const [u, v] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
     card.set((u - .5) * ring.width * magnitude, (v - .5) * ring.height, 0).applyEuler(rotation);
     positions.push(x + card.x, y + card.y, z + card.z);
     uv.push(u0 + .002 + u * .496, v0 + .002 + v * .496);
    }
    indices.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
   }
   branch++;
  }
 }
 const geometry = new T.BufferGeometry();
 geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
 geometry.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
 geometry.setIndex(indices);
 geometry.computeVertexNormals();
 return geometry;
}

function loadTree() {
 return treeAssets ??= Promise.all([
  new GLTFLoader().loadAsync('/assets/props/tree-bark.glb'),
  new T.TextureLoader().loadAsync('/assets/props/tree-crown.png'),
 ]).then(([model, leafTexture]) => {
  model.scene.updateMatrixWorld(true);
  const parts = [];
  model.scene.traverse(mesh => {
   if (!mesh.isMesh) return;
   parts.push({geometry: mesh.geometry.clone().applyMatrix4(mesh.matrixWorld), material: mesh.material});
  });
  leafTexture.colorSpace = T.SRGBColorSpace;
  const leaves = new T.MeshStandardMaterial({
   map: leafTexture,
   alphaTest: .42,
   alphaToCoverage: true,
   side: T.DoubleSide,
   roughness: .94,
   emissive: '#6b8a53',
   emissiveMap: leafTexture,
   emissiveIntensity: .34,
  });
  return [...parts, {geometry: crownGeometry(), material: leaves, leaves: true}];
 });
}

/**
 * Place each mapped trunk at its surveyed/map position. The available assets
 * approximate canopy form and appearance; they are not scans of those trees.
 */
export function createTrees(locations, groundAt = () => 12) {
 const root = new T.Group();
 root.name = 'Árvores com copas de folhagem';
 if (!locations.length) return {root, ready: Promise.resolve(0)};
 const ready = loadTree().then(parts => {
  const cells = new Map();
  for (const [index, location] of locations.entries()) {
   const key = `${Math.floor(location.x / 110)},${Math.floor(location.z / 110)}`;
   if (!cells.has(key)) cells.set(key, []);
   cells.get(key).push({location, index});
  }
  const transform = new T.Object3D();
  const leafTint = new T.Color();
  for (const group of cells.values()) {
   const instances = parts.map(({geometry, material}) => new T.InstancedMesh(geometry, material, group.length));
   for (const [i, {location, index}] of group.entries()) {
    const {x, z, mapped} = location;
    const height = Number.isFinite(location.height) && location.height > 0
     ? location.height
     : (mapped ? 10 : 7) + (index * 37 % 71) * .088;
    const scale = height / treeHeight;
    transform.position.set(x, groundAt(x, z) - barkMinimum * scale, z);
    transform.rotation.y = index * 2.399963;
    transform.scale.set(scale * (.83 + (index % 6) * .062), scale, scale);
    transform.updateMatrix();
    for (const [part, mesh] of instances.entries()) {
     mesh.setMatrixAt(i, transform.matrix);
     if (parts[part].leaves) {
      leafTint.setRGB(.86 + index % 7 * .027, .9 + index % 5 * .023, .79 + index % 6 * .035);
      mesh.setColorAt(i, leafTint);
     }
    }
   }
   for (const mesh of instances) {
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.computeBoundingBox();
    mesh.computeBoundingSphere();
    root.add(mesh);
   }
  }
  return locations.length;
 }).catch(error => {
  console.warn('Não foi possível carregar a vegetação.', error);
  return 0;
 });
 return {root, ready};
}

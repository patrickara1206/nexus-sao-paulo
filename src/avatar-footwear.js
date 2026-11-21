import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// One mesh per foot. Model units are meters, with the toe pointing toward -Z.
const outline = [
  [-.021, -.241], [.018, -.240], [.041, -.227], [.055, -.198],
  [.060, -.160], [.057, -.115], [.049, -.065], [.049, -.013],
  [.048, .031], [.037, .053], [.013, .062], [-.022, .061],
  [-.040, .048], [-.048, .022], [-.048, -.026], [-.044, -.069],
  [-.049, -.112], [-.055, -.158], [-.052, -.200], [-.043, -.225],
];

const palette = {
  tread: '#262623',
  rubber: '#d6ccad',
  seam: '#59554b',
  upper: '#363835',
  counter: '#292d2a',
  tongue: '#484943',
  laces: '#d6ceb8',
};

function loft(rings, colorAt) {
  const positions = [];
  const colors = [];
  const sides = rings[0].length;
  for (let row = 0; row < rings.length; row++) {
    const ring = rings[row];
    ring.forEach((point, column) => {
      positions.push(...point);
      const color = new THREE.Color(colorAt(row, column));
      colors.push(color.r, color.g, color.b);
    });
  }
  const indices = [];
  for (let row = 1; row < rings.length; row++) {
    for (let i = 0; i < sides; i++) {
      const low = (row - 1) * sides;
      const high = row * sides;
      const next = (i + 1) % sides;
      indices.push(low + next, low + i, high + i, low + next, high + i, high + next);
    }
  }
  const last = (rings.length - 1) * sides;
  for (let i = 1; i < sides - 1; i++) indices.push(0, i, i + 1, last, last + i + 1, last + i);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function ring(width, length, height) {
  return outline.map(([x, z]) => [x * width, height, (z + .087) * length - .087]);
}

function colored(geometry, shade) {
  const color = new THREE.Color(shade);
  const colors = new Float32Array(geometry.attributes.position.count * 3);
  for (let i = 0; i < colors.length; i += 3) color.toArray(colors, i);
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
}

function laceCurve(upper, from, to) {
  const ray = new THREE.Raycaster();
  const down = new THREE.Vector3(0, -1, 0);
  const points = Array.from({length: 5}, (_, index) => {
    const progress = index / 4;
    const x = THREE.MathUtils.lerp(from[0], to[0], progress);
    const z = THREE.MathUtils.lerp(from[1], to[1], progress);
    ray.set(new THREE.Vector3(x, 1, z), down);
    const surface = ray.intersectObject(upper)[0];
    const lift = .0015 + .001 * Math.sin(progress * Math.PI);
    return new THREE.Vector3(x, (surface?.point.y ?? .06) + lift, z);
  });
  return new THREE.CatmullRomCurve3(points);
}

function makeSneaker() {
  const soleColors = [palette.tread, palette.tread, palette.rubber, palette.rubber, palette.seam];
  const sole = loft(
    [ring(.89, .96, -.004), ring(1, 1, .001), ring(1.018, 1.008, .007), ring(1.006, 1.004, .026), ring(.94, .98, .032)],
    row => soleColors[row]
  );
  const upper = loft([
    ring(.93, .98, .026),
    outline.map(([x, z]) => [x * .94, .043 + .041 * THREE.MathUtils.smoothstep(z, -.21, -.025), z * .965]),
    outline.map(([x, z]) => [x * .83, .055 + .052 * THREE.MathUtils.smoothstep(z, -.205, -.023), z * .87 + .001]),
    outline.map(([x, z]) => [x * .66, .094 + .018 * THREE.MathUtils.smoothstep(-z, .015, .22), z * .28 + .018]),
  ], (row, column) => column >= 7 && column <= 14 ? palette.counter : row === 3 ? palette.tongue : palette.upper);
  const details = [];
  const probeMaterial = new THREE.MeshBasicMaterial();
  const probe = new THREE.Mesh(upper, probeMaterial);
  for (let i = 0; i < 5; i++) {
    const z = -.144 + i * .014;
    const curve = laceCurve(probe, [-.027, z], [.024, z + .006]);
    details.push(colored(new THREE.TubeGeometry(curve, 6, .0022, 5, false), palette.laces));
  }
  // Close to the collar, the loose lace ends curve gently toward the toe.
  const knot = [-.005, -.075];
  for (const end of [[-.024, -.100], [.021, -.104]]) {
    const curve = laceCurve(probe, knot, end);
    details.push(colored(new THREE.TubeGeometry(curve, 6, .002, 5, false), palette.laces));
  }
  probeMaterial.dispose();
  const pieces = [sole, upper, ...details];
  const geometry = mergeGeometries(pieces.map(piece => {
    piece.deleteAttribute('uv');
    return piece;
  }));
  pieces.forEach(piece => piece.dispose());
  const material = new THREE.MeshStandardMaterial({vertexColors: true, roughness: .88});
  return {geometry, material};
}

let sharedSneaker;

export function createAvatarFootwear() {
  const root = new THREE.Group();
  root.name = 'Sneakers';
  sharedSneaker ??= makeSneaker();
  const feet = [-1, 1].map(side => {
    const pivot = new THREE.Group();
    const mesh = new THREE.Mesh(sharedSneaker.geometry, sharedSneaker.material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    pivot.add(mesh);
    root.add(pivot);
    return {pivot, mesh, side};
  });

  return {
    root,
    fit(body) {
      const shape = THREE.MathUtils.clamp(body, 0, 1);
      for (const {pivot, mesh, side} of feet) {
        pivot.position.x = side * THREE.MathUtils.lerp(.190, .204, shape);
        mesh.position.set(0, -.88, 0);
        mesh.scale.set(side, 1, THREE.MathUtils.lerp(.96, 1, shape));
      }
    },
    pose(phase, movement) {
      const lift = Math.abs(Math.sin(phase)) * movement * .025;
      for (const {pivot, side} of feet) {
        pivot.position.y = .88 + lift;
        pivot.rotation.x = Math.sin(phase + (side > 0 ? Math.PI : 0)) * .42 * movement;
      }
    },
    dispose() {
      // Other avatars reuse the shared mesh and material.
      root.removeFromParent();
    },
  };
}

import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {roadRecords, segmentDistance} from './geography.js';
import {makeTrafficLight} from './lab.js';
import {paulistaRoutes, paulistaCrossings, signalTarget, surfaceRoadWidth} from './street-layout.js';
import {routeDistance, sampleRoute, signalPhase, stepDrive} from './transport-math.js';

const HALF_LENGTH = 2.25;
const HALF_WIDTH = .92;
const cellSize = 32;

function driveableRoads() {
 const cells = new Map();
 for (const road of roadRecords) {
  if (road.tunnel || road.layer < 0 || !road.points.some(([x, z]) => Math.hypot(x, z) < 550)) continue;
  const radius = surfaceRoadWidth(road) / 2 - .4;
  for (let index = 1; index < road.points.length; index++) {
   const a = road.points[index - 1];
   const b = road.points[index];
   const segment = {a, b, radius};
   for (let x = Math.floor((Math.min(a[0], b[0]) - radius) / cellSize);
    x <= Math.floor((Math.max(a[0], b[0]) + radius) / cellSize); x++) {
    for (let z = Math.floor((Math.min(a[1], b[1]) - radius) / cellSize);
     z <= Math.floor((Math.max(a[1], b[1]) + radius) / cellSize); z++) {
     const key = x + ',' + z;
     if (!cells.has(key)) cells.set(key, []);
     cells.get(key).push(segment);
    }
   }
  }
 }
 return (x, z) => (cells.get(Math.floor(x / cellSize) + ',' + Math.floor(z / cellSize)) || []).some(
  ({a, b, radius}) => segmentDistance(x, z, a, b) < radius
 );
}

function carContains(car, x, z, margin = .3) {
 const dx = x - car.x;
 const dz = z - car.z;
 const sin = Math.sin(car.yaw);
 const cos = Math.cos(car.yaw);
 return Math.abs(dx * sin + dz * cos) < HALF_LENGTH + margin
  && Math.abs(dx * cos - dz * sin) < HALF_WIDTH + margin;
}

function carsOverlap(a, b) {
 const aSin = Math.sin(a.yaw), aCos = Math.cos(a.yaw);
 const bSin = Math.sin(b.yaw), bCos = Math.cos(b.yaw);
 const dx = a.x - b.x, dz = a.z - b.z;
 const parallel = Math.abs(aSin * bSin + aCos * bCos);
 const perpendicular = Math.abs(aSin * bCos - aCos * bSin);
 const lengthLimit = HALF_LENGTH * (1 + parallel) + HALF_WIDTH * perpendicular;
 const widthLimit = HALF_WIDTH * (1 + parallel) + HALF_LENGTH * perpendicular;
 return Math.abs(dx * aSin + dz * aCos) < lengthLimit
  && Math.abs(dx * bSin + dz * bCos) < lengthLimit
  && Math.abs(dx * aCos - dz * aSin) < widthLimit
  && Math.abs(dx * bCos - dz * bSin) < widthLimit;
}

export function createVehicles(parent, spawn) {
 const root = new T.Group();
 root.name = 'Road traffic and player car';
 parent.add(root);
 const routes = paulistaRoutes.filter(route => routeDistance(route, spawn.x, spawn.z).distance < 60);
 const onRoad = driveableRoads();
 const cars = [];
 const own = {x: spawn.x, z: spawn.z, yaw: 0, speed: 0, model: null};
 let template = null, elapsed = 0, error = null, pedestrians = [];
 const parking = routes.map(route => ({route, ...routeDistance(route, spawn.x, spawn.z)}))
  .sort((a, b) => a.distance - b.distance)[0];
 const parkedPose = parking ? sampleRoute(parking.route, parking.along + 9, -4.4) : {};
 Object.assign(own, parkedPose);
 const palette = ['#d7d8d4', '#1d242b', '#9c2923', '#78858d', '#b6aaa0', '#343c48'];
 const trafficOffsets = [-1.55, 1.55, 4.7];

 function instance(color) {
  const group = template.clone(true);
  group.traverse(mesh => {
   if (!mesh.isMesh) return;
   mesh.castShadow = true;
   mesh.receiveShadow = true;
   if (mesh.material.name === 'paint') {
    mesh.material = mesh.material.clone();
    mesh.material.color.set(color);
   }
  });
  root.add(group);
  return group;
 }

 function place(car) {
  car.model.position.set(car.x, car.y ?? 12.08, car.z);
  car.model.rotation.y = car.yaw;
 }

 const ready = new GLTFLoader().loadAsync('/assets/vehicles/sedan-road.glb').then(g => {
  template = new T.Group();
  const model = g.scene;
  model.traverse(mesh => {
   if (!mesh.isMesh) return;
   const original = mesh.material;
   const material = new T.MeshStandardMaterial({
    name: original.name, color: original.color, map: original.map, roughness: original.roughness,
    metalness: original.metalness, normalMap: original.normalMap, side: T.FrontSide
   });
   if (material.name === 'paint') material.map = null;
   if (material.name.includes('glass')) {
    material.color.set('#34505c');
    material.roughness = .2;
    material.metalness = .45;
   }
   if (material.name === 'clearlens') {
    material.emissive.set('#ffe1a0');
    material.emissiveIntensity = .3;
   }
   mesh.material = material;
  });
  model.rotation.y = Math.PI / 2;
  template.add(model);
  template.updateMatrixWorld(true);
  model.position.y -= new T.Box3().setFromObject(template).min.y;
  own.model = instance('#3c596d');
  place(own);
  routes.forEach((route, routeIndex) => {
   const center = routeDistance(route, spawn.x, spawn.z).along;
   const start = Math.max(0, center - 780);
   const end = Math.min(route.length, center + 780);
   for (let index = 0; index < 6; index++) {
    const along = start + (end - start) * (index + .4 + routeIndex * .2) / 6;
    const offset = trafficOffsets[index % trafficOffsets.length];
    const vehicle = {
     route, along, offset, start, end, speed: 0, cruise: 7.5 + (index % 3) * .6,
     model: instance(palette[(index + routeIndex * 2) % palette.length])
    };
    Object.assign(vehicle, sampleRoute(route, along, offset));
    cars.push(vehicle);
    place(vehicle);
   }
  });
 }).catch(reason => {
  error = reason.message;
  console.error('Vehicle asset failed to load', reason);
 });

 const signals = paulistaCrossings.filter(crossing => routes.includes(crossing.route)).map(crossing => {
  const pole = sampleRoute(crossing.route, crossing.stop + 4, -7.35);
  const light = makeTrafficLight(root, pole.x, pole.z);
  // The right-side pole overhangs the lane, and its lamps face approaching traffic.
  light.root.rotation.y = pole.yaw;
  light.update(0, signalPhase(crossing.phaseOffset));
  return {...crossing, light};
 });

 function update(dt, {active, obstacles = []} = {}) {
  if (!active || !template) return;
  elapsed += dt;
  pedestrians = obstacles;
  for (const signal of signals) signal.light.update(elapsed, signalPhase(elapsed + signal.phaseOffset));
  const physicalObstacles = [...obstacles, own];
  for (const car of cars) {
   let target = car.cruise, limit = Infinity;
   const nextSignal = signals.find(signal => {
    const distance = signal.stop - HALF_LENGTH - .6 - car.along;
    return signal.route === car.route && distance >= -.001 && distance < 40;
   });
   if (nextSignal) {
    const distance = Math.max(0, nextSignal.stop - HALF_LENGTH - .6 - car.along);
    const restriction = signalTarget(car.speed, distance, signalPhase(elapsed + nextSignal.phaseOffset));
    target = Math.min(target, restriction.speed);
    if (restriction.stop) limit = distance;
   }
   for (const other of cars) {
    if (other === car || other.route !== car.route || other.offset !== car.offset) continue;
    const gap = other.along - car.along;
    if (gap > 0 && gap < 28) target = Math.min(target, Math.max(0, (gap - 6.5) * .6));
   }
   for (const point of physicalObstacles) {
    const dx = point.x - car.x, dz = point.z - car.z;
    const ahead = dx * car.dx + dz * car.dz;
    const side = Math.abs(dx * car.dz - dz * car.dx);
    if (ahead > 0 && ahead < 22 && side < (point === own ? 2.25 : 1.4)) {
     target = Math.min(target, Math.max(0, (ahead - (point === own ? 6.5 : 4)) * .6));
    }
   }
   car.speed += T.MathUtils.clamp(target - car.speed, -dt * 8, dt * 2.3);
   const step = Math.max(0, car.speed) * dt;
   const nextAlong = car.along + Math.min(step, limit);
   if (limit <= step) car.speed = 0;
   // Both ends of the loop are beyond the player's movement boundary.
   const along = nextAlong > car.end ? car.start : nextAlong;
   const pose = sampleRoute(car.route, along, car.offset);
   if (carsOverlap(pose, own) && !carsOverlap(car, own)) {
    car.speed = 0;
    continue;
   }
   Object.assign(car, pose, {along});
   place(car);
  }
  place(own);
 }

 return {
  root, own, cars, routes, ready, update,
  get error() { return error; },
  get phase() { return signalPhase(elapsed); },
  get elapsed() { return elapsed; },
  drive(input, dt, allowed, underground = false) {
   const next = stepDrive(own, input, dt);
   const validSurface = underground || (
    onRoad(next.x, next.z) && !cars.some(car => carsOverlap(car, next))
    && !pedestrians.some(point => carContains(next, point.x, point.z) && !carContains(own, point.x, point.z))
   );
   if (allowed(next.x, next.z) && validSurface) Object.assign(own, next);
   else own.speed = 0;
   place(own);
   return own;
  },
  exitPoint(allowed) {
   for (const sign of [1, -1]) {
    const x = own.x + Math.cos(own.yaw) * sign * 2.2;
    const z = own.z - Math.sin(own.yaw) * sign * 2.2;
    if (allowed(x, z) && !cars.some(car => carContains(car, x, z, .65))) return {x, z, y: 12};
   }
   return null;
  },
  blocks(x, z) {
   return [...cars, own].some(car => car.model && carContains(car, x, z));
  },
  reset() {
   Object.assign(own, parkedPose, {speed: 0});
   if (own.model) place(own);
  }
 };
}

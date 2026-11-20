import * as T from 'three';
import {pbrMaterial} from './lab.js';
import {batchStatic} from './scene-batching.js';
import source from './transport-source.json' with {type:'json'};
import {project} from './geography.js';
import {makeRoute, sampleRoute, routeDistance} from './transport-math.js';
import {makeSign} from './metro.js';
import {sweepTunnelSection} from './tunnel-geometry.js';

const liningRadius = 4.8;
const springHeight = 1.5;
const fixtureSpacing = 14;
const unitBox = new T.BoxGeometry(1, 1, 1);
const tunnelProfile = Array.from({length: 25}, (_, i) => {
 const angle = Math.PI * (1 - i / 24);
 return [Math.cos(angle) * liningRadius, springHeight + Math.sin(angle) * liningRadius];
});
tunnelProfile.unshift([-liningRadius, 0]);
tunnelProfile.push([liningRadius, 0]);

function box(parent, x, y, z, w, h, d, material, yaw = 0) {
 const mesh = new T.Mesh(unitBox, material);
 mesh.position.set(x, y, z);
 mesh.scale.set(w, h, d);
 mesh.rotation.y = yaw;
 parent.add(mesh);
 return mesh;
}

function surface(parent, route, section, material, options) {
 parent.add(new T.Mesh(sweepTunnelSection(route, section, options), material));
}

function addBore(parent, route, materials) {
 const {concrete, road, walkway, liner, steel, lamp, paint, edgePaint} = materials;
 surface(parent, route, tunnelProfile, concrete, {reverse: true, repeat: 3.7});
 surface(parent, route, [[-4.82, 0], [4.82, 0]], road, {repeat: 4.4});
 // Short upstands and ceramic panels give the vault a legible base.
 surface(parent, route, [[-4.79, .12], [-3.86, .12], [-3.81, 0]], walkway, {repeat: 1.5});
 surface(parent, route, [[3.81, 0], [3.86, .12], [4.79, .12]], walkway, {repeat: 1.5});
 surface(parent, route, [[-4.77, .08], [-4.77, 1.47]], liner, {reverse: true, repeat: 1.4});
 surface(parent, route, [[4.77, 1.47], [4.77, .08]], liner, {reverse: true, repeat: 1.4});
 for (const lateral of [-3.7, 3.7]) {
  surface(parent, route, [[lateral - .04, .014], [lateral + .04, .014]], edgePaint);
 }

 for (let distance = 5; distance + 4 < route.length; distance += 12) {
  const point = sampleRoute(route, distance);
  box(parent, point.x, .013, point.z, .11, .012, 4, paint, point.yaw);
 }

 const fixtures = [];
 for (let distance = 4; distance < route.length; distance += fixtureSpacing) {
  const point = sampleRoute(route, distance, 2.55);
  box(parent, point.x, 5.19, point.z, .48, .14, 2.08, steel, point.yaw);
  box(parent, point.x, 5.10, point.z, .38, .08, 1.84, lamp, point.yaw);
  fixtures.push({...point, y: 4.9, along: distance});
 }

 for (let distance = 25; distance < route.length - 10; distance += 82) {
  const point = sampleRoute(route, distance, 4.71);
  const sign = makeSign('SAÍDA ↑', .85, .29, '#116148');
  sign.position.set(point.x, 1.92, point.z);
  sign.rotation.y = point.yaw - Math.PI / 2;
  parent.add(sign);
  box(parent, point.x, .78, point.z + .5, .14, .78, .49, materials.cabinet, point.yaw);
 }
 return fixtures;
}

export function createTunnels(scene) {
 const root = new T.Group();
 root.visible = false;
 root.name = 'Nove de Julho tunnel study';
 root.userData.colliders = [];
 scene.add(root);

 const routes = source.ways.filter(way => way.tags.highway).map(way => {
  const route = makeRoute(way.points.map(([lon, lat]) => {
   const {x, z} = project(lat, lon);
   return [x, z];
  }));
  return {...route, id: way.id, name: way.tags['tunnel:name'] || 'Túnel Nove de Julho'};
 });

 const concrete = pbrMaterial('concrete_pavement');
 concrete.color.set('#909891');
 concrete.normalScale.set(.5, .5);
 const road = pbrMaterial('asphalt_02');
 road.color.set('#b9beb9');
 road.normalScale.set(.48, .48);
 const walkway = pbrMaterial('concrete_pavement');
 walkway.color.set('#aaa597');
 const liner = pbrMaterial('concrete_pavement');
 liner.color.set('#b9bdb0');
 liner.normalScale.set(.18, .18);
 const materials = {
  concrete, road, walkway, liner,
  steel: new T.MeshStandardMaterial({color: '#333f3c', roughness: .59, metalness: .6}),
  lamp: new T.MeshBasicMaterial({color: '#fff4d3', toneMapped: false}),
  paint: new T.MeshStandardMaterial({color: '#ece8d3', roughness: .87}),
  edgePaint: new T.MeshStandardMaterial({color: '#b9b099', roughness: .88}),
  cabinet: new T.MeshStandardMaterial({color: '#81473a', roughness: .67}),
 };
 const fixturesByRoute = routes.map(route => addBore(root, route, materials));
 batchStatic(root);
 root.add(new T.HemisphereLight('#c3c9c4', '#4d514c', .58));

 const localLights = Array.from({length: 3}, () => {
  const light = new T.PointLight('#fff1d1', 128, 29, 2);
  root.add(light);
  return light;
 });
 const portals = routes.flatMap((route, i) => [0, route.length].map((distance, end) => ({
  ...sampleRoute(route, distance), route: i, end, name: 'Túnel Nove de Julho', type: 'tunnel',
 })));

 return {
  root, routes, portals, source,
  update(player) {
   const sections = routes.map((route, index) => ({...routeDistance(route, player.x, player.z), index}));
   const nearest = sections.reduce((a, b) => a.distance < b.distance ? a : b);
   const fixtures = fixturesByRoute[nearest.index];
   const center = Math.round((nearest.along - 4) / fixtureSpacing);
   localLights.forEach((light, index) => {
    const fixture = fixtures[center + index - 1];
    light.intensity = fixture ? 128 : 0;
    if (fixture) light.position.set(fixture.x, fixture.y, fixture.z);
   });
  },
  canMove(x, z) {
   return routes.some(route => routeDistance(route, x, z).distance < 3.9);
  },
  entry(portal) {
   const route = routes[portal.route];
   const point = sampleRoute(route, portal.end ? route.length - 12 : 12);
   return {...point, y: 0, yaw: point.yaw + (portal.end ? Math.PI : 0)};
  },
  nearestPortal(x, z) {
   return portals.reduce((nearest, candidate) =>
    Math.hypot(x - candidate.x, z - candidate.z) < Math.hypot(x - nearest.x, z - nearest.z) ? candidate : nearest);
  },
 };
}

export function addTunnelPortals(parent, tunnels) {
 const group = new T.Group();
 const metal = new T.MeshStandardMaterial({color: '#435357', metalness: .55, roughness: .49});
 parent.add(group);
 for (const portal of tunnels.portals) {
  const frame = new T.Group();
  frame.rotation.y = portal.yaw;
  frame.position.set(portal.x, 12, portal.z);
  group.add(frame);
  const sign = makeSign('TÚNEL NOVE DE JULHO ↓', 7, .7, '#385c54');
  sign.position.y = 4.75;
  frame.add(sign);
  for (const x of [-3.7, 3.7]) box(frame, x, 2.38, 0, .1, 4.75, .1, metal);
  box(frame, 0, 4.75, -.05, 7.5, .085, .085, metal);
 }
 return group;
}

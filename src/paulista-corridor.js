import {inTrianon, roadRecords, segmentDistance, trianonPolygons} from './geography.js';
import {paulistaRoutes} from './street-layout.js';
import {routeDistance, sampleRoute} from './transport-math.js';

const roadRadius = 155;
const sceneryRadius = 245;
const line = paulistaRoutes.flatMap(route => route.points);
const extrema = (index, pad) => {
 const values = line.map(point => point[index]);
 return [Math.min(...values) - pad, Math.max(...values) + pad];
};
const [minX, maxX] = extrema(0, roadRadius);
const [minZ, maxZ] = extrema(1, roadRadius);
export const paulistaBounds = {minX, maxX, minZ, maxZ};
export const paulistaRouteLength = Math.max(...paulistaRoutes.map(route => route.length));
export const paulistaCycleways = [];
for (let d = 3, points = []; d < paulistaRoutes[0].length; d += 4) {
 const a = sampleRoute(paulistaRoutes[0], d);
 const nearest = routeDistance(paulistaRoutes[1], a.x, a.z);
 if (nearest.distance < 16 || nearest.distance > 33) {
  if (points.length > 1) paulistaCycleways.push(points);
  points = [];
  continue;
 }
 const b = sampleRoute(paulistaRoutes[1], nearest.along);
 points.push([(a.x + b.x) / 2, (a.z + b.z) / 2]);
 if (points.length > 1 && d + 4 >= paulistaRoutes[0].length) paulistaCycleways.push(points);
}

export const paulistaEndPoints = [
 {id:'oswaldo-cruz', name:'Praça Oswaldo Cruz', x:1205, z:1100, routeFrom:26},
 {id:'praca-dos-arcos', name:'Praça dos Arcos', x:-857, z:-780, routeFrom:paulistaRouteLength-21},
].map(point => ({...point, source:'https://prefeitura.sp.gov.br/w/noticia/ciclovia-da-avenida-paulista-ganha-sinalizacao-de-orientacao-aos-ciclistas'}));

// Both carriageways use the same level datum. Street positions are in the
// project's WGS84 tangent frame; the width of the walkable band is gameplay.
export function distanceToPaulista(x, z) {
 return Math.min(...paulistaRoutes.map(route => routeDistance(route, x, z).distance));
}

export function inPaulistaCorridor(x, z) {
 return distanceToPaulista(x, z) < roadRadius || inTrianon(x, z);
}

const parkEdges = trianonPolygons.flatMap(points => points.slice(1).map((point, i) => [points[i], point]));
const nearPark = (x, z) => {
 if (Math.abs(x) > 430 || Math.abs(z) > 390) return false;
 return inTrianon(x, z) || parkEdges.some(([a, b]) => segmentDistance(x, z, a, b) < 108);
};

export const paulistaRoads = roadRecords.flatMap(road => {
 if (road.tunnel || road.layer < 0) return [];
 if (road.name === 'Avenida Paulista') return [road];
 const clipped = [];
 let points = [];
 for (let i = 1; i < road.points.length; i++) {
  const a = road.points[i - 1], b = road.points[i];
  const x = (a[0] + b[0]) / 2, z = (a[1] + b[1]) / 2;
  const margin = Math.hypot(b[0] - a[0], b[1] - a[1]) / 2;
  const pad = sceneryRadius + margin;
  const inBounds = x > minX - pad && x < maxX + pad && z > minZ - pad && z < maxZ + pad;
  if (inBounds && (distanceToPaulista(x, z) < pad || nearPark(x, z))) {
   if (!points.length) points.push(a);
   points.push(b);
  } else if (points.length) {
   clipped.push({...road, points});
   points = [];
  }
 }
 if (points.length) clipped.push({...road, points});
 return clipped;
});

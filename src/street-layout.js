import {roadRecords} from './geography.js';
import {joinRoads, sampleRoute} from './transport-math.js';

export const PAULISTA_WIDTH = 13;
export const PAULISTA_ROUTE_NAME = 'Avenida Paulista';
export const paulistaRoutes = joinRoads(roadRecords.filter(road =>
 road.name === PAULISTA_ROUTE_NAME && !road.tunnel && road.layer >= 0
)).slice(0, 2);

function intersect(a, b, c, d) {
 const ab = [b[0] - a[0], b[1] - a[1]];
 const cd = [d[0] - c[0], d[1] - c[1]];
 const cross = (u, v) => u[0] * v[1] - u[1] * v[0];
 const denominator = cross(ab, cd);
 if (Math.abs(denominator) < .001) return null;
 const ac = [c[0] - a[0], c[1] - a[1]];
 const t = cross(ac, cd) / denominator;
 const u = cross(ac, ab) / denominator;
 return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? t : null;
}

const crossingNames = ['Rua Peixoto Gomide', 'Alameda Casa Branca', 'Rua Pamplona'];

export const paulistaCrossings = crossingNames.flatMap((name, index) => {
 const crossStreets = roadRecords.filter(road => road.name === name && !road.tunnel && road.layer === 0);
 return paulistaRoutes.flatMap(route => {
  const hits = [];
  for (let i = 1; i < route.points.length; i++) {
   const a = route.points[i - 1];
   const b = route.points[i];
   for (const street of crossStreets) {
    for (let j = 1; j < street.points.length; j++) {
     const t = intersect(a, b, street.points[j - 1], street.points[j]);
     if (t !== null) hits.push(route.lengths[i - 1] + (route.lengths[i] - route.lengths[i - 1]) * t);
    }
   }
  }
  if (!hits.length) return [];
  const along = hits.sort((a, b) => a - b)[0];
  const point = sampleRoute(route, along);
  if (Math.hypot(point.x, point.z) > 525) return [];
  // Positions use the mapped intersection. Paint and timing are a gameplay approximation.
  return [{name, route, along, stop: along - 10, phaseOffset: index * 5}];
 });
});

export function nearPaulistaCrossing(route, along, clearance = 8) {
 return paulistaCrossings.some(crossing => crossing.route === route && Math.abs(crossing.along - along) < clearance);
}

export function surfaceRoadWidth(road) {
 if (road.name === PAULISTA_ROUTE_NAME) return PAULISTA_WIDTH;
 return road.kind === 'primary' ? 14 : 8;
}

export function signalTarget(speed, distance, phase) {
 const braking = 3;
 // Distance measures from the front bumper to the stop line, minus safety clearance.
 if (distance < 0 || phase === 'green') return {speed: Infinity, stop: false};
 const comfortableStop = speed * speed / (2 * braking);
 if (phase === 'amber' && comfortableStop > distance + 1) return {speed: Infinity, stop: false};
 return {speed: Math.sqrt(2 * braking * distance), stop: true};
}

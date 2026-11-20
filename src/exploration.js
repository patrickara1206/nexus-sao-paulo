import {roadRecords, inTrianon} from './geography.js';
import {joinRoads, routeDistance, sampleRoute} from './transport-math.js';

const sidewalkRoutes = joinRoads(
  roadRecords.filter(road => road.name === 'Avenida Paulista' && !road.tunnel && road.layer >= 0)
).slice(0, 2);

// Use the outside edge of each mapped carriageway instead of crossing lanes at random.
export function paulistaPedestrianPath(spawn, index, isWalkable) {
  const route = sidewalkRoutes[index % sidewalkRoutes.length];
  if (!route) return [];
  const center = routeDistance(route, spawn.x, spawn.z).along;
  const origin = center + ((index % 5) - 2) * 16;
  const path = [];
  for (let distance = origin - 9; distance <= origin + 9; distance += 1.5) {
    const point = sampleRoute(route, distance, -8.75);
    if (!isWalkable(point.x, point.z) || inTrianon(point.x, point.z)) break;
    path.push(point);
  }
  return path.length > 1 ? path : [];
}

export function walkSidewalk(path, seconds, index) {
  const last = path.length - 1;
  const progress = (seconds * 0.95 + index * 1.37) % (last * 2);
  const back = progress >= last;
  const indexAlong = back ? last * 2 - progress : progress;
  const lower = Math.min(last - 1, Math.floor(indexAlong));
  const fraction = indexAlong - lower;
  const from = path[lower];
  const to = path[lower + 1];
  const direction = back ? -1 : 1;
  return {
    x: from.x + (to.x - from.x) * fraction,
    z: from.z + (to.z - from.z) * fraction,
    yaw: Math.atan2((from.x - to.x) * direction, (from.z - to.z) * direction),
  };
}

// Resolve a blocked diagonal along the remaining free axis.
export function slideStep(x, z, dx, dz, isWalkable) {
  if (isWalkable(x + dx, z + dz)) return {x: x + dx, z: z + dz};
  if (dx && isWalkable(x + dx, z)) return {x: x + dx, z};
  if (dz && isWalkable(x, z + dz)) return {x, z: z + dz};
  return {x, z};
}

export function approachAngle(current, target, fraction) {
  const difference = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + difference * fraction;
}

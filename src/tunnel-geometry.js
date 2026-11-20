import * as T from 'three';

// A shared ring at every route vertex closes seams between straight sections.
export function sweepTunnelSection(route, section, {repeat = 3, reverse = false} = {}) {
 const locations = [];
 const uvs = [];
 const indices = [];
 const sectionLengths = [0];
 const directions = route.points.slice(1).map(([x, z], i) => {
  const [px, pz] = route.points[i];
  return new T.Vector2(x - px, z - pz).normalize();
 });

 for (let i = 1; i < section.length; i++) {
  sectionLengths.push(sectionLengths[i - 1] + Math.hypot(section[i][0] - section[i - 1][0], section[i][1] - section[i - 1][1]));
 }

 for (let i = 0; i < route.points.length; i++) {
  const [x, z] = route.points[i];
  const before = directions[Math.max(0, i - 1)];
  const after = directions[Math.min(i, directions.length - 1)];
  const middle = before.clone().add(after).normalize();
  const miter = 1 / Math.max(0.75, middle.dot(after));
  const lateral = new T.Vector2(middle.y, -middle.x).multiplyScalar(miter);

  section.forEach(([offset, height], j) => {
   locations.push(x + offset * lateral.x, height, z + offset * lateral.y);
   uvs.push(sectionLengths[j] / repeat, route.lengths[i] / repeat);
  });

  if (i === 0) continue;
  for (let j = 0; j < section.length - 1; j++) {
   const a = (i - 1) * section.length + j;
   const b = a + section.length;
   if (reverse) indices.push(a, a + 1, b, a + 1, b + 1, b);
   else indices.push(a, b, a + 1, a + 1, b, b + 1);
  }
 }

 const geometry = new T.BufferGeometry();
 geometry.setAttribute('position', new T.Float32BufferAttribute(locations, 3));
 geometry.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2));
 geometry.setIndex(indices);
 geometry.computeVertexNormals();
 geometry.computeBoundingSphere();
 return geometry;
}

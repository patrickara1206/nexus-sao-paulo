import {test} from 'node:test';
import assert from 'node:assert/strict';
import {slideStep, approachAngle, paulistaPedestrianPath, walkSidewalk} from '../src/exploration.js';
import {paulistaSpawn} from '../src/paulista.js';

test('walking slides along a clear wall and stops if both axes are blocked', () => {
  const solidWall = x => x < 1;
  assert.deepEqual(slideStep(.9, 5, .2, .4, solidWall), {x: .9, z: 5.4});
  assert.deepEqual(slideStep(.9, 5, .2, .4, (x, z) => x < 1 && z <= 5), {x: .9, z: 5});
  assert.ok(Math.abs(approachAngle(Math.PI - .1, -Math.PI + .1, .5) - Math.PI) < 1e-9);
});

test('pedestrians turn back along their sidewalk path without jumping to its start', () => {
  const path = paulistaPedestrianPath(paulistaSpawn, 0, () => true);
  assert.ok(path.length > 2);
  const turn = (path.length - 1) / .95;
  const before = walkSidewalk(path, turn - .01, 0);
  const after = walkSidewalk(path, turn + .01, 0);
  assert.ok(Math.hypot(before.x - after.x, before.z - after.z) < .05);
  assert.ok(Math.cos(before.yaw - after.yaw) < -.99);
});

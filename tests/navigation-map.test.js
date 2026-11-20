import assert from 'node:assert/strict';
import test from 'node:test';
import {mapIncludes, navigationInfo} from '../src/navigation-map.js';

test('map guidance follows north-up São Paulo coordinates and actual projected distances', () => {
  const origin = {x: -140, z: 250};
  const north = navigationInfo(origin, {x: -140, z: 210});
  assert.equal(north.bearing, 0);
  assert.equal(north.distanceLabel, '40 m');

  const southeast = navigationInfo(origin, {x: 760, z: 1150});
  assert.equal(southeast.cardinal, 'SE');
  assert.equal(southeast.bearing, 135);
  assert.equal(southeast.distanceLabel, '1,3 km');

  const west = navigationInfo(origin, {x: -145, z: 250});
  assert.equal(west.bearing, 270);
  assert.equal(west.cardinal, 'O');
});

test('cleared or malformed destination does not leave map guidance', () => {
  const position = {x: 10, z: 20};
  assert.equal(navigationInfo(position, null), null);
  assert.equal(navigationInfo(position, {x: 10}), null);
  assert.equal(navigationInfo(position, position).distance, 0);
});

test('coverage distinguishes playable points from reference landmarks', () => {
  const coverage = {minX: -100, maxX: 100, minZ: -100, maxZ: 100};
  assert.equal(mapIncludes(coverage, {x: 25, z: 25}), true);
  assert.equal(mapIncludes(coverage, {x: 25, z: 1200}), false);
});

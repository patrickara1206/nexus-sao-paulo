import assert from 'node:assert/strict';
import {test} from 'node:test';
import {NodeIO} from '@gltf-transform/core';

test('the adjustable outfit ships with a mask for the current body mesh', async () => {
 const io = new NodeIO();
 const [human, outfit] = await Promise.all([
  io.read('public/assets/human/adult.glb'),
  io.read('public/assets/human/casual-outfit.glb'),
 ]);
 const body = human.getRoot().listMeshes()[0].listPrimitives()[0];
 const triangleCount = body.getIndices().getCount() / 3;
 const scene = outfit.getRoot().listScenes()[0];
 const {hiddenBodyTriangles} = scene.getExtras();
 assert.ok(hiddenBodyTriangles.length > 0 && hiddenBodyTriangles.length < triangleCount);
 assert.equal(new Set(hiddenBodyTriangles).size, hiddenBodyTriangles.length);
 assert.ok(hiddenBodyTriangles.every(i => Number.isInteger(i) && i >= 0 && i < triangleCount));

 const garments = scene.listChildren();
 assert.deepEqual(garments.map(node => node.getName()).sort(), ['Shirt', 'Trousers']);
 for (const node of garments) {
  const [primitive] = node.getMesh().listPrimitives();
  const [shape] = primitive.listTargets();
  assert.equal(shape.getAttribute('POSITION').getCount(), primitive.getAttribute('POSITION').getCount());
  assert.ok(primitive.getMaterial().getBaseColorTexture()?.getImage()?.length);
 }
});

import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {prune} from '@gltf-transform/functions';

const input = process.argv[2];
if (!input) throw new Error('Informe o caminho do GLB simplificado da árvore Poly Haven.');
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const document = await io.read(input);
for (const mesh of document.getRoot().listMeshes()) {
 for (const primitive of mesh.listPrimitives()) {
  const material = primitive.getMaterial();
  if (material.getName().includes('leaves')) {
   primitive.dispose();
  } else {
   // Keep the photographed bark and discard extra channels for the instanced model.
   material.setNormalTexture(null).setMetallicRoughnessTexture(null).setRoughnessFactor(.94);
  }
 }
}
await document.transform(prune());
await io.write('public/assets/props/tree-bark.glb', document);

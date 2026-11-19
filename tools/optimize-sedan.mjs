import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {dedup,flatten,join,weld,simplify,prune} from '@gltf-transform/functions';
import {MeshoptSimplifier} from 'meshoptimizer';
await MeshoptSimplifier.ready;
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS);
const document=await io.read(process.argv[2]);
await document.transform(dedup(),flatten(),join(),weld(),simplify({simplifier:MeshoptSimplifier,ratio:Number(process.argv[4]||.22),error:Number(process.argv[5]||.001)}),prune());
await io.write(process.argv[3],document);

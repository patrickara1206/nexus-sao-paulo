import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
// Merge static siblings by material; moving groups such as trains/doors remain independent.
export function batchStatic(group){
 const materials=new Map();for(const mesh of [...group.children]){if(!mesh.isMesh||mesh.isInstancedMesh||mesh.userData.dynamic||Array.isArray(mesh.material))continue;mesh.updateMatrix();let geometry=mesh.geometry.clone();if(geometry.index)geometry=geometry.toNonIndexed();geometry.applyMatrix4(mesh.matrix);if(!materials.has(mesh.material))materials.set(mesh.material,[]);materials.get(mesh.material).push({mesh,geometry});}
 for(const [material,items] of materials){if(items.length<2){items.forEach(i=>i.geometry.dispose());continue;}const geometry=mergeGeometries(items.map(i=>i.geometry),false);if(!geometry){items.forEach(i=>i.geometry.dispose());continue;}const combined=new T.Mesh(geometry,material);combined.castShadow=items.some(i=>i.mesh.castShadow);combined.receiveShadow=items.some(i=>i.mesh.receiveShadow);for(const item of items){group.remove(item.mesh);item.geometry.dispose();}group.add(combined);}
}

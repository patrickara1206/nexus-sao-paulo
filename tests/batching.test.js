import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {batchStatic} from '../src/scene-batching.js';

test('static batching keeps bounds and preserves animated and instanced meshes',()=>{
 const group=new T.Group(),material=new T.MeshStandardMaterial(),geometry=new T.BoxGeometry(1,1,1);
 const left=new T.Mesh(geometry,material),right=new T.Mesh(geometry,material);left.position.x=-4;right.position.x=4;group.add(left,right);
 const animated=new T.Mesh(geometry,material);animated.userData.dynamic=true;group.add(animated);
 const instances=new T.InstancedMesh(geometry,material,1);group.add(instances);
 batchStatic(group);
 assert.ok(group.children.includes(animated));assert.ok(group.children.includes(instances));assert.equal(group.children.length,3);
 const combined=group.children.find(c=>c!==animated&&c!==instances);combined.geometry.computeBoundingBox();
 assert.equal(combined.geometry.boundingBox.min.x,-4.5);assert.equal(combined.geometry.boundingBox.max.x,4.5);
 assert.equal(geometry.attributes.position.count,24,'shared source geometry remains intact');
});

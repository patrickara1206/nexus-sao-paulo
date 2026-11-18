import {test} from 'node:test';import assert from 'node:assert/strict';
import source from '../src/masp-source.json' with {type:'json'};
import {paulistaSpawn,paulistaHeading} from '../src/paulista.js';
import {nearestStreet,trianonEntrance,inTrianon,canMove} from '../src/geography.js';
test('MASP source retains measured footprint, height and suspended clearance',()=>{assert.equal(source.osmWay,1370081491);assert(source.footprint.length>=20);assert(source.length>74&&source.length<81);assert(source.depth>27&&source.depth<33);assert.equal(source.height,24.75);assert.equal(source.clearance,8.4);assert(Math.abs(Math.hypot(...source.axis)-1)<1e-8);assert(Math.abs(source.axis[0]*source.normal[0]+source.axis[1]*source.normal[1])<1e-8);});
test('arrival is on the Paulista side and camera looks toward the MASP',()=>{assert.equal(nearestStreet(paulistaSpawn.x,paulistaSpawn.z).name,'Avenida Paulista');const dx=source.center.x-paulistaSpawn.x,dz=source.center.z-paulistaSpawn.z;assert(-Math.sin(paulistaHeading)*dx-Math.cos(paulistaHeading)*dz>45);assert(canMove(paulistaSpawn.x,paulistaSpawn.z));});
test('Trianon mission target belongs to its mapped park boundary',()=>{assert(inTrianon(trianonEntrance.x,trianonEntrance.z));assert(trianonEntrance.source.endsWith('2081876330'));assert(!inTrianon(source.center.x,source.center.z));});

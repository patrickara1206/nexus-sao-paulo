import {test} from 'node:test';import assert from 'node:assert/strict';
import {places,project,heightAt,canMove,roadRecords,onRoad} from '../src/geography.js';
test('core landmarks preserve real orientation and distances',()=>{const p=Object.fromEntries(places.map(p=>[p.id,p]));assert(p.luz.z<p.masp.z);assert(p.ibira.z>p.masp.z);assert(p.se.x>p.masp.x);const d=Math.hypot(p.ibira.x,p.ibira.z);assert(d>2800&&d<3000);assert.deepEqual(project(-23.5614,-46.6559),{x:0,z:-0});});
test('all landmarks lie within playable bounds',()=>{for(const p of places){assert(canMove(p.x,p.z),p.name);assert(Number.isFinite(heightAt(p.x,p.z)));}});
test('import contains named streets and Paulista with real geometry',()=>{assert(roadRecords.length>6000);const r=roadRecords.find(r=>r.name==='Avenida Paulista');assert(r);assert(r.points.length>1);const a=r.points[0],b=r.points[1];assert(onRoad((a[0]+b[0])/2,(a[1]+b[1])/2));assert(roadRecords.some(r=>r.name.includes('Brigadeiro')));});
test('bounds and solid buildings block movement',()=>{assert(!canMove(9999,0));assert(!canMove(0,0,[{x:0,z:0,w:10,d:10}]));assert(canMove(20,0,[{x:0,z:0,w:10,d:10}]));});

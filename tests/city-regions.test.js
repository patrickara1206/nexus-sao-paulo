import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {historicTerrain} from '../src/historic.js';
import {inPaulistaCorridor,paulistaRoads,paulistaRouteLength} from '../src/paulista-corridor.js';
import {paulistaRoutes} from '../src/street-layout.js';

const historic=JSON.parse(readFileSync('public/data/historic.json','utf8'));

test('Praça da Sé uses a consistent plaza level beside the cathedral',()=>{
 const {sample}=historicTerrain(historic);
 assert.ok(Math.abs(sample(2201,-1124)-sample(2261,-1299))<1);
 assert.ok(Math.abs(sample(1893,-1728)-sample(2261,-1299))>12);
});

test('the mapped Paulista corridor contains both ends of the complete route',()=>{
 assert.ok(paulistaRouteLength>2650&&paulistaRouteLength<2850);
 for(const route of paulistaRoutes){
  for(const point of [route.points[0],route.points.at(-1)])assert.ok(inPaulistaCorridor(...point));
 }
 assert.ok(paulistaRoads.some(road=>road.name==='Rua da Consolação'));
 assert.ok(paulistaRoads.some(road=>road.name==='Avenida Brigadeiro Luís Antônio'));
});

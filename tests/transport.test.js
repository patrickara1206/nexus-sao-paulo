import test from 'node:test';
import assert from 'node:assert/strict';
import {makeRoute,sampleRoute,routeDistance,joinRoads,stepDrive,trainMotion,stationCanMove,stationGroundHeight} from '../src/transport-math.js';
import {roadRecords} from '../src/geography.js';
import {nearPaulistaCrossing, paulistaCrossings, signalTarget} from '../src/street-layout.js';
import source from '../src/transport-source.json' with {type:'json'};

test('Paulista carriageways remain separate, connected and opposite in direction',()=>{
 const routes=joinRoads(roadRecords.filter(r=>r.name==='Avenida Paulista'&&!r.tunnel&&r.layer>=0)).slice(0,2);
 assert.equal(routes.length,2);assert.ok(routes.every(r=>r.length>2000));
 const p=routes.map(r=>sampleRoute(r,routeDistance(r,-40,46).along));
 assert.ok(p[0].dx*p[1].dx+p[0].dz*p[1].dz<-.95);
 assert.ok(Math.hypot(p[0].x-p[1].x,p[0].z-p[1].z)>15);
});
test('route sampling clamps ends and applies offset perpendicular to travel',()=>{
 const r=makeRoute([[0,0],[0,10],[10,10]]);
 assert.equal(r.length,20);assert.deepEqual(sampleRoute(r,-3),{x:0,z:0,dx:0,dz:1,yaw:0});
 assert.equal(sampleRoute(r,50).x,10);assert.equal(sampleRoute(r,5,2).x,2);
 assert.equal(routeDistance(r,3,4).distance,3);assert.equal(routeDistance(r,3,4).along,4);
});
test('driving accelerates, brakes, reverses steering and respects frame limit',()=>{
 let c={x:0,z:0,yaw:0,speed:0};for(let i=0;i<120;i++)c=stepDrive(c,{forward:1,side:0},1/60);
 assert.ok(c.speed>9&&c.speed<11);assert.ok(c.z>9);
 const forward=stepDrive({...c,speed:5},{forward:0,side:1},.05),reverse=stepDrive({...c,speed:-5},{forward:0,side:1},.05);
 assert.ok(forward.yaw<0&&reverse.yaw>0);
 for(let i=0;i<60;i++)c=stepDrive(c,{brake:true},1/60);assert.equal(c.speed,0);
 assert.ok(stepDrive({...c,speed:0},{forward:1,side:0},100).speed<.26);
});
test('train opens doors only while stopped and closes before leaving',()=>{
 for(let t=0;t<120;t+=.25){const m=trainMotion(t);if(m.doors>0){assert.equal(m.position,0);assert.equal(m.phase,'boarding');}}
 assert.equal(trainMotion(18).doors,0);assert.equal(trainMotion(20).doors,1);assert.equal(trainMotion(36).doors,0);
 assert.ok(trainMotion(40).position>0);assert.ok(trainMotion(10).position<0);
});
test('station boundaries prevent walking onto tracks and through columns',()=>{
 assert.equal(stationCanMove(0,5),true);assert.equal(stationCanMove(5,5),false);
 assert.equal(stationCanMove(2.3,12),false);assert.equal(stationCanMove(0,71),true);
 assert.equal(stationCanMove(2,60),false);assert.equal(stationCanMove(0,73),false);
 assert.equal(stationGroundHeight(0,0),0);assert.equal(stationGroundHeight(0,70),6);
});
test('source keeps both tunnel carriageways and mapped station entrances',()=>{
 assert.equal(source.ways.filter(w=>w.tags.highway==='primary').length,2);
 assert.equal(source.entrances.length,3);assert.ok(source.ways.filter(w=>w.tags.railway==='subway').length>=2);
 assert.ok(source.limitations.some(s=>s.includes('not a depth')));
});
test('Paulista crossings pair both directions and orient stop lines before the intersection', () => {
 const names = new Set(paulistaCrossings.map(crossing => crossing.name));
 assert.equal(names.size, 3);
 for (const name of names) {
  const pair = paulistaCrossings.filter(crossing => crossing.name === name);
  assert.equal(pair.length, 2);
  assert.notEqual(pair[0].route, pair[1].route);
  for (const crossing of pair) {
   assert.equal(crossing.along - crossing.stop, 10);
   assert.ok(nearPaulistaCrossing(crossing.route, crossing.along));
   assert.equal(nearPaulistaCrossing(crossing.route, crossing.along - 16), false);
  }
 }
});
test('red holds the car at the line and amber lets a car already too close proceed', () => {
 assert.deepEqual(signalTarget(8, 0, 'red'), {speed: 0, stop: true});
 assert.ok(signalTarget(8, 6, 'red').speed < 8);
 assert.equal(signalTarget(8, 6, 'amber').stop, false);
 assert.equal(signalTarget(8, 20, 'amber').stop, true);
 assert.equal(signalTarget(8, -1, 'red').stop, false);
 assert.equal(signalTarget(8, 3, 'green').stop, false);
});

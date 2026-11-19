import * as T from 'three';
import {makeTrafficLight} from './lab.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {roadRecords,segmentDistance} from './geography.js';
import {joinRoads,routeDistance,sampleRoute,signalPhase,stepDrive} from './transport-math.js';

export function createVehicles(parent,spawn){
 const root=new T.Group();root.name='Road traffic and player car';parent.add(root);
 const routes=joinRoads(roadRecords.filter(r=>r.name==='Avenida Paulista'&&!r.tunnel&&r.layer>=0)).filter(r=>routeDistance(r,spawn.x,spawn.z).distance<60).slice(0,2);
 const cars=[];let template=null,elapsed=0,error=null;const own={x:spawn.x,z:spawn.z,yaw:0,speed:0,model:null};
 // Parking position is gameplay staging, not an assertion of a real parking space.
 const closest=routes.map(route=>({route,...routeDistance(route,spawn.x,spawn.z)})).sort((a,b)=>a.distance-b.distance)[0];
 if(closest)Object.assign(own,sampleRoute(closest.route,closest.along+9,4.4));
 const palette=['#d7d8d4','#1d242b','#9c2923','#78858d','#b6aaa0','#343c48'];
 function instance(color){const group=template.clone(true);group.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;if(o.material.name==='paint'){o.material=o.material.clone();o.material.color.set(color);}}});root.add(group);return group;}
 function place(car){car.model.position.set(car.x,car.y??12.08,car.z);car.model.rotation.y=car.yaw;}
 const ready=new GLTFLoader().loadAsync('/assets/vehicles/sedan-road.glb').then(g=>{
  template=new T.Group();const model=g.scene;model.traverse(o=>{if(!o.isMesh)return;const m=o.material;o.material=new T.MeshStandardMaterial({name:m.name,color:m.color,map:m.map,roughness:m.roughness,metalness:m.metalness,normalMap:m.normalMap,side:T.FrontSide});if(m.name==='paint')o.material.map=null;if(m.name.includes('glass')){o.material.color.set('#34505c');o.material.roughness=.2;o.material.metalness=.45;}if(m.name==='clearlens'){o.material.emissive.set('#ffe1a0');o.material.emissiveIntensity=.3;}});model.rotation.y=Math.PI/2;template.add(model);template.updateMatrixWorld(true);const box=new T.Box3().setFromObject(template);model.position.y-=box.min.y;
  own.model=instance('#3c596d');place(own);
  routes.forEach((route,r)=>{for(let i=0;i<6;i++){const along=routeDistance(route,spawn.x,spawn.z).along-240+i*88;const car={route,along:Math.max(0,Math.min(route.length,along)),offset:i%2?1.6:-1.6,speed:0,cruise:7.5+(i%3)*.6,model:instance(palette[(i+r*2)%palette.length])};Object.assign(car,sampleRoute(route,car.along,car.offset));cars.push(car);place(car);}});
 }).catch(e=>{error=e.message;console.error('Vehicle asset failed to load',e);});
 const stopLines=routes.map(route=>routeDistance(route,spawn.x-95,spawn.z-90).along);const signals=routes.map((route,i)=>{const p=sampleRoute(route,stopLines[i],6.6),signal=makeTrafficLight(root,p.x,p.z);signal.root.rotation.y=p.yaw-Math.PI/2;return signal;});
 function update(dt,{active,obstacles=[],driving=false}={}){
  if(!active||!template)return;elapsed+=dt;signals.forEach(s=>s.update(elapsed,signalPhase(elapsed)));
  for(const c of cars){const phase=signalPhase(elapsed),line=stopLines[routes.indexOf(c.route)],stop=line-c.along;let target=c.cruise;
   if(phase!=='green'&&stop>0&&stop<35)target=Math.min(target,Math.sqrt(2*3*Math.max(0,stop-3)));
   for(const other of cars){if(other===c||other.route!==c.route||other.offset!==c.offset)continue;const gap=other.along-c.along;if(gap>0&&gap<28)target=Math.min(target,Math.max(0,(gap-7)*.6));}
   for(const p of [...obstacles,own]){const dx=p.x-c.x,dz=p.z-c.z,ahead=dx*c.dx+dz*c.dz,side=Math.abs(dx*c.dz-dz*c.dx);if(ahead>0&&ahead<22&&side<(p===own?2.4:1.7))target=Math.min(target,Math.max(0,(ahead-(p===own?7:4))*.6));}
   c.speed+=T.MathUtils.clamp(target-c.speed,-dt*8,dt*2.3);c.along+=Math.max(0,c.speed)*dt;if(c.along>c.route.length)c.along=0;Object.assign(c,sampleRoute(c.route,c.along,c.offset));place(c);
  }
  place(own);
 }
 function onRoad(x,z){return roadRecords.some(r=>!r.tunnel&&r.layer>=0&&r.points.some((b,i)=>i&&segmentDistance(x,z,r.points[i-1],b)<(r.name==='Avenida Paulista'?6.2:r.kind==='primary'?6.5:3.5)));}
 return {root,own,cars,routes,ready,get error(){return error;},get phase(){return signalPhase(elapsed);},get elapsed(){return elapsed;},update,
  drive(input,dt,allowed,underground=false){const next=stepDrive(own,input,dt);if((underground||onRoad(next.x,next.z))&&allowed(next.x,next.z)&&(underground||!cars.some(c=>Math.hypot(c.x-next.x,c.z-next.z)<3))){Object.assign(own,next);}else own.speed=0;place(own);return own;},
  exitPoint(allowed){for(const sign of [1,-1]){const x=own.x+Math.cos(own.yaw)*sign*2.2,z=own.z-Math.sin(own.yaw)*sign*2.2;if(allowed(x,z)&&!cars.some(c=>Math.hypot(c.x-x,c.z-z)<2))return {x,z,y:12};}return null;},
  blocks(x,z){return [...cars,own].some(c=>c.model&&Math.hypot(c.x-x,c.z-z)<1.5);},
  reset(){own.speed=0;if(closest)Object.assign(own,sampleRoute(closest.route,closest.along+9,4.4));if(own.model)place(own);}
 };
}

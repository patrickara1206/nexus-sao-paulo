import * as T from 'three';
import {createVehicleFleet,VEHICLE_SPECS} from './VehicleFleetManager.js';
import {attachSignalStops,buildPrestesMaiaRoutes,modeForVehicle,prestesMaiaSignals,trafficStoppingLimit} from './TrafficNetwork.js';
import {routeDistance,sampleRoute} from './transport-math.js';

const angle=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
const order=['bus','hatch','motorcycle','sedan','articulated-bus','taxi','delivery-motorcycle','van','bicycle','pickup','suv','vuc','school-van','minibus','truck','garbage-truck','tow-truck','police','ambulance','fire-truck','delivery-bicycle','shared-bicycle'];

export function createHistoricTraffic(parent,roads,groundHeight,{signals:mapped,renderer,fleetOptions={}}={}){
 const root=new T.Group();
 root.name='Trânsito da Avenida Prestes Maia';
 parent.add(root);
 const signals=prestesMaiaSignals(roads,mapped);
 const routes=attachSignalStops(buildPrestesMaiaRoutes(roads),signals);
 const fleet=createVehicleFleet(root,12,{renderer,...fleetOptions});
 const vehicles=[], slots=new Map();
 const lights=Array.from({length:4},()=>{
  const light=new T.SpotLight('#fff1d4',0,44,.27,.78,2);
  const cone=new T.Mesh(new T.ConeGeometry(2.7,15,12,1,true).rotateX(-Math.PI/2).translate(0,0,7.5),
   new T.MeshBasicMaterial({color:'#ffedcb',transparent:true,opacity:.042,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending}));
  root.add(light,light.target,cone);
  return {light,cone};
 });
 let elapsed=0;
 function place(car){
  const p=sampleRoute(car.route.lane,car.along);
  Object.assign(car,p,{y:groundHeight(p.x,p.z)});
  const next=sampleRoute(car.route.lane,car.along+Math.max(4,car.speed*.8));
  const previous=sampleRoute(car.route.lane,car.along-car.length*.38);
  car.steer=T.MathUtils.clamp(angle(next.yaw,p.yaw),-.52,.52);
  car.indicator=Math.abs(car.steer)>.17?Math.sign(car.steer):0;
  car.articulation=angle(previous.yaw,p.yaw);
 }
 function populate(player,quality){
  const maximum=quality==='low'?11:quality==='high'||quality==='ultra'?32:21;
  const ordered=routes.map(route=>({route,...routeDistance(route.lane,player.x,player.z)}))
   .filter(item=>item.distance<235).sort((a,b)=>a.distance-b.distance);
  for(const v of vehicles){if(Math.hypot(v.x-player.x,v.z-player.z)>360)slots.delete(v);}
  for(let i=vehicles.length-1;i>=0;i--)if(!slots.has(vehicles[i])||i>=maximum)vehicles.splice(i,1);
  if(!ordered.length)return;
  const offsetSeed=Math.floor(elapsed/25);
  for(let i=0;i<order.length*3&&vehicles.length<maximum;i++){
   const kind=order[(i+offsetSeed)%order.length],spec=VEHICLE_SPECS[kind];
   const suitable=ordered.filter(o=>o.route.modes.includes(modeForVehicle(kind))&&o.route.lane.length>spec.length+18);
   for(let j=0;j<suitable.length;j++){
    const {route,along:near}=suitable[(i+j)%suitable.length];
    const margin=spec.length*.52+2;
    const along=T.MathUtils.clamp(near+((i*37+j*29)%250)-125,margin,route.lane.length-margin);
    const car={kind,route,along,length:spec.length,width:spec.width,speed:0,phase:0,braking:false};
    place(car);
    if(vehicles.some(other=>Math.abs(car.y-other.y)<2&&Math.hypot(car.x-other.x,car.z-other.z)<(car.length+other.length)/2+3))continue;
    if(Math.hypot(car.x-player.x,car.z-player.z)<14)continue;
    slots.set(car,true);vehicles.push(car);break;
   }
  }
 }
 let nextSpawn=0;
 function update(dt,{active=true,player,quality='balanced',daylight=1,obstacles=[]}={}){
  if(!player)return;
  dt=active?T.MathUtils.clamp(dt,0,.05):0;elapsed+=dt;
  for(const signal of signals)signal.phase=signal.phaseAt(elapsed);
  if(elapsed>=nextSpawn){populate(player,quality);nextSpawn=elapsed+1;}
  const blockers=[player,...obstacles];
  for(const car of vehicles){
   const limit=trafficStoppingLimit(car,vehicles,blockers);
   const mode=modeForVehicle(car.kind),cruise=mode==='bicycle'?5.5:mode==='bus'||mode==='truck'?9:13.3;
   const remaining=car.route.lane.length-car.along-car.length*.5;
   const stop=Math.max(0,Math.min(limit,remaining));
   const target=Math.min(cruise,Math.sqrt(2*3.5*stop),Math.abs(car.steer)>.15?5.4:Infinity);
   const speed=car.speed;
   car.speed+=T.MathUtils.clamp(target-speed,-dt*6,dt*2.6);
   const travel=Math.min(stop,car.speed*dt);
   car.braking=target<speed-.08||(car.speed<.25&&stop<2);
   car.phase=(car.phase+travel/VEHICLE_SPECS[car.kind].wheelRadius)%(Math.PI*2);
   car.along+=travel;place(car);
  }
  for(let i=vehicles.length-1;i>=0;i--){
   const car=vehicles[i];
   if(car.route.lane.length-car.along-car.length*.5<.04){slots.delete(car);vehicles.splice(i,1);}
  }
  fleet.update(vehicles,{player,quality,daylight,time:elapsed});
  const night=1-T.MathUtils.smoothstep(daylight,.17,.56);
  const nearby=night>.035?vehicles.filter(car=>modeForVehicle(car.kind)!=='bicycle').map(car=>({car,d:Math.hypot(car.x-player.x,car.z-player.z)}))
   .filter(entry=>entry.d<65).sort((a,b)=>a.d-b.d):[];
  const budget=quality==='low'?0:quality==='high'||quality==='ultra'?4:2;
  for(const [i,{light,cone}] of lights.entries()){
   const car=nearby[Math.floor(i/2)]?.car;
   light.visible=cone.visible=Boolean(car&&i<budget);
   if(!light.visible)continue;
   const heads=VEHICLE_SPECS[car.kind].headlights,head=heads[i%2];
   if(!head){light.visible=cone.visible=false;continue;}
   const x=car.x+car.dz*head.x+car.dx*head.z,z=car.z-car.dx*head.x+car.dz*head.z;
   light.position.set(x,car.y+head.y,z);
   light.target.position.set(x+car.dx*23,car.y+.15,z+car.dz*23);
   light.intensity=night*245;
   cone.position.copy(light.position);cone.rotation.set(.04,car.yaw,0,'YXZ');
   cone.material.opacity=night*.043;
  }
 }
 function canCross(x,z){
  const nearby=signals.filter(s=>Math.hypot(s.x-x,s.z-z)<15);
  if(nearby.some(s=>s.phase!=='red'))return false;
  return !vehicles.some(v=>{
   const dx=x-v.x,dz=z-v.z,ahead=dx*v.dx+dz*v.dz;
   return Math.abs(dx*v.dz-dz*v.dx)<v.width*.5+2&&ahead> -v.length*.55&&ahead<v.length*.5+Math.max(4,v.speed*2.2);
  });
 }
 function dispose(){
  fleet.dispose();
  for(const {cone,light} of lights){cone.geometry.dispose();cone.material.dispose();light.dispose();}
  root.removeFromParent();
 }
 return {root,signals,routes,vehicles,ready:fleet.ready,update,canCross,dispose};
}

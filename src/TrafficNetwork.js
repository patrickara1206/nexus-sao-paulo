import {makeRoute, routeDistance, sampleRoute, signalPhase} from './transport-math.js';
import fallback from './prestes-traffic-source.json' with {type:'json'};

const AVENUE='avenida prestes maia';
const motorRoads=new Set(['motorway','trunk','primary','secondary','tertiary','residential','unclassified','living_street','service','busway']);
const denied=new Set(['no','private','agricultural','forestry','customers','delivery','destination']);
const allowed=new Set(['yes','permissive','designated','official']);
const modes=['car','bus','taxi','truck','motorcycle','bicycle'];
const accessKeys={
 car:['motorcar','motor_vehicle','vehicle','access'],
 taxi:['taxi','psv','motorcar','motor_vehicle','vehicle','access'],
 bus:['bus','psv','motor_vehicle','vehicle','access'],
 truck:['hgv','goods','motor_vehicle','vehicle','access'],
 motorcycle:['motorcycle','motor_vehicle','vehicle','access'],
 bicycle:['bicycle','vehicle','access'],
};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const sourceOf=road=>({...fallback.ways[road.id],...road.tags});
const avenue=road=>(road.name??'').trim().toLowerCase()===AVENUE;
const kind=road=>(road.kind??road.tags?.highway??'').replace(/_link$/,'');
const coordKey=([x,z])=>Math.round(x*5)+','+Math.round(z*5);

export function modeForVehicle(kind){
 if(kind.includes('bicycle'))return 'bicycle';
 if(kind.includes('motorcycle'))return 'motorcycle';
 if(kind==='bus'||kind==='articulated-bus'||kind==='minibus')return 'bus';
 if(kind==='taxi')return 'taxi';
 if(kind.includes('truck')||kind==='vuc')return 'truck';
 return 'car';
}

function direction(road,tags,mode){
 const rule=mode==='bicycle'?tags['oneway:bicycle']:mode==='bus'?tags['oneway:bus']:undefined;
 const value=rule??tags.oneway??road.oneway;
 if(value===-1||value==='-1'||value==='reverse')return -1;
 if([1,'1',true,'yes','true'].includes(value))return 1;
 if([0,'0',false,'no','false'].includes(value))return 0;
 if(value!=null)return null;
 return road.junction==='roundabout'||tags.junction==='roundabout'||kind(road)==='motorway'?1:0;
}

function pathAccess(road,tags,mode,sign){
 const type=kind(road), suffix=sign>0?'forward':'backward';
 if(!motorRoads.has(type)&&!(mode==='bicycle'&&type==='cycleway'))return false;
 if(type==='busway'&&mode!=='bus'&&!allowed.has(tags[mode]))return false;
 if(type==='cycleway'&&mode!=='bicycle')return false;
 for(const key of accessKeys[mode]){
  const value=tags[key+':'+suffix]??tags[key];
  if(denied.has(value))return false;
  if(allowed.has(value))return true;
 }
 return mode!=='bicycle'||(!['trunk','motorway'].includes(type)||!!tags.cycleway&&tags.cycleway!=='no');
}

function laneChoices(road,tags,mode,sign,count,oneWay){
 const suffix=sign>0?'forward':'backward';
 const tagged=(k,index)=>{
  const val=tags[k+':lanes:'+suffix]??(oneWay?tags[k+':lanes']:undefined);
  return val?.split('|')[index];
 };
 return Array.from({length:count},(_,i)=>i).filter(i=>{
  const lane=road.laneModes?.[suffix]?.[i];
  const bus=tagged('bus',i)??tagged('psv',i);
  const positive=accessKeys[mode].some(key=>allowed.has(tagged(key,i)));
  for(const key of accessKeys[mode]){
   const val=tagged(key,i);
   if(denied.has(val))return false;
   if(allowed.has(val))break;
  }
  if(lane==='closed'&&!positive)return false;
  const sideBus=tags['busway:right']==='lane'||oneWay&&tags.busway==='lane';
  const leftBus=tags['busway:left']==='lane';
  if(mode!=='bus'&&!positive&&(bus==='designated'||lane==='bus'||sideBus&&i===count-1||leftBus&&i===0))return false;
  return true;
 });
}

function segmentDistance(point,edge){
 const along=clamp((point[0]-edge.from[0])*edge.dx+(point[1]-edge.from[1])*edge.dz,0,edge.length);
 return Math.hypot(point[0]-edge.from[0]-edge.dx*along,point[1]-edge.from[1]-edge.dz*along);
}

function edges(roads,mode){
 const list=[];
 for(const road of roads){
  if(!Array.isArray(road.points)||road.points.length<2||road.bridge||road.tunnel||Number(road.layer??0)!==0)continue;
  const tags=sourceOf(road),oneway=direction(road,tags,mode);
  if(oneway===null)continue;
  const lanes=Number(road.lanes??tags.lanes)||(oneway===0?2:1);
  const width=Number(road.width)||lanes*3.5;
  for(const sign of oneway===0?[1,-1]:[oneway]){
   if(!pathAccess(road,tags,mode,sign))continue;
   const explicit=Number(sign>0?road.lanesForward??tags['lanes:forward']:road.lanesBackward??tags['lanes:backward']);
   const count=clamp(oneway===0?explicit||Math.max(1,Math.floor(lanes/2)):lanes,1,8);
   const choices=laneChoices(road,tags,mode,sign,count,oneway!==0);
   if(!choices.length)continue;
   const points=sign>0?road.points:road.points.slice().reverse();
   const nodes=road.nodeIds?.length===points.length?road.nodeIds:tags.nodeIds?.length===points.length?tags.nodeIds:null;
   const key=(p,i)=>nodes?'n'+nodes[sign>0?i:points.length-1-i]:coordKey(p);
   for(let i=1;i<points.length;i++){
    const from=points[i-1],to=points[i],length=Math.hypot(to[0]-from[0],to[1]-from[1]);
    if(length<.2)continue;
    list.push({id:road.id,from,to,fromKey:key(from,i-1),toKey:key(to,i),direction:sign,length,
     dx:(to[0]-from[0])/length,dz:(to[1]-from[1])/length,avenue:avenue(road),type:kind(road),
     width,count,choices,oneWay:oneway!==0,speedKph:Number(road.speedKph??tags.maxspeed)||null});
   }
  }
 }
 return list;
}

function inCorridor(roads){
 const main=roads.filter(avenue).flatMap(road=>road.points.slice(1).map((to,i)=>{
  const from=road.points[i],length=Math.hypot(to[0]-from[0],to[1]-from[1])||1;
  return {from,to,length,dx:(to[0]-from[0])/length,dz:(to[1]-from[1])/length};
 }));
 if(!main.length)return [];
 const points=main.flatMap(s=>[s.from,s.to]);
 const xMin=Math.min(...points.map(p=>p[0]))-90,xMax=Math.max(...points.map(p=>p[0]))+90;
 const zMin=Math.min(...points.map(p=>p[1]))-90,zMax=Math.max(...points.map(p=>p[1]))+90;
 return roads.filter(road=>avenue(road)||road.points?.some(p=>
  p[0]>=xMin&&p[0]<=xMax&&p[1]>=zMin&&p[1]<=zMax&&main.some(edge=>segmentDistance(p,edge)<70)));
}

function corridors(roadEdges,mode){
 const outgoing=new Map(),incoming=new Map();
 for(const edge of roadEdges){
  for(const [map,key] of [[outgoing,edge.fromKey],[incoming,edge.toKey]]){
   if(!map.has(key))map.set(key,[]);
   map.get(key).push(edge);
  }
 }
 const principal=e=>e.avenue||mode==='bicycle'&&(e.type==='cycleway'||['residential','living_street','tertiary'].includes(e.type));
 const trunks=roadEdges.filter(principal);
 const start=trunks.filter(e=>!incoming.get(e.fromKey)?.some(p=>principal(p)&&p.fromKey!==e.toKey));
 const visited=new Set(),chains=[];
 for(let edge of [...start,...trunks]){
  if(visited.has(edge))continue;
  const actual=new Set(),chain=[];
  let total=0,outside=0;
  while(edge&&total<1800){
   if(!principal(edge))outside+=edge.length;
   if(outside>85)break;
   actual.add(edge);
   chain.push(edge);
   total+=edge.length;
   let best,score=-Infinity;
   for(const candidate of outgoing.get(edge.toKey)??[]){
    if(actual.has(candidate)||candidate.toKey===edge.fromKey)continue;
    const dot=edge.dx*candidate.dx+edge.dz*candidate.dz;
    if(dot<-.5)continue;
    const alignment=dot+(candidate.id===edge.id?1.5:0)+(principal(candidate)?2:0);
    if(alignment>score){score=alignment;best=candidate;}
   }
   edge=best;
  }
  const fresh=chain.reduce((sum,e)=>sum+(principal(e)&&!visited.has(e)?e.length:0),0);
  if(fresh<24||total<32)continue;
  for(const e of chain)visited.add(e);
  chains.push(chain);
 }
 return chains.sort((a,b)=>b.reduce((n,e)=>n+e.length,0)-a.reduce((n,e)=>n+e.length,0)).slice(0,20);
}

function laneOffset(e,idx,mode){
 const width=e.oneWay?e.width:e.width*.5;
 if(mode==='bicycle'){
  if(e.type==='cycleway')return e.oneWay?0:width*.46;
  const outside=e.choices.at(-1);
  return (outside+1)*width/e.count-(e.oneWay?width/2:0)-Math.min(.65,width/e.count*.35);
 }
 const lane=e.choices[Math.min(idx,e.choices.length-1)];
 return (lane+.5)*width/e.count-(e.oneWay?width/2:0);
}

function shifted(p,a,b,idx,mode){
 // Scene +Z points south. A southbound driver keeps right on the west (-X) side.
 const nx=-a.dz-b.dz,nz=a.dx+b.dx,len=Math.hypot(nx,nz)||1;
 const scale=(laneOffset(a,idx,mode)+laneOffset(b,idx,mode))/(2*len*Math.max(.68,(-nx*b.dz+nz*b.dx)/len));
 return [p[0]+nx*scale,p[1]+nz*scale];
}

export function buildPrestesMaiaRoutes(roads){
 const selected=inCorridor(roads),routes=new Map();
 for(const mode of modes){
  for(const chain of corridors(edges(selected,mode),mode)){
   const first=chain[0],last=chain.at(-1);
   const count=mode==='bicycle'?1:Math.min(5,Math.max(...chain.map(e=>e.choices.length)));
   for(let i=0;i<count;i++){
    const path=[shifted(first.from,first,first,i,mode),...chain.map((e,k)=>shifted(e.to,e,chain[k+1]??last,i,mode))];
    const key=path.map(coordKey).join('|');
    if(routes.has(key)){routes.get(key).modes.push(mode);continue;}
    const lane=makeRoute(path), corridor=makeRoute([first.from,...chain.map(e=>e.to)]);
    if(lane.length<32)continue;
    routes.set(key,{id:String(routes.size),lane,corridor,chain,index:i,modes:[mode],
     mainLength:chain.reduce((n,e)=>n+(e.avenue?e.length:0),0),
     minWidth:Math.min(...chain.map(e=>e.width/(e.count*(e.oneWay?1:2))))});
   }
  }
 }
 return [...routes.values()];
}

export function prestesMaiaSignals(roads,mapped){
 const nearby=inCorridor(roads),links=edges(nearby,'car').concat(edges(nearby,'bus'));
 const selected=[];
 for(const node of mapped?.length?mapped:fallback.signals){
  if(!Number.isFinite(node.x)||!Number.isFinite(node.z))continue;
  let nearest,distance=22;
  for(const e of links){
   const d=segmentDistance([node.x,node.z],e);
   if(d<distance){distance=d;nearest=e;}
  }
  if(!nearest)continue;
  const nearbySignal=selected.find(s=>Math.hypot(s.x-node.x,s.z-node.z)<30);
  const yaw=node.yaw??Math.atan2(nearest.dx,nearest.dz);
  const phaseOffset=nearbySignal?
   nearbySignal.phaseOffset+(Math.abs(Math.cos(yaw-nearbySignal.yaw))<.55?15:0):
   Math.abs(Math.floor(node.x*.21+node.z*.165))%30;
  // Each direction has a red clearance interval between conflicting greens.
  const phaseAt=node.phaseAt??(t=>{
   const s=((t+phaseOffset)%30+30)%30;
   return s<11?'green':s<14?'amber':'red';
  });
  selected.push({...node,phase:phaseAt(0),phaseOffset,yaw,phaseAt});
 }
 return selected;
}

export function attachSignalStops(routes,signals){
 for(const route of routes){
  route.stops=[];
  for(const signal of signals){
   const center=routeDistance(route.corridor,signal.x,signal.z);
   if(center.distance>7||center.along<1||center.along>route.corridor.length-1)continue;
   const point=sampleRoute(route.corridor,center.along);
   if(Math.abs(Math.cos(signal.yaw-point.yaw))<.6)continue;
   const offset=routeDistance(route.lane,point.x,point.z).along;
   route.stops.push({signal,along:Math.max(0,offset-3.5)});
  }
  route.stops.sort((a,b)=>a.along-b.along);
 }
 return routes;
}

export function trafficStoppingLimit(car,cars,obstacles=[]){
 let gap=Infinity;
 const halfLength=car.length/2,halfWidth=car.width/2;
 for(const other of cars){
  if(other===car)continue;
  if(other.route===car.route&&other.along>car.along){
   gap=Math.min(gap,Math.max(0,other.along-car.along-halfLength-other.length*.5-1.7));
  }
  const dx=other.x-car.x,dz=other.z-car.z;
  const ahead=car.dx*dx+car.dz*dz,side=Math.abs(car.dz*dx-car.dx*dz);
  if(ahead>.2&&ahead<55&&side<halfWidth+other.width*.5+.18&&car.dx*other.dx+car.dz*other.dz>.3){
   gap=Math.min(gap,Math.max(0,ahead-halfLength-other.length*.5-1.5));
  }
 }
 for(const point of obstacles){
  if(!point||Number.isFinite(point.y)&&Number.isFinite(car.y)&&Math.abs(point.y-car.y)>3.5)continue;
  const dx=point.x-car.x,dz=point.z-car.z,ahead=car.dx*dx+car.dz*dz,side=Math.abs(car.dz*dx-car.dx*dz);
  if(ahead>0&&ahead<45&&side<halfWidth+(point.radius??.55)){
   gap=Math.min(gap,Math.max(0,ahead-halfLength-(point.radius??.55)-.8));
  }
 }
 for(const {signal,along} of car.route.stops??[]){
  const distance=along-halfLength-car.along;
  if(distance<-.1||signal.phase==='green')continue;
  if(signal.phase==='amber'&&car.speed**2/(2*4.6)>distance+1.5)continue;
  gap=Math.min(gap,Math.max(0,distance));
 }
 return gap;
}

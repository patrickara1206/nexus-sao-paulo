import {origin,toLocal} from './geodesy.js';

export const FLOOR_METERS=3.2;
export const LANE_METERS=3.5;
export const CURB_METERS=.15;
export const OSM_SOURCE='https://www.openstreetmap.org/copyright';
const roadWidths={motorway:14,trunk:11,primary:11,secondary:8.5,tertiary:7.5,
 residential:6,unclassified:6,service:4,pedestrian:5.5,living_street:5,
 footway:2.2,path:1.8,steps:2,cycleway:2.3,track:3};

/** WGS84 ECEF → a fixed tangent plane. +X east and +Z south, in metres. */
export function projectLatLon(lat,lon){
 if(!Number.isFinite(lat)||Math.abs(lat)>90||!Number.isFinite(lon)||Math.abs(lon)>180){
  throw new RangeError('Latitude/longitude WGS84 inválidas');
 }
 const {x,z}=toLocal(lat,lon,origin.height);
 return {x,z};
}

export function osmMeters(value){
 const text=String(value??'').trim().replace(',','.');
 const metric=text.match(/^(\d+(?:\.\d+)?)\s*(m|meters?|metres?|cm|km|ft)?$/i);
 if(metric){
  const unit=metric[2]?.toLowerCase();
  return Number(metric[1])*({cm:.01,km:1000,ft:.3048}[unit]??1);
 }
 const imperial=text.match(/^(\d+)\s*'\s*(\d+(?:\.\d+)?)?\s*"?$/);
 return imperial?Number(imperial[1])*.3048+Number(imperial[2]??0)*.0254:null;
}

function positive(value){
 const number=Number(value);
 return Number.isFinite(number)&&number>0?number:null;
}

function count(value){
 const number=positive(value);
 return Number.isInteger(number)?number:null;
}

export function buildingMeasures(tags={},fallback=10){
 const direct=osmMeters(tags.height);
 const levels=positive(tags['building:levels']);
 const height=direct>0?direct:levels?levels*FLOOR_METERS:fallback;
 const minimum=osmMeters(tags.min_height)??(positive(tags['building:min_level'])??0)*FLOOR_METERS;
 return {h:height,minHeight:Math.min(Math.max(0,minimum),height),levels,
  heightSource:direct>0?'height':levels?'building:levels':'estimated'};
}

export function osmOneway(tags){
 if(tags.oneway==='-1'||tags.oneway==='reverse')return -1;
 if(['yes','true','1'].includes(tags.oneway))return 1;
 if(['no','false','0'].includes(tags.oneway))return 0;
 if(tags.oneway)return null;
 return tags.junction==='roundabout'||tags.highway==='motorway'?1:0;
}

export function roadMeasures(tags={},fallback=null){
 const kind=(tags.highway||'unclassified').replace(/_link$/,'');
 const explicit=osmMeters(tags.width);
 const lanes=count(tags.lanes);
 const sidewalk=tags.sidewalk;
 const namedWidth=osmMeters(tags['sidewalk:width']);
 const side=(key,enabled)=>{
  const mode=tags['sidewalk:'+key]??(enabled?'yes':sidewalk==='separate'?'separate':sidewalk?'no':undefined);
  const width=osmMeters(tags['sidewalk:'+key+':width'])??namedWidth;
  return {mode,width:width>0?width:2.8,widthSource:width>0?'width':'estimated'};
 };
 return {kind,width:explicit>0?explicit:lanes?lanes*LANE_METERS:fallback??roadWidths[kind]??6,
  widthSource:explicit>0?'width':lanes?'lanes':'estimated',lanes,sidewalk,
  lanesForward:count(tags['lanes:forward']),lanesBackward:count(tags['lanes:backward']),
  oneway:osmOneway(tags),onewaySource:tags.oneway?'tag':'osm-default',
  sidewalks:{left:side('left',sidewalk==='both'||sidewalk==='left'||sidewalk==='yes'),
   right:side('right',sidewalk==='both'||sidewalk==='right'||sidewalk==='yes')},
  busway:tags.busway, bridge:Boolean(tags.bridge&&tags.bridge!=='no'),
  tunnel:Boolean(tags.tunnel&&tags.tunnel!=='no'&&tags.tunnel!=='building_passage'),
  layer:Number(tags.layer)||0};
}

/** Lane permissions ordered left to right from the driver's perspective. */
export function laneModes(tags={},direction=1){
 const key=direction===-1?'backward':'forward';
 const any=(tag)=>tags[tag+':'+key]??(osmOneway(tags)!==0?tags[tag]:undefined);
 const bus=any('bus:lanes')?.split('|')??[];
 const vehicle=any('vehicle:lanes')?.split('|')??[];
 const mode=Array.from({length:Math.max(bus.length,vehicle.length)},(_,i)=>
  ['designated','yes'].includes(bus[i])&&(vehicle[i]==='no'||bus[i]==='designated')?'bus':
   vehicle[i]==='no'?'closed':'general');
 return mode;
}

function kinds(tags){
 const output=[];
 if(tags.highway==='bus_stop'||(tags.public_transport==='platform'&&tags.bus==='yes'))output.push('bus-stop');
 if(tags.railway==='subway_entrance')output.push('metro-entrance');
 if(tags.railway==='train_station_entrance')output.push('rail-entrance');
 if(tags.railway==='station'||tags.station==='subway')output.push('station');
 if(tags.highway==='street_lamp'||tags.man_made==='street_lamp')output.push('lamp');
 if(tags.highway==='traffic_signals'||tags.crossing==='traffic_signals')output.push('signal');
 if(tags.highway==='crossing'||(tags.highway==='traffic_signals'&&tags.crossing))output.push('crossing');
 if(tags.amenity==='bench')output.push('bench');
 if(tags.amenity==='waste_basket')output.push('bin');
 if(tags.shop==='newsagent')output.push('newsagent');
 if(tags.natural==='tree')output.push('tree');
 if(tags.emergency==='fire_hydrant')output.push('hydrant');
 if(['guard_rail','fence','bollard'].includes(tags.barrier))output.push('barrier');
 if(tags.traffic_sign||['stop','give_way'].includes(tags.highway))output.push('sign');
 return output;
}

function nodePoint(node){
 return Number.isFinite(node?.lat)&&Number.isFinite(node?.lon)&&Math.abs(node.lat)<=90&&Math.abs(node.lon)<=180
  ?{lat:node.lat,lon:node.lon,...projectLatLon(node.lat,node.lon)}
  :null;
}

function road(path,locations){
 const tags=path.tags??{};
 const measures=roadMeasures(tags);
 return {id:path.id,name:tags.name??'',tags,...measures,nodeIds:path.nodes??[],
  points:locations.map(({x,z})=>[x,z]),laneModes:{forward:laneModes(tags,1),backward:laneModes(tags,-1)},
  access:tags.access??null,surface:tags.surface??'',speedKph:positive(tags.maxspeed)};
}

function feature(element,kind,position,positionSource,points){
 const tags=element.tags??{};
 return {id:element.id,kind,...position,name:tags.name??tags.ref??'',tags,points,
  positionSource,source:`https://www.openstreetmap.org/${element.type}/${element.id}`};
}

/**
 * Parse an Overpass response with nodes and ways (or ways with out geom).
 * Missing node chains are skipped as a whole, so absent nodes never invent road connections.
 */
export function parseOsm(data){
 if(!Array.isArray(data?.elements))throw new TypeError('Resposta OSM sem elements');
 const nodes=new Map(),ways=new Map(),features=[],links=[],buildings=[];
 for(const element of data.elements){
  if(element.type!=='node')continue;
  const position=nodePoint(element);
  if(!position)continue;
  nodes.set(element.id,position);
  for(const kind of kinds(element.tags??{}))features.push(feature(element,kind,position,'node'));
 }
 for(const path of data.elements){
  if(path.type!=='way')continue;
  const tags=path.tags??{};
  const locations=path.geometry?.map(nodePoint)??path.nodes?.map(id=>nodes.get(id));
  if(!locations||locations.length<2||locations.some(p=>!p))continue;
  ways.set(path.id,{path,locations});
  const closed=locations[0].lat===locations.at(-1).lat&&locations[0].lon===locations.at(-1).lon;
  const points=locations.map(({x,z})=>[x,z]);
  if(tags.highway&&tags.area!=='yes')links.push(road(path,locations));
  if(closed&&tags.building&&tags.building!=='no'&&locations.length>=4){
   buildings.push({id:path.id,rings:[points.slice(0,-1)],tags,name:tags.name??'',kind:tags.building,
    ...buildingMeasures(tags)});
  }
  const middle=path.center?nodePoint(path.center):locations[Math.floor(locations.length/2)];
  for(const kind of kinds(tags)){
   if(middle)features.push(feature(path,kind,middle,kind==='barrier'?'way':'mapped-way-anchor',points));
  }
 }
 const byId=new Map();
 for(const item of features)byId.set(item.source+'#'+item.kind,item);
 return {nodes,ways,features:[...byId.values()],links,buildings};
}

export function mergeHistoricGeo(legacy,osm){
 const parsed=parseOsm(osm);
 const roads=new Map(parsed.links.map(link=>[link.id,link]));
 const buildings=new Map(parsed.buildings.map(item=>[item.id,item]));
 const metadata=osm.metadata??{};
 const links=legacy.roads.map(previous=>{
  const updated=roads.get(previous.id);
  if(!updated){
   const tags=metadata.way?.[previous.id];
   return tags?{...previous,tags,...roadMeasures(tags,previous.width),laneModes:{forward:laneModes(tags,1),backward:laneModes(tags,-1)}}:previous;
  }
  return {...previous,...updated,...roadMeasures(updated.tags,previous.width)};
 });
 const data={...legacy,roads:links,buildings:legacy.buildings.map(previous=>{
  const record=!previous.relation&&buildings.get(previous.id);
  if(!record){
   const tags=metadata[previous.relation?'relation':'way']?.[previous.id]??{};
   return {...previous,tags,...buildingMeasures(tags,previous.h)};
  }
  const merged={...previous,...record,...buildingMeasures(record.tags,previous.h)};
  return {...merged,measured:merged.heightSource==='height'};
 })};
 // Keep grade-separated and restricted ways for navigation clients while
 // the surface renderer continues drawing only the playable street layer.
 const treeNodes=new Map(parsed.features.filter(item=>item.kind==='tree').map(item=>[item.id,item]));
 data.trees=(legacy.trees??[]).map(([x,z,height,id])=>{
  const tree=treeNodes.get(id);
  return [tree?.x??x,tree?.z??z,height,id];
 });
 const legacyRoadIds=new Set(links.map(way=>way.id));
 const linksForRouting=links.slice();
 for(const way of parsed.links)if(!legacyRoadIds.has(way.id))linksForRouting.push(way);
 return {data,links:linksForRouting,features:parsed.features,source:osm.source??OSM_SOURCE};
}

/** Offline capture with the same schema as an Overpass query. */
export async function loadHistoricGeo(legacy,{url='/data/prestes-osm.json',request=fetch}={}){
 try{
  const response=await request(url);
  if(!response.ok)throw new Error(`OSM HTTP ${response.status}`);
  return mergeHistoricGeo(legacy,await response.json());
 }catch(error){
  console.warn('Dados urbanos detalhados indisponíveis. Usando o mapa base.',error);
  return {data:legacy,links:legacy.roads,features:[],source:null};
 }
}

import * as T from 'three';
import {pbrMaterial} from './lab.js';

const wallModuleMeters = 2.4;
const frontageRadius = 58;
const edgeInset = .06;
const detailCellSize = 44;
const footways = new Set(['footway', 'path', 'cycleway', 'pedestrian', 'steps', 'living_street']);

export function isPrestesMaia(road) {
 return !road.bridge && !road.tunnel && road.name === 'Avenida Prestes Maia' && !footways.has(road.kind);
}

export function sidewalkSides(road) {
 const tags = road.tags ?? {};
 const sidewalk = road.sidewalk ?? tags.sidewalk;
 const inherits = side => {
  const specific = tags['sidewalk:' + side];
  if (specific) return specific === 'yes' || specific === 'both';
  if (sidewalk) return ['yes', 'both', side].includes(sidewalk);
  return !isPrestesMaia(road) && !['motorway','trunk','service'].includes(road.kind);
 };
 return [inherits('left') && -1, inherits('right') && 1].filter(Boolean);
}

function laneCount(road) {
 const lanes = Number(road.lanes ?? road.tags?.lanes);
 return Number.isInteger(lanes) && lanes > 0 ? lanes : Math.max(1, Math.round(road.width / 3.5));
}

function busSides(road) {
 const tags = road.tags ?? {};
 const busway = road.busway ?? tags.busway;
 if (busway === 'both') return [-1, 1];
 const sides = [];
 for (const [side, direction] of [['left', -1], ['right', 1]]) {
  if (/^(lane|designated|opposite_lane)$/.test(tags['busway:' + side] ?? '') || busway === side) sides.push(direction);
 }
 if (!sides.length && /^(lane|designated)$/.test(busway ?? '')) sides.push(1);
 return sides;
}

function busLaneIndices(road,count) {
 const tags=road.tags??{};
 if(['no','private'].includes(tags.motor_vehicle??tags.vehicle??tags.access) &&
    ['yes','designated'].includes(tags.bus??tags.psv)) return Array.from({length:count},(_,i)=>i);
 const lanes=new Set(busSides(road).map(side=>side<0?0:count-1));
 if(road.oneway===1||road.oneway===-1){
  const modes=road.laneModes?.[road.oneway===-1?'backward':'forward']??[];
  modes.forEach((mode,index)=>{if(mode==='bus'&&index<count)lanes.add(road.oneway===-1?count-index-1:index);});
 }
 return [...lanes];
}

function facadeMaterial(texture, layout) {
 const material = pbrMaterial(texture, layout === 'brick' ? .8 : 1);
 material.vertexColors = true;
 material.side = T.DoubleSide;
 material.normalScale.set(.53,.53);
 material.envMapIntensity = .82;
 material.customProgramCacheKey = () => 'historic-facade-' + layout;
 material.onBeforeCompile = shader => {
  shader.vertexShader = `
   attribute vec4 facade;
   varying vec4 vFacade;
   varying vec2 vFacadeMeters;
   ` + shader.vertexShader.replace('#include <uv_vertex>', `#include <uv_vertex>
   vFacade = facade;
   vFacadeMeters = uv * ${wallModuleMeters.toFixed(2)};
  `);
  shader.fragmentShader = `
   varying vec4 vFacade;
   varying vec2 vFacadeMeters;
   float facadeRange(float value, float start, float end, float edge) {
    return smoothstep(start-edge,start+edge,value)*(1.0-smoothstep(end-edge,end+edge,value));
   }
   float facadeHash(vec2 p) { return fract(sin(dot(p,vec2(117.7,73.1)))*1739.0889); }
   ` + shader.fragmentShader;
  shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
   float widthMeters = max(1.0, vFacade.x);
   float seed = vFacade.y;
   float columns = max(1.0, floor(widthMeters / mix(2.2, 3.55, seed)));
   vec2 cell = vec2(vFacadeMeters.x * columns / widthMeters, (vFacadeMeters.y - .16) / max(2.65,vFacade.w));
   vec2 subWindow = fract(cell);
   vec2 aa = clamp(fwidth(cell)*.7, vec2(.002), vec2(.09));
   float spanGate = step(1.35, vFacade.x) * step(.35,vFacadeMeters.y);
   float shop = vFacade.z * (1.-smoothstep(2.75,3.24,vFacadeMeters.y));
   float paneWidth = mix(.29,.44,shop);
   float jamb = facadeRange(abs(subWindow.x-.5),0.0,paneWidth+.045,aa.x);
   float sill = facadeRange(subWindow.y,mix(.26,.12,shop)-.04,mix(.83,.92,shop)+.035,aa.y);
   float bore = facadeRange(abs(subWindow.x-.5),0.0,paneWidth,aa.x);
   float aperture = facadeRange(subWindow.y,mix(.26,.12,shop),mix(.83,.92,shop),aa.y);
   float mullion = 1.-smoothstep(.012,.024+aa.x,abs(subWindow.x-.5));
   float inset = jamb*sill*spanGate;
   float glazing = bore*aperture*spanGate*(1.-mullion);
   float moduleStrength = 1.-smoothstep(.24,.71,max(aa.x,aa.y)*3.6);
   inset *= moduleStrength;
   glazing *= moduleStrength;
   float paneSeed = facadeHash(floor(cell)+seed);
   vec3 windowColor = mix(vec3(.033,.049,.055),vec3(.108,.153,.175),paneSeed);
   windowColor *= mix(.64, 1.12, subWindow.y);
   float stain = smoothstep(.51,.96,facadeHash(floor(vFacadeMeters*vec2(.24,.16))+seed));
   diffuseColor.rgb *= 1.-stain*.15;
   float damp = 1.-smoothstep(.12,1.34,vFacadeMeters.y);
   diffuseColor.rgb *= 1.-damp*.19;
   ${layout === 'tile' ? `
   vec2 tile = abs(fract(vFacadeMeters / .195)-.5);
   float gap = smoothstep(.454,.495,max(tile.x,tile.y));
   gap *= 1.-smoothstep(.08,.34,length(fwidth(vFacadeMeters/.195)));
   diffuseColor.rgb *= 1.-gap*.34;
   ` : ''}
   diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb*.54, inset);
   diffuseColor.rgb = mix(diffuseColor.rgb, windowColor, glazing*.96);
  `);
  shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
   roughnessFactor = mix(roughnessFactor, .21 + paneSeed * .16, glazing);
  `);
  shader.fragmentShader = shader.fragmentShader.replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
   metalnessFactor = mix(metalnessFactor, .56, glazing);
  `);
 };
 return material;
}

function asphaltMaterial() {
 const material = pbrMaterial('asphalt_02');
 material.side = T.DoubleSide;
 material.color.set('#676c6e');
 material.normalScale.set(.58,.58);
 material.customProgramCacheKey = () => 'stained-city-asphalt';
 material.onBeforeCompile = shader => {
  shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
   vec2 coarse = vMapUv * vec2(1.05,1.83);
   vec2 grid = floor(coarse);
   vec2 localPatch = fract(coarse);
   float seed = fract(sin(dot(grid,vec2(54.148,117.313)))*1989.21);
   float wear = .935 + .14 * sin(vMapUv.x * 1.6 + vMapUv.y * 2.37) * sin(vMapUv.y*.78);
   vec2 bounds = abs(localPatch - vec2(.48,.52));
   float patch = (1.-smoothstep(.27,.36,max(bounds.x*1.07,bounds.y))) * smoothstep(.8,.89,seed);
   diffuseColor.rgb *= wear * (1. - .26 * patch);
  `);
 };
 return material;
}

export function createCityMaterials() {
 const paving = pbrMaterial('concrete_pavement');
 paving.color.set('#b9b1a2');
 paving.normalScale.set(.68,.68);
 paving.side = T.DoubleSide;
 const curb = paving.clone();
 curb.color.set('#99988c');
 return {
  street: asphaltMaterial(), paving, curb,
  wall: facadeMaterial('concrete_pavement','concrete'),
  brick: facadeMaterial('brick_wall_001','brick'),
  tile: facadeMaterial('concrete_pavement','tile'),
  roof: new T.MeshStandardMaterial({vertexColors:true,roughness:.98,side:T.DoubleSide}),
  ground: new T.MeshStandardMaterial({color:'#757164',roughness:.99}),
  park: new T.MeshStandardMaterial({color:'#515e41',roughness:.98,side:T.DoubleSide}),
  water: new T.MeshStandardMaterial({color:'#587a7d',roughness:.41,metalness:.18,side:T.DoubleSide}),
  paint: new T.MeshStandardMaterial({color:'#d7d3bf',roughness:.9,side:T.DoubleSide}),
  busPaint: new T.MeshStandardMaterial({color:'#864541',roughness:.91,side:T.DoubleSide}),
  cyclePaint: new T.MeshStandardMaterial({color:'#a3493f',roughness:.96,side:T.DoubleSide}),
 };
}

function avenueSegments(roads) {
 const segments = [];
 for (const road of roads.filter(isPrestesMaia)) {
  for (let i = 1; i < road.points.length; i++) {
   const [x,z] = road.points[i-1], [bx,bz] = road.points[i];
   const length = Math.hypot(bx-x,bz-z);
   if (length < .1) continue;
   segments.push({road,x,z,length,dx:(bx-x)/length,dz:(bz-z)/length});
  }
 }
 return segments;
}

function nearestSegment(segments, x, z) {
 let nearest;
 for (const segment of segments) {
  const {x:ax,z:az,length,dx,dz} = segment;
  const along = T.MathUtils.clamp((x-ax)*dx+(z-az)*dz,0,length);
  const px = ax+along*dx, pz = az+along*dz;
  const distance = Math.hypot(px-x,pz-z);
  if (!nearest || distance < nearest.distance) nearest = {segment,along,x:px,z:pz,distance};
 }
 return nearest;
}

export function findPrestesCrossings(roads, features = []) {
 const segments = avenueSegments(roads);
 return features.filter(feature => feature.kind === 'crossing')
  .filter(feature => !['no','unmarked','informal'].includes(feature.tags?.crossing))
  .flatMap(feature => {
   if (feature.tags?.['crossing:markings'] === 'no') return [];
   const point = nearestSegment(segments,feature.x,feature.z);
   if (!point || point.distance > point.segment.road.width * .5 + 1.25) return [];
   return [{...point, id:feature.id, source:feature}];
  })
  .filter((crossing,index,crossings) => crossings.findIndex(candidate =>
   candidate.segment.road.id === crossing.segment.road.id && Math.hypot(candidate.x-crossing.x,candidate.z-crossing.z)<2.7) === index);
}

function top(batch, kind, terrainHeight, segment, start, end, left, right, offset) {
 if (end-start < .015) return;
 const {x,z,dx,dz} = segment;
 function point(along, lateral) {
  const px=x+dx*along-dz*lateral, pz=z+dz*along+dx*lateral;
  return [px,terrainHeight(px,pz)+offset,pz];
 }
 const middle = (start+end)*.5;
 const out = batch.batch(kind,x+dx*middle,z+dz*middle);
 batch.quad(out,point(start,left),point(start,right),point(end,right),point(end,left));
}

export function addPrestesMarkings(batch, roads, features, terrainHeight) {
 const crossings = findPrestesCrossings(roads,features);
 for (const segment of avenueSegments(roads)) {
  const {road,length,dx,dz,x,z}=segment;
  const half = road.width * .5, count = laneCount(road);
  const crossAlong = crossings.filter(crossing => crossing.segment.road.id === road.id).flatMap(crossing => {
   const across=Math.abs((crossing.x-x)*dz-(crossing.z-z)*dx);
   return across<2 ? [(crossing.x-x)*dx+(crossing.z-z)*dz] : [];
  });
  const busLanes = busLaneIndices(road,count);
  for (let start=0;start<length;start+=4) {
   const end=Math.min(length,start+4);
   for (const lane of busLanes) {
    if (crossAlong.some(at=>Math.abs(at-(start+end)*.5)<3.4)) continue;
    const width=road.width/count, left=-half+lane*width;
    top(batch,'busPaint',terrainHeight,segment,start,end,left,left+width,.121);
   }
  }
  for (let start=1.7;start<length;start+=8) {
   if (crossAlong.some(at=>Math.abs(at-start)<5)) continue;
   for (let lane=1;lane<count;lane++) {
    const lateral = -half + road.width * lane / count;
    top(batch,'paint',terrainHeight,segment,start,Math.min(length,start+2.85),lateral-.059,lateral+.059,.13);
   }
  }
 }
 for (const {segment,along} of crossings) {
  const half = segment.road.width * .5 - .23;
  for (let stripe=-half;stripe<half-.27;stripe+=.65) {
   top(batch,'paint',terrainHeight,segment,along-1.55,along+1.55,stripe,Math.min(half,stripe+.36),.144);
  }
 }
}

const unitBox = new T.BoxGeometry(1,1,1);

export function createPrestesDetails(root, roads) {
 const segments = avenueSegments(roads);
 const trims = new T.MeshStandardMaterial({color:'#797069',roughness:.77});
 const bays = new Map();
 const meshes = [];
 const transform = new T.Object3D();
 let priorX=Infinity, priorZ=Infinity, priorQuality;
 function handleWall(a,b,baseA,baseB,ground,building) {
  const [ax,az]=a,[bx,bz]=b, width=Math.hypot(bx-ax,bz-az);
  if (width<4.8 || building.h<4.1 || ['roof','church','garage'].includes(building.kind)) return false;
  const mx=(ax+bx)*.5,mz=(az+bz)*.5;
  if(mx<1990||mx>2390||mz< -2980||mz> -1900) return false;
  const nearest=nearestSegment(segments,mx,mz);
  if(!nearest || nearest.distance>frontageRadius) return false;
  const dx=(bx-ax)/width,dz=(bz-az)/width;
  const cross=(nearest.x-mx)*-dz+(nearest.z-mz)*dx;
  if(Math.abs(cross)/Math.max(nearest.distance,.001)<.62) return false;
  const nx=-dz*Math.sign(cross),nz=dx*Math.sign(cross);
  if(ground<Math.max(baseA,baseB)-.8) return false;
  const key=Math.floor(mx/detailCellSize)+','+Math.floor(mz/detailCellSize);
  if(!bays.has(key)) bays.set(key,[]);
  const items=bays.get(key);
  const yaw=-Math.atan2(dz,dx);
  function put(along,height,length,thick,depth) {
   const offset=edgeInset+depth*.48;
   items.push([ax+dx*along+nx*offset,ground+height,az+dz*along+nz*offset,length,thick,depth,yaw]);
  }
  put(width*.5,3.07,width-.18,.145,.19);
  put(width*.5,.14,width-.18,.11,.13);
  const columns=Math.max(1,Math.floor(width/T.MathUtils.lerp(2.2,3.55,facadeSeed(building.id))));
  for(let i=1;i<columns;i++)put(width*i/columns,1.58,.125,2.94,.12);
  if(building.id%4===0)put(width*.5,2.74,width-.65,.1,.83);
  return true;
 }
 function finish() {
  for(const items of bays.values()){
   if(!items.length)continue;
   const mesh=new T.InstancedMesh(unitBox,trims,items.length);
   for(const [index,[x,y,z,w,h,d,yaw]] of items.entries()){
    transform.position.set(x,y,z);
    transform.rotation.y=yaw;
    transform.scale.set(w,h,d);
    transform.updateMatrix();
    mesh.setMatrixAt(index,transform.matrix);
   }
   mesh.name='Fachadas · molduras Prestes Maia';
   mesh.computeBoundingSphere();
   mesh.receiveShadow=true;
   mesh.visible=false;
   root.add(mesh);
   meshes.push(mesh);
  }
  bays.clear();
 }
 function update(position,quality) {
  if(!position)return;
  const {x,z}=position;
  if(quality===priorQuality && (x-priorX)**2+(z-priorZ)**2<16)return;
  priorQuality=quality;priorX=x;priorZ=z;
  const range=quality==='low'?45:80;
  for(const mesh of meshes){
   const {center,radius}=mesh.boundingSphere;
   mesh.visible=Math.hypot(x-center.x,z-center.z)<range+radius;
  }
 }
 return {handleWall,finish,update};
}

export function facadeSeed(id) {
 return (Math.abs(Math.imul(Number(id) || 1,2654435761)) % 1009) / 1008;
}

export function facadeUV(width, floor, points) {
 return points.map((point,index)=>[(index===1||index===2?width:0)/wallModuleMeters,(point[1]-floor)/wallModuleMeters]);
}

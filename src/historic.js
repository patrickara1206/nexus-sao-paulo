import * as T from 'three';
import {segmentDistance} from './geography.js';
import {pbrMaterial} from './lab.js';
import {createTrees} from './trees.js';
import {addHistoricLandmarks, landmarkViews} from './historic-landmarks.js';
import {addHistoricScenery} from './historic-scenery.js';
import {createSePalms,sePalmLocations} from './plaza-palms.js';

const tile = 280;
const bucketSize = 32;
const footways = new Set(['footway', 'path', 'cycleway', 'pedestrian', 'steps', 'living_street']);
const plazaLevels = [
 {a:[2201,-1110],b:[2258,-1285],radius:45,blend:76,height:30},
 {a:[1733,-1730],b:[1759,-1793],radius:32,blend:55,height:18},
 {a:[2347,-1464],b:[2384,-1490],radius:35,blend:65,height:24},
];

export function historicTerrain({terrain, bounds}) {
 const {step, rows, cols, ys} = terrain;
 // Radar can return roofs in dense blocks. Use a low neighborhood percentile,
 // then smooth transitions and level the plazas to representative street heights.
 const lowCells = ys.map((height, index) => {
  const row = Math.floor(index / cols), col = index % cols;
  const nearby=[];
  for(let dz=-2;dz<=2;dz++)for(let dx=-2;dx<=2;dx++){
   if(row+dz<0||row+dz>=rows||col+dx<0||col+dx>=cols)continue;
   nearby.push(ys[index+dz*cols+dx]);
  }
  nearby.sort((a,b)=>a-b);
  return T.MathUtils.lerp(nearby[Math.floor(nearby.length*.33)],height,.14);
 });
 const elevations=lowCells.map((height,index)=>{
  const row=Math.floor(index/cols),col=index%cols;
  let total=height*4,weight=4;
  for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){
   if(!(dz||dx)||row+dz<0||row+dz>=rows||col+dx<0||col+dx>=cols)continue;
   const scale=dx&&dz?1:2;
   total+=lowCells[index+dz*cols+dx]*scale;
   weight+=scale;
  }
  let level=total/weight;
  const x=bounds.minX+col*step,z=bounds.minZ+row*step;
  for(const {a,b,radius,blend,height:plaza} of plazaLevels){
   const strength=1-T.MathUtils.smoothstep(segmentDistance(x,z,a,b),radius,radius+blend);
   level=T.MathUtils.lerp(level,plaza,strength);
  }
  return level;
 });
 function sample(x, z) {
  const u = T.MathUtils.clamp((x - bounds.minX) / step, 0, cols - 1.00001);
  const v = T.MathUtils.clamp((z - bounds.minZ) / step, 0, rows - 1.00001);
  const col = Math.floor(u), row = Math.floor(v), fx = u - col, fz = v - row;
  const i = row * cols + col;
  const a = elevations[i], b = elevations[i + 1], c = elevations[i + cols], d = elevations[i + cols + 1];
  // Match the diagonal used by the terrain mesh.
  return fx + fz < 1 ? a + (b - a) * fx + (c - a) * fz : d + (c - d) * (1 - fx) + (b - d) * (1 - fz);
 }
 return {elevations, sample};
}

function materials() {
 const street = pbrMaterial('asphalt_02', 1), paving = pbrMaterial('concrete_pavement', 1);
 street.color.set('#777c7c');
 paving.color.set('#c5b8ab');
 street.side = paving.side = T.DoubleSide;
 return {
  street, paving,
  ground: new T.MeshStandardMaterial({color:'#8b8779',roughness:.99}),
  park: new T.MeshStandardMaterial({color:'#586448',roughness:.98,side:T.DoubleSide}),
  water: new T.MeshStandardMaterial({color:'#587a7d',roughness:.41,metalness:.18,side:T.DoubleSide}),
  wall: new T.MeshStandardMaterial({vertexColors:true,roughness:.94,side:T.DoubleSide}),
  roof: new T.MeshStandardMaterial({vertexColors:true,roughness:.98,side:T.DoubleSide}),
 };
}

function meshBatches(root, materials) {
 const batches = new Map();
 function batch(kind, x, z) {
  const key = `${kind}:${Math.floor(x/tile)},${Math.floor(z/tile)}`;
  if (!batches.has(key)) batches.set(key,{kind, positions:[], uv:[], colors:[]});
  return batches.get(key);
 }
 function triangle(out, a, b, c, color) {
  for (const point of [a,b,c]) {
   out.positions.push(...point);
   out.uv.push(point[0] / 4, point[2] / 4);
   if (color) out.colors.push(color.r,color.g,color.b);
  }
 }
 function quad(out, a,b,c,d,color) {
  triangle(out,a,b,c,color);
  triangle(out,a,c,d,color);
 }
 function finish() {
  for (const [key, {kind,positions,uv,colors}] of batches) {
   if (!positions.length) continue;
   const geo = new T.BufferGeometry();
   geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));
   geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
   if (colors.length) geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));
   geo.computeVertexNormals();
   const mesh = new T.Mesh(geo,materials[kind]);
   mesh.name = 'Centro · ' + key;
   mesh.castShadow = kind === 'wall' || kind === 'roof';
   mesh.receiveShadow = true;
   root.add(mesh);
  }
  batches.clear();
 }
 return {batch, triangle, quad, finish};
}

function createGround(data, elevations, material) {
 const {bounds,terrain:{cols,rows,step}} = data;
 const positions=[], indices=[];
 for(let row=0;row<rows;row++){
  for(let col=0;col<cols;col++){
   const i=row*cols+col;
   positions.push(bounds.minX+col*step,elevations[i],bounds.minZ+row*step);
   if(col<cols-1&&row<rows-1){
    indices.push(i,i+cols,i+1,i+1,i+cols,i+cols+1);
   }
  }
 }
 const geometry = new T.BufferGeometry();
 geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
 geometry.setIndex(indices);
 geometry.computeVertexNormals();
 const mesh = new T.Mesh(geometry,material);
 mesh.name = 'Terreno Centro Histórico';
 mesh.receiveShadow = true;
 return mesh;
}

function ringTriangles(rings) {
 const [outer,...holes] = rings.map(ring=>ring.map(([x,z])=>new T.Vector2(x,z)));
 return T.ShapeUtils.triangulateShape(outer,holes).map(indices=>{
  const points = [outer,...holes].flat();
  return indices.map(index=>[points[index].x,points[index].y]);
 });
}

function polygonBounds(points) {
 const xs=points.map(point=>point[0]), zs=points.map(point=>point[1]);
 const minX=Math.min(...xs), maxX=Math.max(...xs), minZ=Math.min(...zs), maxZ=Math.max(...zs);
 return {minX,maxX,minZ,maxZ,x:(minX+maxX)/2,z:(minZ+maxZ)/2,w:maxX-minX,d:maxZ-minZ};
}

function isInside(x,z,points) {
 let inside=false;
 for(let i=0,j=points.length-1;i<points.length;j=i++){
  const [ax,az]=points[i],[bx,bz]=points[j];
  if((az>z)!==(bz>z)&&x<(bx-ax)*(z-az)/(bz-az)+ax)inside=!inside;
 }
 return inside;
}

function nearRing(x,z,points,radius) {
 return points.some((a,i)=>segmentDistance(x,z,a,points[(i+1)%points.length])<radius);
}

function collisionIndex({buildings,trees,bounds}) {
 const cells=new Map(),colliders=[];
 function insert(item){
  colliders.push(item);
  for(let z=Math.floor((item.minZ-2)/bucketSize);z<=Math.floor((item.maxZ+2)/bucketSize);z++){
   for(let x=Math.floor((item.minX-2)/bucketSize);x<=Math.floor((item.maxX+2)/bucketSize);x++){
    const key=x+','+z;
    if(!cells.has(key))cells.set(key,[]);
    cells.get(key).push(item);
   }
  }
 }
 for(const building of buildings){
  if(building.kind==='roof')continue;
  const [points,...holes]=building.rings;
  insert({...polygonBounds(points),points,holes});
 }
 for(const [x,z] of [...trees,...sePalmLocations]){
  insert({x,z,w:.56,d:.56,minX:x-.28,maxX:x+.28,minZ:z-.28,maxZ:z+.28});
 }
 function canMove(x,z,radius=.3){
  if(x<bounds.minX+6||x>bounds.maxX-6||z<bounds.minZ+6||z>bounds.maxZ-6)return false;
  const list=cells.get(Math.floor(x/bucketSize)+','+Math.floor(z/bucketSize))??[];
  return !list.some(item=>{
   if(x<item.minX-radius||x>item.maxX+radius||z<item.minZ-radius||z>item.maxZ+radius)return false;
   if(!item.points)return true;
   if(nearRing(x,z,item.points,radius))return true;
   if(!isInside(x,z,item.points))return false;
   return !item.holes.some(hole=>isInside(x,z,hole)&&!nearRing(x,z,hole,radius));
  });
 }
 return {colliders,canMove};
}

function addBuilding(batch,building,terrainHeight){
 const points=building.rings[0],{x,z}=polygonBounds(points);
 const floor=terrainHeight(x,z),top=floor+building.h;
 const walls=batch.batch('wall',x,z), roof=batch.batch('roof',x,z);
 const neutral=new T.Color().setHSL(.09+(building.id%5)*.02,.055+(building.id%9)*.01,.32+(building.id%13)*.012);
 const topColor=neutral.clone().multiplyScalar(.84);
 for(const ring of building.rings){
  for(let i=0;i<ring.length;i++){
   const [ax,az]=ring[i],[bx,bz]=ring[(i+1)%ring.length];
   const baseA=Math.min(terrainHeight(ax,az)-.18,top-.6),baseB=Math.min(terrainHeight(bx,bz)-.18,top-.6);
   batch.quad(walls,[ax,baseA,az],[bx,baseB,bz],[bx,top,bz],[ax,top,az],neutral);
  }
 }
 for(const triangle of ringTriangles(building.rings)){
  batch.triangle(roof,...triangle.map(([px,pz])=>[px,top,pz]),topColor);
 }
}

function addSurface(batch,surface,terrainHeight){
 const {x,z}=polygonBounds(surface.rings[0]);
 const kind=surface.kind==='plaza'||surface.id===75488634?'paving':surface.kind;
 const output=batch.batch(kind,x,z),offset=kind==='park'?.09:kind==='paving'?.125:.15;
 function triangle(a,b,c){
  const edges=[Math.hypot(b[0]-a[0],b[1]-a[1]),Math.hypot(c[0]-b[0],c[1]-b[1]),Math.hypot(a[0]-c[0],a[1]-c[1])];
  const longest=Math.max(...edges);
  if(longest>7){
   const points=[a,b,c],i=edges.indexOf(longest),left=points[i],right=points[(i+1)%3],opp=points[(i+2)%3];
   const middle=[(left[0]+right[0])/2,(left[1]+right[1])/2];
   triangle(left,middle,opp);
   triangle(middle,right,opp);
   return;
  }
  batch.triangle(output,...[a,b,c].map(([px,pz])=>[px,terrainHeight(px,pz)+offset,pz]));
 }
 for(const face of ringTriangles(surface.rings))triangle(...face);
}

function addRoad(batch,road,terrainHeight){
 if(road.bridge)return;
 const kind=footways.has(road.kind)?'paving':'street';
 const sidewalk=kind==='street'&&road.kind!=='motorway'&&road.kind!=='trunk'&&road.kind!=='service';
 const half=road.width*.5;
 for(let i=1;i<road.points.length;i++){
  const [x,z]=road.points[i-1],[ex,ez]=road.points[i];
  const dx=ex-x,dz=ez-z,length=Math.hypot(dx,dz);
  if(length<.08)continue;
  const nx=dz/length,nz=-dx/length,parts=Math.ceil(length/5);
  const surface=batch.batch(kind,(x+ex)*.5,(z+ez)*.5);
  const shoulder=sidewalk?batch.batch('paving',(x+ex)*.5,(z+ez)*.5):null;
  function point(progress,offset,y){
   const px=x+dx*progress+nx*offset,pz=z+dz*progress+nz*offset;
   return [px,terrainHeight(px,pz)+y,pz];
  }
  for(let part=0;part<parts;part++){
   const a=part/parts,b=(part+1)/parts,offset=kind==='street'?.105:.118;
   batch.quad(surface,point(a,-half,offset),point(a,half,offset),point(b,half,offset),point(b,-half,offset));
   if(shoulder){
    for(const side of [-1,1]){
     const inner=side*half,outer=side*(half+1.6);
     batch.quad(shoulder,point(a,inner,.16),point(a,outer,.16),point(b,outer,.16),point(b,inner,.16));
    }
   }
  }
 }
}

function safeView(x,z,canMove,lookX,lookZ,bounds) {
 const usable=(px,pz)=>px>bounds.minX+12&&px<bounds.maxX-12&&pz>bounds.minZ+12&&pz<bounds.maxZ-12&&canMove(px,pz,.8);
 function visible(px,pz){
  if(!usable(px,pz))return false;
  const length=Math.hypot(px-lookX,pz-lookZ)||1;
  const dx=(px-lookX)/length,dz=(pz-lookZ)/length;
  return [2,4,5.5].every(distance=>canMove(px+dx*distance,pz+dz*distance,.4));
 }
 if(visible(x,z))return {x,z};
 const heading=Math.atan2(z-lookZ,x-lookX);
 let fallback=usable(x,z)?{x,z}:null;
 for(let distance=2;distance<=72;distance+=2){
  for(let slice=0;slice<24;slice++){
   const angle=heading+slice*Math.PI/12;
   const px=x+Math.cos(angle)*distance,pz=z+Math.sin(angle)*distance;
   if(visible(px,pz))return {x:px,z:pz};
   if(!fallback&&usable(px,pz))fallback={x:px,z:pz};
  }
 }
 return fallback;
}

export function historicDestinations(data,groundHeight,canMove) {
 return data.pois.flatMap(point=>{
  const object=data.buildings.find(item=>item.id===point.sourceId)??data.surfaces.find(item=>item.id===point.sourceId);
  const fallback=object?polygonBounds(object.rings[0]):{x:point.anchor[0],z:point.anchor[1]};
  const view=landmarkViews[point.id];
  const [x,z]=view?.target??[fallback.x,fallback.z];
  const [vx,vz]=view?.camera??point.anchor;
  const stand=safeView(vx,vz,canMove,x,z,data.bounds);
  if(!stand)return [];
  const heading=Math.atan2(stand.x-x,stand.z-z);
  const pitch=view?.pitch??-.065;
  return [{...point,x,z,heading,pitch,spawn:{...stand,y:groundHeight(stand.x,stand.z),heading,pitch}}];
 });
}

export async function createHistoric(scene){
 const response=await fetch('/data/historic.json');
 if(!response.ok)throw new Error('Erro ao carregar o mapa do Centro Histórico.');
 const data=await response.json();
 const root=new T.Group();
 root.name='Centro Histórico de São Paulo';
 root.visible=false;
 const mats=materials();
 const {elevations,sample}=historicTerrain(data);
 const terrainFloor=(x,z)=>sample(x,z)+.145;
 const {colliders,canMove}=collisionIndex(data);
 const batches=meshBatches(root,mats);
 root.add(createGround(data,elevations,mats.ground));
 const {suppressedBuildingIds}=addHistoricLandmarks(root,terrainFloor,data);
 const scenery=addHistoricScenery(root,terrainFloor,data);
 const floor=(x,z,y)=>scenery.groundHeightAt(x,z,y)??terrainFloor(x,z);
 for(const building of data.buildings){
  if(!suppressedBuildingIds.has(building.id)&&!scenery.suppressedBuildingIds.has(building.id))addBuilding(batches,building,sample);
 }
 for(const surface of data.surfaces)addSurface(batches,surface,sample);
 for(const road of data.roads)if(!scenery.suppressedRoadIds.has(road.id))addRoad(batches,road,sample);
 batches.finish();

 const flora=createTrees(data.trees.map(([x,z,height])=>({x,z,height,mapped:true})),terrainFloor);
 root.add(flora.root,createSePalms(terrainFloor));
 const pois=historicDestinations(data,floor,canMove);
 const spawn=pois.find(point=>point.id==='se')?.spawn;
 if(!spawn)throw new Error('A saída da Praça da Sé ficou bloqueada.');
 scene.add(root);
 return {root,bounds:data.bounds,colliders,canMove,groundHeight:floor,pois,spawn,streets:data.roads,ready:flora.ready};
}

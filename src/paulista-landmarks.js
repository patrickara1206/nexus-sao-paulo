import * as T from 'three';
import {batchStatic} from './scene-batching.js';
import {canMove, nearestStreet} from './geography.js';
import {inPaulistaCorridor, paulistaEndPoints} from './paulista-corridor.js';
import {paulistaRoutes} from './street-layout.js';
import {routeDistance, sampleRoute} from './transport-math.js';
import data from './paulista-corridor-data.json' with {type:'json'};

const cellSize = 130;
const volumePalette = ['#a69e91', '#bfbbaf', '#a5a7a7', '#969c9c', '#b3aba0'].map(color => new T.Color(color));

function bounds(points) {
 let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
 for (const [x,z] of points) {
  minX = Math.min(minX,x); maxX = Math.max(maxX,x);
  minZ = Math.min(minZ,z); maxZ = Math.max(maxZ,z);
 }
 return {x:(maxX+minX)/2, z:(maxZ+minZ)/2, w:maxX-minX, d:maxZ-minZ};
}

function prism(builder, points, bottom, top, color) {
 const outline = points.map(([x,z]) => new T.Vector2(x,z));
 const orientation = T.ShapeUtils.isClockWise(outline);
 const vertex = (i,y) => {
  builder.positions.push(points[i][0],y,points[i][1]);
  builder.colors.push(color.r,color.g,color.b);
 };
 for(const [a,b,c] of T.ShapeUtils.triangulateShape(outline,[])){
  const area=(points[b][0]-points[a][0])*(points[c][1]-points[a][1])-
   (points[b][1]-points[a][1])*(points[c][0]-points[a][0]);
  vertex(a,top); vertex(area<0?b:c,top); vertex(area<0?c:b,top);
 }
 for(let i=0; i<points.length; i++){
  const j=(i+1)%points.length;
  const [a,b]=orientation?[j,i]:[i,j];
  vertex(a,bottom); vertex(a,top); vertex(b,bottom);
  vertex(a,top); vertex(b,top); vertex(b,bottom);
 }
}

function drawVolumes(root, colliders, base) {
 const tiles = new Map();
 for (const volume of data.volumes) {
  const size=bounds(volume.p);
  const key=Math.floor(size.x/cellSize)+','+Math.floor(size.z/cellSize);
  if(!tiles.has(key))tiles.set(key,{positions:[],colors:[]});
  const color=volume.color?new T.Color(volume.color):volumePalette[volume.id%volumePalette.length];
  prism(tiles.get(key),volume.p,base+(volume.min||0)-.06,base+volume.h,color);
  if((volume.min??0)<2.3)colliders.push({...size,points:volume.p});
 }
 const material=new T.MeshStandardMaterial({vertexColors:true,roughness:.88,side:T.DoubleSide});
 for(const {positions,colors} of tiles.values()){
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));
  geometry.computeVertexNormals();
  const mesh=new T.Mesh(geometry,material);
  mesh.castShadow=mesh.receiveShadow=true;
  root.add(mesh);
 }
}

function closestRoute(x,z){
 return paulistaRoutes.map(route=>({route,...routeDistance(route,x,z)}))
  .reduce((a,b)=>a.distance<=b.distance?a:b);
}

function frontFrame(record) {
 const center=bounds(record.points);
 const nearest=closestRoute(center.x,center.z);
 const sample=sampleRoute(nearest.route,nearest.along);
 const face=Math.sign((sample.x-center.x)*sample.dz-(sample.z-center.z)*sample.dx)||1;
 const normal=[sample.dz*face,-sample.dx*face];
 const tangent=[normal[1],-normal[0]];
 const local=record.points.map(([x,z])=>[
  (x-center.x)*tangent[0]+(z-center.z)*tangent[1],
  (x-center.x)*normal[0]+(z-center.z)*normal[1],
 ]);
 const size=bounds(local);
 return {
  center,normal,angle:Math.atan2(...normal),width:size.w,depth:size.d,
  local,front:size.z+size.d/2,minX:size.x-size.w/2,maxX:size.x+size.w/2,
  clearance:nearest.distance,
 };
}

const stone = new T.MeshStandardMaterial({color:'#d6c7a9',roughness:.9});
const ivory = new T.MeshStandardMaterial({color:'#eee3c7',roughness:.83});
const grey = new T.MeshStandardMaterial({color:'#a2a39d',roughness:.86});
const darkStone = new T.MeshStandardMaterial({color:'#24282a',roughness:.8});
const slate = new T.MeshStandardMaterial({color:'#5b6568',roughness:.77});
const glass = new T.MeshStandardMaterial({color:'#304954',roughness:.2,metalness:.4});
const frosted = new T.MeshPhysicalMaterial({color:'#aab9ba',roughness:.41,metalness:.11,transparent:true,opacity:.84});
const frameMetal = new T.MeshStandardMaterial({color:'#616b6b',roughness:.55,metalness:.45});
const water = new T.MeshStandardMaterial({color:'#728f83',roughness:.16,metalness:.39});
const iron = new T.MeshStandardMaterial({color:'#383d36',roughness:.7,metalness:.45});
const wood = ['#a77e55','#bd966e','#d2ad82','#deb98b','#9b7658'].map(color=>new T.MeshStandardMaterial({color,roughness:.9}));
const foliage = new T.MeshStandardMaterial({color:'#4b5e3f',roughness:.96});
const rose = new T.MeshStandardMaterial({color:'#ad4d57',roughness:.86});
const boxGeometry = new T.BoxGeometry(1,1,1);
const sphere = new T.IcosahedronGeometry(1,1);
const cylinder = new T.CylinderGeometry(1,1,1,20);

function put(parent,geometry,material,x,y,z,w,h,d){
 const mesh=new T.Mesh(geometry,material);
 mesh.position.set(x,y,z);
 mesh.scale.set(w,h,d);
 mesh.castShadow=mesh.receiveShadow=true;
 parent.add(mesh);
 return mesh;
}
function box(parent,material,x,y,z,w,h,d){
 return put(parent,boxGeometry,material,x,y+h/2,z,w,h,d);
}
function beam(parent,material,a,b,w,d=w){
 const start=new T.Vector3(...a), end=new T.Vector3(...b);
 const center=start.clone().add(end).multiplyScalar(.5);
 const mesh=put(parent,boxGeometry,material,...center,w,start.distanceTo(end),d);
 mesh.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),end.sub(start).normalize());
}
function solid(parent,points,bottom,top,material){
 const builder={positions:[],colors:[]};
 prism(builder,points,bottom,top,volumePalette[0]);
 const geometry=new T.BufferGeometry();
 geometry.setAttribute('position',new T.Float32BufferAttribute(builder.positions,3));
 const uv=[];
 for(let i=0;i<builder.positions.length;i+=3)uv.push(builder.positions[i]*.25,builder.positions[i+1]*.25);
 geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
 geometry.computeVertexNormals();
 const mesh=new T.Mesh(geometry,material);
 mesh.castShadow=mesh.receiveShadow=true;
 parent.add(mesh);
}
function textPanel(parent,text,x,y,z,width,height,inverse=false){
 const canvas=document.createElement('canvas');
 canvas.width=512;canvas.height=96;
 const context=canvas.getContext('2d');
 context.fillStyle=inverse?'#d7dedb':'#252c2d';
 context.textAlign='center';context.textBaseline='middle';
 context.font='650 40px system-ui';context.fillText(text,256,48,486);
 const texture=new T.CanvasTexture(canvas);
 texture.colorSpace=T.SRGBColorSpace;
 const mesh=new T.Mesh(new T.PlaneGeometry(width,height),new T.MeshBasicMaterial({
  map:texture,transparent:true,depthWrite:false,
 }));
 mesh.position.set(x,y,z);
 parent.add(mesh);
}

// The façade treatments reproduce documented defining features; placement and
// envelopes are driven by mapped outlines. No photographs are baked in.
function japanHouse(group, frame){
 const {front,local,width,minX,maxX,depth}=frame;
 const faceWidth=Math.min(width,36);
 solid(group,local,0,11.6,darkStone);
 box(group,glass,0,.25,front+.02,faceWidth,10.7,.11);
 for(let i=0;i<216;i++){
  const x=(i/216-.5)*faceWidth;
  const offset=(i*73%31)/31;
  const floor=3.2+(i*47%41)*.063;
  box(group,wood[i%5],x,floor,front+.17+offset*.38,.078+offset*.076,11.1-floor,.21);
  if(i%3===0)box(group,wood[(i+2)%5],x+.037,5.6+(i%13)*.11,front+.48,.15,3.4,.11);
 }
 for(let i=0;i<46;i++){
  const x=(i/46-.5)*faceWidth;
  box(group,wood[i%5],x,0,front+.12,.045,.54+(i%17)*.015,.064);
 }
 for(const x of [minX,maxX]){
  for(let y=2.4;y<10.6;y+=.91){
   for(let z=front-depth*.62;z<front-.9;z+=.93){
    const side=x===minX?-1:1;
    box(group,ivory,x+side*.014,y,z,.17,.14,.79);
    box(group,ivory,x+side*.014,y,z,.17,.78,.13);
   }
  }
 }
 textPanel(group,'JAPAN HOUSE',0,2.4,front+.16,9,1.55,true);
}

function imsPaulista(group,frame,height){
 const {front,local,width,depth}=frame;
 solid(group,local,0,3.4,darkStone);
 const girder=height*.455;
 solid(group,local,3.4,height-1,grey);
 box(group,glass,0,.14,front+.012,width*.94,3.28,.08);
 box(group,frosted,0,3.4,front+.085,width*.98,height-4.2,.18);
 box(group,glass,0,girder-1,front+.185,width*.94,3.8,.11);
 const columns=8;
 for(let i=0;i<=columns;i++){
  const x=width*(i/columns-.5);
  box(group,frameMetal,x,3.4,front+.22,.065,height-4,.042);
 }
 for(let y=3.6;y<height-.4;y+=4.6){
  box(group,frameMetal,0,y,front+.24,width,.115,.069);
 }
 for(let i=0;i<5;i++){
  const y=4.2+i*4.25;
  const x=-width*.39+(i%2)*width*.25;
  beam(group,frameMetal,[x,y,front+.29],
   [x+(i%2?-1:1)*width*.25,y+4.2,front+.29],.185);
 }
 box(group,darkStone,0,height-1,front-depth/2,width+.4,1,depth+.2);
 textPanel(group,'IMS Paulista',-width*.23,2.65,front+.14,7,1.05,true);
}

function bardi(group,frame,height){
 const {local,front,width}=frame;
 solid(group,local,0,5.5,glass);
 solid(group,local,5.5,height,darkStone);
 // Fine perforations are shaded rather than tessellated individually.
 const skin=new T.MeshStandardMaterial({color:'#35383a',roughness:.68,metalness:.16});
 const canvas=document.createElement('canvas');
 canvas.width=canvas.height=128;
 const context=canvas.getContext('2d');
 context.fillStyle='#767877';context.fillRect(0,0,128,128);
 context.fillStyle='#242729';
 for(let y=5;y<124;y+=9)for(let x=4;x<124;x+=9){
  context.beginPath();context.arc(x+(y%2)*2,y,1.35,0,Math.PI*2);context.fill();
 }
 const metalMap=new T.CanvasTexture(canvas);
 metalMap.colorSpace=T.SRGBColorSpace;
 metalMap.wrapS=metalMap.wrapT=T.RepeatWrapping;
 metalMap.repeat.set(8,18);
 metalMap.anisotropy=4;
 skin.map=metalMap;
 box(group,skin,0,5.5,front+.065,width,height-5.5,.084);
 for(let y=5.5;y<height;y+=2.72)box(group,frameMetal,0,y,front+.123,width,.035,.035);
 for(let x=-width*.48;x<width*.49;x+=1.34){
  box(group,frameMetal,x,0,front+.074,.07,5.45,.054);
  box(group,darkStone,x,5.5,front+.122,.035,height-5.5,.035);
 }
 textPanel(group,'MASP',0,4.25,front+.1,6,1.35,true);
}

function casaDasRosas(group,frame,height){
 const {front,local,width,depth}=frame;
 solid(group,local,0,height,stone);
 const centerZ=front-depth/2;
 box(group,ivory,0,1.45,front+.042,width,.20,.16);
 box(group,ivory,0,5.17,front+.066,width,.24,.28);
 box(group,ivory,0,height-.34,front+.055,width+.42,.34,.37);
 const feet = [[-1,1],[-1,-1],[1,-1],[1,1]].map(([s,t])=>[s*width*.45,centerZ+t*depth*.44]);
 const tops = feet.map(([x,z])=>[x*.84,centerZ+(z-centerZ)*.82]);
 const positions=[];
 for(let i=0;i<4;i++){
  const next=(i+1)%4;
  const a=[feet[i][0],height,feet[i][1]];
  const b=[feet[next][0],height,feet[next][1]];
  const c=[tops[i][0],height+2.38,tops[i][1]];
  const d=[tops[next][0],height+2.38,tops[next][1]];
  positions.push(...a,...b,...c,...b,...d,...c);
 }
 const roof=new T.BufferGeometry();
 roof.setAttribute('position',new T.Float32BufferAttribute(positions,3));roof.computeVertexNormals();
 group.add(new T.Mesh(roof,new T.MeshStandardMaterial({color:slate.color,roughness:.77,side:T.DoubleSide})));
 solid(group,tops,height+2.16,height+2.44,slate);
 const portico=Math.min(10,width*.56);
 box(group,ivory,0,.04,front+1.05,portico+1.6,.49,2.23);
 for(let i=0;i<4;i++)box(group,ivory,0,.03+i*.105,front+2.04-i*.24,portico+1.1,.11,.27);
 box(group,ivory,0,4.5,front+1.02,portico+1,.44,2.24);
 box(group,ivory,0,4.95,front+1.02,portico+.78,.11,2.07);
 for(let i=0;i<4;i++){
  const x=(i/3-.5)*portico;
  put(group,cylinder,ivory,x,2.54,front+1.87,.24,3.96,.24);
  box(group,ivory,x,.50,front+1.87,.59,.24,.56);
  box(group,ivory,x,4.31,front+1.87,.61,.19,.58);
 }
 for(let i=0;i<26;i++){
  const x=(i/25-.5)*(portico+.53);
  put(group,cylinder,ivory,x,5.34,front+2,.075,.62,.075);
 }
 box(group,ivory,0,5.63,front+2,portico+.72,.11,.18);
 for(let row=0;row<2;row++)for(let i=0;i<5;i++){
  const x=(i-2)*width*.164;
  const y=row?6.12:1.82;
  box(group,ivory,x,y-.16,front+.09,1.64,2.46,.18);
  box(group,glass,x,y,front+.187,1.25,2.15,.056);
  box(group,ivory,x,y,front+.223,.055,2.15,.038);
  box(group,ivory,x,y+1.26,front+.223,1.27,.05,.038);
 }
 box(group,darkStone,0,.55,front+.28,1.6,3.26,.105);
 for(const x of [-width*.27,0,width*.27]){
  box(group,ivory,x,height+.08,front-.78,1.57,1.33,.6);
  box(group,glass,x,height+.22,front-.46,1.08,.92,.064);
 }
 const gardenDepth=Math.max(5,Math.min(13,frame.clearance-front-7.5));
 const fountain=front+gardenDepth*.56;
 put(group,cylinder,ivory,0,.13,fountain,1.39,.25,1.39);
 put(group,cylinder,water,0,.264,fountain,1.24,.035,1.24);
 put(group,cylinder,ivory,0,.36,fountain,.27,.20,.27);
 for(const side of [-1,1]){
  for(let i=0;i<14;i++){
   const x=side*(2.7+(i%7)*.68);
   const z=front+gardenDepth*(.31+(i>6?.38:0));
   put(group,sphere,foliage,x,.29,z,.49,.31,.44);
   put(group,sphere,rose,x+.12,.56,z-.13,.12,.09,.12);
  }
  for(const y of [.18,1.47])box(group,iron,side*width*.28,y,front+gardenDepth+1.03,width*.43,.05,.062);
  for(let i=0;i<14;i++){
   const x=side*(1.75+i*.43);
   box(group,iron,x,.03,front+gardenDepth+1.02,.035,1.66,.048);
  }
 }
}

const modelBuilders = {casa:casaDasRosas,japan:japanHouse,ims:imsPaulista,'masp-bardi':bardi};
const exteriorViews={
 casa:{distance:34,pitch:-.17},
 japan:{distance:55,pitch:-.22},
 ims:{distance:74,pitch:-.28},
 'masp-bardi':{distance:114,pitch:-.34},
};

function visitSpot(point,colliders,groundHeight){
 const nearest=closestRoute(point.x,point.z);
 const ordered=[nearest.route,...paulistaRoutes.filter(route=>route!==nearest.route)];
 const valid=[];
 for(const route of ordered){
  const closest=routeDistance(route,point.x,point.z);
  const origin=point.routeFrom??closest.along;
  for(const shift of [0,-9,9,-18,18,-28,28,-46,46,-67,67,-98,98]){
   if(origin+shift<0||origin+shift>route.length)continue;
   for(const edge of [-8.25,8.25]){
    const sample=sampleRoute(route,origin+shift,edge);
    if(!inPaulistaCorridor(sample.x,sample.z)||!canMove(sample.x,sample.z,colliders,.55))continue;
    if(nearestStreet(sample.x,sample.z).distance>10)continue;
    valid.push(sample);
   }
  }
 }
 const view=exteriorViews[point.id];
 const score=sample=>Math.abs(Math.hypot(sample.x-point.x,sample.z-point.z)-(view?.distance??0));
 const best=valid.sort((a,b)=>score(a)-score(b))[0];
 if(!best)return null;
 return {
  ...point,
  pitch:view?.pitch,
  heading:Math.atan2(best.x-point.x,best.z-point.z),
  spawn:{x:best.x,z:best.z,y:groundHeight(best.x,best.z)},
 };
}

export function addPaulistaLandmarks(parent,colliders,base,groundHeight){
 const volumes=new T.Group();
 volumes.name='Volumes com contorno e altura OpenStreetMap';
 parent.add(volumes);
 drawVolumes(volumes,colliders,base);
 const destinations=[];
 for(const record of data.landmarks){
  const frame=frontFrame(record);
  const group=new T.Group();
  group.name=record.name;
  group.position.set(frame.center.x,base,frame.center.z);
  group.rotation.y=frame.angle;
  parent.add(group);
  modelBuilders[record.id](group,frame,record.height);
  batchStatic(group);
  colliders.push({...frame.center,points:record.points});
  destinations.push({id:record.id,name:record.name,x:frame.center.x,z:frame.center.z,source:record.source});
 }
 return [...destinations,...paulistaEndPoints].map(point=>visitSpot(point,colliders,groundHeight)).filter(Boolean);
}

import * as T from 'three';
import {signalPhase as localPhase} from './transport-math.js';

const cellSize = 90;
const drivingKinds = new Set(['motorway','trunk','primary','secondary','tertiary','residential','unclassified','service','living_street']);
const sourceKinds = new Set(['bus-stop','metro-entrance','rail-entrance','station','bench','bin','newsagent','signal','lamp','crossing','tree','barrier','sign','hydrant']);
const qualityLevels = {
 low: {range:135, lights:0},
 medium: {range:210, lights:2},
 ultra: {range:285, lights:3},
};
const geometry = {
 box: new T.BoxGeometry(1,1,1),
 round: new T.CylinderGeometry(.47,.50,1,10),
 pipe: new T.CylinderGeometry(.5,.5,1,8),
};
const dark = '#282f30';
const standard = (color, roughness=.75, metalness=0) =>
 new T.MeshStandardMaterial({color,roughness,metalness});

const materials = {
 metal:standard('#485357',.58,.55),
 railing:standard('#2e3d40',.61,.55),
 housing:standard(dark,.72,.23),
 zinc:standard('#929a98',.52,.4),
 masonry:standard('#b8b4a8',.93),
 step:standard('#8e9084',.90),
 tactile:standard('#bd9b4b',.92),
 wood:standard('#8a5535',.82),
 transit:standard('#245d80',.71),
 station:standard('#164875',.62),
 sign:standard('#e2e5df',.66),
 glass:standard('#6c919b',.27,.45),
 storefront:standard('#5d7778',.32,.45),
 shutter:standard('#607e77',.74,.25),
 hydrant:standard('#a74328',.62,.36),
 lens: new T.MeshStandardMaterial({color:'#fff0c4',emissive:'#ffcf86',emissiveIntensity:0,roughness:.38}),
 signalOff:standard('#4d5553',.43,.17),
 red: new T.MeshStandardMaterial({color:'#fe7049',emissive:'#ff280f',emissiveIntensity:2.35,roughness:.31}),
 amber: new T.MeshStandardMaterial({color:'#ffcc49',emissive:'#ff9208',emissiveIntensity:2.2,roughness:.31}),
 green: new T.MeshStandardMaterial({color:'#65fca0',emissive:'#1be565',emissiveIntensity:2.15,roughness:.31}),
};

function featureKind(feature) {
 if (sourceKinds.has(feature.kind)) return feature.kind;
 const tags=feature.tags??{};
 if (tags.highway==='bus_stop'||tags.public_transport==='platform'&&tags.bus==='yes') return 'bus-stop';
 if (tags.railway==='subway_entrance') return 'metro-entrance';
 if (tags.railway==='train_station_entrance'||tags.railway==='tram_stop') return 'rail-entrance';
 if (tags.railway==='station'||tags.public_transport==='station') return 'station';
 if (tags.amenity==='bench') return 'bench';
 if (tags.amenity==='waste_basket') return 'bin';
 if (tags.shop==='kiosk'||tags.shop==='newsagent') return 'newsagent';
 if (tags.highway==='traffic_signals') return 'signal';
 if (tags.highway==='street_lamp') return 'lamp';
 if (tags.highway==='crossing') return 'crossing';
 if (tags.barrier) return 'barrier';
 if (tags.traffic_sign) return 'sign';
 if (tags.emergency==='fire_hydrant') return 'hydrant';
 return null;
}

function cellKey(x,z) {
 return `${Math.floor(x/cellSize)},${Math.floor(z/cellSize)}`;
}

function roadSegments(roads) {
 const cells=new Map();
 for(const road of roads){
  if(road.bridge||!drivingKinds.has(road.kind))continue;
  for(let i=1;i<(road.points?.length??0);i++){
   const [x,z]=road.points[i-1], [ex,ez]=road.points[i];
   const length=Math.hypot(ex-x,ez-z);
   if(length<.2)continue;
   const item={x,z,vx:(ex-x)/length,vz:(ez-z)/length,length,width:road.width??6.1};
   for(let cx=Math.floor((Math.min(x,ex)-25)/cellSize);cx<=Math.floor((Math.max(x,ex)+25)/cellSize);cx++){
    for(let cz=Math.floor((Math.min(z,ez)-25)/cellSize);cz<=Math.floor((Math.max(z,ez)+25)/cellSize);cz++){
     const key=`${cx},${cz}`;
     if(!cells.has(key))cells.set(key,[]);
     cells.get(key).push(item);
    }
   }
  }
 }
 return function nearest(x,z){
  let closest=null;
  for(const segment of cells.get(cellKey(x,z))??[]){
   const {vx,vz,length}=segment;
   const along=T.MathUtils.clamp((x-segment.x)*vx+(z-segment.z)*vz,0,length);
   const sx=segment.x+vx*along,sz=segment.z+vz*along;
   const distance=Math.hypot(sx-x,sz-z);
   if(!closest||closest.distance>distance)closest={...segment,sx,sz,distance};
  }
  return closest;
 };
}

function angleFor(tags,road,type,x,z) {
 const heading=tags.direction??tags['traffic_signals:direction'];
 if (heading!==undefined&&Number.isFinite(Number(heading))) return Math.PI-Number(heading)*Math.PI/180;
 if(!road)return 0;
 const tangent=Math.atan2(road.vx,road.vz);
 if(type==='signal'||type==='sign')return tangent+(heading==='forward'?Math.PI:0);
 const side=(x-road.sx)*road.vz-(z-road.sz)*road.vx;
 return tangent+(side>=0?-Math.PI/2:Math.PI/2);
}

function phaseFor(signal,signals) {
 const key=String(signal.feature.id);
 const matches=signals.filter(peer=>String(peer.id)===key||String(peer.sourceId)===key||Math.hypot(peer.x-signal.feature.x,peer.z-signal.feature.z)<8);
 return matches.find(peer=>Number.isFinite(peer.yaw)&&Math.cos(peer.yaw-signal.yaw)<-.5)
  ?? matches[0] ?? null;
}

function tintSignal(phase){
 if(phase==='yellow')return 'amber';
 return phase==='green'||phase==='amber'||phase==='red' ? phase : 'red';
}

// Substitutes for missing lamp inventory only along mapped avenue sidewalks.
// They are kept separate from OSM features and retain their dimensional rule.
export function inferredAvenueLamps(roads,features,canMove=()=>true){
 const placements=[];
 const known=features.filter(feature=>feature.kind==='lamp');
 for(const road of roads){
  if(road.name!=='Avenida Prestes Maia'||road.bridge||road.tunnel||!drivingKinds.has(road.kind))continue;
  for(const [side,sign] of [['left',-1],['right',1]]){
   if(!['yes','separate'].includes(road.sidewalks?.[side]?.mode))continue;
   let station=0,at=14;
   for(let i=1;i<road.points.length;i++){
    const [ax,az]=road.points[i-1],[bx,bz]=road.points[i];
    const length=Math.hypot(bx-ax,bz-az);
    if(length<.01)continue;
    const dx=(bx-ax)/length,dz=(bz-az)/length, offset=sign*(road.width*.5+.6);
    for(;at<station+length;at+=28){
     const x=ax+(at-station)*dx-dz*offset,z=az+(at-station)*dz+dx*offset;
     if(!canMove(x,z,.2)||known.some(p=>Math.hypot(p.x-x,p.z-z)<22)
       ||placements.some(p=>Math.hypot(p.x-x,p.z-z)<21))continue;
     placements.push({id:'lamp-'+road.id+'-'+side+'-'+at,kind:'lamp',x,z,tags:{},
      positionSource:'estimated',roadId:road.id});
    }
    station+=length;
   }
  }
 }
 return placements;
}

function buildProps(place, kind, tag, feature, lampTargets, labels, signals, pose) {
 const box=(material,x,y,z,w,h,d)=>place('box',material,x,y,z,w,h,d);
 const pipe=(material,x,y,z,w,h)=>place('round',material,x,y,z,w,h,w);
 const post=(x,z,height)=>pipe('zinc',x,height*.5,z,.075,height);
 const sign=(text, subtitle, x,y,z,width=.64,height=.25) => {
  if(text)labels.push({text,subtitle,x,y,z,width,height,pose});
 };
 const {x,z,y,yaw}=pose;
 if(kind==='lamp'){
  const height=T.MathUtils.clamp(Number.parseFloat(tag.height)||8,3.8,12);
  pipe('metal',0,height*.5,0,.18,height);
  pipe('housing',0,.19,0,.30,.38);
  box('metal',0,height-.12,.54,.12,.11,1.18);
  box('housing',0,height-.09,1.06,.46,.14,.82);
  box('lens',0,height-.172,1.06,.40,.023,.72);
  lampTargets.push({x:x+Math.sin(yaw)*1.06,z:z+Math.cos(yaw)*1.06,y:y+height-.2});
 }else if(kind==='signal'){
  pipe('metal',0,2,0,.12,4);
  pipe('zinc',0,.26,0,.25,.52);
  box('housing',0,3.24,0,.43,1.16,.3);
  for(const [index,color] of ['red','amber','green'].entries()){
   const height=3.62-index*.37;
   box('housing',0,height+.128,.19,.39,.065,.43);
   place('pipe','signalOff',0,height,.159,.225,.045,.225,Math.PI/2);
   const signal=signals.at(-1);
   signal.lenses[color]=place('pipe',color,0,height,.190,.215,.045,.215,Math.PI/2,true);
  }
 }else if(kind==='bus-stop'){
  post(0,0,2.68);
  box('transit',0,2.44,0,.60,.40,.11);
  box('sign',0,1.52,.022,.40,.61,.05);
  sign(feature.name||tag.name||'PONTO DE ÔNIBUS',tag.ref,0,2.44,.059,.57,.38);
  sign('SPTrans',tag.ref||'Parada',0,1.52,.050,.38,.55);
  if(tag.shelter==='yes'||tag.covered==='yes'){
   for(const offset of [-1.45,1.45]){
    box('zinc',offset,1.12,-.60,.09,2.24,.09);
    box('zinc',offset,2.28,0,.12,.13,1.63);
   }
   box('metal',0,2.34,.02,3.18,.11,1.69);
   box('glass',0,1.35,-.62,2.77,1.09,.035);
   if(tag.bench==='yes'){
    box('metal',0,.47,-.19,2.16,.09,.39);
    for(const offset of [-.85,.85])box('metal',offset,.23,-.21,.08,.46,.29);
   }
  }
 }else if(kind==='metro-entrance'||kind==='rail-entrance'){
  const rail=kind==='rail-entrance';
  const edge=1.16,deck=.64,length=2.52;
  for(const side of [-1,1]){
   box('masonry',side*edge,.25,0,.16,.50,length);
   for(const z of [-1.20,0,1.20]){
    pipe('railing',side*edge,.76,z,.05,.65);
   }
   box('railing',side*edge,1.076,0,.05,.05,length);
   box('railing',side*edge,.85,0,.045,.048,length);
  }
  // The existing surface layer remains continuous. Expose the visible entrance
  // treads at grade without leading the player into an unbuilt concourse.
  for(let step=0;step<5;step++){
   const height=.09+deck*(4-step)/5;
   box('step',0,height/2,1.05-step*.44,2.16,height,.44);
   box('zinc',0,height+.01,1.22-step*.44,2.09,.02,.055);
  }
  box('tactile',0,.021,1.61,2.18,.032,.45);
  box('masonry',0,.45,-1.30,2.46,.90,.18);
  post(-1.13,-1.15,2.74);
  post(1.13,-1.15,2.74);
  box(rail?'transit':'station',0,2.35,-1.15,2.45,.55,.15);
  sign(feature.name||tag.name||(rail?'ACESSO FERROVIÁRIO':'METRÔ • ACESSO'),tag.ref,0,2.35,-1.065,2.39,.52);
 }else if(kind==='station'){
  // A station centroid provides a map reference but no physical entrance.
  return false;
 }else if(kind==='bench'){
  for(const side of [-1,1]){
   box('metal',side*.64,.23,0,.07,.46,.36);
   box('metal',side*.64,.67,-.19,.065,.47,.07);
  }
  for(let board=0;board<4;board++){
   box('wood',0,.458,.154-board*.102,1.63,.055,.088);
   box('wood',0,.582+board*.085,-.193,1.63,.066,.055);
  }
 }else if(kind==='bin'){
  pipe('metal',0,.41,0,.41,.82);
  pipe('housing',0,.83,0,.46,.08);
  box('housing',0,.71,.207,.22,.13,.027);
 }else if(kind==='newsagent'){
  box('shutter',0,1.21,0,2.48,2.42,1.70);
  box('housing',0,2.50,0,2.74,.15,1.95);
  box('storefront',0,1.48,.858,1.82,1.06,.041);
  box('metal',0,1.09,.906,1.99,.10,.19);
  box('sign',0,2.24,.862,2.09,.38,.042);
  sign(feature.name||tag.name||'BANCA',null,0,2.24,.886,2.04,.35);
 }else if(kind==='barrier'){
  const length=T.MathUtils.clamp(Number.parseFloat(tag.length)||1.55,.5,4);
  for(const side of [-1,1])pipe('railing',side*length*.5,.53,0,.09,1.06);
  for(const height of [.29,.63,.95])box('railing',0,height,0,length,.055,.07);
 }else if(kind==='sign'){
  post(0,0,2.36);
  box(tag.traffic_sign==='BR:R-1'?'red':'transit',0,2.42,0,.58,.50,.08);
  sign(tag.traffic_sign==='BR:R-1'?'PARE':feature.name||tag.name||tag.traffic_sign||'SINALIZAÇÃO',null,0,2.42,.043,.54,.46);
 }else if(kind==='hydrant'){
  pipe('hydrant',0,.32,0,.18,.64);
  pipe('hydrant',0,.65,0,.23,.12);
  box('hydrant',0,.44,0,.36,.13,.15);
 }else{
  // Existing pavement and foliage systems consume the same map nodes.
  return false;
 }
 return true;
}

const dummy=new T.Object3D();
function itemMatrix(pose,x,y,z,width,height,depth,tilt=0){
 const c=Math.cos(pose.yaw),s=Math.sin(pose.yaw);
 dummy.position.set(pose.x+x*c+z*s,pose.y+y,pose.z-x*s+z*c);
 dummy.quaternion.setFromEuler(new T.Euler(tilt,pose.yaw,0,'YXZ'));
 dummy.scale.set(width,height,depth);
 dummy.updateMatrix();
 return dummy.matrix.clone();
}

function addLabels(labels,cells){
 if(!labels.length||typeof document==='undefined')return;
 const atlas=document.createElement('canvas'),columns=4,tileWidth=256,tileHeight=80;
 atlas.width=columns*tileWidth;
 atlas.height=Math.ceil(labels.length/columns)*tileHeight;
 const ctx=atlas.getContext('2d');
 if(!ctx)return;
 const texture=new T.CanvasTexture(atlas);
 texture.colorSpace=T.SRGBColorSpace;
 const material=new T.MeshBasicMaterial({map:texture,side:T.FrontSide});
 const quad=[[-.5,-.5],[.5,-.5],[.5,.5],[-.5,-.5],[.5,.5],[-.5,.5]];
 const vector=new T.Vector3();
 for(const [i,label] of labels.entries()){
  const row=Math.floor(i/columns),col=i%columns;
  const px=col*tileWidth,py=row*tileHeight;
  ctx.fillStyle='#15486c';
  ctx.fillRect(px,py,tileWidth,tileHeight);
  ctx.fillStyle='#e8f4f7';
  ctx.textBaseline='middle';
  ctx.textAlign='center';
  ctx.font='bold 21px Arial';
  ctx.fillText(String(label.text).slice(0,58),px+tileWidth/2,py+(label.subtitle?28:40),tileWidth-20);
  if(label.subtitle){
   ctx.font='17px Arial';
   ctx.fillText(String(label.subtitle).slice(0,32),px+tileWidth/2,py+57,tileWidth-14);
  }
  const cell=cells.get(cellKey(label.pose.x,label.pose.z));
  const matrix=itemMatrix(label.pose,label.x,label.y,label.z,label.width,label.height,1);
  for(const [x,y] of quad){
   vector.set(x,y,0).applyMatrix4(matrix);
   cell.labelPositions.push(vector.x,vector.y,vector.z);
   cell.labelUV.push((px+1+(x+.5)*(tileWidth-2))/atlas.width,1-(py+1+(.5-y)*(tileHeight-2))/atlas.height);
  }
 }
 for(const cell of cells.values()){
  if(!cell.labelPositions.length)continue;
  const labelGeometry = new T.BufferGeometry();
  labelGeometry.setAttribute('position',new T.Float32BufferAttribute(cell.labelPositions,3));
  labelGeometry.setAttribute('uv',new T.Float32BufferAttribute(cell.labelUV,2));
  cell.root.add(new T.Mesh(labelGeometry,material));
 }
}

function signalPose(feature,road,groundHeight,canMove){
 const tags=feature.tags??{};
 const yaw=angleFor(tags,road,'signal',feature.x,feature.z);
 if(!road||road.distance>road.width*.5+.6)return {...feature,yaw};
 // A signal node usually describes the stop line, even when the pole is
 // on a verge. Offset the rendered pole perpendicular to that same carriageway.
 for(const side of [1,-1]){
  const offset=(road.width*.5+1.15)*side;
  const x=road.sx+road.vz*offset,z=road.sz-road.vx*offset;
  if(Number.isFinite(groundHeight(x,z))&&canMove(x,z,.17))return {...feature,x,z,yaw};
 }
 // Keep this node for its mapped signal/crossing; omit a pole when there is no verge.
 return null;
}

export function createUrbanPropsAndTransit(parent,{
 features=[], roads=[], links, groundHeight=()=>0, canMove=()=>true, signals=[],
}={}){
 const root=new T.Group();
 root.name='Mobiliário e acessos de transporte mapeados';
 parent.add(root);
 const nearestRoad=roadSegments(links??roads),cells=new Map(),labels=[],lampTargets=[],scenesSignals=[];
 const inferred=inferredAvenueLamps(links??roads,features,canMove);
 const counts={mapped:0,inferredLamps:inferred.length,rendered:0,byKind:{},mappedByKind:{},signalsLinked:0};
 const emitted=new Set();
 function getCell(x,z){
  const key=cellKey(x,z);
  if(!cells.has(key)){
   const group=new T.Group();
   group.name=`Mobiliário · ${key}`;
   root.add(group);
   cells.set(key,{x:(Math.floor(x/cellSize)+.5)*cellSize,z:(Math.floor(z/cellSize)+.5)*cellSize,
    root:group,batches:new Map(),lamps:[],labelPositions:[],labelUV:[]});
  }
  return cells.get(key);
 }
 for(const feature of [...features,...inferred]){
  const kind=featureKind(feature);
  if(!kind||!Number.isFinite(feature.x)||!Number.isFinite(feature.z))continue;
  const key=`${kind}:${feature.id??feature.x+','+feature.z}`;
  if(emitted.has(key))continue;
  emitted.add(key);
  if(feature.positionSource!=='estimated'){
   counts.mapped++;
   counts.mappedByKind[kind]=(counts.mappedByKind[kind]??0)+1;
  }
  if(kind==='tree'||kind==='crossing'||kind==='station')continue;
  const road=nearestRoad(feature.x,feature.z),tags=feature.tags??{};
  const placement=kind==='signal'?signalPose(feature,road,groundHeight,canMove):feature;
  if(!placement)continue;
  const pose={x:placement.x,z:placement.z,y:groundHeight(placement.x,placement.z),
   yaw:placement.yaw??angleFor(tags,road,kind,feature.x,feature.z)};
  if(!Number.isFinite(pose.y))continue;
  const cell=getCell(pose.x,pose.z);
  if(kind==='signal'){
   const item={feature,yaw:pose.yaw,cell,lenses:{}};
   item.link=phaseFor(item,signals);
   if(item.link)counts.signalsLinked++;
   scenesSignals.push(item);
  }
  const place=(shape,material,x,y,z,w,h,d,tilt=0,activeLens=false)=>{
   const matrix=itemMatrix(pose,x,y,z,w,h,d,tilt);
   if(activeLens)return matrix;
   const key=`${shape}:${material}`;
   if(!cell.batches.has(key))cell.batches.set(key,{shape,material,matrices:[]});
   cell.batches.get(key).matrices.push(matrix);
   return matrix;
  };
  if(buildProps(place,kind,tags,feature,lampTargets,labels,scenesSignals,pose)){
   counts.rendered++;
   counts.byKind[kind]=(counts.byKind[kind]??0)+1;
  }
 }
 for(const cell of cells.values()){
  for(const {shape,material,matrices} of cell.batches.values()){
   const mesh=new T.InstancedMesh(geometry[shape],materials[material],matrices.length);
   matrices.forEach((matrix,index)=>mesh.setMatrixAt(index,matrix));
   mesh.computeBoundingSphere();
   mesh.castShadow=['metal','housing','masonry','transit','shutter'].includes(material);
   mesh.receiveShadow=true;
   cell.root.add(mesh);
  }
  cell.batches.clear();
 }
 for(const item of scenesSignals)item.cell.lamps.push(item);
 const colors=['red','amber','green'];
 for(const cell of cells.values()){
  if(!cell.lamps.length)continue;
  const meshes=colors.map(color=>{
   const mesh=new T.InstancedMesh(geometry.pipe,materials[color],cell.lamps.length);
   mesh.frustumCulled=false;
   cell.root.add(mesh);
   return mesh;
  });
  cell.activeSignals={meshes,signature:null};
 }
 // Keep a single atlas below typical mobile texture limits. Every mapped
 // pole and portal is still rendered even if its label falls beyond the cap.
 addLabels(labels.slice(0,96),cells);
 const lights=Array.from({length:3},()=>{
  const spotlight=new T.SpotLight('#ffcf8b',0,27,Math.PI*.285,.77,2);
  spotlight.visible=false;
  root.add(spotlight,spotlight.target);
  return spotlight;
 });
 let lastCandidates=[], lastX=Infinity,lastZ=Infinity;
 function setSignals(next){
  counts.signalsLinked=0;
  for(const item of scenesSignals){
   item.link=phaseFor(item,next??[]);
   if(item.link)counts.signalsLinked++;
  }
 }
 function update({player,quality='medium',daylight=1,time=0,signalPhase=(signal)=>signal.phase}={}){
  if(!player)return;
  const settings=qualityLevels[quality==='high'?'ultra':quality]??qualityLevels.medium;
  const night=1-T.MathUtils.smoothstep(daylight,.12,.48);
  materials.lens.emissiveIntensity=night*2.5;
  for(const cell of cells.values()){
   cell.root.visible=Math.hypot(player.x-cell.x,player.z-cell.z)<settings.range+cellSize*.71;
   if(!cell.root.visible||!cell.activeSignals)continue;
   const phases=cell.lamps.map(item=>tintSignal(item.link?signalPhase(item.link):localPhase(time+Math.abs(Math.floor(item.feature.x*.21+item.feature.z*.165))%30)));
   const signature=phases.join('|');
   if(signature===cell.activeSignals.signature)continue;
   cell.activeSignals.signature=signature;
   for(const [i,color] of colors.entries()){
    const mesh=cell.activeSignals.meshes[i];
    let index=0;
    for(const [j,item] of cell.lamps.entries()){
     if(phases[j]===color)mesh.setMatrixAt(index++,item.lenses[color]);
    }
    mesh.count=index;
    mesh.instanceMatrix.needsUpdate=true;
   }
  }
  if(Math.hypot(player.x-lastX,player.z-lastZ)>4){
   lastX=player.x;lastZ=player.z;
   lastCandidates=lampTargets.map(lamp=>({lamp,distance:Math.hypot(lamp.x-player.x,lamp.z-player.z)}))
    .filter(item=>item.distance<=55).sort((a,b)=>a.distance-b.distance).slice(0,lights.length);
  }
  for(const [i,light] of lights.entries()){
   const lamp=lastCandidates[i]?.lamp;
   light.visible=Boolean(lamp&&i<settings.lights&&night>.06);
   if(!light.visible)continue;
   light.position.set(lamp.x,lamp.y,lamp.z);
   light.target.position.set(lamp.x,lamp.y-8,lamp.z);
   light.intensity=night*390;
  }
 }
 return {root,counts,update,setSignals};
}

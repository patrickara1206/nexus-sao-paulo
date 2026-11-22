import * as T from 'three';

const martinelliId = 191607150;
const chaId = 48651855;
const bridgeWidth = 25;
const mainSpan = 64;
const stone = '#c99b84';
const mortar = '#af8977';
const molding = '#dfbaa2';
const glass = '#464949';
const paintedMetal = '#343832';
const concrete = '#9b9a8e';

function architecturalMaterials() {
 const material = (color, roughness = .83, metalness = 0) =>
  new T.MeshStandardMaterial({color, roughness, metalness});
 return {
  stone: material(stone), mortar: material(mortar), molding: material(molding),
  glass: material(glass, .28, .25), lead: material('#806756'), roof: material('#814a3d', .96),
  sidewalk: material('#adada5', .95), pavement: material('#62646a', .98),
  concrete: material(concrete), metal: material(paintedMetal, .55, .58),
  lamp: new T.MeshStandardMaterial({color:'#fff1ca', emissive:'#f7de9e', emissiveIntensity:.23}),
 };
}

function meshes(parent, geometry, materials, parts) {
 const scratch = new T.Object3D();
 for (const [name, placements] of parts) {
  const instances = new T.InstancedMesh(geometry, materials[name], placements.length);
  for (const [index, part] of placements.entries()) {
   const [x,y,z,w,h,d,rotation = 0,pitch = 0] = part;
   scratch.position.set(x,y,z);
   scratch.scale.set(w,h,d);
   scratch.rotation.set(0,rotation,pitch,'YXZ');
   scratch.updateMatrix();
   instances.setMatrixAt(index,scratch.matrix);
  }
  instances.instanceMatrix.needsUpdate = true;
  instances.castShadow = name !== 'glass' && name !== 'lamp';
  instances.receiveShadow = true;
  instances.computeBoundingSphere();
  parent.add(instances);
 }
}

function placements() {
 const groups = new Map();
 return {
  groups,
  add(name, ...part) {
   if (!groups.has(name)) groups.set(name, []);
   groups.get(name).push(part);
  },
 };
}

function outlineArea(ring) {
 return ring.reduce((sum, [x,z], index) => {
  const [nextX,nextZ] = ring[(index + 1) % ring.length];
  return sum + x * nextZ - z * nextX;
 }, 0);
}

function ringCenter(ring) {
 const sum = ring.reduce(([x,z], [px,pz]) => [x + px,z + pz], [0,0]);
 return sum.map(axis => axis / ring.length);
}

function solid(parent, ring, height, base, material) {
 const shape = new T.Shape(ring.map(([x,z]) => new T.Vector2(x,-z)));
 const geometry = new T.ExtrudeGeometry(shape,{depth:height,bevelEnabled:false,curveSegments:1});
 geometry.rotateX(-Math.PI / 2);
 const mesh = new T.Mesh(geometry,material);
 mesh.position.y = base;
 mesh.castShadow = mesh.receiveShadow = true;
 parent.add(mesh);
}

// Four projecting masonry bays on Av. São João are part of the mapped outline.
// Heights follow their photographed base, shaft and cornices. The body ends
// at OSM's 87.2 m and the rooftop villa completes the documented 105.65 m.
function addMartinelli(parent, footprint, ground, materials) {
 const root = new T.Group();
 root.name = 'Edifício Martinelli';
 parent.add(root);
 const [ring] = footprint.rings;
 const [cx,cz] = ringCenter(ring);
 const base = ground(cx,cz);
 const terrainBottom = Math.min(...ring.map(([x,z]) => ground(x,z))) - .28;
 const y26 = footprint.h;
 solid(root,ring,y26 - 8.38,base + 3.4,materials.stone);
 solid(root,ring,base - terrainBottom + 3.4,terrainBottom,materials.mortar);
 solid(root,ring,4.98,base + y26 - 4.98,materials.molding);
 const direction = Math.sign(outlineArea(ring));
 const brackets = placements(), arches = placements();
 const longSide = ring.reduce((best, a, i) => {
  const b = ring[(i + 1) % ring.length];
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  return length > best.length ? {length, angle:Math.atan2(b[1]-a[1], b[0]-a[0])} : best;
 }, {length:0,angle:0});
 for (const [i,[x,z]] of ring.entries()) {
  const [ex,ez] = ring[(i + 1) % ring.length];
  const length = Math.hypot(ex - x, ez - z);
  if (length < .3) continue;
  const alongX = (ex - x) / length, alongZ = (ez - z) / length;
  const outX = alongZ * direction, outZ = -alongX * direction;
  const angle = -Math.atan2(alongZ, alongX);
  const put = (target, name, along, level, off, width, height, depth) =>
   target.add(name,x + alongX * along + outX * off,base + level,z + alongZ * along + outZ * off,width,height,depth,angle);
  for (const [level, height, depth] of [[3.4,.37,.31],[9.1,.42,.4],[12,.36,.32],[18.4,.33,.33],[63.6,.57,.43],[73.2,.35,.39],[81.8,.81,.89],[83.2,.37,.33],[86.8,.49,.64]]) {
   put(brackets,'molding',length/2,level,depth*.31,length+.15,height,depth);
  }
  if (length < 1.85) continue;
  const count = Math.max(1,Math.round(length / (length > 8 ? 2.95 : 2.43)));
  const size = length / count;
  for (let bay = 0; bay < count; bay++) {
   const position = size * (bay + .5);
   for (let story = 0; story < 24; story++) {
    const level = 2.1 + story * 3.53;
    const tall = story < 4 || story === 17 || story === 23;
    const w = Math.min(1.44,size*.58), h = tall ? 2.1 : 1.37;
    put(brackets,'mortar',position,level,.034,w+.24,h+.19,.1);
    put(brackets,'glass',position,level,.104,w,h,.056);
    put(brackets,'molding',position,level-h*.5-.1,.13,w+.45,.12,.33);
    put(brackets,'lead',position,level,.146,.04,h,.028);
    if (tall) {
     put(arches,'mortar',position,level+h*.5-.025,.047,w+.24,.51,.10);
     put(arches,'glass',position,level+h*.5-.026,.126,w,.42,.06);
    }
   }
   put(brackets,'molding',position,81.38,.37,.21,.48,.76);
  }
  if (length > 4) {
   for (const position of [.27,length-.27]) {
    for (let y = 4.04; y < 63; y += .81) {
     put(brackets,'molding',position,y,.055,.49,.3,.20);
    }
   }
  }
 }

 // Raised Italianate villa, attached terraces and shallow reddish roof.
 const mansion = new T.Group();
 mansion.position.set(cx + 2.6,base + y26,cz - 1.7);
 mansion.rotation.y = -longSide.angle;
 root.add(mansion);
 const villa = placements();
 villa.add('molding',0,.44,0,24.5,.88,17.6);
 villa.add('stone',0,4.3,0,22.2,8.3,14.6);
 villa.add('molding',0,8.6,0,23.1,.55,15.3);
 villa.add('stone',.2,11.7,0,13.5,5.7,10.7);
 villa.add('molding',.2,14.6,0,14.1,.53,11.4);
 for (const direction of [-1,1]) {
  for (let x = -9; x <= 9; x += 3) for (const y of [2.4,5.77]) {
   villa.add('glass',x,y,direction*7.36,1.31,1.91,.16);
   villa.add('molding',x,y-1.02,direction*7.43,1.76,.16,.31);
  }
  for (let z = -5; z <= 5; z += 2.5) for (const y of [2.4,5.77]) {
   villa.add('glass',direction*11.13,y,z,.14,1.91,1.31);
  }
  for (let x = -4.5; x <= 5; x += 2.3) {
   villa.add('glass',x,11.8,direction*5.39,1.23,1.65,.12);
  }
 }
 const ridge = new T.Mesh(new T.CylinderGeometry(.59,1,1,4),materials.roof);
 ridge.position.set(.2,(105.65-y26+14.84)/2,0);
 ridge.scale.set(10.1,105.65-y26-14.84,8.13);
 ridge.rotation.y = Math.PI/4;
 ridge.castShadow = true;
 mansion.add(ridge);
 const cube = new T.BoxGeometry();
 meshes(mansion,cube,materials,villa.groups);
 meshes(root,cube,materials,brackets.groups);
 const archShape = new T.Shape();
 archShape.moveTo(-.5,0);
 archShape.absellipse(0,0,.5,1,Math.PI,0,true,0);
 archShape.lineTo(-.5,0);
 meshes(root,new T.ExtrudeGeometry(archShape,{depth:1,bevelEnabled:false,curveSegments:5}),materials,arches.groups);
}

function addCha(parent, road, terrainHeight, materials) {
 const root = new T.Group();
 root.name = 'Viaduto do Chá';
 parent.add(root);
 const [a,b] = [road.points[0],road.points.at(-1)];
 const deltaX = b[0]-a[0], deltaZ = b[1]-a[1];
 const length = Math.hypot(deltaX,deltaZ);
 const dirX = deltaX/length, dirZ = deltaZ/length;
 root.position.set(a[0],0,a[1]);
 root.rotation.y = -Math.atan2(dirZ,dirX);
 const start = terrainHeight(...a) + .16;
 const end = terrainHeight(...b) + .16;
 const slope = (end-start) / length;
 const pitch = Math.atan(slope);
 const at = x => start + x * slope;
 const deck = placements(), lanterns=placements();
 const surface = (name,x,lateral,width,height,depth,offset) =>
  deck.add(name,x,at(x) + offset,lateral,width,height,depth,0,pitch);
 surface('concrete',length/2,0,length,.91,bridgeWidth,-.49);
 surface('pavement',length/2,0,length,.18,15,-.09);
 const halfWidth = bridgeWidth / 2;
 const railStart = 2;
 for (const side of [-1,1]) {
  surface('sidewalk',length/2,side*10,length,.16,5,-.04);
  surface('sidewalk',length/2,side*7.61,length,.23,.23,-.018);
  surface('metal',length/2,side*(halfWidth-.21),length-4,.087,.102,1.02);
  surface('metal',length/2,side*(halfWidth-.21),length-4,.053,.074,.18);
  for (let x=railStart; x<length-railStart; x+=.74) {
   deck.add('metal',x,at(x)+.6,side*(halfWidth-.21),.061,.9,.065);
  }
  for (let x=8; x<length-6; x+=17.8) {
   const z=side*(halfWidth-.78), y=at(x);
   deck.add('concrete',x,y+.33,z,.75,.66,.73);
   lanterns.add('metal',x,y+2.23,z,.137,3.68,.137);
   lanterns.add('metal',x,y+4.03,z,.29,.12,.29);
   lanterns.add('lamp',x,y+4.24,z,.38,.37,.38);
  }
 }
 meshes(root,new T.BoxGeometry(),materials,deck.groups);
 meshes(root,new T.CylinderGeometry(.5,.295,1,12),materials,lanterns.groups);

 // The central open arch, side spans and tall piers are based on the 1935
 // winning construction scheme for the present reinforced concrete bridge.
 const spanCentre = length * .594;
 const spanStart = spanCentre - mainSpan/2;
 const spanEnd = spanCentre + mainSpan/2;
 const arch = new T.Shape();
 const leftY = at(spanStart)-.89, rightY = at(spanEnd)-.89;
 arch.moveTo(spanStart,leftY);
 arch.lineTo(spanEnd,rightY);
 for (let i=24;i>=0;i--) {
  const p=i/24, x=spanStart+p*mainSpan, q=2*p-1;
  arch.lineTo(x,at(x)-2.05-9.3*q*q);
 }
 arch.closePath();
 const archMesh = new T.Mesh(new T.ExtrudeGeometry(arch,
  {depth:bridgeWidth-1.3,bevelEnabled:false,curveSegments:1}),materials.concrete);
 archMesh.position.z=-(bridgeWidth-1.3)/2;
 archMesh.castShadow=archMesh.receiveShadow=true;
 root.add(archMesh);
 const pillars = placements();
 for (const x of [spanStart,spanEnd]) {
  const [px,pz]=[a[0]+dirX*x,a[1]+dirZ*x];
  const bottom=Math.min(terrainHeight(px,pz)-.3,at(x)-12);
  pillars.add('concrete',x,(at(x)-.8+bottom)/2,0,4,at(x)-.8-bottom,bridgeWidth);
 }
 for (const x of [18,spanStart-20,spanEnd+12,length-8]) {
  const [px,pz]=[a[0]+dirX*x,a[1]+dirZ*x];
  const bottom=terrainHeight(px,pz)-.4;
  const cap=at(x)-.7;
  if(cap<=bottom) continue;
  pillars.add('concrete',x,(cap+bottom)/2,0,2.5,cap-bottom,bridgeWidth-2);
 }
 meshes(root,new T.BoxGeometry(),materials,pillars.groups);

 return function groundHeightAt(x,z,currentY) {
  const dx=x-a[0], dz=z-a[1];
  const along=dx*dirX+dz*dirZ;
  const lateral=dz*dirX-dx*dirZ;
  if(along<0||along>length||Math.abs(lateral)>halfWidth) return undefined;
  const height=at(along)+(Math.abs(lateral)>7.5?.045:0);
  // Retain the valley surface for players who approach below the deck.
  if(Number.isFinite(currentY)&&currentY<height-1.25) return undefined;
  return height;
 };
}

export function addHistoricScenery(parent, groundHeight, data) {
 const materials = architecturalMaterials();
 const suppressedBuildingIds = new Set(), suppressedRoadIds = new Set();
 const martinelli = data.buildings.find(building => building.id === martinelliId);
 const cha = data.roads.find(road => road.id === chaId);
 if (martinelli) {
  addMartinelli(parent,martinelli,groundHeight,materials);
  suppressedBuildingIds.add(martinelli.id);
 }
 const groundHeightAt = cha ? addCha(parent,cha,groundHeight,materials) : () => undefined;
 if (cha) suppressedRoadIds.add(cha.id);
 return {suppressedBuildingIds,suppressedRoadIds,groundHeightAt};
}

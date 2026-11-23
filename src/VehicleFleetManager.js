import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';

const catalogue = [
 // Kind, family, body envelope (L × W × H, metres), tyre radius and axle spacing.
 ['hatch','car',4.02,1.73,1.47,.30,2.54], ['sedan','car',4.65,1.80,1.46,.32,2.71],
 ['suv','car',4.41,1.83,1.67,.34,2.65], ['pickup','car',5.05,1.87,1.79,.36,3.08],
 ['taxi','car',4.60,1.78,1.51,.31,2.65], ['police','car',4.47,1.86,1.70,.34,2.68],
 ['motorcycle','motorcycle',2.02,.77,1.46,.31,1.34],
 ['delivery-motorcycle','motorcycle',2.06,.77,1.48,.31,1.36],
 ['bicycle','cycle',1.78,.61,1.54,.34,1.08], ['delivery-bicycle','cycle',1.89,.64,1.55,.34,1.12],
 ['shared-bicycle','cycle',1.83,.62,1.53,.34,1.10],
 ['bus','bus',12.5,2.55,3.22,.49,6.35], ['articulated-bus','bus',18.5,2.60,3.35,.50,6.30],
 ['van','van',5.96,2.02,2.63,.35,3.66], ['school-van','van',6.01,2.02,2.65,.35,3.67],
 ['minibus','van',7.1,2.18,2.85,.38,4.2], ['ambulance','van',5.98,2.05,2.75,.35,3.67],
 ['vuc','truck',6.52,2.12,2.98,.37,3.45], ['truck','truck',8.25,2.46,3.62,.46,4.59],
 ['garbage-truck','truck',8.35,2.49,3.42,.49,4.62], ['tow-truck','truck',7.29,2.31,2.79,.43,4.04],
 ['fire-truck','truck',8.2,2.49,3.23,.47,4.5],
];
export const VEHICLE_SPECS = Object.freeze(Object.fromEntries(catalogue.map(([kind,family,length,width,height,wheelRadius,wheelbase])=>{
 const narrow=family==='cycle'||family==='motorcycle';
 const lightHeight=narrow?.85:family==='bus'?.8:family==='truck'?.82:height*.39;
 const headlights=(narrow?[0]:[-1,1]).map(side=>({x:side*width*.377,y:lightHeight,z:length*.496}));
 return [kind,Object.freeze({kind,family,length,width,height,wheelRadius,wheelbase,headlights})];
})));
export const FLEET_PALETTE = ['#c3c5c5','#ebe9df','#363a40','#14191d','#7e2529','#67747c'];
const fixedPaint={taxi:'#edece4',police:'#d2d5d4',ambulance:'#f2eee7','fire-truck':'#a92018','school-van':'#f2eee2',bus:'#dcded9','articulated-bus':'#dcded9','shared-bicycle':'#ef7229','garbage-truck':'#eeeae0'};
const routeDisplays=['917H-10  TERM. PIRITUBA','175T-10  METRÔ JABAQUARA'];
const white='#ffffff', dark='#22282c', glass='#334851', ivory='#e0dfd5', silver='#a6adb0';
const pos=new T.Vector3(), size=new T.Vector3(), quat=new T.Quaternion(), euler=new T.Euler();
const matrix=new T.Matrix4(), local=new T.Matrix4(), base=new T.Matrix4(), back=new T.Matrix4();
const axisY=new T.Vector3(0,1,0), colorTmp=new T.Color();

function transform(out,x,y,z,sx=1,sy=1,sz=1,rx=0,ry=0,rz=0){
 return out.compose(pos.set(x,y,z),quat.setFromEuler(euler.set(rx,ry,rz,'YXZ')),size.set(sx,sy,sz));
}

function primitives(){
 return {
  box:new T.BoxGeometry(), soft:new RoundedBoxGeometry(1,1,1,2,.09),
  ball:new T.SphereGeometry(.5,12,8), pipe:new T.CylinderGeometry(.5,.5,1,14),
  tyre:new T.CylinderGeometry(.5,.5,1,18).rotateZ(Math.PI/2),
  ring:new T.TorusGeometry(.43,.07,6,24).rotateY(Math.PI/2),
 };
}

// Bake rigid components once; a batch carries paint, glazing or vertex-coloured trim.
function componentBuilder(shapes){
 const pieces=new Map();
 function put(layer,geometry,color,transform){
  const g=geometry.index?geometry.toNonIndexed():geometry.clone();
  g.applyMatrix4(transform);
  const count=g.attributes.position.count,c=new T.Color(color),vertexColor=new Float32Array(count*3);
  for(let i=0;i<vertexColor.length;i+=3){vertexColor[i]=c.r;vertexColor[i+1]=c.g;vertexColor[i+2]=c.b;}
  g.setAttribute('color',new T.BufferAttribute(vertexColor,3));
  if(!pieces.has(layer))pieces.set(layer,[]);
  pieces.get(layer).push(g);
 }
 function box(layer,c,x,y,z,w,h,l,shape='box',rx=0,ry=0,rz=0){
  put(layer,shapes[shape],c,transform(matrix,x,y,z,w,h,l,rx,ry,rz));
 }
 function strut(layer,c,a,b,diameter){
  const from=new T.Vector3(...a),to=new T.Vector3(...b),direction=to.clone().sub(from);
  const q=new T.Quaternion().setFromUnitVectors(axisY,direction.clone().normalize());
  put(layer,shapes.pipe,c,new T.Matrix4().compose(from.lerp(to,.5),q,new T.Vector3(diameter,direction.length(),diameter)));
 }
 // Cross sections give the bonnet, beltline, windscreen and boot independent slopes.
 function hull(layer,c,sections){
  const vertices=[],ids=[];
  for(const [z,w,y,h,top] of sections)vertices.push(-w/2,y,z,w/2,y,z,top/2,h,z,-top/2,h,z);
  for(let i=0;i<sections.length-1;i++)for(let j=0;j<4;j++){
   const a=i*4+j,b=i*4+(j+1)%4; ids.push(a,b,b+4,a,b+4,a+4);
  }
  const n=(sections.length-1)*4;ids.push(0,2,1,0,3,2,n,n+1,n+2,n,n+2,n+3);
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.setIndex(ids);g.setAttribute('uv',new T.BufferAttribute(new Float32Array(vertices.length/3*2),2));g.computeVertexNormals();
  put(layer,g,c,new T.Matrix4());g.dispose();
 }
 function finish(){
  const result={};
  for(const [layer,geometries] of pieces){result[layer]=mergeGeometries(geometries);geometries.forEach(g=>g.dispose());}
  return result;
 }
 return {box,strut,hull,finish};
}

function passenger(b,s,near){
 const {kind,length:l,width:w,height:h,wheelRadius:r}=s;
 const pickup=kind==='pickup',tall=kind==='suv'||kind==='police'||pickup,hatch=kind==='hatch'||tall;
 const sill=r*.66,belt=h*.60;
 b.hull('paint',white,[[-.49*l,w*.89,sill,belt*.94,w*.88],[-.37*l,w,sill,belt,w*.98],[.27*l,w,sill,belt,w*.97],[.493*l,w*.91,sill+.06,belt*.82,w*.86]]);
 const tail=l*(pickup?-.04:hatch?-.425:-.35),rearRoof=tail+l*(hatch?.06:.14),frontRoof=l*.078,nose=l*.25;
 b.hull('glass',white,[[tail,w*.93,belt-.018,belt,w*.89],[rearRoof,w*.93,belt-.018,h-.065,w*.77],[frontRoof,w*.93,belt-.018,h-.055,w*.78],[nose,w*.93,belt-.018,belt,w*.93]]);
 b.box('paint',white,0,h-.045,(rearRoof+frontRoof)/2,w*.79,.085,frontRoof-rearRoof+.04,'soft');
 if(!near)return;
 for(const side of [-1,1]){
  const x=side*w*.475;
  b.strut('trim',dark,[x,belt,frontRoof-l*.09],[side*w*.397,h-.06,frontRoof-l*.09],.064);
  b.strut('paint',white,[x,belt,nose],[side*w*.39,h-.055,frontRoof],.052);
  b.strut('paint',white,[x,belt,tail],[side*w*.387,h-.065,rearRoof],.097);
  b.box('trim',dark,x,.35,0,.064,.085,l*.69);
  b.box('trim',silver,x,h*.555,-.07*l,.023,.031,.13,'soft');
  b.box('paint',white,side*w*.505,belt+.05,l*.17,.16,.095,.21,'soft');
  if(kind==='taxi'||kind==='police')b.box('trim',kind==='taxi'?'#315579':'#373c41',side*w*.497,belt*.77,0,.018,kind==='taxi'?.075:.23,l*.71);
 }
 b.box('trim',dark,0,belt*.65,l*.491,w*.55,.17,.025,'soft');
 for(let i=0;i<3;i++)b.box('trim',silver,0,belt*.60+i*.032,l*.496,w*.48,.009,.016);
 if(pickup){
  b.box('trim',dark,0,belt+.006,-.245*l,w*.81,.045,.34*l);
  for(const side of [-1,1])b.box('paint',white,side*w*.44,belt+.06,-.247*l,.09,.14,.37*l);
 }
 if(kind==='taxi')b.box('trim','#f9d877',0,h+.075,0,.40,.14,.18,'soft');
 if(kind==='police')b.box('trim',dark,0,h+.062,0,.67,.11,.17,'soft');
}

function longBody(b,s,near,rear=false){
 const {kind,family,length:l,width:w,height:h,wheelRadius:r}=s;
 const articulated=kind==='articulated-bus';
 // Pivot of the rear module is the articulation, local +Z points forward.
 const front=rear?-.24:l*.492,end=rear?-l*.426:articulated?-l*.057:-l*.492;
 const len=front-end,mid=(end+front)/2,low=r*.62;
 const stripe=kind==='school-van'?'#edba29':kind==='ambulance'?'#e25623':family==='bus'?'#a73539':'#87959a';
 b.box('paint',white,0,(h+low)*.5,mid,w,h-low,len,'soft');
 b.box('trim',stripe,0,h*.38,mid,w*1.007,.20,len*.984);
 if(!rear)b.box('glass',white,0,h*.68,front+.006,w*.91,h*.355,.027,'soft',-.045);
 b.box('glass',white,0,h*.68,end-.005,w*.83,h*.30,.023,'soft');
 for(const side of [-1,1]){
  const x=side*w*.501;
  b.box('glass',white,x,h*.685,mid,.018,h*.32,len*.90,'soft');
  if(near){
   const sections=Math.max(3,Math.round(len/1.1));
   for(let i=1;i<sections;i++)b.box('trim',dark,x*1.008,h*.686,end+len*(i/sections),.035,h*.328,.07);
   if(family==='bus')for(const t of [.21,.81]){
    const z=end+t*len;b.box('trim',dark,w*.505,h*.455,z,.025,h*.68,.64);
    b.box('glass',white,w*.516,h*.56,z,.02,h*.41,.48);
   }
  }
 }
 if(!near)return;
 if(articulated&&rear)for(let i=0;i<6;i++)b.box('trim',i%2?'#43484a':'#63686a',0,h*.54,-.25+i*.09,w*.92,h*.8,.105,'soft');
 b.box('trim',silver,0,h+.045,mid,w*.56,.09,len*.24,'soft');
 if(!rear)b.box('trim',dark,0,h*.885,front+.021,w*.82,.20,.024);
 if(kind==='ambulance'){
  b.box('trim','#bd3029',0,h*.65,end-.026,.13,.58,.028);
  b.box('trim','#bd3029',0,h*.65,end-.03,.48,.15,.028);
 }
}

function heavy(b,s,near){
 const {kind,length:l,width:w,height:h,wheelRadius:r}=s,front=l*.493,cab=l*.266;
 b.box('trim',dark,0,r+.12,0,w*.78,.37,l*.94);
 b.box('paint',white,0,(h*.82+r*.52)/2,front-cab/2,w,h*.82-r*.52,cab,'soft');
 b.box('glass',white,0,h*.636,front+.003,w*.88,h*.246,.035,'soft',-.045);
 for(const side of [-1,1])b.box('glass',white,side*w*.502,h*.635,front-cab*.43,.023,h*.24,cab*.65);
 const cargoEnd=-l*.485,cargoFront=front-cab-.16,mid=(cargoEnd+cargoFront)/2,len=cargoFront-cargoEnd;
 if(kind==='tow-truck'){
  b.box('trim','#4d5559',0,r*2.05,mid,w*.96,.18,len,'box',-.065);
  for(const side of [-1,1])b.strut('trim','#e1a73b',[side*w*.33,1.02,mid],[side*w*.23,2.08,cargoFront-.5],.13);
 }else{
  const garbage=kind==='garbage-truck',fire=kind==='fire-truck';
  b.box(fire?'paint':'trim',fire?white:garbage?'#6b985b':'#c2c6c7',0,(h+1)/2,mid,w*.99,h-1,len,'soft');
  if(near){
   if(garbage)b.box('trim','#4a604e',0,h*.58,cargoEnd-.03,w*.76,h*.44,.12,'soft');
   if(fire)for(const side of [-1,1])b.box('trim',silver,side*w*.499,h*.51,mid,.031,h*.37,len*.84);
   for(let i=0;i<Math.floor(len/.36);i++)for(const side of [-1,1])b.box('trim',fire?silver:garbage?'#56784e':'#a3a8a9',side*w*.498,h*.65,cargoEnd+.23+i*.36,.032,h*.49,.024);
   if(fire){for(const side of [-1,1])b.box('trim',silver,side*.26,h+.065,mid,.05,.09,len*.92);
    for(let i=0;i<len/.38;i++)b.box('trim',silver,0,h+.068,cargoEnd+.17+i*.38,.53,.045,.045);}
  }
 }
 if(near)b.box('trim',dark,0,h*.37,front+.012,w*.52,.30,.035);
}

function twoWheeler(b,s,near){
 const motor=s.family==='motorcycle',delivery=s.kind.startsWith('delivery'),z=s.wheelbase/2,r=s.wheelRadius;
 const frame=motor?.13:.045;
 const points=[[0,r,-z],[0,.52,-.1],[0,.78,-.27],[0,.84,.30],[0,r,z]];
 for(const [a,c] of [[0,1],[0,2],[1,2],[1,3],[2,3],[3,4]])b.strut('paint',white,points[a],points[c],frame);
 b.box('trim',dark,0,.81,-.20,motor?.31:.19,.085,motor?.58:.22,'soft');
 if(motor){
  b.box('paint',white,0,.78,.10,.34,.26,.46,'ball');
  b.box('trim',silver,0,.49,.01,.29,.23,.32,'soft');
 }
 b.strut('trim',silver,[-.29,.92,.28],[.29,.92,.28],.043);
 if(delivery)b.box('trim','#ad3f32',0,1.01,-z*.82,.48,.49,.44,'soft');
 if(!near)return;
 // Rider leans with the chassis; the legs of a cyclist are animated separately.
 b.strut('rider','#354856',[0,.83,-.16],[0,1.20,-.045],.27);
 b.box('rider',motor?'#292e32':'#bc927a',0,1.37,.015,.226,.255,.23,'ball');
 b.box('rider',motor?'#505a61':'#44474b',0,1.46,.021,.24,.14,.25,'ball');
 for(const side of [-1,1]){
  b.strut('rider','#52626c',[side*.12,1.20,-.04],[side*.225,1.02,.10],.084);
  b.strut('rider','#ae8068',[side*.225,1.02,.10],[side*.26,.92,.28],.061);
  if(motor){b.strut('rider','#303b47',[side*.10,.85,-.17],[side*.17,.60,.11],.11);b.strut('rider','#303b47',[side*.17,.60,.11],[side*.16,.40,-.03],.082);}
 }
}


function buildWheel(shapes,cycle){
 const b=componentBuilder(shapes);
 b.box('trim','#222427',0,0,0,cycle?.6:1,1,1,cycle?'ring':'tyre');
 if(!cycle)b.box('trim','#80878a',0,0,0,1.013,.68,.68,'tyre');
 for(const side of [-1,1]){
  const x=side*(cycle?.09:.515);
  for(let i=0;i<(cycle?9:5);i++){
   const angle=i*Math.PI*2/(cycle?9:5);
   b.strut('trim',cycle?silver:'#c9cbca',[x,0,0],[x,Math.cos(angle)*.40,Math.sin(angle)*.40],cycle?.018:.085);
  }
 }
 return b.finish().trim;
}

function labelTexture(text,mode){
 if(typeof document==='undefined')return null;
 const canvas=document.createElement('canvas');canvas.width=mode==='line'?512:256;canvas.height=mode==='line'?64:96;
 const ctx=canvas.getContext('2d');if(!ctx)return null;
 ctx.fillStyle=mode==='line'?'#171c1b':mode==='taxi'?'#fbe8a8':'#e2e4df';ctx.fillRect(0,0,canvas.width,canvas.height);
 if(mode==='plate'){
  ctx.fillStyle='#294f86';ctx.fillRect(0,0,canvas.width,20);ctx.fillStyle='white';ctx.font='bold 16px sans-serif';ctx.textAlign='center';ctx.fillText('BRASIL',128,16);
 }
 ctx.fillStyle=mode==='line'?'#ffbb4a':'#202526';ctx.textAlign='center';ctx.textBaseline='middle';
 ctx.font=mode==='line'?'bold 36px monospace':'bold 55px sans-serif';ctx.fillText(text,canvas.width/2,mode==='plate'?60:canvas.height/2,canvas.width-10);
 const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;return texture;
}
const isEmergency=kind=>kind==='police'||kind==='fire-truck'||kind==='ambulance';
const low=q=>q==='low'||q==='baixo';
const ultra=q=>q==='ultra'||q==='high';
const zeroOrigin={x:0,z:0};

export function createVehicleFleet(parent, capacityPerKind=12, options={}){
 if(typeof capacityPerKind==='object'&&!Number.isFinite(capacityPerKind)){
  if('assets' in capacityPerKind||'renderer' in capacityPerKind){options=capacityPerKind;capacityPerKind=12;}
 }
 const root=new T.Group();root.name='Frota urbana • Prestes Maia';parent.add(root);
 const shapes=primitives(),batches=new Map(),profiles=new Map(),imports=new Map(),labels=new Map();
 const ownedGeometries=new Set(Object.values(shapes)),ownedMaterials=new Set(),ownedTextures=new Set();
 const paint=new T.MeshPhysicalMaterial({vertexColors:true,color:0xffffff,metalness:.48,roughness:.32,clearcoat:1,clearcoatRoughness:.16});
 const trim=new T.MeshStandardMaterial({vertexColors:true,roughness:.63,metalness:.24});
 const glazing=new T.MeshStandardMaterial({vertexColors:true,color:glass,metalness:.57,roughness:.15,envMapIntensity:1.25});
 const glow=new T.MeshBasicMaterial({color:0xffffff});
 const legMaterial=new T.MeshStandardMaterial({color:'#37414b',roughness:.92});
 const materialByLayer={paint,trim,glass:glazing,rider:trim};
 [paint,trim,glazing,glow,legMaterial].forEach(m=>ownedMaterials.add(m));
 const wheelGeometry=buildWheel(shapes,false),cycleWheel=buildWheel(shapes,true),panel=new T.PlaneGeometry();
 [wheelGeometry,cycleWheel,panel].forEach(g=>ownedGeometries.add(g));
 const status=new Map(),revision=new Map();
 let disposed=false,draco,ktx,loaderPromise;
 const incoming=new Map();
 function ensureLoader(){
  return loaderPromise??=Promise.all([import('three/addons/loaders/GLTFLoader.js'),import('three/addons/loaders/DRACOLoader.js'),import('three/addons/loaders/KTX2Loader.js')]).then(([g,d,k])=>{
   if(disposed)throw new Error('Frota encerrada');
   draco=new d.DRACOLoader().setDecoderPath(options.dracoPath??'/assets/draco/');
   const loader=new g.GLTFLoader().setDRACOLoader(draco);
   if(options.renderer){ktx=new k.KTX2Loader().setTranscoderPath(options.ktx2Path??'/assets/basis/').detectSupport(options.renderer);loader.setKTX2Loader(ktx);}
   return loader;
  });
 }
 function materialLabel(key,text,mode){
  if(!labels.has(key)){
   const map=labelTexture(text,mode),m=new T.MeshBasicMaterial({map,color:map?white:mode==='line'?'#dda450':ivory});
   if(map)ownedTextures.add(map);ownedMaterials.add(m);labels.set(key,m);
  }
  return labels.get(key);
 }
 // Buffers grow only when a live batch fills. All moving batches use explicit distance culling.
 function add(key,geometry,material,m,colour=white,shadow=false){
  let batch=batches.get(key);
  if(!batch||batch.used>=batch.mesh.instanceMatrix.count){
   const previous=batch?.mesh,capacity=previous?previous.instanceMatrix.count*2:8;
   const mesh=new T.InstancedMesh(geometry,material,capacity);mesh.name=key;mesh.frustumCulled=false;mesh.castShadow=shadow;mesh.receiveShadow=shadow;
   mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
   const used=batch?.used??0;
   if(previous){
    mesh.instanceMatrix.array.set(previous.instanceMatrix.array);
    if(previous.instanceColor){mesh.setColorAt(0,colorTmp.set(white));mesh.instanceColor.array.set(previous.instanceColor.array);}
    root.remove(previous);previous.dispose();
   }
   batch={mesh,used};batches.set(key,batch);root.add(mesh);
  }
  const i=batch.used++;batch.mesh.setMatrixAt(i,m);batch.mesh.setColorAt(i,colorTmp.set(colour));
 }
 function model(kind,near,rear=false){
  const key=kind+'/'+near+'/'+rear;
  if(!profiles.has(key)){
   const b=componentBuilder(shapes),s=VEHICLE_SPECS[kind];
   if(s.family==='car')passenger(b,s,near);
   else if(s.family==='truck')heavy(b,s,near);
   else if(s.family==='bus'||s.family==='van')longBody(b,s,near,rear);
   else twoWheeler(b,s,near);
   const result=Object.entries(b.finish()).map(([layer,g])=>{ownedGeometries.add(g);return {key:key+layer,g,m:materialByLayer[layer],repaint:layer==='paint'};});
   profiles.set(key,result);
  }
  return profiles.get(key);
 }
 function rigid(parts,m,c){for(const part of parts)add(part.key,part.g,part.m,m,part.repaint?c:white,true);}
 function detail(key,g,mat,parentMatrix,x,y,z,w,h,l,c,rx=0,ry=0,rz=0){
  matrix.multiplyMatrices(parentMatrix,transform(local,x,y,z,w,h,l,rx,ry,rz));add(key,g,mat,matrix,c,mat===trim||mat===legMaterial);
 }
 function drawWheel(parentMatrix,s,x,z,steer,phase,narrow){
  const cycle=s.family==='cycle',diam=s.wheelRadius*2,width=narrow?(cycle?.052:.108):Math.min(.32,s.width*.12);
  // Rotate about the axle before applying the steering yaw. Non-uniform tyre scale stays local.
  detail(cycle?'roda raiada':'roda de liga',cycle?cycleWheel:wheelGeometry,trim,parentMatrix,x,s.wheelRadius,z,width,diam,diam,white,-phase,steer);
 }
 function lamp(parentMatrix,x,y,z,w,h,l,c){detail('ópticas emissivas',shapes.box,glow,parentMatrix,x,y,z,w,h,l,c);}
 function sign(key,text,mode,parentMatrix,x,y,z,w,h,rear=false){
  detail('painel '+key,panel,materialLabel(key,text,mode),parentMatrix,x,y,z,w,h,1,white,0,rear?Math.PI:0);
 }
 function animateLeg(side,v,phase){
  // Two links meet at the knee; foot position follows the pedal crank.
  const hip=new T.Vector3(side*.105,.87,-.17),foot=new T.Vector3(side*.14,.42+.12*Math.cos(phase),-.04+.12*Math.sin(phase));
  const knee=hip.clone().lerp(foot,.48);knee.z+=.17;
  for(const [a,b] of [[hip,knee],[knee,foot]]){
   const d=b.clone().sub(a),q=new T.Quaternion().setFromUnitVectors(axisY,d.clone().normalize());
   local.compose(a.clone().lerp(b,.5),q,size.set(.088,d.length(),.088));
   add('pernas dos ciclistas',shapes.pipe,legMaterial,matrix.multiplyMatrices(v,local));
  }
 }
 async function registerModel(kind,url,config={}){
  if(!VEHICLE_SPECS[kind])throw new RangeError('Categoria desconhecida '+kind);
  const version=(revision.get(kind)??0)+1;revision.set(kind,version);
  status.set(kind,{state:'loading',url});
  let scene=null;
  try{
   const loader=await ensureLoader();const gltf=await loader.loadAsync(url);scene=gltf.scene;
   if(disposed||revision.get(kind)!==version)return false;
   // Imported wheels must be separate named nodes or meshes. The fallback supplies animated axles.
   const holder=new T.Group();holder.add(scene);holder.rotation.y=config.yaw??0;holder.updateMatrixWorld(true);
   const bounds=new T.Box3().setFromObject(holder),extent=bounds.getSize(new T.Vector3()),center=bounds.getCenter(new T.Vector3()),s=VEHICLE_SPECS[kind];
   if(Math.min(extent.x,extent.y,extent.z)<.01)throw new Error('Modelo sem volume');
   const fit=new T.Matrix4().makeScale(s.width/extent.x,s.height/extent.y,s.length/extent.z)
    .multiply(new T.Matrix4().makeTranslation(-center.x,-bounds.min.y,-center.z));
   const parts=[];const wheelPattern=config.wheelPattern??/wheel|tyre|tire|center.cap|spoke.rim|roda|pneu/i;
   holder.traverse(node=>{
    if(!node.isMesh||node.isSkinnedMesh)return;
    for(let p=node;p&&p!==holder;p=p.parent)if(wheelPattern.test(p.name))return;
    const g=node.geometry.clone();g.applyMatrix4(new T.Matrix4().multiplyMatrices(fit,node.matrixWorld));
    const collection=Array.isArray(node.material)?node.material:[node.material];
    const mats=collection.map(original=>{
     const m=original.clone(),repaint=/^paint$|body.?paint|lataria/i.test(m.name);
     if(repaint){m.color?.set(white);if(m.isMeshPhysicalMaterial)m.clearcoat=1;}
     ownedMaterials.add(m);return m;
    });
    ownedGeometries.add(g);parts.push({key:'GLB '+kind+'/'+version+'/'+parts.length,g,m:Array.isArray(node.material)?mats:mats[0],repaint:mats.length===1&&/^paint$|body.?paint|lataria/i.test(mats[0].name)});
   });
   if(!parts.length)throw new Error('Modelo sem carroceria rígida');
   imports.set(kind,parts);status.set(kind,{state:'ready',url});return true;
  }catch(error){
   if(!disposed&&revision.get(kind)===version)status.set(kind,{state:'fallback',url,error:String(error.message??error)});
   return false;
  }finally{
   // Loader geometry/materials are separate from the batch clones. Textures are shared with clones.
   scene?.traverse(node=>{if(!node.isMesh)return;node.geometry.dispose();for(const m of [].concat(node.material)){
    for(const t of Object.values(m))if(t?.isTexture){if(disposed) t.dispose();else ownedTextures.add(t);}
    m.dispose();
   }});
  }
 }
 function update(vehicles,{player=zeroOrigin,quality='medium',daylight=.7,time=0}={}){
  if(disposed)return;
  for(const batch of batches.values())batch.used=0;
  const range=low(quality)?135:ultra(quality)?320:215;
  const detailed=(low(quality)?42:80)**2,counts=new Map();
  for(let i=0;i<vehicles.length;i++){
   const v=vehicles[i],s=VEHICLE_SPECS[v.kind];if(!s||!Number.isFinite(v.x)||!Number.isFinite(v.z))continue;
   const distance=(v.x-player.x)**2+(v.z-player.z)**2;if(distance>range*range)continue;
   const count=counts.get(v.kind)??0,cap=typeof capacityPerKind==='number'?capacityPerKind:capacityPerKind[v.kind]??12;
   if(count>=cap)continue;counts.set(v.kind,count+1);
   const near=distance<detailed,narrow=s.family==='cycle'||s.family==='motorcycle';
   const steer=T.MathUtils.clamp(v.steer||0,-.62,.62),roll=narrow?T.MathUtils.clamp(steer*(v.speed||0)*.062,-.32,.32):0;
   transform(base,v.x,v.y??0,v.z,1,1,1,0,v.yaw??0,roll);
   const paintColor=fixedPaint[v.kind]??v.color??FLEET_PALETTE[i%FLEET_PALETTE.length];
   const body=near&&imports.has(v.kind)?imports.get(v.kind):model(v.kind,near);
   rigid(body,base,paintColor);
   const articulated=v.kind==='articulated-bus';
   if(articulated){
    back.multiplyMatrices(base,transform(local,0,0,-s.length*.057,1,1,1,0,T.MathUtils.clamp(v.articulation||0,-.55,.55)));
    if(!near||!imports.has(v.kind))rigid(model(v.kind,near,true),back,paintColor);
   }
   const rear=articulated?back:base,l=s.length,w=s.width,h=s.height,frontZ=l*.494,rearZ=articulated?-l*.426:-frontZ,phase=v.phase??0;
   const wheelZ=articulated?[[-l*.012,0],[s.wheelbase-l*.012,steer]]:[[-s.wheelbase/2,0],[s.wheelbase/2,steer]];
   for(const [z,a] of wheelZ)for(const side of narrow?[0]:[-1,1])drawWheel(base,s,side*w*.453,z,a,phase,narrow);
   if(articulated)for(const side of [-1,1])drawWheel(back,s,side*w*.453,-l*.28,0,phase,false);
   if(narrow&&near&&s.family==='cycle')for(const side of [-1,1])animateLeg(side,base,phase*.36+(side<0?Math.PI:0));
   const night=daylight<.53,blink=Math.floor(time*2.7+(v.blinkOffset??0))%2===0;
   const head=night?0xffeed1:0xb2b7aa,tail=v.braking?0xff2611:night?0xb52a20:0x681f1a;
   for(const {x,y,z} of s.headlights)lamp(base,x,y,z,narrow?.13:w*.16,.086,.046,head);
   for(const side of narrow?[0]:[-1,1]){
    const x=side*w*.377,y=narrow?.72:s.headlights[0].y;
    lamp(rear,x,y,rearZ,narrow?.08:w*.14,.092,.048,tail);
    if(v.reverse&&near)lamp(rear,x*.74,y-.05,rearZ-.01,narrow?.04:.08,.052,.036,0xfff8e2);
   }
   if(blink&&v.indicator&&near){
    const x=Math.sign(v.indicator)*w*(narrow?.38:.446),y=s.headlights[0].y;
    lamp(base,x,y+.045,frontZ,.087,.064,.061,0xffac22);lamp(rear,x,y+.045,rearZ,.087,.064,.061,0xffac22);
   }
   if(isEmergency(v.kind)&&v.beacon!==false&&near){
    const alternating=Math.floor(time*6)%2===0;
    for(const side of [-1,1])lamp(base,side*.22,h+.097,s.family==='truck'?l*.34:0,.30,.11,.166,alternating===(side<0)?(side<0?0xff2520:0x387dff):0x391f2a);
   }
   if(!near)continue;
   if(v.kind==='taxi')sign('taxi','TÁXI','taxi',base,0,h+.08,.095,.38,.13);
   if(s.family==='bus'){
    const n=v.displayIndex??(v.kind==='bus'?0:1);
    sign('linha'+(n%2),routeDisplays[n%2],'line',base,0,h*.886,frontZ+.058,w*.80,.185);
   }
   if(!narrow){
    const plate=i%4,plateText=['NXS1A01','NXS2B02','NXS3C03','NXS4D04'][plate],py=s.family==='car'?.42:.6;
    sign('placa'+plate,plateText,'plate',base,0,py,frontZ+.023,.40,.13);
    sign('placa'+plate,plateText,'plate',rear,0,py,rearZ-.026,.40,.13,true);
   }
  }
  for(const {mesh,used} of batches.values()){
   mesh.count=used;mesh.visible=used>0;
   if(used){mesh.instanceMatrix.needsUpdate=true;mesh.instanceColor.needsUpdate=true;}
  }
 }
 function dispose(){
  if(disposed)return;disposed=true;parent.remove(root);draco?.dispose();ktx?.dispose();
  for(const {mesh} of batches.values())mesh.dispose();
  for(const g of ownedGeometries)g.dispose();for(const m of ownedMaterials)m.dispose();for(const t of ownedTextures)t.dispose();
  root.clear();batches.clear();profiles.clear();imports.clear();
 }
 for(const [kind,asset] of Object.entries(options.assets??{})){
  const config=typeof asset==='string'?{url:asset}:asset;incoming.set(kind,registerModel(kind,config.url,config));
 }
 const ready=Promise.all(incoming.values());
 return {root,ready,status,update,registerModel,dispose};
}

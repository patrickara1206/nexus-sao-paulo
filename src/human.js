import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createAvatarFootwear} from './avatar-footwear.js';
import {createAvatarHair} from './avatar-hair.js';

const loader=new GLTFLoader();
const textureLoader=new T.TextureLoader();
let templatePromise,outfitPromise,skinPromise;
export const defaultAppearance={
 name:'Paulista',gender:'Não-binário',body:.5,build:.5,height:1.75,skin:'#b8835b',
 hair:'#251d18',hairStyle:'curto',shirt:'#d8d6ce',pants:'#263547',bodyHair:1,
 pubicHair:'natural',outfit:'casual',
};

export function loadHuman(){
 return templatePromise??=loader.loadAsync('/assets/human/adult.glb').then(asset=>{
  let body;
  asset.scene.traverse(node=>{if(node.isMesh)body=node;});
  return body;
 });
}

function loadOutfit(body){
 return outfitPromise??=loader.loadAsync('/assets/human/casual-outfit.glb').then(asset=>{
  const shirt=asset.scene.getObjectByName('Shirt');
  const trousers=asset.scene.getObjectByName('Trousers');
  if(!shirt?.morphTargetInfluences?.length||!trousers?.morphTargetInfluences?.length){
   throw new Error('Outfit is missing adjustable garments');
  }
  const hidden=new Set(asset.scene.userData.hiddenBodyTriangles??[]);
  const indices=body.geometry.index.array;
  if(!hidden.size||hidden.size>=indices.length/3)throw new Error('Outfit has an invalid body mask');
  const visible=[];
  for(let triangle=0;triangle<indices.length/3;triangle++){
   if(!hidden.has(triangle))visible.push(indices[triangle*3],indices[triangle*3+1],indices[triangle*3+2]);
  }
  const masked=body.geometry.clone();
  masked.setIndex(visible);
  return {shirt,trousers,masked};
 }).catch(error=>{
  console.warn('Não foi possível carregar o conjunto 3D.',error);
  return null;
 });
}

function loadSkin(){
 return skinPromise??=textureLoader.loadAsync('/assets/human/skin-detail.jpg').then(texture=>{
  texture.colorSpace=T.SRGBColorSpace;
  return texture;
 }).catch(error=>{
  console.warn('Não foi possível carregar a textura da pele.',error);
  return null;
 });
}

const poseUniforms=`
 uniform float phase, move, idle, bulk, bodyNorm, baseY;
 varying vec3 vBody;
`;
const poseVertex=`
 transformed.y-=baseY;
 transformed*=bodyNorm;
 vBody=transformed;
 float buildWeight=exp(-pow((transformed.y-1.07)*4.,2.));
 transformed.x*=1.+(bulk-.5)*.36*buildWeight;
 transformed.z*=1.+(bulk-.5)*.42*buildWeight;
 float side=sign(transformed.x);
 float cycle=phase+step(0.,transformed.x)*3.14159265;

 // Blend across the hip so the trousers crease instead of breaking at the waist.
 if(transformed.y<.88){
  float swing=sin(cycle)*.42*move;
  float blend=1.-smoothstep(.72,.88,transformed.y);
  vec2 leg=transformed.yz-vec2(.88,0.);
  transformed.yz=mix(transformed.yz,vec2(leg.x*cos(swing)-leg.y*sin(swing),leg.x*sin(swing)+leg.y*cos(swing))+vec2(.88,0.),blend);
 }
 // The arm travels together with the sleeve and relaxes between strides.
 float arm=smoothstep(.21,.34,abs(transformed.x))*(1.-smoothstep(1.36,1.53,transformed.y))*smoothstep(.64,.85,transformed.y);
 float angle=-side*(.43+.015*sin(idle+side)+side*.018)*arm;
 vec2 wrist=transformed.xy-vec2(side*.185,1.425);
 transformed.xy=vec2(wrist.x*cos(angle)-wrist.y*sin(angle),wrist.x*sin(angle)+wrist.y*cos(angle))+vec2(side*.185,1.425);
 transformed.z+=sin(cycle)*.11*move*arm;
 float upper=smoothstep(.7,1.48,transformed.y);
 transformed.x+=sin(idle)*.005*upper;
 transformed.y+=abs(sin(phase))*move*.025;
`;

function poseMaterial(material,uniforms,kind){
 material.onBeforeCompile=shader=>{
  Object.assign(shader.uniforms,uniforms);
  shader.vertexShader=poseUniforms+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <morphtarget_vertex>',`#include <morphtarget_vertex>
   ${poseVertex}`);
  if(kind==='depth')return;
  shader.fragmentShader=`
   varying vec3 vBody;
   uniform vec3 skin, shirt, pants;
   uniform float hairDensity, usingClothes;
  `+shader.fragmentShader;
  if(kind==='skin'){
   shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
    float arm=abs(vBody.x);
    float neckline=1.488+.025*smoothstep(.03,.12,arm);
    float top=step(.89,vBody.y)*step(vBody.y,neckline)*(1.-step(.36,arm));
    float trousers=step(vBody.y,.925);
    float hosiery=step(vBody.y,.14);
    top*=1.-usingClothes;
    trousers*=1.-usingClothes;
    vec3 base=mix(skin,shirt,top);
    base=mix(base,pants,trousers);
    float pores=fract(sin(dot(vBody.xy+vBody.zz,vec2(1229.8,7823.3)))*43758.54);
    float visibleHair=(1.-top)*(1.-trousers)*step(vBody.y,1.43);
    base=mix(base,base*.55,step(.989-hairDensity*.007,pores)*visibleHair*.36);
    #ifdef USE_MAP
     vec3 pigment=clamp(diffuseColor.rgb/vec3(.61,.43,.34),.11,1.85);
     base*=mix(vec3(1.),pigment,.83*(1.-max(top,trousers)));
    #endif
    diffuseColor.rgb=mix(base,vec3(.042,.046,.048),hosiery);
   `);
  }else{
   shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
    vec3 tint=${kind==='shirt'?'shirt':'pants'};
    float fibers=.965+.035*sin(vBody.x*820.)*sin(vBody.y*790.);
    diffuseColor.rgb=tint*mix(vec3(.94),diffuseColor.rgb,.6)*fibers;
   `);
  }
 };
 material.customProgramCacheKey=()=>`nexus-avatar-07-${kind}`;
 return material;
}

function morphBounds(geometry,body){
 const position=geometry.attributes.position;
 const morph=geometry.morphAttributes.position[0];
 let min=Infinity,max=-Infinity;
 for(let i=0;i<position.count;i++){
  const y=position.getY(i)+(morph?.getY(i)??0)*body;
  min=Math.min(min,y);
  max=Math.max(max,y);
 }
 return {base:min,scale:1.78/(max-min)};
}

export async function createHuman(appearance={}){
 const [template,skinDetail]=await Promise.all([loadHuman(),loadSkin()]);
 const outfit=await loadOutfit(template);
 const a={...defaultAppearance,...appearance};
 const root=new T.Group(),person=new T.Group();
 root.add(person);
 const uniforms={
  skin:{value:new T.Color(a.skin)},shirt:{value:new T.Color(a.shirt)},pants:{value:new T.Color(a.pants)},
  phase:{value:0},move:{value:0},idle:{value:0},bulk:{value:a.build},
  hairDensity:{value:a.bodyHair},bodyNorm:{value:1},baseY:{value:0},usingClothes:{value:outfit?1:0},
 };
 const material=poseMaterial(new T.MeshStandardMaterial({map:skinDetail,roughness:.72,side:T.DoubleSide}),uniforms,'skin');
 const depth=poseMaterial(new T.MeshDepthMaterial({depthPacking:T.RGBADepthPacking}),uniforms,'depth');
 const mesh=template.clone();
 mesh.material=material;
 if(outfit)mesh.geometry=outfit.masked;
 mesh.customDepthMaterial=depth;
 mesh.castShadow=true;
 mesh.receiveShadow=true;
 person.add(mesh);
 const garments=[];
 if(outfit){
  for(const [kind,asset] of [['shirt',outfit.shirt],['pants',outfit.trousers]]){
   const garment=asset.clone();
   garment.material=poseMaterial(new T.MeshStandardMaterial({
    color:'white',map:asset.material?.map??null,roughness:.91,side:T.DoubleSide,
   }),uniforms,kind);
   garment.customDepthMaterial=depth;
   garment.castShadow=true;
   garment.receiveShadow=true;
   garments.push(garment);
   person.add(garment);
  }
 }

 const shoes=createAvatarFootwear(),hair=createAvatarHair();
 person.add(shoes.root,hair.root);
 let lastBody;
 function apply(next){
  Object.assign(a,next);
  const body=T.MathUtils.clamp(Number(a.body),0,1);
  if(body!==lastBody){
   mesh.morphTargetInfluences[0]=body;
   for(const garment of garments)garment.morphTargetInfluences[0]=body;
   const bounds=morphBounds(mesh.geometry,body);
   uniforms.bodyNorm.value=bounds.scale;
   uniforms.baseY.value=bounds.base;
   shoes.fit(body);
   lastBody=body;
  }
  root.scale.setScalar(a.height/1.78);
  uniforms.skin.value.set(a.skin);
  uniforms.shirt.value.set(a.shirt);
  uniforms.pants.value.set(a.pants);
  uniforms.bulk.value=Number(a.build);
  uniforms.hairDensity.value=Number(a.bodyHair);
  hair.apply(a.hairStyle,a.hair,body);
 }
 apply(a);
 shoes.pose(0,0);
 return {
  root,person,mesh,appearance:a,apply,
  animate(time,speed=0){
   uniforms.phase.value=time*(speed>6?11:7);
   uniforms.move.value=Math.min(1,speed/4);
   uniforms.idle.value=time*1.2;
   shoes.pose(uniforms.phase.value,uniforms.move.value);
  },
  dispose(){
   material.dispose();
   for(const garment of garments)garment.material.dispose();
   depth.dispose();shoes.dispose();hair.dispose();
  },
 };
}

export async function characterStudio(canvas,appearance){
 const renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:true});
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
 renderer.outputColorSpace=T.SRGBColorSpace;
 renderer.toneMapping=T.ACESFilmicToneMapping;
 renderer.toneMappingExposure=.92;
 const scene=new T.Scene();
 const camera=new T.PerspectiveCamera(31,1,.02,20);
 scene.add(new T.HemisphereLight('#f9eee4','#59636e',1.45));
 const key=new T.DirectionalLight('#fff1de',2.1);
 key.position.set(-2.2,3.8,3.4);
 scene.add(key);
 const rim=new T.DirectionalLight('#b5d1df',1.2);
 rim.position.set(1.7,2.7,-2.7);
 scene.add(rim);
 const fill=new T.DirectionalLight('#fff9f4',.42);
 fill.position.set(2,1,2);
 scene.add(fill);
 const shadow=new T.Mesh(new T.PlaneGeometry(1.5,1.3),new T.ShaderMaterial({
  transparent:true,depthWrite:false,
  vertexShader:'varying vec2 tex;void main(){tex=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader:'varying vec2 tex;void main(){vec2 p=tex-.5;gl_FragColor=vec4(.025,.018,.014,.49*(1.-smoothstep(.04,.48,length(p))));}',
 }));
 shadow.rotation.x=-Math.PI/2;
 shadow.position.set(0,-.013,-.035);
 scene.add(shadow);
 const human=await createHuman(appearance);
 const initialHeading=Math.PI+.42;
 let heading=initialHeading;
 human.root.rotation.y=heading;
 scene.add(human.root);
 let active=true;
 let previous=0;
 function frame(time){
  if(!active)return;
  requestAnimationFrame(frame);
  const width=canvas.clientWidth,height=canvas.clientHeight;
  if(!width||!height||document.hidden||document.body.classList.contains('playing'))return;
  const delta=Math.min((time-previous)*.001,.05);
  previous=time;
  const ratio=renderer.getPixelRatio();
  if(canvas.width!==Math.floor(width*ratio)||canvas.height!==Math.floor(height*ratio)){
   renderer.setSize(width,height,false);
   camera.aspect=width/height;
   camera.updateProjectionMatrix();
  }
  const headroom=Math.max(1.41,human.appearance.height)*.59;
  const distance=headroom/(Math.tan(T.MathUtils.degToRad(camera.fov/2))*Math.min(1,camera.aspect*1.4));
  const targetY=human.appearance.height*.49;
  camera.position.set(0,targetY+.31,distance);
  camera.lookAt(0,targetY,0);
  human.root.rotation.y=T.MathUtils.lerp(human.root.rotation.y,heading,1-Math.exp(-delta*22));
  human.animate(time*.001,0);
  renderer.render(scene,camera);
 }
 requestAnimationFrame(frame);
 let drag;
 canvas.onpointerdown=event=>{
  drag={id:event.pointerId,x:event.clientX};
  canvas.setPointerCapture(event.pointerId);
 };
 canvas.onpointermove=event=>{
  if(drag?.id!==event.pointerId)return;
  heading+=(event.clientX-drag.x)*.012;
  drag.x=event.clientX;
 };
 canvas.onpointerup=canvas.onpointercancel=canvas.onlostpointercapture=()=>drag=undefined;
 canvas.tabIndex=0;
 canvas.addEventListener('keydown',event=>{
  if(!['ArrowLeft','ArrowRight','Home'].includes(event.key))return;
  event.preventDefault();
  heading=event.key==='Home'?initialHeading:heading+(event.key==='ArrowRight'?.22:-.22);
 });
 return {apply(value){human.apply(value);},dispose(){
  active=false;
  shadow.geometry.dispose();
  shadow.material.dispose();
  renderer.dispose();
  human.dispose();
 }};
}

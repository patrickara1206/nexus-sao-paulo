import * as T from 'three';import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
let templatePromise;const loader=new GLTFLoader();
export const defaultAppearance={name:'Paulista',gender:'Não-binário',body:.5,build:.5,height:1.75,skin:'#b8835b',hair:'#251d18',hairStyle:'curto',shirt:'#d8d6ce',pants:'#263547',bodyHair:1,pubicHair:'natural',outfit:'casual'};
export function loadHuman(){return templatePromise??=loader.loadAsync('/assets/human/adult.glb').then(g=>{let mesh;g.scene.traverse(o=>{if(o.isMesh)mesh=o;});return mesh;});}
export async function createHuman(appearance={}){const base=await loadHuman(),root=new T.Group(),person=new T.Group(),a={...defaultAppearance,...appearance};const uniforms={skin:{value:new T.Color(a.skin)},shirt:{value:new T.Color(a.shirt)},pants:{value:new T.Color(a.pants)},phase:{value:0},move:{value:0},bulk:{value:a.build},hairDensity:{value:a.bodyHair},bodyNorm:{value:1},baseY:{value:0}};const material=new T.MeshPhysicalMaterial({color:'white',roughness:.72,metalness:0,clearcoat:.04,side:T.DoubleSide});
 material.onBeforeCompile=s=>{Object.assign(s.uniforms,uniforms);s.vertexShader='varying vec3 vBody;uniform float phase;uniform float move;uniform float bulk;uniform float bodyNorm;uniform float baseY;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <morphtarget_vertex>',`#include <morphtarget_vertex>
transformed.y-=baseY;transformed*=bodyNorm;vBody=transformed;
float belly=exp(-pow((transformed.y-1.03)*4.,2.));
transformed.x*=1.+(bulk-.5)*.4*belly;transformed.z*=1.+(bulk-.5)*.6*belly;
// Fit a loose cloth envelope instead of painting the chest surface.
if(transformed.y>.94&&transformed.y<1.44&&abs(transformed.x)<.27){
 float rx=.25+bulk*.06;float rz=.145+bulk*.055;
 if(transformed.z<-.025){transformed.z=-rz*sqrt(max(.03,1.-pow(transformed.x/rx,2.)))-.012;transformed.z+=.0025*sin(transformed.y*65.+transformed.x*24.);}
 transformed.x*=1.045;
}

if(transformed.y<.88){float swing=sin(phase+step(0.,transformed.x)*3.14159)*.42*move;float ly=transformed.y-.88;float lz=transformed.z;transformed.y=.88+ly*cos(swing)-lz*sin(swing);transformed.z=ly*sin(swing)+lz*cos(swing);}
if(abs(transformed.x)>.21&&transformed.y>.65&&transformed.y<1.48){float side=sign(transformed.x);float amount=smoothstep(.21,.32,abs(transformed.x));float angle=-side*.5*amount;vec2 arm=transformed.xy-vec2(side*.21,1.4);transformed.xy=vec2(arm.x*cos(angle)-arm.y*sin(angle),arm.x*sin(angle)+arm.y*cos(angle))+vec2(side*.21,1.4);float amount2=smoothstep(.24,.44,abs(transformed.x));transformed.z+=sin(phase+step(0.,transformed.x)*3.14159)*.17*move*amount2;}
transformed.y+=abs(sin(phase))*move*.025;`);
 s.fragmentShader='varying vec3 vBody;uniform vec3 skin;uniform vec3 shirt;uniform vec3 pants;uniform float hairDensity;\n'+s.fragmentShader;s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
float hand=step(.35,abs(vBody.x))*step(vBody.y,1.10);
float collar=1.48-.06*(1.-smoothstep(.025,.09,abs(vBody.x)));float isShirt=step(.91,vBody.y)*step(vBody.y,collar)*(1.-hand);
float isPants=step(vBody.y,.94)*(1.-step(.34,abs(vBody.x)));
vec3 base=mix(skin,shirt,isShirt);base=mix(base,pants,isPants);
float shoe=step(vBody.y,.095);base=mix(base,vec3(.06,.065,.07),shoe);
float pore=fract(sin(dot(vBody.xy+vBody.zz,vec2(1229.8,7823.3)))*43758.54);
float hairZone=(1.-isShirt)*(1.-isPants)*step(vBody.y,1.42)*step(.5,vBody.y);
base=mix(base,base*.45,step(.97-hairDensity*.008,pore)*hairZone*.4);
float fabric=.97+.03*sin(vBody.x*900.)*sin(vBody.y*900.);
diffuseColor.rgb=base*mix(.98+pore*.04,fabric,max(isShirt,isPants));`);};
 const mesh=base.clone();mesh.material=material;mesh.castShadow=true;mesh.receiveShadow=true;person.add(mesh);root.add(person);
 const hairGroup=new T.Group();person.add(hairGroup);function refreshHair(){while(hairGroup.children.length){const o=hairGroup.children[0];hairGroup.remove(o);o.geometry?.dispose();o.material?.dispose();}if(a.hairStyle==='raspado')return;const hairMat=new T.MeshStandardMaterial({color:a.hair,roughness:.95});const cap=new T.Mesh(new T.SphereGeometry(1,24,14,0,Math.PI*2,0,Math.PI*.62),hairMat);cap.position.set(0,1.745,-.04);cap.scale.set(.092,.08,.105);cap.castShadow=true;hairGroup.add(cap);if(a.hairStyle==='longo'){const back=new T.Mesh(new T.SphereGeometry(1,20,14),hairMat);back.position.set(0,1.60,.025);back.scale.set(.105,.19,.07);hairGroup.add(back);}if(a.hairStyle==='cacheado'){for(let i=0;i<24;i++){const theta=i*2.4,r=.07*Math.sqrt(i/24),o=new T.Mesh(new T.SphereGeometry(.025,8,6),hairMat);o.position.set(Math.cos(theta)*r,1.82-Math.abs(r)*.5,Math.sin(theta)*r-.04);hairGroup.add(o);}}}
 function apply(next){Object.assign(a,next);mesh.morphTargetInfluences[0]=Math.max(0,Math.min(1,Number(a.body)));const position=mesh.geometry.attributes.position,morph=mesh.geometry.morphAttributes.position[0];let min=Infinity,max=-Infinity;for(let i=0;i<position.count;i++){const y=position.getY(i)+morph.getY(i)*mesh.morphTargetInfluences[0];min=Math.min(min,y);max=Math.max(max,y);}uniforms.bodyNorm.value=1.78/(max-min);uniforms.baseY.value=min;root.scale.setScalar(a.height/1.78);uniforms.skin.value.set(a.skin);uniforms.shirt.value.set(a.shirt);uniforms.pants.value.set(a.pants);uniforms.bulk.value=Number(a.build);uniforms.hairDensity.value=Number(a.bodyHair);refreshHair();}
 apply(a);return {root,person,mesh,appearance:a,apply,animate(time,speed=0){uniforms.phase.value=time*(speed>6?11:7);uniforms.move.value=Math.min(1,speed/4);},dispose(){material.dispose();}};
}
export async function characterStudio(canvas,appearance,onChange){const renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;const scene=new T.Scene(),camera=new T.PerspectiveCamera(34,1,.02,20);camera.position.set(0,1.0,3.3);camera.lookAt(0,.98,0);scene.add(new T.HemisphereLight('#eef5ff','#58616b',2));const key=new T.DirectionalLight('#ffedd7',3);key.position.set(2,3,3);scene.add(key);const rim=new T.DirectionalLight('#a4c9ef',2);rim.position.set(-2,2,-2);scene.add(rim);const human=await createHuman(appearance);human.root.rotation.y=Math.PI;scene.add(human.root);let active=true;function frame(t){if(!active)return;requestAnimationFrame(frame);const r=canvas.getBoundingClientRect();if(!r.width||!r.height)return;if(canvas.width!==Math.round(r.width*renderer.getPixelRatio())||canvas.height!==Math.round(r.height*renderer.getPixelRatio())){renderer.setSize(r.width,r.height,false);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();}human.animate(t*.001,0);renderer.render(scene,camera);}requestAnimationFrame(frame);let drag;canvas.onpointerdown=e=>{drag=e.clientX;canvas.setPointerCapture(e.pointerId);};canvas.onpointermove=e=>{if(drag===undefined)return;human.root.rotation.y+=(e.clientX-drag)*.01;drag=e.clientX;};canvas.onpointerup=()=>drag=undefined;return {apply(value){human.apply(value);onChange?.(human.appearance);},dispose(){active=false;renderer.dispose();human.dispose();}};}

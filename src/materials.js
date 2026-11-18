import * as T from 'three';
export function facadeMaterial(){const material=new T.MeshLambertMaterial({color:'white',vertexColors:true,side:T.DoubleSide});material.onBeforeCompile=shader=>{shader.vertexShader='varying vec3 vWorld;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
vec4 wp=vec4(transformed,1.0);
#ifdef USE_INSTANCING
wp=instanceMatrix*wp;
#endif
vWorld=(modelMatrix*wp).xyz;`);shader.fragmentShader='varying vec3 vWorld;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_begin>',`#include <normal_fragment_begin>
vec2 grid=fract(vec2(vWorld.x+vWorld.z,vWorld.y)/vec2(3.1,3.2));
float windowMask=step(.16,grid.x)*step(grid.x,.83)*step(.22,grid.y)*step(grid.y,.76)*step(.2,1.0-abs(normal.y));
float lit=step(.86,fract(sin(dot(floor(vec2(vWorld.x+vWorld.z,vWorld.y)/vec2(3.1,3.2)),vec2(12.9898,78.233)))*43758.54));
diffuseColor.rgb=mix(diffuseColor.rgb,mix(vec3(.13,.23,.27),vec3(.82,.73,.43),lit),windowMask*.88);
diffuseColor.rgb*=.96+.04*sin(vWorld.y*1.96);`);};return material;}
export function asphaltMaterial(){const m=new T.MeshLambertMaterial({color:'#51595a',side:T.DoubleSide});m.onBeforeCompile=s=>{s.vertexShader='varying vec3 vRoad;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvRoad=position;');s.fragmentShader='varying vec3 vRoad;\n'+s.fragmentShader;s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
float grain=fract(sin(dot(vRoad.xz,vec2(12.9898,78.233)))*43758.5453);
float wear=.97+.03*sin(vRoad.x*.17)*sin(vRoad.z*.21);
diffuseColor.rgb*=wear*(.88+grain*.20);`);};return m;}
export function addSky(scene){const sky=new T.Mesh(new T.SphereGeometry(80000,32,20),new T.ShaderMaterial({side:T.BackSide,depthWrite:false,uniforms:{},vertexShader:'varying vec3 vPos;void main(){vPos=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec3 vPos;void main(){float h=normalize(vPos).y;vec3 c=mix(vec3(.82,.88,.85),vec3(.27,.56,.77),pow(max(h,0.),.45));gl_FragColor=vec4(c,1.);}'}));sky.renderOrder=-10;scene.add(sky);const cm=new T.MeshLambertMaterial({color:'#fffaf0',transparent:true,opacity:.85});const cg=new T.SphereGeometry(1,12,8);for(let i=0;i<30;i++){const x=Math.sin(i*2.4)*5000,z=Math.cos(i*3.2)*5000;for(let j=0;j<4;j++){const cloud=new T.Mesh(cg,cm);cloud.position.set(x+j*90,850+Math.sin(i)*100+Math.sin(j)*25,z);cloud.scale.set(150,40+j*12,80);scene.add(cloud);}}const sun=new T.Mesh(new T.SphereGeometry(100,20,14),new T.MeshBasicMaterial({color:'#fff4cc',fog:false}));sun.position.set(-4000,2200,-5000);scene.add(sun);return sky;}

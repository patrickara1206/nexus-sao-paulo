import * as T from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const profiles = {
 low: {dpr: 1, shadows: false, bloom: false, ao: false},
 balanced: {dpr: 1.25, shadows: true, bloom: true, ao: false},
 high: {dpr: 1.5, shadows: true, bloom: true, ao: true},
};

export function cityTime(elapsedSeconds) {
 const minutes = (16 * 60 + 45 + Math.floor(elapsedSeconds / 4)) % 1440;
 return [Math.floor(minutes / 60), minutes % 60].map(value=>String(value).padStart(2,'0')).join(':');
}

// The astronomical track is illustrative. One simulated minute lasts four real seconds.
export function createLightingAndPostFX(renderer, scene, camera, {sky, sun, hemi}) {
 renderer.toneMapping=T.ACESFilmicToneMapping;
 renderer.shadowMap.type=T.PCFSoftShadowMap;
 const nightHorizon=new T.Color('#3d4a63'), duskHorizon=new T.Color('#deb59d'), dayHorizon=new T.Color('#c7d8dd');
 const nightZenith=new T.Color('#10192e'),dayZenith=new T.Color('#4a84ac');
 const afternoonSun=new T.Color('#fff0ce'),sunset=new T.Color('#ff9c60');
 const horizon=sky.material.uniforms.horizon.value,zenith=sky.material.uniforms.zenith.value;
 const direction=sky.material.uniforms.sunDirection.value;
 let quality='low',pipeline,ao,bloom,daylight=1,width=1,height=1,dpr=1;
 const rendererSize=new T.Vector2();
 renderer.info.autoReset=false;

 function preparePipeline() {
  if(pipeline)return;
  pipeline=new EffectComposer(renderer);
  pipeline.addPass(new RenderPass(scene,camera));
  bloom=new UnrealBloomPass(new T.Vector2(1,1),.18,.25,1.25);
  pipeline.addPass(bloom);
  pipeline.addPass(new OutputPass());
 }
 function resize() {
  renderer.setPixelRatio(dpr);
  renderer.setSize(width,height);
  camera.aspect=width/height;
  camera.updateProjectionMatrix();
  if(!pipeline)return;
  // Resizing the composer first keeps the final output at the selected resolution.
  pipeline.setPixelRatio(dpr);
  pipeline.setSize(width,height);
  renderer.getDrawingBufferSize(rendererSize);
  const halfW=Math.max(1,Math.round(rendererSize.x*.5)),halfH=Math.max(1,Math.round(rendererSize.y*.5));
  bloom.setSize(halfW,halfH);
  ao?.setSize(halfW,halfH);
 }
 function setQuality(value,screenWidth,screenHeight,deviceDpr=1) {
  quality=Object.hasOwn(profiles,value)?value:'balanced';
  const profile=profiles[quality];
  width=Math.max(1,screenWidth);height=Math.max(1,screenHeight);
  dpr=Math.min(deviceDpr,profile.dpr,1.5);
  renderer.shadowMap.enabled=profile.shadows;
  if(profile.bloom)preparePipeline();
  if(profile.ao&&!ao){
   ao=new SSAOPass(scene,camera,1,1,8);
   ao.kernelRadius=6;ao.minDistance=.001;ao.maxDistance=.07;
   pipeline.insertPass(ao,1);
  }
  if(ao)ao.enabled=profile.ao;
  resize();
 }
 function update(seconds,player,outdoors) {
  const hour=16.75+seconds/240;
  const angle=(hour-6)*Math.PI/12;
  const altitude=Math.sin(angle)*.88;
  daylight=T.MathUtils.smoothstep(altitude,-.15,.36);
  const warmth=1-T.MathUtils.smoothstep(altitude,.03,.5);
  direction.set(Math.cos(angle),altitude,-.32).normalize();
  sun.position.copy(direction).multiplyScalar(210).add(player);
  sun.target.position.set(player.x,player.y,player.z);
  sun.color.copy(afternoonSun).lerp(sunset,warmth);
  sun.intensity=2.75*T.MathUtils.smoothstep(altitude,-.015,.35);
  sun.visible=outdoors&&altitude>.005;
  hemi.intensity=outdoors?.35+.88*daylight:.22;
  scene.environmentIntensity=outdoors?.15+.45*daylight:.18;
  sky.visible=outdoors;
  sky.position.copy(camera.position);
  const sunsetGlow=warmth*T.MathUtils.smoothstep(altitude,-.18,.05);
  horizon.copy(nightHorizon).lerp(dayHorizon,daylight).lerp(duskHorizon,sunsetGlow*.84);
  zenith.copy(nightZenith).lerp(dayZenith,daylight);
  sky.material.uniforms.daylight.value=daylight;
  sky.material.uniforms.cloudTime.value=seconds;
  scene.fog.color.copy(horizon);
  scene.fog.density=outdoors?.00065+.0002*(1-daylight):.0002;
  scene.background.copy(horizon);
 }
 function render(dt,outdoors) {
  renderer.info.reset();
  if(pipeline&&profiles[quality].bloom&&outdoors)pipeline.render(dt);
  else renderer.render(scene,camera);
 }
 return {setQuality,update,render,get daylight(){return daylight;},dispose(){
  if(pipeline){for(const pass of pipeline.passes)pass.dispose();pipeline.dispose();}
 }};
}

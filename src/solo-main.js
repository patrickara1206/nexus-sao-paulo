import * as T from 'three';import './solo.css';
import {createSaoPauloSky} from './sky.js';
import {cityTime, createLightingAndPostFX} from './LightingAndPostFX.js';
import {createHuman,characterStudio,loadHuman} from './human.js';
import {normalizeState,buyClothing,buyMeal,advanceMission,missions,clothing} from './game-state.js';
import {createLab,makeInteriors,makeTrafficLight} from './lab.js';
import {createPaulista,paulistaSpawn,paulistaHeading} from './paulista.js';
import {createVehicles} from './vehicles.js';
import {createMetro,addMetroEntrances,metroEntrances} from './metro.js';
import {createTunnels,addTunnelPortals} from './tunnels.js';
import {createPhotorealCity} from './photoreal-city.js';
import {places,nearestStreet,nearestPlace,canMove,roadRecords,trianonEntrance,inTrianon} from './geography.js';
import {paulistaPedestrianPath,walkSidewalk,slideStep,approachAngle} from './exploration.js';
import {drawNavigationMap,mapIncludes,navigationInfo} from './navigation-map.js';
const $=id=>document.getElementById(id),canvas=$('world'),storageKey='nexus-solo-v2';let raw;try{raw=JSON.parse(localStorage.getItem(storageKey)||'null');}catch{}
const state=normalizeState(raw),player={x:0,z:-65,y:12},clock=new T.Clock(),keys=new Set(),stick={x:0,y:0};let area='paulista',driving=false;let running=false,space='world',lastWorld={x:0,z:-65,y:12},yaw=Math.PI,pitch=.13,speed=0,jump=0,jumpV=0,time=0,lastUI=0,lastGround=0,groundTarget=12,photo=false,nearestInteraction,toastTimer,studio,avatar,city={enabled:false},waypoint=null;
let mapMode='local',cameraZoom=1,driveOrbit=0,jumpRequested=false;
let historicArea,historicTraffic,historicCrowd,historicRequest,changingRegion=false;
let renderer;try{renderer=new T.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});}catch{$('cityConnectionText').textContent='WebGL 2 indisponível. Ative a aceleração gráfica do navegador.';throw new Error('WebGL 2 unavailable');}
renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.0;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
const scene=new T.Scene();scene.background=new T.Color('#c8dde9');scene.fog=new T.FogExp2('#c8dde9',.00058);
const sky=createSaoPauloSky();scene.add(sky);
const camera=new T.PerspectiveCamera(52,1,.05,18000);camera.position.set(0,15,-74);const hemi=new T.HemisphereLight('#d9e9ff','#727869',1.05);scene.add(hemi);const sun=new T.DirectionalLight('#fff1d9',2.1);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-70,right:70,top:70,bottom:-70,near:1,far:700});sun.shadow.bias=-.00015;sun.shadow.normalBias=.035;scene.add(sun,sun.target);
const pmrem=new T.PMREMGenerator(renderer),reflectionScene=new T.Scene();reflectionScene.add(sky.clone());scene.environment=pmrem.fromScene(reflectionScene,.03,.1,20000).texture;scene.environmentIntensity=.6;pmrem.dispose();
const lighting=createLightingAndPostFX(renderer,scene,camera,{sky,sun,hemi});
const paulista=createPaulista(scene),lab=createLab(scene),interiors=makeInteriors(scene),traffic=[makeTrafficLight(lab.root,-35,-60),makeTrafficLight(lab.root,35,-10)];lab.root.visible=false;Object.assign(player,paulistaSpawn);groundTarget=12;yaw=paulistaHeading;const actors=new T.Group();scene.add(actors);const npcs=[];
const vehicles=createVehicles(paulista.root,paulistaSpawn),metro=createMetro(scene),tunnels=createTunnels(scene);interiors.set('metro',metro.root);interiors.set('tunnel',tunnels.root);addMetroEntrances(paulista.root);addTunnelPortals(paulista.root,tunnels);
const trianon=trianonEntrance;
const services=[{id:'clothes',name:'Loja de roupas · teste de gameplay',x:-8,z:-67},{id:'food',name:'Lanchonete · teste de gameplay',x:12,z:-60},{id:'home',name:'Apartamento · teste de gameplay',x:-13,z:-79}];
const npcDefinitions=[{id:'marina',name:'Marina · guia',x:3,z:-58,shirt:'#6b3142',skin:'#9f6446'},{id:'rafael',name:'Rafael · mobilidade',x:20,z:-78,shirt:'#254966',skin:'#b98462'},...Array.from({length:10},(_,i)=>({id:'passante-'+i,name:'Morador',x:Math.cos(i*2.4)*25,z:-65+Math.sin(i*2.4)*36,shirt:['#a69d8a','#485c68','#5e6654','#783b36'][i%4],skin:['#70452f','#c49c7e','#a16c4c'][i%3],walking:true}))];
const markers=new T.Group();lab.root.add(markers);for(const service of services){const m=new T.Mesh(new T.TorusGeometry(.5,.035,6,32),new T.MeshStandardMaterial({color:'#d1af69',emissive:'#7e602c',emissiveIntensity:.5}));m.rotation.x=-Math.PI/2;m.position.set(service.x,12.25,service.z);markers.add(m);}
function save(){try{localStorage.setItem(storageKey,JSON.stringify(state));}catch{toast('Não foi possível salvar o progresso neste navegador.');}}
function toast(text){$('toast').textContent=text;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),4200);}
function status(text){$('cityStatus').textContent=text;}
function surfaceName(){
 return area==='historic'?'Centro Histórico':area==='paulista'?'Avenida Paulista':'Laboratório';
}
function surfaceStatus(){
 if(city.enabled)return 'São Paulo · base fotogramétrica';
 if(area==='historic')return 'Centro Histórico · reconstrução exterior';
 if(area==='paulista')return 'Avenida Paulista · reconstrução exterior';
 return 'Laboratório de mecânicas · cenário separado';
}
function showWorld(visible){
 lab.root.visible=visible&&!city.enabled&&area==='lab';
 paulista.root.visible=visible&&!city.enabled&&area==='paulista';
 if(historicArea)historicArea.root.visible=visible&&!city.enabled&&area==='historic';
 if(city.enabled)city.tiles.group.visible=visible;
 actors.visible=visible;
}
function loadHistoric(){
 if(historicArea)return Promise.resolve(historicArea);
 return historicRequest??=Promise.all([import('./historic.js'),import('./TrafficAndHeadlights.js'),import('./CrowdAndPlayer.js')]).then(async ([map,mobility,people])=>{
  const region=await map.createHistoric(scene);
  try{
   historicTraffic=mobility.createHistoricTraffic(region.root,region.geo.links,region.groundHeight,{
    features:region.geo.features,signals:region.geo.features.filter(feature=>feature.kind==='signal'),renderer,
   });
   region.props?.setSignals(historicTraffic.signals);
   historicCrowd=people.createHistoricCrowd(region.root,region,historicTraffic);
  }catch(error){
   historicTraffic?.dispose();
   region.root.removeFromParent();
   throw error;
  }
  historicArea=region;
  historicArea.root.visible=false;
  for(const point of historicArea.pois)playableDestinations.push({...point,area:'historic',playable:true});
  return historicArea;
 }).catch(error=>{
  historicRequest=null;
  throw error;
 });
}
function isPaused(){return !running||document.hidden||Boolean(document.querySelector('dialog[open]'));}
function applyAppearance(){avatar?.apply(state.appearance);studio?.apply(state.appearance);$('characterName').textContent=state.appearance.name||'Paulista';$('heightValue').textContent=Number(state.appearance.height).toFixed(2).replace('.',',')+' m';}
function fillForm(){for(const input of $('characterForm').elements){if(input.name&&state.appearance[input.name]!==undefined)input.value=state.appearance[input.name];}}
function handleMission(event){const result=advanceMission(state,event);if(result){save();toast(result.complete?`${result.title} concluída · +R$ ${result.reward}`:'Objetivo atualizado.');updateUI();}}
function activeMission(){return missions.find(m=>m.id===state.activeMission);}
function activeTask(){
 const mission=activeMission();
 return mission?.steps[state.missions[mission.id]?.step??0];
}
function paulistaSourceOffset(){return {x:paulista.source.normal[0]*37,z:paulista.source.normal[1]*37};}
function targetPosition(target){const npc=npcs.find(n=>n.id===target);if(npc)return npc;const service=services.find(s=>s.id===target);if(service)return service;const p=playableDestinations.find(p=>p.id===target)||places.find(p=>p.id===target);if(p?.id==='masp'&&area==='paulista')return {x:paulistaSpawn.x+paulistaSourceOffset().x,z:paulistaSpawn.z+paulistaSourceOffset().z};return p?{...p,z:p.z-(p.id==='masp'?45:0)}:null;}
function updateUI(){
 const mission=activeMission(),progress=state.missions[mission?.id]||{step:0},task=mission?.steps[progress.step];
 document.body.classList.toggle('free-mode',state.freeMode);
 $('money').textContent='R$ '+state.money.toLocaleString('pt-BR');
 $('health').textContent='Saúde '+Math.round(state.health);
 $('touchJump').textContent=driving?'■':'↑';
 $('touchJump').setAttribute('aria-label',driving?'Frear':'Pular');
 $('gameMode').textContent=driving?`${Math.round(Math.abs(vehicles.own.speed)*3.6)} km/h · E sair · Espaço frear`:state.freeMode?'MODO LIVRE · SOLO':'HISTÓRIA · SOLO';
 $('questCaption').textContent=state.freeMode?'EXPLORAÇÃO LIVRE':'HISTÓRIA SOLO';
 $('questTitle').textContent=state.freeMode?'A cidade no seu ritmo':mission?.title||'Sua vida em São Paulo';
 $('questTask').textContent=state.freeMode?'Explore, converse e personalize seu personagem.':area==='historic'?'Abra o menu de regiões para retomar a história na Paulista.':task?.text||'História concluída. Escolha outra no diário.';
 $('testTravel').hidden=state.freeMode||city.enabled||area!=='lab'||!task||space!=='world';
 const point=space==='metro'?lastWorld:player;
 const street=nearestStreet(point.x,point.z);
 const streetName=area==='paulista'&&inTrianon(player.x,player.z)?'Parque Trianon · caminho interno':street.distance<45?street.name:street.distance<140?'Próximo a '+street.name:'Fora de via identificada';
 const underground=['metro','tunnel'].includes(space);
 const indoorName={home:'Apartamento',food:'Lanchonete',clothes:'Loja de roupas',metro:'Estação Trianon–Masp',tunnel:'Túnel Nove de Julho'}[space];
 $('streetCaption').textContent=space==='metro'?'LINHA 2–VERDE':space==='tunnel'?'SUBTERRÂNEO · TRAÇADO OSM':space!=='world'?'INTERIOR DE TESTES':area==='lab'&&!city.enabled?'REFERÊNCIA GEOGRÁFICA DO LABORATÓRIO':'RUA ATUAL DO PERSONAGEM';
 $('street').textContent=indoorName||streetName;
 $('mapStreet').textContent=underground?indoorName+' · subterrâneo':'Rua atual · '+streetName;
 $('district').textContent=underground?'Dimensões verticais aproximadas':indoorName?'Interior de testes':city.enabled?nearestPlace(player.x,player.z).name+' · São Paulo':surfaceName()+' · São Paulo';
 $('clock').textContent=cityTime(time);
 if(!state.freeMode&&task?.kind==='visit'&&space==='world'&&area!=='historic'){
  const target=targetPosition(task.target);
  if(target&&(city.enabled||area!=='paulista'||inSlice(target.x,target.z))&&Math.hypot(player.x-target.x,player.z-target.z)<12){
   handleMission({kind:'visit',target:task.target});
  }
 }
}
function openDialog(id){
 clearInput();
 if(id==='menuDialog')$('cameraButton').hidden=space!=='world';
 if(!$(id).open)$(id).showModal();
}
for(const b of document.querySelectorAll('[data-close]'))b.onclick=()=>$(b.dataset.close).close();
function dialogue(title,text,actions=[]){$('dialogueTitle').textContent=title;$('dialogueText').textContent=text;$('dialogueActions').replaceChildren();for(const [label,action]of actions){const b=document.createElement('button');b.textContent=label;b.onclick=()=>{$('dialogue').close();action();};$('dialogueActions').append(b);}openDialog('dialogue');}
function talk(npc){npc.human.root.rotation.y=Math.atan2(npc.x-player.x,npc.z-player.z);const text=npc.id==='marina'?'Oi! Sou a Marina. Que tal começar pelo MASP e conhecer a entrada do Trianon? Depois, volte para me contar como foi o passeio.':npc.id==='rafael'?'Vamos conhecer a mobilidade deste trecho? Visite a plataforma do Trianon–Masp, explore o Túnel Nove de Julho e depois volte para conversar comigo.':area==='historic'?'Tem vários lugares para conhecer a pé. Abra o mapa e escolha um dos pontos turísticos do Centro.':'A Paulista muda a cada hora. Você pode explorar livremente ou seguir uma das histórias.';dialogue(npc.name,text,[[npc.id==='marina'?'Vamos começar':npc.id==='rafael'?'Conhecer o circuito':'Até mais',()=>{handleMission({kind:'talk',target:npc.id});}]]);}
function enterSpace(id){
 if(space==='world')lastWorld={...player};
 space=id;
 showWorld(false);
 for(const [kind,root]of interiors)root.visible=kind===id;
 player.x=0;player.z=5;player.y=0;groundTarget=0;jump=0;jumpV=0;
 setPanorama(false);yaw=0;avatar.root.rotation.y=yaw;camera.position.set(0,2.7,10);
 handleMission({kind:'enter',target:id});updateNavigation();
 status(id==='metro'?'Trianon–Masp · plataforma central, dois mezaninos. Dimensões aproximadas.':'Ambiente de mecânicas · interior fictício.');
 toast(id==='metro'?'E para informações e saída. Embarque ainda não disponível.':'Interior de testes. E para ações e saída.');
 updateUI();updateInteraction();
}
function leaveSpace(){
 if(vehicles.own.model&&vehicles.own.model.parent!==vehicles.root){vehicles.root.add(vehicles.own.model);vehicles.own.y=12.08;vehicles.reset();}
 if(driving){driving=false;vehicles.own.speed=0;vehicles.root.add(vehicles.own.model);vehicles.own.y=12.08;vehicles.reset();avatar.root.visible=true;}
 space='world';Object.assign(player,lastWorld);groundTarget=player.y;
 showWorld(true);
 for(const root of interiors.values())root.visible=false;
 yaw=Math.PI;camera.position.set(player.x,player.y+3,player.z-8);
 status(surfaceStatus());updateUI();updateInteraction();updateNavigation();
}
function interiorActions(){if(space==='food')dialogue('Lanchonete · interior de testes','Refeição por R$ 25 em dinheiro do jogo. Recupera 30 pontos de saúde.',[['Pedir refeição · R$ 25',()=>{if(buyMeal(state)){handleMission({kind:'purchase',target:'meal'});save();toast('Refeição comprada. Saúde recuperada.');updateUI();}else toast('Saldo insuficiente.');}],['Sair para a rua',leaveSpace]]);if(space==='clothes')dialogue('Loja de roupas · interior de testes','Escolha um conjunto. O dinheiro vem das histórias e das atividades do jogo.',[['Ver roupas',showShop],['Sair para a rua',leaveSpace]]);if(space==='home')dialogue('Seu apartamento · interior de testes','Descanse, altere o visual ou retome a exploração.',[['Descansar',()=>{state.health=100;save();updateUI();toast('Saúde recuperada.');}],['Personalizar personagem',customize],['Sair para a rua',leaveSpace]]);}
function vehicleAllowed(x,z){return space==='tunnel'?tunnels.canMove(x,z):inSlice(x,z)&&canMove(x,z,paulista.colliders,1.1);}
function exitVehicle(){if(Math.abs(vehicles.own.speed)>1.5){toast('Pare o carro antes de sair.');return;}const p=vehicles.exitPoint(vehicleAllowed);if(!p){toast('Espere haver espaço livre ao lado do carro.');return;}driving=false;vehicles.own.speed=0;Object.assign(player,p,{y:space==='tunnel'?0:12});groundTarget=player.y;avatar.root.visible=true;toast('Você saiu do carro.');}
function enterTunnel(portal){if(space==='world')lastWorld={...player};space='tunnel';showWorld(false);tunnels.root.visible=true;const entry=tunnels.entry(portal);Object.assign(player,entry);groundTarget=0;yaw=entry.yaw+Math.PI;jump=jumpV=0;setPanorama(false);driveOrbit=0;avatar.root.rotation.y=yaw;if(driving){tunnels.root.add(vehicles.own.model);Object.assign(vehicles.own,entry,{y:.08,speed:0});}camera.position.set(player.x+Math.sin(yaw)*5,2.6,player.z+Math.cos(yaw)*5);handleMission({kind:'enter',target:'tunnel'});updateNavigation();status('Nove de Julho · traçado mapeado; seção, profundidade e iluminação aproximadas.');toast('E para ações e saída. Acesso por transição.');updateUI();updateInteraction();}
function interact(){if(isPaused())return;updateInteraction();if(driving){if(space==='world'){const portal=tunnels.nearestPortal(player.x,player.z);if(Math.hypot(player.x-portal.x,player.z-portal.z)<15){dialogue('Túnel Nove de Julho','Acesso por transição. A rampa e o relevo contínuos ainda não foram reconstruídos.',[['Entrar no túnel com o carro',()=>enterTunnel(portal)],['Sair do carro',exitVehicle]]);return;}}exitVehicle();return;}
 if(space==='metro'){dialogue('Estação Trianon–Masp','Você pode caminhar pela plataforma central e observar os trens. Os dois mezaninos seguem o arranjo documentado; cotas e detalhes ainda são aproximados. Embarque e viagens entre estações ainda não estão disponíveis.',[['Continuar na plataforma',()=>{}],['Sair para a Avenida Paulista',leaveSpace]]);return;}
 if(space==='tunnel'){dialogue('Túnel Nove de Julho','Traçado obtido no OpenStreetMap. Seção e iluminação reconstruídas de forma aproximada.',[['Continuar explorando',()=>{}],['Voltar à superfície',leaveSpace]]);return;}
 if(space!=='world'){interiorActions();return;}if(!nearestInteraction){toast('Aproxime-se de um carro, acesso ou personagem.');return;}const item=nearestInteraction.item;
 if(nearestInteraction.type==='car'){driving=true;avatar.root.visible=false;vehicles.own.speed=0;Object.assign(player,{x:vehicles.own.x,z:vehicles.own.z,y:12});yaw=vehicles.own.yaw+Math.PI;driveOrbit=0;setPanorama(false);jump=jumpV=0;toast('W acelerar · S frear/ré · A/D virar · Espaço freio · E sair.');}
 else if(nearestInteraction.type==='metro')dialogue('Trianon–Masp · Linha 2–Verde','Visitar a reconstrução parcial da plataforma. O acesso usa uma transição; a escadaria desde a rua ainda não foi modelada.',[['Descer à plataforma',()=>{enterSpace('metro');toast('E para informações e saída. Não é permitido entrar nos trilhos.');}],['Continuar na rua',()=>{}]]);
 else if(nearestInteraction.type==='tunnel')dialogue('Acesso ao Túnel Nove de Julho','O portal está na posição mapeada. A integração do desnível com a superfície ainda está em construção.',[['Explorar o túnel',()=>enterTunnel(item)],['Continuar na rua',()=>{}]]);
 else if(nearestInteraction.type==='npc')talk(item);else dialogue(item.name,'Ambiente de demonstração das mecânicas; não representa um interior real de São Paulo.',[['Entrar',()=>enterSpace(item.id)],['Continuar explorando',()=>{}]]);
}
function showShop(){$('shopBalance').textContent=`Seu saldo: R$ ${state.money}`;$('clothingList').replaceChildren();for(const item of clothing){const card=document.createElement('article');card.className='clothing-card';const info=document.createElement('div'),h=document.createElement('h3'),p=document.createElement('p'),swatches=document.createElement('div');h.textContent=item.name;p.textContent=state.owned.includes(item.id)?'No seu guarda-roupa':`R$ ${item.price}`;swatches.className='clothing-swatches';for(const color of [item.shirt,item.pants]){const i=document.createElement('i');i.style.background=color;swatches.append(i);}info.append(h,p,swatches);const button=document.createElement('button');button.textContent=state.equipped===item.id?'Vestindo':state.owned.includes(item.id)?'Vestir':'Comprar e vestir';button.disabled=state.equipped===item.id;button.onclick=()=>{const result=buyClothing(state,item.id);if(!result.ok){toast(result.reason);return;}applyAppearance();save();updateUI();showShop();toast(result.owned?'Roupa equipada.':'Conjunto comprado e equipado.');};card.append(info,button);$('clothingList').append(card);}if(!$('shopDialog').open)openDialog('shopDialog');}
function showJournal(){$('missionList').replaceChildren();for(const m of missions){const pr=state.missions[m.id]||{step:0,paid:false},card=document.createElement('article');card.className='mission-card';const h=document.createElement('h3'),p=document.createElement('p'),b=document.createElement('button');h.textContent=m.title;p.textContent=`${pr.step}/${m.steps.length} objetivos · Recompensa R$ ${m.reward}${pr.paid?' · concluída':''}`;b.textContent=pr.paid?'Concluída':state.activeMission===m.id?'Acompanhar':'Escolher história';b.disabled=pr.paid;b.onclick=()=>{state.activeMission=m.id;state.freeMode=false;save();updateUI();$('journalDialog').close();};card.append(h,p,b);$('missionList').append(card);}openDialog('journalDialog');}
function customize(){for(const d of document.querySelectorAll('dialog[open]'))d.close();running=false;document.body.classList.remove('playing');fillForm();studio?.apply(state.appearance);$('startStory').textContent='Voltar à história';$('startFree').textContent='Voltar ao modo livre';}
function start(free){
 state.freeMode=free;running=true;document.body.classList.add('playing');
 save();updateUI();updateNavigation();drawMap($('minimap'));
}
$('startStory').onclick=()=>{if(area==='historic')switchArea('paulista');start(false);};$('startFree').onclick=()=>start(true);$('pauseButton').onclick=()=>openDialog('menuDialog');$('journalButton').onclick=showJournal;$('customizeButton').onclick=customize;$('modeButton').onclick=()=>{state.freeMode=!state.freeMode;save();updateUI();$('menuDialog').close();};$('recoverButton').onclick=()=>{if(space!=='world')leaveSpace();switchArea(area);$('menuDialog').close();};$('mapsSetup').onclick=$('cityInfoButton').onclick=()=>openDialog('cityDialog');$('touchInteract').onclick=interact;$('touchJump').onpointerdown=e=>{if(isPaused())return;e.target.setPointerCapture(e.pointerId);if(driving)keys.add('Space');else jumpRequested=true;};$('touchJump').onpointerup=$('touchJump').onpointercancel=()=>keys.delete('Space');
$('characterForm').oninput=e=>{const el=e.target;if(!el.name)return;state.appearance[el.name]=['body','build','height','bodyHair'].includes(el.name)?Number(el.value):el.value;applyAppearance();save();};for(const b of document.querySelectorAll('[data-tab]'))b.onclick=()=>{document.querySelectorAll('[data-tab]').forEach(x=>x.classList.toggle('active',x===b));document.querySelectorAll('[data-section]').forEach(x=>x.hidden=x.dataset.section!==b.dataset.tab);};
function quality(){lighting.setQuality($('quality').value,innerWidth,innerHeight,devicePixelRatio);}
let selectedQuality=matchMedia('(pointer:coarse)').matches||innerWidth<700?'low':'balanced';
try{selectedQuality=localStorage.getItem('nexus-graphics')||selectedQuality;}catch{}
if(!['low','balanced','high'].includes(selectedQuality))selectedQuality='balanced';
$('quality').value=selectedQuality;
$('quality').onchange=()=>{
 try{localStorage.setItem('nexus-graphics',$('quality').value);}catch{}
 quality();
 $('quality').blur();
};
addEventListener('resize',quality);
quality();
function getInput(){let f=(keys.has('KeyW')||keys.has('ArrowUp')?1:0)-(keys.has('KeyS')||keys.has('ArrowDown')?1:0)+stick.y,s=(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0)+stick.x;const l=Math.max(1,Math.hypot(f,s));return {forward:f/l,side:s/l};}
function setPanorama(value){
 photo=value&&space==='world';
 $('cameraButton').setAttribute('aria-pressed',String(photo));
 $('cameraButton').textContent=photo?'Terceira pessoa':'Vista panorâmica';
}
$('cameraButton').onclick=()=>{
 setPanorama(!photo);
 $('menuDialog').close();
};

addEventListener('keydown',event=>{
 if(!running||['INPUT','SELECT','TEXTAREA'].includes(event.target.tagName))return;
 if(document.querySelector('dialog[open]'))return;
 const code=event.code;
 if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(code))event.preventDefault();
 if(event.repeat)return;
 if(code==='KeyE')interact();
 if(code==='KeyM')openMap();
 if(code==='KeyJ')showJournal();
 if(code==='KeyC')setPanorama(!photo);
 if(code==='Escape')openDialog('menuDialog');
 if(code==='Space'&&!driving)jumpRequested=true;
 if(!isPaused())keys.add(code);
});
addEventListener('keyup',event=>keys.delete(event.code));
function clearInput(){
 keys.clear();
 stick.x=stick.y=0;
 jumpRequested=false;
 drag=undefined;
 joystick.firstChild.style.transform='';
}
addEventListener('blur',clearInput);
document.addEventListener('visibilitychange',clearInput);
let drag;
canvas.onpointerdown=event=>{
 if(isPaused())return;
 drag={id:event.pointerId,x:event.clientX,y:event.clientY};
 canvas.setPointerCapture(event.pointerId);
};
canvas.onpointermove=event=>{
 if(drag?.id!==event.pointerId)return;
 const turn=(event.clientX-drag.x)*.006;
 if(driving)driveOrbit-=turn;
 else yaw-=turn;
 pitch=T.MathUtils.clamp(pitch+(event.clientY-drag.y)*.004,-.5,1.05);
 drag.x=event.clientX;
 drag.y=event.clientY;
};
canvas.onpointerup=canvas.onpointercancel=canvas.onlostpointercapture=()=>drag=undefined;
canvas.addEventListener('wheel',event=>{
 if(isPaused()||photo)return;
 event.preventDefault();
 cameraZoom=T.MathUtils.clamp(cameraZoom*Math.exp(event.deltaY*.0015),.65,1.65);
},{passive:false});
let stickId;const joystick=$('joystick');function setStick(e){const r=joystick.getBoundingClientRect(),x=(e.clientX-r.left-r.width/2)/40,y=-(e.clientY-r.top-r.height/2)/40,l=Math.max(1,Math.hypot(x,y));stick.x=x/l;stick.y=y/l;joystick.firstChild.style.transform=`translate(${stick.x*30}px,${-stick.y*30}px)`;}joystick.onpointerdown=e=>{stickId=e.pointerId;joystick.setPointerCapture(stickId);setStick(e);};joystick.onpointermove=e=>{if(e.pointerId===stickId)setStick(e);};joystick.onpointerup=joystick.onpointercancel=()=>{stickId=null;stick.x=stick.y=0;joystick.firstChild.style.transform='';};
const playableDestinations=[
 {id:'masp',name:'MASP',x:paulista.source.center.x,z:paulista.source.center.z,spawn:paulistaSpawn,heading:paulistaHeading},
 {...trianon,name:'Parque Trianon'},
 ...(paulista.destinations??[]),
 {id:'metro',name:'Metrô Trianon–Masp',x:metroEntrances[0].x,z:metroEntrances[0].z},
 {...tunnels.portals[1],id:'tunnel',name:'Túnel Nove de Julho'},
].map(point=>({...point,area:'paulista',playable:true}));

function referenceDestinations(){
 return places.filter(place=>!playableDestinations.some(local=>local.id===place.id||local.name===place.name));
}

function playerMapPosition(){
 return ['world','tunnel'].includes(space)?player:lastWorld;
}

function missionDestination(){
 if(state.freeMode||space!=='world'||area==='historic')return null;
 const task=activeTask();
 if(!task)return null;
 const service=services.find(item=>item.id===task.target);
 if(service&&area!=='lab')return null;
 const place=playableDestinations.find(item=>item.id===task.target);
 if(place&&area==='lab'&&['metro','tunnel'].includes(place.id))return null;
 const point=targetPosition(task.target)||place;
 if(!point)return null;
 return {id:task.target,name:point.name||place?.name||task.text,x:point.x,z:point.z};
}

function currentDestination(){
 return waypoint||missionDestination();
}

function updateNavigation(){
 const destination=currentDestination();
 const metrics=navigationInfo(playerMapPosition(),destination);
 const visible=Boolean(metrics&&['world','tunnel'].includes(space));
 $('navIndicator').hidden=!visible;
 if(visible){
  const label=metrics.distance>=3.5?`${metrics.distanceLabel} · ${metrics.cardinal}`:'Você chegou';
  $('navName').textContent=destination.name;
  $('navDistance').textContent=label;
  $('navArrow').style.transform=`rotate(${metrics.angle+yaw}rad)`;
 }
 $('clearDestination').disabled=!waypoint;
 $('visitDestination').disabled=!waypoint?.area||changingRegion;
 $('mapDestination').textContent=metrics?`${destination.name} · ${metrics.distanceLabel} · ${metrics.cardinal} em linha reta`:'Selecione um ponto para marcar o destino.';
 for(const button of $('localPlaces').querySelectorAll('button')){
  button.setAttribute('aria-pressed',String(button.dataset.destination===waypoint?.id));
 }
}
function setDestination(place){
 waypoint={...place,...(place.spawn?{x:place.spawn.x,z:place.spawn.z}:{})};
 toast('Destino marcado: '+place.name);
 updateNavigation();
 drawMap($('atlas'),true);
}
function populateMapPlaces(){
 const atlas=mapMode==='atlas';
 $('terrainCredit').hidden=!(historicArea&&(atlas||area==='historic'));
 const points=atlas?playableDestinations:playableDestinations.filter(place=>place.area===area);
 $('localPlacesTitle').textContent=atlas?'Pontos visitáveis':area==='historic'?'Visite no Centro Histórico':'Visite na Paulista';
 $('localPlaces').replaceChildren();
 for(const place of points){
  const item=document.createElement('button');
  item.textContent=place.name;
  item.dataset.destination=place.id;
  item.setAttribute('aria-pressed',String(waypoint?.id===place.id));
  item.onclick=()=>setDestination(place);
  if(atlas){
   const section=document.createElement('small');
   section.textContent=place.area==='historic'?'Centro Histórico':'Avenida Paulista';
   item.append(section);
  }
  $('localPlaces').append(item);
 }
 $('localPlacesTitle').hidden=!points.length;
 $('otherPlaces').replaceChildren(...referenceDestinations().map(place=>{
  const item=document.createElement('span');
  item.textContent=place.name;
  return item;
 }));
}
function selectMapMode(mode){
 mapMode=mode;
 $('mapLocal').setAttribute('aria-pressed',String(mode==='local'));
 $('mapRegion').setAttribute('aria-pressed',String(mode==='atlas'));
 $('mapReference').hidden=mode==='local';
 populateMapPlaces();
 drawMap($('atlas'),true);
}
$('mapLocal').onclick=()=>selectMapMode('local');
$('mapRegion').onclick=()=>selectMapMode('atlas');
$('clearDestination').onclick=()=>{
 waypoint=null;
 updateNavigation();
 drawMap($('atlas'),true);
};
function openMap(){
 if(!running)return;
 if(area==='lab')selectMapMode('atlas');
 populateMapPlaces();
 updateNavigation();
 openDialog('mapDialog');
 drawMap($('atlas'),true);
}
$('mapButton').onclick=openMap;
function drawMap(canvas,full=false){
 const coverage=city.enabled||area==='lab'?null:area==='historic'?historicArea.bounds:paulista.bounds;
 drawNavigationMap(canvas,{
  position:playerMapPosition(),yaw,waypoint:currentDestination(),
  destinations:[...playableDestinations,...referenceDestinations().map(place=>({...place,playable:false}))],
  coverage,coverages:city.enabled?[]:[paulista.bounds,...(historicArea?[historicArea.bounds]:[])],mode:full?mapMode:'mini',space,
 });
}
$('testTravel').onclick=()=>{const mission=activeMission(),progress=state.missions[mission?.id]||{step:0},step=mission?.steps[progress.step],target=targetPosition(step?.target);if(step?.kind==='enter'){enterSpace(step.target);return;}if(target){player.x=target.x;player.z=target.z+(step.kind==='talk'?2:0);player.y=12;groundTarget=12;camera.position.set(player.x,15,player.z+8);toast('Reposicionamento de teste. O objetivo continua sendo validado pela interação.');}else if(step?.kind==='enter')enterSpace(step.target);};
const raycaster=new T.Raycaster(),down=new T.Vector3(0,-1,0);
function inSlice(x,z){return paulista.contains?.(x,z)??mapIncludes(paulista.bounds,{x,z});}
function worldGround(x,z,currentY){
 if(city.enabled)return groundTarget;
 if(area==='historic')return historicArea.groundHeight(x,z,currentY);
 return area==='paulista'?paulista.groundHeight(x,z):12;
}
function outdoorClear(x,z,radius){
 if(city.enabled)return canMove(x,z);
 if(area==='historic')return historicArea.canMove?.(x,z,radius)??(mapIncludes(historicArea.bounds,{x,z})&&canMove(x,z,historicArea.colliders,radius));
 return area==='paulista'?canMove(x,z,paulista.colliders,radius):canMove(x,z,lab.colliders,radius);
}
function canWalk(x,z){
 if(space==='metro')return metro.canMove(x,z);
 if(space==='tunnel')return tunnels.canMove(x,z);
 if(space!=='world'){
  return Math.abs(x)<6.5&&Math.abs(z)<7.4&&canMove(x,z,interiors.get(space).userData.colliders,.3);
 }
 if(!outdoorClear(x,z,.3))return false;
 return city.enabled||area!=='paulista'||(inSlice(x,z)&&!vehicles.blocks(x,z));
}

function move(dt){
 if(dt<=0)return;
 const {forward,side}=getInput();
 if(driving){
  const car=vehicles.drive({forward,side,brake:keys.has('Space')},dt,vehicleAllowed,space==='tunnel');
  Object.assign(player,{x:car.x,z:car.z,y:space==='tunnel'?0:12});
  yaw=car.yaw+Math.PI;
  if(!drag)driveOrbit*=Math.exp(-dt*2.5);
  return;
 }
 const walk=keys.has('ShiftLeft')||keys.has('ShiftRight')?8:3.5;
 const dx=(-Math.sin(yaw)*forward+Math.cos(yaw)*side)*walk*dt;
 const dz=(-Math.cos(yaw)*forward-Math.sin(yaw)*side)*walk*dt;
 const next=dx||dz?slideStep(player.x,player.z,dx,dz,canWalk):player;
 const stepX=next.x-player.x,stepZ=next.z-player.z;
 speed=Math.hypot(stepX,stepZ)/dt;
 if(city.enabled&&space==='world'&&city.ready&&speed>.01){
  raycaster.set(new T.Vector3(player.x,player.y+1,player.z),new T.Vector3(stepX,0,stepZ).normalize());
  raycaster.far=Math.hypot(stepX,stepZ)+.35;
  if(raycaster.intersectObject(city.tiles.group,true).length)speed=0;
 }
 if(speed>.01){
  player.x=next.x;
  player.z=next.z;
  avatar.root.rotation.y=approachAngle(avatar.root.rotation.y,Math.atan2(-stepX,-stepZ),1-Math.exp(-dt*14));
 }
 if(city.enabled&&space==='world'&&city.ready&&time-lastGround>.3){
  lastGround=time;
  raycaster.set(new T.Vector3(player.x,player.y+200,player.z),down);
  raycaster.far=400;
  const hit=raycaster.intersectObject(city.tiles.group,true)[0];
  if(hit)groundTarget=hit.point.y;
 }
 const level=space==='world'?worldGround(player.x,player.z,player.y):space==='metro'?metro.groundHeight(player.x,player.z):0;
 player.y=T.MathUtils.lerp(player.y,level,Math.min(1,dt*10));
 if(jumpRequested&&!jump&&jumpV===0)jumpV=6;
 jumpRequested=false;
 if(jumpV||jump){
  jumpV-=18*dt;
  jump=Math.max(0,jump+jumpV*dt);
  if(!jump)jumpV=0;
 }
 avatar.root.position.set(player.x,player.y+jump,player.z);
 avatar.animate(time,speed);
}
function updateInteraction(){
 nearestInteraction=null;
 const prompt=$('interactionPrompt');
 if(driving){
  prompt.hidden=false;
  const portal=tunnels.nearestPortal(player.x,player.z);
  prompt.textContent='E · Sair do carro'+(space==='world'&&Math.hypot(player.x-portal.x,player.z-portal.z)<15?' / acessar túnel':'');
  return;
 }
 if(space!=='world'){
  prompt.hidden=false;
  prompt.textContent=space==='metro'?`E · Estação / saída · Trem ${metro.motion.phase==='boarding'?'na plataforma':metro.motion.phase==='approaching'?'chegando':'partindo'}`:'E · Ações deste ambiente / sair';
  return;
 }
 const onPaulista=area==='paulista'&&!city.enabled;
 const nearby=[
  ['npc',npcs.filter(npc=>npc.human.root.visible)],
  ['service',area==='lab'?services:[]],
  ['car',onPaulista&&vehicles.own.model?[{...vehicles.own,name:'Sedã'}]:[]],
  ['metro',onPaulista?metroEntrances:[]],
  ['tunnel',onPaulista?tunnels.portals:[]],
 ];
 let closest=Infinity;
 for(const [type,items] of nearby){
  for(const item of items){
   const distance=Math.hypot(player.x-item.x,player.z-item.z);
   if(distance>(type==='tunnel'?10:4.5)||distance>=closest)continue;
   closest=distance;
   nearestInteraction={type,item};
  }
 }
 prompt.hidden=!nearestInteraction;
 if(nearestInteraction){
  const {type,item}=nearestInteraction;
  const action={npc:'Conversar com ',car:'Dirigir ',metro:'Descer ao metrô · ',tunnel:'Acessar '}[type]||'';
  prompt.textContent='E · '+action+item.name;
 }
}

const cameraTarget=new T.Vector3(),cameraDesired=new T.Vector3();
function updateCamera(dt){
 const orbit=yaw+(driving?driveOrbit:0);
 const distance=photo?74:(driving?7.6:space==='world'?5.2:3.8)*cameraZoom;
 const elevation=photo?0.48:(driving?0.27:0.14)+pitch;
 const horizontal=distance*Math.cos(elevation);
 cameraTarget.set(player.x,player.y+(driving?.85:1.34+jump*.25),player.z);
 cameraDesired.set(
  player.x+Math.sin(orbit)*horizontal,
  Math.max(player.y+.35,cameraTarget.y+Math.sin(elevation)*distance),
  player.z+Math.cos(orbit)*horizontal
 );
 if(!photo){
  for(let fraction=0.14;fraction<=1.01;fraction+=.14){
   const x=T.MathUtils.lerp(cameraTarget.x,cameraDesired.x,fraction);
   const z=T.MathUtils.lerp(cameraTarget.z,cameraDesired.z,fraction);
   let clear=true;
   if(space==='tunnel'||space==='metro')clear=canWalk(x,z);
   else if(space==='world'&&!city.enabled)clear=outdoorClear(x,z,.17);
   else if(space!=='world')clear=canMove(x,z,interiors.get(space).userData.colliders,.17)&&Math.abs(x)<6.8&&Math.abs(z)<7.9;
   if(!clear){
    cameraDesired.lerp(cameraTarget,1-Math.max(.12,fraction-.13));
    break;
   }
  }
 }
 const t=1-Math.exp(-dt*(driving?6:9));
 camera.position.lerp(cameraDesired,t);
 camera.lookAt(cameraTarget);
}
function updatePedestrians(dt){
 for(let i=0;i<npcs.length;i++){
  const npc=npcs[i];
  if(!npc.human.root.visible)continue;
  if(npc.walking&&npc.path?.length){
   const next=walkSidewalk(npc.path,time,i);
   npc.x=next.x;
   npc.z=next.z;
   npc.human.root.rotation.y=approachAngle(npc.human.root.rotation.y,next.yaw,1-Math.exp(-dt*9));
   npc.human.animate(time+i,1.3);
  }
  const level=city.enabled?player.y:worldGround(npc.x,npc.z,npc.human.root.position.y);
  npc.human.root.position.set(npc.x,level,npc.z);
 }
}
let frameSum=0,frameCount=0,reportedFps=0;
function frame(){
 requestAnimationFrame(frame);
 const frameSeconds=clock.getDelta(),dt=Math.min(frameSeconds,.05);
 const active=!isPaused();
 if(active){
  time+=dt;
  frameSum+=frameSeconds;frameCount++;
  if(frameSum>=1){reportedFps=Math.round(frameCount/frameSum);frameSum=frameCount=0;}
 }else{frameSum=frameCount=0;}
 if(avatar){
  if(active)move(dt);
  else avatar.animate(time,0);
  if(space==='world')updatePedestrians(dt);
  updateCamera(dt);
 }
 if(city.enabled&&space==='world'){
  city.update();
  $('tileCredits').textContent=city.credits();
 }
 traffic.forEach(light=>light.update(time));
 lighting.update(time,player,space==='world');
 if(historicArea?.root.visible){
  const q=$('quality').value;
  historicCrowd.update(active?dt:0,{player,quality:q,time});
  historicTraffic.update(dt,{active,player,quality:q,time,daylight:lighting.daylight,obstacles:historicCrowd.crossers});
  historicArea.updateDetail(player,q,lighting.daylight,time);
 }
 vehicles.update(dt,{active:active&&space==='world'&&area==='paulista'&&!city.enabled,obstacles:[...npcs,...(!driving?[player]:[])],driving});
 metro.update(dt,active&&space==='metro');
 if(space==='tunnel')tunnels.update(player);
 if(active&&time-lastUI>.15){
  lastUI=time;
  updateUI();
  updateInteraction();
  updateNavigation();
  drawMap($('minimap'));
  canvas.dataset.state=JSON.stringify({
   x:Math.round(player.x*100)/100,z:Math.round(player.z*100)/100,space,money:state.money,
   solo:true,photorealistic:city.enabled,area,fps:reportedFps,drawCalls:renderer.info.render.calls,quality:$('quality').value,
   driving,vehicleReady:!!vehicles.own.model,traffic:area==='historic'?historicTraffic?.vehicles?.length??0:vehicles.cars.length,
   crowd:area==='historic'?historicCrowd?.count??0:0,
   vehicleSpeed:Math.round(vehicles.own.speed*3.6),trainPhase:metro.motion.phase,npcs:npcs.length,
   mission:state.activeMission,step:state.missions[state.activeMission]?.step||0,
  });
 }
 lighting.render(dt,space==='world');
}
fillForm();frame();

async function boot(){
 try{
  await loadHuman();
  avatar=await createHuman(state.appearance);
  scene.add(avatar.root);
  studio=await characterStudio($('characterPreview'),state.appearance);
  for(const def of npcDefinitions){
   const human=await createHuman({...state.appearance,name:def.name,skin:def.skin,shirt:def.shirt,body:def.id==='marina'?.15:.8,hairStyle:def.id==='marina'?'longo':'curto'});
   actors.add(human.root);
   npcs.push({...def,human});
  }
  switchArea('paulista');
  try{city=await createPhotorealCity(scene,camera,renderer,status);}catch{city={enabled:false};}
  if(city.enabled){
   showWorld(true);
   $('mapCredits').hidden=false;
   $('cityConnectionTitle').textContent='Base fotogramétrica conectada';
   $('cityConnectionText').textContent='Explore a cidade transmitida pelo provedor.';
  }
  $('startStory').textContent='Começar na Paulista';
  for(const id of ['startStory','startFree','startHistoric'])$(id).disabled=false;
  applyAppearance();updateUI();
 }catch(error){
  console.error(error);
  $('cityConnectionText').textContent='Não foi possível preparar o jogo. Recarregue para tentar novamente.';
 }
}

function localWalkingPaths(origin){
 const candidates=[];
 for(const road of roadRecords){
  if(road.layer!==0||road.tunnel||!['pedestrian','footway','living_street','residential','tertiary'].includes(road.kind))continue;
  for(let i=1;i<road.points.length;i++){
   const [x1,z1]=road.points[i-1],[x2,z2]=road.points[i];
   const length=Math.hypot(x2-x1,z2-z1);
   const mx=(x1+x2)*.5,mz=(z1+z2)*.5;
   const distance=Math.hypot(mx-origin.x,mz-origin.z);
   if(distance<13||distance>115||length<6)continue;
   const dx=(x2-x1)/length,dz=(z2-z1)/length;
   const offset=['pedestrian','footway','living_street'].includes(road.kind)?0:4;
   const count=Math.max(2,Math.floor(Math.min(18,length-2)/1.5));
   const path=Array.from({length:count},(_,index)=>{
    const along=(index-(count-1)*.5)*1.5;
    return {x:mx+dx*along-dz*offset,z:mz+dz*along+dx*offset};
   });
   if(path.every(point=>outdoorClear(point.x,point.z,.4)))candidates.push({path,distance});
  }
 }
 return candidates.sort((a,b)=>a.distance-b.distance).slice(0,10).map(item=>item.path);
}

function positionPedestrians(spawn){
 const historicPaths=area==='historic'?localWalkingPaths(spawn):[];
 for(let i=0;i<npcs.length;i++){
  const npc=npcs[i],def=npcDefinitions[i];
  if(area==='historic'){
   npc.path=npc.walking?historicPaths[i-2]:undefined;
   npc.human.root.visible=Boolean(npc.path);
   if(npc.path)Object.assign(npc,walkSidewalk(npc.path,time,i));
   continue;
  }
  npc.human.root.visible=true;
  if(area==='lab'){
   npc.x=def.x;
   npc.z=def.z;
   npc.path=npc.walking?[{x:def.x-4,z:def.z},{x:def.x+4,z:def.z}]:undefined;
  }else{
   const offset=i<2?i*6+3:(i-6)*4;
   npc.x=paulistaSpawn.x+paulista.source.axis[0]*offset;
   npc.z=paulistaSpawn.z+paulista.source.axis[1]*offset;
   npc.path=npc.walking?paulistaPedestrianPath(spawn,i,(x,z)=>inSlice(x,z)&&outdoorClear(x,z,.35)):undefined;
  }
  if(npc.path?.length)Object.assign(npc,walkSidewalk(npc.path,time,i));
 }
}

function switchArea(next,destination){
 clearInput();
 if(driving){driving=false;vehicles.own.speed=0;}
 if(space!=='world')leaveSpace();
 avatar.root.visible=true;
 area=next;
 showWorld(true);
 const defaultSpawn=area==='lab'?{x:0,z:-65,y:12,heading:Math.PI}:area==='historic'?historicArea.spawn:{...paulistaSpawn,heading:paulistaHeading};
 let spawn=destination?.spawn??destination??defaultSpawn;
 // Points without a dedicated exterior spawn may be pinned on a building.
 if(!outdoorClear(spawn.x,spawn.z,.45)||(area==='paulista'&&!inSlice(spawn.x,spawn.z))){
  const anchor=spawn;
  spawn=null;
  for(const radius of [3,5,8,12,18,25]){
   for(let step=0;step<12;step++){
    const angle=step*Math.PI/6;
    const x=anchor.x+Math.cos(angle)*radius,z=anchor.z+Math.sin(angle)*radius;
    if(outdoorClear(x,z,.45)&&(area!=='paulista'||inSlice(x,z))){
     spawn={x,z,heading:Math.atan2(x-anchor.x,z-anchor.z)};
     break;
    }
   }
   if(spawn)break;
  }
  spawn??=defaultSpawn;
 }
 groundTarget=spawn.y??defaultSpawn.y??12;
 player.x=spawn.x;player.z=spawn.z;player.y=worldGround(player.x,player.z,spawn.y);
 setPanorama(false);jump=jumpV=0;driveOrbit=0;pitch=spawn.pitch??destination?.pitch??.02;
 yaw=spawn.heading??destination?.heading??defaultSpawn.heading;
 avatar.root.rotation.y=yaw;
 avatar.root.position.set(player.x,player.y,player.z);
 positionPedestrians(spawn);
 camera.position.set(player.x+Math.sin(yaw)*5,player.y+2.4,player.z+Math.cos(yaw)*5);
 $('labButton').textContent=area==='lab'?'Voltar à Avenida Paulista':'Laboratório de lojas e interiores';
 status(surfaceStatus());
 if(running){updateUI();updateInteraction();updateNavigation();drawMap($('minimap'));}
}

function openRegions(){
 for(const id of ['menuDialog','mapDialog'])$(id).close();
 $('travelStatus').hidden=true;
 openDialog('regionDialog');
}
async function travelRegion(next,destination){
 if(changingRegion)return;
 if(driving&&Math.abs(vehicles.own.speed)>1.5){
  if($('regionDialog').open){
   $('travelStatus').hidden=false;
   $('travelStatus').textContent='Pare o carro antes de trocar de região.';
  }else{
   $('mapDestination').textContent='Pare o carro antes de visitar o destino.';
  }
  return;
 }
 const buttons=['startHistoric','travelHistoric','travelPaulista','visitDestination'].map($);
 changingRegion=true;
 buttons.forEach(button=>button.disabled=true);
 const launch=$('startHistoric').textContent;
 const info=$('travelStatus');
 try{
  if(next==='historic'&&!historicArea){
   $('startHistoric').textContent='Carregando o Centro…';
   info.hidden=false;
   info.textContent='Carregando as ruas e os edifícios do Centro…';
   await loadHistoric();
  }
  waypoint=null;
  switchArea(next,destination);
  selectMapMode('local');
  for(const dialog of document.querySelectorAll('dialog[open]'))dialog.close();
  if(!running)start(true);
  else toast(destination?.name??surfaceStatus());
 }catch(error){
  console.error('Falha ao carregar a região.',error);
  info.hidden=false;
  info.textContent='O Centro Histórico não carregou. Tente novamente.';
  if(!running)$('cityConnectionText').textContent=info.textContent;
  if($('mapDialog').open)$('mapDestination').textContent=info.textContent;
  toast(info.textContent);
 }finally{
  changingRegion=false;
  buttons.slice(0,3).forEach(button=>button.disabled=false);
  $('startHistoric').textContent=launch;
  updateNavigation();
 }
}

$('regionButton').onclick=$('mapTravel').onclick=openRegions;
$('travelPaulista').onclick=()=>travelRegion('paulista');
$('travelHistoric').onclick=$('startHistoric').onclick=()=>travelRegion('historic');
$('visitDestination').onclick=()=>{if(waypoint?.area)travelRegion(waypoint.area,waypoint);};
$('labButton').onclick=()=>{
 if(driving&&Math.abs(vehicles.own.speed)>1.5){$('menuDialog').close();toast('Pare o carro para viajar.');return;}
 waypoint=null;
 switchArea(area==='lab'?'paulista':'lab');
 $('menuDialog').close();
 toast(surfaceStatus());
};

boot();

function mobilitySurface(){if(driving&&Math.abs(vehicles.own.speed)>1.5){toast('Pare o carro para viajar.');return false;}if(space!=='world')leaveSpace();if(area!=='paulista')switchArea('paulista');if(driving){driving=false;avatar.root.visible=true;vehicles.own.speed=0;}return true;}
function visitMobility(kind){if(!mobilitySurface())return;if(kind==='car'){if(!vehicles.own.model){toast('O carro ainda está carregando.');return;}const c=vehicles.own;Object.assign(player,{x:c.x+Math.cos(c.yaw)*3.1,z:c.z-Math.sin(c.yaw)*3.1,y:12});yaw=c.yaw+Math.PI;groundTarget=12;setPanorama(false);camera.position.set(player.x+Math.sin(yaw)*6,15,player.z+Math.cos(yaw)*6);updateUI();toast('Você chegou ao carro. Aproxime-se e pressione E para dirigir.');}else if(kind==='metro'){Object.assign(player,{...metroEntrances[0],y:12});enterSpace('metro');}else{const portal=tunnels.portals[1];Object.assign(player,{x:portal.x,z:portal.z,y:12});enterTunnel(portal);}}
$('transportButton').onclick=()=>{const destinations=[['Ir até o carro',()=>visitMobility('car')],['Visitar plataforma do metrô',()=>visitMobility('metro')],['Explorar Túnel Nove de Julho',()=>visitMobility('tunnel')]];dialogue('Mobilidade na Paulista','Acesso rápido aos trechos disponíveis. Você também pode chegar pela rua e pressionar E. Carro: W/S acelerar e frear, A/D virar, Espaço freio. Estação e túneis são reconstruções parciais; os acessos usam transições.',destinations);$('menuDialog').close();};

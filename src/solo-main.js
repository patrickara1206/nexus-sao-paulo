import * as T from 'three';import {Sky} from 'three/addons/objects/Sky.js';import './solo.css';
import {createHuman,characterStudio,loadHuman} from './human.js';
import {normalizeState,buyClothing,buyMeal,advanceMission,missions,clothing} from './game-state.js';
import {createLab,makeInteriors,makeTrafficLight} from './lab.js';
import {createPaulista,paulistaSpawn,paulistaHeading} from './paulista.js';
import {createVehicles} from './vehicles.js';
import {createMetro,addMetroEntrances,metroEntrances} from './metro.js';
import {createTunnels,addTunnelPortals} from './tunnels.js';
import {createPhotorealCity} from './photoreal-city.js';
import {places,nearestStreet,nearestPlace,canMove,project,trianonEntrance,inTrianon} from './geography.js';
import {paulistaPedestrianPath,walkSidewalk,slideStep,approachAngle} from './exploration.js';
import {drawNavigationMap,navigationInfo} from './navigation-map.js';
const $=id=>document.getElementById(id),canvas=$('world'),storageKey='nexus-solo-v2';let raw;try{raw=JSON.parse(localStorage.getItem(storageKey)||'null');}catch{}
const state=normalizeState(raw),player={x:0,z:-65,y:12},clock=new T.Clock(),keys=new Set(),stick={x:0,y:0};let area='paulista',driving=false;let running=false,space='world',lastWorld={x:0,z:-65,y:12},yaw=Math.PI,pitch=.13,speed=0,jump=0,jumpV=0,time=0,lastUI=0,lastGround=0,groundTarget=12,photo=false,nearestInteraction,toastTimer,studio,avatar,city={enabled:false},waypoint=null;
let mapMode='local',cameraZoom=1,driveOrbit=0,jumpRequested=false;
let renderer;try{renderer=new T.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});}catch{$('cityConnectionText').textContent='WebGL 2 indisponível. Ative a aceleração gráfica do navegador.';throw new Error('WebGL 2 unavailable');}
renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.0;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
const scene=new T.Scene();scene.background=new T.Color('#acbdca');scene.fog=new T.FogExp2('#bac7ca',.0008);const sky=new Sky();sky.scale.setScalar(14000);sky.material.uniforms.turbidity.value=2.5;sky.material.uniforms.rayleigh.value=1.15;sky.material.uniforms.mieCoefficient.value=.004;sky.material.uniforms.sunPosition.value.set(-170,120,-80);scene.add(sky);const camera=new T.PerspectiveCamera(52,1,.05,18000);camera.position.set(0,15,-74);const hemi=new T.HemisphereLight('#d9e9ff','#727869',1.05);scene.add(hemi);const sun=new T.DirectionalLight('#fff1d9',2.1);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-70,right:70,top:70,bottom:-70,near:1,far:700});sun.shadow.bias=-.00015;sun.shadow.normalBias=.035;scene.add(sun,sun.target);
const pmrem=new T.PMREMGenerator(renderer),reflectionScene=new T.Scene();reflectionScene.add(sky.clone());scene.environment=pmrem.fromScene(reflectionScene,.03,.1,20000).texture;scene.environmentIntensity=.6;pmrem.dispose();
const paulista=createPaulista(scene),lab=createLab(scene),interiors=makeInteriors(scene),traffic=[makeTrafficLight(lab.root,-35,-60),makeTrafficLight(lab.root,35,-10)];lab.root.visible=false;Object.assign(player,paulistaSpawn);groundTarget=12;yaw=paulistaHeading;const actors=new T.Group();scene.add(actors);const npcs=[];
const vehicles=createVehicles(paulista.root,paulistaSpawn),metro=createMetro(scene),tunnels=createTunnels(scene);interiors.set('metro',metro.root);interiors.set('tunnel',tunnels.root);addMetroEntrances(paulista.root);addTunnelPortals(paulista.root,tunnels);
const historic=[...places.filter(p=>['se','copan','italia','theatro','luz'].includes(p.id)),
 {id:'biblioteca',name:'Biblioteca Mário de Andrade',...project(-23.54730766,-46.64199203)},
 {id:'martinelli',name:'Edifício Martinelli',...project(-23.54547271,-46.63523105)},
 {id:'pinacoteca',name:'Pinacoteca do Estado',...project(-23.53428719,-46.63388775)},
 {id:'sao-bento',name:'Largo São Bento',...project(-23.54476242,-46.63366799)},
 {id:'patio',name:'Pátio do Colégio',...project(-23.5487,-46.6320)},
 {id:'anhangabau',name:'Vale do Anhangabaú',...project(-23.5452,-46.6391)},
 {id:'republica',name:'Praça da República',...project(-23.5438,-46.6425)}];
const trianon=trianonEntrance;const destinations=[...places,trianon,...historic.filter(p=>!places.some(q=>q.id===p.id))];
const services=[{id:'clothes',name:'Loja de roupas · teste de gameplay',x:-8,z:-67},{id:'food',name:'Lanchonete · teste de gameplay',x:12,z:-60},{id:'home',name:'Apartamento · teste de gameplay',x:-13,z:-79}];
const npcDefinitions=[{id:'marina',name:'Marina · guia',x:3,z:-58,shirt:'#6b3142',skin:'#9f6446'},{id:'rafael',name:'Rafael · mobilidade',x:20,z:-78,shirt:'#254966',skin:'#b98462'},...Array.from({length:10},(_,i)=>({id:'passante-'+i,name:'Morador',x:Math.cos(i*2.4)*25,z:-65+Math.sin(i*2.4)*36,shirt:['#a69d8a','#485c68','#5e6654','#783b36'][i%4],skin:['#70452f','#c49c7e','#a16c4c'][i%3],walking:true}))];
const markers=new T.Group();lab.root.add(markers);for(const service of services){const m=new T.Mesh(new T.TorusGeometry(.5,.035,6,32),new T.MeshStandardMaterial({color:'#d1af69',emissive:'#7e602c',emissiveIntensity:.5}));m.rotation.x=-Math.PI/2;m.position.set(service.x,12.25,service.z);markers.add(m);}
function save(){try{localStorage.setItem(storageKey,JSON.stringify(state));}catch{toast('Não foi possível salvar o progresso neste navegador.');}}
function toast(text){$('toast').textContent=text;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),4200);}
function status(text){$('cityStatus').textContent=text;}
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
function targetPosition(target){const npc=npcs.find(n=>n.id===target);if(npc)return npc;const service=services.find(s=>s.id===target);if(service)return service;const p=destinations.find(p=>p.id===target);if(p?.id==='masp'&&area==='paulista')return {x:paulistaSpawn.x+paulistaSourceOffset().x,z:paulistaSpawn.z+paulistaSourceOffset().z};return p?{...p,z:p.z-(p.id==='masp'?45:0)}:null;}
function updateUI(){const current=activeMission(),progress=state.missions[current?.id]||{step:0},task=current?.steps[progress.step];document.body.classList.toggle('free-mode',state.freeMode);$('money').textContent='R$ '+state.money.toLocaleString('pt-BR');$('health').textContent='Saúde '+Math.round(state.health);$('touchJump').textContent=driving?'■':'↑';$('touchJump').setAttribute('aria-label',driving?'Frear':'Pular');$('gameMode').textContent=driving?`${Math.round(Math.abs(vehicles.own.speed)*3.6)} km/h · E sair · Espaço frear`:state.freeMode?'MODO LIVRE · SOLO':'HISTÓRIA · SOLO';$('questCaption').textContent=state.freeMode?'EXPLORAÇÃO LIVRE':'HISTÓRIA SOLO';$('questTitle').textContent=state.freeMode?'A cidade no seu ritmo':current?.title||'Sua vida em São Paulo';$('questTask').textContent=state.freeMode?'Explore, converse e personalize seu personagem.':task?.text||'História concluída. Escolha outra no diário.';$('testTravel').hidden=state.freeMode||city.enabled||area!=='lab'||!task||space!=='world';const mapPosition=space==='metro'?lastWorld:player,street=nearestStreet(mapPosition.x,mapPosition.z),streetName=inTrianon(player.x,player.z)?'Parque Trianon · caminho interno':street.distance<45?street.name:street.distance<140?'Próximo a '+street.name:'Fora de via identificada';$('streetCaption').textContent=space==='metro'?'LINHA 2–VERDE':space==='tunnel'?'SUBTERRÂNEO · TRAÇADO OSM':space!=='world'?'INTERIOR DE TESTES':city.enabled||area==='paulista'?'RUA ATUAL DO PERSONAGEM':'REFERÊNCIA GEOGRÁFICA DO LABORATÓRIO';$('street').textContent=space==='world'?streetName:({home:'Apartamento',food:'Lanchonete',clothes:'Loja de roupas',metro:'Estação Trianon–Masp',tunnel:'Túnel Nove de Julho'}[space]);$('mapStreet').textContent=space==='metro'?'Estação Trianon–Masp · subterrâneo':space==='tunnel'?'Túnel Nove de Julho · subterrâneo':'Rua atual: '+streetName;$('district').textContent=['metro','tunnel'].includes(space)?'Reconstrução parcial · dimensões verticais aproximadas':space!=='world'?'Ambiente de mecânicas · interior não levantado':city.enabled?nearestPlace(player.x,player.z).name+' · São Paulo':area==='paulista'?'Paulista · reconstrução parcial com fontes':'Laboratório separado · cenário de teste';$('clock').textContent=`${String(14+Math.floor(time/240)%10).padStart(2,'0')}:${String(Math.floor(time/4)%60).padStart(2,'0')}`;if(!state.freeMode&&task?.kind==='visit'&&space==='world'){const p=targetPosition(task.target);if(p&&(!city.enabled&&area==='paulista'&&!inSlice(p.x,p.z)?false:Math.hypot(player.x-p.x,player.z-p.z)<12))handleMission({kind:'visit',target:task.target});}}
function openDialog(id){
 clearInput();
 if(id==='menuDialog')$('cameraButton').hidden=space!=='world';
 if(!$(id).open)$(id).showModal();
}
for(const b of document.querySelectorAll('[data-close]'))b.onclick=()=>$(b.dataset.close).close();
function dialogue(title,text,actions=[]){$('dialogueTitle').textContent=title;$('dialogueText').textContent=text;$('dialogueActions').replaceChildren();for(const [label,action]of actions){const b=document.createElement('button');b.textContent=label;b.onclick=()=>{$('dialogue').close();action();};$('dialogueActions').append(b);}openDialog('dialogue');}
function talk(npc){npc.human.root.rotation.y=Math.atan2(npc.x-player.x,npc.z-player.z);const text=npc.id==='marina'?'Oi! Sou a Marina. Que tal começar pelo MASP e conhecer a entrada do Trianon? Depois, volte para me contar como foi o passeio.':npc.id==='rafael'?'Vamos conhecer a mobilidade deste trecho? Visite a plataforma do Trianon–Masp, explore o Túnel Nove de Julho e depois volte para conversar comigo.':'A Paulista muda a cada hora. Você pode explorar livremente ou seguir uma das histórias.';dialogue(npc.name,text,[[npc.id==='marina'?'Vamos começar':npc.id==='rafael'?'Conhecer o circuito':'Até mais',()=>{handleMission({kind:'talk',target:npc.id});}]]);}
function enterSpace(id){if(space==='world')lastWorld={...player};space=id;lab.root.visible=false;paulista.root.visible=false;if(city.enabled)city.tiles.group.visible=false;actors.visible=false;for(const [kind,root]of interiors)root.visible=kind===id;player.x=0;player.z=5;player.y=0;groundTarget=0;jump=0;jumpV=0;setPanorama(false);yaw=0;avatar.root.rotation.y=yaw;camera.position.set(0,2.7,10);handleMission({kind:'enter',target:id});updateNavigation();status(id==='metro'?'Trianon–Masp · plataforma central, dois mezaninos. Dimensões aproximadas.':'Ambiente de mecânicas · interior fictício.');toast(id==='metro'?'E para informações e saída. Embarque ainda não disponível.':'Interior de testes. E para ações e saída.');updateUI();updateInteraction();}
function leaveSpace(){if(vehicles.own.model&&vehicles.own.model.parent!==vehicles.root){vehicles.root.add(vehicles.own.model);vehicles.own.y=12.08;vehicles.reset();}if(driving){driving=false;vehicles.own.speed=0;vehicles.root.add(vehicles.own.model);vehicles.own.y=12.08;vehicles.reset();avatar.root.visible=true;}space='world';Object.assign(player,lastWorld);groundTarget=player.y;lab.root.visible=!city.enabled&&area==='lab';paulista.root.visible=!city.enabled&&area==='paulista';if(city.enabled)city.tiles.group.visible=true;actors.visible=true;for(const root of interiors.values())root.visible=false;yaw=Math.PI;camera.position.set(player.x,player.y+3,player.z-8);status(area==='lab'?'Laboratório de mecânicas · cenário separado.':'Paulista · reconstrução parcial com fontes.');updateUI();updateInteraction();updateNavigation();}
function interiorActions(){if(space==='food')dialogue('Lanchonete · interior de testes','Refeição por R$ 25 em dinheiro do jogo. Recupera 30 pontos de saúde.',[['Pedir refeição · R$ 25',()=>{if(buyMeal(state)){handleMission({kind:'purchase',target:'meal'});save();toast('Refeição comprada. Saúde recuperada.');updateUI();}else toast('Saldo insuficiente.');}],['Sair para a rua',leaveSpace]]);if(space==='clothes')dialogue('Loja de roupas · interior de testes','Escolha um conjunto. O dinheiro vem das histórias e das atividades do jogo.',[['Ver roupas',showShop],['Sair para a rua',leaveSpace]]);if(space==='home')dialogue('Seu apartamento · interior de testes','Descanse, altere o visual ou retome a exploração.',[['Descansar',()=>{state.health=100;save();updateUI();toast('Saúde recuperada.');}],['Personalizar personagem',customize],['Sair para a rua',leaveSpace]]);}
function vehicleAllowed(x,z){return space==='tunnel'?tunnels.canMove(x,z):inSlice(x,z)&&canMove(x,z,paulista.colliders,1.1);}
function exitVehicle(){if(Math.abs(vehicles.own.speed)>1.5){toast('Pare o carro antes de sair.');return;}const p=vehicles.exitPoint(vehicleAllowed);if(!p){toast('Espere haver espaço livre ao lado do carro.');return;}driving=false;vehicles.own.speed=0;Object.assign(player,p,{y:space==='tunnel'?0:12});groundTarget=player.y;avatar.root.visible=true;toast('Você saiu do carro.');}
function enterTunnel(portal){if(space==='world')lastWorld={...player};space='tunnel';paulista.root.visible=lab.root.visible=false;actors.visible=false;tunnels.root.visible=true;const entry=tunnels.entry(portal);Object.assign(player,entry);groundTarget=0;yaw=entry.yaw+Math.PI;jump=jumpV=0;setPanorama(false);driveOrbit=0;avatar.root.rotation.y=yaw;if(driving){tunnels.root.add(vehicles.own.model);Object.assign(vehicles.own,entry,{y:.08,speed:0});}camera.position.set(player.x+Math.sin(yaw)*5,2.6,player.z+Math.cos(yaw)*5);handleMission({kind:'enter',target:'tunnel'});updateNavigation();status('Nove de Julho · traçado mapeado; seção, profundidade e iluminação aproximadas.');toast('E para ações e saída. Acesso por transição.');updateUI();updateInteraction();}
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
function start(free){state.freeMode=free;running=true;document.body.classList.add('playing');save();updateUI();updateNavigation();drawMap($('minimap'));toast(city.enabled?'Bem-vindo a São Paulo.':area==='paulista'?'MASP e Trianon · reconstrução parcial. Consulte as fontes e limitações no menu.':'Laboratório de mecânicas. Esse cenário não representa um local real.');}
$('startStory').onclick=()=>start(false);$('startFree').onclick=()=>start(true);$('pauseButton').onclick=()=>openDialog('menuDialog');$('journalButton').onclick=showJournal;$('customizeButton').onclick=customize;$('modeButton').onclick=()=>{state.freeMode=!state.freeMode;save();updateUI();$('menuDialog').close();};$('recoverButton').onclick=()=>{if(space!=='world')leaveSpace();switchArea(area);$('menuDialog').close();};$('mapsSetup').onclick=$('cityInfoButton').onclick=()=>openDialog('cityDialog');$('touchInteract').onclick=interact;$('touchJump').onpointerdown=e=>{if(isPaused())return;e.target.setPointerCapture(e.pointerId);if(driving)keys.add('Space');else jumpRequested=true;};$('touchJump').onpointerup=$('touchJump').onpointercancel=()=>keys.delete('Space');
$('characterForm').oninput=e=>{const el=e.target;if(!el.name)return;state.appearance[el.name]=['body','build','height','bodyHair'].includes(el.name)?Number(el.value):el.value;applyAppearance();save();};for(const b of document.querySelectorAll('[data-tab]'))b.onclick=()=>{document.querySelectorAll('[data-tab]').forEach(x=>x.classList.toggle('active',x===b));document.querySelectorAll('[data-section]').forEach(x=>x.hidden=x.dataset.section!==b.dataset.tab);};
function quality(){const low=$('quality').value==='low',balanced=$('quality').value==='balanced';renderer.setPixelRatio(Math.min(devicePixelRatio,low?1:balanced?1.3:1.75));renderer.shadowMap.enabled=!low;renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();}if(matchMedia('(pointer:coarse)').matches||innerWidth<700)$('quality').value='low';else $('quality').value='balanced';$('quality').onchange=quality;addEventListener('resize',quality);quality();
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
 ...destinations.filter(place=>['masp','trianon'].includes(place.id)),
 {id:'metro',name:'Metrô Trianon–Masp',x:metroEntrances[0].x,z:metroEntrances[0].z},
 {...tunnels.portals[1],id:'tunnel',name:'Túnel Nove de Julho'},
];
const referenceDestinations=destinations.filter(place=>!playableDestinations.some(local=>local.id===place.id));
const mapDestinations=[...playableDestinations,...referenceDestinations];

function playerMapPosition(){
 return ['world','tunnel'].includes(space)?player:lastWorld;
}

function missionDestination(){
 if(state.freeMode||space!=='world')return null;
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
 $('mapDestination').textContent=metrics?`${destination.name} · ${metrics.distanceLabel} · ${metrics.cardinal} em linha reta`:'Selecione um ponto para marcar o destino.';
 for(const button of $('localPlaces').querySelectorAll('button')){
  button.setAttribute('aria-pressed',String(button.dataset.destination===waypoint?.id));
 }
}
function setDestination(place){
 if(!city.enabled&&!inSlice(place.x,place.z))return;
 waypoint={...place};
 toast('Destino marcado: '+place.name);
 updateNavigation();
 drawMap($('atlas'),true);
}
for(const [container,list,markable] of [
 [$('localPlaces'),playableDestinations,true],
 [$('historicPlaces'),historic,false],
 [$('otherPlaces'),referenceDestinations.filter(place=>!historic.some(site=>site.id===place.id)),false],
]){
 for(const place of list){
  const item=document.createElement(markable?'button':'span');
  item.textContent=place.name;
  if(markable){
   item.dataset.destination=place.id;
   item.setAttribute('aria-pressed','false');
   item.onclick=()=>setDestination(place);
  }
  container.append(item);
 }
}
function selectMapMode(mode){
 mapMode=mode;
 $('mapLocal').setAttribute('aria-pressed',String(mode==='local'));
 $('mapRegion').setAttribute('aria-pressed',String(mode==='atlas'));
 $('mapReference').hidden=mode==='local';
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
 updateNavigation();
 openDialog('mapDialog');
 drawMap($('atlas'),true);
}
$('mapButton').onclick=openMap;
function drawMap(canvas,full=false){
 drawNavigationMap(canvas,{
  position:playerMapPosition(),yaw,waypoint:currentDestination(),destinations:mapDestinations,
  coverage:!city.enabled&&area==='paulista'?paulista.bounds:null,mode:full?mapMode:'mini',space,
 });
}
$('testTravel').onclick=()=>{const mission=activeMission(),progress=state.missions[mission?.id]||{step:0},step=mission?.steps[progress.step],target=targetPosition(step?.target);if(step?.kind==='enter'){enterSpace(step.target);return;}if(target){player.x=target.x;player.z=target.z+(step.kind==='talk'?2:0);player.y=12;groundTarget=12;camera.position.set(player.x,15,player.z+8);toast('Reposicionamento de teste. O objetivo continua sendo validado pela interação.');}else if(step?.kind==='enter')enterSpace(step.target);};
const raycaster=new T.Raycaster(),down=new T.Vector3(0,-1,0);
function inSlice(x,z){const b=paulista.bounds;return x>b.minX&&x<b.maxX&&z>b.minZ&&z<b.maxZ;}
function canWalk(x,z){
 if(space==='metro')return metro.canMove(x,z);
 if(space==='tunnel')return tunnels.canMove(x,z);
 if(space!=='world'){
  return Math.abs(x)<6.5&&Math.abs(z)<7.4&&canMove(x,z,interiors.get(space).userData.colliders,.3);
 }
 if(city.enabled)return canMove(x,z);
 if(area==='lab')return canMove(x,z,lab.colliders,.3);
 return inSlice(x,z)&&canMove(x,z,paulista.colliders,.3)&&!vehicles.blocks(x,z);
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
 const level=space==='world'?groundTarget:space==='metro'?metro.groundHeight(player.x,player.z):0;
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
function updateInteraction(){nearestInteraction=null;let distance=4.5;if(driving){$('interactionPrompt').hidden=false;$('interactionPrompt').textContent='E · Sair do carro'+(space==='world'&&Math.hypot(player.x-tunnels.nearestPortal(player.x,player.z).x,player.z-tunnels.nearestPortal(player.x,player.z).z)<15?' / acessar túnel':'');return;}if(space!=='world'){$('interactionPrompt').hidden=false;$('interactionPrompt').textContent=space==='metro'?`E · Estação / saída · Trem ${metro.motion.phase==='boarding'?'na plataforma':metro.motion.phase==='approaching'?'chegando':'partindo'}`:'E · Ações deste ambiente / sair';return;}const outdoor=area==='paulista'&&!city.enabled;for(const [type,list]of [['npc',npcs],['service',area==='lab'?services:[]],['car',outdoor&&vehicles.own.model?[{...vehicles.own,name:'Sedã'}]:[]],['metro',outdoor?metroEntrances:[]],['tunnel',outdoor?tunnels.portals:[]]])for(const item of list){const d=Math.hypot(player.x-item.x,player.z-item.z);if(d<distance||(type==='tunnel'&&d<10)){distance=d;nearestInteraction={type,item};}}$('interactionPrompt').hidden=!nearestInteraction;if(nearestInteraction)$('interactionPrompt').textContent=`E · ${nearestInteraction.type==='npc'?'Conversar com ':nearestInteraction.type==='car'?'Dirigir ':nearestInteraction.type==='metro'?'Descer ao metrô · ':'Acessar '}${nearestInteraction.item.name}`;}

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
 const solids=area==='paulista'?paulista.colliders:lab.colliders;
 if(!photo){
  for(let fraction=0.14;fraction<=1.01;fraction+=.14){
   const x=T.MathUtils.lerp(cameraTarget.x,cameraDesired.x,fraction);
   const z=T.MathUtils.lerp(cameraTarget.z,cameraDesired.z,fraction);
   let clear=true;
   if(space==='tunnel'||space==='metro')clear=canWalk(x,z);
   else if(space==='world'&&!city.enabled)clear=canMove(x,z,solids,.17);
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
 sun.position.set(player.x-170,player.y+120,player.z-80);
 sun.target.position.set(player.x,player.y,player.z);
}
function updatePedestrians(dt){
 for(let i=0;i<npcs.length;i++){
  const npc=npcs[i];
  if(npc.walking&&npc.path?.length){
   const next=walkSidewalk(npc.path,time,i);
   npc.x=next.x;
   npc.z=next.z;
   npc.human.root.rotation.y=approachAngle(npc.human.root.rotation.y,next.yaw,1-Math.exp(-dt*9));
   npc.human.animate(time+i,1.3);
  }
  npc.human.root.position.set(npc.x,city.enabled?player.y:12,npc.z);
 }
}
function frame(){
 requestAnimationFrame(frame);
 const frameSeconds=clock.getDelta(),dt=Math.min(frameSeconds,.05);
 const active=!isPaused();
 if(active)time+=dt;
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
   solo:true,photorealistic:city.enabled,area,fps:Math.round(1/frameSeconds),drawCalls:renderer.info.render.calls,
   driving,vehicleReady:!!vehicles.own.model,traffic:vehicles.cars.length,
   vehicleSpeed:Math.round(vehicles.own.speed*3.6),trainPhase:metro.motion.phase,npcs:npcs.length,
   mission:state.activeMission,step:state.missions[state.activeMission]?.step||0,
  });
 }
 sun.visible=space==='world';
 hemi.intensity=space==='world'?1.05:.22;
 scene.environmentIntensity=space==='world'?.6:.18;
 sky.position.copy(camera.position);
 renderer.render(scene,camera);
}
fillForm();frame();
async function boot(){try{await loadHuman();avatar=await createHuman(state.appearance);scene.add(avatar.root);avatar.root.position.set(0,12,-65);studio=await characterStudio($('characterPreview'),state.appearance);for(const def of npcDefinitions){const human=await createHuman({...state.appearance,name:def.name,skin:def.skin,shirt:def.shirt,body:def.id==='marina'?.15:.8,hairStyle:def.id==='marina'?'longo':'curto'});human.root.position.set(def.x,12,def.z);actors.add(human.root);npcs.push({...def,origin:{x:def.x,z:def.z},human});}
 switchArea('paulista');try{city=await createPhotorealCity(scene,camera,renderer,status);}catch{city={enabled:false};}if(city.enabled){lab.root.visible=false;paulista.root.visible=false;$('mapCredits').hidden=false;$('cityConnectionTitle').textContent='Base fotogramétrica conectada';$('cityConnectionText').textContent='A cidade real será carregada por transmissão. A cobertura e os interiores ainda precisam de validação.';$('startStory').textContent='Iniciar história';$('startFree').textContent='Explorar São Paulo';status('Base real em carregamento · personagens e histórias fictícios.');}else{$('cityConnectionTitle').textContent='Primeiro trecho: MASP e Parque Trianon';$('cityConnectionText').textContent='Contornos e caminhos mapeados, edifício reconstruído com referências. Carro dirigível, trânsito, estação e túneis em reconstrução. Paulista Corporate modelado por referência; os demais prédios e regiões estão incompletos.';$('startStory').textContent='Começar na Paulista';$('startFree').textContent='Explorar livremente';status('Paulista · carro, metrô e túneis em reconstrução parcial.');}$('startStory').disabled=false;$('startFree').disabled=false;applyAppearance();updateUI();}catch(error){console.error(error);$('cityConnectionText').textContent='Não foi possível carregar o personagem. Recarregue para tentar novamente.';}}
boot();

function switchArea(next){if(driving){driving=false;vehicles.own.speed=0;avatar.root.visible=true;}if(space!=='world')leaveSpace();area=next;lab.root.visible=next==='lab'&&!city.enabled;paulista.root.visible=next==='paulista'&&!city.enabled;Object.assign(player,next==='lab'?{x:0,z:-65,y:12}:paulistaSpawn);groundTarget=12;setPanorama(false);jump=jumpV=0;driveOrbit=0;pitch=.10;yaw=next==='lab'?Math.PI:paulistaHeading;avatar.root.rotation.y=yaw;for(let i=0;i<npcs.length;i++){const n=npcs[i];const def=npcDefinitions[i];n.x=next==='lab'?def.x:paulistaSpawn.x+paulista.source.axis[0]*(i<2?i*6+3:(i-6)*4);n.z=next==='lab'?def.z:paulistaSpawn.z+paulista.source.axis[1]*(i<2?i*6+3:(i-6)*4);if(n.walking){
  n.path=next==='paulista'
   ?paulistaPedestrianPath(paulistaSpawn,i,(x,z)=>inSlice(x,z)&&canMove(x,z,paulista.colliders,.35))
   :[{x:def.x-4,z:def.z},{x:def.x+4,z:def.z}];
  if(n.path.length)Object.assign(n,walkSidewalk(n.path,time,i));
 }}camera.position.set(player.x+Math.sin(yaw)*5,15,player.z+Math.cos(yaw)*5);status(next==='lab'?'Laboratório de mecânicas · cenário separado.':'MASP e Trianon · reconstrução parcial, detalhes em revisão.');if(running)updateUI();}
$('labButton').onclick=()=>{switchArea(area==='lab'?'paulista':'lab');$('labButton').textContent=area==='lab'?'Voltar ao MASP e Trianon':'Laboratório de lojas e interiores';$('menuDialog').close();toast(area==='lab'?'Ambientes de teste das lojas e interiores.':'Trecho do MASP e Trianon.');};

function mobilitySurface(){if(driving&&Math.abs(vehicles.own.speed)>1.5){toast('Pare o carro para viajar.');return false;}if(space!=='world')leaveSpace();if(area!=='paulista')switchArea('paulista');if(driving){driving=false;avatar.root.visible=true;vehicles.own.speed=0;}return true;}
function visitMobility(kind){if(!mobilitySurface())return;if(kind==='car'){if(!vehicles.own.model){toast('O carro ainda está carregando.');return;}const c=vehicles.own;Object.assign(player,{x:c.x+Math.cos(c.yaw)*3.1,z:c.z-Math.sin(c.yaw)*3.1,y:12});yaw=c.yaw+Math.PI;groundTarget=12;setPanorama(false);camera.position.set(player.x+Math.sin(yaw)*6,15,player.z+Math.cos(yaw)*6);updateUI();toast('Você chegou ao carro. Aproxime-se e pressione E para dirigir.');}else if(kind==='metro'){Object.assign(player,{...metroEntrances[0],y:12});enterSpace('metro');}else{const portal=tunnels.portals[1];Object.assign(player,{x:portal.x,z:portal.z,y:12});enterTunnel(portal);}}
$('transportButton').onclick=()=>{const destinations=[['Ir até o carro',()=>visitMobility('car')],['Visitar plataforma do metrô',()=>visitMobility('metro')],['Explorar Túnel Nove de Julho',()=>visitMobility('tunnel')]];dialogue('Mobilidade na Paulista','Acesso rápido aos trechos disponíveis. Você também pode chegar pela rua e pressionar E. Carro: W/S acelerar e frear, A/D virar, Espaço freio. Estação e túneis são reconstruções parciais; os acessos usam transições.',destinations);$('menuDialog').close();};

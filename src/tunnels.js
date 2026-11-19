import * as T from 'three';
import {batchStatic} from './scene-batching.js';
import source from './transport-source.json' with {type:'json'};
import {project,segmentDistance} from './geography.js';
import {makeRoute,sampleRoute,routeDistance} from './transport-math.js';
import {makeSign} from './metro.js';
export function createTunnels(scene){
 const root=new T.Group();root.visible=false;root.name='Nove de Julho tunnel study';scene.add(root);root.userData.colliders=[];
 const routes=source.ways.filter(w=>w.tags.highway).map(w=>({...makeRoute(w.points.map(([lon,lat])=>{const p=project(lat,lon);return [p.x,p.z];})),id:w.id,name:w.tags['tunnel:name']||'Túnel Nove de Julho'}));
 const concrete=new T.MeshStandardMaterial({color:'#656b68',roughness:.96,side:T.DoubleSide}),road=new T.MeshStandardMaterial({color:'#353a3b',roughness:.93}),light=new T.MeshBasicMaterial({color:'#fff3cd'}),white=new T.MeshStandardMaterial({color:'#dedbc6',roughness:.8});
 function box(x,y,z,w,h,d,mat,yaw=0){const m=new T.Mesh(new T.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);m.rotation.y=yaw;m.receiveShadow=true;root.add(m);return m;}
 const outer=5,inner=4.65;const shape=new T.Shape();shape.moveTo(-outer,0);shape.lineTo(-outer,1.3);for(let i=0;i<=32;i++){const a=Math.PI-i*Math.PI/32;shape.lineTo(Math.cos(a)*outer,1.3+Math.sin(a)*outer);}shape.lineTo(outer,0);shape.lineTo(inner,0);shape.lineTo(inner,1.3);for(let i=0;i<=32;i++){const a=i*Math.PI/32;shape.lineTo(Math.cos(a)*inner,1.3+Math.sin(a)*inner);}shape.lineTo(-inner,0);shape.closePath();
 for(const route of routes){for(let i=1;i<route.points.length;i++){const a=route.points[i-1],b=route.points[i],len=Math.hypot(b[0]-a[0],b[1]-a[1]),yaw=Math.atan2(b[0]-a[0],b[1]-a[1]);if(len<.05)continue;const shell=new T.Mesh(new T.ExtrudeGeometry(shape,{depth:len+.1,bevelEnabled:false,steps:1}),concrete);shell.position.set(a[0],0,a[1]);shell.rotation.y=yaw;root.add(shell);box((a[0]+b[0])/2,-.1,(a[1]+b[1])/2,9.3,.2,len+.1,road,yaw);for(let d=0;d<len;d+=12){const p=sampleRoute(route,route.lengths[i-1]+d);box(p.x,.012,p.z,.14,.025,4,white,yaw);}}
  for(let d=10;d<route.length;d+=24){const p=sampleRoute(route,d);box(p.x,5.55,p.z,.15,.08,3.5,light,p.yaw);}
 }
 batchStatic(root);
 root.add(new T.HemisphereLight('#c3c9c4','#4d514c',.7));
 const localLights=[-16,0,16].map(()=>{const lamp=new T.PointLight('#ffe9bf',100,38,2);root.add(lamp);return lamp;});
 const portals=routes.flatMap((r,i)=>[0,r.length].map((d,end)=>({...sampleRoute(r,d),route:i,end,name:'Túnel Nove de Julho',type:'tunnel'})));
 return {root,routes,portals,source,update(player){const candidates=routes.map(route=>({route,...routeDistance(route,player.x,player.z)})).sort((a,b)=>a.distance-b.distance);const nearest=candidates[0];localLights.forEach((lamp,i)=>{const p=sampleRoute(nearest.route,nearest.along+(i-1)*16);lamp.position.set(p.x,4.8,p.z);});},canMove(x,z){return routes.some(r=>routeDistance(r,x,z).distance<3.9);},entry(portal){const r=routes[portal.route],d=portal.end?r.length-12:12,p=sampleRoute(r,d);return {...p,y:0,yaw:p.yaw+(portal.end?Math.PI:0)};},nearestPortal(x,z){return portals.toSorted((a,b)=>Math.hypot(x-a.x,z-a.z)-Math.hypot(x-b.x,z-b.z))[0];}};
}
export function addTunnelPortals(parent,tunnels){const group=new T.Group();parent.add(group);for(const p of tunnels.portals){const sign=makeSign('TÚNEL NOVE DE JULHO ↓',7,.7,'#385c54');sign.position.set(p.x,15.2,p.z);sign.rotation.y=p.yaw;group.add(sign);}return group;}

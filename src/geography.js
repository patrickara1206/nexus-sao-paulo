import streetData from './streets.json' with {type:'json'};
import {previewRegions} from './regions.js';
import {toLocal} from './geodesy.js';
import parkData from './trianon.json' with {type:'json'};
export const SCALE=1;
export function project(lat,lon){const {x,z}=toLocal(lat,lon);return {x,z};}
export const places=[
 ['masp','MASP · Avenida Paulista',-23.5614,-46.6559,'Paulista · Vão livre e museu','masp'],
 ['casa','Casa das Rosas',-23.5711,-46.6447,'Paulista · Patrimônio e jardim','house'],
 ['japan','Japan House',-23.5707,-46.6455,'Paulista · Arte e arquitetura','japan'],
 ['copan','Edifício Copan',-23.5464,-46.6448,'Centro · Arquitetura modernista','copan'],
 ['italia','Edifício Itália',-23.5453,-46.643,'Centro · Skyline histórico','italia'],
 ['theatro','Theatro Municipal',-23.5452,-46.6388,'Centro · Praça Ramos','theater'],
 ['se','Catedral da Sé',-23.5504,-46.6339,'Centro · Praça da Sé','cathedral'],
 ['luz','Estação da Luz',-23.535,-46.6356,'Centro · Patrimônio ferroviário','station'],
 ['ibira','Parque Ibirapuera',-23.5873,-46.6576,'Ibirapuera · Parque e lagos','park'],
 ['oca','Oca',-23.5853,-46.6565,'Ibirapuera · Pavilhão de exposições','dome'],
 ['auditorio','Auditório Ibirapuera',-23.5848,-46.6577,'Ibirapuera · Música e arquitetura','auditorium'],
 ['bandeiras','Monumento às Bandeiras',-23.5819,-46.6645,'Ibirapuera · Praça Armando de Salles','monument']
].map(([id,name,lat,lon,region,model])=>({id,name,lat,lon,region,model,...project(lat,lon)}));
export const bounds={minX:-1900,maxX:3700,minZ:-3650,maxZ:4200};
export function coast(){return -10000;}
export function heightAt(x,z){if(previewRegions.some(r=>r.id!=='core'&&Math.hypot(x-r.x,z-r.z)<500))return 12;return 12+Math.sin(x*.0007)*3+Math.sin(z*.001)*2;}
export const roads=streetData.roads.map(r=>r.points);
export const roadRecords=streetData.roads;
export function segmentDistance(x,z,a,b){const dx=b[0]-a[0],dz=b[1]-a[1],den=dx*dx+dz*dz;if(!den)return Math.hypot(x-a[0],z-a[1]);const t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/den));return Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz);}
const cells=new Map(),cellSize=100;
for(const record of roadRecords){const r=record.points;for(let i=1;i<r.length;i++){const a=r[i-1],b=r[i];for(let cx=Math.floor((Math.min(a[0],b[0])-30)/cellSize);cx<=Math.floor((Math.max(a[0],b[0])+30)/cellSize);cx++)for(let cz=Math.floor((Math.min(a[1],b[1])-30)/cellSize);cz<=Math.floor((Math.max(a[1],b[1])+30)/cellSize);cz++){const key=cx+','+cz;if(!cells.has(key))cells.set(key,[]);cells.get(key).push([a,b,record.name]);}}}
export function onRoad(x,z,margin=15){return (cells.get(Math.floor(x/cellSize)+','+Math.floor(z/cellSize))||[]).some(([a,b])=>segmentDistance(x,z,a,b)<margin);}
export function nearestStreet(x,z){let best={name:'Área sem via identificada',distance:Infinity};const cx=Math.floor(x/cellSize),cz=Math.floor(z/cellSize);for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)for(const [a,b,name]of cells.get((cx+dx)+','+(cz+dz))||[]){if(!name)continue;const distance=segmentDistance(x,z,a,b);if(distance<best.distance)best={name,distance};}return best;}
export function inPark(x,z){return ((x+170)/650)**2+((z-2900)/900)**2<1;}
export function canMove(x,z,colliders=[],radius=1){const inside=x>bounds.minX+10&&x<bounds.maxX-10&&z>bounds.minZ+10&&z<bounds.maxZ-10||previewRegions.some(r=>r.id!=='core'&&Math.abs(x-r.x)<220&&Math.abs(z-r.z)<220&&(r.kind!=='coast'||z<r.z+170));if(!inside)return false;return !colliders.some(c=>{if(Math.abs(x-c.x)>=c.w/2+radius||Math.abs(z-c.z)>=c.d/2+radius)return false;if(!c.points)return true;let inside=false;for(let i=0,j=c.points.length-1;i<c.points.length;j=i++){const a=c.points[i],b=c.points[j];if(segmentDistance(x,z,a,b)<radius)return true;if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;});}
export function nearestPlace(x,z){return places.reduce((a,b)=>Math.hypot(a.x-x,a.z-z)<Math.hypot(b.x-x,b.z-z)?a:b);}

export const trianonPolygons=parkData.features.map(f=>f.geometry.coordinates[0].map(([lon,lat])=>{const p=project(lat,lon);return [p.x,p.z];}));
export const trianonEntrance={id:'trianon',name:'Parque Trianon · entrada mapeada',...project(parkData.entrance.lat,parkData.entrance.lon),source:'https://www.openstreetmap.org/node/'+parkData.entrance.node};
export function inTrianon(x,z){return trianonPolygons.some(points=>{let inside=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const a=points[i],b=points[j];if(segmentDistance(x,z,a,b)<.3)return true;if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;});}

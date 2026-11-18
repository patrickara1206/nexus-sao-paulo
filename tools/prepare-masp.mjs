import fs from 'node:fs';
import {toLocal} from '../src/geodesy.js';
const data=JSON.parse(fs.readFileSync(process.argv[2]||'../../work/buildings-osm-raw.json','utf8'));
const item=data.elements.find(e=>e.id===1370081491);
if(!item?.geometry)throw new Error('MASP OSM footprint is missing');
const points=item.geometry.slice(0,-1).map(p=>{const q=toLocal(p.lat,p.lon);return [q.x,q.z];});
let edge;for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length],length=Math.hypot(b[0]-a[0],b[1]-a[1]);if(!edge||length>edge.length)edge={length,dx:(b[0]-a[0])/length,dz:(b[1]-a[1])/length};}
const axis=[edge.dx,edge.dz],normal=[-edge.dz,edge.dx];
const projections=points.map(p=>[p[0]*axis[0]+p[1]*axis[1],p[0]*normal[0]+p[1]*normal[1]]);
const min=[0,1].map(i=>Math.min(...projections.map(p=>p[i]))),max=[0,1].map(i=>Math.max(...projections.map(p=>p[i]))),mid=min.map((v,i)=>(v+max[i])/2);
const result={id:'masp-lina',name:item.tags.name,osmWay:item.id,source:'https://www.openstreetmap.org/way/'+item.id,license:'ODbL-1.0',osmBase:data.osm3s.timestamp_osm_base,footprint:points,center:{x:axis[0]*mid[0]+normal[0]*mid[1],z:axis[1]*mid[0]+normal[1]*mid[1]},axis,normal,length:max[0]-min[0],depth:max[1]-min[1],height:Number(item.tags.height),clearance:Number(item.tags.min_height),references:[{url:'https://commons.wikimedia.org/wiki/File:MASP_Brazil.jpg',author:'Wilfredor',license:'CC0',usage:'visual reference, no image included in model'},{url:'https://www.saopaulo.sp.leg.br/iah/fulltext/projeto/PL0098-1992.pdf',usage:'architecture description, four supports and eight metre clearance'}],limitations:['Facade geometry is reconstructed, not scanned.','Glazing, concrete weathering and steel sections require architectural review.','The adjacent Pietro Maria Bardi building is not included.','Ground levels and access below the belvedere are not surveyed.']};
fs.writeFileSync('src/masp-source.json',JSON.stringify(result));console.log({length:result.length,depth:result.depth,height:result.height,clearance:result.clearance,center:result.center});

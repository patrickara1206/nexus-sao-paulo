import * as T from 'three';
import {batchStatic} from './scene-batching.js';

// Entry viewpoints are on exterior paving, oriented toward the real building.
// The models are reconstructions from the mapped footprint and listed references.
export const landmarkViews = {
 se:{target:[2217,-1163],camera:[2261,-1299],pitch:-.37},
 pateo:{target:[2373,-1481],camera:[2335,-1458],pitch:-.13},
 anhangabau:{target:[1875,-1670],camera:[1893,-1728],pitch:-.12},
 municipal:{target:[1737,-1755],camera:[1704,-1706],pitch:-.24},
 cha:{target:[1930,-1566],camera:[1866,-1619],pitch:-.11},
 farol:{target:[2223,-1725],camera:[2177,-1734],pitch:-.29},
 martinelli:{target:[2111,-1764],camera:[2106,-1795],pitch:-.24},
 bento:{target:[2214,-1952],camera:[2206,-1908],pitch:-.16},
 mercadao:{target:[2653,-2175],camera:[2620,-2167],pitch:-.14},
 republica:{target:[1318,-1905],camera:[1330,-1853],pitch:-.10},
 luz:{target:[2087,-2928],camera:[2070,-2971],pitch:-.19},
 pinacoteca:{target:[2235,-2995],camera:[2255,-2957],pitch:-.13},
 copan:{target:[1168,-1642],camera:[1180,-1597],pitch:-.29},
};

const surfaces = {
 granite:'#858889', graniteLight:'#a6a4a0', graniteShadow:'#626769',
 cathedralRoof:'#535c62', glass:'#242b32', wood:'#423b34', bronze:'#494844',
 ochre:'#bcaa8e', sandstone:'#dbc7a4', white:'#ded6c4', terracotta:'#805349',
 copper:'#586b62', concrete:'#c1b9a7',
};

function palette() {
 return Object.fromEntries(Object.entries(surfaces).map(([name,color])=>
  [name,new T.MeshStandardMaterial({color,roughness:name==='glass'?.48:.88})]));
}

function model(root,name,ground,x,z,frontX,frontZ){
 const group=new T.Group();
 group.position.set(x,ground(x,z)-.3,z);
 group.rotation.y=Math.atan2(frontX,frontZ);
 group.name=name;
 root.add(group);
 return group;
}

const cuboid=new T.BoxGeometry(1,1,1);
function put(group,geometry,material,x,y,z){
 const mesh=new T.Mesh(geometry,material);
 mesh.position.set(x,y,z);
 mesh.castShadow=true;
 mesh.receiveShadow=true;
 group.add(mesh);
 return mesh;
}

function box(group,x,y,z,width,height,depth,mat){
 const mesh=put(group,cuboid,mat,x,y+height/2,z);
 mesh.scale.set(width,height,depth);
 return mesh;
}

function cone(group,x,y,z,bottom,top,height,mat,sides=8){
 const mesh=put(group,new T.CylinderGeometry(top,bottom,height,sides),mat,x,y+height/2,z);
 mesh.rotation.y=Math.PI/sides;
 return mesh;
}

function solid(group,points,depth,material,x,y,z){
 const shape=new T.Shape(points.map(([px,py])=>new T.Vector2(px,py)));
 return put(group,new T.ExtrudeGeometry(shape,{depth,bevelEnabled:false}),material,x,y,z);
}

function gable(group,x,y,z,w,h,depth,mat) {
 solid(group,[[-w/2,0],[w/2,0],[0,h]],depth,mat,x,y,z);
}

function hippedRoof(group,x,y,z,width,rise,depth,material){
 const roof=new T.BufferGeometry();
 const left=-width/2,right=width/2,back=-depth/2,front=depth/2;
 const ridge=Math.max(0,front-width*.38);
 const corners=[[left,0,back],[right,0,back],[right,0,front],[left,0,front],[0,rise,-ridge],[0,rise,ridge]];
 roof.setAttribute('position',new T.Float32BufferAttribute(corners.flat(),3));
 roof.setAttribute('uv',new T.Float32BufferAttribute(corners.flatMap(([x,,z])=>[x/4,z/4]),2));
 roof.setIndex([0,4,1,1,4,5,1,5,2,2,5,3,3,5,4,3,4,0]);
 roof.computeVertexNormals();
 put(group,roof,material,x,y,z);
}

function arch(group,x,y,z,width,span,material,gothic=false){
 const shape=new T.Shape();
 const r=width/2;
 shape.moveTo(-r,0);shape.lineTo(r,0);
 if(gothic){
  shape.lineTo(r,span-r*1.4);
  shape.quadraticCurveTo(r,span-r*.3,0,span);
  shape.quadraticCurveTo(-r,span-r*.3,-r,span-r*1.4);
 }else{
  shape.lineTo(r,span-r);
  shape.absarc(0,span-r,r,0,Math.PI,false);
 }
 shape.closePath();
 return put(group,new T.ShapeGeometry(shape,10),material,x,y,z);
}

function framing(group,x,y,z,width,span,frame,fill,gothic=false){
 arch(group,x,y,z,width,span,frame,gothic);
 arch(group,x,y+.23,z+.042,width-.48,span-.52,fill,gothic);
}

function facadeMounted(group,x,z,rotation){
 const panel=new T.Group();
 panel.position.set(x,0,z);
 panel.rotation.y=rotation;
 group.add(panel);
 return panel;
}

function cathedral(root,ground,m){
 const church=model(root,'Catedral da Sé',ground,2201,-1124,.407,-.913);
 box(church,0,-1,0,41,3.2,101,m.graniteShadow);
 box(church,0,2,0,30,31,95,m.granite);
 box(church,0,2,-3,45,21,33,m.granite);
 box(church,0,2,-12,42,18,73,m.granite);
 cone(church,0,2,-44,15,15,24,m.granite,12);
 gable(church,0,33,-44,30,12,87,m.cathedralRoof);
 for(const x of [-1,1]){
  const wall=facadeMounted(church,x*21.05,-12,x*Math.PI/2);
  for(const z of [-32,-21,-10,1,12,23,34]){
   box(wall,z,1.6,1,2.5,18,1.8,m.graniteLight);
   cone(wall,z,19.6,1,.87,.39,3.8,m.graniteLight,4);
   framing(wall,z+5.3,7.2,.05,2.15,8.4,m.graniteLight,m.glass,true);
  }
 }
 cone(church,0,30,-6,13.3,13.3,14,m.granite,16);
 const cupola=new T.LatheGeometry([
  new T.Vector2(13.3,0),new T.Vector2(12.8,4),new T.Vector2(11.6,8.4),
  new T.Vector2(8.9,12.6),new T.Vector2(5.2,15.4),new T.Vector2(2.6,16.5),
 ],24);
 put(church,cupola,m.cathedralRoof,0,43,-6);
 cone(church,0,59.5,-6,2.5,2.25,3,m.graniteLight);
 cone(church,0,62.5,-6,2.35,.35,2.7,m.cathedralRoof);
 box(church,0,65,-6,.13,2.6,.14,m.bronze);
 box(church,0,66.5,-6,1.4,.12,.12,m.bronze);

 // The twin front towers and lancets sit beyond the nave, beside the rose window.
 for(const side of [-1,1]){
  const x=side*15.1,z=45.2;
  box(church,x,.8,z,11.9,53,13.5,m.granite);
  for(const y of [11.2,22.1,40,52.5])box(church,x,y,z,12.6,.65,14.2,m.graniteLight);
  cone(church,x,53.8,z,6.3,5.4,5.4,m.granite,8);
  cone(church,x,59.2,z,5,0.38,31.8,m.graniteShadow,8);
  box(church,x,90.4,z,.19,1.6,.16,m.bronze);
  for(const dx of [-1,1]){
   for(const dz of [-1,1]){
    box(church,x+dx*5.5,6,z+dz*6.1,1.6,53.5,1.65,m.graniteLight);
    cone(church,x+dx*5.5,59.5,z+dz*6.1,1.05,0.08,5,m.granite,4);
   }
  }
  for(const y of [13.8,28,42.3])framing(church,x,y,z+6.77,3.15,y>40?8.25:6.9,m.graniteLight,m.glass,true);
 }
 box(church,0,2,48.7,19.2,35,7.7,m.granite);
 gable(church,0,36.1,52.6,19.2,9.5,.88,m.graniteLight);
 framing(church,0,2.2,52.6,7.5,14,m.graniteLight,m.graniteShadow,true);
 framing(church,0,2.4,52.66,4.65,10,m.granite,m.wood,true);
 for(const x of [-6.65,6.65])framing(church,x,3,52.61,3.05,7.8,m.graniteLight,m.wood,true);
 const rose=put(church,new T.CircleGeometry(4.25,28),m.glass,0,24.45,52.59);
 rose.castShadow=false;
 const ring=put(church,new T.TorusGeometry(4.21,.31,6,30),m.graniteLight,0,24.45,52.73);
 ring.castShadow=false;
 for(let spoke=0;spoke<10;spoke++){
  const angle=spoke*Math.PI/5;
  const mullion=box(church,Math.sin(angle)*1.9,24.35+Math.cos(angle)*1.9,52.78,.19,3.8,.19,m.graniteLight);
  mullion.position.y-=1.9;mullion.rotation.z=-angle;
 }
 for(let i=0;i<7;i++)box(church,0,.05+i*.21,53.3-i*.48,43.5-i*.21,.24,4.4-i*.32,m.graniteShadow);
 batchStatic(church);
}

function theater(root,ground,m){
 const house=model(root,'Theatro Municipal de São Paulo',ground,1762,-1788,-.586,.81);
 box(house,0,-1,0,42,12,88,m.ochre);
 box(house,0,10.5,0,42.5,13.25,88,m.sandstone);
 box(house,0,23.1,-27,36,8.7,28,m.ochre);
 hippedRoof(house,0,23.6,-1,36,10,42,m.copper);
 cone(house,0,32,0,3.1,3.1,3.4,m.ochre);
 cone(house,0,35.4,0,3.4,.22,3.2,m.copper);
 box(house,0,38.4,0,.22,3,.2,m.bronze);
 for(const y of [2.9,9.9,12,20.35,23.3]){
  box(house,0,y,0,43.6,y===23.3?.89:.43,89,m.ochre);
 }
 box(house,0,1,44,30.4,22.4,2.1,m.sandstone);
 for(let i=0;i<7;i++)box(house,0,-.2+i*.29,47-i*.28,35.6,.31,6.1-i*.65,m.ochre);
 for(const x of [-11.1,-5.55,0,5.55,11.1]){
  framing(house,x,3,45.08,3.35,6.8,m.ochre,m.wood);
  framing(house,x,12.8,45.08,3.85,7.1,m.ochre,m.glass);
  box(house,x,12.5,45.5,4.25,.46,1.25,m.ochre);
  for(const offset of [-.85,0,.85])box(house,x+offset,12.92,46.02,.17,1.45,.21,m.ochre);
  put(house,new T.TorusGeometry(.53,.12,6,16),m.ochre,x,21.15,45.17);
 }
 for(const x of [-14,-8.4,-2.8,2.8,8.4,14]){
  cone(house,x,10.9,45.44,.56,.48,8.8,m.sandstone,12);
  box(house,x,19.6,45.44,1.4,.5,1.4,m.ochre);
  box(house,x,10.6,45.45,1.44,.46,1.52,m.ochre);
 }
 for(const side of [-1,1]){
  const wall=facadeMounted(house,side*21.27,0,side*Math.PI/2);
  for(const along of [-34,-26,-18,-10,-2,6,14,22,30,38]){
   framing(wall,along,3.2,.032,2.7,5.7,m.sandstone,m.wood);
   framing(wall,along,12.6,.036,2.85,7,m.ochre,m.glass);
   box(wall,along+3.8,10,.22,.64,10.5,.7,m.sandstone);
  }
  framing(house,side*18.2,3,44.05,4.2,8.25,m.ochre,m.wood);
  box(house,side*17.6,22.8,42.7,5.6,1.1,6.4,m.ochre);
  put(house,new T.TorusGeometry(1.14,.25,6,20),m.ochre,side*17.6,21.9,44.27);
 }
 for(let x=-20.5;x<=20.5;x+=1.25)box(house,x,23.95,44.05,.28,1.39,.38,m.sandstone);
 box(house,0,25.33,44.05,41.3,.4,.68,m.ochre);
 batchStatic(house);
}

function patio(root,ground,m){
 const college=model(root,'Pateo do Collegio',ground,2373,-1481,-.92,.39);
 box(college,-7,-2,0,42,13,35,m.white);
 hippedRoof(college,-7,11,0,43.6,5.1,36,m.terracotta);
 box(college,19,-1,-1.8,13.4,18.8,32,m.white);
 gable(college,19,17.75,-18,13.6,5.3,32.9,m.terracotta);
 box(college,27.6,-1,12.9,6.1,23.7,7.8,m.white);
 hippedRoof(college,27.6,22.7,12.9,6.9,3.7,9,m.terracotta);
 box(college,19,23.05,15,.15,2.2,.17,m.bronze);
 box(college,19,24.3,15,1.4,.16,.22,m.bronze);
 framing(college,19,0,14.26,3.4,6.3,m.ochre,m.wood);
 framing(college,19,8.85,14.26,1.58,2.8,m.ochre,m.glass);
 framing(college,27.6,18.6,16.83,2.25,3.48,m.ochre,m.glass);
 for(let x=-24;x<=9;x+=5.5){
  for(const y of [2.25,6.25]){
   box(college,x,y,17.56,1.71,2.35,.14,m.ochre);
   box(college,x,y+.24,17.66,1.27,1.87,.14,m.wood);
   box(college,x,y+1.05,17.78,1.25,.11,.13,m.ochre);
  }
 }
 box(college,-7,-.25,17.58,41.9,.76,1.2,m.ochre);
 batchStatic(college);
}

function facadeGrid(building,x,z,width,y,height,m,floors,windows,rotation){
 const panel=facadeMounted(building,x,z,rotation);
 for(let row=0;row<floors;row++){
  const heightAt=y+(row+.29)*height/floors;
  for(let col=0;col<windows;col++){
   const xAt=((col+.5)/windows-.5)*width;
   box(panel,xAt,heightAt,.04,width/windows*.40,height/floors*.55,.08,m.glass);
  }
 }
 batchStatic(panel);
}

function altino(root,ground,m){
 const building=model(root,'Edifício Altino Arantes — Farol Santander',ground,2223,-1728,-.734,-.678);
 for(const [bottom,top,w,d,floors,windows] of [
  [-1,20.8,31.8,22.5,5,7],[20.8,57.1,29.6,21.4,10,7],[57.1,91.9,23,19.5,9,6],
  [91.9,113.5,18.2,16.1,6,5],[113.5,130.7,14.1,12.2,4,4],[130.7,143.9,11.9,11,3,4],
 ]){
  box(building,0,bottom,0,w,top-bottom,d,m.white);
  box(building,0,top-.7,0,w+.63,.7,d+.63,m.concrete);
  facadeGrid(building,0,d/2,w,bottom,top-bottom,m,floors,windows,0);
  facadeGrid(building,0,-d/2,w,bottom,top-bottom,m,floors,windows,Math.PI);
  facadeGrid(building,w/2,0,d,bottom,top-bottom,m,floors,Math.max(3,windows-2),Math.PI/2);
  facadeGrid(building,-w/2,0,d,bottom,top-bottom,m,floors,Math.max(3,windows-2),-Math.PI/2);
 }
 box(building,0,143.9,0,7.7,5.5,7.7,m.concrete);
 box(building,0,149.4,0,.2,11.8,.2,m.bronze);
 const flag=box(building,-1.1,156.32,0,2.15,1.45,.035,new T.MeshStandardMaterial({color:'#317340',roughness:.94}));
 flag.castShadow=false;
 batchStatic(building);
}

function copan(root,ground,building,m){
 const points=building.rings[0].map(([x,z])=>new T.Vector2(x,-z));
 const top=ground(1167,-1639)+building.h;
 const podium=ground(1167,-1639)+7.2;
 const shape=new T.Shape(points);
 const depth=top-podium;
 const tower=put(root,new T.ExtrudeGeometry(shape,{depth,bevelEnabled:false}),m.glass,0,podium,0);
 tower.rotation.x=-Math.PI/2;tower.name='Edifício Copan — contorno em S';
 const base=put(root,new T.ExtrudeGeometry(shape,{depth:13,bevelEnabled:false}),m.concrete,0,podium-13,0);
 base.rotation.x=-Math.PI/2;
 const positions=[];
 for(let y=podium+2.8;y<top-.5;y+=2.88){
  for(let i=0;i<points.length;i++){
   const a=points[i],b=points[(i+1)%points.length];
   const edge=Math.hypot(a.x-b.x,a.y-b.y);
   if(edge<.05)continue;
   const nx=(b.y-a.y)/edge,nz=(b.x-a.x)/edge;
   // Thin double-sided slabs follow the curved footprint instead of replacing it.
   positions.push(a.x-nx*.4,y,-a.y-nz*.4,b.x-nx*.4,y,-b.y-nz*.4,b.x+nx*.5,y,-b.y+nz*.5,
    a.x-nx*.4,y,-a.y-nz*.4,b.x+nx*.5,y,-b.y+nz*.5,a.x+nx*.5,y,-a.y+nz*.5);
  }
 }
 const ribs=new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(positions,3));
 ribs.computeVertexNormals();
 const concrete=m.concrete.clone();concrete.side=T.DoubleSide;
 put(root,ribs,concrete,0,0,0).name='Edifício Copan — brises';
}

export function addHistoricLandmarks(root,ground,data){
 const m=palette();
 cathedral(root,ground,m);
 theater(root,ground,m);
 patio(root,ground,m);
 altino(root,ground,m);
 const copanBuilding=data.buildings.find(b=>b.id===8100248);
 if(copanBuilding)copan(root,ground,copanBuilding,m);
 return {suppressedBuildingIds:new Set([8093737,46927931,205784140,191607149,8100248])};
}

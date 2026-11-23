import * as T from 'three';

const CELL=72,MAX_PEOPLE=46;
const skinColors=['#7c513b','#ac7759','#cc9470','#80533f','#ba8769','#d0ab8e'];
const shirtColors=['#465d69','#c0ad8d','#704343','#475c4c','#b6b9ac','#53667c','#dbbb8c'];
const pantColors=['#3f4c56','#484344','#9b8d79','#344558'];
const cellKey=(x,z)=>Math.floor(x/CELL)+','+Math.floor(z/CELL);

function addToGrid(grid,item) {
 const key=cellKey(item.x,item.z);
 if(!grid.has(key))grid.set(key,[]);
 grid.get(key).push(item);
}
function nearby(grid,x,z,radius) {
 const result=[];
 for(let i=Math.floor((x-radius)/CELL);i<=Math.floor((x+radius)/CELL);i++){
  for(let j=Math.floor((z-radius)/CELL);j<=Math.floor((z+radius)/CELL);j++){
   for(const item of grid.get(i+','+j)??[]){
    if(Math.hypot(x-item.x,z-item.z)<radius)result.push(item);
   }
  }
 }
 return result;
}
function spatialIndex({links,features}) {
 const routes=new Map(),roads=new Map(),stops=new Map(),obstructions=new Map();
 let id=0;
 function addRoute(x,z,dx,dz,length,type){
  addToGrid(routes,{id:id++,x,z,dx,dz,length,type});
 }
 for(const feature of features){
  if(['bus-stop','metro-entrance'].includes(feature.kind))addToGrid(stops,feature);
  if(['tree','lamp','signal','bench','bin','hydrant','newsagent','barrier'].includes(feature.kind))addToGrid(obstructions,feature);
 }
 for(const road of links){
  if(road.tunnel||road.bridge||road.layer>0||road.layer<0||road.tags?.foot==='no')continue;
  const pedestrian=['footway','pedestrian','living_street','path'].includes(road.kind);
  const motor=['primary','secondary','tertiary','residential','unclassified'].includes(road.kind);
  if(!pedestrian&&!motor)continue;
  for(let i=1;i<road.points.length;i++){
   const [ax,az]=road.points[i-1],[bx,bz]=road.points[i];
   const distance=Math.hypot(bx-ax,bz-az);
   if(distance<.5)continue;
   const dx=(bx-ax)/distance,dz=(bz-az)/distance;
   const parts=Math.ceil(distance/24),step=distance/parts;
   for(let k=0;k<parts;k++){
    const x=ax+dx*step*(k+.5),z=az+dz*step*(k+.5);
    if(motor)addToGrid(roads,{x,z,dx,dz,width:road.width,length:step});
    if(step<5)continue;
    if(pedestrian&&road.tags?.footway!=='crossing')addRoute(x,z,dx,dz,step*.87,'walk');
    if(!motor)continue;
    for(const [side,sign] of [['left',-1],['right',1]]){
     const mapped=road.sidewalks?.[side];
     if(mapped?.mode!=='yes')continue;
     const offset=sign*(road.width/2+mapped.width/2);
     addRoute(x-dz*offset,z+dx*offset,dx,dz,step*.87,'walk');
    }
   }
  }
 }
 for(const feature of features){
  if(feature.kind!=='crossing')continue;
  let nearest=null,best=Infinity;
  for(const road of nearby(roads,feature.x,feature.z,32)){
   const along=T.MathUtils.clamp((feature.x-road.x)*road.dx+(feature.z-road.z)*road.dz,-road.length/2,road.length/2);
   const dist=Math.hypot(feature.x-road.x-road.dx*along,feature.z-road.z-road.dz*along);
   if(dist<best){best=dist;nearest=road;}
  }
  if(nearest&&best<3)addRoute(feature.x,feature.z,-nearest.dz,nearest.dx,nearest.width+2.8,'cross');
 }
 return {routes,stops,obstructions};
}

export function createHistoricCrowd(parent,region,traffic) {
 const {routes,stops,obstructions}=spatialIndex(region.geo);
 const group=new T.Group();
 group.name='Pedestres do Centro';
 parent.add(group);
 const material=new T.MeshStandardMaterial({roughness:.95,metalness:0});
 const oval=new T.SphereGeometry(.5,9,7);
 const hair=new T.SphereGeometry(.5,9,6,0,Math.PI*2,0,Math.PI*.61);
 const coat=new T.CylinderGeometry(.46,.49,1,9),leg=new T.CapsuleGeometry(.3,.4,3,6);
 const meshes=[oval,hair,coat,leg].map((geometry,index)=>{
  const count=[6,1,2,6][index]*MAX_PEOPLE;
  const mesh=new T.InstancedMesh(geometry,material,count);
  mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
  mesh.frustumCulled=false;mesh.castShadow=index!==1;mesh.receiveShadow=true;mesh.count=0;
  group.add(mesh);
  return mesh;
 });
 const pose=new T.Object3D(),color=new T.Color(),counts=[0,0,0,0];
 let people=[],lastX=Infinity,lastZ=Infinity,lastQuality,tick=0;
 const crossers=[];
 const limits={low:12,balanced:28,high:MAX_PEOPLE};
 function safeRoute(route){
  const reach=route.length/2;
  if(nearby(obstructions,route.x,route.z,reach+2).some(item=>{
   const ux=item.x-route.x,uz=item.z-route.z;
   return Math.abs(ux*route.dx+uz*route.dz)<reach+.45&&Math.abs(ux*route.dz-uz*route.dx)<.65;
  }))return false;
  for(let at=-reach;at<=reach+.001;at+=1.5){
   if(!region.canMove(route.x+route.dx*at,route.z+route.dz*at,.34))return false;
  }
  return region.canMove(route.x+route.dx*reach,route.z+route.dz*reach,.34);
 }
 function refresh(player,quality) {
  const byRoute=new Map(people.map(person=>[person.route.id,person]));
  const retained=[];
  const selected=nearby(routes,player.x,player.z,quality==='low'?55:78);
  selected.sort((a,b)=>Math.hypot(a.x-player.x,a.z-player.z)-Math.hypot(b.x-player.x,b.z-player.z));
  for(const route of selected){
   if(retained.length>=(limits[quality]??28))break;
   if(retained.some(person=>Math.hypot(person.route.x-route.x,person.route.z-route.z)<3.5))continue;
   if(!safeRoute(route))continue;
   const existing=byRoute.get(route.id);
   if(existing){retained.push(existing);continue;}
   const direction=route.id%2?1:-1;
   // Crossing actors begin on the curb. Signal permission is checked before entering.
   const progress=route.type==='cross'?(direction>0?0:1):((route.id*73)%101)/101;
   const waiting=route.type==='walk'&&nearby(stops,route.x,route.z,9).length>0;
   retained.push({route,direction,progress,waiting,wait:waiting?5+(route.id%8):.1,phase:route.id,entered:false});
  }
  people=retained;lastX=player.x;lastZ=player.z;lastQuality=quality;
 }
 function part(groupIndex,person,x,y,z,w,h,d,angle,tint) {
  const c=Math.cos(person.yaw),s=Math.sin(person.yaw),scale=person.scale;
  pose.position.set(person.x+(x*c+z*s)*scale,person.y+y*scale,person.z+(z*c-x*s)*scale);
  pose.rotation.set(angle,person.yaw,0,'YXZ');
  pose.scale.set(w*scale,h*scale,d*scale);
  pose.updateMatrix();
  const i=counts[groupIndex]++;
  meshes[groupIndex].setMatrixAt(i,pose.matrix);
  meshes[groupIndex].setColorAt(i,color.set(tint));
 }
 function draw(person) {
  const id=person.route.id,skin=skinColors[id%skinColors.length];
  const shirt=shirtColors[id%shirtColors.length],pants=pantColors[id%pantColors.length];
  const gait=Math.sin(person.phase)*(person.moving?1:0);
  part(0,person,0,1.59,0,.175,.235,.188,0,skin);
  part(1,person,0,1.63,-.012,.19,.19,.205,0,id%3?'#332a26':'#514037');
  part(2,person,0,1.19,0,.37,.51,.26,0,shirt);
  part(2,person,0,.9,0,.33,.17,.235,0,pants);
  for(const side of [-1,1]){
   const swing=.48*gait*side;
   part(3,person,.098*side,.62,swing*.16,.20,.55,.22,-swing,pants);
   part(3,person,.10*side,.25,swing*.39,.146,.42,.17,-swing*.38,pants);
   part(0,person,.10*side,.073,.047+swing*.46,.124,.114,.24,0,'#302e2c');
   part(3,person,.215*side,1.12,-swing*.16,.145,.42,.16,swing,shirt);
   part(0,person,.217*side,.87,-swing*.3+.036,.095,.23,.096,swing*.26,skin);
  }
 }
 function update(dt,{player,quality}) {
  if(lastQuality!==quality||Math.hypot(player.x-lastX,player.z-lastZ)>15)refresh(player,quality);
  tick+=dt;
  if(tick<1/30&&dt>0&&people.length&&meshes[0].count)return;
  const elapsed=tick;tick=0;crossers.length=0;counts.fill(0);
  for(const person of people){
   const {route}=person;
   person.wait=Math.max(0,person.wait-elapsed);
   const canEnter=route.type!=='cross'||person.entered||traffic.canCross(route.x,route.z);
   person.moving=!person.wait&&canEnter;
   if(person.moving){
    if(route.type==='cross')person.entered=true;
    const stride=elapsed*(1.05+route.id%5*.13);
    person.phase+=stride*4.5;
    person.progress+=person.direction*stride/route.length;
    if(person.progress>=1||person.progress<=0){
     person.progress=T.MathUtils.clamp(person.progress,0,1);
     person.direction*=-1;person.entered=false;person.wait=person.waiting?7:1.5;
    }
   }
   const along=(person.progress-.5)*route.length;
   person.x=route.x+route.dx*along;person.z=route.z+route.dz*along;
   person.y=region.groundHeight(person.x,person.z);
   person.yaw=Math.atan2(route.dx*person.direction,route.dz*person.direction);
   person.scale=.95+(route.id%11)/100;
   if(person.entered)crossers.push(person);
   draw(person);
  }
  meshes.forEach((mesh,i)=>{
   mesh.count=counts[i];mesh.instanceMatrix.needsUpdate=true;
   if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
  });
 }
 return {root:group,update,crossers,get count(){return people.length;},dispose(){
  group.removeFromParent();
  meshes.forEach(mesh=>{mesh.dispose();mesh.geometry.dispose();});material.dispose();
 }};
}

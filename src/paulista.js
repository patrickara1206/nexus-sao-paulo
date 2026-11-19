import * as T from 'three';
import {batchStatic} from './scene-batching.js';
import {createNeighbors} from './neighbors.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {pbrMaterial} from './lab.js';
import {roadRecords,project,inTrianon,trianonPolygons,trianonEntrance,segmentDistance} from './geography.js';
import masp from './masp-source.json' with {type:'json'};
import landscape from './paulista-landscape.json' with {type:'json'};

export const paulistaSource=masp;
export const paulistaSpawn={x:masp.center.x-masp.normal[0]*49,z:masp.center.z-masp.normal[1]*49,y:12};
export const paulistaHeading=Math.atan2(-masp.normal[0],-masp.normal[1]);
export function createPaulista(scene){
 const root=new T.Group(),colliders=[];root.name='MASP and Trianon reconstruction';scene.add(root);
 const base=12,loader=new T.TextureLoader(),boxGeo=new T.BoxGeometry(1,1,1),concrete=pbrMaterial('concrete_pavement',5),paving=pbrMaterial('concrete_pavement',20),asphalt=pbrMaterial('asphalt_02',1),metal=new T.MeshStandardMaterial({color:'#36454b',metalness:.65,roughness:.35}),red=new T.MeshStandardMaterial({color:'#a81f16',roughness:.83,metalness:0}),white=new T.MeshStandardMaterial({color:'#d7d6be',roughness:.9});
 concrete.color.set('#9b9a92');paving.color.set('#aead9e');
 function cube(parent,x,y,z,w,h,d,material){const mesh=new T.Mesh(boxGeo,material);mesh.position.set(x,y+h/2,z);mesh.scale.set(w,h,d);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;}
 function surface(points,y,material){const shape=new T.Shape(points.map(p=>new T.Vector2(p[0],-p[1]))),g=new T.ShapeGeometry(shape);g.rotateX(-Math.PI/2);const a=g.attributes.position,uv=g.attributes.uv;for(let i=0;i<a.count;i++)uv.setXY(i,a.getX(i)/4,a.getZ(i)/4);const m=new T.Mesh(g,material);m.position.y=y;m.receiveShadow=true;root.add(m);return m;}
 const ground=new T.Mesh(new T.PlaneGeometry(1600,1600),new T.MeshStandardMaterial({color:'#777c70',roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.set(-100,base-.07,150);ground.receiveShadow=true;root.add(ground);
 function ribbon(points,width,y,material){const vertices=[],uvs=[],indices=[];let total=0;for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],len=Math.hypot(b[0]-a[0],b[1]-a[1]);if(len<.01)continue;const nx=-(b[1]-a[1])/len,nz=(b[0]-a[0])/len,k=vertices.length/3;for(const [p,t]of [[a,total],[b,total+len]])for(const sign of [-1,1]){vertices.push(p[0]+nx*width/2*sign,y,p[1]+nz*width/2*sign);uvs.push(sign*width/8,t/4);}indices.push(k,k+1,k+2,k+1,k+3,k+2);total+=len;}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));g.setIndex(indices);g.computeVertexNormals();const mesh=new T.Mesh(g,material);mesh.receiveShadow=true;root.add(mesh);return mesh;}
 const localRoads=roadRecords.filter(r=>!r.tunnel&&r.layer>=0&&r.points.some(p=>Math.hypot(p[0],p[1])<550));
 for(const r of localRoads){const avenue=r.name==='Avenida Paulista',width=avenue?13:r.kind==='primary'?14:8;ribbon(r.points,width+5,base+.02,paving);ribbon(r.points,width,base+.055,asphalt);if(avenue){for(let i=1;i<r.points.length;i++){const a=r.points[i-1],b=r.points[i],len=Math.hypot(b[0]-a[0],b[1]-a[1]);if(len<3)continue;for(let t=0;t<len;t+=12){const u=t/len,v=Math.min(1,(t+4)/len);ribbon([[a[0]+(b[0]-a[0])*u,a[1]+(b[1]-a[1])*u],[a[0]+(b[0]-a[0])*v,a[1]+(b[1]-a[1])*v]],.16,base+.07,white);}}}}
 const soil=new T.MeshStandardMaterial({color:'#4f5c3e',roughness:1});for(const polygon of trianonPolygons)surface(polygon,base+.1,soil);
 const paths=landscape.paths.map(r=>({...r,points:r.points.map(([lon,lat])=>{const p=project(lat,lon);return [p.x,p.z];})}));
 const pathMaterial=pbrMaterial('concrete_pavement',1);for(const path of paths){if(path.points.some(p=>inTrianon(...p)))ribbon(path.points,path.kind==='steps'?2:2.4,base+.13,pathMaterial);}
 const building=new T.Group();building.position.set(masp.center.x,base,masp.center.z);building.rotation.y=-Math.atan2(masp.axis[1],masp.axis[0]);root.add(building);const L=masp.length,D=masp.depth,bottom=masp.clearance,top=masp.height;
 cube(building,0,-.08,0,L+16,.16,D+28,paving);
 const slab=new T.MeshStandardMaterial({color:'#777972',roughness:.96});cube(building,0,bottom,0,L-5,.8,D-3,slab);cube(building,0,top-2,0,L-5,1.8,D-3,concrete);
 // Four concrete supports and two transverse girders, based on the real structural layout.
 const supportWidth=2.3;for(const x of [-L/2+1.3,L/2-1.3]){for(const z of [-D/2+2.5,D/2-2.5]){cube(building,x,0,z,supportWidth,top+2.4,2.3,red);const corners=[[-supportWidth/2,-1.15],[supportWidth/2,-1.15],[supportWidth/2,1.15],[-supportWidth/2,1.15]].map(([dx,dz])=>{const u=x+dx,v=z+dz;return [masp.center.x+masp.axis[0]*u+masp.normal[0]*v,masp.center.z+masp.axis[1]*u+masp.normal[1]*v];});colliders.push({x:corners.reduce((s,p)=>s+p[0],0)/4,z:corners.reduce((s,p)=>s+p[1],0)/4,w:5,d:5,points:corners});}cube(building,x,top+.3,0,2.3,2.2,D+2,red);}
 const glazing=new T.MeshPhysicalMaterial({color:'#78959d',metalness:.15,roughness:.17,transparent:true,opacity:.76,side:T.DoubleSide});const inner=new T.MeshStandardMaterial({color:'#c3bdae',roughness:.9});cube(building,0,bottom+.8,0,L-7,.25,D-5,inner);cube(building,0,bottom+7.3,0,L-7,.25,D-5,inner);
 for(const z of [-D/2+1.8,D/2-1.8]){cube(building,0,bottom+.85,z,L-5,top-bottom-2.8,.08,glazing);for(let x=-L/2+3;x<L/2-2;x+=1.32)cube(building,x,bottom+.85,z+.05,.065,top-bottom-2.8,.14,metal);for(const y of [bottom+1,bottom+7.55,top-2.1])cube(building,0,y,z+.08,L-5,.075,.15,metal);}
 for(const x of [-L/2+2.8,L/2-2.8]){cube(building,x,bottom+.85,0,.08,top-bottom-2.8,D-3.6,glazing);for(let z=-D/2+2;z<D/2-1;z+=1.3)cube(building,x+.05,bottom+.85,z,.14,top-bottom-2.8,.06,metal);}
 // Steel guard rail and weathered concrete: details remain subject to visual review.
 for(const z of [-D/2+3,D/2-3]){cube(building,0,top+.1,z,L-7,.05,.06,metal);for(let x=-L/2+4;x<L/2-3;x+=2.5)cube(building,x,top-1,z,.045,1.15,.045,metal);}
 batchStatic(building);const neighbors=createNeighbors(root,colliders);
 const bounds={minX:-580,maxX:440,minZ:-430,maxZ:530};
 const treeLocations=landscape.trees.map(t=>({...project(t.lat,t.lon),mapped:true})).filter(p=>p.x>bounds.minX&&p.x<bounds.maxX&&p.z>bounds.minZ&&p.z<bounds.maxZ);
 // Understory is indicative; mapped mature tree anchors are kept separate from infill.
 let seed=229;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};for(let i=0;i<1500;i++){const x=-350+random()*460,z=-80+random()*480;if(!inTrianon(x,z)||paths.some(p=>p.points.slice(1).some((b,i)=>segmentDistance(x,z,p.points[i],b)<4)))continue;treeLocations.push({x,z,mapped:false});}
 const props=new T.Group();root.add(props);let loaded=0;const assets=new GLTFLoader();
 const ready=assets.loadAsync('/assets/props/tree_road.glb').then(g=>{const box=new T.Box3().setFromObject(g.scene),height=box.max.y-box.min.y;const geometries=[];g.scene.updateMatrixWorld(true);g.scene.traverse(o=>{if(o.isMesh)geometries.push({geometry:o.geometry.clone().applyMatrix4(o.matrixWorld),material:o.material});});for(const part of geometries){const mesh=new T.InstancedMesh(part.geometry,part.material,treeLocations.length),dummy=new T.Object3D();treeLocations.forEach((p,i)=>{const scale=(p.mapped?9:6)+(i%7);dummy.position.set(p.x,base-box.min.y*scale/height,p.z);dummy.rotation.y=i*2.4;dummy.scale.setScalar(scale/height);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);});mesh.castShadow=true;mesh.receiveShadow=true;props.add(mesh);}loaded=treeLocations.length;}).catch(e=>console.warn('Vegetation could not be loaded',e));
 const perimeter=[];for(const polygon of trianonPolygons){const points=polygon.slice();if(points.length&&Math.hypot(points[0][0]-points.at(-1)[0],points[0][1]-points.at(-1)[1])>.1)points.push(points[0]);perimeter.push(points);}
 const fenceMaterial=new T.MeshStandardMaterial({color:'#3f4842',metalness:.65,roughness:.6});for(const polygon of perimeter)for(let i=1;i<polygon.length;i++){const a=polygon[i-1],b=polygon[i],len=Math.hypot(b[0]-a[0],b[1]-a[1]);for(let d=0;d<len;d+=2.2){const t=d/len,x=a[0]+(b[0]-a[0])*t,z=a[1]+(b[1]-a[1])*t;if(Math.hypot(x-trianonEntrance.x,z-trianonEntrance.z)<5)continue;cube(root,x,base,z,.05,1.8,.05,fenceMaterial);}}
 batchStatic(root);return {root,colliders,bounds,ready,get treeCount(){return loaded;},get source(){return masp;},groundHeight(){return base;}};
}

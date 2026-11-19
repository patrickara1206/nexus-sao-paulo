import * as T from 'three';
import {batchStatic} from './scene-batching.js';
import data from './neighbors-source.json' with {type:'json'};
export function createNeighbors(parent,colliders){
 const root=new T.Group();root.name='Reference-specific neighboring buildings';parent.add(root);
 const stone=new T.MeshStandardMaterial({color:'#bfc1b8',roughness:.73,metalness:.05}),glass=new T.MeshStandardMaterial({color:'#537e91',roughness:.2,metalness:.55}),joint=new T.MeshStandardMaterial({color:'#555d5f',roughness:.7}),concrete=new T.MeshStandardMaterial({color:'#92988f',roughness:.9});const geo=new T.BoxGeometry(1,1,1);
 function box(parent,x,y,z,w,h,d,mat){const m=new T.Mesh(geo,mat);m.position.set(x,y+h/2,z);m.scale.set(w,h,d);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
 for(const b of data.buildings){const g=new T.Group();g.position.set(b.center.x,12,b.center.z);g.rotation.y=-Math.atan2(b.axis[1],b.axis[0]);root.add(g);const L=b.length,D=b.depth,H=b.height;box(g,0,0,0,L,H,D,glass);box(g,0,H-.8,0,L+1,.8,D+1,concrete);
  // Continuous pale piers, recessed blue glazing and exposed upper fins visible in the source photograph.
  for(const side of [-1,1]){const z=side*(D/2+.07);for(let x=-L/2+.5;x<L/2;x+=2.55){box(g,x,0,z,.83,H-10,.22,stone);box(g,x,H-10,z,.4,12,.55,concrete);for(let y=.8;y<H-10;y+=.9)box(g,x,y,z+side*.13,.82,.018,.025,joint);}for(let y=3;y<H;y+=3.6)box(g,0,y,z+.03,L,.09,.12,joint);box(g,0,H-10,z,L,.5,.5,stone);}
  for(const x of [-L/2-.07,L/2+.07]){box(g,x,0,0,.2,H,D,stone);for(let z=-D/2+1;z<D/2-1;z+=2.6){box(g,x+Math.sign(x)*.12,0,z,.04,H-10,1.1,glass);for(let y=3;y<H-10;y+=3.6)box(g,x+Math.sign(x)*.15,y,z,.04,.09,1.1,joint);}}
  batchStatic(g);
  colliders.push({x:b.center.x,z:b.center.z,w:L,d:D,points:b.footprint});
 }
 return {root,source:data};
}

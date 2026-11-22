import * as T from 'three';

// The imperial palms are documented at Praça da Sé. These are approximate
// plantings along the plaza axis, not a surveyed inventory.
export const sePalmLocations = [
 [2221,-1215,15.4], [2231,-1236,17.7], [2241,-1257,16.3], [2251,-1279,18.1], [2262,-1302,16.8],
 [2249,-1214,17.8], [2259,-1236,16.7], [2269,-1257,18.4], [2279,-1279,16.1], [2289,-1302,17.4],
];

function fronds() {
 const positions=[],colors=[];
 const dark=new T.Color('#335d27'),light=new T.Color('#789945');
 function triangle(a,b,c,green){
  positions.push(...a,...b,...c);
  const shade=dark.clone().lerp(light,green);
  for(let i=0;i<3;i++)colors.push(shade.r,shade.g,shade.b);
 }
 for(let branch=0;branch<15;branch++){
  const angle=branch*2.399963, ring=Math.floor(branch/5);
  const direction=[Math.cos(angle),Math.sin(angle)];
  const length=3.1+ring*.55+(branch%3)*.15;
  function rib(t){
   const radius=length*t;
   const y=1.78*Math.sin(t*Math.PI*.83)-(ring*.36+.65)*t*t;
   return [direction[0]*radius,y,direction[1]*radius];
  }
  for(let index=1;index<=21;index++){
   const t=index/23,base=rib(t),along=rib(t+.044);
   const width=(.16+Math.sin(t*Math.PI)*.56)*(1-t*.39);
   for(const sign of [-1,1]){
    const edge=[base[0]-direction[1]*sign*width+direction[0]*.23,base[1]-.21-t*.35,base[2]+direction[0]*sign*width+direction[1]*.23];
    const fold=[(base[0]+edge[0])*.5,(base[1]+edge[1])*.5+.055,(base[2]+edge[2])*.5];
    triangle(base,along,fold,.29+t*.57);
    triangle(along,edge,fold,.24+t*.52);
   }
  }
 }
 const geometry=new T.BufferGeometry();
 geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
 geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));
 geometry.computeVertexNormals();
 return geometry;
}

export function createSePalms(groundAt) {
 const root=new T.Group();
 root.name='Praça da Sé · palmeiras imperiais';
 const trunkGeometry=new T.LatheGeometry([
  new T.Vector2(.52,0),new T.Vector2(.46,.045),new T.Vector2(.39,.1),
  new T.Vector2(.32,.34),new T.Vector2(.31,.67),new T.Vector2(.33,.89),
  new T.Vector2(.4,.91),new T.Vector2(.36,.98),new T.Vector2(.29,1),
 ],10);
 const trunks=new T.InstancedMesh(trunkGeometry,new T.MeshStandardMaterial({color:'#8d8977',roughness:.99}),sePalmLocations.length);
 const crowns=new T.InstancedMesh(fronds(),new T.MeshStandardMaterial({vertexColors:true,side:T.DoubleSide,roughness:.82}),sePalmLocations.length);
 const pose=new T.Object3D();
 for(const [i,[x,z,height]] of sePalmLocations.entries()){
  const y=groundAt(x,z)-.1;
  pose.position.set(x,y,z);
  pose.rotation.y=i*2.17;
  pose.scale.set(1,height,1);
  pose.updateMatrix();
  trunks.setMatrixAt(i,pose.matrix);
  pose.position.y+=height;
  pose.scale.setScalar(.89+i%4*.07);
  pose.updateMatrix();
  crowns.setMatrixAt(i,pose.matrix);
 }
 for(const mesh of [trunks,crowns]){
  mesh.computeBoundingSphere();
  mesh.receiveShadow=true;
  mesh.castShadow=true;
  root.add(mesh);
 }
 return root;
}

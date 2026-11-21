import * as T from 'three';

function hairGeometry(style) {
 const rows=18, columns=72;
 const positions=[],colors=[],indices=[];
 const long=style==='longo',curly=style==='cacheado';
 for(let row=0;row<=rows;row++){
  const fraction=row/rows;
  for(let column=0;column<=columns;column++){
   const angle=column/columns*2*Math.PI;
   const front=Math.cos(angle);
   const side=Math.sin(angle);
   const hairline=1.67-.40*front+.030*Math.sin(angle+1);
   const polar=.001+fraction*(hairline-.001);
   const lock=Math.sin(column*1.4+fraction*4.5)*.003;
   const curl=Math.cos(angle*13+fraction*9)*Math.sin(fraction*13)*.009;
   const shell=.101+lock+(curly?curl+.011:0);
   const rear=long?Math.pow(Math.max(0,-front),.6)*Math.pow(fraction,3):0;
   positions.push(
    side*Math.sin(polar)*shell*(1+rear*.27),
    1.667+Math.cos(polar)*(.132+(curly?.012:0))-rear*.181+lock*Math.sin(polar),
    -.049-front*Math.sin(polar)*((front>0?.137:.117)+lock+(curly?curl+.009:0))+rear*.029,
   );
   const strand=.8+.16*Math.cos(fraction*4-angle*1.8)+.11*Math.cos(column*2.13);
   colors.push(strand,strand*.96,strand*.93);
   if(row<rows&&column<columns){
    const i=row*(columns+1)+column;
    indices.push(i,i+1,i+columns+1,i+1,i+columns+2,i+columns+1);
   }
  }
 }
 const geometry=new T.BufferGeometry();
 geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
 geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));
 geometry.setIndex(indices);
 geometry.computeVertexNormals();
 return geometry;
}

const hairstyles=new Map();
export function createAvatarHair(){
 const material=new T.MeshStandardMaterial({vertexColors:true,roughness:.76,side:T.DoubleSide});
 const root=new T.Mesh(undefined,material);
 root.name='Hair';
 root.castShadow=true;
 return {
  root,
  apply(style,color,body){
   root.visible=style!=='raspado';
   if(!root.visible)return;
   if(!hairstyles.has(style))hairstyles.set(style,hairGeometry(style));
   root.geometry=hairstyles.get(style);
   root.scale.x=1-.023*body;
   root.position.z=-.004*body;
   material.color.set(color);
  },
  dispose(){material.dispose();},
 };
}

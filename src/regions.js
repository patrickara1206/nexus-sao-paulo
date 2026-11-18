// Preview coordinates are approximate anchors, not surveyed recreation extents.
export const previewRegions=[
 {id:'core',name:'Paulista · Centro · Ibirapuera',x:0,z:-65,kind:'core',description:'Área inicial · ruas e contornos reais do OpenStreetMap'},
 {id:'caetano',name:'São Caetano do Sul',lat:-23.6283,lon:-46.5677,kind:'civic',description:'Prévia de conceito · parque e arquitetura cívica'},
 {id:'bernardo',name:'São Bernardo do Campo',lat:-23.6937,lon:-46.5650,kind:'civic2',description:'Prévia de conceito · entorno inspirado no Paço Municipal'},
 {id:'santos',name:'Santos · Orla',lat:-23.9730,lon:-46.3310,kind:'coast',description:'Prévia de conceito · praia, jardins e avenida da orla'},
 {id:'vila',name:'Vila Belmiro',lat:-23.9511,lon:-46.3389,kind:'stadium',description:'Prévia de conceito · estádio inspirado na Vila Belmiro'}
].map(p=>p.id==='core'?p:{...p,x:(p.lon+46.6559)*101970,z:-(p.lat+23.5614)*111320});

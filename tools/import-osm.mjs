import fs from 'node:fs';
const input=process.argv[2];if(!input)throw new Error('Use: node tools/import-osm.mjs path/to/overpass.json');
const raw=JSON.parse(fs.readFileSync(input,'utf8'));const project=p=>[Math.round((p.lon+46.6559)*101970*10)/10,Math.round(-(p.lat+23.5614)*111320*10)/10];
const roads=raw.elements.filter(e=>e.type==='way'&&e.geometry?.length>1).map(e=>({id:e.id,name:e.tags?.name||'',kind:e.tags?.highway,oneway:e.tags?.oneway==='yes',bridge:e.tags?.bridge==='yes',points:e.geometry.map(project)}));
fs.writeFileSync('src/streets.json',JSON.stringify({source:'© OpenStreetMap contributors',license:'ODbL-1.0',url:'https://www.openstreetmap.org/copyright',bbox:[-23.598,-46.674,-23.530,-46.620],osmBase:raw.osm3s?.timestamp_osm_base,roads}));console.log(`${roads.length} street segments imported`);

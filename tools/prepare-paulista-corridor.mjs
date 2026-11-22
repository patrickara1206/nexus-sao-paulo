import {readFileSync, writeFileSync} from 'node:fs';
import {toLocal} from '../src/geodesy.js';
import {distanceToPaulista} from '../src/paulista-corridor.js';

const [buildingsPath, bardiPath, cyclewaysPath] = process.argv.slice(2);
if (!buildingsPath || !bardiPath) {
 throw new Error('Use: node tools/prepare-paulista-corridor.mjs <Overpass buildings JSON> <OSM XML near MASP> [Overpass cycleways JSON]');
}
const raw = JSON.parse(readFileSync(buildingsPath, 'utf8'));
const byId = new Map(raw.elements.map(element => [element.id, element]));
const map = readFileSync(bardiPath, 'utf8');
const nodes = new Map([...map.matchAll(/<node id="(\d+)"[^>]*lat="([-\d.]+)" lon="([-\d.]+)"/g)]
 .map(([, id, lat, lon]) => [id, {lat: Number(lat), lon: Number(lon)}]));

function roundedPoint({lat, lon}) {
 const {x, z} = toLocal(lat, lon);
 return [Math.round(x * 10) / 10, Math.round(z * 10) / 10];
}
function footprint(geometry) {
 const ring = geometry.map(roundedPoint).filter((point, index, points) =>
  !index || point[0] !== points[index - 1][0] || point[1] !== points[index - 1][1]);
 if (ring[0][0] === ring.at(-1)[0] && ring[0][1] === ring.at(-1)[1]) ring.pop();
 return ring;
}
function fromOsmWay(id) {
 const way = map.match(new RegExp('<way id="' + id + '"[^>]*>([\\s\\S]*?)</way>'))?.[1];
 if (!way) throw new Error('Way not found in OSM extract: ' + id);
 return [...way.matchAll(/<nd ref="(\d+)"/g)].map(([, id]) => nodes.get(id));
}
function metres(value) {
 const normalized = value?.trim().replace(',', '.');
 if (!/^\d+(\.\d+)?(\s*m)?$/.test(normalized ?? '')) return NaN;
 return Number.parseFloat(normalized);
}
function bounds(points) {
 return [Math.min(...points.map(p => p[0])), Math.min(...points.map(p => p[1])),
  Math.max(...points.map(p => p[0])), Math.max(...points.map(p => p[1]))];
}
const landmarks = [
 {id: 'casa', name: 'Casa das Rosas', osm: 301601819, source: 'https://casadasrosas.org.br/museu/sobre/'},
 {id: 'japan', name: 'Japan House São Paulo', osm: 183853727, source: 'https://japanhousesp.com.br/novidade/madeira-washi-e-concreto-a-receita-do-arquiteto-kengo-kuma-para-a-japan-house-sao-paulo/'},
 {id: 'ims', name: 'IMS Paulista', osm: 315938639, source: 'https://ims.com.br/acessibilidade/informacoes-ims-paulista/'},
 {id: 'masp-bardi', name: 'MASP · Edifício Pietro Maria Bardi', osm: 1370081490, relation: 18874084, source: 'https://metroarquitetos.com.br/projeto/masp-em-expansao-edificio-pietro-maria-bardi/', height: 70},
].map(item => {
 const element = byId.get(item.osm);
 return {...item,
  height: item.height ?? metres(element.tags.height),
  points: footprint(item.relation ? fromOsmWay(item.osm) : element.geometry)};
});

const detailed = new Set([1370081491, 363639776, ...landmarks.map(place => place.osm)]);
const volumes = [];
for (const {id, type, geometry, tags} of raw.elements) {
 if (type !== 'way' || !geometry || geometry.length < 4 || !tags?.building ||
  ['no', 'construction', 'roof'].includes(tags.building) || Number(tags.layer) < 0 || detailed.has(id)) continue;
 const height = metres(tags.height);
 if (height < 1.5 || height > 180 || !Number.isFinite(height)) continue;
 if (!geometry.some(({lat, lon}) => lat > -23.574 && lat < -23.553 && lon > -46.646 - .020 && lon < -46.641)) continue;
 const points = footprint(geometry);
 const [left, bottom, right, top] = bounds(points);
 const x = (left + right) / 2, z = (bottom + top) / 2;
 if (distanceToPaulista(x, z) > 193 &&
  !points.some(([x, z]) => distanceToPaulista(x, z) < 193)) continue;
 if (points.length < 3 || right - left < 1 || top - bottom < 1) continue;
 const minHeight = metres(tags.min_height) || 0;
 if (minHeight >= height) continue;
 const color = /^#[\da-f]{6}$/i.test(tags['building:colour']) ? tags['building:colour'] : undefined;
 volumes.push({id, h: Math.round(height * 100) / 100, ...(minHeight ? {min: minHeight} : {}), ...(color ? {color} : {}), p: points});
}

let cycleways = [];
if (cyclewaysPath) {
 const raw = JSON.parse(readFileSync(cyclewaysPath, 'utf8'));
 cycleways = raw.elements.filter(element => element.geometry?.length > 1).map(element => ({
  id: element.id, p: element.geometry.map(roundedPoint),
 })).filter(({p}) => p.filter(([x, z]) => distanceToPaulista(x, z) < 24).length >= p.length * .6);
}

writeFileSync('src/paulista-corridor-data.json', JSON.stringify({
 source: '© OpenStreetMap contributors',
 license: 'ODbL-1.0',
 osmBase: raw.osm3s?.timestamp_osm_base,
 landmarks,
 cycleways,
 volumes,
}) + '\n');
console.log({volumes: volumes.length, landmarks: landmarks.length, cycleways: cycleways.length});

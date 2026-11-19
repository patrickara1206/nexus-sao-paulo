"""Extract transport references from an OSM XML export; no inferred coordinates."""
import json, sys, xml.etree.ElementTree as ET
from pathlib import Path

root = ET.parse(sys.argv[1] if len(sys.argv)>1 else '../../work/trianon-map.osm').getroot()
nodes = {n.attrib['id']: n for n in root.findall('node')}
def tags(e): return {t.attrib['k']:t.attrib['v'] for t in e.findall('tag')}
def point(n): return [float(n.attrib['lon']),float(n.attrib['lat'])]
def nearby(p): return abs(p[0]+46.6559)<.012 and abs(p[1]+23.5614)<.012
ways=[]
for w in root.findall('way'):
    t=tags(w)
    if not (t.get('railway')=='subway' or (t.get('tunnel')=='yes' and t.get('highway')=='primary')): continue
    p=[point(nodes[r.attrib['ref']]) for r in w.findall('nd') if r.attrib['ref'] in nodes]
    if not any(nearby(q) for q in p): continue
    ways.append(dict(id=int(w.attrib['id']),tags=t,points=p))
entrances=[]
stops=[]
for n in nodes.values():
    t=tags(n); p=point(n)
    if abs(p[0]+46.6542)>.0016 or abs(p[1]+23.5633)>.0016: continue
    if t.get('railway')=='subway_entrance': entrances.append(dict(id=int(n.attrib['id']),lon=p[0],lat=p[1]))
    if t.get('name')=='Trianon-Masp' and t.get('railway')=='stop': stops.append(dict(id=int(n.attrib['id']),lon=p[0],lat=p[1]))
result=dict(source='https://www.openstreetmap.org/copyright',license='ODbL-1.0',ways=ways,entrances=entrances,stops=stops,references=[
 'https://www.metro.sp.gov.br/pt_BR/sua-viagem/linhas-estacoes/linha-2-verde/estacao-trianon-masp/',
 'https://www.metro.sp.gov.br/wp-content/uploads/2024/06/Estacao-Trianon-Masp.pdf'],
 limitations=['OSM layer is an ordering index, not a depth measurement.','Station dimensions, tunnel section and vertical levels are approximate.','Train is a simplified original reconstruction, not a licensed fleet scan.','Underground access uses scene transitions; continuous stairs and portal ramps are not reconstructed.'])
Path('src/transport-source.json').write_text(json.dumps(result,ensure_ascii=False),encoding='utf-8')
print(dict(ways=len(ways),entrances=len(entrances),stops=len(stops)))

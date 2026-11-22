"""Package an offline Centro Histórico from OSM XML and Mapzen Terrain Tiles."""

import argparse
import json
import math
import struct
import xml.etree.ElementTree as ET
import zlib
from pathlib import Path

BOUNDS = (900, 2940, -3230, -870)
REFERENCE = (-23.5614, -46.6559)
CELL = 20
BASE_ELEVATION = 750
REMOTE_TILE_X = 6069
LANDMARKS = (
    ('se', 'Catedral da Sé', 8093737, (-23.55062, -46.63462)),
    ('pateo', 'Pateo do Collegio', 205784140, (-23.54896, -46.63294)),
    ('anhangabau', 'Vale do Anhangabaú', 48511928, (-23.54540, -46.63766)),
    ('municipal', 'Theatro Municipal', 46927931, (-23.54560, -46.63832)),
    ('cha', 'Viaduto do Chá', 48651855, (-23.54711, -46.63822)),
    ('farol', 'Farol Santander', 191607149, (-23.54579, -46.63428)),
    ('martinelli', 'Edifício Martinelli', 191607150, (-23.54580, -46.63549)),
    ('bento', 'Mosteiro de São Bento', 4611189, (-23.54310, -46.63499)),
    ('mercadao', 'Mercado Municipal', 4602996, (-23.54180, -46.63091)),
    ('republica', 'Praça da República', 8840623, (-23.54458, -46.64297)),
    ('luz', 'Estação da Luz', 8105832, (-23.53566, -46.63554)),
    ('pinacoteca', 'Pinacoteca', 231110974, (-23.53495, -46.63403)),
    ('copan', 'Edifício Copan', 8100248, (-23.54642, -46.64408)),
)


def world(lat, lon):
    # Metric tangent frame at the same origin and orientation as src/geodesy.js.
    return [round((lon - REFERENCE[1]) * 102114.5, 2),
            round(-(lat - REFERENCE[0]) * 110761.5, 2)]


def terrarium(path):
    data = path.read_bytes()
    width, height, depth, color, _, _, interlaced = struct.unpack_from('>IIBBBBB', data, 16)
    if (width, height, depth, color, interlaced) != (256, 256, 8, 2, 0):
        raise ValueError(f'Unsupported Terrain Tiles PNG {path}')
    compressed = bytearray()
    cursor = 8
    while cursor < len(data):
        length, kind = struct.unpack_from('>I4s', data, cursor)
        if kind == b'IDAT':
            compressed.extend(data[cursor + 8:cursor + 8 + length])
        cursor += length + 12
    pixels = zlib.decompress(compressed)
    rows = []
    previous = bytearray(768)
    for row in range(256):
        offset = row * 769
        mode = pixels[offset]
        line = bytearray(pixels[offset + 1:offset + 769])
        for col, value in enumerate(line):
            left = line[col - 3] if col >= 3 else 0
            top = previous[col]
            top_left = previous[col - 3] if col >= 3 else 0
            if mode == 1:
                value += left
            elif mode == 2:
                value += top
            elif mode == 3:
                value += (left + top) // 2
            elif mode == 4:
                estimate = left + top - top_left
                value += min((left, top, top_left), key=lambda a: abs(a - estimate))
            line[col] = value & 255
        rows.append([line[col] * 256 + line[col + 1] + line[col + 2] / 256 - 32768
                     for col in range(0, 768, 3)])
        previous = line
    return rows


def terrain(folder):
    tiles = {row: terrarium(folder / f'historic-dem-{REMOTE_TILE_X}-{row}.png')
             for row in (9294, 9295)}

    def sample(x, z):
        lat = REFERENCE[0] - z / 110761.5
        lon = REFERENCE[1] + x / 102114.5
        tile_x = (lon + 180) / 360 * 16384
        tile_y = (1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * 16384
        px = (tile_x - REMOTE_TILE_X) * 256 - .5
        py = tile_y * 256 - .5
        col = math.floor(px)
        row = math.floor(py)
        u, v = px - col, py - row
        a = tiles[row // 256][row % 256]
        b = tiles[(row + 1) // 256][(row + 1) % 256]
        return round((a[col] * (1 - u) + a[col + 1] * u) * (1 - v)
                     + (b[col] * (1 - u) + b[col + 1] * u) * v - BASE_ELEVATION, 2)

    xmin, xmax, zmin, zmax = BOUNDS
    cols = (xmax - xmin) // CELL + 1
    rows = (zmax - zmin) // CELL + 1
    return dict(step=CELL, cols=cols, rows=rows, baseElevation=BASE_ELEVATION,
                ys=[sample(xmin + x * CELL, zmin + z * CELL)
                    for z in range(rows) for x in range(cols)])


def tags(element):
    return {tag.get('k'): tag.get('v') for tag in element.findall('tag')}


def clamp_feature(points):
    xmin, xmax, zmin, zmax = BOUNDS
    return (min(p[0] for p in points) < xmax and max(p[0] for p in points) > xmin
            and min(p[1] for p in points) < zmax and max(p[1] for p in points) > zmin)


def number(value, default=0):
    try:
        return float((value or '').strip().split()[0])
    except (ValueError, IndexError):
        return default


def join_rings(fragments):
    chains = [fragment[:] for fragment in fragments if len(fragment) > 1]
    rings = []
    while chains:
        chain = chains.pop()
        while chain[0] != chain[-1]:
            for index, f in enumerate(chains):
                if chain[-1] in (f[0], f[-1]):
                    chain.extend((f if chain[-1] == f[0] else f[::-1])[1:])
                    chains.pop(index)
                    break
                if chain[0] in (f[0], f[-1]):
                    chain[:0] = (f if chain[0] == f[-1] else f[::-1])[:-1]
                    chains.pop(index)
                    break
            else:
                break
        if len(chain) > 3 and chain[0] == chain[-1]:
            rings.append(chain[:-1])
    return rings


def build(folder):
    nodes, ways, relations = {}, {}, {}
    for filename in sorted(folder.glob('historic-area-*.osm')):
        for element in ET.parse(filename).getroot():
            id = int(element.get('id', 0))
            if element.tag == 'node':
                point = world(float(element.get('lat')), float(element.get('lon')))
                nodes[id] = point, tags(element)
            elif element.tag == 'way':
                ways[id] = [int(nd.get('ref')) for nd in element.findall('nd')], tags(element)
            elif element.tag == 'relation' and tags(element).get('type') == 'multipolygon':
                relations[id] = element

    base = {}
    raw_path = folder / 'buildings-osm-raw.json'
    if raw_path.exists():
        base = {item['id']: item['tags'] for item in json.loads(raw_path.read_bytes())['elements']}
    roads, buildings, surfaces, trees = [], [], [], []
    hidden_parts = set()
    kinds = dict(motorway=14, trunk=11, primary=11, secondary=8.5, tertiary=7.5,
                 residential=6, unclassified=6, service=4, pedestrian=5.5,
                 living_street=5, footway=2.2, path=1.8, steps=2, cycleway=2.3, track=3)

    def feature(id, rings, tag, is_relation=False):
        points = rings[0]
        if not clamp_feature(points):
            return
        classification = tag.get('building')
        height = number(tag.get('height')) or number(tag.get('building:levels')) * 3.1
        if classification and classification != 'no' and tag.get('location') != 'underground':
            part = classification == 'roof'
            buildings.append(dict(id=id, h=round(min(230, height or (3.8 if part else 10)), 2),
                                  measured=bool(height), rings=rings, name=tag.get('name', ''),
                                  kind=classification, relation=is_relation))
        park = tag.get('leisure') in ('park', 'garden', 'pitch') or tag.get('landuse') == 'grass'
        water = tag.get('natural') == 'water' or tag.get('leisure') == 'swimming_pool'
        plaza = (tag.get('highway') == 'pedestrian' and (tag.get('area') == 'yes' or is_relation)
                 or tag.get('place') == 'square' or tag.get('name') == 'Vale do Anhangabaú')
        if water or plaza or park:
            surfaces.append(dict(id=id, kind='water' if water else 'plaza' if plaza else 'park',
                                 name=tag.get('name', ''), rings=rings))

    for id, element in relations.items():
        tag = tags(element)
        if not any(key in tag for key in ('building', 'natural', 'highway', 'leisure', 'place')):
            continue
        def ring_members(role):
            return [int(member.get('ref')) for member in element.findall('member')
                    if member.get('type') == 'way' and member.get('role') == role]
        def project_rings(members):
            return [[nodes[ref][0] for ref in ring] for ring in join_rings(
                [ways[ref][0] for ref in members if ref in ways])
                if all(ref in nodes for ref in ring)]
        outer_ids = ring_members('outer')
        outer = project_rings(outer_ids)
        inner = project_rings(ring_members('inner'))
        for ring in outer:
            feature(id, [ring, *inner] if len(outer) == 1 else [ring], tag, True)
        if outer and tag.get('building'):
            hidden_parts.update(outer_ids)

    for id, (refs, tag) in ways.items():
        if len(refs) < 2 or any(ref not in nodes for ref in refs):
            continue
        closed = refs[0] == refs[-1] and len(refs) >= 4
        points = [nodes[ref][0] for ref in refs[:-1] if closed] if closed else [nodes[ref][0] for ref in refs]
        if not clamp_feature(points):
            continue
        if closed and id not in hidden_parts:
            feature(id, [points], {**base.get(id, {}), **tag})
        kind = tag.get('highway', '').replace('_link', '')
        if kind not in kinds or tag.get('area') == 'yes':
            continue
        if tag.get('tunnel', 'no') not in ('no', 'building_passage') or number(tag.get('layer')) < 0:
            continue
        width = number(tag.get('width')) or number(tag.get('lanes')) * 3.05 or kinds[kind]
        roads.append(dict(id=id, kind=kind, width=round(max(1, min(width, 28)), 2),
                          name=tag.get('name', ''), points=points + [points[0]] if closed else points,
                          bridge=tag.get('bridge', 'no') != 'no',
                          surface=tag.get('surface', '')))

    xmin, xmax, zmin, zmax = BOUNDS
    for id, ((x, z), tag) in nodes.items():
        if xmin < x < xmax and zmin < z < zmax and tag.get('natural') == 'tree':
            trees.append([x, z, min(22, number(tag.get('height'), 9)), id])
    return dict(
        source='© OpenStreetMap contributors', license='ODbL-1.0',
        terrainSource='Mapzen Terrain Tiles', bounds=dict(minX=xmin, maxX=xmax, minZ=zmin, maxZ=zmax),
        terrain=terrain(folder), roads=roads, buildings=buildings, surfaces=surfaces, trees=trees,
        pois=[dict(id=id, name=name, sourceId=osm, anchor=world(*entrance))
              for id, name, osm, entrance in LANDMARKS],
    )


if __name__ == '__main__':
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument('input', type=Path)
    cli.add_argument('output', type=Path)
    args = cli.parse_args()
    bundle = build(args.input)
    args.output.write_text(json.dumps(bundle, separators=(',', ':'), ensure_ascii=False), 'utf-8')
    print({key: len(bundle[key]) for key in ('roads', 'buildings', 'surfaces', 'trees', 'pois')})

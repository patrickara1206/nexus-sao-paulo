"""Build the game's offline OSM supplement from the four historic-area-*.osm tiles.

python tools/prepare-prestes-osm.py ../../work public/data/prestes-osm.json
"""

import argparse
import json
import xml.etree.ElementTree as ET
from pathlib import Path

# Geometry for the avenue and approaches, in WGS84 degrees. Include full crossing
# ways, preserving shared node IDs across tile boundaries and legal directions.
CORRIDOR = (-23.5458, -46.6380, -23.5334, -46.6312)
CENTRO = (-23.5535, -46.6471, -23.5323, -46.6271)
ATTRIBUTION = "© OpenStreetMap contributors"
FIELDS = set("""name ref local_ref highway public_transport station railway bus psv tram
    amenity barrier traffic_sign shop emergency natural man_made crossing shelter covered
    bench direction building height min_height width sidewalk junction maxspeed oneway
    access vehicle motor_vehicle motorcar motorcycle bicycle foot hgv service surface
    bridge tunnel layer lanes busway cycleway area location tactile_paving""".split())
PREFIXES = ("lanes:", "building:", "sidewalk:", "bus:", "busway:", "psv:", "vehicle:",
            "motor_vehicle:", "motorcar:", "bicycle:", "oneway:", "cycleway:", "crossing:",
            "traffic_signals:", "turn:lanes", "change:lanes", "placement:")


def get_tags(element):
    return {t.attrib["k"]: t.attrib["v"] for t in element.iterfind("tag")
            if t.attrib["k"] in FIELDS or t.attrib["k"].startswith(PREFIXES)}


def point_in(p, bounds):
    s, w, n, e = bounds
    return s <= p[0] <= n and w <= p[1] <= e


def infra(tag):
    return (tag.get("highway") in {"bus_stop", "street_lamp", "crossing", "traffic_signals", "stop", "give_way"}
            or tag.get("railway") in {"station", "subway_entrance", "train_station_entrance"}
            or tag.get("public_transport") == "platform" and tag.get("bus") == "yes"
            or tag.get("station") == "subway" or tag.get("amenity") in {"waste_basket", "bench"}
            or tag.get("shop") == "newsagent" or tag.get("natural") == "tree"
            or tag.get("emergency") == "fire_hydrant" or tag.get("man_made") == "street_lamp"
            or tag.get("barrier") in {"bollard", "guard_rail", "fence"} or "traffic_sign" in tag)


def build(folder, base_path):
    files = sorted(folder.glob("historic-area-*.osm"))
    if not files:
        raise ValueError(f"No historic-area-*.osm in {folder}")
    legacy = json.loads(base_path.read_bytes())
    saved_roads = {r["id"] for r in legacy["roads"]}
    saved_buildings = {b["id"] for b in legacy["buildings"] if not b["relation"]}
    saved_relations = {b["id"] for b in legacy["buildings"] if b["relation"]}
    coords, node_tags, ways, relations = {}, {}, {}, {}
    for file in files:
        for item in ET.parse(file).getroot():
            if item.tag not in ("node", "way", "relation"):
                continue
            ident = int(item.attrib["id"])
            tags = get_tags(item)
            if item.tag == "node":
                coords[ident] = (float(item.attrib["lat"]), float(item.attrib["lon"]))
                if tags:
                    node_tags[ident] = tags
            elif item.tag == "way":
                ways[ident] = ([int(n.attrib["ref"]) for n in item.iterfind("nd")], tags)
            elif ident in saved_relations:
                relations[ident] = tags

    # Pack only measured height tags elsewhere in the base cut. Its polygons
    # (including multipart buildings and courtyards) already ship with the game.
    base_extra = folder / "buildings-osm-raw.json"
    previous_tags = {}
    if base_extra.exists():
        for entry in json.loads(base_extra.read_bytes())["elements"]:
            if entry["type"] == "way" and entry["id"] in saved_buildings:
                previous_tags[entry["id"]] = {k: v for k, v in entry.get("tags", {}).items()
                                              if k in FIELDS or k.startswith(PREFIXES)}
    metadata = {"way": {}, "relation": {}}
    for ident, tags in relations.items():
        metadata["relation"][ident] = tags
    selected = []
    nodes_needed = set()
    for ident, (refs, original_tags) in ways.items():
        tags = {**previous_tags.get(ident, {}), **original_tags}
        if not refs or any(n not in coords for n in refs):
            continue
        in_corridor = any(point_in(coords[n], CORRIDOR) for n in refs)
        if in_corridor and (ident in saved_buildings or "highway" in tags or infra(tags)):
            selected.append(dict(type="way", id=ident, nodes=refs, tags=tags))
            nodes_needed.update(refs)
        elif ident in saved_buildings:
            measured = {k: v for k, v in tags.items() if k in
                        ("height", "building:levels", "min_height", "building:min_level", "building:material")}
            if measured:
                metadata["way"][ident] = measured
        elif ident in saved_roads:
            metadata["way"][ident] = tags

    for ident, tags in node_tags.items():
        if point_in(coords[ident], CENTRO) and infra(tags):
            nodes_needed.add(ident)
    nodes = []
    for ident in sorted(nodes_needed):
        lat, lon = coords[ident]
        node = dict(type="node", id=ident, lat=lat, lon=lon)
        if ident in node_tags and infra(node_tags[ident]) and point_in(coords[ident], CENTRO):
            node["tags"] = node_tags[ident]
        nodes.append(node)
    return dict(version=0.6, source="https://www.openstreetmap.org/copyright",
                attribution=ATTRIBUTION, license="ODbL-1.0", bbox=CORRIDOR,
                metadata=metadata, elements=nodes + sorted(selected, key=lambda e: e["id"]))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--base", type=Path, default=Path("public/data/historic.json"))
    args = parser.parse_args()
    bundle = build(args.input, args.base)
    args.output.write_text(json.dumps(bundle, separators=(",", ":"), ensure_ascii=False), encoding="utf-8")
    print(f"{len(bundle['elements'])} OSM elements, {args.output.stat().st_size:,} bytes")

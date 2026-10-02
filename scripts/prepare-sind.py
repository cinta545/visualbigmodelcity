"""Convert the pinned official Tianjin sample; pip install pyproj==3.8.0."""
import csv
import hashlib
import json
from collections import Counter
from pathlib import Path
import xml.etree.ElementTree as ET
from pyproj import Proj

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'data/sind-source/Data/Tianjin'
OUT = ROOT / 'data/sind'
COMMIT = '930e4dea78d924c6e9a58ff8e378331f93bba8ec'
FILES = [
    ('sind-vehicles.csv', 'c377452a22ad0d57e2ebc9a8bccf050ef50c32c10ce35d7984a12edc24e532b5'),
    ('sind-pedestrians.csv', '97e9b8a03e6edb0e6f7141b9edc3d42c75d0a9e0fd2981c71e60c9e288edbd02'),
]

def convert():
    tracks, counts, hashes = {}, Counter(), {}
    for name, expected in FILES:
        path = ROOT / 'data' / name
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        if digest != expected:
            raise ValueError(f'{name}: incomplete or changed download; SHA256 mismatch')
        hashes[name] = digest
        with path.open(encoding='utf-8-sig', newline='') as source:
            for row in csv.DictReader(source):
                ident = 'Tianjin/8_2_1/' + row['track_id']
                if ident not in tracks:
                    tracks[ident] = dict(id=ident, type=row['agent_type'],
                        length=float(row.get('length', 0)), width=float(row.get('width', 0)), samples=[])
                values = [float(row[k]) for k in ['timestamp_ms', 'x', 'y', 'vx', 'vy']]
                values.append(float(row.get('yaw_rad', 0)))
                import math
                if not all(math.isfinite(v) for v in values):
                    raise ValueError(f'Non-finite sample {ident}')
                tracks[ident]['samples'].append(values)
                counts[name] += 1
    for track in tracks.values():
        track['samples'].sort(key=lambda s: s[0])
        if any(b[0] <= a[0] for a, b in zip(track['samples'], track['samples'][1:])):
            raise ValueError(f'Duplicate timestamps: {track["id"]}')
    with (SOURCE / '8_2_1/TrafficLight_8_2_1.csv').open(newline='') as source:
        signals = [[float(r['timestamp(ms)'])] + [int(r[f'Traffic light {i}']) for i in range(1, 9)]
                   for r in csv.DictReader(source)]
    signals.sort(key=lambda r: r[0])
    assert all(c in (0, 1, 3) for r in signals for c in r[1:])
    # Match the official visualizer: UTM zone 31 WGS84, subtract projection of (0,0).
    projection = Proj(proj='utm', zone=31, ellps='WGS84', datum='WGS84')
    origin = projection(0, 0)
    xml = ET.parse(SOURCE / 'map_relink_law_save.osm').getroot()
    nodes = {}
    for node in xml.findall('node'):
        x, y = projection(float(node.attrib['lon']), float(node.attrib['lat']))
        nodes[node.attrib['id']] = [x-origin[0], y-origin[1]]
    ways = []
    for way in xml.findall('way'):
        tags = {t.attrib['k']: t.attrib['v'] for t in way.findall('tag')}
        ways.append(dict(id=way.attrib['id'], tags=tags,
                         points=[nodes[n.attrib['ref']] for n in way.findall('nd')]))
    bounds = [min(p[i] for p in nodes.values()) for i in (0, 1)] + [max(p[i] for p in nodes.values()) for i in (0, 1)]
    duration = max(t['samples'][-1][0] for t in tracks.values())
    metadata = dict(dataset='SinD', recording='Tianjin/8_2_1', commit=COMMIT,
        source='https://github.com/SOTIF-AVLab/SinD', mode='historical-observation',
        units=dict(position='m', time='ms', velocity='m/s', yaw='rad'),
        sampleColumns=['timestamp_ms', 'x', 'y', 'vx', 'vy', 'yaw_rad'],
        rows=dict(counts), tracks=len(tracks), classes=dict(Counter(t['type'] for t in tracks.values())),
        durationMs=duration, signalEvents=len(signals), hashes=hashes,
        projection='WGS84 UTM31N minus projected (0,0)', bounds=bounds)
    OUT.mkdir(parents=True, exist_ok=True)
    relations = []
    for rel in xml.findall('relation'):
        relations.append(dict(id=rel.attrib['id'],
            tags={t.attrib['k']: t.attrib['v'] for t in rel.findall('tag')},
            members=[dict(m.attrib) for m in rel.findall('member')]))
    result = dict(meta=metadata, tracks=list(tracks.values()), signals=signals, ways=ways, relations=relations)
    (OUT/'replay.json').write_text(json.dumps(result, separators=(',', ':'), allow_nan=False), encoding='utf-8')
    (OUT/'audit.json').write_text(json.dumps(metadata, indent=2), encoding='utf-8')
    print(json.dumps(metadata, indent=2))

if __name__ == '__main__':
    convert()

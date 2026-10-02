"""Inventory downloaded public samples without changing or imputing their data."""
import csv
import hashlib
import json
import math
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / 'data' / 'sind-public'
manifest = json.loads((ROOT / 'download-manifest.json').read_text(encoding='utf-8'))
reports = []
for entry in manifest['files']:
    path = ROOT / entry['path']
    if path.name not in ('Veh_smoothed_tracks.csv', 'Ped_smoothed_tracks.csv'):
        continue
    if hashlib.sha256(path.read_bytes()).hexdigest() != entry['sha256']:
        raise ValueError('Downloaded file changed: ' + str(path))
    classes, ids, last = Counter(), set(), {}
    rows = nonfinite = nonincreasing = gaps = invalid_dimensions = 0
    minimum, maximum = math.inf, -math.inf
    with path.open(encoding='utf-8-sig', newline='') as f:
        reader = csv.DictReader(f)
        columns = reader.fieldnames
        required = ['track_id', 'timestamp_ms', 'x', 'y', 'vx', 'vy']
        missing = [c for c in required if c not in columns]
        if missing:
            reports.append({'path': entry['path'], 'missingColumns': missing, 'columns': columns})
            continue
        for row in reader:
            rows += 1
            ident = row['track_id']
            kind = row.get('agent_type', 'pedestrian' if path.name.startswith('Ped') else 'unknown')
            if ident not in ids:
                classes[kind] += 1
            ids.add(ident)
            values = [float(row[c]) for c in required[1:]]
            if not all(math.isfinite(v) for v in values):
                nonfinite += 1
                continue
            t = values[0]
            minimum, maximum = min(minimum, t), max(maximum, t)
            if ident in last:
                delta = t-last[ident]
                nonincreasing += delta <= 0
                gaps += delta > 250
            last[ident] = t
            if kind != 'pedestrian' and not (float(row.get('length', 0)) > 0 and float(row.get('width', 0)) > 0):
                invalid_dimensions += 1
    reports.append({'path': entry['path'], 'rows': rows, 'tracks': len(ids), 'classes': dict(classes), 'startMs': minimum, 'endMs': maximum, 'nonfiniteRows': nonfinite, 'nonincreasingTimes': nonincreasing, 'gapsOver250Ms': gaps, 'invalidDimensionRows': invalid_dimensions, 'columns': columns})
result = {'scope': 'Additional official public samples, not full SinD', 'commit': manifest['commit'], 'reports': reports}
(ROOT / 'audit.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
print(json.dumps([{k: v for k, v in r.items() if k != 'columns'} for r in reports], indent=2))

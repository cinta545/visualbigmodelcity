"""Convert verified public records for offline research; no map/signal remapping."""
import csv
import hashlib
import json
import math
from collections import Counter
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'data/sind-public'
manifest = json.loads((SOURCE/'download-manifest.json').read_text(encoding='utf-8'))
entries = {e['path']: e for e in manifest['files']}
folders = sorted({str(Path(p).parent).replace('\\', '/') for p in entries if p.endswith('Veh_smoothed_tracks.csv')})
out = ROOT/'data/sind/records'
out.mkdir(exist_ok=True)
for folder in folders:
    recording = folder.removeprefix('Data/')
    tracks, hashes, counts = {}, {}, Counter()
    for name in ['Veh_smoothed_tracks.csv','Ped_smoothed_tracks.csv']:
        key = folder+'/'+name
        raw = (SOURCE/key).read_bytes()
        sha = hashlib.sha256(raw).hexdigest()
        if sha != entries[key]['sha256']:
            raise ValueError('Source checksum mismatch: '+key)
        hashes[name] = sha
        with (SOURCE/key).open(encoding='utf-8-sig',newline='') as f:
            for r in csv.DictReader(f):
                ident = recording+'/'+r['track_id']
                if ident not in tracks:
                    tracks[ident] = dict(id=ident,type=r['agent_type'],length=float(r.get('length',0)),width=float(r.get('width',0)),samples=[])
                t = tracks[ident]
                if t['type'] != r['agent_type']:
                    raise ValueError('ID type collision: '+ident)
                sample = [float(r[k]) for k in ['timestamp_ms','x','y','vx','vy']]+[float(r.get('yaw_rad',0))]
                if not all(math.isfinite(v) for v in sample):
                    raise ValueError('Nonfinite observation')
                t['samples'].append(sample)
                counts[name] += 1
    for t in tracks.values():
        if any(b[0]<=a[0] for a,b in zip(t['samples'],t['samples'][1:])):
            raise ValueError('Non-increasing time: '+t['id'])
    meta = dict(recording=recording,commit=manifest['commit'],hashes=hashes,rows=dict(counts),tracks=len(tracks),durationMs=max(t['samples'][-1][0] for t in tracks.values()),units={'position':'m','time':'ms','velocity':'m/s','yaw':'rad'},scope='offline research only; local source coordinates retained; maps/signals not converted; pedestrian missing yaw filled with unused zero')
    target = out/(folder.split('/')[1].lower().replace("'",'')+'.json')
    target.write_text(json.dumps(dict(meta=meta,tracks=list(tracks.values())),separators=(',',':')),encoding='utf-8')
    print(json.dumps({'file':str(target),'recording':recording,'tracks':len(tracks),'rows':sum(counts.values())}))

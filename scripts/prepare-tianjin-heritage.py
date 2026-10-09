"""Allow larger exhibition volumes without changing observed roads or tracks."""
import json,math
from pathlib import Path
from shapely.geometry import box,shape,LineString,Point
from shapely.ops import unary_union
ROOT=Path(__file__).resolve().parents[1]
source=json.loads((ROOT/'data/sind/cities/tianjin.json').read_text(encoding='utf-8'))
record=json.loads((ROOT/'data/sind/replay.json').read_text(encoding='utf-8'))
envelopes=[]
for track in record['tracks']:
    points=[(p[1],p[2]) for p in track['samples']]
    radius=.4 if track['type']=='pedestrian' else math.hypot(track['length'],track['width'])/2
    envelopes.append((LineString(points) if len(points)>1 else Point(points[0])).buffer(radius+1.5))
protected=unary_union([shape(source['road']).buffer(1),shape(source['extension']).buffer(.5),*envelopes])
plots=[]
for index,b in enumerate(source['buildings']):
    original=box(*b['bounds']);allowed=original
    for pad in [2,1.5,1,.5,0]:
        candidate=original.buffer(pad,join_style='mitre')
        if candidate.intersects(protected):continue
        if any(candidate.intersects(box(*other['bounds']).buffer(2,join_style='mitre')) for other in source['buildings'] if other['id']!=b['id']):continue
        allowed=candidate;break
    assert not allowed.intersects(protected),b['id']
    plots.append(dict(id=b['id'],allowedBounds=list(allowed.bounds),targetScale=1.45 if index<4 else 1.25,heightScale=1.45 if index<4 else 1.25))
out=dict(city='tianjin',designOnly=True,plots=plots,audit=dict(tracks=len(record['tracks']),preservesSource=True,avoidsObservedTraffic=True))
(ROOT/'data/sind/cities/tianjin-heritage.json').write_text(json.dumps(out,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
print(json.dumps(out['audit']))

"""Build a road union and audit the designed corner against observed swept areas.
Dependencies: shapely==2.1.2. Source coordinates are never modified.
"""
import json
import math
from pathlib import Path
from collections import Counter
from shapely.geometry import Polygon, LineString, Point, box, mapping
from shapely.ops import unary_union
from shapely.validation import make_valid

ROOT=Path(__file__).resolve().parents[1]
data=json.loads((ROOT/'data/sind/replay.json').read_text(encoding='utf-8'))
site=json.loads((ROOT/'shared/sind-visual-site.json').read_text(encoding='utf-8'))
ways={w['id']:w for w in data['ways']}
polygons=[]
repaired=[]
for rel in data['relations']:
    if rel['tags'].get('type')!='lanelet':continue
    sides=[]
    for role in ['left','right']:
        ref=next(m['ref'] for m in rel['members'] if m['role']==role)
        sides.append(ways[ref]['points'])
    a,b=sides[0],sides[1][:]
    if math.dist(a[0],b[0])>math.dist(a[0],b[-1]):b.reverse()
    polygon=Polygon(a+list(reversed(b)))
    if not polygon.is_valid:
        repaired.append(rel['id'])
        polygon=make_valid(polygon)
    if polygon.geom_type=='Polygon':polygons.append(polygon)
    else:polygons.extend(g for g in polygon.geoms if g.geom_type=='Polygon')
road=unary_union(polygons)
roadTolerance=road.buffer(.5)
sites=[site,*site.get('additionalCorners',[])]
siteSolids={}
pavements={}
for corner in sites:
    footprint=box(*corner['building']['bounds']).buffer(1.35,join_style='mitre')
    furniture=[Point(f['x'],f['y']).buffer(f['radius']) for f in corner['fixedFurniture']]
    siteSolids[corner['id']]=unary_union([footprint,*furniture])
    plaza=corner['plaza']
    if 'boundaryWays' in plaza:
        points=[]
        for key,reverse in plaza['boundaryWays']:
            segment=ways[key]['points']
            points.extend(list(reversed(segment)) if reverse else segment)
        points.extend(plaza['outerPoints'])
        paving=Polygon(points)
        if not paving.is_valid:raise RuntimeError('Invalid paving polygon: '+corner['id'])
        pavements[corner['id']]=mapping(paving.difference(road))
solids=unary_union(list(siteSolids.values()))
perSite={key:{'collidingTracks':[], 'clearanceM':float('inf')} for key in siteSolids}
collisions=[]
outside=Counter()
minimum=float('inf')
gaps=0
for track in data['tracks']:
    # Circumscribed footprint is deliberately conservative, including between samples.
    radius=.35 if track['type']=='pedestrian' else math.hypot(track['length'],track['width'])/2
    runs=[[]]
    for row in track['samples']:
        if runs[-1] and row[0]-runs[-1][-1][0]>250:
            runs.append([]);gaps+=1
        runs[-1].append(row)
        if not roadTolerance.covers(Point(row[1],row[2])):outside[track['type']]+=1
    swept=[]
    for run in runs:
        points=[(s[1],s[2]) for s in run]
        swept.append((LineString(points) if len(points)>1 else Point(points[0])).buffer(radius))
    occupied=unary_union(swept)
    minimum=min(minimum,occupied.distance(solids))
    if occupied.intersects(solids):collisions.append(track['id'])
    for key,geometry in siteSolids.items():
        perSite[key]['clearanceM']=min(perSite[key]['clearanceM'],occupied.distance(geometry))
        if occupied.intersects(geometry):perSite[key]['collidingTracks'].append(track['id'])
signals=[]
for rel in data['relations']:
    if rel['tags'].get('type')!='regulatory_element' or rel['tags'].get('subtype')!='traffic_light':continue
    refs={m['role']:ways[m['ref']] for m in rel['members'] if m['type']=='way'}
    light,stop=refs['refers'],refs['ref_line']
    signals.append({'name':light['tags']['name'],'lightWay':light['id'],'stopLineWay':stop['id'],
        'position':[sum(p[k] for p in light['points'])/len(light['points']) for k in (0,1)],
        'stopLineCenter':[sum(p[k] for p in stop['points'])/len(stop['points']) for k in (0,1)]})
report=dict(recording=data['meta']['recording'],tracks=len(data['tracks']),
    laneletCount=len([r for r in data['relations'] if r['tags'].get('type')=='lanelet']),
    repairedRenderPolygonIds=repaired,roadAreaM2=road.area,
    signalBindings=signals,unlocatedSignalIds=[1,3,5,7],
    fixedFurnitureCollidingTracks=collisions,minConservativeClearanceM=minimum,designedCorners=perSite,
    missingIntervalsOver250ms=gaps,centerSamplesOutsideLaneUnionPlusHalfMetre=dict(outside),
    note='Outside lane union is a diagnostic, not an invalid-track or violation label. Pedestrian areas and road edges may be unmodelled. Designed scenery is not surveyed.')
out=ROOT/'data/sind';out.mkdir(exist_ok=True)
(out/'scene-baseline.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
(out/'road-surface.json').write_text(json.dumps(mapping(road)),encoding='utf-8')
(out/'pavements.json').write_text(json.dumps(pavements),encoding='utf-8')
print(json.dumps(report,indent=2))
if collisions:raise RuntimeError('Designed fixed geometry intersects observed movement')

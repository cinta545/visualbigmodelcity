"""Join display continuations to measured road edges; never rewrite observations."""
import json, math
from pathlib import Path
from shapely.geometry import shape, LineString, Point, Polygon, mapping, box
from shapely.ops import unary_union

ROOT=Path(__file__).resolve().parents[1]
plans={}
for city in ['tianjin','changchun','chongqing','xian']:
    config=json.loads((ROOT/f'data/sind/cities/{city}.json').read_text(encoding='utf8'))
    road=shape(config['roadSurface']); extension=shape(config['extension'])
    profiles=[]; strips=[]; cuts=[]
    for axis in config['extensionAxes']:
        a,b=axis['points']; length=math.dist(a,b)
        d=[(b[k]-a[k])/length for k in [0,1]]; n=[-d[1],d[0]]
        def point(s,o):return (a[0]+d[0]*s+n[0]*o,a[1]+d[1]*s+n[1]*o)
        # Ignore detached sidewalk lanelets: select the continuous carriageway near the axis.
        cross=road.intersection(LineString([point(-8,-70),point(-8,70)]))
        parts=[cross] if cross.geom_type=='LineString' else list(getattr(cross,'geoms',[]))
        spans=[]
        for g in parts:
            if g.geom_type!='LineString':continue
            offsets=[(v[0]-a[0])*n[0]+(v[1]-a[1])*n[1] for v in g.coords]
            spans.append([min(offsets),max(offsets)])
        spans.sort(); carriage=[]
        for lo,hi in spans:
            if carriage and lo-carriage[-1][1]<.6:carriage[-1][1]=hi
            else:carriage.append([lo,hi])
        lo,hi=min(carriage,key=lambda p:0 if p[0]<=0<=p[1] else min(abs(p[0]),abs(p[1])))
        start=-8; end=32; half=axis['width']/2
        def edges(s):
            t=max(0,min(1,(s-start)/(end-start))); t=t*t*(3-2*t)
            return (lo*(1-t)-half*t,hi*(1-t)+half*t)
        stations=[start+i*.5 for i in range(int((end-start)/.5)+1)]
        left=[point(s,edges(s)[0]) for s in stations]
        right=[point(s,edges(s)[1]) for s in stations]
        strip=Polygon(left+right[::-1]); assert strip.is_valid
        # Replace only the display extension's join, leaving the surveyed surface intact.
        cut=Polygon([point(start,-70),point(end,-70),point(end,70),point(start,70)])
        cuts.append(cut); strips.append(strip.difference(road))
        profiles.append(dict(start=start,end=end,left=lo,right=hi))
    result=unary_union([extension.difference(unary_union(cuts)),*strips])
    # Some recordings extend beyond their lanelet outlines. Never remove asphalt
    # under a recorded participant: retain the old join there and round its seam.
    record=json.loads((ROOT/('data/sind/replay.json' if city=='tianjin' else f'data/sind/records/{city}.json')).read_text(encoding='utf8'))
    envelopes=[]
    for track in record['tracks']:
        points=[s[1:3] for s in track['samples']]
        radius=.4 if track['type']=='pedestrian' else math.hypot(track['length'],track['width'])/2
        envelopes.append((LineString(points) if len(points)>1 else Point(points[0])).buffer(radius+.3))
    observed=unary_union(envelopes)
    if extension.difference(result.union(road)).intersects(observed):
        result=result.union(extension)
        joined=result.union(road)
        rounded=joined.buffer(6,join_style='round').buffer(-6,join_style='round')
        result=result.union(rounded.intersection(unary_union(cuts)).difference(road))
    assert extension.difference(result.union(road)).intersection(observed).area<1e-6
    if result.geom_type=='GeometryCollection':
        result=unary_union([g for g in result.geoms if g.geom_type in ['Polygon','MultiPolygon']])
    assert result.is_valid
    # The changed asphalt must not enter any existing architectural footprint.
    additions=result.difference(extension).difference(road)
    buildings=config['buildings']
    if city in ['changchun','chongqing']:
        quarter=json.loads((ROOT/f'data/sind/cities/{city}-quarter.json').read_text(encoding='utf8'))
        buildings=quarter['buildings']
    elif city=='xian':
        buildings=json.loads((ROOT/'data/sind/cities/xian-quarter.json').read_text(encoding='utf8'))['wards']
    assert all(not additions.intersects(shape(b['footprint']) if 'footprint' in b else box(*b['bounds'])) for b in buildings),city
    footways=result.buffer(2.4,join_style='round').difference(result.union(road))
    plans[city]=dict(extension=mapping(result),footways=mapping(footways),profiles=profiles)
    print(city,[(round(p['left'],2),round(p['right'],2)) for p in profiles])
(ROOT/'data/sind/cities/road-alignment.json').write_text(json.dumps(plans,separators=(',',':')),encoding='utf8')

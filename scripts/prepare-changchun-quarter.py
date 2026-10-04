"""Designed street quarter; source roads, signals and observations remain untouched."""
import json, math
from pathlib import Path
from shapely.geometry import shape, box, LineString, Point, mapping
from shapely.ops import unary_union

ROOT=Path(__file__).resolve().parents[1]
scene=json.loads((ROOT/'data/sind/cities/changchun.json').read_text(encoding='utf-8'))
data=json.loads((ROOT/'data/sind/records/changchun.json').read_text(encoding='utf-8'))
occupied=[]
for track in data['tracks']:
    points=[(s[1],s[2]) for s in track['samples']]
    if not points: continue
    radius=.4 if track['type']=='pedestrian' else math.hypot(track['length'],track['width'])/2
    occupied.append((LineString(points) if len(points)>1 else Point(points[0])).buffer(radius+1.5))
safe=unary_union([shape(scene['road']).buffer(3),shape(scene['extension']).buffer(4),*occupied])
original=scene['buildings']
cx,cy=scene['center']
# Landmark-led plan: three principal corners, a secondary monument, and a
# pavilion / heritage tram beside one concentrated north-east woodland.
destinations={0:0,1:1,2:2,3:10,4:13,5:9}
forest=box(cx+50,cy+54,cx+170,cy+180).difference(safe.buffer(5))
# An elevated scenic line spans west to east; piers alone require ground clearance.
anchors=[(cx-215,cy+108),(cx-145,cy+96),(cx-80,cy+96),(cx+80,cy+96),(cx+145,cy+108),(cx+215,cy+122)]
rail=[]
for i in range(len(anchors)-1):
    a=anchors[max(0,i-1)];b=anchors[i];c=anchors[i+1];d=anchors[min(len(anchors)-1,i+2)]
    for k in range(20):
        t=k/20
        rail.append(tuple(.5*((2*b[j])+(-a[j]+c[j])*t+(2*a[j]-5*b[j]+4*c[j]-d[j])*t*t+(-a[j]+3*b[j]-3*c[j]+d[j])*t*t*t) for j in range(2)))
rail.append(anchors[-1]);railLine=LineString(rail);railReserve=railLine.buffer(3.6)
railHeight=7.2
piers=[]
for station in range(8,int(railLine.length),18):
    point=railLine.interpolate(station)
    if not point.buffer(2.2).intersects(safe):piers.append(list(point.coords[0]))
assert railHeight-.65>max(float(t.get('height',4.5) or 4.5) for t in data['tracks'])+1, 'Insufficient bridge clearance'
plots=[]
for landmark,destination in destinations.items():
    b=dict(original[destination]);b.update(id=f'changchun-{landmark}',detail=True,landmark=True)
    if landmark==5:
        # Static exhibit sits on the straight elevated track, at its actual height.
        centre=railLine.interpolate(railLine.project(Point(cx+32,cy+96)))
        b['bounds']=[centre.x-12,centre.y-10,centre.x+12,centre.y+10]
        b['baseHeight']=railHeight
        station=railLine.project(centre);p0=railLine.interpolate(station-.1);p1=railLine.interpolate(station+.1)
        b['rotation']=math.atan2(p1.y-p0.y,p1.x-p0.x)
        b['front']='south'
    else:
        x0,y0,x1,y1=b['bounds'];x=(x0+x1)/2;y=(y0+y1)/2
        scale=1.5 if landmark<3 else 1.22
        width=24*scale;depth=20*scale
        for push in range(0,41,2):
            xx=x+math.copysign(push,x-cx);yy=y+math.copysign(push*.65,y-cy)
            candidate=box(xx-width/2,yy-depth/2,xx+width/2,yy+depth/2)
            if not candidate.buffer(5).intersects(safe.union(railReserve)) and not any(candidate.buffer(3).intersects(box(*p['bounds'])) for p in plots):
                b['bounds']=list(candidate.bounds);break
        else:raise AssertionError('No room for enlarged landmark')
        b['verticalBoost']=1.12
    plots.append(b)
used=set(destinations.values())
# Recover the former landmark plots as everyday street-front buildings.
for i,b in enumerate(original):
    if i in used: continue
    if box(*b['bounds']).buffer(5).intersects(forest.union(railReserve)):continue
    if any(box(*b['bounds']).intersects(box(*p['bounds']).buffer(3)) for p in plots[:6]):continue
    c=dict(b);c.update(id=f'changchun-quarter-{i}',detail=False,landmark=False)
    plots.append(c)

accepted=[]
for i,b in enumerate(plots):
    x0,y0,x1,y1=b['bounds'];x=(x0+x1)/2;y=(y0+y1)/2
    if not b['landmark']:
        # Grow street houses into formerly empty margins, keeping a pedestrian lane.
        for width,depth in [(29,25),(28,24),(26,22),(24,20)]:
            candidate=box(x-width/2,y-depth/2,x+width/2,y+depth/2)
            if candidate.buffer(5).intersects(safe.union(railReserve).union(forest)): continue
            if any(candidate.buffer(1.25).intersects(p) for p in accepted): continue
            if any(candidate.buffer(1.25).intersects(box(*p['bounds'])) for p in plots[:6]): continue
            b['bounds']=list(candidate.bounds);break
    footprint=box(*b['bounds'])
    assert not footprint.buffer(5).intersects(safe), b['id']
    assert not any(footprint.intersects(p) for p in accepted), b['id']
    accepted.append(footprint)
    distance=math.hypot(x-scene['center'][0],y-scene['center'][1])
    b['height']=([14.6,8.6,10.2,15.2,7,5][i]*min((b['bounds'][2]-b['bounds'][0])/24,(b['bounds'][3]-b['bounds'][1])/20)*b.get('verticalBoost',1) if b['landmark'] else
                 (5.6+(i%2)*1.4) if distance<115 else 7+(i%3)*1.4)
    b['quarterRole']='landmark' if b['landmark'] else 'street'
    b['variant']=i

# Fill the actual free polygons instead of limiting scenery to fifty old grid lots.
# Small street houses can occupy gaps where a 24 x 20 m template never fitted.
cx,cy=scene['center']
reserved=unary_union([p.buffer(3.5) for i,p in enumerate(accepted)])
available=box(cx-195,cy-195,cx+195,cy+195).difference(safe.buffer(5)).difference(reserved).difference(forest).difference(railReserve.buffer(3))
candidates=[]
for gx in range(-15,16):
    for gy in range(-15,16):
        x=cx+gx*13;y=cy+gy*13
        candidates.append((math.hypot(x-cx,y-cy),x,y))
for _,x,y in sorted(candidates):
    for width,depth in [(24,18),(18,16),(14,12),(10,10)]:
        candidate=box(x-width/2,y-depth/2,x+width/2,y+depth/2)
        if not available.covers(candidate): continue
        b=dict(id=f'changchun-infill-{len(plots)}',bounds=list(candidate.bounds),height=5.6 if math.hypot(x-cx,y-cy)<115 else 8.4,
               kind='commercial',front='north' if y<cy else 'south',detail=False,landmark=False,
               quarterRole='infill',variant=len(plots))
        plots.append(b);accepted.append(candidate)
        available=available.difference(candidate.buffer(3));break

# Remaining non-traffic land becomes shaped planted courtyards and green verges,
# leaving a 3 m pedestrian apron around buildings. No objects in observed paths.
greenLand=box(cx-225,cy-225,cx+225,cy+225).difference(unary_union([shape(scene['roadSurface']),shape(scene['extension'])]).buffer(1.8))
greenLand=unary_union([p for p in getattr(greenLand,'geoms',[greenLand]) if p.area>18])
groves=[]
for gx in range(-26,27):
    for gy in range(-26,27):
        x=cx+gx*8+(gy%2)*3;y=cy+gy*8
        tree=Point(x,y).buffer(2.7)
        if forest.covers(tree) and greenLand.covers(tree) and not tree.intersects(railReserve) and not any(tree.intersects(p.buffer(2)) for p in accepted):groves.append([round(x,3),round(y,3)])
# Pocket planting fills leftover courtyards without blocking recorded paths.
courtyard=[]
plantable=greenLand.difference(safe.buffer(1)).difference(railReserve.buffer(1)).difference(unary_union([p.buffer(2) for p in accepted])).difference(forest)
for gx in range(-30,31):
    for gy in range(-30,31):
        x=cx+gx*6+(gy%2)*2;y=cy+gy*6
        if math.hypot(x-cx,y-cy)>185:continue
        if plantable.covers(Point(x,y).buffer(1.7)):
            courtyard.append([round(x,3),round(y,3)])
for i,p in enumerate(accepted):
    assert not p.buffer(5).intersects(safe), plots[i]['id']
    assert not any(p.intersects(other) for other in accepted[i+1:]), plots[i]['id']

out=dict(city='changchun',designOnly=True,planVersion='landmark-elevated',buildings=plots,greenLand=mapping(greenLand),forest=mapping(forest),groves=groves,tramRail=rail,tramRailHeight=railHeight,tramPiers=piers,courtyardPlanting=courtyard,
         audit=dict(sourceTracks=len(data['tracks']),overlaps=0,clearance=5,sourceRoadsUnchanged=True,bridgeUnderside=railHeight-.65,piersAvoidTraffic=all(not Point(p).buffer(2.2).intersects(safe) for p in piers)))
(ROOT/'data/sind/cities/changchun-quarter.json').write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(dict(buildings=len(plots),landmarks=6,infill=sum(p['quarterRole']=='infill' for p in plots),audit=out['audit'])))

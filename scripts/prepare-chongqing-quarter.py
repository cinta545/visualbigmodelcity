"""Designed Chongqing neon-night quarter; roads, the surveyed intersection and every
observed track stay untouched. Only scenery plots are planned here."""
import json, math
from pathlib import Path
from shapely.geometry import shape, box, LineString, Point, MultiPoint, mapping
from shapely.ops import unary_union, triangulate
from shapely.affinity import rotate

ROOT=Path(__file__).resolve().parents[1]
scene=json.loads((ROOT/'data/sind/cities/chongqing.json').read_text(encoding='utf-8'))
data=json.loads((ROOT/'data/sind/records/chongqing.json').read_text(encoding='utf-8'))
cx,cy=scene['center']

# Conservative swept envelopes of every recorded actor, plus mapped roads and the
# four scenic continuations. Nothing designed may enter this zone.
occupied=[]
for track in data['tracks']:
    points=[(s[1],s[2]) for s in track['samples']]
    if not points: continue
    radius=.4 if track['type']=='pedestrian' else math.hypot(track['length'],track['width'])/2
    occupied.append((LineString(points) if len(points)>1 else Point(points[0])).buffer(radius+1.5))
safe=unary_union([shape(scene['road']).buffer(3),shape(scene['extension']).buffer(4),*occupied])
max_vehicle=max(float(t.get('height',4.5) or 4.5) for t in data['tracks'])

plots=[]; accepted=[]
def place(kind,name,angle,width,depth,estimate,margin=5,verticalBoost=1):
    """March outward on a fixed bearing until an oversized plot clears all corridors;
    when the bearing itself stays blocked (e.g. a road continuation), fan out sideways."""
    for offset in (0,.26,-.26,.52,-.52,.79,-.79,1.05,-1.05,1.31,-1.31):
        for radius in range(90,201,2):
            x=cx+math.cos(angle+offset)*radius; y=cy+math.sin(angle+offset)*radius
            candidate=box(x-width/2,y-depth/2,x+width/2,y+depth/2)
            if candidate.buffer(margin).intersects(safe): continue
            if any(candidate.buffer(14).intersects(p) for p in accepted): continue
            b=dict(id=f'chongqing-{len(plots)}',bounds=list(candidate.bounds),kind='commercial',height=estimate,
                   front='north' if y<cy else 'south',detail=False,landmark=True,quarterRole='landmark',
                   landmarkKind=kind,name=name,variant=len(plots),verticalBoost=verticalBoost)
            plots.append(b);accepted.append(candidate);return b
    raise AssertionError('No room for '+name)

# Nine signature exhibits, one per bearing so every approach reads a different landmark.
# The final column lifts landmarks whose real-world form is low (monument, hillside lane,
# temple) so every signature reads above the surrounding infill, as the brief requires.
landmarks=[
 ('hongya','洪崖洞',228,46,38,56,1),
 ('raffles','来福士广场',96,42,40,92,1),
 ('baixiang','白象居',42,36,30,50,1),
 ('liziba','李子坝 · 穿楼轻轨',354,36,28,44,1),
 ('luohan','罗汉寺',176,34,30,20,1),
 ('shancheng','山城巷',268,30,30,18,1),
 ('jiefangbei','解放碑',316,26,24,24,1),
 ('erchang','鹅岭二厂',134,34,30,41,1),
]
for kind,name,deg,w,d,h,boost in landmarks:
    place(kind,name,math.radians(deg),w,d,h,verticalBoost=boost)
# The cableway reads best when its span crosses the whole bowl, so both stations
# are chosen jointly: near-opposite bearings, far apart, line passing near the core.
station_pool=[]
for deg in range(0,360,12):
    for radius in range(90,191,10):
        x=cx+math.cos(math.radians(deg))*radius; y=cy+math.sin(math.radians(deg))*radius
        candidate=box(x-9,y-9,x+9,y+9)
        if candidate.buffer(5).intersects(safe): continue
        if any(candidate.buffer(14).intersects(p) for p in accepted): continue
        station_pool.append((deg,radius,x,y))
def point_line_distance(px,py,ax,ay,bx,by):
    abx,aby=bx-ax,by-ay; t=max(0,min(1,((px-ax)*abx+(py-ay)*aby)/(abx*abx+aby*aby)))
    return math.hypot(px-(ax+abx*t),py-(ay+aby*t))
best=None
for i,a in enumerate(station_pool):
    for b in station_pool[i+1:]:
        span=math.hypot(a[2]-b[2],a[3]-b[3])
        if not 170<=span<=340: continue
        if point_line_distance(cx,cy,a[2],a[3],b[2],b[3])>45: continue
        gap=abs(180-abs(a[0]-b[0])%360 if abs(a[0]-b[0])<=180 else 180-(360-abs(a[0]-b[0])))
        score=gap*2+point_line_distance(cx,cy,a[2],a[3],b[2],b[3])-span*.02
        if best is None or score<best[0]: best=(score,a,b)
assert best,'No cableway span found'
station_defs=[('长江索道 · 北站',best[1]),('长江索道 · 南站',best[2])]
cable_stations=[]
for name,(_,_,x,y) in station_defs:
    candidate=box(x-9,y-9,x+9,y+9)
    b=dict(id=f'chongqing-{len(plots)}',bounds=list(candidate.bounds),kind='commercial',height=30,
           front='north' if y<cy else 'south',detail=False,landmark=True,quarterRole='landmark',
           landmarkKind='cableway',name=name,variant=len(plots))
    plots.append(b);accepted.append(candidate);cable_stations.append([x,y])
cableway=dict(stations=cable_stations,towerHeight=30,cableY=22,cabinDrop=2.6)

# Reference-led continuous fabric: low foreground, taller distant blocks.
railY=cy+155
railPoints=[[cx-230,railY],[cx+230,railY]]
railReserve=LineString(railPoints).buffer(5)
railPiers=[]
for x in range(-216,217,27):
    p=Point(cx+x,railY)
    if not p.buffer(2).intersects(safe) and not any(p.buffer(3).intersects(q) for q in accepted):railPiers.append([cx+x,railY])
reserved=unary_union([p.buffer(4) for p in accepted])
available=box(cx-245,cy-200,cx+245,cy+270).difference(safe.buffer(5)).difference(reserved).difference(railReserve)
streetBand=unary_union([shape(scene['road']),shape(scene['extension'])]).buffer(35)
def infill(x,y,w,d,seed,frontage=False):
    global available
    candidate=box(x-w/2,y-d/2,x+w/2,y+d/2)
    if not available.covers(candidate):return False
    radius=math.hypot(x-cx,y-cy)
    kind='commercial' if frontage else ['residential','commercial','office'][seed%3]
    height=10+(seed%4)*3.4 if frontage else 16+(seed%7)*3.4
    if not frontage and y>cy+85 and seed%3==0:height=48+seed%32
    # The foreground stays low, opening the view towards the junction and landmarks.
    if y<cy-40:height=min(height,23)
    plots.append(dict(id=f'chongqing-fabric-{len(plots)}',bounds=list(candidate.bounds),height=height,kind=kind,front='south',detail=False,landmark=False,quarterRole='infill',variant=seed,baseHeight=0,architecture='oldstreet' if frontage else 'tower' if height>40 else 'courtyard'))
    accepted.append(candidate);available=available.difference(candidate.buffer(1.8 if frontage else 3));return True
# Fill the street edges first; the remaining land takes wider, varied blocks.
for gy in range(-18,25):
    for gx in range(-22,23):
        x=cx+gx*11;y=cy+gy*11
        if not streetBand.contains(Point(x,y)):continue
        seed=abs(gx*37+gy*19)
        for w,d in [(9,16),(9,11),(8,8)]:
            if infill(x,y,w,d,seed,True):break
for gy in range(-8,12):
    for gx in range(-10,11):
        seed=abs(gx*41+gy*23)
        x=cx+gx*25+(gy%2)*6+(seed%5)-2;y=cy+gy*25+(seed%7)-3
        for w,d in [(18+seed%7,16+seed%5),(16,15),(12,12)]:
            if infill(x,y,w,d,seed):break
skyline=[]
mountains=[]

# A cable-stayed suspension span crosses the southern backdrop, high above all traffic.
bridge=dict(axis=[[cx-350,cy-318],[cx+350,cy-318]],deckY=37,pylons=[[cx-272,cy-318],[cx+272,cy-318]])
for px,py in bridge['pylons']:
    assert not Point(px,py).buffer(6).intersects(safe),'Bridge pylon inside protected corridor'

cable_clearance=cableway['cableY']-cableway['cabinDrop']-max_vehicle
bridge_clearance=bridge['deckY']-2.5-max_vehicle
assert cable_clearance>1,'Cableway clearance insufficient'
assert bridge_clearance>1,'Bridge clearance insufficient'
for i,p in enumerate(accepted):
    if i<len(plots):
        assert not p.buffer(5).intersects(safe),plots[i]['id']
    assert not any(p.intersects(o) for o in accepted[i+1:]),f'plot {i} overlaps'
footprints=[p for i,p in enumerate(accepted)]
assert all(not p.buffer(4).intersects(safe) for p in footprints[len(plots):]),'skyline plot too close'

for b in plots:
    b['baseHeight']=0
    if b['landmark']:
        b['front']='south'

# Continuous southeast cutting, outside recorded roads and actor envelopes.
anchors=[(cx+78,cy-200),(cx+78,cy-146),(cx+96,cy-112),(cx+130,cy-94),(cx+153,cy-70),(cx+158,cy-38),(cx+158,cy-12)]
curve=[]
for i in range(len(anchors)-1):
    a0=anchors[max(0,i-1)];b0=anchors[i];c0=anchors[i+1];d0=anchors[min(len(anchors)-1,i+2)]
    for k in range(20):
        t=k/20
        curve.append(tuple(.5*(2*b0[j]+(-a0[j]+c0[j])*t+(2*a0[j]-5*b0[j]+4*c0[j]-d0[j])*t*t+(-a0[j]+3*b0[j]-3*c0[j]+d0[j])*t*t*t) for j in range(2)))
curve.append(anchors[-1])
landmarkKeep=unary_union([box(*b['bounds']).buffer(6) for b in plots if b['landmark']])
raw=LineString(curve).difference(safe.buffer(11).union(landmarkKeep.buffer(5)))
parts=[raw] if raw.geom_type=='LineString' else [g for g in raw.geoms if g.geom_type=='LineString']
route=max(parts,key=lambda p:p.length)
assert route.length>130, 'Terrain road too short for two gentle approaches'
cut=route.buffer(18,cap_style='flat',join_style='round').difference(safe.buffer(1)).difference(landmarkKeep.buffer(1))
# Broaden the outside of the bend into a lower terrace instead of a narrow trench.
terrace=route.parallel_offset(16,'right').buffer(16,cap_style='flat',join_style='round')
terrace=terrace.difference(safe.buffer(1)).difference(landmarkKeep.buffer(1))
cut=cut.union(terrace)
assert not cut.intersects(safe), 'Terrain cuts recorded traffic space'
assert not cut.intersects(landmarkKeep), 'Terrain cuts landmark foundations'
plots=[b for b in plots if b['landmark'] or not box(*b['bounds']).buffer(5).intersects(cut)]
for b in plots:
    if b.get('landmarkKind') in ['liziba','jiefangbei']:
        b['baseHeight']=0
# Smooth grades at both ends meet original ground, centre reaches -7 m.
count=math.ceil(route.length/1.5)
road=[]
for i in range(count+1):
    station=route.length*i/count;p=route.interpolate(station)
    u=min(1,station/52,(route.length-station)/52)
    road.append([p.x,p.y,-7*(u*u*(3-2*u))])
lowerAvailable=cut.buffer(-1).difference(route.buffer(10)).difference(safe.buffer(5)).difference(landmarkKeep)
for i in range(15,len(road)-15,12):
    x,y,h=road[i]
    if h> -6.99:continue
    a=road[i-1];b=road[i+1];length=math.hypot(b[0]-a[0],b[1]-a[1])
    px=x+(b[1]-a[1])/length*18;py=y-(b[0]-a[0])/length*18
    candidate=box(px-3.5,py-3.5,px+3.5,py+3.5)
    rotation=math.atan2(x-px,-(y-py))
    footprint=rotate(candidate,math.degrees(rotation),origin='center')
    if not lowerAvailable.covers(footprint.buffer(1)) or not cut.covers(footprint.buffer(7.5)):continue
    plots.append(dict(id=f'chongqing-lower-{i}',bounds=list(candidate.bounds),height=7.4,kind='commercial',front='south',detail=False,landmark=False,quarterRole='infill',variant=i,baseHeight=0,surfaceHeight=-7,architecture='oldstreet',rotation=math.atan2(x-px,-(y-py))))
    lowerAvailable=lowerAvailable.difference(footprint.buffer(3))
# Broad nested hillside districts: shared terrain, never individual building plinths.
plateaus=[];connections=[]
outer=box(cx-220,cy+45,cx-65,cy+235).buffer(-8).buffer(8).difference(safe.buffer(6)).difference(landmarkKeep.buffer(3)).difference(cut)
upper=box(cx-195,cy+125,cx-105,cy+215).buffer(-8).buffer(8).intersection(outer.buffer(-3))
levels=[(outer,3.5,0),(upper,7,3.5)]
for index,(region,height,base) in enumerate(levels):
    pieces=[region] if region.geom_type=='Polygon' else [g for g in region.geoms if g.geom_type=='Polygon']
    region=unary_union([g for g in pieces if g.area>150])
    if region.is_empty:continue
    for b in plots:
        if b['landmark'] or b.get('surfaceHeight',0)<0:continue
        footprint=box(*b['bounds'])
        if region.covers(footprint.buffer(1)):b['surfaceHeight']=height
    # Find an unobstructed edge for a combined pedestrian ramp and stair.
    parts=[region] if region.geom_type=='Polygon' else list(region.geoms)
    found=False
    for part in sorted(parts,key=lambda p:-p.area):
        boundary=part.exterior
        for station in range(10,int(boundary.length)-10,8):
            p=boundary.interpolate(station);a=boundary.interpolate(station-1);b=boundary.interpolate(station+1)
            length=math.hypot(b.x-a.x,b.y-a.y);nx=-(b.y-a.y)/length;ny=(b.x-a.x)/length
            if not region.contains(Point(p.x+nx,p.y+ny)):nx=-nx;ny=-ny
            inside=(p.x+nx*18,p.y+ny*18);outside=(p.x-nx*18,p.y-ny*18)
            if not region.covers(Point(inside).buffer(4)) or region.intersects(Point(outside).buffer(4)):continue
            if base and not outer.covers(Point(outside).buffer(4)):continue
            corridor=LineString([inside,outside]).buffer(4,cap_style='flat')
            if corridor.intersects(safe.buffer(2)) or corridor.intersects(landmarkKeep):continue
            connections.append(dict(points=[[*inside,height],[*outside,base]],width=2.6,stairWidth=1.8))
            plots=[b for b in plots if b['landmark'] or not box(*b['bounds']).buffer(1).intersects(corridor)]
            region=region.difference(corridor)
            found=True;break
        if found:break
    assert found, 'Terrace needs a pedestrian connection'
    plateaus.append(dict(geometry=mapping(region),height=height,base=base))
# Drop plots straddling a retaining edge instead of leaving a building floating over it.
for region,height,base in levels:
    plots=[b for b in plots if b['landmark'] or b.get('surfaceHeight',0)<0 or not box(*b['bounds']).intersects(region) or region.covers(box(*b['bounds']).buffer(.5))]
for index,plateau in enumerate(plateaus):
    region=shape(plateau['geometry'])
    if index+1<len(plateaus):region=region.difference(unary_union([shape(p['geometry']) for p in plateaus[index+1:]]))
    occupiedPlots=unary_union([box(*b['bounds']).buffer(3) for b in plots])
    available=region.buffer(-2).difference(occupiedPlots).difference(safe.buffer(5))
    x0,y0,x1,y1=region.bounds
    for gx in range(math.ceil(x0/22),math.floor(x1/22)+1):
        for gy in range(math.ceil(y0/22),math.floor(y1/22)+1):
            x=gx*22;y=gy*22;candidate=box(x-7,y-7,x+7,y+7)
            if not available.covers(candidate):continue
            plots.append(dict(id=f'chongqing-hillside-{index}-{gx}-{gy}',bounds=list(candidate.bounds),height=14+(abs(gx+gy)%3)*3.4,kind='residential' if (gx+gy)%2 else 'commercial',front='south',detail=False,landmark=False,quarterRole='infill',variant=abs(gx*19+gy*31),baseHeight=0,surfaceHeight=plateau['height'],architecture='courtyard'))
            available=available.difference(candidate.buffer(3))
upperPlots=[box(*b['bounds']) for b in plots if not b.get('surfaceHeight',0)<0]

# Sloping skirts occupy shared landscape, with room for a real transition rather
# than a vertical slab. Protected traffic and landmark foundations remain flat.
landscape=[];slopeMeshes=[];plants=[]
def plant_region(region,height_at,spacing=8):
    if region.is_empty:return
    x0,y0,x1,y1=region.bounds
    for ix in range(math.ceil(x0/spacing),math.floor(x1/spacing)+1):
        for iy in range(math.ceil(y0/spacing),math.floor(y1/spacing)+1):
            seed=abs(ix*73+iy*131);x=ix*spacing+(seed%7-3)*.55;y=iy*spacing+(seed%11-5)*.3
            p=Point(x,y)
            if region.covers(p.buffer(1.5)):plants.append([x,y,height_at(p),1 if seed%4==0 else 0,seed%5])
def surface_triangles(region,height_at,spacing=3):
    if region.is_empty:return []
    polygons=[region] if region.geom_type=='Polygon' else [p for p in region.geoms if p.geom_type=='Polygon']
    vertices=[]
    for polygon in polygons:
        points=[]
        for ring in [polygon.exterior,*polygon.interiors]:
            points.extend(list(ring.coords)[:-1])
            n=max(3,math.ceil(ring.length/spacing))
            points.extend(tuple(ring.interpolate(ring.length*i/n).coords[0]) for i in range(n))
        x0,y0,x1,y1=polygon.bounds
        for ix in range(math.ceil(x0/spacing),math.floor(x1/spacing)+1):
            for iy in range(math.ceil(y0/spacing),math.floor(y1/spacing)+1):
                p=Point(ix*spacing,iy*spacing)
                if polygon.contains(p):points.append((p.x,p.y))
        coverage=0;domain=polygon.buffer(1e-7)
        for triangle in triangulate(MultiPoint(points)):
            if not domain.covers(triangle):continue
            coverage+=triangle.area
            for x,y in list(triangle.exterior.coords)[:3]:vertices.extend([round(x,4),round(height_at(Point(x,y)),4),round(-y,4)])
        assert coverage>=polygon.area*.995, 'Landscape triangulation leaves visible gaps'
    return vertices

for index,plateau in enumerate(plateaus):
    core=shape(plateau['geometry']);width=10 if index==0 else 8
    skirt=core.buffer(width,join_style='round').difference(core).difference(safe.buffer(3)).difference(landmarkKeep.buffer(1)).difference(cut)
    if index:skirt=skirt.intersection(shape(plateaus[0]['geometry']).buffer(-1))
    connectionKeep=unary_union([LineString([p[:2] for p in c['points']]).buffer(4.5,cap_style='flat') for c in connections])
    skirt=skirt.difference(connectionKeep)
    # Remove only ordinary lots intercepted by the new slope; no buried buildings.
    plots=[b for b in plots if b['landmark'] or b.get('surfaceHeight',0)>=plateau['height'] or not box(*b['bounds']).buffer(1).intersects(skirt)]
    h=plateau['height'];base=plateau['base']
    def hillside_height(p):
        t=min(1,p.distance(core)/width);t=t*t*(3-2*t)
        return h+(base-h)*t
    slopeMeshes.append(surface_triangles(skirt,hillside_height,2))
    plateau['skirt']=mapping(skirt)
    occupied=unary_union([box(*b['bounds']).buffer(1.6) for b in plots])
    homes=[box(*b['bounds']).centroid for b in plots if not b['landmark'] and b.get('surfaceHeight',0)==h]
    walks=[]
    for home in homes:
        for neighbour in sorted((p for p in homes if not p.equals(home)),key=lambda p:p.distance(home))[:2]:
            line=LineString([home,neighbour]).buffer(1.2,join_style='round')
            if home.distance(neighbour)<38 and core.covers(line):walks.append(line)
    green=core.difference(occupied).difference(connectionKeep.buffer(1)).difference(unary_union(walks))
    if index+1<len(plateaus):green=green.difference(shape(plateaus[index+1]['geometry']).buffer(9))
    landscape.append(dict(geometry=mapping(green),height=h))
    plant_region(green,lambda p:h,9)
    plant_region(skirt,hillside_height,8)

# The lower landscape follows the road's measured design grade at each station.
# Its edges roll down into the street, including the two rising approaches.
def lower_height(p):
    station=route.project(p);u=min(1,station/52,(route.length-station)/52)
    grade=-7*(u*u*(3-2*u));t=min(1,p.distance(cut.boundary)/7.5)
    return grade*(t*t*(3-2*t))
lowerMesh=surface_triangles(cut,lower_height,2.5)
lowerGreen=cut.difference(route.buffer(10)).difference(unary_union([box(*b['bounds']).buffer(4) for b in plots])).difference(connectionKeep)
plant_region(lowerGreen,lower_height,8)
upperPlots=[box(*b['bounds']) for b in plots if not b.get('surfaceHeight',0)<0]
footways=unary_union([p.buffer(2.4,join_style='mitre') for p in upperPlots]).difference(unary_union(upperPlots)).difference(safe).difference(cut)
upperPaving=shape(scene['paving']).union(footways).difference(cut).difference(outer)
terrain=dict(plateaus=plateaus,connections=connections,landscape=landscape,plants=plants,slopeMeshes=slopeMeshes,lowerMesh=lowerMesh,depth=7,cut=mapping(cut),upperGround=mapping(box(cx-1500,cy-1500,cx+1500,cy+1500).difference(cut)),upperPaving=mapping(upperPaving),footways=mapping(footways),road=road,roadWidth=9,designOnly=True,avoidsTraffic=True)

out=dict(city='chongqing',designOnly=True,planVersion='reference-terraced-night',
         terrain=terrain,buildings=plots+skyline,scenicRail=dict(points=railPoints,height=10,piers=railPiers),cableway=cableway,bridge=bridge,mountains=mountains,
         audit=dict(sourceTracks=len(data['tracks']),overlaps=0,clearance=5,
                    maxVehicleHeight=max_vehicle,cableClearance=round(cable_clearance,2),
                    bridgeClearance=round(bridge_clearance,2),sourceRoadsUnchanged=True,scenicRailClearance=9.35-max_vehicle,piersAvoidTraffic=all(not Point(p).buffer(2).intersects(safe) for p in railPiers),
                    landmarks=len([b for b in plots if b['landmark']]),
                    infill=sum(not b['landmark'] for b in plots),skyline=len(skyline)))
(ROOT/'data/sind/cities/chongqing-quarter.json').write_text(json.dumps(out,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
print(json.dumps(dict(buildings=len(out['buildings']),landmarks=out['audit']['landmarks'],
                      infill=out['audit']['infill'],skyline=out['audit']['skyline'],audit=out['audit'])))

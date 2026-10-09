"""Reference-led four wards. All scenery avoids the original roads and actors."""
import json,math
from pathlib import Path
from shapely.geometry import box,shape,LineString,Point,mapping
from shapely.ops import unary_union,nearest_points
from shapely.affinity import rotate,translate
ROOT=Path(__file__).resolve().parents[1]
scene=json.loads((ROOT/'data/sind/cities/xian.json').read_text(encoding='utf-8'))
record=json.loads((ROOT/'data/sind/records/xian.json').read_text(encoding='utf-8'))
cx,cy=scene['center'];angle=.285;c=math.cos(angle);s=math.sin(angle)
occupied=[]
for track in record['tracks']:
    points=[(p[1],p[2]) for p in track['samples']]
    if not points:continue
    radius=.4 if track['type']=='pedestrian' else math.hypot(track['length'],track['width'])/2
    occupied.append((LineString(points) if len(points)>1 else Point(points[0])).buffer(radius+1.5))
safe=unary_union([shape(scene['road']).buffer(3),shape(scene['extension']).buffer(3),*occupied])
wards=[];footprints=[]
for kind,name,sx,sy in [('changle','长乐坊',-1,1),('qujiang','曲江坊',1,1),('pagoda','大雁塔苑',-1,-1),('bell','钟楼里',1,-1)]:
    found=False
    for radius in range(71,106,2):
        x=sx*radius;y=sy*radius
        polygon=translate(rotate(box(x-43,y-43,x+43,y+43),math.degrees(angle),origin=(0,0)),cx,cy)
        if polygon.buffer(3).intersects(safe):continue
        assert not any(polygon.intersects(p) for p in footprints)
        wx=cx+c*x-s*y;wy=cy+s*x+c*y
        wards.append(dict(id='xian-'+kind,kind=kind,name=name,origin=[wx,wy],angle=angle,width=86,depth=86,bounds=list(polygon.bounds),footprint=mapping(polygon),height=34 if kind=='pagoda' else 24,front='south',landmark=True))
        footprints.append(polygon);found=True;break
    assert found,'No protected placement for '+name
baseStreets=unary_union([shape(scene['road']),shape(scene['extension'])])
outerRoads=[]
for axis in scene['extensionAxes']:
    a,b=axis['points'];dx,dy=b[0]-a[0],b[1]-a[1];length=math.hypot(dx,dy);dx/=length;dy/=length
    outerRoads.append(LineString([a,(a[0]+dx*900,a[1]+dy*900)]).buffer(axis['width']/2,cap_style='flat'))
for offset in [-244,-148,148,244]:
    for vertical in [False,True]:
        ends=[(offset,-900),(offset,900)] if vertical else [(-900,offset),(900,offset)]
        outerRoads.append(LineString([(cx+c*x-s*y,cy+s*x+c*y) for x,y in ends]).buffer(3.5,cap_style='flat'))
sceneryRoads=unary_union(outerRoads).difference(safe).difference(baseStreets)
# Main continuations meet the existing endpoints; outer streets stay beyond observation.
mainRoads=unary_union(outerRoads[:len(scene['extensionAxes'])]).difference(baseStreets)
sceneryRoads=unary_union([sceneryRoads,mainRoads])
streets=unary_union([baseStreets,sceneryRoads])
background=[]
rearPlots=[(sx*x,sy*132) for sx in [-1,1] for sy in [-1,1] for x in [48,73,98]]+[(sx*132,sy*78) for sx in [-1,1] for sy in [-1,1]]
rearPlots += [(x,y) for x in range(-330,331,30) for y in range(-270,271,30) if max(abs(x),abs(y))>=170]
for x,y in rearPlots:
        polygon=translate(rotate(box(x-9,y-9,x+9,y+9),math.degrees(angle),origin=(0,0)),cx,cy)
        if polygon.buffer(3).intersects(safe) or polygon.buffer(2).intersects(streets) or any(polygon.intersects(p.buffer(3)) for p in footprints):continue
        background.append(dict(origin=[cx+c*x-s*y,cy+s*x+c*y],angle=angle,width=18,depth=18))
        footprints.append(polygon)
wardShapes=unary_union([shape(w['footprint']) for w in wards])
# Connect the road-facing edges to the existing footways, without raised bases.
aprons=wardShapes.buffer(22,join_style='round').intersection(streets.buffer(30)).difference(wardShapes).difference(streets)
rearShapes=unary_union([translate(rotate(box(-9,-9,9,9),math.degrees(angle),origin=(0,0)),*b['origin']) for b in background])
rearLanes=unary_union([LineString([Point(b['origin']),nearest_points(Point(b['origin']),wardShapes)[1]]).buffer(1.8) for b in background if Point(b['origin']).distance(wardShapes)<25]).difference(safe).difference(wardShapes)
paving=unary_union([streets.buffer(3.5),wardShapes.buffer(4),aprons,rearShapes.buffer(6),rearLanes]).difference(streets)
signalDisplayBindings=[]
for index,app in enumerate(scene['approaches']):
    mid=app['center'];ends=sorted(app['points'],key=lambda p:math.dist(p,scene['center']),reverse=True)
    placed=False
    for end in ends:
        dx,dy=end[0]-mid[0],end[1]-mid[1];length=math.hypot(dx,dy);dx/=length;dy/=length
        for distance in range(2,16):
            p=Point(end[0]+dx*distance,end[1]+dy*distance)
            if p.buffer(.5).intersects(safe) or p.buffer(.5).intersects(wardShapes):continue
            signalDisplayBindings.append(dict(name='进口灯'+str(index+1),position=list(p.coords)[0],stopLineCenter=mid,stateUnbound=True,displayScale=1.3))
            placed=True;break
        if placed:break
assert len(signalDisplayBindings)==4
entries=[]
for ward in wards:
    side=1 if ward['kind'] in ['changle','pagoda'] else -1
    wx,wy=ward['origin'];p=Point(wx+c*side*43,wy+s*side*43)
    q=nearest_points(p,streets)[1];entries.append(LineString([p,q]).buffer(4))
    p=Point(wx+s*42,wy-c*42);q=nearest_points(p,streets)[1]
    entries.append(LineString([p,q]).buffer(4))
free=aprons.difference(safe.buffer(1)).difference(wardShapes.buffer(3)).difference(unary_union(entries))
greenEdges=free.intersection(wardShapes.buffer(8)).difference(wardShapes.buffer(4.5))
assert not greenEdges.intersects(safe)
available=free;furniture=[]
for ix in range(-17,18):
    for iy in range(-17,18):
        x=ix*9;y=iy*9;wx=cx+c*x-s*y;wy=cy+s*x+c*y;p=Point(wx,wy)
        if not available.covers(p.buffer(2.7)):continue
        kind='tree' if (ix+iy)%3==0 else 'planter' if (ix+iy)%2==0 else 'bench'
        furniture.append(dict(origin=[wx,wy],angle=angle,kind=kind))
        available=available.difference(p.buffer(6))
assert len(furniture)>10,'Roadside transition needs visible planting and furniture'
assert all(not Point(f['origin']).buffer(2.7).intersects(safe) for f in furniture)
assert not sceneryRoads.intersection(unary_union(occupied)).area>1e-6
out=dict(city='xian',designOnly=True,planVersion='four-ancient-wards',angle=angle,wards=wards,background=background,paving=mapping(paving),sceneryRoads=mapping(sceneryRoads),greenEdges=mapping(greenEdges),furniture=furniture,signalDisplayBindings=signalDisplayBindings,
         audit=dict(sourceTracks=len(record['tracks']),sourceRoadsUnchanged=True,wardsAvoidTraffic=True,clearance=3))
(ROOT/'data/sind/cities/xian-quarter.json').write_text(json.dumps(out,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
print(json.dumps(dict(wards=[dict(name=w['name'],origin=w['origin']) for w in wards],background=len(background),audit=out['audit']),ensure_ascii=False))

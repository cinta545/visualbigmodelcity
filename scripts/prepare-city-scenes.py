"""Prepare four observation scenes and stop-line crossing events for the visual homepage."""
import csv, json, math, re
from pathlib import Path
import xml.etree.ElementTree as ET
from collections import Counter
from pyproj import Proj
from shapely.geometry import Polygon, LineString, Point, box, mapping
from shapely.ops import unary_union
from shapely.validation import make_valid
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'data/sind/cities';OUT.mkdir(exist_ok=True)
proj=Proj(proj='utm',zone=31,ellps='WGS84',datum='WGS84');origin=proj(0,0)
catalog=[]
def read_map(path):
 root=ET.parse(path).getroot();nodes={}
 for n in root.findall('node'):
  x,y=proj(float(n.attrib['lon']),float(n.attrib['lat']));nodes[n.attrib['id']]=[x-origin[0],y-origin[1]]
 ways=[dict(id=w.attrib['id'],tags={t.attrib['k']:t.attrib['v'] for t in w.findall('tag')},points=[nodes[n.attrib['ref']] for n in w.findall('nd')]) for w in root.findall('way')]
 relations=[dict(id=r.attrib['id'],tags={t.attrib['k']:t.attrib['v'] for t in r.findall('tag')},members=[dict(m.attrib) for m in r.findall('member')]) for r in root.findall('relation')]
 return ways,relations
def polygons(geometry):
 if geometry.geom_type=='Polygon':return [geometry]
 return [g for g in getattr(geometry,'geoms',[]) if g.geom_type=='Polygon']
for city,name in [('tianjin','天津'),('changchun','长春'),('chongqing','重庆'),('xian','西安')]:
 print('Preparing '+city,flush=True)
 if city=='tianjin':
  data=json.loads((ROOT/'data/sind/replay.json').read_text(encoding='utf-8'));ways,relations=data['ways'],data['relations'];signals=data['signals'];signal_labels=['信号组'+str(i) for i in range(1,9)]
  bindings=json.loads((ROOT/'data/sind/scene-baseline.json').read_text())['signalBindings']
 else:
  data=json.loads((ROOT/f'data/sind/records/{city}.json').read_text());folder=ROOT/'data/sind-public/Data'/data['meta']['recording'].split('/')[0]
  ways,relations=read_map(next(folder.glob('*.osm')));bindings=[]
  light_file=next(folder.rglob('*Light*.csv'));signals=[]
  with light_file.open(encoding='utf-8-sig',newline='') as f:
   reader=csv.DictReader(f);cols=[c for c in reader.fieldnames if 'light' in c.lower()];signal_labels=[('行人灯组' if 'Pedestrian' in c else '车辆灯组')+re.findall(r'\d+',c)[0] for c in cols]
   for row in reader:
    if not row['timestamp(ms)'].strip():continue
    signals.append([float(row['timestamp(ms)']),*[int(row[c]) for c in cols]])
  signals.sort(key=lambda r:r[0])
 byid={w['id']:w for w in ways};lanes=[]
 for rel in relations:
  if rel['tags'].get('type')!='lanelet':continue
  refs={m['role']:m['ref'] for m in rel['members'] if m['type']=='way'}
  if not all(k in refs for k in ['left','right']):continue
  a=byid[refs['left']]['points'];b=byid[refs['right']]['points'][:]
  if math.dist(a[0],b[0])>math.dist(a[0],b[-1]):b.reverse()
  lanes+=polygons(make_valid(Polygon(a+b[::-1])))
 road=unary_union(lanes);stops=[w for w in ways if w['tags'].get('type')=='stop_line']
 centers=[[sum(p[i] for p in w['points'])/len(w['points']) for i in [0,1]] for w in stops];center=[sum(p[i] for p in centers)/len(centers) for i in [0,1]]
 approaches=[]
 for stop,c in zip(stops,centers):
  a,b=stop['points'][0],stop['points'][-1];delta=[c[i]-center[i] for i in [0,1]];axis=0 if abs(delta[0])>abs(delta[1]) else 1
  label=(('东侧' if delta[0]>0 else '西侧') if axis==0 else ('北侧' if delta[1]>0 else '南侧'))+'进口'
  approaches.append(dict(id=stop['id'],name=label,points=[a,b],center=c))
 events=[];motor={'car','bus','truck','motorcycle','tricycle'};occupied=[]
 for track in data['tracks']:
  samples=track['samples'];r=.4 if track['type']=='pedestrian' else math.hypot(track['length'],track['width'])/2
  path=LineString([(s[1],s[2]) for s in samples]) if len(samples)>1 else Point(samples[0][1:3]);occupied.append(path.simplify(.2).buffer(r+1.5))
  if track['type'] not in motor:continue
  for approach in approaches:
   a,b=approach['points'];ex,ey=b[0]-a[0],b[1]-a[1];inside=ex*(center[1]-a[1])-ey*(center[0]-a[0])
   if abs(inside)<1e-8:continue
   for prev,cur in zip(samples,samples[1:]):
    if cur[0]-prev[0]>250:continue
    s0=(ex*(prev[2]-a[1])-ey*(prev[1]-a[0]))*math.copysign(1,inside);s1=(ex*(cur[2]-a[1])-ey*(cur[1]-a[0]))*math.copysign(1,inside)
    if not s0<0<=s1:continue
    fraction=-s0/(s1-s0);x=prev[1]+fraction*(cur[1]-prev[1]);y=prev[2]+fraction*(cur[2]-prev[2]);u=((x-a[0])*ex+(y-a[1])*ey)/(ex*ex+ey*ey)
    if 0<=u<=1:
     events.append([prev[0]+fraction*(cur[0]-prev[0]),approach['id'],track['id'],track['type']]);break
 events.sort(key=lambda e:e[0]);safe=unary_union([road.buffer(3),*occupied])
 # Scenic continuation lies outside the surveyed map extent; never adds moving traffic.
 extensions=[];extension_axes=[];bounds=road.bounds
 for app in approaches:
  a,b=app['points'];span=math.dist(a,b);dx,dy=(b[1]-a[1])/span,-(b[0]-a[0])/span
  c=app['center']
  if dx*(c[0]-center[0])+dy*(c[1]-center[1])<0:dx,dy=-dx,-dy
  origin_line=[c[0]+dy*span/2,c[1]-dx*span/2]
  ray=LineString([origin_line,(origin_line[0]+dx*260,origin_line[1]+dy*260)])
  clipped=road.intersection(ray)
  segments=[clipped] if clipped.geom_type=='LineString' else [g for g in getattr(clipped,'geoms',[]) if g.geom_type=='LineString']
  start=max(((p[0]-origin_line[0])*dx+(p[1]-origin_line[1])*dy for g in segments for p in g.coords),default=15)-.5
  width=max(8,span*2)
  ends=[(origin_line[0]+dx*start,origin_line[1]+dy*start),(origin_line[0]+dx*195,origin_line[1]+dy*195)]
  ext=LineString(ends).buffer(width/2,cap_style='flat').difference(road)
  extension_axes.append(dict(points=ends,width=width))
  extensions.append(ext)
 extension=unary_union(extensions);safe=unary_union([safe,extension.buffer(4)])
 buildings=[];candidates=[]
 for gx in range(-5,6):
  for gy in range(-5,6):
   x=center[0]+gx*32;y=center[1]+gy*32;shape=box(x-12,y-10,x+12,y+10)
   if not shape.buffer(5).intersects(safe):candidates.append((math.hypot(x-center[0],y-center[1]),x,y,shape))
 for index,(_,x,y,shape) in enumerate(sorted(candidates)):
  if index>=50:break
  buildings.append(dict(id=f'{city}-{index}',bounds=list(shape.bounds),height=(15+index%4*4) if index<6 else 22+(index*17)%54,kind=['commercial','residential','office'][index%3],front='north' if y<center[1] else 'south',detail=index<6))
 paving=box(center[0]-220,center[1]-220,center[0]+220,center[1]+220).difference(unary_union([road,extension]))
 # Pair nearby zebra boundaries where the map does not provide directional tags.
 zebras=[w['points'] for w in ways if w['tags'].get('type')=='zebra'];crosswalks=[]
 while len(zebras)>1:
  a=zebras.pop(0);ac=[sum(p[k] for p in a)/len(a) for k in [0,1]]
  candidates_z=[(math.dist(ac,[sum(p[k] for p in b)/len(b) for k in [0,1]]),i) for i,b in enumerate(zebras)];distance,j=min(candidates_z)
  if distance>8:continue
  b=zebras.pop(j)
  if math.dist(a[0],b[0])>math.dist(a[0],b[-1]):b=b[::-1]
  crosswalks+=polygons(make_valid(Polygon(a+b[::-1])))
 # Lanelet unions can leave tiny gaps between turning envelopes. Fill those in the
 # display asphalt only; retain gaps that have mapped curb or barrier geometry.
 physical=[LineString(w['points']) for w in ways if w['tags'].get('type') in {'curbstone','guard_rail'} and len(w['points'])>1]
 rendered=[]
 for polygon in polygons(road):
  holes=[]
  for ring in polygon.interiors:
   gap=Polygon(ring)
   if gap.area>65 or any(gap.buffer(.25).intersects(line) for line in physical):holes.append(ring.coords)
  rendered.append(Polygon(polygon.exterior.coords,holes))
 render_road=unary_union(rendered)
 config=dict(city=city,name=name,recording=data['meta']['recording'],center=center,durationMs=data['meta']['durationMs'],ways=ways,road=mapping(road),roadSurface=mapping(render_road),extension=mapping(extension),extensionAxes=extension_axes,paving=mapping(paving),buildings=buildings,approaches=approaches,flowEvents=events,signalLabels=signal_labels,signals=signals,signalBindings=bindings,crosswalks=[mapping(p) for p in crosswalks],notes={'scenery':'designed surroundings; only core roads and moving actors are observed','surface':'small uncurbed lanelet gaps filled only in display asphalt; original road retained','flow':'inward stop-line center crossings; once per track per approach; motor classes only','missingInitialSignals':'unknown until first timestamped event','clearance':'all designed building footprints plus 5m avoid conservative observed swept envelopes'})
 (OUT/f'{city}.json').write_text(json.dumps(config,separators=(',',':'),ensure_ascii=False),encoding='utf-8')
 catalog.append(dict(id=city,name=name,scene=f'/data/sind/cities/{city}.json',tracks='/data/sind/replay.json' if city=='tianjin' else f'/data/sind/records/{city}.json',durationMs=config['durationMs'],buildings=len(buildings),flowEvents=len(events)))
 print(json.dumps(catalog[-1],ensure_ascii=True),flush=True)
(OUT/'catalog.json').write_text(json.dumps(catalog,ensure_ascii=False,indent=2),encoding='utf-8')

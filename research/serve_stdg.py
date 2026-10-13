"""Local read-only inference service, request inputs are causal source IDs/times."""
import json,time,hashlib,threading
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
from urllib.parse import urlparse
import numpy as np
import torch
from stdg_lstm import ROOT,CONFIG,C,Scene,STDGLSTM,tensor_input,resample

torch.set_num_threads(4)
device='cuda' if torch.cuda.is_available() else 'cpu'
checkpoint=torch.load(ROOT/'models/stdg-lstm/checkpoint.pt',map_location=device,weights_only=True)
if checkpoint['config']!=CONFIG:raise RuntimeError('Checkpoint configuration mismatch')
model=STDGLSTM().to(device);model.load_state_dict(checkpoint['state_dict']);model.eval()
scenes={};scene_lock=threading.Lock();lock=threading.Lock();cache={}

def load_scene(city):
    if city not in ['tianjin','changchun','chongqing','xian']:raise ValueError('未知城市')
    with scene_lock:
        if city not in scenes:
            path=ROOT/('data/sind/replay.json' if city=='tianjin' else f'data/sind/records/{city}.json')
            scenes[city]=Scene(json.loads(path.read_text(encoding='utf8')))
        return scenes[city]

def infer(city,ident,requested):
    scene=load_scene(city)
    if ident not in scene.tracks:raise ValueError('未知车辆编号')
    features=scene.input(ident,requested);anchor=features['anchorMs'];key=(city,ident,anchor)
    if key in cache:return cache[key]
    began=time.perf_counter()
    with lock,torch.no_grad():
        output=model(*tensor_input([features],device));means,scales,rho,logits=[t[0].cpu().numpy() for t in output]
    probabilities=np.exp(logits-logits.max());probabilities/=probabilities.sum()
    seed=int.from_bytes(hashlib.sha256(f'{city}/{ident}/{anchor}'.encode()).digest()[:4],'little')
    particles,estimate=resample(means,scales,rho,probabilities,seed)
    def world(local):return local@features['rotation']+features['origin']
    origin=features['origin'];points=[[anchor,float(origin[0]),float(origin[1])]]+[[anchor+(i+1)*100,*map(float,p)] for i,p in enumerate(world(estimate))]
    modes=[]
    for k in np.argsort(-probabilities):modes.append(dict(probability=float(probabilities[k]),points=[[anchor,*map(float,origin)]]+[[anchor+(i+1)*100,*map(float,p)] for i,p in enumerate(world(means[k]))]))
    result=dict(model='stdg-lstm',anchorMs=anchor,horizonSeconds=5,points=points,modes=modes,neighbors=len(features['ids'])-1,particleCount=C['particles'],inferenceMs=(time.perf_counter()-began)*1000,scope='SinD trained research model; does not reproduce paper NGSIM metrics',epoch=checkpoint['epoch'])
    if len(cache)>256:cache.clear()
    cache[key]=result;return result

class Handler(BaseHTTPRequestHandler):
    def respond(self,status,data):
        payload=json.dumps(data,allow_nan=False).encode();self.send_response(status);self.send_header('Content-Type','application/json; charset=utf-8');self.send_header('Content-Length',str(len(payload)));self.end_headers();self.wfile.write(payload)
    def do_GET(self):self.respond(200,dict(status='ready',model=CONFIG['version'],epoch=checkpoint['epoch']))
    def do_POST(self):
        try:
            size=int(self.headers.get('Content-Length','0'))
            if not 0<size<=4096:raise ValueError('请求大小无效')
            q=json.loads(self.rfile.read(size));result=infer(q['city'],q['trackId'],float(q['timeMs']));self.respond(200,result)
        except (KeyError,ValueError) as e:self.respond(422,dict(reason=str(e)))
        except Exception as e:self.respond(500,dict(reason='模型推理失败'));print(type(e).__name__,str(e),flush=True)
    def log_message(self,*args):pass

if __name__=='__main__':
    print('STDG-LSTM inference ready at 127.0.0.1:4174',flush=True)
    ThreadingHTTPServer(('127.0.0.1',4174),Handler).serve_forever()

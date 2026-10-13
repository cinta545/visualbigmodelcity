"""Independent STDG-LSTM implementation. Choices absent from paper are in config.json."""
import json, math
from pathlib import Path
import numpy as np
import torch
from torch import nn
from torch.nn import functional as F

ROOT=Path(__file__).resolve().parents[1]
CONFIG=json.loads((ROOT/'models/stdg-lstm/config.json').read_text(encoding='utf8'))
P=CONFIG['paper']; C=CONFIG['implementationChoices']
MOTOR={'car','bus','truck','motorcycle','tricycle'}

def records():
    return {city:json.loads((ROOT/('data/sind/replay.json' if city=='tianjin' else f'data/sind/records/{city}.json')).read_text(encoding='utf8')) for city in ['tianjin','changchun','chongqing','xian']}

def sample(rows, times, cutoff):
    """Interpolation confined to observations already available at the anchor."""
    rows=rows[rows[:,0]<=cutoff]
    out=np.zeros((len(times),6),dtype=np.float32); valid=np.zeros(len(times),dtype=bool)
    if not len(rows):return out,valid
    indices=np.searchsorted(rows[:,0],times,side='left')
    for k,(t,i) in enumerate(zip(times,indices)):
        if i<len(rows) and abs(rows[i,0]-t)<1e-4:out[k]=rows[i,:6];valid[k]=True
        elif 0<i<len(rows) and rows[i,0]-rows[i-1,0]<=250:
            u=(t-rows[i-1,0])/(rows[i,0]-rows[i-1,0]);out[k]=rows[i-1,:6]*(1-u)+rows[i,:6]*u
            out[k,5]=rows[i-1,5]+u*math.atan2(math.sin(rows[i,5]-rows[i-1,5]),math.cos(rows[i,5]-rows[i-1,5]));valid[k]=True
    return out,valid

class Scene:
    def __init__(self,data):
        self.data=data;self.tracks={t['id']:(t,np.asarray(t['samples'],dtype=np.float64)) for t in data['tracks']}
        # 100 ms buckets keep neighborhood lookup local to a timestamp.
        self.buckets={}
        for ident,(t,rows) in self.tracks.items():
            for r in rows:
                self.buckets.setdefault(int(round(r[0]/100)),[]).append((float(r[0]),ident))
    def input(self,ident,time):
        track,rows=self.tracks[ident]; i=np.searchsorted(rows[:,0],time,side='right')-1
        if i<0 or time-rows[i,0]>250 or track['type'] not in MOTOR:raise ValueError('当前没有新近机动车观测')
        a=rows[i];anchor=float(a[0]);times=anchor+np.arange(-30,1)*100
        ego,valid=sample(rows,times,anchor)
        if not valid.all():raise ValueError('论文模型需要完整连续的三秒历史')
        theta=float(a[5]);co,si=math.cos(theta),math.sin(theta);rotation=np.array([[co,si],[-si,co]],dtype=np.float32)
        active=set()
        for bucket in range(int(anchor/100)-2,int(anchor/100)+2):
            active.update(key for timestamp,key in self.buckets.get(bucket,[]) if anchor-150<=timestamp<=anchor)
        candidates=[]
        for other in active:
            if other==ident:continue
            ot,rr=self.tracks[other];j=np.searchsorted(rr[:,0],anchor,side='right')-1
            if j<0 or anchor-rr[j,0]>150:continue
            delta=rotation@(rr[j,1:3]-a[1:3]);distance=np.linalg.norm(delta)
            if distance<=C['associationMeters'] or 0<delta[0]<=C['dependencyForwardMeters'] and abs(delta[1])<=C['dependencyLateralMeters']:
                candidates.append((distance,other))
        ids=[ident]+[v for _,v in sorted(candidates)[:C['neighbors']]]
        states=np.zeros((C['neighbors']+1,31,7),np.float32);mask=np.zeros((C['neighbors']+1,31),np.float32)
        edges=np.zeros((C['neighbors']+1,31,7),np.float32)
        for slot,key in enumerate(ids):
            rr=self.tracks[key][1];h,v=sample(rr,times,anchor)
            pos=(h[:,1:3]-a[1:3])@rotation.T;vel=h[:,3:5]@rotation.T
            acc=np.zeros_like(vel);acc[1:]=(vel[1:]-vel[:-1])/.1;acc[1:][~(v[1:]&v[:-1])]=0
            heading=np.arctan2(np.sin(h[:,5]-theta),np.cos(h[:,5]-theta))
            states[slot]=np.column_stack([pos/50,vel/20,acc/10,heading/math.pi])*v[:,None];mask[slot]=v
            if slot:
                relative=(h[:,1:3]-ego[:,1:3])@rotation.T;relative_v=(h[:,3:5]-ego[:,3:5])@rotation.T
                association=(np.linalg.norm(relative,axis=1)<=C['associationMeters'])&v
                dependency=(relative[:,0]>0)&(relative[:,0]<=C['dependencyForwardMeters'])&(np.abs(relative[:,1])<=C['dependencyLateralMeters'])&v
                present=association|dependency;created=present&~np.r_[False,present[:-1]];removed=~present&np.r_[False,present[:-1]]
                edges[slot]=np.column_stack([relative/50,relative_v/20,dependency,association,created.astype(float)-removed.astype(float)])
                mask[slot]*=present
        # Ego-local grid: rows longitudinal, columns lateral, same frame as state.
        cell=np.zeros((C['neighbors']+1,2),np.int64)
        cell[:,0]=np.clip(np.floor(states[:,-1,0]*50/C['cellMeters']+C['gridLongitudinalCells']//2),0,C['gridLongitudinalCells']-1)
        cell[:,1]=np.clip(np.floor(states[:,-1,1]*50/C['cellMeters']+C['gridLateralCells']//2),0,C['gridLateralCells']-1)
        return dict(states=states,mask=mask,edges=edges,cell=cell,velocity=(rotation@a[3:5]).astype(np.float32),anchorMs=anchor,origin=a[1:3].copy(),rotation=rotation,ids=ids)

class DeformConv(nn.Module):
    """3x3 deformable convolution, bilinear sampling and learned offsets."""
    def __init__(self,channels,out):
        super().__init__();self.offset=nn.Conv2d(channels,18,3,padding=1);nn.init.zeros_(self.offset.weight);nn.init.zeros_(self.offset.bias)
        self.weight=nn.Parameter(torch.randn(out,channels,9)*math.sqrt(2/(channels*9)));self.bias=nn.Parameter(torch.zeros(out))
    def forward(self,x):
        b,c,h,w=x.shape;offset=self.offset(x).reshape(b,9,2,h,w)
        yy,xx=torch.meshgrid(torch.arange(h,device=x.device),torch.arange(w,device=x.device),indexing='ij');samples=[]
        for k,(dy,dx) in enumerate([(y,x) for y in [-1,0,1] for x in [-1,0,1]]):
            grid=torch.stack([(xx+dx+offset[:,k,0])*2/(w-1)-1,(yy+dy+offset[:,k,1])*2/(h-1)-1],-1)
            samples.append(F.grid_sample(x,grid,align_corners=True,padding_mode='zeros'))
        return torch.einsum('bckhw,ock->bohw',torch.stack(samples,2),self.weight)+self.bias[None,:,None,None]

class STDGLSTM(nn.Module):
    def __init__(self):
        super().__init__();self.embedding=nn.Linear(7,C['embedding']);self.encoder=nn.LSTM(C['embedding'],P['encoderHidden'],batch_first=True)
        self.edge_gate=nn.Sequential(nn.Linear(7,32),nn.ReLU(),nn.Linear(32,1),nn.Sigmoid())
        self.deform=DeformConv(64,32);self.longitudinal=nn.Conv2d(32,16,(3,1),padding=(1,0));self.pool=nn.MaxPool2d((1,2))
        self.social=nn.Linear(16*C['gridLongitudinalCells']*(C['gridLateralCells']//2),64)
        self.mode_embedding=nn.Embedding(C['modes'],16);self.mode_logits=nn.Linear(128,C['modes']);self.initial=nn.Linear(128,128)
        self.decoder=nn.LSTMCell(128+16+2,128);self.gaussian=nn.Linear(128,5)
        nn.init.zeros_(self.gaussian.weight);nn.init.zeros_(self.gaussian.bias)
    def forward(self,states,mask,edges,cell,velocity):
        b,n,t,_=states.shape;embedded=F.relu(self.embedding(states)).reshape(b*n,t,-1)
        encoded,_=self.encoder(embedded);encoded=encoded.reshape(b,n,t,64)
        # Preserve edge creation/removal order through an edge-history aggregate,
        # while the current mask removes departed neighbors from the spatial grid.
        gates=self.edge_gate(edges).squeeze(-1);weights=(gates*mask).sum(2)/mask.sum(2).clamp_min(1)
        neighbor=encoded[:,:,-1]*weights[:,:,None]*mask[:,:,-1,None];neighbor=neighbor.clone();neighbor[:,0]=0
        h,w=C['gridLongitudinalCells'],C['gridLateralCells'];grid=states.new_zeros((b,64,h*w));idx=(cell[:,:,0]*w+cell[:,:,1])[:,None,:].expand(-1,64,-1)
        grid.scatter_add_(2,idx,neighbor.transpose(1,2));grid=grid.reshape(b,64,h,w)
        social=F.relu(self.social(self.pool(F.relu(self.longitudinal(F.relu(self.deform(grid))))).flatten(1)))
        context=torch.cat([encoded[:,0,-1],social],1);logits=self.mode_logits(context)
        k=C['modes'];context=context[:,None].expand(-1,k,-1).reshape(b*k,-1)
        mode=self.mode_embedding(torch.arange(k,device=states.device))[None].expand(b,-1,-1).reshape(b*k,-1)
        hidden=torch.tanh(self.initial(context));memory=torch.zeros_like(hidden);position=states.new_zeros((b*k,2));base=velocity[:,None].expand(-1,k,-1).reshape(b*k,2)*.1
        means=[];scales=[];rhos=[]
        for step in range(50):
            hidden,memory=self.decoder(torch.cat([context,mode,position/50],1),(hidden,memory));g=self.gaussian(hidden)
            position=position+base+g[:,:2]*.1;means.append(position.reshape(b,k,2));scales.append((F.softplus(g[:,2:4])+.05).reshape(b,k,2)*math.sqrt((step+1)*.1));rhos.append((torch.tanh(g[:,4])*.95).reshape(b,k))
        return torch.stack(means,2),torch.stack(scales,2),torch.stack(rhos,2),logits

def likelihood(means,scales,rho,truth):
    d=(truth[:,None]-means)/scales;one=(1-rho.square()).clamp_min(1e-5)
    return -.5*(d[...,0].square()+d[...,1].square()-2*rho*d[...,0]*d[...,1])/one-torch.log(scales).sum(-1)-.5*torch.log(one)-math.log(2*math.pi)

def objective(output,truth):
    means,scales,rho,logits=output
    position=(means-truth[:,None]).square().sum(-1).mean(-1).min(-1).values.mean()
    smooth=(means[:,:,2:]-2*means[:,:,1:-1]+means[:,:,:-2]).square().mean()
    nll=-torch.logsumexp(F.log_softmax(logits,-1)[:,:,None]+likelihood(means,scales,rho,truth),dim=1).mean()
    return position+C['smoothWeight']*smooth+C['nllWeight']*nll

def tensor_input(batch,device):
    return [torch.as_tensor(np.stack([b[key] for b in batch]),device=device) for key in ['states','mask','edges','cell','velocity']]

def resample(means,scales,rho,probabilities,seed):
    """Prior -> transition likelihood -> weighted estimate -> systematic resampling.
    Resample at every step, with neither ESS threshold nor rejuvenation noise.
    Gaussian proposal draws are distinct from post-resampling perturbations.
    """
    rng=np.random.default_rng(seed);m=C['particles'];k=len(probabilities);mode=rng.choice(k,m,p=probabilities)
    particles=np.zeros((m,50,2));weights=np.full(m,1/m);estimates=[]
    for t in range(50):
        z=rng.standard_normal((m,2));mu=means[mode,t];sd=scales[mode,t]/math.sqrt(t+1);r=rho[mode,t]
        delta=mu if t==0 else mu-means[mode,t-1]
        proposals=delta+sd*np.column_stack([z[:,0],r*z[:,0]+np.sqrt(1-r*r)*z[:,1]])
        particles[:,t]=(0 if t==0 else particles[:,t-1])+proposals
        residual=(particles[:,t]-mu)/scales[mode,t];one=1-r*r
        logw=-.5*(residual[:,0]**2+residual[:,1]**2-2*r*residual[:,0]*residual[:,1])/one-np.log(sd).sum(1)-.5*np.log(one)
        logw+=np.log(np.maximum(weights,1e-300));weights=np.exp(logw-logw.max());weights/=weights.sum()
        estimates.append((particles[:,t]*weights[:,None]).sum(0))
        points=(rng.random()+np.arange(m))/m;indices=np.searchsorted(np.cumsum(weights),points).clip(max=m-1)
        particles=particles[indices].copy();mode=mode[indices];weights.fill(1/m)
    return particles,np.asarray(estimates)

import json,random,time,hashlib
from pathlib import Path
import numpy as np
import torch
from stdg_lstm import ROOT,CONFIG,P,C,MOTOR,Scene,records,sample,STDGLSTM,objective,tensor_input,resample

def prepare():
    rng=np.random.default_rng(C['seed']);sets={s:[] for s in ['train','validation','test']};counts={}
    for city,data in records().items():
        scene=Scene(data);duration=data['meta']['durationMs'];boundaries=[0,duration*.7,duration*.8,duration];counts[city]={}
        for ident,(track,rows) in scene.tracks.items():
            if track['type'] not in MOTOR:continue
            for anchor in np.arange(rows[0,0]+3000,rows[-1,0]-5000, C['windowStrideSeconds']*1000):
                actual=rows[np.searchsorted(rows[:,0],anchor,side='right')-1,0]
                split=next((name for i,name in enumerate(sets) if actual-3000>=boundaries[i] and actual+5250<=boundaries[i+1]),None)
                if split is None:continue
                future,v=sample(rows,actual+np.arange(1,51)*100,actual+5250)
                if not v.all():continue
                try:item=scene.input(ident,actual)
                except ValueError:continue
                truth=(future[:,1:3]-item['origin'])@item['rotation'].T
                item['truth']=truth.astype(np.float32);item['city']=city;item['id']=ident;item['splitBounds']=boundaries[list(sets).index(split):list(sets).index(split)+2]
                sets[split].append(item);counts[city][split]=counts[city].get(split,0)+1
        print('prepared',city,counts[city],flush=True)
    limits={'train':C['maxTrainingWindows'],'validation':C['maxValidationWindows'],'test':C['maxTestWindows']}
    for name,items in sets.items():
        rng.shuffle(items);sets[name]=items[:limits[name]]
        if not sets[name]:raise RuntimeError('No eligible '+name+' windows; cannot train or claim evaluation')
    return sets,counts

def evaluate(model,items,device,particles=False):
    values=[];model.eval()
    with torch.no_grad():
        for start in range(0,len(items),64):
            batch=items[start:start+64];truth=torch.tensor(np.stack([b['truth'] for b in batch]),device=device)
            means,scales,rho,logits=model(*tensor_input(batch,device));prob=logits.softmax(-1)
            estimate=(means*prob[:,:,None,None]).sum(1);error=(estimate-truth).norm(dim=-1)
            cv=torch.arange(1,51,device=device)[None,:,None]*.1*torch.tensor(np.stack([b['velocity'] for b in batch]),device=device)[:,None]
            baseline=(cv-truth).norm(dim=-1);mode_error=(means-truth[:,None]).norm(dim=-1)
            raw=[v.detach().cpu().numpy() for v in [means,scales,rho,prob]] if particles else None
            for i,b in enumerate(batch):
                row=dict(city=b['city'],motion='moving' if np.linalg.norm(b['velocity'])>=.5 else 'stationary',ade=float(error[i].mean()),fde=float(error[i,-1]),cvADE=float(baseline[i].mean()),cvFDE=float(baseline[i,-1]),minADE=float(mode_error[i].mean(-1).min()),horizonSquared=[float(error[i,t-1]**2) for t in [10,20,30,40,50]])
                if particles:
                    seed=int.from_bytes(hashlib.sha256(f"{b['city']}/{b['id']}/{b['anchorMs']}".encode()).digest()[:4],'little')
                    _,estimate=resample(*(v[i] for v in raw),seed);errors=np.linalg.norm(estimate-b['truth'],axis=1)
                    row['particleADE']=float(errors.mean());row['particleFDE']=float(errors[-1])
                values.append(row)
    def summary(rows):return dict(windows=len(rows),ADE=float(np.mean([r['ade'] for r in rows])),FDE=float(np.mean([r['fde'] for r in rows])),CV_ADE=float(np.mean([r['cvADE'] for r in rows])),CV_FDE=float(np.mean([r['cvFDE'] for r in rows])),minADE=float(np.mean([r['minADE'] for r in rows])),RMSE=np.sqrt(np.mean([r['horizonSquared'] for r in rows],axis=0)).tolist())
    result=dict(overall=summary(values),cities={city:summary([r for r in values if r['city']==city]) for city in sorted(set(r['city'] for r in values))},motion={kind:summary([r for r in values if r['motion']==kind]) for kind in ['moving','stationary'] if any(r['motion']==kind for r in values)})
    if particles:result['deployedParticleEstimate']=dict(ADE=float(np.mean([r['particleADE'] for r in values])),FDE=float(np.mean([r['particleFDE'] for r in values])))
    return result

def main():
    torch.set_num_threads(4);torch.manual_seed(C['seed']);np.random.seed(C['seed']);random.seed(C['seed'])
    device='cuda' if torch.cuda.is_available() else 'cpu';folder=ROOT/'models/stdg-lstm';folder.mkdir(exist_ok=True)
    began=time.time();sets,counts=prepare();model=STDGLSTM().to(device);optimizer=torch.optim.Adam(model.parameters(),lr=P['learningRate']);best=float('inf');stale=0;history=[]
    for epoch in range(C['epochs']):
        model.train();random.shuffle(sets['train']);losses=[]
        for start in range(0,len(sets['train']),P['batchSize']):
            batch=sets['train'][start:start+P['batchSize']];truth=torch.tensor(np.stack([b['truth'] for b in batch]),device=device)
            optimizer.zero_grad();output=model(*tensor_input(batch,device));loss=objective(output,truth)
            if not torch.isfinite(loss):raise RuntimeError('Non-finite training loss')
            loss.backward();torch.nn.utils.clip_grad_norm_(model.parameters(),5);optimizer.step();losses.append(float(loss.detach()))
        validation=evaluate(model,sets['validation'],device);ade=validation['overall']['ADE'];history.append(dict(epoch=epoch+1,loss=float(np.mean(losses)),validation=validation['overall']))
        print(json.dumps(history[-1]),flush=True)
        if ade<best:
            best=ade;stale=0;torch.save(dict(state_dict=model.state_dict(),config=CONFIG,epoch=epoch+1),folder/'checkpoint.pt')
        else:stale+=1
        (folder/'training-progress.json').write_text(json.dumps(history,indent=2),encoding='utf8')
        if stale>=C['patience']:break
    checkpoint=torch.load(folder/'checkpoint.pt',map_location=device,weights_only=True);model.load_state_dict(checkpoint['state_dict'])
    report=dict(config=CONFIG,device=device,bestEpoch=checkpoint['epoch'],eligibleCounts=counts,splits={s:len(v) for s,v in sets.items()},seconds=time.time()-began,validation=evaluate(model,sets['validation'],device,True),test=evaluate(model,sets['test'],device,True),history=history,metricDefinition='Probability-weighted decoder means, deployed resampled estimates, and minADE reported separately. Test accessed only after validation selection.',sources={city:hashlib.sha256((ROOT/('data/sind/replay.json' if city=='tianjin' else f'data/sind/records/{city}.json')).read_bytes()).hexdigest() for city in counts})
    report['checkpointSHA256']=hashlib.sha256((folder/'checkpoint.pt').read_bytes()).hexdigest()
    report['runtime']=dict(torch=torch.__version__,numpy=np.__version__,cuda=torch.version.cuda,deviceName=torch.cuda.get_device_name(0) if device=='cuda' else 'CPU')
    (folder/'report.json').write_text(json.dumps(report,indent=2),encoding='utf8');print(json.dumps(dict(test=report['test'],bestEpoch=checkpoint['epoch'],seconds=report['seconds'])),flush=True)

if __name__=='__main__':main()

import unittest,copy
import numpy as np
import torch
from stdg_lstm import Scene,STDGLSTM,tensor_input,objective,resample,C

def source():
    tracks=[]
    for ident,y in [('ego',0),('neighbor',2)]:
        tracks.append(dict(id=ident,type='car',samples=[[i*100,i*.5,y,5,0,0] for i in range(91)]))
    return dict(tracks=tracks)

class Tests(unittest.TestCase):
    def test_causality_and_frame(self):
        original=source();changed=copy.deepcopy(original)
        for t in changed['tracks']:
            for s in t['samples']:
                if s[0]>4000:s[1:]=[999,999,999,999,3]
        a=Scene(original).input('ego',4000);b=Scene(changed).input('ego',4000)
        for key in ['states','mask','edges','cell','velocity']:np.testing.assert_array_equal(a[key],b[key])
        self.assertEqual(a['anchorMs'],4000);np.testing.assert_array_equal(a['states'][0,-1,:2],[0,0])
        self.assertEqual(len(a['ids']),2)
        with self.assertRaises(ValueError):Scene(original).input('ego',1000)
    def test_departed_neighbor(self):
        d=source();d['tracks'][1]['samples']=d['tracks'][1]['samples'][:20]
        self.assertEqual(Scene(d).input('ego',4000)['ids'],['ego'])
    def test_model_gradients_and_resampling(self):
        torch.set_num_threads(2);torch.manual_seed(4)
        item=Scene(source()).input('ego',4000);model=STDGLSTM();out=model(*tensor_input([item],'cpu'))
        self.assertEqual(tuple(out[0].shape),(1,C['modes'],50,2))
        truth=torch.tensor(np.column_stack([np.arange(1,51)*.5,np.zeros(50)]),dtype=torch.float32)[None]
        loss=objective(out,truth);loss.backward();self.assertTrue(torch.isfinite(loss));self.assertIsNotNone(model.deform.offset.weight.grad)
        means,scales,rho,logits=[v[0].detach().numpy() for v in out];p=np.exp(logits-logits.max());p/=p.sum()
        a=resample(means,scales,rho,p,12);b=resample(means,scales,rho,p,12)
        np.testing.assert_array_equal(a[0],b[0]);self.assertEqual(a[0].shape,(C['particles'],50,2));self.assertTrue(np.isfinite(a[1]).all())

if __name__=='__main__':unittest.main()

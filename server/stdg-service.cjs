const {spawn}=require('node:child_process'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
function createPaperService(root){
 let child=null,ready=null;
 async function ensure(){
  if(!fs.existsSync(path.join(root,'models/stdg-lstm/checkpoint.pt')))throw new Error('论文模型尚未训练，请先运行 python research/train_stdg.py');
  const reportFile=path.join(root,'models/stdg-lstm/report.json');
  if(!fs.existsSync(reportFile))throw new Error('论文模型正在训练或尚未完成验证');
  const report=JSON.parse(fs.readFileSync(reportFile,'utf8')),hash=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'models/stdg-lstm/checkpoint.pt'))).digest('hex');
  if(hash!==report.checkpointSHA256)throw new Error('模型权重与验证报告不一致，请等待训练完成');
  if(ready)return ready;
  ready=(async()=>{
   try{const r=await fetch('http://127.0.0.1:4174/health',{signal:AbortSignal.timeout(800)});if(r.ok&&(await r.json()).model==='stdg-lstm-sind-v1')return;}catch{}
   child=spawn(process.env.STDG_PYTHON||'python',[path.join(root,'research/serve_stdg.py')],{cwd:root,windowsHide:true,stdio:['ignore','ignore','pipe']});
   let failure=null;child.on('error',e=>{failure=e;});child.on('exit',code=>{if(code!==null)failure=new Error('论文模型服务启动失败，请检查 PyTorch 环境');ready=null;});child.stderr.on('data',b=>process.stderr.write(b));
   for(let i=0;i<240;i++){
    if(failure)throw failure;
    try{const r=await fetch('http://127.0.0.1:4174/health',{signal:AbortSignal.timeout(800)});if(r.ok)return;}catch{}
    await new Promise(resolve=>setTimeout(resolve,250));
   }throw new Error('论文模型服务启动超时');
  })().catch(e=>{ready=null;throw e;});return ready;
 }
 return {async predict(body){await ensure();const r=await fetch('http://127.0.0.1:4174/predict',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(30000)});return {status:r.status,body:await r.json()};},close(){child?.kill();}};
}
module.exports={createPaperService};

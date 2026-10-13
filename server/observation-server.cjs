const express=require('express');
const path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
// Real-data entry point. No simulator, SQLite ledger, Socket.IO or writable control API.
function createObservationServer(){
 const app=express();
 const paper=require('./stdg-service.cjs').createPaperService(ROOT);
 app.locals.paperService=paper;
 app.get('/api/prediction/stdg-lstm/report',(req,res)=>res.sendFile(path.join(ROOT,'models/stdg-lstm/report.json')));
 app.post('/api/prediction/stdg-lstm',express.json({limit:'4kb'}),async(req,res)=>{
  const b=req.body;
  if(!b||typeof b.city!=='string'||typeof b.trackId!=='string'||!Number.isFinite(b.timeMs)||b.timeMs<0)return res.status(400).json({reason:'预测请求无效'});
  try{const result=await paper.predict({city:b.city,trackId:b.trackId,timeMs:b.timeMs});res.status(result.status).json(result.body);}
  catch(e){res.status(503).json({reason:e.message});}
 });
 app.get('/api/health',(req,res)=>res.json({status:'ok',mode:'historical-observation',dataset:'SinD'}));
 app.get('/api/dataset',(req,res)=>res.sendFile(path.join(ROOT,'data/sind/audit.json')));
 app.get('/api/scene-baseline',(req,res)=>res.sendFile(path.join(ROOT,'data/sind/scene-baseline.json')));
 for(const file of ['index.html','sind-3d.html','sind.html','analysis.html'])app.get(file==='index.html'?['/','/index.html']:'/'+file,(req,res)=>res.sendFile(path.join(ROOT,file)));
 for(const folder of ['src','assets','data/sind','node_modules/three'])app.use('/'+folder,express.static(path.join(ROOT,folder)));
 app.get('/shared/sind-visual-site.json',(req,res)=>res.sendFile(path.join(ROOT,'shared/sind-visual-site.json')));
 app.use((req,res)=>res.status(404).json({error:'Not part of the real-data application'}));
 return app;
}
if(require.main===module){
 const host=process.env.HOST||'127.0.0.1',port=Number(process.env.PORT||4173);
 const app=createObservationServer(),server=app.listen(port,host,()=>console.log(`SinD observation server: http://${host}:${port}`));
 const close=()=>{app.locals.paperService.close();server.close(()=>process.exit(0));};
 process.once('SIGINT',close);process.once('SIGTERM',close);
}
module.exports={createObservationServer};

const express=require('express');
const path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
// Real-data entry point. No simulator, SQLite ledger, Socket.IO or writable control API.
function createObservationServer(){
 const app=express();
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
 createObservationServer().listen(port,host,()=>console.log(`SinD observation server: http://${host}:${port}`));
}
module.exports={createObservationServer};

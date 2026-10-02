import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {predict,motorTypes,baselineModels} from '../src/sind-prediction.mjs';
import {trajectoryErrors,summarizeErrors,validateRecords,auditRecording} from '../src/sind-research.mjs';
import {gateFeatures,applyGate,trainGate,gateProtocol} from '../src/sind-gate.mjs';
const config=JSON.parse(fs.readFileSync('shared/research-datasets.json')),rows=[],sources=[];
validateRecords(config.records);
if(new Set(config.records.map(r=>r.group)).size!==config.records.length)throw Error('This protocol requires distinct recording groups');
for(const record of config.records){
 const bytes=fs.readFileSync(record.path),data=JSON.parse(bytes),audit=auditRecording(data,record.id);if(audit.errors.length)throw Error('Invalid recording');
 sources.push({...record,sha256:createHash('sha256').update(bytes).digest('hex')});
 for(const track of data.tracks.filter(t=>motorTypes.includes(t.type))){let last=-Infinity;for(const r of track.samples){
  if(r[0]-last<1000)continue;last=r[0];const features=gateFeatures(track,r[0]);if(!features)continue;
  const scores=baselineModels.map(model=>trajectoryErrors(track,predict(track,r[0],model),3));if(scores.some(s=>!s))continue;
  rows.push({recording:record.id,trackId:track.id,type:track.type,anchorMs:r[0],features,errors:scores.map(s=>s.fdeM),scores});
 }}
}
const folds=[],predictions=[];
for(const heldOut of config.records){
 const train=rows.filter(r=>r.recording!==heldOut.id),test=rows.filter(r=>r.recording===heldOut.id);
 if(!train.length||!test.length||train.some(r=>r.recording===heldOut.id))throw Error('Invalid fold');
 const tree=trainGate(train),fixed=trainGate(train,{...gateProtocol,maxDepth:0}).model,chosen=Object.fromEntries(baselineModels.map(m=>[m,0]));
 const evaluated=test.map(r=>{const model=applyGate(tree,r.features);chosen[model]++;predictions.push({recording:r.recording,trackId:r.trackId,anchorMs:r.anchorMs,selectedModel:model,selectedFdeM:r.errors[baselineModels.indexOf(model)],dcaFdeM:r.errors[2]});return {...r,...r.scores[baselineModels.indexOf(model)]};});
 const score=model=>summarizeErrors(test.map(r=>({...r,...r.scores[baselineModels.indexOf(model)]})));
 folds.push({heldOut:heldOut.id,trainingRecords:config.records.filter(r=>r.id!==heldOut.id).map(r=>r.id),trainingAnchors:train.length,testAnchors:test.length,tree,trainingBestFixed:fixed,chosen,gate:summarizeErrors(evaluated),dca:score('dca'),trainingFixed:score(fixed),movingGate:summarizeErrors(evaluated.filter(r=>r.features[0]>=.5)),movingDca:summarizeErrors(test.filter(r=>r.features[0]>=.5).map(r=>({...r,...r.scores[2]})))});
}
const files=['src/sind-gate.mjs','src/sind-prediction.mjs','src/sind-research.mjs','scripts/evaluate-sind-gate.mjs'];
const report={protocol:gateProtocol,sources,codeHashes:Object.fromEntries(files.map(p=>[p,createHash('sha256').update(fs.readFileSync(p)).digest('hex')])),status:'exploratory-leave-recording-out-not-external-test',folds,macroMeanFdeM:{gate:folds.reduce((s,f)=>s+f.gate.fdeM,0)/folds.length,dca:folds.reduce((s,f)=>s+f.dca.fdeM,0)/folds.length},limitations:['Previously explored public records; not pristine test cities.','One record per city, four folds only.','Train labels use future error; inference features are causal.','Risk model and homepage default unchanged.']};
fs.writeFileSync('data/sind/gate-evaluation.json',JSON.stringify(report,null,2));
const columns=['recording','trackId','anchorMs','selectedModel','selectedFdeM','dcaFdeM'];fs.writeFileSync('data/sind/gate-predictions.csv','\uFEFF'+[columns,...predictions.map(r=>columns.map(c=>r[c]))].map(row=>row.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\r\n'));
const format=n=>n.toFixed(3),table=folds.map(f=>`| ${f.heldOut.split('/')[0]} | ${f.testAnchors} | ${format(f.dca.fdeM)} | ${format(f.gate.fdeM)} | ${format(f.gate.fdeM-f.dca.fdeM)} | ${f.trainingBestFixed.toUpperCase()} | ${format(f.trainingFixed.fdeM)} |`).join('\n');
fs.writeFileSync('docs/gating-results.md',`# 第三轮：记录级留一模型选择结果\n\n方法与固定参数见 gating-protocol.md。输入只使用历史状态；每折完整保留一个记录，损失标签和分裂阈值不读取该记录。\n\n## 3 秒 FDE（米，按起点平均）\n\n| 留出记录 | 起点数 | 固定 DCA | 门控 | 门控−DCA | 训练最佳固定 | 其留出误差 |\n| --- | ---: | ---: | ---: | ---: | --- | ---: |\n${table}\n\n各记录等权平均：DCA ${format(report.macroMeanFdeM.dca)} 米，门控 ${format(report.macroMeanFdeM.gate)} 米。它不同于将全部起点混合后的平均。全部折均报告，不因结果差而删除。\n\n## 使用边界\n\n这仍是已探索公开记录的开发期交叉验证，不能称为全新城市独立测试。学习的是四个运动学模型的选择规则，不是多智能体交互轨迹模型，也没有地图或交通灯约束。\n\n完整树、训练记录、选择数量、对象等权、运动分层和 P95 见 data/sind/gate-evaluation.json；每个留出起点的选择及误差见 gate-predictions.csv。首页默认预测和风险算法未改变。\n\n复现：node scripts/evaluate-sind-gate.mjs。\n`);
console.log(JSON.stringify({macro:report.macroMeanFdeM,folds:folds.map(f=>({heldOut:f.heldOut,gate:f.gate.fdeM,dca:f.dca.fdeM,chosen:f.chosen}))}));

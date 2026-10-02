import fs from 'node:fs';
import {predict} from '../src/sind-prediction.mjs';
const r=JSON.parse(fs.readFileSync('data/sind/research-evaluation.json'));
const get=(id,model,dimension='all',value='all')=>r.byRecording[id].find(g=>g.model===model&&g.horizonS===3&&g.dimension===dimension&&g.value===value);
const f=x=>x===null?'—':x.toFixed(3),rows=[];
for(const s of r.sources){const cv=get(s.id,'cv'),ca=get(s.id,'ca'),moving=get(s.id,'cv','motion','moving');rows.push(`| ${s.id.split('/')[0]} | ${cv.n} | ${cv.tracks} | ${f(cv.fdeM)} | ${f(ca.fdeM)} | ${(100*(1-moving.n/cv.n)).toFixed(1)}% |`);}
const cache=new Map(),cases=[];
for(const c of r.worstCases.slice(0,10)){
 if(!cache.has(c.recording))cache.set(c.recording,JSON.parse(fs.readFileSync(r.sources.find(s=>s.id===c.recording).path)));
 const track=cache.get(c.recording).tracks.find(t=>t.id===c.trackId),prediction=predict(track,c.anchorMs,c.model);
 cases.push({...c,accelerationMps2:prediction.acceleration,samples:track.samples.filter(s=>s[0]>=c.anchorMs-1000&&s[0]<=c.anchorMs+3100),prediction:prediction.points});
}
fs.writeFileSync('data/sind/research-failure-cases.json',JSON.stringify({description:'Top 10 model-anchor errors, not unique incidents. Source observations retained, not corrected.',codeHashes:r.codeHashes,cases},null,2));
const paired=r.pairedTrackComparison.map(p=>`| ${p.recording.split('/')[0]} | ${p.tracks} | ${p.caBetterTracks} | ${p.cvBetterTracks} | ${p.tiedTracks} | ${f(p.meanCaMinusCvFdeM)} |`).join('\n');
const strat=[];for(const s of r.sources)for(const [dimension,value,label]of [['motion','moving','起点运动'],['motion','low_speed','起点低速'],['futureMotion','direction_change_15deg','未来净方向变化 ≥15°']]){const cv=get(s.id,'cv',dimension,value),ca=get(s.id,'ca',dimension,value);strat.push(`| ${s.id.split('/')[0]} | ${label} | ${cv.n} | ${f(cv.fdeM)} | ${f(ca.fdeM)} |`);}
const worst=cases.map(c=>`| ${c.recording.split('/')[0]} | ${c.trackId.split('/').at(-1)} | ${(c.anchorMs/1000).toFixed(3)} | ${c.model.toUpperCase()} | ${f(c.fdeM)} | ${f(Math.hypot(...c.accelerationMps2))} |`).join('\n');
fs.writeFileSync('docs/multicity-research-results.md',`# 四城市公开样例：第一轮研究结果

## 数据与问题

对已固定的 CV/CA 基线进行跨记录描述性比较，研究运动状态、类别与方向变化如何影响误差，不训练新模型或随机拆分轨迹。四城各一个公开记录，共 ${r.sources.reduce((n,s)=>n+s.audit.rows,0).toLocaleString('en-US')} 行、${r.sources.reduce((n,s)=>n+s.audit.tracks,0)} 条轨迹；每个记录保持独立 ID 与米制局部坐标。异地地图和灯组未配准到首页。

## 3 秒端点误差

按预测起点平均，单位米；CV/CA 共享每个记录的同一批有效起点。

| 城市记录 | 有效起点 | 有效对象 | CV FDE | CA FDE | 起点低速占比 |
| --- | ---: | ---: | ---: | ---: | ---: |
${rows.join('\n')}

## 分层结果

运动阈值为起点速度 0.5 m/s；方向变化由起点与未来终点的速度方向计算，两端均至少 0.5 m/s。该诊断用未来真值，只用于事后分析，绝不进入预测。净方向变化不等于完整转弯幅度，也不是地图标签。

| 城市记录 | 分层 | 有效起点 | CV FDE m | CA FDE m |
| --- | --- | ---: | ---: | ---: |
${strat.join('\n')}

## 按对象配对比较

每个对象先在相同有效起点求平均 FDE，再比较 CA−CV。负值表示 CA 更低；不是显著性检验。一个路口内参与者存在相关性，这里不提供将每个起点视为独立样本的置信区间。

| 城市记录 | 对象数 | CA 更低 | CV 更低 | 相同 | 对象等权 CA−CV m |
| --- | ---: | ---: | ---: | ---: | ---: |
${paired}

## 大误差片段

| 城市记录 | ID | 起点 s | 模型 | FDE m | 拟合加速度模 m/s² |
| --- | --- | ---: | --- | ---: | ---: |
${worst}

完整前 100 个模型起点在 research-evaluation.json 的 worstCases；前 10 个的输入观测和预测坐标在 research-failure-cases.json。相邻起点可能属于同一参与者，不能当作独立事件。

## 可支持的发现与下一步

1. CA 不是各记录一致优于 CV：长春平均值与对象配对比较都需要重点分析，不能仅报告四城汇总。
2. 重庆样例低速起点占比较高，整体平均误差不能代表其运动参与者预测表现。后续模型比较应同时保留全体、运动分层和对象等权指标。
3. 大幅净方向变化片段的误差高于总体；CA 虽能改善部分片段，仍有大误差。下一轮可预先确定恒转率基线或加速度衰减基线，并在记录级留一设置下比较；不能根据当前四城测试数字反复调参后称为独立性能。
4. 拟合加速度的持续外推可能放大短时速度变化，前 10 个片段应人工核验。不能仅凭误差大判定原始数据错误，也不自动删除困难样本。

当前是每城单记录的探索性研究，城市效应与具体记录效应无法分离。公开样例已经用于探索，后续完整数据应另外固定训练/验证/测试会话，再训练交互模型。风险复核不是事故真值。

## 复现

先运行 npm run sind:public:prepare，再运行 npm run sind:evaluate，最后运行 node scripts/report-sind-multicity.mjs。所有源文件、转换后记录、评估代码的哈希均有清单。行人缺失 yaw 以未用于车辆预测的 0 占位；未修改车辆观测坐标、速度或朝向。
`);
console.log(JSON.stringify({sources:r.sources.length,cases:cases.length,report:'docs/multicity-research-results.md',worstAcceleration:cases[0]?.accelerationMps2}));

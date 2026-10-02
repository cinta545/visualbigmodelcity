import fs from 'node:fs';
import {predict,evaluate,baselineModels} from '../src/sind-prediction.mjs';
const report=JSON.parse(fs.readFileSync('data/sind/research-evaluation.json'));
const pick=(groups,model,dimension='all',value='all')=>groups.find(g=>g.model===model&&g.horizonS===3&&g.dimension===dimension&&g.value===value);
const f=x=>x.toFixed(3),table=(dimension,value)=>report.sources.map(s=>`| ${s.id.split('/')[0]} | ${baselineModels.map(model=>f(pick(report.byRecording[s.id],model,dimension,value).fdeM)).join(' | ')} |`).join('\n');
const all=baselineModels.map(model=>{const g=pick(report.groups,model);return `| ${model.toUpperCase()} | ${f(g.adeM)} | ${f(g.fdeM)} | ${f(g.p95FdeM)} | ${f(g.trackMacroFdeM)} |`;}).join('\n');
const worst=report.worstCases[0],data=JSON.parse(fs.readFileSync(report.sources.find(s=>s.id===worst.recording).path)),track=data.tracks.find(t=>t.id===worst.trackId);
const caseComparison=baselineModels.map(model=>{const forecast=predict(track,worst.anchorMs,model);return {model,forecast,scores:evaluate(track,forecast)};});
fs.writeFileSync('data/sind/four-baselines-case.json',JSON.stringify({trackId:track.id,anchorMs:worst.anchorMs,source:report.sources.find(s=>s.id===worst.recording),protocol:report.baselineProtocol,caseComparison},null,2));
const caseRows=caseComparison.map(c=>`| ${c.model.toUpperCase()} | ${f(c.scores[2].errorM)} | ${c.forecast.turnRateRadS===undefined?'—':f(c.forecast.turnRateRadS)} |`).join('\n');
fs.writeFileSync('docs/four-baselines-results.md',`# 第二轮研究：转向与加速度衰减

协议见 four-baselines-protocol.md。参数在本轮运行前固定，DCA τ=1 s；CTRV 历史低速阈值 0.5 m/s。没有城市专属调参、训练或独立测试声明。

四模型在全部四个记录上共享每个时域的有效起点，3 秒共有 78,640 个起点、2,376 个对象。所有分组继续为 development。输出 972,352 行模型×时域误差明细。

## 3 秒汇总（米）

| 模型 | ADE | FDE | P95 FDE | 对象等权 FDE |
| --- | ---: | ---: | ---: | ---: |
${all}

汇总按预测起点平均，各记录贡献的起点数不同；它不是城市等权平均。

## 分记录 FDE（米）

| 城市样例 | CV | CA | DCA | CTRV |
| --- | ---: | ---: | ---: | ---: |
${table('all','all')}

## 未来净方向变化 ≥15° 分层 FDE（米）

此标签使用未来终点速度，仅用于事后诊断。两端速度均至少 0.5 m/s，不代表地图确认转弯，也不用于选择线上模型。

| 城市样例 | CV | CA | DCA | CTRV |
| --- | ---: | ---: | ---: | ---: |
${table('futureMotion','direction_change_15deg')}

## 反例保留

长春 ${track.id.split('/').at(-1)} 号对象、${(worst.anchorMs/1000).toFixed(3)} 秒起点：

| 模型 | 3 秒 FDE m | 转率 rad/s |
| --- | ---: | ---: |
${caseRows}

完整预测保存在 data/sind/four-baselines-case.json。该片段来自已观察到的 CA 大误差，不是独立检验样本；不能只凭这个例子选择模型。DCA 缓解加速度持续外推，但并未消除大误差。

## 结论边界与后续

1. 本轮 DCA 的四记录总体 FDE 均低于 CV/CA，且总体 P95 与对象等权误差改善。这个结果仅适用于当前公开记录和固定参数。
2. DCA 在大净方向变化层反而不如 CA；抑制加速度可能牺牲曲线运动的表达。因此不能把总体优势当作每个工况的优势。
3. CTRV 在天津、重庆方向变化层更好，但长春、西安该层没有超过 CA；转率估计和速度变化仍需检查。低速时回退 CV 的起点数量已记录在每个 source 的 eligibility.ctrvFallbackAnchors 中，该数以有足够历史的候选起点为分母，不等于每个时域最终有效数量。
4. 下一轮可制定仅用过去状态选择模型的门控方法，并按采集记录留一验证。所有已探索数据应继续视为开发数据；完整数据到达后另行固定外部测试记录。风险指标仍使用 CV 固定包络，没有暗中改用新预测器。

复现：npm run sind:evaluate；node scripts/report-sind-four-baselines.mjs。首页可切换四种模型，离线报告展示四模型对应指标。没有改动原始轨迹，也未删除难例。
`);
console.log(JSON.stringify({report:'docs/four-baselines-results.md',case:caseComparison.map(c=>({model:c.model,fde:c.scores[2].errorM}))}));

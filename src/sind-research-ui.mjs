export function loadResearchReport(){
 const $=id=>document.getElementById(id);
 fetch('/api/prediction/stdg-lstm/report').then(r=>{if(!r.ok)throw Error('训练报告尚未生成');return r.json();}).then(report=>{
  const test=report.test,overall=test.overall,particle=test.deployedParticleEstimate;
  $('research-status').textContent=`四城真实数据 · 第${report.bestEpoch}轮权重 · 三秒历史预测五秒 · ${overall.windows}个测试窗口`;
  const rows=[['粒子加权估计',overall.windows,particle.ADE,particle.FDE],['解码器均值',overall.windows,overall.ADE,overall.FDE]];
  $('research-results').replaceChildren(...rows.map(row=>{const tr=document.createElement('tr');row.forEach((value,i)=>{const td=document.createElement('td');td.textContent=i>1?value.toFixed(3):value;tr.append(td);});return tr;}));
 }).catch(e=>$('research-status').textContent=`训练评估报告不可用：${e.message}`);
}

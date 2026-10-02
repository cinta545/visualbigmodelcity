export function loadResearchReport(){
 const $=id=>document.getElementById(id);let report;
 function render(){
  const motion=$('research-motion').value,weight=$('research-weight').value;
  const groups=$('research-record').value==='all'?report.groups:report.byRecording[$('research-record').value];
  const [dimension,value]=motion.includes(':')?motion.split(':'):motion==='all'?['all','all']:['motion',motion];
  const rows=groups.filter(g=>g.split===$('research-split').value&&g.dimension===dimension&&g.value===value);
  $('research-results').replaceChildren(...rows.map(r=>{const tr=document.createElement('tr');for(const v of [r.model.toUpperCase(),r.horizonS,r.n,r.tracks,weight==='track'?r.trackMacroAdeM:r.adeM,weight==='track'?r.trackMacroFdeM:r.fdeM]){const td=document.createElement('td');td.textContent=v===null?'—':typeof v==='number'&&!Number.isInteger(v)?v.toFixed(3):v;tr.append(td);}return tr;}));
 }
 for(const id of ['research-motion','research-weight','research-split','research-record'])$(id).onchange=()=>report&&render();
 fetch('/data/sind/research-evaluation.json').then(r=>{if(!r.ok)throw Error('报告未生成');return r.json();}).then(r=>{
  report=r;for(const source of r.sources){const option=document.createElement('option');option.value=source.id;option.textContent=({Tianjin:'天津',Changchun:'长春',Chongqing:'重庆',"Xi'an":'西安'})[source.id.split('/')[0]]||'公开记录';$('research-record').append(option);}$('research-status').textContent=`${r.sources.length} 个记录 · ${r.sources.reduce((n,s)=>n+s.audit.tracks,0)} 条轨迹 · ${r.independentSplitConfigured?'已配置分组，尚无训练模型结论':'仅开发样例，未建立独立训练/验证/测试集'}`;
  $('research-split').replaceChildren(...[...new Set(r.sources.map(s=>s.split))].map(split=>{const o=document.createElement('option');o.value=split;o.textContent=({development:'开发样例',train:'训练记录',validation:'验证记录',test:'测试记录'})[split];return o;}));render();
 }).catch(e=>$('research-status').textContent=`评估报告不可用：${e.message}`);
 fetch('/data/sind/gate-evaluation.json').then(r=>{if(!r.ok)throw Error('未生成');return r.json();}).then(r=>{
  $('gate-status').textContent=`开发期记录级留一验证 · ${r.folds.length} 折 · 各记录等权平均 FDE：固定 DCA ${r.macroMeanFdeM.dca.toFixed(3)} m，模型选择 ${r.macroMeanFdeM.gate.toFixed(3)} m`;
  $('gate-results').replaceChildren(...r.folds.map(f=>{const tr=document.createElement('tr');for(const value of [f.heldOut.split('/')[0],f.testAnchors,f.dca.fdeM.toFixed(3),f.gate.fdeM.toFixed(3),(f.gate.fdeM-f.dca.fdeM).toFixed(3)]){const td=document.createElement('td');td.textContent=value;tr.append(td);}return tr;}));
 }).catch(e=>$('gate-status').textContent=`模型选择报告不可用：${e.message}`);
}

const frames={replay:document.getElementById('replay-frame'),workspace:document.getElementById('workspace-frame')};
const buttons=[...document.querySelectorAll('[data-page]')];
let pendingPanel=null;
function openPanel(){
 if(!pendingPanel)return;
 const doc=frames.workspace.contentDocument;
 const button=doc?.querySelector(`[data-target="${pendingPanel}"]`);
 if(!button)return;
 button.click();doc.body.classList.add('analysis-open');pendingPanel=null;
}
frames.workspace.addEventListener('load',openPanel);
function select(page,panel){
 pendingPanel=panel||null;
 if(page==='workspace'&&!frames.workspace.hasAttribute('src'))frames.workspace.src='/workspace.html';
 for(const [name,frame]of Object.entries(frames)){frame.hidden=name!==page;}
 for(const button of buttons){const on=button.dataset.page===page&&(page==='replay'||button.dataset.panel===panel);button.classList.toggle('active',on);button.setAttribute('aria-pressed',String(on));}
 document.getElementById('source').textContent=page==='replay'?'历史观测 · SinD 天津样例':'原功能工作台 · 本地仿真数据（尚未接入 SinD 预测和调度）';
 if(page==='workspace')openPanel();
}
buttons.forEach(button=>button.addEventListener('click',()=>select(button.dataset.page,button.dataset.panel)));

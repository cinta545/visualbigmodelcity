const escapeText=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const seeds=[[173,132,-65,30],[140,122,-102,29],[112,142,-137,31],[180,155,-28,28]],positions=[[278,67,'end'],[151,22,'middle'],[22,67,'start'],[276,178,'end']];
const branches=seeds.map(([x,y,angle,length],idx)=>{
 const lines=[],leaves=[];
 function branch(x,y,angle,length,depth,seed){const rad=angle*Math.PI/180,ex=x+Math.cos(rad)*length,ey=y+Math.sin(rad)*length,cx=(x+ex)/2+Math.sin(rad)*length*.1,cy=(y+ey)/2-Math.cos(rad)*length*.1;
  lines.push(`<path d="M${x} ${y}Q${cx} ${cy} ${ex} ${ey}" fill="none" stroke="currentColor" stroke-width="${Math.max(.3,depth*.18)}" opacity="${.32+depth*.08}"/>`);
  if(depth){branch(ex,ey,angle-19-(seed%5)*1.3,length*.73,depth-1,seed+3);branch(ex,ey,angle+24+(seed%3)*1.7,length*.70,depth-1,seed+7);}else leaves.push([ex,ey]);
 }
 branch(x,y,angle,length,6,idx+2);
 return {paths:`<path d="M150 204C${146+idx*3} 178 ${x-8} ${y+20} ${x} ${y}" fill="none" stroke="currentColor" stroke-width="1.6"/>`+lines.join(''),leaves};
});
// Main branches identify approaches; terminal lights encode recorded passages.
export function trafficTree(rows,selected=null){
 const total=rows.reduce((n,r)=>n+r.value,0);
 return `<svg viewBox="0 0 300 240" role="img" aria-label="各进口近六十秒通过量，共${total}辆"><defs><radialGradient id="traffic-tree-aura"><stop stop-color="#88c3e3" stop-opacity=".14"/><stop offset="1" stop-color="#88c3e3" stop-opacity="0"/></radialGradient></defs><ellipse cx="150" cy="122" rx="113" ry="102" fill="url(#traffic-tree-aura)"/>${rows.map((r,i)=>{const {paths,leaves}=branches[i%4],[x,y,anchor]=positions[i%4];return `<g class="tree-sector${selected===r.id?' chosen':''}" data-approach="${escapeText(r.id)}" style="opacity:${selected!==null&&selected!==r.id ? .23 : 1}">${paths}${Array.from({length:r.value},(_,j)=>{const [lx,ly]=leaves[Math.min(leaves.length-1,Math.floor((j+.5)/Math.max(1,r.value)*leaves.length))];return `<circle class="vehicle-node" cx="${lx}" cy="${ly}" r="1.15" fill="#d1f4ff"/><circle cx="${lx}" cy="${ly}" r="3.5" fill="#94d8f6" opacity=".1"/>`;}).join('')}<text x="${x}" y="${y}" text-anchor="${anchor}" fill="#c5dce7" font-size="9.5">${escapeText(r.label)} · ${r.value}</text></g>`;}).join('')}<path d="M150 204Q134 217 104 222M150 204Q166 217 195 222M150 204V223" stroke="#9fcdde" opacity=".6" fill="none"/><text x="150" y="238" text-anchor="middle" fill="#c5dce7" font-size="10">${total} 辆通过</text></svg>`;
}

// Every scale is explicit; rings show composition, not a safety score.
export const chartColors={primary:'#a0d4e4',secondary:'#4eaebc',muted:'#8cabbc',grid:'#9ed2dc18',text:'#e7f3f6'};
export function ringChart(value,total,label,{unit='',color=chartColors.primary}={}){
 const fraction=Math.max(0,Math.min(1,total>0&&Number.isFinite(Number(value))?Number(value)/total:0)),length=2*Math.PI*32;
 return `<svg viewBox="0 0 100 104" role="img" aria-label="${label} ${value}${unit}"><circle cx="50" cy="42" r="37" fill="none" stroke="${chartColors.grid}"/><circle cx="50" cy="42" r="32" fill="none" stroke="${chartColors.grid}" stroke-width="5"/><circle cx="50" cy="42" r="32" fill="none" stroke="${color}" stroke-width="5" stroke-dasharray="${fraction*length} ${length}" transform="rotate(-90 50 42)"/><text x="50" y="47" text-anchor="middle" fill="${chartColors.text}" font-size="20">${value}</text><text x="50" y="64" text-anchor="middle" fill="${chartColors.muted}" font-size="8">${unit}</text><text x="50" y="99" text-anchor="middle" fill="${chartColors.muted}" font-size="10">${label}</text></svg>`;
}
export function directionChart(rows){
 const max=Math.max(1,...rows.map(r=>r.value));
 return `<svg viewBox="0 0 260 ${rows.length*32+12}" role="img" aria-label="各进口最近六十秒通过量">${rows.map((r,i)=>`<text x="0" y="${i*32+16}" fill="${chartColors.muted}" font-size="10">${r.label}</text><rect x="70" y="${i*32+6}" width="153" height="12" rx="2" fill="${chartColors.grid}"/><rect x="70" y="${i*32+6}" width="${r.value/max*153}" height="12" rx="2" fill="${chartColors.primary}"/><text x="254" y="${i*32+16}" text-anchor="end" fill="${chartColors.text}" font-size="12">${r.value}</text>`).join('')}</svg>`;
}
export function errorChart(scores){
 const max=Math.max(1,...scores.map(s=>s.error)),line=scores.map((s,i)=>`${i?'L':'M'}${20+i*220/Math.max(1,scores.length-1)},${72-s.error/max*54}`).join('');
 return `<svg viewBox="0 0 260 100" role="img" aria-label="已观测后续的预测误差，单位米"><path d="M20 18H240M20 45H240M20 72H240" stroke="${chartColors.grid}" fill="none"/><text x="3" y="21" fill="${chartColors.muted}" font-size="8">${max.toFixed(1)}</text><text x="3" y="76" fill="${chartColors.muted}" font-size="8">0</text><path d="${line}" fill="none" stroke="${chartColors.primary}" stroke-width="1.5"/>${scores.map((s,i)=>`<circle cx="${20+i*220/Math.max(1,scores.length-1)}" cy="${72-s.error/max*54}" r="2.5" fill="${chartColors.primary}"/><text x="${20+i*220/Math.max(1,scores.length-1)}" y="92" text-anchor="middle" fill="${chartColors.muted}" font-size="9">${s.seconds}秒</text>`).join('')}</svg>`;
}

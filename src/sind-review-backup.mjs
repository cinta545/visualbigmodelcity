import {reviewLabels} from './sind-events.mjs';
const canonical=value=>JSON.stringify(value&&typeof value==='object'&&!Array.isArray(value)?Object.fromEntries(Object.keys(value).sort().map(k=>[k,JSON.parse(canonical(value[k]))])):value);
export function makeBackup(manifest,reviews){return {format:'sind-reviews-v1',sourceSha256:manifest.sourceSha256,config:manifest.config,riskConfig:manifest.riskConfig,reviews};}
export function validateBackup(manifest,backup){
 if(backup?.format!=='sind-reviews-v1')throw Error('备份格式不支持；请使用 JSON 复核备份');
 for(const key of ['sourceSha256','config','riskConfig'])if(canonical(backup[key])!==canonical(manifest[key]))throw Error('源数据或方法配置不匹配，未导入');
 if(!backup.reviews||typeof backup.reviews!=='object'||Array.isArray(backup.reviews))throw Error('复核记录格式无效');
 const valid=new Set(manifest.events.map(e=>e.id)),result={};
 for(const [id,r]of Object.entries(backup.reviews)){
  if(!valid.has(id))throw Error('备份包含当前索引中不存在的事件');
  if(!r||!Object.hasOwn(reviewLabels,r.status)||typeof r.note!=='string'||r.note.length>2000)throw Error('状态或备注格式无效');
  result[id]={status:r.status,note:r.note};
 }
 return result;
}
export function mergeReviews(existing,incoming,overwrite=false){
 const result={...existing};let applied=0,skipped=0;
 for(const [id,review]of Object.entries(incoming)){if(Object.hasOwn(existing,id)&&!overwrite){skipped++;continue;}result[id]=review;applied++;}
 return {reviews:result,applied,skipped};
}

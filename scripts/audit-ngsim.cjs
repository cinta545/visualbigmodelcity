const fs=require('node:fs');
const path=require('node:path');
const readline=require('node:readline');
const root=process.argv[2];
if(!root)throw Error('Usage: node scripts/audit-ngsim.cjs <dataset-directory>');
const ranges=['Local_X','Local_Y','Global_Time','Frame_ID','v_Vel','v_Acc','v_Length','v_Width','Mean_Speed','Mean_Accel'];
async function audit(file){
 const result={file,bytes:fs.statSync(file).size,rows:0,malformed:0,nonFinite:0,lanes:{},classes:{},ranges:{},frameSteps:{},timeStepsMs:{},duplicateVehicleFrames:0,backwardFrames:0,backwardLongitudinalSteps:0};
 let fields=file.endsWith('.txt')?'Vehicle_ID,Frame_ID,Total_Frames,Global_Time,Local_X,Local_Y,Global_X,Global_Y,v_Length,v_Width,v_Class,v_Vel,v_Acc,Lane_ID,Preceding,Following,Space_Headway,Time_Headway'.split(','):null;if(fields)result.fields=fields;const tracks=new Map(),frames=new Map(),ids=new Set();
 for await(const line of readline.createInterface({input:fs.createReadStream(file),crlfDelay:Infinity})){
  if(!line.trim())continue;
  if(!fields){fields=line.replace(/^\uFEFF/,'').trim().split(',');result.fields=fields;continue;}
  const a=line.trim().split(file.endsWith('.txt')?/\s+/:',').map(Number);result.rows++;
  if(a.length!==fields.length){result.malformed++;continue;}
  if(a.some(n=>!Number.isFinite(n))){result.nonFinite++;continue;}
  const row=Object.fromEntries(fields.map((f,i)=>[f,a[i]])),id=row.Vehicle_ID,frame=row.Frame_ID;
  ids.add(id);frames.set(frame,(frames.get(frame)||0)+1);
  result.lanes[row.Lane_ID]=(result.lanes[row.Lane_ID]||0)+1;
  const cls=row.v_Class??row.Vehicle_Class_ID;result.classes[cls]=(result.classes[cls]||0)+1;
  for(const key of ranges){if(row[key]===undefined)continue;const r=result.ranges[key]||(result.ranges[key]={min:Infinity,max:-Infinity});r.min=Math.min(r.min,row[key]);r.max=Math.max(r.max,row[key]);}
  let t=tracks.get(id);if(!t){t={last:null,seen:new Set(),rows:0};tracks.set(id,t);}
  if(t.seen.has(frame))result.duplicateVehicleFrames++;t.seen.add(frame);t.rows++;
  if(t.last){const df=frame-t.last.Frame_ID;result.frameSteps[df]=(result.frameSteps[df]||0)+1;if(df<0)result.backwardFrames++;
   if(row.Global_Time!==undefined){const dt=row.Global_Time-t.last.Global_Time;result.timeStepsMs[dt]=(result.timeStepsMs[dt]||0)+1;}
   if(df>0&&row.Local_Y<t.last.Local_Y)result.backwardLongitudinalSteps++;
  }t.last=row;
 }
 result.vehicles=ids.size;result.uniqueFrames=frames.size;result.maxSimultaneousVehicles=Math.max(...frames.values());
 const counts=[...tracks.values()].map(t=>t.rows).sort((a,b)=>a-b);result.trackRows={min:counts[0],median:counts[Math.floor(counts.length/2)],max:counts.at(-1)};
 if(result.ranges.Global_Time){result.firstUtc=new Date(result.ranges.Global_Time.min).toISOString();result.lastUtc=new Date(result.ranges.Global_Time.max).toISOString();result.observedSpanSeconds=(result.ranges.Global_Time.max-result.ranges.Global_Time.min)/1000;}
 return {result,ids};
}
(async()=>{
 const files=[];for(const folder of fs.readdirSync(root)){const dir=path.join(root,folder);if(!fs.statSync(dir).isDirectory())continue;for(const file of fs.readdirSync(dir))if(file.endsWith(process.argv.includes('--txt-only')?'.txt':'.csv'))files.push(path.join(dir,file));}
 const reports=[],originalIds=[];
 for(const file of files){const {result,ids}=await audit(file);reports.push(result);if(path.basename(file).startsWith('trajectories-'))originalIds.push({file,ids});console.log(JSON.stringify(result));}
 const overlaps=[];for(let i=0;i<originalIds.length;i++)for(let j=i+1;j<originalIds.length;j++)overlaps.push({a:originalIds[i].file,b:originalIds[j].file,sharedVehicleIds:[...originalIds[i].ids].filter(id=>originalIds[j].ids.has(id)).length});
 fs.writeFileSync(process.argv.includes('--txt-only')?'docs/ngsim/audit-txt.json':'docs/ngsim/audit.json',JSON.stringify({sourceRoot:root,generatedAt:new Date().toISOString(),reports,vehicleIdOverlapAcrossSessions:overlaps},null,2));console.log(JSON.stringify({vehicleIdOverlapAcrossSessions:overlaps}));
})();

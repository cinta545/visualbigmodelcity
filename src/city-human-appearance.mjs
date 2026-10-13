// Presentation only: IDs choose a stable model, never inferred personal attributes.
export function humanVariantForTrack(id,type='pedestrian'){
 let hash=2166136261;
 for(const ch of String(id)){hash=Math.imul(hash^ch.charCodeAt(0),16777619);}
 hash>>>=0;
 const choice=(hash>>>8)%2;
 if(type!=='pedestrian')return (hash%2)*2+choice;
 const slot=hash%100;
 return (slot<24?0:slot<62?2:slot<86?4:6)+choice;
}

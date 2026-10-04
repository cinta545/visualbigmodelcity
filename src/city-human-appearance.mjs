// Presentation only: IDs choose a stable model, never inferred personal attributes.
export function humanVariantForTrack(id){
 let hash=2166136261;
 for(const ch of String(id)){hash=Math.imul(hash^ch.charCodeAt(0),16777619);}
 return (hash>>>0)%2;
}

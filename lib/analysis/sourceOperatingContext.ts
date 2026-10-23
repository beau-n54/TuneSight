import type {AnalysisSource} from "./analysisSource";
import type {OperatingWindow} from "./sourceInvestigation";
import type {SourceObservationEvent} from "./sourceObservationEvents";

const finite = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);
export function sourceOperatingContext(source: AnalysisSource | null, windows: readonly OperatingWindow[]) {
  const m = source?.state === "available" && source.digest ? source.measurements : null;
  const gear = m?.channels.find(c=>c.key === "gear" && c.unit === "gear")?.values;
  const rpm = m?.channels.find(c=>c.key === "rpm" && c.unit === "rpm")?.values;
  const pedal = m?.channels.find(c=>c.key === "accelerator_pedal" && c.unit === "%")?.values;
  const validGear = (i:number) => Number.isSafeInteger(gear?.[i]) && gear![i]! > 0 ? gear![i]! : null;
  const time = (i:number) => m?.timestamps ? m.timestamps[i]-m.timestamps[0] : null;
  const extent = (startRow:number,endRow:number) => {
    const values = rpm?.slice(startRow,endRow+1).filter(finite) ?? [];
    return {startRow,endRow,startSeconds:time(startRow),endSeconds:time(endRow),rpmMin:values.length?values.reduce((a,b)=>Math.min(a,b)):null,rpmMax:values.length?values.reduce((a,b)=>Math.max(a,b)):null};
  };
  const transitions: (ReturnType<typeof extent> & {id:string;from:number;to:number;label:string})[] = [];
  for(let i=1;i<(m?.sampleCount ?? 0);i++) {
    const from=validGear(i-1),to=validGear(i);
    if(from !== null && to !== null && from !== to) transitions.push({id:`gear:${i-1}:${i}`,...extent(i-1,i),from,to,label:`Recorded gear transition ${from} → ${to}`});
  }
  const runs = windows.map((w,index)=>{
    const segments=[];
    let start=w.startRow;
    for(let i=start+1;i<=w.endRow+1;i++) if(i>w.endRow || validGear(i)!==validGear(start)) {
      segments.push({id:`run:${index}:segment:${start}`,...extent(start,i-1),gear:validGear(start)}); start=i;
    }
    return {id:`run:${w.startRow}:${w.endRow}`,...extent(w.startRow,w.endRow),acceleration:w.loadedAcceleration,segments,
      transitions:transitions.filter(t=>t.startRow>=w.startRow&&t.endRow<=w.endRow)};
  });
  return {runs,transitions,releasedPedalRows:pedal?.flatMap((value,i)=>value===0?[i]:[])??[],gearState:gear?.some(finite)?"Recorded forward gears available; missing/invalid rows remain unknown.":"Gear segmentation unavailable. A validated recorded gear channel is required; RPM fluctuations are not gear evidence."};
}
export type SourceOperatingContext = ReturnType<typeof sourceOperatingContext>;

export function eventOperatingContext(event: SourceObservationEvent, context: SourceOperatingContext) {
  const overlap=(x:{startRow:number;endRow:number})=>x.endRow>=event.startRow&&x.startRow<=event.endRow;
  const runs=context.runs.filter(overlap), transitions=context.transitions.filter(overlap);
  const contained=runs.some(r=>r.acceleration&&event.startRow>=r.startRow&&event.endRow<=r.endRow);
  const released=context.releasedPedalRows.some(i=>i>=event.startRow&&i<=event.endRow);
  return {runs:runs.map(r=>r.id),segments:runs.flatMap(r=>r.segments.filter(overlap)),transitions,
    state:transitions.length?"Includes a recorded gear transition":released?"Includes recorded zero pedal (released demand); throttle state is independent":contained?"Within a measured high-demand acceleration window":runs.length?"Crosses operating-window boundaries":"Outside a qualifying high-demand acceleration window",
    accelerationOnly:contained&&!transitions.length&&!released};
}

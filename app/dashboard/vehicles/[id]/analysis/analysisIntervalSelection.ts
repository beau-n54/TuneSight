import type {TelemetryWorkspacePull} from "./telemetryWorkspacePresentation";

export function parseAnalysisInterval(hash:string, sampleCount:number):TelemetryWorkspacePull|null {
  const match=/^#analysis-interval-(\d+)-(\d+)$/.exec(hash);
  if(!match)return null;
  const startIndex=Number(match[1]),endIndex=Number(match[2]);
  if(!Number.isSafeInteger(startIndex)||!Number.isSafeInteger(endIndex)||startIndex>endIndex||endIndex>=sampleCount)return null;
  return {id:`interval:${startIndex}:${endIndex}`,startIndex,endIndex};
}

/** Clip only the displayed marker geometry; never mutate the owning event. */
export function intervalMarkers<T extends {startIndex?:number;endIndex?:number}>(events:readonly T[], interval:TelemetryWorkspacePull):T[] {
  return events.flatMap(e=>typeof e.startIndex === "number" && typeof e.endIndex === "number" && e.endIndex>=interval.startIndex && e.startIndex<=interval.endIndex
    ? [{...e,startIndex:Math.max(e.startIndex,interval.startIndex),endIndex:Math.min(e.endIndex,interval.endIndex)}] : []);
}

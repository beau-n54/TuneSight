import { sourceOperatingContext, eventOperatingContext } from "./sourceOperatingContext.ts";
import type {AnalysisSource} from "./analysisSource";
import {sourceObservationEvents} from "./sourceObservationEvents.ts";

const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
export type OperatingWindow = {startRow: number; endRow: number; startSeconds: number; endSeconds: number; rpmStart: number; rpmEnd: number; loadedAcceleration: boolean};

/** Measurement segmentation, not a platform fault rule. The existing pull
 * segmenter's 85% demand / two-second criteria are explicit selection criteria.
 * Only the actual pedal channel is used; plate angle is never driver demand. */
export function sourceInvestigation(source: AnalysisSource | null) {
  const m = source?.state === "available" && source.digest ? source.measurements : null;
  const channel = (key: string, unit: string) => m?.channels.find(c => c.key === key && c.unit === unit)?.values;
  const rpm = channel("rpm", "rpm"), pedal = channel("accelerator_pedal", "%"), times = m?.timestamps;
  const windows: OperatingWindow[] = [];
  let start = -1;
  const close = (end: number) => {
    if (start >= 0 && times && rpm && end >= start) windows.push({startRow: start, endRow: end,
      startSeconds: times[start] - times[0], endSeconds: times[end] - times[0], rpmStart: rpm[start]!, rpmEnd: rpm[end]!,
      loadedAcceleration: times[end] - times[start] >= 2 && rpm[end]! > rpm[start]!});
    start = -1;
  };
  if (rpm && pedal && times) for (let i = 0; i < m!.sampleCount; i++) {
    if (finite(rpm[i]) && finite(pedal[i]) && pedal[i]! >= 85) { if (start < 0) start = i; }
    else close(i - 1);
  }
  close((m?.sampleCount ?? 0) - 1);
  const observations = sourceObservationEvents(source);
  const operatingContext = sourceOperatingContext(source, windows);
  const candidates = observations.checks.flatMap(check => {
    if (!check.events.length) return [];
    // Compare like quantities only, never turn degrees/psi into a fault score.
    const ranked = [...check.events].sort((a, b) => b.value - a.value || a.startRow - b.startRow);
    return ranked.map((event, index) => {
      let left = 0, right = windows.length;
      while (left < right) { const mid = (left + right) >>> 1; if (windows[mid].endRow < event.startRow) left = mid + 1; else right = mid; }
      const overlapping: OperatingWindow[] = [];
      for (let i = left; i < windows.length && windows[i].startRow <= event.endRow; i++) overlapping.push(windows[i]);
      const relatedKinds = observations.checks.filter(other => {
        if (other.id === event.kind) return false;
        // Each check emits ordered, non-overlapping intervals. Binary search
        // avoids an all-events squared scan on large subscriber logs.
        let low = 0, high = other.events.length;
        while (low < high) { const mid = (low + high) >>> 1; if (other.events[mid].endRow < event.startRow) low = mid + 1; else high = mid; }
        return low < other.events.length && other.events[low].startRow <= event.endRow;
      }).map(c => c.title);
      const changes = [["rpm", "rpm"], ["accelerator_pedal", "%"], ["boost_target", "psi"]].flatMap(([key, unit]) => {
        const values = channel(key, unit);
        if (!values) return [];
        const rows=values.slice(event.startRow,event.endRow+1).filter(finite);
        if (!rows.length) return [];
        return [`${key}: ${rows[0]} to ${rows.at(-1)} ${unit}; observed range ${rows.reduce((a,b)=>Math.min(a,b))}–${rows.reduce((a,b)=>Math.max(a,b))} ${unit} across source rows ${event.startRow+1}–${event.endRow+1}. Net change ${(rows.at(-1)!-rows[0]).toFixed(3)} ${unit}; significance unqualified; gaps are not interpolated.`];
      });
      return {event, operatingContext: eventOperatingContext(event, operatingContext), rankWithinCheck: index + 1, loadedWindows: overlapping.filter(w => w.loadedAcceleration),
        relatedKinds,
        contextCandidate: changes.length ? {label: "Measured operating context — significance unqualified", evidence: changes,
          conclusion: "Measured interval context only; it does not prove a cause or gear change. Small changes are not promoted to meaningful transitions; recorded gear evidence is assessed separately."} : null,
        alternatives: event.alternatives.map(explanation => ({explanation, state: "open" as const,
          reason: "These channels do not independently distinguish this cause. Coincidence is not causation."})),
        rejectedClaims: ["A specific failed component or active map value cannot be inferred from this observation.", event.withheld],
        note: `${event.evidence} ${overlapping.some(w => w.loadedAcceleration) ? "Overlaps a measured high-demand acceleration window." : "Outside a qualifying high-demand acceleration window; do not interpret as a loaded-pull fault."}`};
    });
  });
  const rpms = rpm?.filter(finite) ?? [];
  return {windows, candidates, observations, operatingContext,
    pullState: !rpm || !pedal || !times ? "blocked" as const : windows.some(w => w.loadedAcceleration) ? "observed" as const : "not_observed" as const,
    operatingRegion: rpms.length ? `${rpms.reduce((a,b)=>Math.min(a,b))}–${rpms.reduce((a,b)=>Math.max(a,b))} rpm over ${times ? (times.at(-1)! - times[0]).toFixed(3) + " seconds" : "source rows; elapsed time unqualified"}.` : "Qualified RPM observations are unavailable.",
    windowCriteria: "High-demand windows require qualified pedal ≥85%, finite RPM and increasing source time. At least two seconds and a net RPM rise qualify an acceleration window. This is a selection heuristic, not proof of road load, gear, WOT, safety or fault severity.",
    windowBlocker: !rpm || !pedal || !times ? "Requires independently qualified RPM, accelerator pedal percentage and source timestamps. Throttle angle is not substituted for pedal." : null,
    ranking: "Inspection candidates are ranked by measured magnitude within each check, then earliest source row. Different units and possible causes are not assigned a shared severity or probability score.",
  };
}
export type SourceInvestigation = ReturnType<typeof sourceInvestigation>;

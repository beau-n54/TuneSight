import type { AnalysisSource } from "./analysisSource";

export type SourceObservationEvent = {
  id: string; kind: string; title: string; grade: "source-derived observation" | "target-relative observation";
  channels: string[]; unit: string; startRow: number; endRow: number; startSeconds: number | null; endSeconds: number | null;
  timing?: {channel:string;minimum:number;maximum:number;onsetRow:number;endRow:number;recovered:boolean;onsetKnown:boolean;startSeconds:number|null;endSeconds:number|null}[];
  simultaneousCylinders?: number;
  value: number; evidence: string; alternatives: string[]; withheld: string; inspection: string;
};
export type ObservationCheck = {id: string; title: string; channels: string[]; state: "observed" | "not_observed" | "unavailable"; reason: string; events: SourceObservationEvent[]};
const finite = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);

/** Source-only calculations. No vehicle-label routing, threshold, causal score,
 * tune inference or persistence capability. Nulls always break an interval. */
export function sourceObservationEvents(source: AnalysisSource | null) {
  const m = source?.state === "available" && source.digest ? source.measurements : null;
  const checks: ObservationCheck[] = [];
  const get = (key: string, unit: string) => m?.channels.find(c => c.key === key && c.unit === unit);
  function check(id: string, title: string, channels: string[], unit: string, values: (number | null)[] | null,
    missing: string, describe: (value: number) => string, alternatives: string[], withheld: string, inspection: string,
    grade: SourceObservationEvent["grade"] = "source-derived observation", preceding = false) {
    if (!values) { checks.push({id, title, channels, state: "unavailable", reason: missing, events: []}); return; }
    const events: SourceObservationEvent[] = [];
    let start = -1, peak = 0;
    const close = (end: number) => {
      if (start < 0) return;
      const first = preceding ? start - 1 : start;
      events.push({id: `${id}:${first}:${end}`, kind: id, title, grade, channels, unit, startRow: first, endRow: end,
        startSeconds: m?.timestamps ? m.timestamps[first] - m.timestamps[0] : null,
        endSeconds: m?.timestamps ? m.timestamps[end] - m.timestamps[0] : null,
        value: peak, evidence: describe(peak), alternatives, withheld, inspection});
      start = -1; peak = 0;
    };
    values.forEach((value, i) => {
      if (finite(value) && value > 0) { if (start < 0) start = i; peak = preceding ? peak + value : Math.max(peak, value); }
      else close(i - 1);
    });
    close(values.length - 1);
    checks.push({id, title, channels, state: events.length ? "observed" : "not_observed",
      reason: events.length ? `${events.length} contiguous source interval(s). No fault tolerance or severity threshold is implied.`
        : "No matching observation in the supplied finite rows. This is not an all-systems health confirmation.", events});
  }
  const boost = get("boost", "psi"), target = get("boost_target", "psi");
  const manifold = get("manifold_gauge_pressure", "psig"), manifoldTarget = get("manifold_gauge_target", "psig");
  if (manifold || manifoldTarget) for (const direction of [1,-1]) {
    check(`manifold-${direction>0?"above":"below"}-target`, `Manifold gauge pressure ${direction>0?"above":"below"} logged manifold target`, ["manifold_gauge_pressure","manifold_gauge_target"], "psig",
      manifold && manifoldTarget ? manifold.values.map((v,i)=>finite(v)&&finite(manifoldTarget.values[i])?(v-manifoldTarget.values[i]!)*direction:null):null,
      "Requires both explicit manifold gauge pressure and manifold gauge target at matching source rows; other pressure locations/references are not substituted.",
      v=>`Largest same-row manifold gauge difference: ${v.toFixed(2)} psig. Both headers explicitly identify manifold gauge pressure.`,
      ["Transient tracking", "Operating-state transition"], "No calibrated tolerance, severity or causal conclusion is established.", "Inspect the linked interval with recorded gear, pedal and RPM before attributing significance.", "target-relative observation");
  }
  for (const [id, title, direction] of [["actual-above-target", "Boost actual above logged target", 1], ["actual-below-target", "Boost actual below logged target", -1]] as const) {
    check(id, title, ["boost", "boost_target"], "psi", boost && target ? boost.values.map((a, i) => finite(a) && finite(target.values[i]) ? (a - target.values[i]!) * direction : null) : null,
      "Requires both actual boost and logged target in qualified psi at matching source rows.",
      v => `Largest same-row difference in this interval: ${v.toFixed(2)} psi ${direction > 0 ? "above" : "below"} the logged target.`,
      ["Transient tracking response", "Different sensor or target measurement locations", "A command or operating-state transition"],
      "Fault significance, calibrated tolerance and cause require matched pressure locations, operating context and applicable rule evidence.",
      "Inspect actual and target at these exact rows with RPM, pedal, throttle and WGDC. A difference alone is not overboost or hardware failure.", "target-relative observation");
  }
  for (const [key, title, unit, direction] of [
    ["rail_pressure", "Measured rail-pressure decline", "psi", -1], ["lpfp", "Measured low-pressure fuel decline", "psi", -1],
    ["iat", "Measured intake-temperature rise", "°C", 1],
  ] as const) {
    const c = get(key, unit);
    check(key, title, [key], unit, c ? c.values.map((v, i) => i > 0 && finite(v) && finite(c.values[i - 1]) ? (v - c.values[i - 1]!) * direction : null) : null,
      `Requires finite adjacent ${key} observations in ${unit}; gaps cannot be bridged.`,
      v => `Net interval ${direction < 0 ? "decrease" : "increase"}: ${v.toFixed(2)} ${unit}. This is a measured change, not a limit violation.`,
      direction < 0 ? ["Commanded pressure reduction", "Changing engine demand", "Sensor or logging variation"] : ["Changing load or airflow", "Thermal conditions", "Sensor or logging variation"],
      "No applicable limit or commanded target establishes a fault or its cause.",
      "Inspect the source interval and surrounding command/load channels before attributing a cause.", "source-derived observation", true);
  }
  const pedal = get("accelerator_pedal", "%"), plate = get("throttle", "%");
  check("pedal-plate", "Pedal and throttle percentage difference", ["accelerator_pedal", "throttle"], "percentage points",
    pedal && plate ? pedal.values.map((p, i) => finite(p) && finite(plate.values[i]) ? Math.abs(p - plate.values[i]!) : null) : null,
    "Requires separately identified pedal and throttle-plate percentage channels at matching rows.",
    v => `Largest same-row numerical difference: ${v.toFixed(2)} percentage points. Pedal is driver demand, not commanded throttle angle.`,
    ["Normal nonlinear pedal-to-torque mapping", "Torque management", "Operating-state transition"],
    "This does not establish commanded-versus-observed error or unwanted throttle closure.",
    "Compare with an independently identified throttle command before diagnosing response.");
  const cylinders = m?.channels.filter(c => /^timing_correction_cyl_\d+$/.test(c.key) && c.unit === "°") ?? [];
  check("cylinder-spread", "Cylinder-relative timing-correction spread", cylinders.map(c => c.key), "°",
    cylinders.length > 1 ? Array.from({length: m!.sampleCount}, (_, i) => {
      const row = cylinders.map(c => c.values[i]); return row.every(finite) ? Math.max(...row) - Math.min(...row) : null;
    }) : null, "Requires at least two identified timing-correction channels with finite values at the same source rows.",
    v => `Largest simultaneous spread across supplied cylinders: ${v.toFixed(2)}°. Missing cylinders are not inferred.`,
    ["Cylinder-specific correction behaviour", "Operating-state variation", "Logging resolution"],
    "Spread alone does not establish knock, ignition hardware failure or a calibrated severity.",
    "Compare each supplied cylinder over the same interval; inspect fuel and operating evidence before a causal conclusion.");
  check("timing-correction", "Signed cylinder timing-correction activity", cylinders.map(c=>c.key), "°",
    cylinders.length ? Array.from({length:m!.sampleCount},(_,i)=>{
      const values=cylinders.map(c=>c.values[i]);
      // A known cylinder remains observable when another is missing. Individual
      // cylinder episodes below break at their own gaps; no value is filled.
      const known=values.filter(finite);
      return known.length ? Math.max(...known.map(Math.abs)) : null;
    }) : null, "Requires explicitly identified timing-correction channels in degrees. Actual ignition timing is a separate quantity.",
    v=>`Largest absolute correction magnitude: ${v.toFixed(2)}°. Signed per-cylinder values are retained below; equal corrections remain visible even with zero spread.`,
    ["Operating-state correction", "Fuel and thermal context", "Controller strategy"],
    "Correction alone does not diagnose knock, poor fuel or hardware failure. No qualified severity limit is applied.",
    "Inspect signed cylinder traces, recovery and operating context; corroborate with measured fuel and controller evidence.");
  for(const e of checks.find(c=>c.id === "timing-correction")?.events ?? []) {
    e.timing=cylinders.flatMap(c=>{
      const episodes: NonNullable<SourceObservationEvent["timing"]> = [];
      let start=-1;
      const close=(end:number)=>{if(start<0)return;const values=c.values.slice(start,end+1).filter(finite);episodes.push({channel:c.key,minimum:values.reduce((a,b)=>Math.min(a,b)),maximum:values.reduce((a,b)=>Math.max(a,b)),onsetRow:start,endRow:end,recovered:c.values[end+1]===0,onsetKnown:start>0&&c.values[start-1]===0,startSeconds:m?.timestamps?m.timestamps[start]-m.timestamps[0]:null,endSeconds:m?.timestamps?m.timestamps[end]-m.timestamps[0]:null});start=-1;};
      for(let i=e.startRow;i<=e.endRow;i++) {if(finite(c.values[i])&&c.values[i]!==0){if(start<0)start=i;}else close(i-1);}
      close(e.endRow); return episodes;
    });
    e.simultaneousCylinders=Array.from({length:e.endRow-e.startRow+1},(_,i)=>cylinders.filter(c=>finite(c.values[e.startRow+i])&&c.values[e.startRow+i]!==0).length).reduce((a,b)=>Math.max(a,b),0);
  }
  const events = checks.flatMap(c => c.events).sort((a, b) => a.startRow - b.startRow || a.id.localeCompare(b.id));
  // Rank within a single unit/rule only. Unlike quantities are never scored together.
  const primary = checks.flatMap(c => [...c.events].sort((a, b) => b.value - a.value || a.startRow - b.startRow).slice(0, 1));
  return {checks, events, primary, cylinders: cylinders.map(c => c.key),
    summary: m ? `${events.length} source-derived event intervals across ${checks.filter(c => c.events.length).length} checks; ${checks.filter(c => c.state === "unavailable").length} checks need additional channels. Observations do not establish a fault or severity.`
      : source?.finding ?? "Select an owned log to inspect source evidence.",
    ranking: "One representative per check, selected by largest measured magnitude then earliest row. Different units are not ranked against one another; no causal confidence score is assigned."};
}
export type SourceObservationAnalysis = ReturnType<typeof sourceObservationEvents>;

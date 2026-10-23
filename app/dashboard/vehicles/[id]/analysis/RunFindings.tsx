import type {AnalysisSource} from "@/lib/analysis/analysisSource";
import type {SourceInvestigation} from "@/lib/analysis/sourceInvestigation";
import {analysisChannelStatus} from "@/lib/analysis/analysisChannelStatus";
import {eventOperatingContext} from "@/lib/analysis/sourceOperatingContext";
import {EvidenceDisclosure} from "./SourceInspectionDetails";
import {CopyEvidence} from "./CopyEvidence";

const n=(v:number|null)=>v===null?"unavailable":v.toLocaleString("en",{maximumFractionDigits:3});
const link=(start:number,end:number)=>`#analysis-interval-${start}-${end}`;
const panel="bmw-border min-w-0 rounded-2xl bg-slate-950 p-4 sm:p-6 space-y-4";

export function RunOverview({source, investigation, logName, vehicleName, declarations}: {source:AnalysisSource|null;investigation:SourceInvestigation;logName:string;vehicleName:string;declarations:readonly string[]}) {
  const m=source?.state === "available" && source.digest?source.measurements:null;
  if (!m) return <section className={panel}><h3 className="text-xl font-semibold text-sky-100">{logName}</h3><p>{vehicleName}</p><p>Source measurements have not been established. Sample counts, run intervals and channel availability are unknown.</p></section>;
  const channelStatus=analysisChannelStatus(source,{identity:null,reason:"No table lookup in overview",relationships:[],withheld:[],href:null,resolutionPath:null,sourceId:null});
  const blockers=[...new Set(m?.blockers??[source?.finding??"Select an owned log."])];
  return <section className={panel}>
    <h3 className="text-xl font-semibold text-sky-100">{logName}</h3><p>{vehicleName}</p>
    <p>{m?.sampleCount??0} source samples · {m?.timestamps?n(m.timestamps.at(-1)!-m.timestamps[0])+" s":"elapsed time unavailable"} · {investigation.windows.filter(w=>w.loadedAcceleration).length} measured high-demand acceleration run(s).</p>
    <p className="text-sm text-zinc-300">Owner-declared context: {declarations.length?declarations.join(" · "):"Fuel and modifications not declared in the available vehicle record."} These declarations are not measured fuel composition or verified installed hardware.</p>
    <p className="text-sm text-zinc-300">{investigation.observations.events.length} distinct source-observation intervals; {investigation.observations.checks.filter(c=>c.state === "unavailable").length} checks need additional evidence. Repeated links do not create new findings. No unavailable check is an all-clear.</p>
    <a className="inline-block text-sky-300 underline focus-visible:outline-2" href="#primary-engineering-results">Inspect contextual findings and their chart intervals</a>
    <EvidenceDisclosure title={`Data-quality limitations — ${blockers.length} distinct reasons`}><ul className="space-y-2">{blockers.map(b=><li key={b}>{b}</li>)}</ul>
      <p>To enable blocked checks, provide a logger export with an exact supported header, explicit units and finite samples. Original source columns and bytes remain unchanged.</p>
      <h4 className="font-semibold">Present in source; interpretation unavailable</h4>
      <ul>{m?.headerEvidence?.unassigned.map(h=><li key={h}>{h} — present but mapping or units unverified. Not used for comparisons, gear assignment or diagnosis.</li>)}</ul>
      <h4 className="font-semibold">Source-column availability</h4><ul>{channelStatus.columns.map(c=><li key={c.header}>{c.header}: {c.state.replaceAll("_"," ")}</li>)}</ul>
      <p>Throttle angle is not throttle percentage; ignition timing is not correction. A declared engine label does not establish cylinder applicability. Optional unobserved cylinder channels are not assumed installed.</p>
    </EvidenceDisclosure>
    <p className="text-xs text-zinc-400">Source-derived additions are response-only. Older persisted results retain their original lineage; this view does not rewrite stored evidence or create an Analysis snapshot.</p>
  </section>;
}

export function RunTimeline({investigation}:{investigation:SourceInvestigation}) {
  const context=investigation.operatingContext;
  return <section className={panel} aria-label="Run and gear timeline"><h3 className="text-lg font-semibold text-sky-100">Run and gear timeline</h3>
    <p>{context.gearState}</p><p className="text-sm text-zinc-400">High demand is a measured pedal selection, not proof of open throttle, full load or a fault. A recorded gear transition lies between its two source samples; its exact instant is unknown.</p>
    {!context.runs.length&&<p>{investigation.windowBlocker??"No qualifying demand interval captured."}</p>}
    {context.runs.map((run,i)=><article key={run.id} className="rounded-xl bg-blue-950/30 p-4 space-y-3">
      <h4 className="font-semibold">Run {i+1}: {n(run.startSeconds)}–{n(run.endSeconds)} s · {n(run.rpmMin)}–{n(run.rpmMax)} rpm</h4>
      <p>{run.acceleration?"Net RPM rise over the existing high-demand duration criterion":"Demand interval; acceleration qualification not met"} · <a className="text-sky-300 underline" href={link(run.startRow,run.endRow)}>View run in linked charts</a></p>
      <ul className="grid gap-2 sm:grid-cols-2">{run.segments.map(segment=><li key={segment.id} className="rounded-lg bg-black/30 p-3">
        <strong>{segment.gear===null?"Gear unknown":`Recorded gear ${segment.gear}`}</strong>: {n(segment.startSeconds)}–{n(segment.endSeconds)} s; {n(segment.rpmMin)}–{n(segment.rpmMax)} rpm.
        <a className="ml-2 text-sky-300 underline" href={link(segment.startRow,segment.endRow)}>Inspect segment</a>
      </li>)}</ul>
      {run.transitions.map(t=><p key={t.id}>{t.label}: {n(t.startSeconds)}–{n(t.endSeconds)} s. <a className="text-sky-300 underline" href={link(t.startRow,t.endRow)}>Inspect transition</a></p>)}
    </article>)}
    <EvidenceDisclosure title="Run selection and source boundaries"><p>{investigation.windowCriteria}</p><p>No gap is filled and no gear is inferred from RPM. A missing pedal/RPM sample splits a demand run; missing gear splits only the gear evidence.</p></EvidenceDisclosure>
  </section>;
}

export function ContextualFindings({investigation}:{investigation:SourceInvestigation}) {
  const groups=investigation.observations.checks.filter(c=>c.events.length).map(check=>{
    const events=check.events.map(event=>({event,context:eventOperatingContext(event,investigation.operatingContext)}));
    return {check,events,acceleration:events.filter(e=>e.context.accelerationOnly).length};
  }).sort((a,b)=>Number(b.acceleration>0)-Number(a.acceleration>0));
  return <section className={panel} data-analysis-section="Canonical findings"><h3 className="text-lg font-semibold text-sky-100">Contextual findings — measured observations</h3>
    <p className="text-sm text-zinc-300">Families with intervals wholly inside a measured acceleration window appear first; transitions and other operating states remain explicit. This is an inspection reading order, not severity, causation or fault probability. No whole-log peak is promoted to an acceleration diagnosis.</p>
    {!groups.length&&<p>No qualifying observation captured. Check unavailable inputs below; this is not a health confirmation.</p>}
    {groups.map(({check,events,acceleration})=><article key={check.id} id={`finding-${check.id}`} className="scroll-mt-24 space-y-3 rounded-xl bg-blue-950/20 p-4">
      <h4 className="text-base font-semibold text-blue-100">{check.title}</h4>
      <p>{events.length} distinct occurrence(s) · {acceleration} within acceleration only · {events.length-acceleration} transitional, mixed or other context.</p>
      <p className="text-sm text-zinc-300">{events[0].event.withheld}</p>
      <p className="text-sm">Next check: {events[0].event.inspection}</p>
      <EvidenceDisclosure title={`Measurements and linked telemetry — ${events.length} occurrences`}>
        <ol className="space-y-4">{events.map(({event,context})=><li key={event.id} id={`occurrence-${event.id}`} data-finding-id={event.id} className="rounded-lg bg-black/30 p-3 space-y-2">
          <p className="font-medium text-sky-200">{n(event.startSeconds)}–{n(event.endSeconds)} s · {event.startSeconds!==null&&event.endSeconds!==null?n(event.endSeconds-event.startSeconds)+" s duration":"duration unavailable"} · {context.state}</p>
          <p>{event.evidence}</p><p>Channels: {event.channels.join(", ")}.</p>
          <p>Recorded gears: {[...new Set(context.segments.map(s=>s.gear??"unknown"))].join(", ")||"unavailable"}. Transitions: {context.transitions.map(t=>`${t.from} → ${t.to}`).join(", ")||"none established"}.</p>
          {event.timing&&<><p>Maximum simultaneous active cylinders: {event.simultaneousCylinders}. Magnitude and sign are independent of cylinder spread.</p><ul>{event.timing.map((t,i)=><li key={i}>{t.channel}: {n(t.minimum)} to {n(t.maximum)}°; {n(t.startSeconds)}–{n(t.endSeconds)} s ({t.startSeconds!==null&&t.endSeconds!==null?n(t.endSeconds-t.startSeconds):"unavailable"} s duration); rows {t.onsetRow+1}–{t.endRow+1}; {t.onsetKnown?"onset after recorded zero":"onset boundary unknown"}; {t.recovered?"recovery to zero observed":"recovery not established"}.</li>)}</ul></>}
          <a className="inline-block rounded-md border border-blue-700 px-3 py-2 text-sky-200 hover:bg-blue-950 focus-visible:outline-2 focus-visible:outline-sky-300" href={link(event.startRow,event.endRow)}>Show this interval in all telemetry panels</a>
          <EvidenceDisclosure title="Exact source evidence and unresolved alternatives"><p>Source rows {event.startRow+1}–{event.endRow+1}; stable finding {event.id}; grade: {event.grade}.</p><p>Alternatives still open: {event.alternatives.join("; ")}. None is excluded by these measurements alone.</p><p>{event.withheld}</p><CopyEvidence text={JSON.stringify(event,null,2)}/></EvidenceDisclosure>
        </li>)}</ol>
      </EvidenceDisclosure>
    </article>)}
  </section>;
}

export function NextChecks({investigation}:{investigation:SourceInvestigation}) {
  return <section className={panel}><h3 className="text-lg font-semibold text-sky-100">Next checks and unresolved questions</h3>
    <ul className="space-y-3">{investigation.observations.checks.map(c=><li key={c.id}>{c.state==="unavailable"?<><strong>{c.title}: </strong>{c.reason}</>:c.events.length?<a className="text-sky-300 underline" href={`#finding-${c.id}`}>{c.title}: review grouped measurements and next checks</a>:<>{c.title}: no matching observation; not a clean bill of health</>}</li>)}</ul>
    <p className="text-sm text-zinc-400">Pressure declines alone do not prove a supply problem. Corroborate with compatible commanded targets and measurement locations. Owner fuel/setup declarations require independent evidence before a causal conclusion.</p>
  </section>;
}

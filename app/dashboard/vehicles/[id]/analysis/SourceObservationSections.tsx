import type {SourceObservationAnalysis, SourceObservationEvent} from "@/lib/analysis/sourceObservationEvents";

function Evidence({event}: {event: SourceObservationEvent}) {
  return <div className="min-w-0 space-y-2 rounded-xl border border-zinc-700 bg-black/20 p-4">
    <p className="font-semibold">{event.title}</p>
    <p className="text-xs text-sky-300">{event.grade}</p>
    <p>{event.evidence}</p>
    <p className="text-sm text-zinc-400">Source rows {event.startRow + 1}–{event.endRow + 1}
      {event.startSeconds !== null && event.endSeconds !== null ? `; elapsed ${event.startSeconds.toFixed(2)}–${event.endSeconds.toFixed(2)} s` : "; elapsed time unavailable"}.</p>
    <details><summary className="cursor-pointer text-sky-300">Supplied evidence, alternatives and selection limits</summary>
      <div className="mt-2 space-y-2 text-sm">
        <p>Channels: {event.channels.join(", ")}.</p>
        <p>Alternatives still open: {event.alternatives.join("; ")}. The log alone does not exclude these explanations.</p>
        <p>Withheld conclusion: {event.withheld}</p>
        <p>Inspection: {event.inspection}</p>
      </div>
    </details>
  </div>;
}
export function ObservationPrimary({analysis}: {analysis: SourceObservationAnalysis}) {
  return <section className="bmw-border min-w-0 rounded-2xl bg-zinc-900 p-5" data-analysis-section="Source-derived engineering results">
    <h2 className="text-lg font-semibold">Primary Engineering Results — source-derived observations</h2>
    <p className="my-3 text-sm text-zinc-300">{analysis.summary}</p>
    <p className="mb-3 text-xs text-zinc-400">{analysis.ranking}</p>
    <div className="grid min-w-0 gap-3 lg:grid-cols-2">{analysis.primary.map(event => <Evidence key={event.id} event={event}/>)}</div>
    {!analysis.primary.length && <p>No event established by the supplied channel pairs. Individual checks below explain missing evidence.</p>}
  </section>;
}
export function ObservationChecks({analysis}: {analysis: SourceObservationAnalysis}) {
  return <div className="space-y-3" data-analysis-section="Event observations and individual blockers">
    <p>{analysis.summary}</p>
    {analysis.checks.map(check => <details key={check.id} className="rounded-xl border border-zinc-700 p-3">
      <summary className="cursor-pointer font-medium">{check.title} — {check.state === "unavailable" ? "additional evidence needed" : `${check.events.length} observed intervals`}</summary>
      <p className="my-2 text-sm">{check.reason}</p>
      <div className="space-y-2">{check.events.slice(0, 50).map(event => <Evidence key={event.id} event={event}/>)}</div>
      {check.events.length > 50 && <p>First 50 intervals displayed; all {check.events.length} intervals contribute to the count and representative selection. Use the original log for the full row sequence.</p>}
    </details>)}
  </div>;
}
export function ObservationWarnings({analysis}: {analysis: SourceObservationAnalysis}) {
  return <div className="space-y-2" data-analysis-section="Evidence-derived warnings">
    <p>Observed changes to inspect—not platform fault thresholds:</p>
    <ul className="list-disc space-y-1 pl-5">{analysis.primary.map(event => <li key={event.id}>{event.title}: {event.evidence}</li>)}</ul>
    {!analysis.primary.length && <p>No change established by the available checks; missing inputs remain explicitly unavailable.</p>}
    <p className="text-sm text-zinc-400">Sensor locations, commanded responses and applicable limits are required before attributing a cause or warning severity.</p>
  </div>;
}

import type {SourceObservationAnalysis, SourceObservationEvent} from "@/lib/analysis/sourceObservationEvents";

function Evidence({event}: {event: SourceObservationEvent}) {
  return <a className="block rounded-lg px-3 py-2 text-sky-300 underline focus-visible:outline-2" href={`#occurrence-${event.id}`}>{event.title} — rows {event.startRow+1}–{event.endRow+1}; view the canonical observation and its chart link.</a>;
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
    <ul className="list-disc space-y-1 pl-5">{analysis.primary.map(event => <li key={event.id}><a className="text-sky-300 underline" href={`#finding-${event.kind}`}>{event.title}: inspect the canonical finding</a></li>)}</ul>
    {!analysis.primary.length && <p>No change established by the available checks; missing inputs remain explicitly unavailable.</p>}
    <p className="text-sm text-zinc-400">Sensor locations, commanded responses and applicable limits are required before attributing a cause or warning severity.</p>
  </div>;
}

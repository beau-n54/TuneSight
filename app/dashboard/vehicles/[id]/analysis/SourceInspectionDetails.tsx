import type {SourceInspectionCrossReferences} from "@/lib/analysis/sourceInspectionCrossReferences";

export function SourceInspectionDetails({model}: {model: SourceInspectionCrossReferences}) {
  return <section className="space-y-4" aria-label="Source-derived evidence scoring and inspection relationships">
    <h3 className="text-lg font-semibold">Source-derived Evidence Score / Investigation Priority</h3>
    <p className="text-sm text-zinc-300">Points rank measured support for inspection within this selected log. These explicit heuristic weights are not fault severity, safety risk, component failure probability or platform-qualified diagnostic confidence. Diagnostic confidence is retained separately and is never added to these points. Table availability contributes zero points.</p>
    <p className="text-sm text-zinc-400">Zero starting prior; sum the contributions below, bounded to 0–95 points. Highest score ranks first; ties use earliest source row, then family identifier. Coincidence between different event families does not prove agreement or causation and earns no bonus.</p>
    {model.families.length === 0 && <p>No source-derived event is available to score.</p>}
    <ol className="space-y-3">{model.families.map(f => <li key={f.kind} className="rounded-xl border border-zinc-700 p-4">
      <h4 className="font-semibold">#{f.rank} {f.title} — {f.score.toFixed(2)} / 95 points</h4>
      <p className="text-sm text-zinc-300">{f.events.length} interval(s); peak {f.peak.toFixed(2)} {f.unit}; {f.gapToLeader.toFixed(2)} points behind the leading inspection family.</p>
      {f.unavailable && <p className="text-sm text-zinc-400">{f.unavailable}</p>}
      <details className="mt-2"><summary className="cursor-pointer">Points, reductions and source intervals</summary>
        <ul className="mt-2 space-y-2 text-sm">{f.factors.map(p => <li key={p.label}><strong>{p.points >= 0 ? "+" : ""}{p.points.toFixed(2)}: {p.label}.</strong> {p.explanation}</li>)}</ul>
        <ul className="mt-3 max-h-80 overflow-y-auto text-sm">{f.events.map(e => <li key={e.id}>Source rows {e.startRow + 1}–{e.endRow + 1}; {e.startSeconds !== null && e.endSeconds !== null ? `${e.startSeconds.toFixed(3)}–${e.endSeconds.toFixed(3)} seconds` : "elapsed time unqualified"}. {e.evidence}</li>)}</ul>
      </details>
    </li>)}</ol>
    <h3 className="text-lg font-semibold">Source-derived Calibration inspection relationships</h3>
    <p className="text-sm text-zinc-400">{model.mapCount} distinct admitted tables related to observed telemetry. Each exact Definition revision appears once, with its supported event families grouped below. Tables without a qualifying event remain explicitly telemetry-only. These inspection suggestions do not establish an active map value, causal diagnosis or permission to edit. Diagnostic records below are not additional maps unless exact table authority is established.</p>
    {model.tables.map(t => <article key={t.revision} className="bmw-border rounded-xl bg-black/20 p-4" data-inspection-table={t.revision}>
      <h4 className="font-semibold">{t.title}</h4>
      {!t.families.length && <div className="mt-2 text-sm"><p>Observed telemetry inspection only: no qualifying source-derived event relationship. No event score contribution.</p>
        {[...new Set(t.relationships.map(r=>r.grade))].map(grade=><p key={grade} className="text-sky-300">{grade}</p>)}
        <details><summary className="cursor-pointer">Exact telemetry relationship and limitations</summary><p className="break-all">Definition revision: {t.revision}</p>
          {t.relationships.map((r,i)=><div key={`${r.key}:${i}`}><p>{r.channel}: {r.meaning} {r.assertion}</p><p className="break-all">{r.key}; occurrence {r.occurrence}</p><p>{r.provenance.join("; ")}</p><p>{r.limitations.join(" ")}</p></div>)}
        </details></div>}
      {t.families.map(link => {
        const family = model.families.find(f => f.kind === link.kind)!;
        return <div key={link.kind} className="mt-3 text-sm">
          <p className="font-medium">{family.title}: {family.events.length} interval(s), {family.score.toFixed(2)} evidence points. Relationship adds 0 points.</p>
          {[...new Set(link.relationships.map(r => r.grade))].map(grade => <p key={grade} className="text-sky-300">{grade}</p>)}
          {[...new Set(link.relationships.map(r => `${r.channel}: ${r.meaning} ${r.assertion}`))].map(reason => <p key={reason}>{reason}</p>)}
          <details><summary className="cursor-pointer">Exact relationship evidence, rows and limits</summary>
            <p className="break-all">Definition revision: {t.revision}</p>
            <p>Source intervals (rows are one-based): {family.events.map(e => `${e.startRow + 1}–${e.endRow + 1}${e.startSeconds !== null && e.endSeconds !== null ? ` (${e.startSeconds.toFixed(3)}–${e.endSeconds.toFixed(3)} s)` : " (time unqualified)"}`).join("; ")}</p>
            {link.relationships.map((r, i) => <div key={`${r.key}:${r.channel}:${i}`} className="mt-2 break-words"><p>Occurrence {r.occurrence}; exact key: {r.key}</p><p>{r.provenance.join("; ")}</p><p>{r.limitations.join(" ")}</p></div>)}
          </details>
        </div>;
      })}
    </article>)}
  </section>;
}

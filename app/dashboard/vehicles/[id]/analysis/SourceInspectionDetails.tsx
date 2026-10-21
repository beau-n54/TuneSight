import { relationshipPresentation } from "./relationshipPresentation";
import type {SourceInspectionCrossReferences} from "@/lib/analysis/sourceInspectionCrossReferences";
import type {ReactNode} from "react";

// Native disclosure semantics retain keyboard operation and expanded state
// without client state, extra requests or a misleading static aria-expanded.
export function EvidenceDisclosure({title, children, open = false}: {title: ReactNode; children: ReactNode; open?: boolean}) {
  return <details open={open} className="group/evidence mt-4 overflow-hidden rounded-xl border border-blue-700/60 bg-blue-950/20 shadow-sm open:border-sky-500/70 open:bg-blue-950/30">
    <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 bg-blue-950/70 px-4 py-3 text-sm font-semibold text-blue-100 transition-colors hover:bg-blue-900/70 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-sky-300 group-open/evidence:bg-blue-900/60 [&::-webkit-details-marker]:hidden">
      <span>{title}</span>
      <svg aria-hidden="true" focusable="false" viewBox="0 0 20 20" fill="none" className="h-5 w-5 shrink-0 text-sky-300 transition-transform group-open/evidence:rotate-180 motion-reduce:transition-none"><path d="m5 7.5 5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
    </summary>
    <div className="space-y-3 border-t border-blue-800/60 p-3 sm:p-4">{children}</div>
  </details>;
}

export function EvidencePoints({points}: {points: number}) {
  const tone = points > 0 ? "positive" : points < 0 ? "deduction" : "zero";
  const color = tone === "positive" ? "border-emerald-800/60 bg-emerald-950/40 text-emerald-300" : tone === "deduction" ? "border-amber-800/60 bg-amber-950/40 text-amber-300" : "border-zinc-700 bg-zinc-900 text-zinc-400";
  return <span data-score-tone={tone} className={`inline-flex min-w-16 shrink-0 justify-center rounded-md border px-2 py-1 font-semibold tabular-nums ${color}`}>{points >= 0 ? "+" : ""}{points.toFixed(2)}</span>;
}

export function SourceInspectionDetails({model}: {model: SourceInspectionCrossReferences}) {
  return <section className="min-w-0 space-y-4" aria-label="Source-derived evidence scoring and inspection relationships">
    <h3 className="border-l-2 border-sky-500 pl-3 text-lg font-semibold text-zinc-100">Source-derived Evidence Score / Investigation Priority</h3>
    <p className="text-sm text-zinc-300">Points rank measured support for inspection within this selected log. These explicit heuristic weights are not fault severity, safety risk, component failure probability or platform-qualified diagnostic confidence. Diagnostic confidence is retained separately and is never added to these points. Table availability contributes zero points.</p>
    <p className="text-sm text-zinc-400">Zero starting prior; sum the contributions below, bounded to 0–95 points. Highest score ranks first; ties use earliest source row, then family identifier. Coincidence between different event families does not prove agreement or causation and earns no bonus.</p>
    {model.families.length === 0 && <p>No source-derived event is available to score.</p>}
    <ol className="space-y-4">{model.families.map(f => <li key={f.kind} className="min-w-0 rounded-2xl border border-slate-700/80 bg-gradient-to-br from-slate-900 to-zinc-950 p-3 shadow-lg shadow-black/15 sm:p-5">
      <h4 className="mb-3 flex flex-wrap items-center gap-2 font-semibold sm:gap-3"><span data-evidence-rank className="inline-flex h-9 min-w-9 items-center justify-center rounded-lg border border-blue-700/70 bg-blue-950 px-2 text-sm text-blue-200">#{f.rank}</span>{" "}<span className="min-w-0 flex-1 basis-48 text-zinc-100">{f.title} — </span><span data-evidence-total className="inline-flex rounded-lg border border-sky-500/60 bg-sky-950/80 px-3 py-2 text-lg font-bold tabular-nums text-cyan-200 shadow-sm shadow-sky-950">{f.score.toFixed(2)} / 95 points</span></h4>
      <p className="text-sm text-zinc-300">{f.events.length} interval(s); peak {f.peak.toFixed(2)} {f.unit}; {f.gapToLeader.toFixed(2)} points behind the leading inspection family.</p>
      {f.unavailable && <p className="text-sm text-zinc-400">{f.unavailable}</p>}
      <EvidenceDisclosure title="Points, reductions and source intervals">
        <ul className="space-y-3 text-sm">{f.factors.map(p => <li key={p.label} className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3"><strong className="mb-2 flex flex-wrap items-center gap-2"><EvidencePoints points={p.points}/><span>: {p.label}.</span></strong>{" "}<span className="text-zinc-300">{p.explanation}</span></li>)}</ul>
        <ul className="mt-3 max-h-80 overflow-y-auto text-sm">{f.events.map(e => <li key={e.id}>Source rows {e.startRow + 1}–{e.endRow + 1}; {e.startSeconds !== null && e.endSeconds !== null ? `${e.startSeconds.toFixed(3)}–${e.endSeconds.toFixed(3)} seconds` : "elapsed time unqualified"}. {e.evidence}</li>)}</ul>
      </EvidenceDisclosure>
    </li>)}</ol>
    <h3 className="border-t border-slate-700 pt-6 text-lg font-semibold text-zinc-100">Source-derived Calibration inspection relationships</h3>
    <p className="text-sm text-zinc-400">{model.mapCount} distinct admitted tables related to observed telemetry. Each exact Definition revision appears once, with its supported event families grouped below. Tables without a qualifying event remain explicitly telemetry-only. These inspection suggestions do not establish an active map value, causal diagnosis or permission to edit. Diagnostic records below are not additional maps unless exact table authority is established.</p>
    {model.tables.map(t => <article key={t.revision} className="bmw-border min-w-0 rounded-2xl bg-gradient-to-br from-slate-900 to-zinc-950 p-3 shadow-lg shadow-black/15 sm:p-5" data-inspection-table={t.revision}>
      <h4 className="break-words text-base font-semibold text-sky-100">{t.title}</h4>
      {!t.families.length && <div className="mt-2 text-sm"><p>Observed telemetry inspection only: no qualifying source-derived event relationship. No event score contribution.</p>
        {[...new Set(t.relationships.map(r=>relationshipPresentation(r).label))].map(label=><p key={label} className="text-sky-300">{label}</p>)}
        <EvidenceDisclosure title="Advanced technical evidence"><p className="break-all">Definition revision: {t.revision}</p>
          {t.relationships.map((r,i)=><div key={`${r.key}:${i}`}><p>{r.grade}: {r.channel}: {r.meaning} {r.assertion}</p><p className="break-all">{r.key}; occurrence {r.occurrence}</p><p>{r.provenance.join("; ")}</p><p>{r.limitations.join(" ")}</p></div>)}
        </EvidenceDisclosure></div>}
      {t.families.map(link => {
        const family = model.families.find(f => f.kind === link.kind)!;
        return <div key={link.kind} className="mt-4 space-y-2 rounded-xl border border-slate-700/70 bg-black/20 p-3 text-sm sm:p-4">
          <p className="font-medium">{family.title}: {family.events.length} interval(s), {family.score.toFixed(2)} evidence points. Relationship adds 0 points.</p>
          {[...new Set(link.relationships.map(r => relationshipPresentation(r).label))].map(label => <p key={label} className="text-sky-300">{label}</p>)}
          <EvidenceDisclosure title="Advanced technical evidence">
            {[...new Set(link.relationships.map(r => `${r.grade}: ${r.channel}: ${r.meaning} ${r.assertion}`))].map(reason => <p key={reason}>{reason}</p>)}
            <p className="break-all">Definition revision: {t.revision}</p>
            <p>Source intervals (rows are one-based): {family.events.map(e => `${e.startRow + 1}–${e.endRow + 1}${e.startSeconds !== null && e.endSeconds !== null ? ` (${e.startSeconds.toFixed(3)}–${e.endSeconds.toFixed(3)} s)` : " (time unqualified)"}`).join("; ")}</p>
            {link.relationships.map((r, i) => <div key={`${r.key}:${r.channel}:${i}`} className="mt-2 break-words"><p>Occurrence {r.occurrence}; exact key: {r.key}</p><p>{r.provenance.join("; ")}</p><p>{r.limitations.join(" ")}</p></div>)}
          </EvidenceDisclosure>
        </div>;
      })}
    </article>)}
  </section>;
}

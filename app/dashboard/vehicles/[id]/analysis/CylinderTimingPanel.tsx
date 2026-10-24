import type { AnalysisEvidenceSections } from "@/lib/analysis/analysisEvidenceSections";

/** Presentation of qualified observations, never an installed-engine identity owner. */
export function CylinderTimingPanel({ timing }: { timing: AnalysisEvidenceSections["timing"] }) {
  return <>
    <p className="mb-3 text-sm text-zinc-400">Supplied cylinder channels only. Missing channels do not establish the installed cylinder count.</p>
    <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6" data-cylinder-observations={timing.length}>
      {timing.map(channel => <div key={channel.channel} className="bmw-border rounded-xl bg-zinc-950/80 p-4 shadow-lg shadow-black/20">
        <p className="text-xs uppercase tracking-wide text-zinc-400">Cylinder {channel.channel.split("_").at(-1)}</p>
        <p className="mt-2 text-lg font-semibold text-white">{channel.minimum.toLocaleString("en", {minimumFractionDigits: 1, maximumFractionDigits: 1})} {channel.unit}</p>
      </div>)}
      {!timing.length && <p>No unambiguous timing-correction channels with qualified angle units were supplied.</p>}
    </div>
  </>;
}

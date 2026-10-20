import Link from "next/link";
import { type OwnedLog } from "@/lib/analysis/analysisCapabilities";
import type { AnalysisSource } from "@/lib/analysis/analysisSource";
import type { VehicleSetup } from "@/lib/analysis/types";

type Props = {
  vehicleId: string; vehicle: VehicleSetup; logs: readonly OwnedLog[]; selected: OwnedLog | null;
  source: AnalysisSource | null; diagnostics: boolean; priorResultId: string | null; historyUnavailable?: boolean;
};
/** Compact controls; measurements render in the established Engineering workspace. */
export default function SourceMeasurements({vehicleId, logs, selected, source, diagnostics, priorResultId, historyUnavailable}: Props) {
  return <section aria-label="Owned source and Analysis capabilities" className="bmw-border space-y-3 rounded-2xl bg-zinc-900 p-4">
    <form action={`/dashboard/vehicles/${vehicleId}/analysis`} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <label className="min-w-0 flex-1 text-sm" htmlFor="analysis-owned-log">Selected log · complete owned history
        <select id="analysis-owned-log" name="log" defaultValue={selected?.id ?? ""} className="mt-1 block w-full min-w-0 rounded-lg border border-zinc-700 bg-black p-2">
          {!selected && <option value="">Choose an owned log</option>}
          {logs.map(log => <option key={log.id} value={log.id}>{log.log_name || log.id} · {log.created_at}</option>)}
        </select>
      </label>
      <button type="submit" className="rounded-lg border border-zinc-600 px-4 py-2">View selected log</button>
      <Link prefetch={false} className="text-sm underline" href={`/dashboard/vehicles/${vehicleId}/logs`}>Open complete owned-log history</Link>
    </form>
    {historyUnavailable && <p>Log history could not be fully loaded. Retry; no source is classified as missing because of this request failure.</p>}
    {!selected && <p>No owned log selected. Choose a log from your history.</p>}
    {selected && <>
      <p className="break-words text-sm">Selected: {selected.log_name || selected.id} · {selected.id}</p>
      <p>{source?.finding}</p>
      <div className="flex flex-wrap gap-4 text-sm">
        {source?.state === "available" && <>
          <Link prefetch={false} className="underline" href={`/dashboard/vehicles/${vehicleId}/analysis?log=${encodeURIComponent(selected.id)}&reprocess=1`}>Reprocess existing owned source (read-only)</Link>
          <a className="underline" href={`/api/vehicles/source-download?kind=log&id=${encodeURIComponent(selected.id)}`}>Download original source log</a>
        </>}
        {source?.state !== "available" && <Link prefetch={false} className="underline" href={`/dashboard/vehicles/${vehicleId}/analysis?log=${encodeURIComponent(selected.id)}`}>Retry source access</Link>}
      </div>
      {source?.state === "missing" && <p>Recover only the original file for log {selected.id} through this vehicle’s log history. The exact original object is missing.</p>}
      <details className="text-sm text-zinc-400">
        <summary>Source lineage and channel/unit blockers</summary>
        <p>Prior stored result: {priorResultId ?? "Not established"}. Existing results and original bytes are preserved.</p>
        <p>SHA-256: {source?.digest ?? "Not established"}</p>
        <p>Read-only processing creates no log, result or storage object. Repeated requests create no duplicates.</p>
        <p>Saved labels are owner declarations; neither logger format nor uploaded software establishes observed DME/ROM identity.</p>
        {source?.measurements && <p>Source measurements available: {source.measurements.sampleCount} source rows · {source.measurements.sourceFormat} channel translator.</p>}
        <ul className="list-inside list-disc">{source?.measurements?.blockers.map(blocker => <li key={blocker}>{blocker}</li>)}</ul>
      </details>
    </>}
    {!diagnostics && <p className="text-sm text-amber-200">Platform-specific diagnostic conclusions are not yet qualified for this declaration or source input. The complete workspace remains available; no unqualified thresholds or causal conclusions are supplied.</p>}
  </section>;
}

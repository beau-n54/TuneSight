import Link from "next/link";
import { analysisCapabilities, type OwnedLog } from "@/lib/analysis/analysisCapabilities";
import type { AnalysisSource } from "@/lib/analysis/analysisSource";
import type { VehicleSetup } from "@/lib/analysis/types";

type Props = {
  vehicleId: string; vehicle: VehicleSetup; logs: readonly OwnedLog[]; selected: OwnedLog | null;
  source: AnalysisSource | null; diagnostics: boolean; priorResultId: string | null; historyUnavailable?: boolean;
};
const labels: Record<string, string> = {
  ownedSourceAccessible: "Owned source accessible", sourceParsed: "Source parsed", unitsQualified: "Units qualified",
  platformEvidenceAvailable: "Observed controller/platform evidence", platformSpecificRulesQualified: "Platform-specific rule contract applicable to saved declaration",
  diagnosticConclusionsAvailable: "Diagnostic conclusions available for selected result",
};

export default function SourceMeasurements({vehicleId, vehicle, logs, selected, source, diagnostics, priorResultId, historyUnavailable}: Props) {
  const measurements = source?.measurements;
  const capabilities = analysisCapabilities(source?.state ?? "unresolved", measurements ?? null, vehicle, diagnostics);
  return <section aria-label="Owned source and Analysis capabilities" className="bmw-border mx-auto max-w-6xl space-y-4 rounded-2xl bg-zinc-900 p-6">
    <h2 className="text-xl font-semibold">Owned logs and source measurements</h2>
    <Link prefetch={false} className="underline" href={`/dashboard/vehicles/${vehicleId}/logs`}>Open complete owned-log history</Link>
    {historyUnavailable && <p>Log history could not be fully loaded. Retry; no source is classified as missing because of this request failure.</p>}
    <ul className="max-h-64 overflow-auto">{logs.map(log => <li key={log.id}>
      <Link prefetch={false} className="underline" href={`/dashboard/vehicles/${vehicleId}/analysis?log=${encodeURIComponent(log.id)}`}>{log.log_name || log.id} · {log.created_at}</Link>{selected?.id === log.id ? " · Selected" : ""}
    </li>)}</ul>
    {!selected && <p>No owned log selected. Choose a log from your history.</p>}
    {selected && <>
      <p>Log: {selected.log_name || selected.id} · {selected.id}</p>
      <p>Prior stored result: {priorResultId ?? "Not established"}. Existing results are preserved.</p>
      <p>{source?.finding}</p>
      {source?.state === "missing" ? <p>Recover only the original file for log {selected.id} through <Link prefetch={false} className="underline" href={`/dashboard/vehicles/${vehicleId}/logs`}>this vehicle’s log history</Link>.</p>
        : source?.state === "available" ? <Link prefetch={false} className="underline" href={`/dashboard/vehicles/${vehicleId}/analysis?log=${encodeURIComponent(selected.id)}&reprocess=1`}>Reprocess existing owned source (read-only)</Link>
          : <Link prefetch={false} className="underline" href={`/dashboard/vehicles/${vehicleId}/analysis?log=${encodeURIComponent(selected.id)}`}>Retry source access</Link>}
      {source?.state === "available" && <p>Processing reads the immutable original into this response only. It creates no source, log or stored result; retries create no duplicates.</p>}
      {source?.digest && <details><summary>Source lineage</summary><p>SHA-256: {source.digest}</p><p>Existing bounded CSV and qualified channel translators. No controller identity is inferred.</p></details>}
    </>}
    <dl className="grid gap-2 sm:grid-cols-2">{Object.entries(capabilities).map(([name, value]) => <div key={name}><dt>{labels[name]}</dt><dd>{typeof value === "boolean" ? value ? "Available" : "Not established" : value}</dd></div>)}</dl>
    <p>Saved vehicle labels are owner declarations. Logger format and source measurements do not establish observed controller or ROM identity.</p>
    {!diagnostics && <p>Platform-specific diagnostic conclusions are not yet qualified for this controller family or selected result. No platform-specific thresholds, causal conclusions or rule-derived warnings are shown.</p>}
    {measurements && <>
      <h3>{measurements.channels.length ? "Source measurements available." : "Source parsed; channel units or observations are not yet qualified."}</h3>
      <p>{measurements.sampleCount} source rows · {measurements.sourceFormat} channel translator. The translator classification is not observed logger or controller identity.</p>
      {measurements.blockers.length > 0 && <details><summary>Channel and unit blockers</summary><ul>{measurements.blockers.map(blocker => <li key={blocker}>{blocker}</li>)}</ul></details>}
      <div className="grid gap-4 lg:grid-cols-2">{measurements.channels.map(channel => {
        const observed = channel.values.filter((value): value is number => value !== null);
        const minimum = observed.reduce((a, b) => Math.min(a, b), Infinity), maximum = observed.reduce((a, b) => Math.max(a, b), -Infinity);
        const times = measurements.timestamps, duration = times ? times.at(-1)! - times[0] : 0;
        const range = maximum - minimum || 1;
        let open = false;
        // Actual acquired timestamps only. Missing observations break the path; no interpolation or zero fill.
        const path = times ? channel.values.map((value, index) => {
          if (value === null) { open = false; return ""; }
          const point = `${open ? "L" : "M"}${40 + (duration ? (times[index] - times[0]) / duration : 0) * 400},${150 - (value - minimum) / range * 120}`;
          open = true; return point;
        }).join(" ") : null;
        return <figure key={channel.key} className="bmw-border rounded-xl p-3">
          <figcaption>{channel.key} [{channel.unit}] · observed min {minimum} / max {maximum} · {observed.length} observations</figcaption>
          {path && <svg role="img" aria-label={`${channel.key} acquired measurements over elapsed seconds`} viewBox="0 0 480 190">
            <text x="2" y="25" fill="currentColor" fontSize="10">{maximum}</text><text x="2" y="150" fill="currentColor" fontSize="10">{minimum}</text>
            <path d={path} fill="none" stroke="#38bdf8" strokeWidth="1.5"/>
            <text x="40" y="175" fill="currentColor" fontSize="11">0 s</text><text x="360" y="175" fill="currentColor" fontSize="11">{duration.toFixed(2)} s</text>
          </svg>}
          <p>Measured range only; no warning or safety threshold.</p>
          <details><summary>Measured values in source-row order</summary><p className="max-h-40 overflow-auto break-words">{channel.values.map(value => value === null ? "unavailable" : String(value)).join(", ")}</p></details>
        </figure>;
      })}</div>
    </>}
  </section>;
}

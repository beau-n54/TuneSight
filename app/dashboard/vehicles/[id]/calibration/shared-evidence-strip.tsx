"use client";

import type { WorkspaceTableProjection } from "@/lib/calibration-workshop/sharedWorkspaceAdapter";
import type { WorkingCalibration } from "@/lib/calibration-workshop/workingCalibration";

export function SharedEvidenceStrip({ projection, working = null, reason = "No Current Calibration loaded." }: { projection: WorkspaceTableProjection | null; working?: WorkingCalibration | null; reason?: string }) {
  return <><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
    {(["reference", "current", "working", "suggested"] as const).map(slot => {
      const layer = slot === "reference" || slot === "current" ? projection?.slots[slot] : null;
      const status = layer?.state ?? (slot === "working" ? working?.state ?? "not created" : slot === "suggested" ? "unavailable" : "unresolved");
      const findings = layer ? [...layer.findings, ...(layer.quarantine ? [layer.quarantine.failureEvidence.finding] : [])] : [];
      const available = layer?.state === "available" || (slot === "working" && working !== null);
      const treatment = !available ? "border-zinc-800 bg-zinc-950 text-zinc-400" : slot === "working"
        ? "border-emerald-400/35 bg-emerald-400/5" : slot === "current" ? "border-blue-400/40 bg-blue-400/5" : "border-zinc-500 bg-zinc-900";
      return <article key={slot} data-evidence-slot={slot} className={`min-w-0 rounded-xl border p-4 ${treatment}`}>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">{slot === "current" ? "Current Calibration" : slot === "working" ? "Working Calibration" : slot === "suggested" ? "TuneSight Suggested" : "Reference"}</h2>
        <p className="mt-2 text-sm">{status}</p>
        {findings.map((finding, i) => <p key={i} className="mt-1 text-xs text-zinc-400">{finding}</p>)}
        {!layer && <p className="mt-1 text-xs text-zinc-400">{slot === "suggested" ? "Suggested generation is unavailable." : slot === "working" ? "Separate reversible changes; Current remains immutable." : reason}</p>}
        {layer?.dataset && <details className="mt-2 text-xs"><summary>Dataset and binary identity</summary><dl className="mt-2 space-y-2 break-all font-mono">{Object.entries({ Dataset: layer.dataset.datasetId, Revision: layer.dataset.datasetRevision,
          "Binary identity": layer.dataset.exactBinaryIdentity.identityId, Digest: layer.dataset.exactBinaryIdentity.digest, "ROM family": layer.dataset.exactBinaryIdentity.romFamily,
          Layout: layer.dataset.romLayoutId, Relationship: layer.dataset.relationshipRevision, "Definition Set": layer.dataset.definitionSetRevision, Role: layer.dataset.sourceRole }).map(([label, value]) => <div key={label}><dt className="text-zinc-500">{label}</dt><dd>{value ?? "Not established"}</dd></div>)}</dl></details>}
      </article>;
    })}
    </div><p className="mt-3 text-xs text-zinc-400">EDIT: {projection?.capabilities.edit?.state ?? "Not supplied"} · Reconstruction: no active capability supplied · Export: locked · Flash: unavailable</p></>;
}

"use client";
import {useState} from "react";
import {tuneEvidenceContext, type OwnerTuneDeclaration, type TuneByteEvidence} from "@/lib/analysis/analysisTuneEvidence";

export function TuneEvidenceContext({bytes}: {bytes: TuneByteEvidence | null}) {
  const [declaration, setDeclaration] = useState<OwnerTuneDeclaration | null>(null);
  const context = tuneEvidenceContext(bytes, declaration);
  return <section className="bmw-border space-y-3 rounded-2xl bg-zinc-900 p-5" data-analysis-section="Tune evidence and declared operating context">
    <h2 className="text-lg font-semibold">Tune evidence and declared operating context</h2>
    <p>{context.sourceClassification}</p><p>{context.comparisonReason}</p><p>{context.inspection}</p>
    <p>MHD says tuned maps cannot be saved as backups and it does not retain the last flashed file/settings. An MHD backup is not proof of the active OTS tune. <a className="text-sky-300 underline" href="https://mhdtuning.com/pages/faq" target="_blank" rel="noreferrer">MHD FAQ</a></p>
    {bytes && <details><summary>Fresh owned-byte evidence</summary><p>Source {bytes.sourceId}: {bytes.fileName}; {bytes.byteLength} bytes.</p><p className="break-all">SHA-256 {bytes.digest}</p><p>Explicit owned reference: {bytes.referenceId ?? "unavailable"}; byte-equivalent Stock Reference: {bytes.matchesOwnedStockReference ? "yes" : "not established"}.</p></details>}
    <details><summary>Declare operating tune context for this page only</summary>
      <p>No declaration is inferred from a filename, vehicle label or upload order. This form stays in memory, is cleared on reload and cannot change identity, analysis rules or stored records.</p>
      <form className="grid gap-3 sm:grid-cols-2" onSubmit={event => {event.preventDefault(); const data = new FormData(event.currentTarget); const text = (key: string) => String(data.get(key) ?? "").trim().slice(0, 200); setDeclaration({provider: text("provider"), tuneType: text("tuneType"), stage: text("stage"), fuel: text("fuel") || null, flashOptions: text("options") || null, declaredAt: new Date().toISOString(), evidenceGrade: "owner-declared, not byte-verified"});}}>
        {[["provider","Provider (for example MHD)"],["tuneType","Tune type (for example OTS)"],["stage","Stage (for example Stage 2+)"],["fuel","Fuel / octane, if known"],["options","Flash options, if known"]].map(([name,label]) => <label key={name} htmlFor={`tune-declaration-${name}`}>{label}<input id={`tune-declaration-${name}`} name={name} maxLength={200} required={["provider","tuneType","stage"].includes(name)} className="block w-full rounded border border-zinc-600 bg-zinc-950 p-2"/></label>)}
        <button className="rounded border border-sky-500 p-2" type="submit">Use declaration on this page</button>
      </form>
    </details>
    {declaration && <div role="status"><p>{declaration.provider} / {declaration.tuneType} / {declaration.stage} — {declaration.evidenceGrade}.</p><p>Fuel: {declaration.fuel ?? "not supplied"}; options: {declaration.flashOptions ?? "not supplied"}. Declared {declaration.declaredAt}. Not saved.</p><p>Inspection question: does the actual flashed selection match this declaration? No modified table value is inferred.</p></div>}
  </section>;
}

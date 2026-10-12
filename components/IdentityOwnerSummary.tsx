import { identityOwners, observedIdentityLabel, type SavedVehicleInput, type CalibrationSourceIdentity, type ControllerObservation } from "@/lib/identity/identityOwners";
import { presentationFindings } from "@/lib/calibration-workshop/presentationFindings";

/** Owner labels are shared by Garage, Calibration, Analysis and evidence views. */
export default function IdentityOwnerSummary({ vehicle, calibration, observations }: {
  vehicle?: SavedVehicleInput | null; calibration?: CalibrationSourceIdentity | null; observations?: readonly ControllerObservation[];
}) {
  const identity = identityOwners({ vehicle, calibration, controllerObservations: observations });
  const saved = identity.savedVehicle;
  const provenance = presentationFindings(identity.controller.evidence.map(item => ({
    sourceId: item.source, findings: [{ findingId: JSON.stringify([item.observationId, item.sourceId, item.observedAt]),
      text: `${item.source} · ${item.sourceId} · Vehicle: ${item.vehicleId ?? "not bound"} · ${item.observedAt} · ${item.qualification}${item.findings.length ? ` · ${item.findings.join("; ")}` : ""}` }],
  })));
  return <div className="mt-2 space-y-1 text-xs text-zinc-400" data-identity-contract={identity.contract}>
    {vehicle && <p>Saved engine label (owner-declared): <span className="text-zinc-200">{saved.declaredEngineCode ?? "Not declared"}</span></p>}
    {calibration && <p>Definition/XDF source family: <span className="text-zinc-200">{calibration.definitionSourceFamily ?? "Not established"}</span> · Uploaded ROM/software: {calibration.exactSoftwareIdentity}</p>}
    <p>Observed DME/controller family: {observedIdentityLabel(identity.controller.observedDmeFamily)} · Observed controller ROM/software: {observedIdentityLabel(identity.controller.exactSoftwareIdentity)}</p>
    <details><summary className="cursor-pointer">Identity evidence owners</summary><dl className="mt-2 space-y-1 break-words">
      {vehicle && <><dt>Saved vehicle facts · owner declarations</dt><dd>{saved.year ?? "Year not declared"} {saved.make ?? "Make not declared"} {saved.model ?? "Model not declared"}</dd>
        <dt>Saved chassis</dt><dd>{saved.chassis ?? "Not supplied by saved vehicle record"}</dd>
        <dt>Saved engine generation</dt><dd>{saved.engineGeneration ?? "Not separately declared"}{saved.generationSource && ` · ${saved.generationSource}`}</dd>
        <dt>Owner-declared engine code / label</dt><dd>{saved.declaredEngineCode ?? "Not declared"}</dd></>}
      {calibration && <><dt>Uploaded container</dt><dd>{calibration.containerType}</dd>
        <dt>Exact container SHA-256</dt><dd className="break-all">{calibration.containerDigest ?? "Not established; no binary-digest substitution"}{calibration.containerDigestProvenance && ` · ${calibration.containerDigestProvenance}`}</dd>
        <dt>Engineering binary SHA-256</dt><dd className="break-all">{calibration.engineeringBinaryDigest}</dd>
        <dt>Definition Set revision</dt><dd className="break-all">{calibration.definitionSetRevision}</dd>
        <dt>Definition source artifact</dt><dd className="break-all">{calibration.sourceArtifactId} · {calibration.sourceArtifactDigest}</dd>
        <dt>Workshop Dataset</dt><dd className="break-all">{calibration.datasetId}</dd>
        <dt>Workshop Dataset revision</dt><dd className="break-all">{calibration.datasetRevision}</dd>
        <dt>Definition coverage</dt><dd>{calibration.coverage}</dd></>}
      <dt>Controller observation provenance</dt><dd>{provenance.length === 0 ? "No qualified controller observation supplied. Uploaded Calibration identity does not establish the connected controller." : provenance.map(item => <p key={item.key}>{item.text}</p>)}</dd>
      {provenance.length > 0 && <><dt>Observed controller endpoint / adapter</dt><dd>{observedIdentityLabel(identity.controller.controllerAddress)} · {observedIdentityLabel(identity.controller.adapterIdentity)}</dd>
        <dt>Observed VIN</dt><dd>{observedIdentityLabel(identity.controller.observedVin)}</dd>
        {identity.controller.observedDmeFamily.reason && <><dt>Controller qualification finding</dt><dd>{identity.controller.observedDmeFamily.reason}</dd></>}</>}
    </dl></details>
  </div>;
}

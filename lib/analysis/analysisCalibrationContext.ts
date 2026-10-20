import type { OwnedLog } from "./analysisCapabilities";
import type { SubscriberCalibrationSuccess } from "../calibration-workshop/subscriberCalibrationProvider";
import { resolveVehicleOwnedCalibrationEvidence } from "../calibration-workshop/vehicleOwnedCalibrationEvidence.ts";

export type AnalysisCalibrationContext =
  | {state: "available"; owner: string; vehicle: string; sessionId: string; result: SubscriberCalibrationSuccess}
  | {state: "unavailable"; reason: string};
type Relationship = {title: string; occurrence: number; revision: string; key: string; channel: string; meaning: string; assertion: string; grade: string; provenance: readonly string[]; limitations: readonly string[]};

/** Exact session scope and occurrence resolution; never infer a binding from a title. */
export function resolveAnalysisCalibration(context: AnalysisCalibrationContext, log: OwnedLog | null, owner: string, vehicle: string, channels: readonly string[]) {
  const unavailable = (reason: string) => ({reason, identity: null, relationships: [] as Relationship[], href: null});
  try {
  if (!log || log.user_id !== owner || log.vehicle_id !== vehicle) return unavailable("An owned selected log for this vehicle is required.");
  if (context.state !== "available") return unavailable(context.reason);
  if (context.owner !== owner || context.vehicle !== vehicle) return unavailable("Calibration session owner/vehicle scope does not match the selected log.");
  const r = context.result, d = r.material.current, w = r.workshop;
  const owned = resolveVehicleOwnedCalibrationEvidence({ownerId: owner, vehicleId: vehicle, result: r});
  if (!owned.workshop || !owned.currentCalibration) return unavailable(owned.finding);
  if (d.contractVersion !== "tunesight.qualified-calibration-dataset.v1"
    || !r.identity || !r.digest || !d.datasetId || !d.datasetRevision || !d.definitionSetRevisionId
    || !Number.isSafeInteger(r.byteLength) || r.byteLength <= 0 || r.identity !== d.exactBinaryIdentity.softwareIdentity
    || r.digest !== d.exactBinaryIdentity.digest || r.byteLength !== d.exactBinaryIdentity.byteLength
    || w.source.currentDatasetId !== d.datasetId || w.source.currentDatasetRevision !== d.datasetRevision
    || w.source.definitionSetRevision !== d.definitionSetRevisionId) {
    return unavailable("Exact ROM/source identity, Dataset revision or Definition Set does not match the admitted Calibration context.");
  }
  const relationships: Relationship[] = [];
  const occurrenceCounts = new Map<string, number>();
  const occurrences = new Map<string, (typeof w.definitions)[number][]>();
  const keys = new Map<string, number>();
  for (const item of w.definitions) {
    const identity = JSON.stringify([item.definitionRevision, item.occurrence]);
    occurrences.set(identity, [...(occurrences.get(identity) ?? []), item]);
    keys.set(item.key, (keys.get(item.key) ?? 0) + 1);
  }
  for (const definition of d.definitions) {
    const occurrence = occurrenceCounts.get(definition.definitionRevisionId) ?? 0;
    occurrenceCounts.set(definition.definitionRevisionId, occurrence + 1);
    const matches = occurrences.get(JSON.stringify([definition.definitionRevisionId, occurrence])) ?? [];
    if (matches.length !== 1 || definition.sourceArtifactDigest !== d.sourceArtifactDigest) continue;
    const item = matches[0];
    if (keys.get(item.key) !== 1) continue;
    if (!["qualified_engineering_value", "identity_conversion"].includes(definition.state)) continue;
    if ("availability" in item ? item.availability !== "current_available" : !item.available) continue;
    if (item.semantic.outcome !== "exact") continue;
    for (const field of item.semantic.telemetryRelationships) {
      if (!channels.includes(field.value.channelId)) continue;
      relationships.push({title: definition.title ?? "Unnamed exact Definition", occurrence, revision: definition.definitionRevisionId, key: item.key,
        channel: field.value.channelId, meaning: field.value.meaning, assertion: `${field.assertionId}@${field.assertionRevision}`, grade: "Exact Definition telemetry relationship",
        provenance: field.provenance, limitations: field.limitations});
    }
  }
  return {
    reason: relationships.length ? null : "The exact Dataset is available, but no unambiguous admitted Definition occurrence has a qualified telemetry relationship to the selected source channels.",
    identity: {software: r.identity, family: d.exactBinaryIdentity.romFamily, bytes: r.byteLength, container: r.container,
      digest: r.digest, dataset: d.datasetRevision, definitionSet: d.definitionSetRevisionId, artifact: d.sourceArtifactDigest},
    relationships,
    href: `/dashboard/vehicles/${encodeURIComponent(vehicle)}/calibration?session=${encodeURIComponent(context.sessionId)}`,
  };
  } catch {
    return unavailable("The admitted Calibration context has incomplete or invalid Dataset/Definition evidence.");
  }
}
export type AnalysisCalibrationResolution = ReturnType<typeof resolveAnalysisCalibration>;

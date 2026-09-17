import type { QualifiedCalibrationDataset } from "../xdf/qualifiedCalibrationDataset.ts";
import type { SubscriberCalibrationResult, SubscriberCalibrationSuccess } from "./subscriberCalibrationProvider.ts";

export const VEHICLE_OWNED_CALIBRATION_EVIDENCE_CONTRACT = "tunesight.vehicle-owned-calibration-evidence.v1" as const;

export type VehicleOwnedCalibrationRole = "reference" | "current";
export type VehicleOwnedCalibrationEvidence = Readonly<{
  role: VehicleOwnedCalibrationRole;
  sourceRole: string;
  sourceArtifactIdentity: string;
  sourceDigest: string;
  datasetIdentity: string;
  datasetRevision: string;
  romLayoutIdentity: string;
  relationshipRevision: string;
  definitionSetRevision: string;
  qualificationState: "qualified";
  sourceBinaryLease: "active" | "unavailable_or_expired";
  provenance: readonly string[];
}>;

export type VehicleOwnedCalibrationResolution = Readonly<{
  contractVersion: typeof VEHICLE_OWNED_CALIBRATION_EVIDENCE_CONTRACT;
  ownerId: string;
  vehicleId: string;
  outcome: "no_evidence" | "current_only" | "comparison_ready" | "comparison_unavailable" | "ambiguous_role";
  referenceCalibration: VehicleOwnedCalibrationEvidence | null;
  currentCalibration: VehicleOwnedCalibrationEvidence | null;
  workshop: SubscriberCalibrationSuccess | null;
  finding: string;
}>;

const CURRENT_ROLES = new Set(["user_modified"]);
const REFERENCE_ROLES = new Set(["stock_candidate", "stock_original", "reference"]);
const freeze = <T>(value: T): T => Object.freeze(value);

function evidence(role: VehicleOwnedCalibrationRole, dataset: QualifiedCalibrationDataset, success: SubscriberCalibrationSuccess): VehicleOwnedCalibrationEvidence {
  return freeze({
    role,
    sourceRole: dataset.sourceRole,
    sourceArtifactIdentity: dataset.exactBinaryIdentity.identityId,
    sourceDigest: dataset.exactBinaryIdentity.digest,
    datasetIdentity: dataset.datasetId,
    datasetRevision: dataset.datasetRevision,
    romLayoutIdentity: dataset.romLayoutId,
    relationshipRevision: dataset.relationshipRevision,
    definitionSetRevision: dataset.definitionSetRevisionId,
    qualificationState: "qualified",
    sourceBinaryLease: success.sourceLease ? "active" : "unavailable_or_expired",
    provenance: freeze([...dataset.provenance]),
  });
}

export function resolveVehicleOwnedCalibrationEvidence(input: Readonly<{ ownerId: string; vehicleId: string; result: SubscriberCalibrationResult | null }>): VehicleOwnedCalibrationResolution {
  const base = { contractVersion: VEHICLE_OWNED_CALIBRATION_EVIDENCE_CONTRACT, ownerId: input.ownerId, vehicleId: input.vehicleId } as const;
  if (!input.result || input.result.status !== "workshop_ready") return freeze({ ...base, outcome: "no_evidence", referenceCalibration: null, currentCalibration: null, workshop: null, finding: "No qualified vehicle-owned Current Calibration is available." });
  const success = input.result;
  const current = success.material.current;
  if (!CURRENT_ROLES.has(current.sourceRole)) return freeze({ ...base, outcome: "ambiguous_role", referenceCalibration: null, currentCalibration: null, workshop: null, finding: "The vehicle-owned calibration source role is not qualified as Current." });
  const currentCalibration = evidence("current", current, success);
  const reference = success.material.reference;
  if (!reference) return freeze({ ...base, outcome: "current_only", referenceCalibration: null, currentCalibration, workshop: success, finding: "Qualified Current Calibration recovered; authoritative Reference is not established." });
  if (!REFERENCE_ROLES.has(reference.sourceRole)) return freeze({ ...base, outcome: "ambiguous_role", referenceCalibration: null, currentCalibration, workshop: null, finding: "The comparison baseline source role is not qualified as Reference." });
  const referenceCalibration = evidence("reference", reference, success);
  const compatible = reference.romLayoutId === current.romLayoutId && reference.relationshipRevision === current.relationshipRevision && reference.definitionSetRevisionId === current.definitionSetRevisionId;
  if (!compatible || !success.material.comparison) return freeze({ ...base, outcome: "comparison_unavailable", referenceCalibration, currentCalibration, workshop: success, finding: "Reference and Current are retained, but exact comparison authority is unavailable." });
  return freeze({ ...base, outcome: "comparison_ready", referenceCalibration, currentCalibration, workshop: success, finding: "Qualified Reference and Current Calibration evidence recovered for this vehicle." });
}

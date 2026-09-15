import { createHash } from "node:crypto";
import type { MasterCalibrationResolution } from "../calibration-workshop/masterCalibrationResolver.ts";

export const VEHICLE_ADMISSION_CONTRACT = "tunesight.vehicle-admission.v1" as const;

export type IdentityConfidence = "exact_vehicle_and_rom" | "exact_vehicle" | "platform_engine_dme" | "platform_engine" | "vehicle_only";
export type IdentityFieldState = "exact_verified" | "qualified_classification" | "observed_unqualified" | "unresolved" | "conflict";
export type IdentityField = Readonly<{ value: string | null; state: IdentityFieldState; evidence: readonly string[] }>;
export type VehicleIdentityEvidence = Readonly<{
  vehicle: IdentityField;
  chassisPlatform: IdentityField;
  engineFamily: IdentityField;
  ecuDmeFamily: IdentityField;
  romSoftware: IdentityField;
  romFamily: IdentityField;
}>;

export type VehicleAdmission = Readonly<{
  contractVersion: typeof VEHICLE_ADMISSION_CONTRACT;
  admissionId: string;
  outcome: "ADMITTED" | "REJECTED_CONFLICT" | "REJECTED_INSUFFICIENT_IDENTITY";
  confidence: IdentityConfidence | null;
  identity: VehicleIdentityEvidence;
  unresolvedFields: readonly (keyof VehicleIdentityEvidence)[];
  findings: readonly string[];
}>;

export type CapabilityEnvelope = Readonly<{
  vehicleWorkspace: "AVAILABLE" | "BLOCKED_IDENTITY";
  analysis: "AVAILABLE" | "EVIDENCE_REQUIRED" | "BLOCKED_IDENTITY";
  telemetry: "AVAILABLE" | "QUALIFICATION_REQUIRED" | "BLOCKED_IDENTITY";
  calibrationView: "AVAILABLE" | "DEFINITIONS_UNAVAILABLE" | "BLOCKED_CONFLICT" | "BLOCKED_IDENTITY";
  calibrationAddresses: "QUALIFIED" | "UNAVAILABLE";
  definitionSet: "QUALIFIED" | "UNAVAILABLE";
  calibrationEdit: "AVAILABLE" | "BLOCKED_DEPENDENCY";
  calibrationReconstruct: "AVAILABLE" | "BLOCKED_DEPENDENCY";
  calibrationExport: "AVAILABLE" | "BLOCKED_DEPENDENCY" | "CHECKSUM_UNKNOWN";
  flash: "NOT_QUALIFIED";
  acquiredXdfContribution: "CANDIDATE_EVIDENCE_ALLOWED" | "NOT_APPLICABLE";
  newRomEvidenceRevision: string | null;
}>;

const fields: readonly (keyof VehicleIdentityEvidence)[] = Object.freeze(["vehicle", "chassisPlatform", "engineFamily", "ecuDmeFamily", "romSoftware", "romFamily"]);
const established = (field: IdentityField) => field.value !== null && (field.state === "exact_verified" || field.state === "qualified_classification" || field.state === "observed_unqualified");
const qualified = (field: IdentityField) => field.value !== null && (field.state === "exact_verified" || field.state === "qualified_classification");
const conflict = (field: IdentityField) => field.state === "conflict";

function confidence(identity: VehicleIdentityEvidence): IdentityConfidence {
  if (identity.vehicle.state === "exact_verified" && identity.romSoftware.state === "exact_verified") return "exact_vehicle_and_rom";
  if (identity.vehicle.state === "exact_verified") return "exact_vehicle";
  if (qualified(identity.chassisPlatform) && qualified(identity.engineFamily) && qualified(identity.ecuDmeFamily)) return "platform_engine_dme";
  if (qualified(identity.chassisPlatform) && qualified(identity.engineFamily)) return "platform_engine";
  return "vehicle_only";
}

export function admitVehicleIdentity(identity: VehicleIdentityEvidence): VehicleAdmission {
  const unresolvedFields = fields.filter((name) => !established(identity[name]));
  const conflicts = fields.filter((name) => conflict(identity[name]));
  const legitimate = established(identity.vehicle) || (qualified(identity.chassisPlatform) && qualified(identity.engineFamily));
  const outcome = conflicts.length ? "REJECTED_CONFLICT" as const : legitimate ? "ADMITTED" as const : "REJECTED_INSUFFICIENT_IDENTITY" as const;
  const findings = conflicts.length
    ? ["Identity evidence conflicts; vehicle admission remains fail-closed."]
    : legitimate
      ? ["Vehicle identity is admitted only to the highest supported confidence; unresolved capability identity remains explicit."]
      : ["Neither vehicle identity nor qualified platform-and-engine identity is established."];
  const material = { identity, outcome, unresolvedFields };
  const admissionId = `vehicle-admission:${createHash("sha256").update(VEHICLE_ADMISSION_CONTRACT).update(Buffer.from([0])).update(JSON.stringify(material)).digest("hex")}`;
  return Object.freeze({ contractVersion: VEHICLE_ADMISSION_CONTRACT, admissionId, outcome, confidence: outcome === "ADMITTED" ? confidence(identity) : null, identity, unresolvedFields: Object.freeze(unresolvedFields), findings: Object.freeze(findings) });
}

export function deriveVehicleCapabilityEnvelope(input: Readonly<{
  admission: VehicleAdmission;
  calibration: MasterCalibrationResolution;
  editQualified: boolean;
  reconstructionQualified: boolean;
  checksumQualified: boolean;
  analysisEvidence: "qualified" | "unavailable" | "invalid";
  telemetryAuthority: "qualified" | "unavailable" | "invalid";
}>): CapabilityEnvelope {
  const admitted = input.admission.outcome === "ADMITTED";
  if (!admitted) return Object.freeze({ vehicleWorkspace: "BLOCKED_IDENTITY", analysis: "BLOCKED_IDENTITY", telemetry: "BLOCKED_IDENTITY", calibrationView: "BLOCKED_IDENTITY", calibrationAddresses: "UNAVAILABLE", definitionSet: "UNAVAILABLE", calibrationEdit: "BLOCKED_DEPENDENCY", calibrationReconstruct: "BLOCKED_DEPENDENCY", calibrationExport: "BLOCKED_DEPENDENCY", flash: "NOT_QUALIFIED", acquiredXdfContribution: "NOT_APPLICABLE", newRomEvidenceRevision: null });
  const exactCalibration = input.calibration.outcome === "EXACT_QUALIFIED_MATCH";
  const calibrationConflict = input.calibration.outcome === "AMBIGUOUS_MATCH" || input.calibration.outcome === "DEFINITION_CONFLICT" || input.calibration.outcome === "INVALID_BINARY";
  const edit = exactCalibration && input.editQualified;
  const reconstruct = edit && input.reconstructionQualified;
  const exportState = !reconstruct ? "BLOCKED_DEPENDENCY" as const : input.checksumQualified ? "AVAILABLE" as const : "CHECKSUM_UNKNOWN" as const;
  return Object.freeze({
    vehicleWorkspace: "AVAILABLE",
    analysis: input.analysisEvidence === "qualified" ? "AVAILABLE" : "EVIDENCE_REQUIRED",
    telemetry: input.telemetryAuthority === "qualified" ? "AVAILABLE" : "QUALIFICATION_REQUIRED",
    calibrationView: exactCalibration ? "AVAILABLE" : calibrationConflict ? "BLOCKED_CONFLICT" : "DEFINITIONS_UNAVAILABLE",
    calibrationAddresses: exactCalibration ? "QUALIFIED" : "UNAVAILABLE",
    definitionSet: exactCalibration ? "QUALIFIED" : "UNAVAILABLE",
    calibrationEdit: edit ? "AVAILABLE" : "BLOCKED_DEPENDENCY",
    calibrationReconstruct: reconstruct ? "AVAILABLE" : "BLOCKED_DEPENDENCY",
    calibrationExport: exportState,
    flash: "NOT_QUALIFIED",
    acquiredXdfContribution: input.calibration.outcome === "ROM_UNKNOWN" || input.calibration.outcome === "ROM_RECOGNIZED_DEFINITION_MISSING" ? "CANDIDATE_EVIDENCE_ALLOWED" : "NOT_APPLICABLE",
    newRomEvidenceRevision: input.calibration.coverage.discoveryPackage?.packageRevision ?? null,
  });
}

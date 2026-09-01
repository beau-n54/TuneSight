import type { EngineeringBinary } from "../tunes/binaryContainer.ts";
import type { DefinitionCoverageResolution } from "../xdf/definitionCoverageDiscovery.ts";

export const SUBSCRIBER_CALIBRATION_LOADING_CONTRACT = "tunesight.subscriber-calibration-loading.v1" as const;
export type SubscriberCalibrationLoadResult = Readonly<{ outcome: "ready_for_dataset_materialization" | "resolution_required" | "blocked"; binary: EngineeringBinary; coverage: DefinitionCoverageResolution; definitionSetRevision: string | null; workshopEligible: boolean; findings: readonly string[] }>;

export function resolveSubscriberCalibrationLoad(input: Readonly<{ binary: EngineeringBinary; coverage: DefinitionCoverageResolution }>): SubscriberCalibrationLoadResult {
  const exact = input.coverage.outcome === "EXACT_DEFINITION_COVERAGE" && input.coverage.workshopEligible;
  const blocked = input.coverage.outcome === "CONFLICT" || input.coverage.outcome === "INVALID";
  const definitionSetRevision = exact ? input.coverage.exactDefinitionSetRevision : null;
  if (exact && !definitionSetRevision) throw new Error("Exact coverage must bind a Definition Set revision.");
  return Object.freeze({ outcome: exact ? "ready_for_dataset_materialization" : blocked ? "blocked" : "resolution_required", binary: input.binary, coverage: input.coverage, definitionSetRevision, workshopEligible: exact, findings: Object.freeze(exact ? ["Subscriber-owned exact binary is ready for the existing qualified Dataset materialization gate."] : [...input.coverage.findings]) });
}

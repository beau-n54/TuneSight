import assert from "node:assert/strict";
import test from "node:test";
import { resolveBinaryContainer } from "../tunes/binaryContainer.ts";
import type { DefinitionCoverageResolution } from "../xdf/definitionCoverageDiscovery.ts";
import { resolveSubscriberCalibrationLoad } from "./subscriberCalibrationLoading.ts";

const binary = resolveBinaryContainer({ bytes: Buffer.alloc(64), fileName: "subscriber.bin" }).engineeringBinary!;
const coverage = (outcome: DefinitionCoverageResolution["outcome"], exactDefinitionSetRevision: string | null, workshopEligible: boolean): DefinitionCoverageResolution => Object.freeze({ resolutionId: `resolution:${outcome}`, resolutionRevision: `revision:${outcome}`, contractVersion: "tunesight.definition-coverage-discovery.v1", outcome, observationId: "observation:subscriber", exactDefinitionSetRevision, candidateIds: Object.freeze([]), discoveryPackage: null, workshopEligible, workshopMessage: outcome, findings: Object.freeze([outcome]), publicationSideEffects: Object.freeze([]) as readonly [] });

test("subscriber binary advances only exact qualified coverage to the existing Dataset gate", () => {
  const exact = resolveSubscriberCalibrationLoad({ binary, coverage: coverage("EXACT_DEFINITION_COVERAGE", "xdf-definition-set-revision:exact", true) });
  assert.equal(exact.outcome, "ready_for_dataset_materialization"); assert.equal(exact.workshopEligible, true);
  for (const outcome of ["CANDIDATE_DEFINITION_COVERAGE", "ROM_RECOGNIZED_DEFINITIONS_UNAVAILABLE", "NEW_ROM_DISCOVERED"] as const) assert.equal(resolveSubscriberCalibrationLoad({ binary, coverage: coverage(outcome, null, false) }).outcome, "resolution_required");
  for (const outcome of ["CONFLICT", "INVALID"] as const) assert.equal(resolveSubscriberCalibrationLoad({ binary, coverage: coverage(outcome, null, false) }).outcome, "blocked");
});

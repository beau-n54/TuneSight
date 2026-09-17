import assert from "node:assert/strict";
import test from "node:test";
import type { QualifiedCalibrationDataset } from "../xdf/qualifiedCalibrationDataset.ts";
import type { SubscriberCalibrationSuccess } from "./subscriberCalibrationProvider.ts";
import { resolveVehicleOwnedCalibrationEvidence } from "./vehicleOwnedCalibrationEvidence.ts";

const dataset = (role: string, side: "reference" | "current", overrides: Partial<QualifiedCalibrationDataset> = {}): QualifiedCalibrationDataset => ({
  datasetId: `dataset:${side}`,
  datasetRevision: `dataset-revision:${side}`,
  exactBinaryIdentity: { identityId: `binary:${side}`, digest: side.repeat(32), byteLength: 4, containerType: "bin", romFamily: "fixture", softwareIdentity: "ROM", calibrationIdentity: "ROM", internalRomIdentifiers: ["ROM"], identityProvenance: ["fixture"] },
  romLayoutId: "layout:fixture",
  relationshipId: "relationship:fixture",
  relationshipRevision: "relationship-revision:fixture",
  definitionSetId: "definition-set:fixture",
  definitionSetRevisionId: "definition-set-revision:fixture",
  applicabilityRegistrySnapshotId: "snapshot:fixture",
  sourceRole: role,
  provenance: ["controlled fixture"],
  limitations: [],
  definitions: [],
  ...overrides,
} as QualifiedCalibrationDataset);

function success(reference: QualifiedCalibrationDataset | null = null, current = dataset("user_modified", "current")): SubscriberCalibrationSuccess {
  return { status: "workshop_ready", workshop: {} as SubscriberCalibrationSuccess["workshop"], material: reference ? { reference, current, comparison: {} as never } : { reference: null, current, comparison: null }, identity: "ROM", digest: current.exactBinaryIdentity.digest, container: "bin", byteLength: 4, coverage: {} as never, quarantines: [], editCapabilities: [], timings: {}, sourceLease: undefined };
}

test("vehicle-owned resolver recovers explicit Current-only evidence", () => {
  const result = resolveVehicleOwnedCalibrationEvidence({ ownerId: "owner-a", vehicleId: "vehicle-a", result: success() });
  assert.equal(result.outcome, "current_only");
  assert.equal(result.currentCalibration?.role, "current");
  assert.equal(result.referenceCalibration, null);
  assert.equal(result.currentCalibration?.sourceBinaryLease, "unavailable_or_expired");
});

test("qualified Reference and Current resolve comparison while incompatible authority is retained without comparison", () => {
  const reference = dataset("stock_candidate", "reference");
  assert.equal(resolveVehicleOwnedCalibrationEvidence({ ownerId: "owner", vehicleId: "vehicle", result: success(reference) }).outcome, "comparison_ready");
  const incompatible = dataset("stock_candidate", "reference", { definitionSetRevisionId: "different" });
  const rejected = resolveVehicleOwnedCalibrationEvidence({ ownerId: "owner", vehicleId: "vehicle", result: success(incompatible) });
  assert.equal(rejected.outcome, "comparison_unavailable");
  assert.ok(rejected.referenceCalibration && rejected.currentCalibration);
});

test("ambiguous source roles fail closed and no evidence remains neutral", () => {
  const ambiguousCurrent = success(null, dataset("other_observed", "current"));
  assert.equal(resolveVehicleOwnedCalibrationEvidence({ ownerId: "owner", vehicleId: "vehicle", result: ambiguousCurrent }).outcome, "ambiguous_role");
  const ambiguousReference = success(dataset("comparison_candidate", "reference"));
  assert.equal(resolveVehicleOwnedCalibrationEvidence({ ownerId: "owner", vehicleId: "vehicle", result: ambiguousReference }).outcome, "ambiguous_role");
  assert.equal(resolveVehicleOwnedCalibrationEvidence({ ownerId: "owner", vehicleId: "vehicle", result: null }).outcome, "no_evidence");
});

test("owner and vehicle scopes are explicit and Working remains Dataset-bound", () => {
  const first = resolveVehicleOwnedCalibrationEvidence({ ownerId: "owner-a", vehicleId: "vehicle-a", result: success() });
  const owner = resolveVehicleOwnedCalibrationEvidence({ ownerId: "owner-b", vehicleId: "vehicle-a", result: success() });
  const vehicle = resolveVehicleOwnedCalibrationEvidence({ ownerId: "owner-a", vehicleId: "vehicle-b", result: success() });
  assert.notDeepEqual([first.ownerId, first.vehicleId], [owner.ownerId, owner.vehicleId]);
  assert.notDeepEqual([first.ownerId, first.vehicleId], [vehicle.ownerId, vehicle.vehicleId]);
  assert.equal(first.currentCalibration?.datasetIdentity, "dataset:current");
  assert.equal(first.currentCalibration?.datasetRevision, "dataset-revision:current");
});

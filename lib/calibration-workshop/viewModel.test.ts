import assert from "node:assert/strict";
import test from "node:test";
import { bindDefinitionKnowledge } from "./definitionKnowledgeBinding.ts";
import type { QualifiedCalibrationDataset } from "../xdf/qualifiedCalibrationDataset.ts";
import type { QualifiedCalibrationComparisonEvidence } from "../xdf/qualifiedCalibrationComparison.ts";
import {
  buildWorkshopViewModel,
  filterWorkshopDefinitions,
  selectWorkshopDefinitionKey,
} from "./viewModel.ts";

const engineering = (values: readonly number[]) => ({
  engineeringValues: values,
  axes: [{ axisId: "X", outcome: "identity", units: "rpm", engineeringValues: values.map((_, index) => index * 1000), literalValues: [] }],
  cellTrace: values.map((value, index) => ({ index, row: 0, column: index, rawOffset: 100 + index, rawValue: value, engineeringValue: value })),
  valueEquation: { equationRevision: "equation:1" },
});

const definitions = [
  {
    definitionIdentity: "definition:changed", definitionRevisionId: "revision:changed", title: "Changed map", description: "Literal searchable description", sourceArtifactDigest: "sha256:source", dimensions: { kind: "array_1d", rows: 1, columns: 2 }, units: "deg", equationRevision: "equation:1", outcome: "changed", totalCells: 2, changedCellCount: 1, unchangedCellCount: 1, percentageCellsChanged: 50, maximumSignedIncrease: 1, maximumSignedDecrease: null, maximumAbsoluteDelta: 1, affectedRows: [0], affectedColumns: [1], changedCells: [{ index: 1, row: 0, column: 1, referenceRawOffset: 101, modifiedRawOffset: 101, referenceRawValue: 2, modifiedRawValue: 3, referenceEngineeringValue: 2, modifiedEngineeringValue: 3, signedDelta: 1, absoluteDeltaMagnitude: 1, percentageDelta: { outcome: "available", value: 50 }, units: "deg", equationRevision: "equation:1" }], changedRegions: [], axisComparisons: [], referenceEngineeringEvidence: engineering([1, 2]), modifiedEngineeringEvidence: engineering([1, 3]), findings: [],
  },
  {
    definitionIdentity: "definition:unchanged", definitionRevisionId: "revision:unchanged", title: "Unchanged map", description: null, sourceArtifactDigest: "sha256:source", dimensions: { kind: "scalar", rows: 1, columns: 1 }, units: null, equationRevision: "equation:1", outcome: "unchanged", totalCells: 1, changedCellCount: 0, unchangedCellCount: 1, percentageCellsChanged: 0, maximumSignedIncrease: null, maximumSignedDecrease: null, maximumAbsoluteDelta: null, affectedRows: [], affectedColumns: [], changedCells: [], changedRegions: [], axisComparisons: [], referenceEngineeringEvidence: engineering([4]), modifiedEngineeringEvidence: engineering([4]), findings: [],
  },
  {
    definitionIdentity: null, definitionRevisionId: "revision:unavailable", title: "Unavailable map", description: null, sourceArtifactDigest: "sha256:source", dimensions: null, units: null, equationRevision: null, outcome: "comparison_unavailable", totalCells: 0, changedCellCount: 0, unchangedCellCount: 0, percentageCellsChanged: null, maximumSignedIncrease: null, maximumSignedDecrease: null, maximumAbsoluteDelta: null, affectedRows: [], affectedColumns: [], changedCells: [], changedRegions: [], axisComparisons: [], referenceEngineeringEvidence: null, modifiedEngineeringEvidence: null, findings: ["Conversion unavailable"],
  },
] as unknown as QualifiedCalibrationComparisonEvidence["definitions"];

const dataset = (role: "stock_candidate" | "mapswitch") => ({
  datasetId: `dataset:${role}`, datasetRevision: `dataset-revision:${role}`, exactBinaryIdentity: { digest: `digest:${role}` }, sourceRole: role, romLayoutId: "layout:IJE0S", relationshipId: "relationship:1", relationshipRevision: "relationship-revision:1", definitionSetRevisionId: "set:1", applicabilityRegistrySnapshotId: "registry:1", provenance: [`Controlled ${role} fixture`], limitations: ["Stock authenticity is not assessed."], definitions: definitions.map((definition) => ({ definitionRevisionId: definition.definitionRevisionId, unavailableStage: definition.definitionRevisionId === "revision:unavailable" ? "conversion" : null, findings: definition.findings })),
}) as unknown as QualifiedCalibrationDataset;

const comparison = {
  comparisonId: "comparison:1", comparisonRevision: "comparison-revision:1", contractVersion: "tunesight.qualified-calibration-comparison-evidence.v1", outcome: "compared", reference: { exactBinaryDigest: "digest:stock", role: "stock_candidate", provenance: [] }, modified: { exactBinaryDigest: "digest:map", role: "mapswitch", provenance: [] }, romLayoutId: "layout:IJE0S", relationshipId: "relationship:1", relationshipRevision: "relationship-revision:1", definitionSetRevisionId: "set:1", registrySnapshotId: "registry:1", totalDefinitionsConsidered: 3, changedDefinitions: 1, unchangedDefinitions: 1, axisChangedDefinitions: 0, valueAndAxisChangedDefinitions: 0, unavailableDefinitions: 1, conflictedDefinitions: 0, totalChangedCells: 1, definitions, findings: [],
} as QualifiedCalibrationComparisonEvidence;

test("Workshop View Model preserves fixture truth, complete universe and four states", () => {
  const model = buildWorkshopViewModel({ reference: dataset("stock_candidate"), current: dataset("mapswitch"), comparison });
  assert.equal(model.source.kind, "development_fixture");
  assert.equal(model.states[0]?.availability, "available");
  assert.equal(model.states[0]?.sourceRole, "Stock Candidate");
  assert.equal(model.states[1]?.availability, "available");
  assert.equal(model.states[2]?.availability, "unavailable");
  assert.equal(model.states[3]?.availability, "unavailable");
  assert.equal(model.definitions.length, comparison.totalDefinitionsConsidered);
  assert.equal(model.definitions.filter((item) => !item.available).length, 1);
  assert.equal(model.comparison.changedCells, 1);
  assert.equal(model.capabilities.mutation, false);
  assert.equal(model.capabilities.semanticKnowledge, false);
  assert.ok(!JSON.stringify(model).includes("bytes"));
  assert.ok(!JSON.stringify(model).includes("Verified Stock"));
  assert.ok(model.limitations.some((value) => value.includes("not derived from the selected vehicle")));
});

test("literal search and Evidence filters are deterministic", () => {
  const model = buildWorkshopViewModel({ reference: dataset("stock_candidate"), current: dataset("mapswitch"), comparison });
  const changedKey = model.definitions[0]!.key;
  const unchangedKey = model.definitions[1]!.key;
  const unavailableKey = model.definitions[2]!.key;
  assert.deepEqual(filterWorkshopDefinitions(model.definitions, "searchable", "all").map((item) => item.key), [changedKey]);
  assert.deepEqual(filterWorkshopDefinitions(model.definitions, "", "changed").map((item) => item.key), [changedKey]);
  assert.deepEqual(filterWorkshopDefinitions(model.definitions, "", "unchanged").map((item) => item.key), [unchangedKey]);
  assert.deepEqual(filterWorkshopDefinitions(model.definitions, "", "unavailable").map((item) => item.key), [unavailableKey]);
  assert.equal(selectWorkshopDefinitionKey(model.definitions), changedKey);
  assert.equal(selectWorkshopDefinitionKey(model.definitions, unchangedKey), unchangedKey);
});

test("selected Grid and cell delta data remain presentation-only", () => {
  const model = buildWorkshopViewModel({ reference: dataset("stock_candidate"), current: dataset("mapswitch"), comparison });
  assert.equal(model.selectedDefinition.cells.length, 2);
  assert.equal(model.selectedDefinition.cells[1]?.signedDelta, 1);
  assert.equal(model.selectedDefinition.cells[1]?.percentageDelta, 50);
  assert.equal(model.selectedDefinition.cells[1]?.referenceRawOffset, 101);
});

test("every generated Definition retains structural information without semantic Knowledge", () => {
  const model = buildWorkshopViewModel({ reference: dataset("stock_candidate"), current: dataset("mapswitch"), comparison });
  assert.equal(model.definitions.every((definition) => definition.semantic.outcome === "unavailable"), true);
  assert.equal(model.capabilities.semanticKnowledge, false);
  assert.equal(model.selectedDefinition.information.workshopInstanceIdentity, model.selectedDefinition.summary.key);
  assert.equal(model.selectedDefinition.information.definitionSetRevision, "set:1");
  assert.equal(model.selectedDefinition.information.units, model.selectedDefinition.summary.units);
  assert.equal(model.selectedDefinition.information.axes.length, 1);
  assert.equal(model.selectedDefinition.information.sourceCategory, null);
});

test("conflict is retained as a distinct future presentation state", () => {
  const conflict = { ...modelDefinition("revision:conflict"), outcome: "representation_conflict", available: false } as const;
  assert.deepEqual(filterWorkshopDefinitions([conflict], "", "conflict"), [conflict]);
});

function modelDefinition(key: string) {
  const identity = { key, occurrence: 0, definitionIdentity: null, definitionRevision: key, title: "Conflict", description: null, shape: "unavailable" as const, units: null, outcome: "comparison_unavailable" as const, changedCellCount: 0, available: false };
  return { ...identity, semantic: bindDefinitionKnowledge(identity, []) };
}

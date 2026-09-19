import assert from "node:assert/strict";
import fs from "node:fs";
import test, { before } from "node:test";
import { loadSubscriberCalibration, type SubscriberCalibrationSuccess } from "./subscriberCalibrationProvider.ts";
import { materializeWorkshopDefinition } from "./viewModel.ts";
import { projectSharedTable, type SharedTableProjectionInput } from "./sharedTableProjection.ts";
import { controlledProjectionFixture, fixtureAxis, subscriberProjectionInput, U0_FIXTURE_LIMITATION } from "./sharedTableProjection.fixtures.ts";
import { decideExportCapability } from "./calibrationReconstruction.ts";
import { createWorkingCalibration } from "./workingCalibration.ts";
import type { AvailableCalibrationDatasetDefinition, QualifiedCalibrationDataset } from "../xdf/qualifiedCalibrationDataset.ts";
import type { TableQuarantineRecord } from "../xdf/tableQuarantine.ts";

let n54: SubscriberCalibrationSuccess;
before(async () => {
  const result = await loadSubscriberCalibration({ bytes: fs.readFileSync("BMW-XDFs-master/N54/IJE0S_MapSwitchBase.bin"),
    fileName: "u0-anchor.bin", mimeType: null, observedAt: "2026-09-20T00:00:00.000Z" });
  assert.equal(result.status, "workshop_ready");
  if (result.status !== "workshop_ready") throw new Error("Accepted N54 anchor unavailable.");
  n54 = result;
});
const fixture = (options: Parameters<typeof controlledProjectionFixture>[1]) => controlledProjectionFixture(n54.material.current, options);
function dataset(input: SharedTableProjectionInput): QualifiedCalibrationDataset {
  assert.equal(input.current.state, "available");
  if (input.current.state !== "available") throw new Error("Expected fixture Dataset");
  return input.current.dataset;
}
function replaceDefinition(input: SharedTableProjectionInput, update: (definition: AvailableCalibrationDatasetDefinition) => QualifiedCalibrationDataset["definitions"][number]) {
  const source = dataset(input), definition = source.definitions[0];
  assert.ok(definition.engineeringEvidence);
  return { ...input, current: { state: "available" as const, dataset: { ...source,
    definitions: [update(definition as AvailableCalibrationDatasetDefinition)] } } };
}

function assertOwnerParity(result: SubscriberCalibrationSuccess, context: { diagnostic(message: string): void }) {
  let cells = 0, axes = 0, quarantined = 0;
  for (const selected of result.workshop.definitions) {
    const input = subscriberProjectionInput(result, selected), projection = projectSharedTable(input);
    const current = projection.slots.current;
    const original = result.material.current.definitions.filter(item => item.definitionRevisionId === selected.definitionRevision)[selected.occurrence];
    assert.equal(projection.selection.key, selected.key);
    assert.equal(current.definition?.revision, selected.definitionRevision);
    assert.equal(current.definition?.identity, original.definitionIdentity);
    assert.equal(current.definition?.occurrence, selected.occurrence);
    assert.deepEqual(projection.context, input.context);
    assert.equal(current.dataset?.datasetRevision, result.material.current.datasetRevision);
    assert.equal(current.dataset?.definitionSetRevision, result.material.current.definitionSetRevisionId);
    assert.equal(current.dataset?.relationshipRevision, result.material.current.relationshipRevision);
    assert.deepEqual(current.rawEvidence, original.rawEvidence);
    assert.deepEqual(projection.semantic, selected.semantic);
    assert.deepEqual(projection.capabilities.edit, input.edit);
    assert.equal(projection.capabilities.export, null);
    assert.equal(projection.capabilities.flash, null);
    assert.deepEqual(projection.comparison, input.comparison);
    if (current.state === "quarantined") { quarantined++; assert.deepEqual(current.cells, []); continue; }
    const evidence = original.engineeringEvidence;
    assert.deepEqual(current.cells.map(cell => [cell.index, cell.row, cell.column, cell.value, cell.rawValue, cell.rawOffset, cell.units]),
      evidence?.cellTrace.map(cell => [cell.index, cell.row, cell.column, cell.engineeringValue, cell.rawValue, cell.rawOffset, evidence.units]) ?? []);
    assert.deepEqual(current.sourceAxes, evidence?.axes ?? []);
    assert.equal(current.definition?.sourceUnits, original.units);
    assert.equal(current.definition?.displayUnits, evidence?.units ?? null);
    cells += current.cells.length; axes += current.axes.length;
    const native = "mode" in result.workshop ? result.workshop.definitions.find(item => item.key === selected.key)!
      : materializeWorkshopDefinition(result.workshop, selected.key);
    assert.deepEqual(current.cells.map(cell => [cell.index, cell.row, cell.column, cell.value, cell.rawValue, cell.rawOffset, cell.units]),
      native.cells.map(cell => [cell.index, cell.row, cell.column, cell.currentValue, cell.currentRawValue, cell.currentRawOffset, cell.units]));
    if (input.reference.state === "available") {
      const originalReference = input.reference.dataset.definitions.filter(item => item.definitionRevisionId === selected.definitionRevision)[selected.occurrence];
      assert.deepEqual(projection.slots.reference.cells.map(cell => [cell.index, cell.row, cell.column, cell.value, cell.rawValue, cell.rawOffset, cell.units]),
        originalReference.engineeringEvidence?.cellTrace.map(cell => [cell.index, cell.row, cell.column, cell.engineeringValue,
          cell.rawValue, cell.rawOffset, originalReference.engineeringEvidence?.units]) ?? []);
      assert.deepEqual(projection.slots.reference.sourceAxes, originalReference.engineeringEvidence?.axes ?? []);
    } else assert.equal(projection.slots.reference.state, "missing");
  }
  context.diagnostic(`U0_PARITY ${JSON.stringify({ rom: result.identity, digest: result.digest,
    datasetRevision: result.material.current.datasetRevision, definitionSetRevision: result.material.current.definitionSetRevisionId,
    definitions: result.workshop.definitions.length, currentCells: cells, projectedAxes: axes, quarantined })}`);
}

test("S01/R01: accepted IJE0S comparison retains every owner cell, axis, unit, capability and exact identity", context => {
  assert.equal(n54.identity, "IJE0S");
  assert.equal(n54.workshop.definitions.length, 739);
  assertOwnerParity(n54, context);
});

test("S01: accepted B58 Gen1 Current-only retains every owner output", async context => {
  // Same controlled byte vector as the accepted subscriber provider regression.
  // This exercises the published relationship; it is not a physical vehicle test.
  const bytes = new Uint8Array(7_864_320);
  for (const offset of [262469, 6814977, 7863823]) bytes.set(Buffer.from("00003076501103", "hex"), offset);
  const result = await loadSubscriberCalibration({ bytes,
    fileName: "u0-b58-anchor.bin", mimeType: null, observedAt: "2026-09-20T00:00:00.000Z" });
  assert.equal(result.status, "workshop_ready");
  if (result.status !== "workshop_ready") return;
  assert.equal(result.identity, "00003076501103");
  assert.equal(result.material.reference, null);
  assertOwnerParity(result, context);
});

test("S01/S04: controlled raw MG1/86T0 DTF Current-only anchor preserves exact owner outputs", async context => {
  // Controlled provider vector, not the Founder's physical Supra artifact or an authenticated subscriber session.
  // Owner dimensions remain separate: Founder vehicle context B58 Gen1; physical DME marker
  // MG1 86T0 / DME8.6.T B58TUE V1; ROM 00005D553C8C05; historical Definition-source family B58gen2.
  const bytes = Buffer.alloc(8 * 1024 * 1024, 0xff);
  for (const [offset, marker] of [
    [0x2001a, "#DME_8XT0#C2#HWE#Hardware_DME8XT1_35UP"], [0x2020a, "#DME_86Tx#C2#HWA#DME8.6.T_B58TUE_V1"],
    [0x5fe1e, "#DME_86T0#C2#BTL#MDG1G_35up"], [0x6a0540, "56/1/MG1CS201/11/MG1CS201_BX8TUE"],
    [0x7ffe36, "#DME_86T0__________#C2#DST"],
  ] as const) bytes.write(marker, offset, "ascii");
  for (const offset of [524613, 7339265, 8388111]) bytes.set(Buffer.from("00005D553C8C05", "hex"), offset);
  bytes.set(Buffer.from("00005D553C7805", "hex"), 131371);
  const result = await loadSubscriberCalibration({ bytes, fileName: "u0-anchor.dtf", mimeType: null, observedAt: "2026-09-20T00:00:00.000Z" });
  assert.equal(result.status, "workshop_ready");
  if (result.status !== "workshop_ready") return;
  assert.equal(result.identity, "00005D553C8C05");
  assert.equal(result.container, "dtf");
  assertOwnerParity(result, context);
});

for (const shape of ["scalar", "array_1d", "table_2d"] as const) {
  test(`R01: ${shape} preserves structural truth with and without Reference`, () => {
    const input = fixture({ shape, rows: shape === "table_2d" ? 2 : 1, columns: shape === "scalar" ? 1 : 3,
      axes: shape === "scalar" ? [] : shape === "array_1d" ? [fixtureAxis("x", [2, 4, 8])]
        : [fixtureAxis("x", [2, 4, 8]), fixtureAxis("y", [10, 20])] });
    const currentOnly = projectSharedTable(input);
    const withReference = projectSharedTable({ ...input, reference: input.current });
    assert.deepEqual(currentOnly.slots.current, withReference.slots.current);
    assert.equal(currentOnly.slots.current.geometry.line.supported, shape !== "scalar");
    assert.equal(currentOnly.slots.current.geometry.surface.supported, shape === "table_2d");
    assert.equal(currentOnly.slots.current.axes.length, shape === "scalar" ? 0 : shape === "array_1d" ? 1 : 2);
    assert.ok(Object.is(currentOnly.slots.current.cells[0].value, -0));
  });
}

test("R02: equal dimensions use explicit X/Y source identity independent of axis order", () => {
  const input = fixture({ shape: "table_2d", rows: 2, columns: 2,
    axes: [fixtureAxis("y", [30, 60], "source y"), fixtureAxis("x", [1, 2], "source x")] });
  const output = projectSharedTable(input).slots.current;
  assert.deepEqual(output.axes.map(axis => [axis.id, axis.orientation, axis.values, axis.units]),
    [["y", "Y", [30, 60], "source y"], ["x", "X", [1, 2], "source x"]]);
  assert.equal(output.geometry.surface.supported, true);
});
for (const scenario of ["missing", "unnamed", "duplicate", "wrong-length"] as const) {
  test(`R02: ${scenario} axis binding is explicitly unsupported without a length/title fallback`, () => {
    const axes = scenario === "missing" ? [] : scenario === "unnamed" ? [fixtureAxis("RPM", [1, 2]), fixtureAxis("Load", [3, 4])]
      : scenario === "duplicate" ? [fixtureAxis("x", [1, 2]), fixtureAxis("X", [3, 4]), fixtureAxis("y", [5, 6])]
        : [fixtureAxis("x", [1]), fixtureAxis("y", [5, 6])];
    const output = projectSharedTable(fixture({ shape: "table_2d", rows: 2, columns: 2, axes })).slots.current;
    assert.equal(output.geometry.grid, true);
    assert.equal(output.geometry.line.supported, false);
    assert.equal(output.geometry.surface.supported, false);
    assert.ok(output.geometry.surface.reason);
    assert.deepEqual(output.sourceAxes, axes);
  });
}
for (const values of [["low", "high", "medium"], [1, 1, 3], [1, 3, 2]] as const) {
  test(`R02: ${JSON.stringify(values)} preserves source order and forbids an invented numeric surface`, () => {
    const output = projectSharedTable(fixture({ shape: "table_2d", rows: 2, columns: 3,
      axes: [fixtureAxis("x", values), fixtureAxis("y", [5, 10])] })).slots.current;
    assert.deepEqual(output.axes[0].values, values);
    assert.equal(output.geometry.line.supported, true);
    assert.equal(output.geometry.surface.supported, false);
  });
}
test("R02: unknown semantics/units remain absent while supplied numerical axes remain usable", () => {
  const output = projectSharedTable(fixture({ shape: "array_1d", rows: 1, columns: 2, units: null,
    axes: [fixtureAxis("x", [10, 20], null)] }));
  assert.equal(output.semantic, null);
  assert.equal(output.slots.current.definition?.sourceUnits, null);
  assert.equal(output.slots.current.definition?.displayUnits, null);
  assert.equal(output.slots.current.axes[0].units, null);
  assert.equal(output.slots.current.geometry.line.supported, true);
});
test("R01: a vertical 1D Table uses only genuine Y evidence", () => {
  const input = fixture({ shape: "array_1d", rows: 3, columns: 1, axes: [fixtureAxis("y", [1, 2, 3])] });
  const output = projectSharedTable(input).slots.current;
  assert.equal(output.geometry.line.supported, true);
  assert.deepEqual(output.axes.map(axis => axis.orientation), ["Y"]);
});
test("R02: incomplete topology retains exact qualified cells but never fills holes", () => {
  const input = fixture({ shape: "table_2d", rows: 2, columns: 2, axes: [fixtureAxis("x", [1, 2]), fixtureAxis("y", [3, 4])] });
  const incomplete = replaceDefinition(input, definition => ({ ...definition, engineeringEvidence: { ...definition.engineeringEvidence,
    engineeringValues: definition.engineeringEvidence.engineeringValues.slice(0, 3), cellTrace: definition.engineeringEvidence.cellTrace.slice(0, 3) } }));
  const output = projectSharedTable(incomplete).slots.current;
  assert.equal(output.cells.length, 3);
  assert.equal(output.geometry.grid, true);
  assert.equal(output.geometry.surface.supported, false);
});
test("S02/S03: missing, unresolved and read-failure slots preserve reasons without fabricated cells", () => {
  const input = fixture({ shape: "scalar", rows: 1, columns: 1 });
  for (const state of ["missing", "unresolved", "read_failure"] as const) {
    const absence = { state, findings: [`owner-supplied ${state}`] };
    const output = projectSharedTable({ ...input, current: absence, reference: absence });
    assert.equal(output.slots.current.state, state);
    assert.deepEqual(output.slots.current.findings, absence.findings);
    assert.deepEqual(output.slots.current.cells, []);
    assert.equal(output.capabilities.edit, null);
    assert.equal(output.slots.working, null);
    assert.equal(output.slots.suggested.state, "unavailable");
  }
});
test("S02: incompatible Reference has no effect on Current interpretation or comparison qualification", () => {
  const input = fixture({ shape: "array_1d", rows: 1, columns: 2, axes: [fixtureAxis("x", [1, 2])] });
  const reference = { ...dataset(input), definitions: [] };
  const output = projectSharedTable({ ...input, reference: { state: "available", dataset: reference },
    comparison: { state: "unavailable", findings: ["Owner: incompatible Definition revision"] } });
  assert.deepEqual(output.slots.current, projectSharedTable(input).slots.current);
  assert.equal(output.slots.reference.state, "unresolved");
  assert.deepEqual(output.comparison, { state: "unavailable", findings: ["Owner: incompatible Definition revision"] });
});
test("S03: exact quarantine suppresses engineering values while retaining owner evidence and unaffected occurrences", () => {
  const input = fixture({ shape: "scalar", rows: 1, columns: 1 }), source = dataset(input), definition = source.definitions[0];
  const quarantine: TableQuarantineRecord = {
    contractVersion: "tunesight.calibration-table-quarantine.v1", quarantineId: "u0-synthetic-quarantine", quarantineRevision: "u0-synthetic-quarantine:v1",
    relationship: { romSoftwareIdentity: "synthetic", sourceArtifactId: source.sourceArtifactId, definitionSetRevision: source.definitionSetRevisionId },
    occurrence: { definitionIdentity: definition.definitionIdentity!, definitionRevisionId: definition.definitionRevisionId,
      sourceBindingDigest: definition.sourceBindingDigest, occurrence: 0 },
    affectedBinary: { digest: source.exactBinaryIdentity.digest, role: "synthetic", validationRevision: "u0-synthetic-validation:v1" },
    failureClass: "other_governed_non_usable", failureEvidence: { rawOffsets: [], rawBytes: [], rawValues: [], equation: null,
      outcome: "synthetic_block", finding: "Synthetic owner-supplied quarantine; no real qualification claim." },
    safetyAssessmentRevision: "u0-synthetic-safety:v1", provenance: [U0_FIXTURE_LIMITATION], limitations: [U0_FIXTURE_LIMITATION],
    authority: { reviewerId: "synthetic-test-owner", authorityRevision: "u0-test-authority:v1" }, quarantinedAt: "2026-09-20T00:00:00.000Z",
    state: "unavailable_quarantined", permissions: { engineeringValueValid: false, editable: false, suggestedCalibrationEligible: false,
      reconstructionMutationEligible: false, flashingEligible: false },
  };
  const repeated = { ...input, quarantines: [quarantine], current: { state: "available" as const,
    dataset: { ...source, definitions: [definition, definition] } } };
  const output = projectSharedTable(repeated);
  assert.equal(output.tableIdentity, projectSharedTable({ ...repeated, quarantines: [] }).tableIdentity);
  assert.equal(output.capabilities.view.current, "quarantined");
  assert.deepEqual(output.slots.current.cells, []);
  assert.deepEqual(output.slots.current.axes, []);
  assert.deepEqual(output.slots.current.quarantine, quarantine);
  assert.equal(output.slots.current.geometry.grid, false);
  assert.equal(projectSharedTable({ ...repeated, selection: { ...input.selection, occurrence: 1 } }).slots.current.state, "available");
  assert.equal(projectSharedTable({ ...input, quarantines: [{ ...quarantine, affectedBinary: { ...quarantine.affectedBinary, digest: "different binary" } }] }).slots.current.state, "available");
});
test("S03: unavailable conversion and representation-conflict states retain metadata without zeros", () => {
  for (const state of ["conversion_unsupported", "representation_conflict"] as const) {
    const input = replaceDefinition(fixture({ shape: "scalar", rows: 1, columns: 1 }), definition => ({ ...definition,
      state, unavailableStage: "conversion", engineeringEvidence: null, findings: [`Owner outcome: ${state}`] }));
    const output = projectSharedTable(input).slots.current;
    assert.equal(output.state, "unavailable");
    assert.equal(output.definition?.state, state);
    assert.deepEqual(output.findings, [`Owner outcome: ${state}`]);
    assert.deepEqual(output.cells, []);
    assert.equal(output.geometry.grid, false);
  }
});
test("R02: unavailable axis conversion retains its owner reason and never becomes numeric coordinates", () => {
  const axis = { ...fixtureAxis("x", []), outcome: "missing_equation" as const, finding: "Exact source equation is absent." };
  const output = projectSharedTable(fixture({ shape: "array_1d", rows: 1, columns: 2, axes: [axis] })).slots.current;
  assert.deepEqual(output.axes[0].evidence, axis);
  assert.equal(output.axes[0].available, false);
  assert.equal(output.geometry.line.supported, false);
});
for (const platform of ["N13", "N20", "N26", "N54", "N55", "S55", "B48", "B58 Gen1", "B58 Gen2", "S58", "S63", "Supra B58", "future"]) {
  test(`S04: synthetic ${platform} changes bindings without changing the product contract`, () => {
    const input = fixture({ shape: "scalar", rows: 1, columns: 1, platform, dme: "synthetic-DME", container: "dtf" });
    const output = projectSharedTable(input);
    assert.equal(output.contractVersion, "tunesight.shared-table-projection.v1");
    assert.deepEqual(output.slots.current.limitations, [U0_FIXTURE_LIMITATION]);
    assert.equal(output.slots.current.dataset?.exactBinaryIdentity.romFamily, platform);
    assert.equal(output.slots.current.dataset?.exactBinaryIdentity.containerType, "dtf");
    assert.deepEqual(Object.keys(output), Object.keys(projectSharedTable(fixture({ shape: "scalar", rows: 1, columns: 1 }))));
  });
}
test("S05: repeated titles/revisions retain distinct occurrences, exact native keys and cells", () => {
  const input = fixture({ shape: "scalar", rows: 1, columns: 1 }), source = dataset(input);
  const repeated = { ...input, current: { state: "available" as const, dataset: { ...source, definitions: [source.definitions[0], source.definitions[0]] } } };
  const first = projectSharedTable(repeated), second = projectSharedTable({ ...repeated, selection: { ...input.selection, occurrence: 1, key: "second-native-key" } });
  assert.notEqual(first.identity, second.identity);
  assert.notEqual(first.tableIdentity, second.tableIdentity);
  assert.notEqual(first.slots.current.cells[0].identity, second.slots.current.cells[0].identity);
  assert.equal(second.selection.key, "second-native-key");
  const missing = projectSharedTable({ ...repeated, selection: { ...input.selection, occurrence: 2 } });
  assert.equal(missing.slots.current.state, "unresolved");
});
test("S05: changing only the exact native key changes selected-Table and complete projection identities", () => {
  const input = fixture({ shape: "scalar", rows: 1, columns: 1 }), first = projectSharedTable(input);
  const second = projectSharedTable({ ...input, selection: { ...input.selection, key: "other-exact-native-key" } });
  assert.notEqual(second.tableIdentity, first.tableIdentity);
  assert.notEqual(second.identity, first.identity);
  assert.deepEqual(second.slots, first.slots);
});
for (const field of ["definitionRevision", "occurrence"] as const) {
  test(`S05: subscriber adapter rejects a valid Workshop key with a mismatched ${field}`, () => {
    const selected = n54.workshop.definitions[0];
    const selection = { key: selected.key, definitionRevision: selected.definitionRevision, occurrence: selected.occurrence };
    assert.doesNotThrow(() => subscriberProjectionInput(n54, selection));
    const unrelated = n54.workshop.definitions.find(item => item.definitionRevision !== selected.definitionRevision);
    assert.ok(unrelated);
    const mismatch = field === "definitionRevision" ? { ...selection, definitionRevision: unrelated.definitionRevision }
      : { ...selection, occurrence: selection.occurrence + 1 };
    assert.throws(() => subscriberProjectionInput(n54, mismatch), /native Workshop key does not match/);
  });
}
test("S03: Current absence preserves selected-Table identity with either Reference state", () => {
  const input = fixture({ shape: "scalar", rows: 1, columns: 1 });
  for (const reference of [input.reference, input.current]) {
    const available = projectSharedTable({ ...input, reference });
    const missing = projectSharedTable({ ...input, reference, current: { state: "missing", findings: ["Current not supplied"] } });
    assert.equal(missing.tableIdentity, available.tableIdentity);
    assert.equal(typeof missing.tableIdentity, "string");
    assert.notEqual(missing.identity, available.identity);
    assert.equal(missing.slots.current.identity, null);
  }
});
test("S01/S02: Current-only and comparison evidence retain the same selected-Table identity", () => {
  const input = subscriberProjectionInput(n54, n54.workshop.definitions[0]);
  assert.equal(input.reference.state, "available");
  assert.equal(input.comparison.state, "supplied");
  const comparison = projectSharedTable(input);
  const currentOnly = projectSharedTable({ ...input, reference: { state: "missing", findings: ["Reference not supplied"] },
    comparison: { state: "unavailable", findings: ["Reference not supplied"] } });
  assert.equal(currentOnly.tableIdentity, comparison.tableIdentity);
  assert.notEqual(currentOnly.identity, comparison.identity);
  assert.deepEqual(currentOnly.slots.current, comparison.slots.current);
});
test("S05: selected-Table identity binds every context and selection field even without evidence", () => {
  const input = fixture({ shape: "scalar", rows: 1, columns: 1 });
  const missing: SharedTableProjectionInput = { ...input, current: { state: "missing", findings: ["Current not supplied"] } };
  const original = projectSharedTable(missing);
  const alternatives: SharedTableProjectionInput[] = [
    ...["ownerId", "vehicleId", "sessionId"].map(field => ({ ...missing, context: { ...missing.context, [field]: "other" } })),
    { ...missing, context: { ...missing.context, sourceMode: "subscriber" } },
    { ...missing, selection: { ...missing.selection, key: "other-native-key" } },
    { ...missing, selection: { ...missing.selection, definitionRevision: "other-definition-revision" } },
    { ...missing, selection: { ...missing.selection, occurrence: 1 } },
  ];
  assert.deepEqual(projectSharedTable(missing), original);
  for (const alternative of alternatives) {
    const projected = projectSharedTable(alternative);
    assert.notEqual(projected.tableIdentity, original.tableIdentity);
    assert.notEqual(projected.identity, original.identity);
  }
});
test("S05: evidence-layer and complete projection identities remain separate from selected-Table identity", () => {
  const input = fixture({ shape: "scalar", rows: 1, columns: 1 }), first = projectSharedTable(input);
  assert.notEqual(first.tableIdentity, first.slots.current.identity);
  assert.notEqual(first.tableIdentity, first.identity);
  const changed = projectSharedTable({ ...input, current: { state: "available", dataset: { ...dataset(input), datasetRevision: "other-dataset-revision" } } });
  assert.equal(changed.tableIdentity, first.tableIdentity);
  assert.notEqual(changed.slots.current.identity, first.slots.current.identity);
  assert.notEqual(changed.identity, first.identity);
});
test("exact binding changes invalidate identity; titles and property insertion order do not", () => {
  const input = fixture({ shape: "scalar", rows: 1, columns: 1 }), first = projectSharedTable(input);
  assert.deepEqual(projectSharedTable(input), first);
  assert.equal(projectSharedTable(replaceDefinition(input, definition => ({ ...definition, title: "different title" }))).identity, first.identity);
  assert.equal(projectSharedTable(replaceDefinition(input, definition => ({ ...definition, title: "different title" }))).tableIdentity, first.tableIdentity);
  for (const context of [{ ...input.context, vehicleId: "other vehicle" }, { ...input.context, ownerId: "other owner" }, { ...input.context, sessionId: "other session" }]) {
    assert.notEqual(projectSharedTable({ ...input, context }).identity, first.identity);
  }
  const changed = { ...dataset(input), datasetRevision: "different dataset revision" };
  assert.notEqual(projectSharedTable({ ...input, current: { state: "available", dataset: changed } }).identity, first.identity);
  const relabelled = { ...dataset(input), exactBinaryIdentity: { ...dataset(input).exactBinaryIdentity,
    identityProvenance: ["additional disclosure does not change exact identity"] } };
  assert.equal(projectSharedTable({ ...input, current: { state: "available", dataset: relabelled } }).identity, first.identity);
  const { ownerId, vehicleId, sessionId, sourceMode } = input.context;
  assert.equal(projectSharedTable({ ...input, context: { sessionId, vehicleId, sourceMode, ownerId } }).identity, first.identity);
});
test("independent reconstruction/Export/Flash owner outcomes are preserved without deriving authority from VIEW", () => {
  const input = fixture({ shape: "scalar", rows: 1, columns: 1 });
  for (const reconstructed of [true, false]) {
    const capability = decideExportCapability(reconstructed, { state: "CHECKSUM_UNKNOWN", strategyRevision: null, findings: ["No checksum authority"] });
    const output = projectSharedTable({ ...input, exportCapability: capability });
    assert.equal(output.capabilities.view.current, "available");
    assert.equal(output.capabilities.edit, null);
    assert.equal(output.capabilities.reconstruct, capability.reconstruct);
    assert.equal(output.capabilities.export, capability.export);
    assert.equal(output.capabilities.flash, capability.flash);
    assert.deepEqual(output.capabilities.exportEvidence, capability);
  }
});
test("Working remains separate and exactly bound; projection cannot mutate inputs or authorise persistence", () => {
  const input = fixture({ shape: "scalar", rows: 1, columns: 1 }), source = dataset(input);
  const working = createWorkingCalibration({ ownerScope: input.context.ownerId, vehicleId: input.context.vehicleId,
    currentDatasetId: source.datasetId, currentDatasetRevision: source.datasetRevision, romLayoutId: source.romLayoutId,
    relationshipRevision: source.relationshipRevision, definitionSetRevision: source.definitionSetRevisionId, createdAt: "2026-09-20T00:00:00.000Z" });
  const before = JSON.stringify(input), output = projectSharedTable({ ...input, working });
  assert.equal(JSON.stringify(input), before);
  assert.deepEqual(output.slots.working, working);
  assert.deepEqual(output.slots.current, projectSharedTable(input).slots.current);
  assert.ok(Object.isFrozen(output) && Object.isFrozen(output.slots.current.cells));
  assert.equal(Object.isFrozen(input), false);
  assert.throws(() => projectSharedTable({ ...input, working: { ...working, vehicleId: "other" } }), /owner-contract disagreement/);
});
test("a supplied owner disagreement fails explicitly instead of selecting convenient evidence", () => {
  const input = fixture({ shape: "scalar", rows: 1, columns: 1 });
  const mismatch = replaceDefinition(input, definition => ({ ...definition, engineeringEvidence: { ...definition.engineeringEvidence,
    definitionRevisionId: "wrong revision" } }));
  assert.throws(() => projectSharedTable(mismatch), /owner-contract disagreement/);
});
test("snapshot freezes only projection-owned copies; every caller-owned nested object and array stays unchanged", () => {
  const selected = n54.workshop.definitions.find(item => {
    const definition = n54.material.current.definitions.filter(value => value.definitionRevisionId === item.definitionRevision)[item.occurrence];
    return definition.engineeringEvidence && definition.engineeringEvidence.axes.length > 0;
  });
  assert.ok(selected);
  const ownerInput = subscriberProjectionInput(n54, selected), source = n54.material.current;
  const working = createWorkingCalibration({ ownerScope: ownerInput.context.ownerId, vehicleId: ownerInput.context.vehicleId,
    currentDatasetId: source.datasetId, currentDatasetRevision: source.datasetRevision, romLayoutId: source.romLayoutId,
    relationshipRevision: source.relationshipRevision, definitionSetRevision: source.definitionSetRevisionId, createdAt: "2026-09-20T00:00:00.000Z" });
  const input = structuredClone({ ...ownerInput, working,
    exportCapability: decideExportCapability(false, { state: "CHECKSUM_UNKNOWN", strategyRevision: null, findings: ["No checksum authority"] }) });
  assert.ok(input.semantic && input.edit && input.exportCapability);
  const nestedObjects = (value: unknown, objects = new Set<object>()): Set<object> => {
    if (value !== null && typeof value === "object" && !objects.has(value)) {
      objects.add(value);
      for (const child of Object.values(value)) nestedObjects(child, objects);
    }
    return objects;
  };
  const callerObjects = nestedObjects(input), before = structuredClone(input);
  assert.ok([...callerObjects].every(value => !Object.isFrozen(value)));
  const output = projectSharedTable(input);
  assert.deepEqual(input, before);
  assert.deepEqual([...nestedObjects(input)], [...callerObjects]);
  for (const value of nestedObjects(input)) assert.ok(callerObjects.has(value) && !Object.isFrozen(value));
  for (const value of nestedObjects(output)) assert.ok(!callerObjects.has(value) && Object.isFrozen(value));
  assert.deepEqual(output.semantic, input.semantic);
  assert.deepEqual(output.capabilities.edit, input.edit);
  assert.deepEqual(output.capabilities.exportEvidence, input.exportCapability);
  assert.deepEqual(output.slots.working, input.working);
});

import assert from "node:assert/strict";
import test from "node:test";
import { identityOwners, savedVehicleIdentity, observedControllerIdentity, observedIdentityLabel, declaredAnalysisPlatform, type ControllerObservation, type CalibrationSourceIdentity } from "./identityOwners.ts";
import { buildRomIdentityFromTuneProfile } from "../intelligence/romIdentityAdapter.ts";
import { calibrationSourceIdentity } from "./calibrationIdentity.ts";
import { presentationFindings } from "../calibration-workshop/presentationFindings.ts";
import { bindDefinitionKnowledge, type WorkshopKnowledgeRecord } from "../calibration-workshop/definitionKnowledgeBinding.ts";
import { tableGuidanceInput } from "../calibration-workshop/tableGuidanceContract.ts";

const source: CalibrationSourceIdentity = { authority: "qualified_calibration_source", containerType: "dtf", containerDigest: "container-digest", engineeringBinaryDigest: "binary-digest",
  exactSoftwareIdentity: "00005D553C8C05", definitionSourceFamily: "B58gen2", definitionSetRevision: "definition-rev", sourceArtifactId: "xdf-id", sourceArtifactDigest: "xdf-digest", datasetId: "dataset-id", datasetRevision: "dataset-rev", coverage: "EXACT_DEFINITION_COVERAGE" };
const observation = (overrides: Partial<ControllerObservation> = {}): ControllerObservation => ({ observationId: "observation-1", source: "connected_controller", sourceId: "synthetic-test-session", vehicleId: "synthetic-vehicle", observedVin: null, observedAt: "2026-10-12T00:00:00.000Z", qualification: "qualified", observedDmeFamily: "MSD81", exactSoftwareIdentity: null, controllerAddress: "0x12", adapterIdentity: "controlled-adapter", findings: [], ...overrides });

for (const label of ["N54", "B58 Gen 1", "B58 Gen 2", "MG1CS201"]) test(`R01: owner declaration ${label} never becomes controller observation`, () => {
  const input = { id: "saved-vehicle", engine_code: label }, before = JSON.stringify(input), result = identityOwners({ vehicle: input });
  assert.equal(result.savedVehicle.declaredEngineCode, label);
  assert.equal(result.controller.observedDmeFamily.value, null);
  assert.equal(observedIdentityLabel(result.controller.exactSoftwareIdentity), "Not observed");
  assert.equal(result.calibration, null);
  assert.equal(JSON.stringify(input), before); assert.equal(Object.isFrozen(input), false);
});
test("R01: Supra saved generation and Definition-source family remain separate exact facts", () => {
  const result = identityOwners({ vehicle: { engine_code: "B58 Gen 2" }, calibration: { ...source, definitionSourceFamily: "distinct-source-family" } });
  assert.equal(result.savedVehicle.engineGeneration, "B58 Gen 2");
  assert.equal(result.calibration?.definitionSourceFamily, "distinct-source-family");
  assert.equal(result.calibration?.exactSoftwareIdentity, "00005D553C8C05");
  assert.equal(result.controller.exactSoftwareIdentity.value, null);
  assert.equal(result.calibration?.containerDigest, "container-digest");
});
test("R01: chassis, model, year, unknown engine strings and XDF cannot infer a generation", () => {
  for (const engine_code of [null, "B58", "MSD81", "Custom owner label"]) {
    const result = identityOwners({ vehicle: { model: "Supra", year: 2021, chassis: "A90", engine_code }, calibration: source });
    assert.equal(result.savedVehicle.engineGeneration, null);
  }
  assert.equal(savedVehicleIdentity({ engine_code: "B58 Gen 1", engine_generation: "Separately declared" }).engineGeneration, "Separately declared");
});
test("R01: unknown context stays unavailable in every authority", () => {
  const result = identityOwners({}); assert.equal(result.savedVehicle.vehicleId, null); assert.equal(result.savedVehicle.declaredEngineCode, null);
  assert.equal(result.controller.observedDmeFamily.state, "not_observed"); assert.equal(result.calibration, null);
  assert.equal(result.states.current, null); assert.equal(result.states.suggested, "unavailable");
});
for (const value of [observation({ qualification: "unqualified" }), observation({ observedAt: "" }), observation({ sourceId: "" }), observation({ observationId: "" })]) test(`R01: incomplete controller evidence cannot qualify (${JSON.stringify(value)})`, () => {
  const result = observedControllerIdentity([value]); assert.equal(result.observedDmeFamily.value, null); assert.equal(result.observedDmeFamily.state, "not_observed");
  assert.deepEqual(result.evidence[0], value);
});
test("R01: qualified controller observation does not fabricate a Calibration source or saved vehicle", () => {
  const result = identityOwners({ controllerObservations: [observation({ exactSoftwareIdentity: "I8A0S" })] });
  assert.equal(result.controller.observedDmeFamily.value, "MSD81"); assert.equal(result.controller.exactSoftwareIdentity.value, "I8A0S");
  assert.equal(result.calibration, null); assert.equal(result.savedVehicle.declaredEngineCode, null);
  assert.equal(result.states.current, null); assert.equal(result.controller.evidence[0].source, "connected_controller");
});
test("R01: disagreement between qualified observations is unavailable and reviewable", () => {
  const a = observation({ exactSoftwareIdentity: "I8A0S" }), b = observation({ observationId: "other", observedDmeFamily: "MG1CS201", exactSoftwareIdentity: "00005D553C8C05" });
  const result = identityOwners({ vehicle: { engine_code: "N54" }, controllerObservations: [a,b], calibration: source });
  assert.equal(result.controller.observedDmeFamily.state, "conflict"); assert.equal(result.controller.exactSoftwareIdentity.value, null);
  assert.equal(result.controller.evidence.length, 2); assert.equal(result.savedVehicle.declaredEngineCode, "N54"); assert.deepEqual(result.calibration, source);
  assert.equal(declaredAnalysisPlatform({ engine_code: "N54" }, [a,b]), "unknown");
});
test("R01: different authority vocabularies are preserved without guessed cross-domain reclassification", () => {
  const result = identityOwners({ vehicle: { engine_code: "N54" }, controllerObservations: [observation({ observedDmeFamily: "MG1CS201" })], calibration: source });
  assert.equal(result.savedVehicle.declaredEngineCode, "N54"); assert.equal(result.controller.observedDmeFamily.value, "MG1CS201");
  assert.equal(result.calibration?.definitionSourceFamily, "B58gen2");
  assert.equal(declaredAnalysisPlatform({ engine_code: "N54" }, result.controller.evidence), "unknown");
});
test("R01: Analysis retains its declared N54 boundary without source-family or ROM fallback", () => {
  assert.equal(declaredAnalysisPlatform({ engine_code: "N54" }), "n54");
  for (const engine_code of [null, "", "B58 Gen 1", "B58 Gen 2", "MSD81"]) assert.equal(declaredAnalysisPlatform({ engine_code }), "unknown");
  assert.equal(declaredAnalysisPlatform(null,[observation()]), "unknown");
});
test("R01: projections copy evidence without freezing caller-owned objects", () => {
  const input = observation(), result = observedControllerIdentity([input]);
  assert.notEqual(result.evidence[0], input); assert.notEqual(result.evidence[0].findings, input.findings);
  assert.equal(Object.isFrozen(input), false); assert.equal(Object.isFrozen(input.findings), false);
});
test("R01: a qualified observation from another vehicle fails closed without rewriting its source", () => {
  const evidence = observation({ observedVin: "SYNTHETIC-VIN" });
  const result = identityOwners({ vehicle: { id: "other-vehicle", engine_code: "N54" }, controllerObservations: [evidence] });
  assert.equal(result.controller.observedDmeFamily.state, "conflict"); assert.equal(result.controller.observedVin.value, null);
  assert.deepEqual(result.controller.evidence[0], evidence);
  assert.equal(declaredAnalysisPlatform({ id: "other-vehicle", engine_code: "N54" }, [evidence]), "unknown");
  const missingScope = identityOwners({ vehicle: { id: "saved-vehicle" }, controllerObservations: [observation({ vehicleId: null })] });
  assert.equal(missingScope.controller.observedDmeFamily.state, "not_observed");
  const matched = identityOwners({ vehicle: { id: evidence.vehicleId }, controllerObservations: [evidence] });
  assert.equal(matched.controller.observedVin.value, "SYNTHETIC-VIN");
  assert.equal(matched.controller.adapterIdentity.value, "controlled-adapter");
});
test("R01: Current, Reference and Working revisions are exact separate identities", () => {
  const current = { datasetId: "current", datasetRevision: "current-r" }, reference = { datasetId: "reference", datasetRevision: "reference-r" };
  const working = { workingCalibrationId: "working", workingCalibrationRevision: "working-r", currentDatasetId: "current", currentDatasetRevision: "current-r" };
  const result = identityOwners({ states: { current, reference, working } });
  assert.deepEqual(result.states.current, current); assert.deepEqual(result.states.reference, reference); assert.deepEqual(result.states.working, working);
  assert.equal(result.states.currentImmutable, true);
  const mismatch = identityOwners({ states: { current, reference, working: {...working, currentDatasetRevision: "other"} } });
  assert.equal(mismatch.states.working, null); assert.match(mismatch.states.workingUnavailableReason!, /does not match/);
});
test("R01: legacy source identity preserves Dataset/revision and never substitutes container digest", () => {
  const input = { identity: "00005D553C8C05", container: "dtf", coverage: { outcome: "EXACT_DEFINITION_COVERAGE" }, material: { current: {
    datasetId: "old-dataset", datasetRevision: "old-revision", definitionSetRevisionId: "old-def", sourceArtifactId: "old-xdf", sourceArtifactDigest: "xdf-digest",
    exactBinaryIdentity: { identityId: "binary-id", digest: "binary-digest", byteLength: 8388608, containerType: "dtf" as const, containerByteLength: 8388610, resolutionMethod: "dtf_raw_mg1_86t0_full_binary" as const, romFamily: "B58GEN2", softwareIdentity: "00005D553C8C05", calibrationIdentity: null, internalRomIdentifiers: [], identityProvenance: ["legacy-observation"] },
  } } };
  const before = JSON.stringify(input), result = calibrationSourceIdentity(input);
  assert.equal(result.datasetId, "old-dataset"); assert.equal(result.datasetRevision, "old-revision"); assert.equal(result.containerDigest, null);
  assert.equal(result.engineeringBinaryDigest, "binary-digest"); assert.equal(result.definitionSourceFamily, "B58GEN2"); assert.equal(JSON.stringify(input), before);
  input.material.current.exactBinaryIdentity.containerByteLength = 8388608;
  const direct = calibrationSourceIdentity(input);
  assert.equal(direct.containerDigest, "binary-digest"); assert.equal(direct.containerDigestProvenance, "qualified_identity_container_resolution");
});
test("R01: legacy family and ECU metadata cannot fill exact ROM or DME variant", () => {
  const result = buildRomIdentityFromTuneProfile({ rom_family: "B58GEN2", ecu_family: "MG1CS201", binary_signature: "MG1CS201" });
  assert.equal(result.romSignature, null); assert.equal(result.dmeVariant, null);
  assert.equal(buildRomIdentityFromTuneProfile({ detected_rom: "I8A0S" }).romFamily, null);
  assert.equal(buildRomIdentityFromTuneProfile({ detected_rom: "I8A0S" }).romSignature, "I8A0S");
});
test("R01: identical visible findings retain distinct owner IDs and duplicate occurrences", () => {
  const groups = [{ sourceId: "editAuthority", findings: [{ findingId: "a", text: "Same text" }, { findingId: "b", text: "Same text" }, { findingId: "a", text: "Same text" }] }, { sourceId: "preview", findings: ["Same text"] }];
  const result = presentationFindings(groups); assert.equal(result.length, 4); assert.equal(new Set(result.map(item=>item.key)).size, 4);
  assert.deepEqual(result.map(item=>item.text), Array(4).fill("Same text"));
  assert.equal(presentationFindings([{sourceId:"unrelated",findings:["Other"]},...groups])[1].key,result[0].key);
});
test("R01: U4 absence contracts preserve source titles and do not generate education", () => {
  const semantic = bindDefinitionKnowledge({ definitionIdentity: null, definitionRevision: "definition" }, []);
  const result = tableGuidanceInput({ tableKey: "table", definitionRevision: "definition", sourceTitle: "Timing Spool (Map 3)", semantic });
  assert.equal(result.sourceTitle, "Timing Spool (Map 3)"); assert.equal(result.terminology.related, "Related Table"); assert.equal(result.terminology.beginner, "Understand");
  assert.equal(result.unavailableReason, semantic.unavailableReason); assert.equal(result.understand.controls.fields.length, 0); assert.ok(result.understand.controls.unavailableReason);
});
test("R01: U4 only carries exact producer-qualified fields with provenance", () => {
  const field = { value: "Governed text", assertionId: "assertion", assertionRevision: "r1", authority: "knowledge", provenance: ["producer"], limitations: [] };
  const record: WorkshopKnowledgeRecord = { knowledgeId: "knowledge", knowledgeRevision: "r1", lifecycle: "active", verification: "verified", conflict: false, exactWorkshopInstanceIdentities: [], exactDefinitionIdentities: [], exactDefinitionRevisions: ["definition"], applicability: [], aliases: [], engineeringSystem: null, controls: [field], whyItMatters: [], howToRead: [], directionalEffects: [], operatingContexts: [], engineeringConsiderations: [], axisMeanings: [], relatedCalibrations: [], telemetryRelationships: [], limitations: [] };
  const create = (records: readonly WorkshopKnowledgeRecord[]) => tableGuidanceInput({ tableKey: "table", definitionRevision: "definition", sourceTitle: "Source title", semantic: bindDefinitionKnowledge({definitionIdentity:null,definitionRevision:"definition"},records) });
  const qualified = create([record]); assert.deepEqual(qualified.understand.controls.fields[0], field); assert.ok(qualified.understand.whyItMatters.unavailableReason);
  for (const altered of [{ ...record, verification: "candidate" as const }, {...record,conflict:true}]) assert.equal(create([altered]).understand.controls.fields.length, 0);
});

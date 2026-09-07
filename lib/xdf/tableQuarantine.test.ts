import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { resolveBinaryContainer } from "../tunes/binaryContainer.ts";
import { B58_PHYSICAL_ARTIFACT_EVIDENCE, B58_PHYSICAL_INJECTOR_SCALAR_EVIDENCE } from "./b58PhysicalArtifactEvidence.ts";
import type { CompleteBinaryValidation } from "./bmwMasterFullValidation.ts";
import { defineDefinitionSetRevision } from "./definitionRomApplicability.ts";
import { interpretXdfStructure } from "./interpretXdfStructure.ts";
import { auditTableQuarantineSafety, constructQuarantineAwareSourceAuthorityCandidate, constructQuarantinedTablePresentation, constructTableQuarantineRecord } from "./tableQuarantine.ts";
import { FOUNDER_00003076501103_INJECTOR_SCALAR_QUARANTINE, FOUNDER_00003076501103_SOURCE_AUTHORITY_CANDIDATE } from "./b58PhysicalTableQuarantine.ts";

const root = path.resolve("BMW-XDFs-master/B58gen1"), injectorRevision = B58_PHYSICAL_INJECTOR_SCALAR_EVIDENCE.definitionRevision;
function parsed(rom: string) { const result = interpretXdfStructure({ xml: fs.readFileSync(path.join(root, `${rom}.xdf`), "utf8"), filename: `${rom}.xdf`, provenance: `Quarantine dependency audit ${rom}` }); assert.equal(result.outcome, "structurally_interpreted"); return result; }
function binary(fileName: string) { const result = resolveBinaryContainer({ bytes: fs.readFileSync(path.join(root, fileName)), fileName }); assert.equal(result.status, "resolved"); return result.engineeringBinary!; }

test("one reusable dependency audit proves all five Injector Scalar MapSwitch occurrences isolated", { timeout: 900_000 }, () => {
  for (const rom of ["00003076501103", "00003076501D02", "000030765A3C06", "00003081501102", "00003081501D04"]) {
    const source = parsed(rom), assessment = auditTableQuarantineSafety({ definitions: source.definitions, engineeringBinary: binary(`${rom}_MapSwitchBase.bin`), definitionRevisionId: injectorRevision, occurrence: 0, expectedFailureClass: "invalid_engineering_conversion" });
    assert.equal(assessment.outcome, "dependency_safe_for_quarantine", rom);
    assert.deepEqual(assessment.targetOffsets, [7_445_148, 7_445_149]);
    assert.deepEqual(assessment.overlappingDefinitionRevisions, []);
  }
});

test("axis dependency, storage overlap and representation conflict each fail closed", () => {
  const source = parsed("00003076501103"), target = source.definitions.find((item) => item.revisionId === injectorRevision)!;
  const external = { ...target, revisionId: `${target.revisionId}:external`, axes: target.axes.map((axis) => axis.axisId.toLowerCase() === "z" ? { ...axis, representation: "external_reference" as const } : axis) };
  assert.equal(auditTableQuarantineSafety({ definitions: [external], engineeringBinary: binary("00003076501103_MapSwitchBase.bin"), definitionRevisionId: external.revisionId, occurrence: 0, expectedFailureClass: "invalid_engineering_conversion" }).outcome, "whole_relationship_blocked");
  const overlap = { ...target, revisionId: `${target.revisionId}:overlap` };
  assert.equal(auditTableQuarantineSafety({ definitions: [target, overlap], engineeringBinary: binary("00003076501103_MapSwitchBase.bin"), definitionRevisionId: target.revisionId, occurrence: 0, expectedFailureClass: "invalid_engineering_conversion" }).outcome, "whole_relationship_blocked");
  const conflict = { ...target, identity: { status: "conflicting" as const, stableId: null, derivationBasis: null, unresolvedReason: "Controlled unresolved representation conflict" } };
  assert.equal(auditTableQuarantineSafety({ definitions: [conflict], engineeringBinary: binary("00003076501103_MapSwitchBase.bin"), definitionRevisionId: conflict.revisionId, occurrence: 0, expectedFailureClass: "unresolved_representation_conflict" }).outcome, "whole_relationship_blocked");
});

test("Founder physical MapSwitch creates one immutable unavailable quarantine and an exact Source Authority candidate", { timeout: 180_000 }, (context) => {
  const physicalPath = process.env.TUNESIGHT_PRIVATE_B58_MAPSWITCH_FIXTURE;
  if (!physicalPath || !fs.existsSync(physicalPath)) return context.skip("Founder physical fixture is not available on this host.");
  const source = parsed("00003076501103"), engineeringBinary = resolveBinaryContainer({ bytes: fs.readFileSync(physicalPath), fileName: path.basename(physicalPath) }); assert.equal(engineeringBinary.status, "resolved");
  const assessment = auditTableQuarantineSafety({ definitions: source.definitions, engineeringBinary: engineeringBinary.engineeringBinary!, definitionRevisionId: injectorRevision, occurrence: 0, expectedFailureClass: "invalid_engineering_conversion" }); assert.equal(assessment.outcome, "dependency_safe_for_quarantine");
  const definition = source.definitions.find((item) => item.revisionId === injectorRevision)!, mapEvidence = B58_PHYSICAL_ARTIFACT_EVIDENCE[1];
  const quarantine = constructTableQuarantineRecord({ relationship: { romSoftwareIdentity: "00003076501103", sourceArtifactId: source.sourceArtifact!.artifactId, definitionSetRevision: defineDefinitionSetRevision({ sourceArtifact: source.sourceArtifact!, definitions: source.definitions }).revisionId }, occurrence: { definitionIdentity: definition.identity.stableId!, definitionRevisionId: definition.revisionId, sourceBindingDigest: definition.sourceBindingDigest, occurrence: 0 }, affectedBinary: { digest: mapEvidence.digest, role: "mapswitch", validationRevision: mapEvidence.validationRevision }, failureClass: "invalid_engineering_conversion", failureEvidence: { rawOffsets: [7_445_148], rawBytes: [0, 0], rawValues: [0], equation: B58_PHYSICAL_INJECTOR_SCALAR_EVIDENCE.equation, outcome: "invalid_numeric_result", finding: "Division by zero." }, safetyAssessment: assessment, safetyAssessmentRevision: assessment.assessmentRevision, provenance: ["Founder-supplied physical MapSwitch binary; exact bytes audited without modification."], limitations: ["Quarantine does not qualify, correct, recommend or authorize mutation of this Definition."], authority: { reviewerId: "tunesight-governed-engineering-review", authorityRevision: "table-quarantine-review-authority-revision:2026-09-07" }, quarantinedAt: "2026-09-07T00:00:00.000Z" });
  assert.ok(Object.isFrozen(quarantine)); assert.deepEqual(constructQuarantinedTablePresentation(quarantine).engineeringValues, []); assert.equal(constructQuarantinedTablePresentation(quarantine).editable, false);
  const stockEvidence = B58_PHYSICAL_ARTIFACT_EVIDENCE[0];
  const validations: CompleteBinaryValidation[] = [stockEvidence, mapEvidence].map((item) => ({ validationId: `physical-validation:${item.digest}`, validationRevision: item.validationRevision, binaryDigest: item.digest, definitions: item.validation.definitions, extractionAttempts: item.validation.definitions, extractionSuccess: item.validation.extractionSuccess, blocked: 0, outOfBounds: 0, unsupported: 0, representationConflicts: item.validation.representationConflicts, converted: item.validation.converted, identityNoOp: item.validation.identityNoOp, invalidNumeric: item.validation.invalidNumeric, malformed: 0, unavailable: item.validation.unavailable, unresolvedUnits: item.validation.unresolvedUnits, other: 0 }));
  const set = defineDefinitionSetRevision({ sourceArtifact: source.sourceArtifact!, definitions: source.definitions });
  const candidate = constructQuarantineAwareSourceAuthorityCandidate({ scope: { sourceArtifactId: source.sourceArtifact!.artifactId, sourceArtifactDigest: source.sourceArtifact!.sourceDigest, definitionSetId: set.definitionSetId, definitionSetRevision: set.revisionId, family: "B58gen1" }, romSoftwareIdentity: "00003076501103", validations, quarantines: [quarantine], identityCoherent: true, limitations: ["Upstream acquisition and XDF authorship remain unknown.", "Stock authenticity, semantic Knowledge, applicability and publication remain separate.", "Injector Scalar (Auto) remains unavailable and mutation-prohibited on the exact physical MapSwitch binary."] });
  assert.equal(candidate.state, "pending_founder_authority"); assert.deepEqual(candidate.quarantineRevisions, [quarantine.quarantineRevision]);
  assert.deepEqual(quarantine, FOUNDER_00003076501103_INJECTOR_SCALAR_QUARANTINE);
  assert.deepEqual(candidate, FOUNDER_00003076501103_SOURCE_AUTHORITY_CANDIDATE);
  const presentation = constructQuarantinedTablePresentation(quarantine);
  assert.equal(presentation.state, "unavailable_quarantined"); assert.equal(presentation.editable, false); assert.equal(presentation.suggestedCalibrationEligible, false); assert.equal(presentation.reconstructionMutationEligible, false);
  context.diagnostic(`FOUNDER_F30_TABLE_QUARANTINE ${JSON.stringify({ assessment, quarantine, candidate })}`);
});

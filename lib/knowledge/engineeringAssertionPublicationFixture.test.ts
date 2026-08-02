import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import type { AdmissionEvidencePackage, AdmissionStableIdentity } from "./calibrationKnowledgeAdmission.ts";
import { canonicalizeDigestDomainPayload } from "./calibrationKnowledgeCanonicalSerialization.ts";
import { deriveCalibrationKnowledgeContentDigests } from "./calibrationKnowledgeCanonicalSerialization.ts";
import {
  defineCalibrationKnowledgeObject,
  type CalibrationApplicability,
  type GovernedVocabularyReference,
  type QualifiedAssertion,
} from "./calibrationKnowledge.ts";
import type { PublicationSourceIdentity, RegistrySnapshotReference } from "./calibrationKnowledgePublicationSourceRegistrySnapshot.ts";
import { defineEngineeringAssertion, type EngineeringAssertion } from "./engineeringAssertion.ts";
import {
  assessEngineeringAssertionAdmissionBinding,
  type EngineeringAssertionAdmissionMember,
  type ExactEngineeringAssertionRevisionReference,
} from "./engineeringAssertionAdmissionBinding.ts";
import { deriveEngineeringAssertionContentDigest, deriveEngineeringAssertionRevisionDigests } from "./engineeringAssertionCanonicalSerialization.ts";
import { defineEngineeringAssertionConflict, defineEngineeringAssertionSupersession } from "./engineeringAssertionConflictSupersession.ts";
import {
  compositeEntityKey,
  defineEngineeringAssertionCompositePublicationUnit,
  deriveCompositePublicationUnitDigest,
  type CompositeAdmissionDecisionReference,
  type CompositeEntityRevisionReference,
  type CompositePublicationUnitInput,
} from "./engineeringAssertionCompositePublicationUnit.ts";
import {
  compositeRegistryRecordKey,
  constructCompositeExecutionResult,
  constructCompositeReceipt,
  defineCompositeRegistryManifest,
  deriveCompositeExecutionResultDigest,
  deriveCompositeReceiptDigest,
  type CompositeEvidentiaryReceipt,
  type CompositeExecutionResult,
  type CompositeRegistryRecord,
} from "./engineeringAssertionCompositeRegistryReceipt.ts";

// Every identity and statement in this file is deliberately fictional and test-only.
const sha = (seed: string): string => `sha256:${createHash("sha256").update(seed).digest("hex")}`;
const identity = (id: string, revision = "1"): AdmissionStableIdentity => ({ id, revision, contentDigest: `identity:${createHash("sha256").update(`${id}:${revision}`).digest("hex")}` });
const vocabulary = (termId: string): GovernedVocabularyReference => ({ vocabularyId: "synthetic-assertion-fixture", vocabularyVersion: "1", termId, label: `Synthetic ${termId}`, recognition: "known" });
const applicability = (): CalibrationApplicability => ({ scope: vocabulary("fixture_only"), platforms: [], engineFamilies: [], ecuFamilies: [], dmeVariants: [], controlStrategies: ["synthetic-control-strategy"], romFamilies: [], softwareVersions: [], calibrationIds: [], stockVariantIds: [], operatingModes: [], transmissions: [], regions: [], emissionsSpecifications: [], hardwareConfigurations: [], sourceReferenceIds: ["synthetic-source"], unresolvedReason: null });
const evidence = (id: string) => ({ evidenceId: id, sourceType: "synthetic_fixture", sourceIdentifier: id });
const qualified = <T>(assertionId: string, value: T): QualifiedAssertion<T> => ({ assertionId, value, verificationStatus: "candidate", confidence: "medium", authority: null, provenance: [{ sourceType: "synthetic_fixture", sourceIdentifier: assertionId }], supportingEvidence: [evidence(`evidence:${assertionId}`)], contradictoryEvidence: [], applicability: applicability(), conflictState: "none", unresolvedReason: null, version: "1", lifecycle: { status: "active", version: "1" } });

function syntheticKnowledge() {
  return defineCalibrationKnowledgeObject({
    identity: qualified("synthetic:knowledge:identity", { stableId: "synthetic:knowledge:fictional-controller" }),
    canonicalName: qualified("synthetic:knowledge:name", "Fictional Controller Fixture"),
    aliases: [], purposes: [qualified("synthetic:knowledge:purpose", { summary: "Exercises governed assertion publication contracts only." })], engineeringIntents: [],
    calibrationKind: qualified("synthetic:knowledge:kind", vocabulary("fictional_controller")), primarySubsystem: qualified("synthetic:knowledge:subsystem", vocabulary("fictional_subsystem")), relatedSubsystems: [], applicability: qualified("synthetic:knowledge:applicability", applicability()), sourceRepresentations: [], directionalBehaviours: [], relationships: [],
    provenance: [{ sourceType: "synthetic_fixture", sourceIdentifier: "synthetic:knowledge:material" }], lifecycle: { status: "active", version: "1" }, version: "1",
  });
}

function unboundAssertion(stableId: string, revision: string, objectTerm: string, confidence: "low" | "medium" = "medium"): EngineeringAssertion {
  return {
    identity: { stableAssertionId: stableId, assertionRevision: revision, canonicalAssertionDigest: sha("unbound") },
    statement: { statementRepresentationId: `synthetic:statement:${stableId}`, statementRevision: revision, language: "en-AU", text: `Synthetic proposition ${objectTerm}.`, canonicalStatementDigest: sha(`statement:${stableId}:${revision}:${objectTerm}`) },
    assertionClass: vocabulary("fictional_relationship"),
    proposition: { subject: { knowledgeId: "synthetic:knowledge:fictional-controller", governedTerm: null, literal: null }, predicate: vocabulary("fictionally_relates_to"), object: { knowledgeId: null, governedTerm: vocabulary(objectTerm), literal: null }, direction: null, modality: vocabulary("descriptive"), causality: vocabulary("non_causal") },
    scope: { applicability: applicability(), preconditions: [], exclusions: [], knownLimitations: [], unresolvedDimensions: [] },
    qualification: { verificationStatus: "candidate", confidence, authority: null, provenance: [{ sourceType: "synthetic_fixture", sourceIdentifier: `provenance:${stableId}:${revision}` }], supportingEvidence: [evidence(`evidence:${stableId}:${revision}`)], contradictoryEvidence: [], conflictState: "none", unresolvedReason: null },
    memberships: [{ calibrationKnowledgeStableId: "synthetic:knowledge:fictional-controller", calibrationKnowledgeVersion: "1", role: vocabulary("fixture_member"), requirement: vocabulary("required") }], relationships: [], lifecycle: { status: "active", version: revision }, contractVersion: "1.0",
  };
}

function assertion(stableId: string, revision: string, objectTerm: string, confidence: "low" | "medium" = "medium"): EngineeringAssertion {
  const input = unboundAssertion(stableId, revision, objectTerm, confidence);
  return defineEngineeringAssertion({ ...input, identity: { ...input.identity, canonicalAssertionDigest: deriveEngineeringAssertionContentDigest(input).digest.qualifiedDigest } });
}

const exact = (value: EngineeringAssertion): ExactEngineeringAssertionRevisionReference => {
  const digests = deriveEngineeringAssertionRevisionDigests(value);
  return { stableAssertionId: value.identity.stableAssertionId, assertionRevision: value.identity.assertionRevision, canonicalAssertionDigest: digests.contentDigest.qualifiedDigest, assertionRevisionEnvelopeDigest: digests.revisionEnvelopeDigest.qualifiedDigest };
};
const entityDigest = (domain: string, value: object): string => {
  const bytes = canonicalizeDigestDomainPayload(value).canonicalBytes.bytes;
  const hash = createHash("sha256"); hash.update(domain); hash.update(Buffer.from([0])); hash.update(Buffer.from(bytes)); return `sha256:${hash.digest("hex")}`;
};
const source = (): PublicationSourceIdentity => ({ sourceId: "synthetic:publication-source", sourceRevision: "1", sourceContentDigest: sha("source-content"), sourceEnvelopeDigest: sha("source-envelope"), sourceType: vocabulary("fixture_source"), sourceContractId: "synthetic-source-contract", sourceContractVersion: "1", authority: { authorityType: "synthetic_fixture", authorityIdentifier: "synthetic:authority" }, provenance: [{ provenanceId: "synthetic:source:provenance", sourceType: "synthetic_fixture", sourceIdentifier: "synthetic:source", sourceRevisionOrigin: "1", implementationOrigin: "test-only", sourceContractId: "synthetic-source-contract", sourceContractVersion: "1", validationAuthority: "synthetic-test", transformationHistory: [] }], lifecycle: { state: "active", lifecycleVersion: "1", supersededBySourceId: null, supersededBySourceRevision: null }, capabilities: [], knownLimitations: ["Synthetic test fixture only."] });
const snapshot = (id: string, seed: string): RegistrySnapshotReference => ({ snapshotId: id, snapshotRevision: "1", snapshotEnvelopeDigest: sha(seed) });

function buildFixture(reverse = false) {
  const knowledge = syntheticKnowledge();
  const predecessor = assertion("synthetic:assertion:successor-lineage", "1", "fictional_prior_state");
  const primary = assertion("synthetic:assertion:successor-lineage", "2", "fictional_current_state");
  const competing = assertion("synthetic:assertion:competing-view", "1", "fictional_competing_state", "low");
  const withheld = assertion("synthetic:assertion:withheld-optional", "1", "fictional_unresolved_state");
  const assertions = reverse ? [withheld, competing, primary] : [primary, competing, withheld];
  const evidencePackage: AdmissionEvidencePackage = { packageIdentity: identity("synthetic:evidence-package"), evidence: [evidence("synthetic:evidence:primary"), evidence("synthetic:evidence:competing")], provenance: [{ sourceType: "synthetic_fixture", sourceIdentifier: "synthetic:evidence-package" }], sourceRevisionDigests: [], assertionMappings: [], collectionMethod: "synthetic deterministic fixture", transformationHistory: [], chainOfCustody: [], knownLimitations: ["Not engineering evidence."], createdDate: "2026-08-02", supersededPackageRevision: null };
  const members: EngineeringAssertionAdmissionMember[] = assertions.map((value) => ({ assertion: value, assertionRevisionEnvelopeDigest: exact(value).assertionRevisionEnvelopeDigest, requirement: value === withheld ? "optional" : "required", authorityClaimIds: [], dependencyStableAssertionIds: [], structuralState: "valid", identityState: "resolved", scopeState: "resolved", conflictState: "none", harmState: "none", omissionRequested: value === withheld, omissionReason: value === withheld ? "Synthetic optional claim intentionally withheld pending fictional Evidence." : null, parentRemainsStructurallyTruthfulWithoutMember: value === withheld, requiredParentRoleFulfilledWithoutMember: value === withheld }));
  const bindings = [primary, competing].map((value) => ({ bindingId: `synthetic:binding:${value.identity.stableAssertionId}`, evidenceId: value === primary ? "synthetic:evidence:primary" : "synthetic:evidence:competing", assertion: exact(value), propositionPath: "/proposition/object", scopePath: null, role: "supporting" as const }));
  const assessment = assessEngineeringAssertionAdmissionBinding({ assessmentIdentity: identity("synthetic:assertion-assessment"), proposalIdentity: identity("synthetic:proposal"), evidencePackage, members, evidenceBindings: reverse ? [...bindings].reverse() : bindings, authorityClaims: [], policy: { policyId: "synthetic-assertion-admission", policyVersion: "1", authoritativeVerificationStatuses: ["verified", "founder_verified", "authoritatively_verified"], provisionalVerificationStatuses: ["candidate", "provisional", "observed"], lifecycleChangeStatuses: ["superseded", "deprecated", "rejected"] }, assessmentDate: "2026-08-02" });
  const before = snapshot("synthetic:snapshot:before", "before");
  const conflict = defineEngineeringAssertionConflict({ conflictIdentity: identity("synthetic:conflict"), firstAssertion: exact(primary), secondAssertion: exact(competing), materialPaths: [{ assertion: exact(primary), propositionPaths: ["/proposition/object"], scopePaths: [] }, { assertion: exact(competing), propositionPaths: ["/proposition/object"], scopePaths: [] }], classification: "direct_contradiction", evidence: [{ evidenceId: "synthetic:evidence:primary", evidencePackageIdentity: evidencePackage.packageIdentity, role: "supports_conflict" }], authority: [{ authorityClaimIdentity: identity("synthetic:conflict-authority"), role: "establishes" }], rationale: "Synthetic propositions intentionally disagree for contract testing.", resolutionState: "unresolved", resolutionSuccessorAssertion: null, lifecycle: { state: "active", lifecycleVersion: "1", supersededByConflictIdentity: null }, provenance: [{ sourceType: "synthetic_fixture", sourceIdentifier: "synthetic:conflict" }], contractVersion: "1" });
  const supersession = defineEngineeringAssertionSupersession({ supersessionIdentity: identity("synthetic:supersession"), kind: "partial", predecessor: exact(predecessor), successor: exact(primary), supersededScope: { scopeId: "synthetic:scope:superseded", assertion: exact(predecessor), includedScopePaths: ["/scope/applicability/controlStrategies/0"], excludedScopePaths: [], description: "Synthetic superseded scope." }, retainedScope: { scopeId: "synthetic:scope:retained", assertion: exact(predecessor), includedScopePaths: ["/scope/applicability/sourceReferenceIds/0"], excludedScopePaths: [], description: "Synthetic retained scope." }, scopeComparison: { comparisonId: "synthetic:scope-comparison", basis: "predecessor_contains_successor", comparedScopePaths: ["/scope/applicability/controlStrategies/0"], unresolvedOverlapConflictIdentity: null, rationale: "Synthetic partial lineage proof." }, evidence: [{ evidenceId: "synthetic:evidence:primary", evidencePackageIdentity: evidencePackage.packageIdentity, role: "supports_resolution" }], authority: [{ authorityClaimIdentity: identity("synthetic:supersession-authority"), role: "establishes" }], rationale: "Synthetic successor replaces only the declared fictional scope.", effectivePublication: { publicationInstructionId: "synthetic:publication-unit", publicationInstructionRevision: "1", publicationInstructionDigest: sha("pending-unit-reference") }, registrySnapshot: before, provenance: [{ sourceType: "synthetic_fixture", sourceIdentifier: "synthetic:supersession" }], contractVersion: "1" });

  const knowledgeDigest = deriveCalibrationKnowledgeContentDigests(knowledge).expectedResultingCanonicalDigest;
  const asEntity = (entityKind: CompositeEntityRevisionReference["entityKind"], stableId: string, revision: string, canonicalPayloadDigest: string, revisionEnvelopeDigest: string | null, lifecycleIdentity: string): CompositeEntityRevisionReference => ({ entityKind, stableId, revision, canonicalPayloadDigest, revisionEnvelopeDigest, lifecycleIdentity, provenanceIdentityIds: reverse ? [`synthetic:provenance:z:${stableId}`, `synthetic:provenance:a:${stableId}`] : [`synthetic:provenance:a:${stableId}`, `synthetic:provenance:z:${stableId}`] });
  const canonicalEntityReference = (value: CompositeEntityRevisionReference): CompositeEntityRevisionReference => ({ ...value, provenanceIdentityIds: [...value.provenanceIdentityIds].sort() });
  const knowledgeEntity = asEntity("calibration_knowledge", "synthetic:knowledge:fictional-controller", "1", knowledgeDigest, null, "synthetic:lifecycle:knowledge:1");
  const assertionEntity = (value: EngineeringAssertion) => { const d = deriveEngineeringAssertionRevisionDigests(value); return asEntity("engineering_assertion", value.identity.stableAssertionId, value.identity.assertionRevision, d.contentDigest.qualifiedDigest, d.revisionEnvelopeDigest.qualifiedDigest, `synthetic:lifecycle:${value.identity.stableAssertionId}:${value.identity.assertionRevision}`); };
  const primaryEntity = assertionEntity(primary), competingEntity = assertionEntity(competing), withheldEntity = assertionEntity(withheld);
  const membershipPrimary = asEntity("assertion_membership", "synthetic:membership:primary", "1", entityDigest("synthetic.membership", { knowledge: canonicalEntityReference(knowledgeEntity), assertion: canonicalEntityReference(primaryEntity) }), sha("membership-primary-envelope"), "synthetic:lifecycle:membership:primary");
  const membershipCompeting = asEntity("assertion_membership", "synthetic:membership:competing", "1", entityDigest("synthetic.membership", { knowledge: canonicalEntityReference(knowledgeEntity), assertion: canonicalEntityReference(competingEntity) }), sha("membership-competing-envelope"), "synthetic:lifecycle:membership:competing");
  const relationshipEntity = asEntity("knowledge_relationship", "synthetic:relationship:competes-with", "1", entityDigest("synthetic.relationship", { source: canonicalEntityReference(primaryEntity), target: canonicalEntityReference(competingEntity) }), sha("relationship-envelope"), "synthetic:lifecycle:relationship");
  const conflictEntity = asEntity("assertion_conflict", conflict.conflictIdentity.id, conflict.conflictIdentity.revision, entityDigest("synthetic.conflict", conflict), sha("conflict-envelope"), "synthetic:lifecycle:conflict");
  const supersessionEntity = asEntity("assertion_supersession", supersession.supersessionIdentity.id, supersession.supersessionIdentity.revision, entityDigest("synthetic.supersession", supersession), sha("supersession-envelope"), "synthetic:lifecycle:supersession");
  const decision = (entity: CompositeEntityRevisionReference, lifecycleEffect: CompositeAdmissionDecisionReference["lifecycleEffect"] = "create"): CompositeAdmissionDecisionReference => ({ decisionIdentity: identity(`synthetic:decision:${entity.stableId}:${entity.revision}`), entity, authorisedOperation: lifecycleEffect === "supersede" ? "supersede" : "register", lifecycleEffect });
  const included = [knowledgeEntity, primaryEntity, competingEntity, membershipPrimary, membershipCompeting, relationshipEntity, conflictEntity, supersessionEntity];
  const publicationMembers = included.map((entity) => ({ entity, requirement: (entity === knowledgeEntity || entity === primaryEntity || entity === competingEntity || entity === membershipPrimary || entity === membershipCompeting ? "required" : "context_only") as "required" | "context_only", state: "included" as const, admissionDecision: decision(entity, entity === supersessionEntity ? "supersede" : "create"), dependencyEntityKeys: [], withholdingReason: null, blockingReason: null }));
  const withheldMember = { entity: withheldEntity, requirement: "optional" as const, state: "withheld" as const, admissionDecision: decision(withheldEntity), dependencyEntityKeys: [], withholdingReason: "Synthetic optional claim remains explicitly withheld.", blockingReason: null };
  const memberships = [{ membership: membershipPrimary, knowledge: knowledgeEntity, assertion: primaryEntity, role: "required_fixture_member", requirement: "required" as const, admissionDecision: decision(membershipPrimary) }, { membership: membershipCompeting, knowledge: knowledgeEntity, assertion: competingEntity, role: "required_fixture_member", requirement: "required" as const, admissionDecision: decision(membershipCompeting) }];
  const relationships = [{ relationship: relationshipEntity, source: primaryEntity, target: competingEntity, direction: "outgoing", relationshipType: "synthetically_competes_with", admissionDecision: decision(relationshipEntity) }];
  const dependencies = [{ dependentEntityKey: compositeEntityKey(membershipPrimary), requiredEntityKey: compositeEntityKey(primaryEntity), relationship: "membership" as const }, { dependentEntityKey: compositeEntityKey(relationshipEntity), requiredEntityKey: compositeEntityKey(competingEntity), relationship: "governed_relationship" as const }, { dependentEntityKey: compositeEntityKey(conflictEntity), requiredEntityKey: compositeEntityKey(primaryEntity), relationship: "conflict_context" as const }, { dependentEntityKey: compositeEntityKey(supersessionEntity), requiredEntityKey: compositeEntityKey(primaryEntity), relationship: "supersession_lineage" as const }];
  const unitWithoutDigest: Omit<CompositePublicationUnitInput, "unitDigest"> = { unitId: "synthetic:publication-unit", unitRevision: "1", contractVersion: "1", publicationSource: source(), predecessorSnapshot: before, operation: "register", members: reverse ? [withheldMember, ...publicationMembers].reverse() : [...publicationMembers, withheldMember], memberships: reverse ? [...memberships].reverse() : memberships, relationships, dependencies: reverse ? [...dependencies].reverse() : dependencies, atomicityPolicy: "all_required_or_none" };
  const unit = defineEngineeringAssertionCompositePublicationUnit({ ...unitWithoutDigest, unitDigest: deriveCompositePublicationUnitDigest(unitWithoutDigest) });
  const unitReference: AdmissionStableIdentity = { id: unit.unitId, revision: unit.unitRevision, contentDigest: unit.unitDigest };
  const sourceReference: AdmissionStableIdentity = { id: unit.publicationSource.sourceId, revision: unit.publicationSource.sourceRevision, contentDigest: unit.publicationSource.sourceEnvelopeDigest };
  const registryKind = (kind: CompositeEntityRevisionReference["entityKind"]): CompositeRegistryRecord["entityKind"] => kind === "calibration_knowledge" ? "calibration_knowledge_object" : kind === "assertion_membership" ? "knowledge_membership" : kind;
  const records: CompositeRegistryRecord[] = unit.members.filter((member) => member.state === "included").map(({ entity, admissionDecision }) => ({ entityKind: registryKind(entity.entityKind), stableId: entity.stableId, revision: entity.revision, canonicalPayloadDigest: entity.canonicalPayloadDigest, revisionEnvelopeDigest: entity.revisionEnvelopeDigest, lifecycleIdentity: entity.lifecycleIdentity, admissionDecision, compositeUnitReference: unitReference, publicationSourceReference: sourceReference, effectivePublicationIdentity: "synthetic:publication:1", parentMembershipKeys: entity.entityKind === "engineering_assertion" ? memberships.filter((item) => item.assertion.stableId === entity.stableId).map((item) => compositeEntityKey(item.membership)) : [], relationshipKeys: entity.stableId === primaryEntity.stableId || entity.stableId === competingEntity.stableId ? [compositeEntityKey(relationshipEntity)] : [], conflictKeys: entity.stableId === primaryEntity.stableId || entity.stableId === competingEntity.stableId ? [compositeEntityKey(conflictEntity)] : [], supersessionKeys: entity.stableId === primaryEntity.stableId ? [compositeEntityKey(supersessionEntity)] : [], provenanceIdentityIds: entity.provenanceIdentityIds }));
  const manifest = defineCompositeRegistryManifest(reverse ? [...records].reverse() : records);
  const after = snapshot("synthetic:snapshot:after", "after");
  const resultingSnapshot = { snapshot: after, recordSetDigest: manifest.recordSetDigest, recordCount: manifest.records.length, predecessor: before, compositeUnitReference: unitReference, publicationSourceReference: sourceReference };
  const publishedEntityKeys = manifest.records.map(compositeRegistryRecordKey);
  const resultBase: Omit<CompositeExecutionResult, "resultDigest"> = { resultIdentity: identity("synthetic:execution-result"), state: "complete", compositeUnitReference: unitReference, publicationSourceReference: sourceReference, predecessorSnapshot: before, resultingSnapshot, candidateSnapshot: null, publishedEntityKeys: reverse ? [...publishedEntityKeys].reverse() : publishedEntityKeys, unchangedEntityKeys: [], withheldEntityKeys: [compositeEntityKey(withheldEntity).replace("engineering_assertion", "engineering_assertion")], blockedEntityKeys: [], failedEntityKeys: [], mutationSummary: ["Synthetic atomic publication of sealed composite."], atomicMutationProven: true, atomicNonPublicationProven: false, reconciliationRequired: false, reason: "Synthetic complete publication proof.", originalExecutionResult: null, originalReceipt: null, replayObservationIdentity: null };
  const result = constructCompositeExecutionResult({ ...resultBase, resultDigest: deriveCompositeExecutionResultDigest(resultBase) }, unit, manifest);
  const entityProofs = manifest.records.map((record) => ({ entityKey: compositeRegistryRecordKey(record), recordDigest: record.canonicalPayloadDigest, recordSetDigest: manifest.recordSetDigest, proofKind: "published" as const }));
  const receiptBase: Omit<CompositeEvidentiaryReceipt, "receiptDigest"> = { receiptIdentity: identity("synthetic:publication-receipt"), compositeUnitReference: unitReference, executionResultReference: { ...result.resultIdentity, contentDigest: result.resultDigest }, publicationSourceReference: sourceReference, predecessorSnapshot: before, resultingSnapshot: after, recordSetDigest: manifest.recordSetDigest, entityProofs: reverse ? [...entityProofs].reverse() : entityProofs, membershipProofKeys: (reverse ? [...memberships].reverse() : memberships).map((item) => compositeEntityKey(item.membership)), relationshipProofKeys: [compositeEntityKey(relationshipEntity)], conflictProofKeys: [compositeEntityKey(conflictEntity)], supersessionProofKeys: [compositeEntityKey(supersessionEntity)], lineagePredecessor: null, reconciliationOfReceipt: null, contractVersion: "1" };
  const receipt = constructCompositeReceipt({ ...receiptBase, receiptDigest: deriveCompositeReceiptDigest(receiptBase) }, result, manifest);
  const replayBase: Omit<CompositeExecutionResult, "resultDigest"> = { ...resultBase, resultIdentity: identity("synthetic:replay-result"), state: "idempotent_replay", mutationSummary: [], originalExecutionResult: result.resultIdentity, originalReceipt: { receiptId: receipt.receiptIdentity.id, receiptRevision: receipt.receiptIdentity.revision, receiptDigest: receipt.receiptDigest }, replayObservationIdentity: identity("synthetic:replay-observation") };
  const replay = constructCompositeExecutionResult({ ...replayBase, resultDigest: deriveCompositeExecutionResultDigest(replayBase) }, unit, manifest);
  const historicalCitation = Object.freeze({ stableAssertionId: primary.identity.stableAssertionId, assertionRevision: primary.identity.assertionRevision, canonicalAssertionDigest: primary.identity.canonicalAssertionDigest, assertionRevisionEnvelopeDigest: exact(primary).assertionRevisionEnvelopeDigest, registrySnapshotId: after.snapshotId, registrySnapshotRevision: after.snapshotRevision, registrySnapshotDigest: after.snapshotEnvelopeDigest, publicationReceiptId: receipt.receiptIdentity.id, publicationReceiptRevision: receipt.receiptIdentity.revision, publicationReceiptDigest: receipt.receiptDigest, parentCalibrationKnowledgeStableId: "synthetic:knowledge:fictional-controller", parentCalibrationKnowledgeVersion: "1" });
  return Object.freeze({ knowledge, predecessor, primary, competing, withheld, evidencePackage, assessment, conflict, supersession, unit, manifest, result, receipt, replay, historicalCitation, withheldEntity });
}

test("synthetic assertions retain exact independent qualification and admission dispositions", () => { const f = buildFixture(); assert.deepEqual(f.assessment.assertionAssessments.map((item) => item.disposition).sort(), ["accepted_provisional", "accepted_provisional", "withdrawn_before_publication"].sort()); assert.equal(f.assessment.compositeEligibility.withheldOptionalAssertionRevisions.length, 1); assert.equal(f.primary.qualification.confidence, "medium"); assert.equal(f.competing.qualification.confidence, "low"); });
test("optional withholding remains explicit and absent from Registry publication", () => { const f = buildFixture(); assert.equal(f.unit.withheldOptionalEntityKeys.length, 1); assert.ok(f.unit.members.find((item) => item.entity.stableId === f.withheld.identity.stableAssertionId)?.withholdingReason); assert.equal(f.manifest.records.some((item) => item.stableId === f.withheld.identity.stableAssertionId), false); });
test("conflict and partial supersession preserve exact immutable assertion revisions", () => { const f = buildFixture(); assert.equal(f.conflict.firstAssertion.assertionRevision, "2"); assert.equal(f.conflict.secondAssertion.assertionRevision, "1"); assert.equal(f.conflict.resolutionState, "unresolved"); assert.equal(f.supersession.predecessor.assertionRevision, "1"); assert.equal(f.supersession.successor.assertionRevision, "2"); assert.ok(f.supersession.retainedScope); assert.ok(Object.isFrozen(f.supersession)); });
test("composite Registry Snapshot and receipt prove exactly the included entity set", () => { const f = buildFixture(); assert.equal(f.result.publishedEntityKeys.length, f.manifest.records.length); assert.equal(f.result.resultingSnapshot?.recordSetDigest, f.manifest.recordSetDigest); assert.equal(f.receipt.entityProofs.length, f.manifest.records.length); assert.equal(f.receipt.recordSetDigest, f.manifest.recordSetDigest); assert.notEqual(f.receipt.receiptDigest, f.result.resultDigest); });
test("idempotent replay preserves original lineage without duplicate mutation", () => { const f = buildFixture(); assert.equal(f.replay.state, "idempotent_replay"); assert.equal(f.replay.originalExecutionResult?.id, f.result.resultIdentity.id); assert.equal(f.replay.originalReceipt?.receiptDigest, f.receipt.receiptDigest); assert.equal(f.replay.resultingSnapshot?.snapshot.snapshotEnvelopeDigest, f.result.resultingSnapshot?.snapshot.snapshotEnvelopeDigest); assert.deepEqual(f.replay.mutationSummary, []); });
test("historical citation remains exact after later supersession material exists", () => { const f = buildFixture(); const citation = structuredClone(f.historicalCitation); const later = assertion(f.primary.identity.stableAssertionId, "3", "fictional_later_state"); assert.equal(citation.canonicalAssertionDigest, f.primary.identity.canonicalAssertionDigest); assert.equal(citation.assertionRevisionEnvelopeDigest, exact(f.primary).assertionRevisionEnvelopeDigest); assert.equal(citation.publicationReceiptDigest, f.receipt.receiptDigest); assert.notEqual(citation.canonicalAssertionDigest, later.identity.canonicalAssertionDigest); assert.deepEqual(f.historicalCitation, citation); });
test("caller ordering cannot alter canonical publication receipt or replay vectors", () => {
  const forward = buildFixture(false), reversed = buildFixture(true);
  assert.deepEqual(
    [forward.unit.unitDigest, forward.manifest.recordSetDigest, forward.result.resultDigest, forward.receipt.receiptDigest, forward.replay.resultDigest],
    [
      "sha256:401379b79ca82c1a1d4d75407d0728f73fa6a02f04eb2a9d015e86df79a4b777",
      "sha256:2fc752ffab002fe5bf27497e59447b8ebe3b9d40d77277516e1253f32d6029be",
      "sha256:26cbeebbea96e0ae84411ff65c88700f0fc7577c1c2a0f1d21357954d0178db9",
      "sha256:ef4a216d98423459845a0f3300692632b62d38514674b1c09f6f3add6e674654",
      "sha256:16d320b54d535d565392f2ad04611c43a32f40eec503234bf38b88ef8a6e3cbe",
    ],
  );
  assert.equal(forward.unit.unitDigest, reversed.unit.unitDigest);
  assert.deepEqual(forward.unit.canonicalPayload.canonicalBytes, reversed.unit.canonicalPayload.canonicalBytes);
  assert.equal(forward.manifest.recordSetDigest, reversed.manifest.recordSetDigest);
  assert.equal(forward.result.resultDigest, reversed.result.resultDigest);
  assert.equal(forward.receipt.receiptDigest, reversed.receipt.receiptDigest);
  assert.equal(forward.replay.resultDigest, reversed.replay.resultDigest);
});
test("complete synthetic chain is deeply immutable and contains no production execution surface", () => { const f = buildFixture(); for (const value of [f.knowledge, f.primary, f.assessment, f.conflict, f.supersession, f.unit, f.manifest, f.result, f.receipt, f.replay]) assert.ok(Object.isFrozen(value)); assert.ok(Object.isFrozen(f.unit.members)); assert.ok(Object.isFrozen(f.manifest.records)); assert.equal(Reflect.set(f.unit.members, "0", null), false); assert.equal(Reflect.set(f.receipt.entityProofs, "0", null), false); for (const key of ["persist", "execute", "database", "api", "runtimeRegistry", "ui", "explanation", "decisionGuidance", "boostTargetMain"]) assert.equal(Reflect.get(f, key), undefined); });

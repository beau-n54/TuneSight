import assert from "node:assert/strict";
import test from "node:test";

import type { AdmissionAuthorityClaim, AdmissionEvidencePackage, AdmissionStableIdentity } from "./calibrationKnowledgeAdmission.ts";
import type { CalibrationApplicability, GovernedVocabularyReference, QualifiedAssertion } from "./calibrationKnowledge.ts";
import {
  assessEngineeringAssertionAdmissionBinding,
  type EngineeringAssertionAdmissionAssessmentInput,
  type EngineeringAssertionAdmissionMember,
  type EngineeringAssertionEvidenceBinding,
} from "./engineeringAssertionAdmissionBinding.ts";
import { deriveEngineeringAssertionContentDigest, deriveEngineeringAssertionRevisionDigests } from "./engineeringAssertionCanonicalSerialization.ts";
import type { EngineeringAssertion } from "./engineeringAssertion.ts";

const digest = (character: string): string => `sha256:${character.repeat(64)}`;
const identity = (id: string, revision = "1"): AdmissionStableIdentity => ({ id, revision, contentDigest: digest("a") });
const vocabulary = (termId: string): GovernedVocabularyReference => ({ vocabularyId: "assertion-admission", vocabularyVersion: "1", termId, label: termId, recognition: "known" });
const applicability = (): CalibrationApplicability => ({
  scope: vocabulary("strategy_scoped"), platforms: [], engineFamilies: [], ecuFamilies: [], dmeVariants: [], controlStrategies: ["test-strategy"], romFamilies: [], softwareVersions: [], calibrationIds: [], stockVariantIds: [], operatingModes: [], transmissions: [], regions: [], emissionsSpecifications: [], hardwareConfigurations: [], sourceReferenceIds: [], unresolvedReason: null,
});
const qualifiedText = (assertionId: string): QualifiedAssertion<string> => ({ assertionId, value: "Condition", verificationStatus: "candidate", confidence: "medium", authority: null, provenance: [], supportingEvidence: [], contradictoryEvidence: [], applicability: applicability(), conflictState: "none", unresolvedReason: null, version: "1", lifecycle: { status: "active", version: "1" } });

const unboundAssertion = (stableAssertionId: string): EngineeringAssertion => ({
  identity: { stableAssertionId, assertionRevision: "1", canonicalAssertionDigest: digest("0") },
  statement: { statementRepresentationId: `statement:${stableAssertionId}`, statementRevision: "1", language: "en-AU", text: "Synthetic assertion fixture.", canonicalStatementDigest: digest("b") },
  assertionClass: vocabulary("purpose"),
  proposition: { subject: { knowledgeId: "calibration:test", governedTerm: null, literal: null }, predicate: vocabulary("represents"), object: { knowledgeId: null, governedTerm: vocabulary("quantity"), literal: null }, direction: null, modality: vocabulary("descriptive"), causality: vocabulary("non_causal") },
  scope: { applicability: applicability(), preconditions: [qualifiedText(`${stableAssertionId}:precondition`)], exclusions: [], knownLimitations: [], unresolvedDimensions: [] },
  qualification: { verificationStatus: "candidate", confidence: "medium", authority: null, provenance: [], supportingEvidence: [], contradictoryEvidence: [], conflictState: "none", unresolvedReason: null },
  memberships: [{ calibrationKnowledgeStableId: "calibration:test", calibrationKnowledgeVersion: "1", role: vocabulary("member"), requirement: vocabulary("required") }],
  relationships: [], lifecycle: { status: "active", version: "1" }, contractVersion: "1.0",
});

const assertion = (stableAssertionId = "assertion:test:one"): EngineeringAssertion => {
  const value = unboundAssertion(stableAssertionId);
  return { ...value, identity: { ...value.identity, canonicalAssertionDigest: deriveEngineeringAssertionContentDigest(value).digest.qualifiedDigest } };
};
const member = (value = assertion()): EngineeringAssertionAdmissionMember => ({
  assertion: value,
  assertionRevisionEnvelopeDigest: deriveEngineeringAssertionRevisionDigests(value).revisionEnvelopeDigest.qualifiedDigest,
  requirement: "required",
  authorityClaimIds: [],
  dependencyStableAssertionIds: [],
  structuralState: "valid",
  identityState: "resolved",
  scopeState: "resolved",
  conflictState: "none",
  harmState: "none",
  omissionRequested: false,
  omissionReason: null,
  parentRemainsStructurallyTruthfulWithoutMember: false,
  requiredParentRoleFulfilledWithoutMember: false,
});
const evidencePackage = (): AdmissionEvidencePackage => ({
  packageIdentity: identity("evidence-package:test"),
  evidence: [{ evidenceId: "evidence:test", sourceType: "synthetic", sourceIdentifier: "fixture:test" }],
  provenance: [], sourceRevisionDigests: [], assertionMappings: [], collectionMethod: "synthetic fixture", transformationHistory: [], chainOfCustody: [], knownLimitations: [], createdDate: "2026-08-02", supersededPackageRevision: null,
});
const binding = (value: EngineeringAssertion): EngineeringAssertionEvidenceBinding => {
  const derived = deriveEngineeringAssertionRevisionDigests(value);
  return {
    bindingId: `binding:${value.identity.stableAssertionId}`,
    evidenceId: "evidence:test",
    assertion: { stableAssertionId: value.identity.stableAssertionId, assertionRevision: value.identity.assertionRevision, canonicalAssertionDigest: value.identity.canonicalAssertionDigest, assertionRevisionEnvelopeDigest: derived.revisionEnvelopeDigest.qualifiedDigest },
    propositionPath: "/proposition/object",
    scopePath: null,
    role: "supporting",
  };
};
const authorityClaim = (): AdmissionAuthorityClaim => ({
  claimIdentity: identity("authority-claim:test"),
  authority: { authorityType: "founder", authorityIdentifier: "founder:test" },
  assertionCategories: [vocabulary("purpose")], applicability: [], permittedVerificationCeiling: "founder_verified",
  effectiveFrom: "2026-01-01", effectiveUntil: null, supportingAuthorityEvidenceIds: ["evidence:test"], limitations: [], lifecycle: { status: "submitted", version: "1" },
});
const input = (members: readonly EngineeringAssertionAdmissionMember[] = [member()]): EngineeringAssertionAdmissionAssessmentInput => ({
  assessmentIdentity: identity("assertion-assessment:test"),
  proposalIdentity: identity("assertion-proposal:test"),
  evidencePackage: evidencePackage(),
  members,
  evidenceBindings: members.map((item) => binding(item.assertion)),
  authorityClaims: [],
  policy: { policyId: "assertion-admission-policy", policyVersion: "1", authoritativeVerificationStatuses: ["verified", "founder_verified", "authoritatively_verified"], provisionalVerificationStatuses: ["unknown", "observed", "candidate", "provisional"], lifecycleChangeStatuses: ["superseded", "deprecated", "rejected"] },
  assessmentDate: "2026-08-02",
});

test("binds Evidence and disposition to one exact immutable assertion revision", () => {
  const result = assessEngineeringAssertionAdmissionBinding(input());
  assert.equal(result.assertionAssessments[0].disposition, "accepted_provisional");
  assert.equal(result.assertionAssessments[0].assertion.assertionRevision, "1");
  assert.equal(result.evidenceBindingAssessments[0].exactRevisionMatch, true);
  assert.equal(result.compositeEligibility.eligibleForAdmissionDecision, true);
});

test("earlier Evidence cannot qualify a later assertion revision", () => {
  const first = assertion();
  const later: EngineeringAssertion = { ...first, identity: { ...first.identity, assertionRevision: "2" } };
  const laterMember = member(later);
  const base = input([laterMember]);
  const value = { ...base, evidenceBindings: [binding(first)] };
  assert.throws(() => assessEngineeringAssertionAdmissionBinding(value), /does not match an exact proposed assertion revision/);
});

test("shared Evidence requires a separate explicit binding for each revision", () => {
  const first = member(assertion("assertion:test:one"));
  const second = member(assertion("assertion:test:two"));
  const base = input([first, second]);
  const value = { ...base, evidenceBindings: [binding(first.assertion)] };
  const result = assessEngineeringAssertionAdmissionBinding(value);
  assert.equal(result.assertionAssessments.find((item) => item.assertion.stableAssertionId === "assertion:test:one")?.disposition, "accepted_provisional");
  assert.equal(result.assertionAssessments.find((item) => item.assertion.stableAssertionId === "assertion:test:two")?.disposition, "requires_evidence");
  assert.equal(result.compositeEligibility.eligibleForAdmissionDecision, false);
});

test("preserves confidence independently from verification and authority", () => {
  const result = assessEngineeringAssertionAdmissionBinding(input());
  assert.equal(result.assertionAssessments[0].preservedConfidence, "medium");
  assert.equal(result.assertionAssessments[0].verificationCeiling, "candidate");
  assert.deepEqual(result.assertionAssessments[0].qualifiedAuthorityClaimIds, []);
});

test("qualified authority raises only the exact member ceiling", () => {
  const first = { ...member(assertion("assertion:test:one")), authorityClaimIds: ["authority-claim:test"] };
  const second = member(assertion("assertion:test:two"));
  const base = input([first, second]);
  const value = { ...base, authorityClaims: [authorityClaim()] };
  const result = assessEngineeringAssertionAdmissionBinding(value);
  assert.equal(result.assertionAssessments.find((item) => item.assertion.stableAssertionId === "assertion:test:one")?.verificationCeiling, "founder_verified");
  assert.equal(result.assertionAssessments.find((item) => item.assertion.stableAssertionId === "assertion:test:two")?.verificationCeiling, "candidate");
});

test("allows an explicit safe optional omission", () => {
  const optional: EngineeringAssertionAdmissionMember = {
    ...member(), requirement: "optional", omissionRequested: true,
    omissionReason: "Optional assertion remains unresolved.",
    parentRemainsStructurallyTruthfulWithoutMember: true,
    requiredParentRoleFulfilledWithoutMember: true,
  };
  const base = input([optional]);
  const value = { ...base, evidenceBindings: [] };
  const result = assessEngineeringAssertionAdmissionBinding(value);
  assert.equal(result.compositeEligibility.eligibleForAdmissionDecision, true);
  assert.equal(result.compositeEligibility.withheldOptionalAssertionRevisions.length, 1);
});

test("blocks optional omission when an included assertion depends upon it", () => {
  const optional: EngineeringAssertionAdmissionMember = {
    ...member(assertion("assertion:test:optional")), requirement: "optional",
    omissionRequested: true, omissionReason: "Withheld.",
    parentRemainsStructurallyTruthfulWithoutMember: true,
    requiredParentRoleFulfilledWithoutMember: true,
  };
  const dependent: EngineeringAssertionAdmissionMember = {
    ...member(assertion("assertion:test:dependent")),
    dependencyStableAssertionIds: ["assertion:test:optional"],
  };
  const base = input([optional, dependent]);
  const value = { ...base, evidenceBindings: [binding(dependent.assertion)] };
  const result = assessEngineeringAssertionAdmissionBinding(value);
  assert.equal(result.compositeEligibility.eligibleForAdmissionDecision, false);
});

test("keeps structural identity scope conflict and harm dispositions distinct", () => {
  const cases = [
    ["structuralState", "invalid", "invalid"],
    ["identityState", "unresolved", "identity_unresolved"],
    ["scopeState", "unresolved", "scope_unresolved"],
    ["conflictState", "conflict", "conflict"],
    ["harmState", "potential", "deferred"],
    ["harmState", "material", "rejected"],
  ] as const;
  for (const [field, state, disposition] of cases) {
    const changed = { ...member(), [field]: state };
    assert.equal(assessEngineeringAssertionAdmissionBinding(input([changed])).assertionAssessments[0].disposition, disposition);
  }
});

test("rejects malformed paths unknown Evidence and substituted envelope digests", () => {
  const pathBase = input();
  const badPath = { ...pathBase, evidenceBindings: [{ ...pathBase.evidenceBindings[0], propositionPath: "/scope/not-proposition" }] };
  assert.throws(() => assessEngineeringAssertionAdmissionBinding(badPath), /canonical proposition JSON Pointer/);
  const evidenceBase = input();
  const unknownEvidence = { ...evidenceBase, evidenceBindings: [{ ...evidenceBase.evidenceBindings[0], evidenceId: "missing" }] };
  assert.throws(() => assessEngineeringAssertionAdmissionBinding(unknownEvidence), /unknown Evidence/);
  const badEnvelope = { ...member(), assertionRevisionEnvelopeDigest: digest("9") };
  assert.throws(() => assessEngineeringAssertionAdmissionBinding(input([badEnvelope])), /revision-envelope digest does not match/);
});

test("rejects multiple proposed revisions for one stable assertion identity", () => {
  const first = member(assertion());
  const secondAssertion = { ...first.assertion, identity: { ...first.assertion.identity, assertionRevision: "2" } };
  const second = member(secondAssertion);
  assert.throws(() => assessEngineeringAssertionAdmissionBinding(input([first, second])), /Proposed stable assertion identity.*duplicated/);
});

test("rejects invalid calendar assessment dates", () => {
  const value = { ...input(), assessmentDate: "2026-02-30" };
  assert.throws(() => assessEngineeringAssertionAdmissionBinding(value), /assessment date is invalid/);
});

test("outputs are deterministic recursively frozen and caller-isolated", () => {
  const value = input();
  const result = assessEngineeringAssertionAdmissionBinding(value);
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.assertionAssessments[0].assertion));
  assert.ok(Object.isFrozen(result.compositeEligibility.includedAssertionRevisions));
  (value.members[0].dependencyStableAssertionIds as string[]).push("mutation");
  assert.deepEqual(result.compositeEligibility.unresolvedConditions, []);
});

test("exposes no publication registry persistence runtime or UI surface", () => {
  const serialized = JSON.stringify(assessEngineeringAssertionAdmissionBinding(input()));
  for (const prohibited of ["publicationInstruction", "registrySnapshot", "publicationReceipt", "database", "runtime", "presentation"]) assert.equal(serialized.includes(prohibited), false);
});

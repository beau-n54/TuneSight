import assert from "node:assert/strict";
import test from "node:test";
import type {
  AdmissionDecisionOutcome,
  AdmissionPolicyReference,
  AdmissionStableIdentity,
  AdmissionValidationFinding,
  PublicationOperation,
} from "./calibrationKnowledgeAdmission.ts";
import type { CalibrationKnowledgeEvidenceAuthorityAssessment } from "./calibrationKnowledgeEvidenceAuthorityAssessment.ts";
import type { CalibrationIdentityLineageConflictAssessment } from "./calibrationKnowledgeIdentityLineageConflictAssessment.ts";
import type { CalibrationPublicationEligibilityAssessment } from "./calibrationKnowledgePublicationEligibilityAssessment.ts";
import {
  constructAuthorisedCalibrationKnowledgeAdmissionDecision,
  type AuthorisedCalibrationKnowledgeAdmissionDecisionInput,
  type CalibrationAdmissionDecisionAuthorityScope,
} from "./calibrationKnowledgeAuthorisedAdmissionDecision.ts";

const digest = (seed: string): string => `sha256:${[...seed].map((item) => item.charCodeAt(0).toString(16)).join("").padEnd(64, "0").slice(0, 64)}`;
const identity = (id: string, revision = "1"): AdmissionStableIdentity => ({ id, revision, contentDigest: digest(`${id}:${revision}`) });
const proposalIdentity = identity("proposal:1");
const evidencePackageIdentity = identity("evidence:package");

const admissionPolicy = (): AdmissionPolicyReference => ({
  policyId: "eligibility-policy",
  policyVersion: "1",
  effectiveDate: "2026-08-01",
  applicableProposalKinds: ["register_new"],
  validationRuleVersions: ["1"],
  authorityRuleVersion: "1",
  publicationRuleVersion: "1",
});

const validationFinding = (): AdmissionValidationFinding => ({
  findingId: "finding:review",
  findingCode: "REVIEW_REQUIRED",
  severity: "warning",
  category: "publication",
  affectedProposalPaths: [],
  affectedAssertionIds: [],
  affectedEvidenceIds: [],
  affectedAuthorityClaimIds: [],
  message: "Review is required.",
  blocking: false,
  resolutionRequirement: "Complete review.",
  lifecycle: { status: "assessed", version: "1" },
});

const evidenceAssessment = (findings: readonly AdmissionValidationFinding[] = []): CalibrationKnowledgeEvidenceAuthorityAssessment => ({
  assessmentIdentity: identity("assessment:evidence"),
  proposalIdentity,
  evidencePackageIdentity,
  policyId: "evidence-policy",
  policyVersion: "1",
  assessmentDate: "2026-08-01",
  evidenceAssessment: {
    packageIdentity: evidencePackageIdentity,
    expectedPackageIdentity: evidencePackageIdentity,
    state: "complete",
    references: [], missingEvidenceIds: [], duplicateEvidenceIds: [], staleOrMismatchedIdentity: false,
    sourceIdentityComplete: true, transformationHistoryComplete: true, chainOfCustodyComplete: true, limitations: [],
  },
  assertionEvidenceAssessments: [],
  authorityAssessments: [],
  verificationCeilings: [],
  findings,
});

const identityAssessment = (operation: PublicationOperation = "register"): CalibrationIdentityLineageConflictAssessment => ({
  assessmentIdentity: identity("assessment:identity"),
  proposalIdentity,
  identity: { state: operation === "register" ? "new_calibration" : "lifecycle_amendment", proposedStableKnowledgeId: "calibration:1", matchedCanonicalKnowledgeIds: [], consideredClaimIds: [], prohibitedClaimIds: [], confidence: "unknown", unresolvedReason: null },
  lineage: { state: operation === "register" ? "new_root" : "lifecycle_amendment", operation, targetStableKnowledgeId: "calibration:1", predecessorVersion: operation === "register" ? null : "1", currentCanonicalVersion: operation === "register" ? null : "1", historyPreserved: true, unresolvedReason: null },
  conflict: { status: "none", conflicts: [], ambiguityProposalIds: [] },
  canonicalHistorySnapshot: [],
});

const eligibility = (state: CalibrationPublicationEligibilityAssessment["state"] = "eligible"): CalibrationPublicationEligibilityAssessment => ({
  assessmentIdentity: identity("assessment:eligibility"),
  proposalIdentity,
  state,
  policyId: "eligibility-policy",
  policyVersion: "1",
  policyCompliant: true,
  lifecycleCompatible: true,
  predecessorCompatible: true,
  versionCompatible: true,
  operationPermitted: true,
  blockingConditions: state === "blocked" || state === "invalid" ? [{ conditionId: "condition:blocking", kind: "policy", sourceAssessmentId: "assessment:evidence", sourceFindingIds: [], message: "Blocked." }] : [],
  unresolvedConditions: state === "unresolved" ? [{ conditionId: "condition:unresolved", kind: "evidence", sourceAssessmentId: "assessment:evidence", sourceFindingIds: [], message: "Evidence remains unresolved." }] : [],
  publicationConstraints: [],
  requiredFollowUp: [],
  outstandingEngineeringObligations: [],
  eligibleForAdmissionDecision: state === "eligible" || state === "eligible_with_constraints",
});

const allOutcomes: readonly AdmissionDecisionOutcome[] = ["invalid", "requires_evidence", "requires_authority", "identity_unresolved", "conflict", "deferred", "rejected", "accepted_provisional", "accepted_authoritative", "accepted_lifecycle_change", "superseded_proposal"];
const allOperations: readonly PublicationOperation[] = ["register", "enrich", "correct", "refine_applicability", "add_evidence", "record_dispute", "resolve_conflict", "supersede", "deprecate", "reject", "restore"];
const authorityScope = (): CalibrationAdmissionDecisionAuthorityScope => ({ scopeId: "scope:admission", scopeVersion: "1", authorityId: "founder:beau", permittedOutcomes: allOutcomes, permittedOperations: allOperations, permittedPolicyIds: ["eligibility-policy"], limitations: ["Records governance authority only."] });

function input(outcome: AdmissionDecisionOutcome = "deferred", state: CalibrationPublicationEligibilityAssessment["state"] = "eligible"): AuthorisedCalibrationKnowledgeAdmissionDecisionInput {
  return {
    decisionIdentity: identity("decision:1"), proposalIdentity, evidencePackageIdentity,
    evidenceAuthorityAssessment: evidenceAssessment(), identityLineageConflictAssessment: identityAssessment(), eligibilityAssessment: eligibility(state), policy: admissionPolicy(),
    decisionAuthority: { authorityType: "founder", authorityIdentifier: "founder:beau" }, decisionAuthorityScope: authorityScope(), outcome,
    decisionDate: "2026-08-01", decidedAt: "2026-08-01T05:00:00Z", rationale: "Record the authorised decision.",
    acceptedFindingIds: [], rejectedFindingIds: [], unresolvedConditions: [], publicationInstructionId: outcome.startsWith("accepted_") ? "instruction:future" : null,
    supersededDecisionIdentity: null, contractVersion: "1",
  };
}

test("constructs a valid deferred decision", () => { const result = constructAuthorisedCalibrationKnowledgeAdmissionDecision(input("deferred")); assert.equal(result.decision.outcome, "deferred"); assert.equal(result.decision.publicationInstructionId, null); });
test("constructs a valid rejected decision", () => { const result = constructAuthorisedCalibrationKnowledgeAdmissionDecision(input("rejected", "blocked")); assert.equal(result.decision.outcome, "rejected"); assert.equal(result.preservedEligibilityState, "blocked"); });
test("constructs a valid accepted provisional decision without changing qualifications", () => { const source = evidenceAssessment(); const result = constructAuthorisedCalibrationKnowledgeAdmissionDecision({ ...input("accepted_provisional"), evidenceAuthorityAssessment: source }); assert.equal(result.decision.outcome, "accepted_provisional"); assert.equal(source.verificationCeilings.length, 0); });
test("constructs a valid accepted authoritative decision within assessed ceilings", () => { const source = evidenceAssessment(); const assessed = { ...source, authorityAssessments: [{ assertionId: "purpose:1", state: "qualified" as const, claimAssessments: [], qualifiedClaimIds: ["authority:1"], limitations: [] }], verificationCeilings: [{ assertionId: "purpose:1", proposedVerificationStatus: "verified" as const, preservedConfidence: "high" as const, evidenceState: "complete" as const, authorityState: "qualified" as const, maximumPermittedVerificationStatus: "verified" as const, proposedExceedsCeiling: false, limitations: [] }] }; const result = constructAuthorisedCalibrationKnowledgeAdmissionDecision({ ...input("accepted_authoritative"), evidenceAuthorityAssessment: assessed }); assert.equal(result.decision.outcome, "accepted_authoritative"); });
test("constructs a valid accepted lifecycle-change decision", () => { const result = constructAuthorisedCalibrationKnowledgeAdmissionDecision({ ...input("accepted_lifecycle_change"), identityLineageConflictAssessment: identityAssessment("deprecate") }); assert.equal(result.publicationOperation, "deprecate"); });

for (const state of ["invalid", "blocked"] as const) test(`${state} eligibility cannot be accepted`, () => { assert.throws(() => constructAuthorisedCalibrationKnowledgeAdmissionDecision(input("accepted_provisional", state)), /cannot produce an accepted decision/); });
test("unresolved eligibility cannot be accepted as authoritative", () => { assert.throws(() => constructAuthorisedCalibrationKnowledgeAdmissionDecision(input("accepted_authoritative", "unresolved")), /cannot produce an accepted decision/); });
test("eligible_with_constraints preserves every constraint and obligation", () => { const finding = validationFinding(); const constrained = { ...eligibility("eligible_with_constraints"), publicationConstraints: [{ conditionId: "constraint:1", kind: "publication_constraint" as const, sourceAssessmentId: "assessment:evidence", sourceFindingIds: [finding.findingId], message: finding.message }], outstandingEngineeringObligations: [finding.message] }; const result = constructAuthorisedCalibrationKnowledgeAdmissionDecision({ ...input("accepted_provisional", "eligible_with_constraints"), evidenceAuthorityAssessment: evidenceAssessment([finding]), eligibilityAssessment: constrained, acceptedFindingIds: [finding.findingId] }); assert.deepEqual(result.preservedPublicationConstraints, constrained.publicationConstraints); assert.deepEqual(result.preservedOutstandingEngineeringObligations, [finding.message]); });
test("authoritative acceptance cannot exceed verification ceilings", () => { const source = evidenceAssessment(); const assessed = { ...source, verificationCeilings: [{ assertionId: "purpose:1", proposedVerificationStatus: "verified" as const, preservedConfidence: "high" as const, evidenceState: "complete" as const, authorityState: "qualified" as const, maximumPermittedVerificationStatus: "candidate" as const, proposedExceedsCeiling: true, limitations: [] }] }; assert.throws(() => constructAuthorisedCalibrationKnowledgeAdmissionDecision({ ...input("accepted_authoritative"), evidenceAuthorityAssessment: assessed }), /verification ceiling/); });
test("authoritative acceptance requires qualified assessed authority", () => { const source = evidenceAssessment(); const assessed = { ...source, authorityAssessments: [{ assertionId: "purpose:1", state: "unresolved" as const, claimAssessments: [], qualifiedClaimIds: [], limitations: ["Unresolved."] }] }; assert.throws(() => constructAuthorisedCalibrationKnowledgeAdmissionDecision({ ...input("accepted_authoritative"), evidenceAuthorityAssessment: assessed }), /every assessed authority/); });
test("lifecycle acceptance remains bounded to lifecycle operations", () => { assert.throws(() => constructAuthorisedCalibrationKnowledgeAdmissionDecision(input("accepted_lifecycle_change")), /incompatible with operation register/); });
test("lifecycle operations cannot use non-lifecycle accepted outcomes", () => { assert.throws(() => constructAuthorisedCalibrationKnowledgeAdmissionDecision({ ...input("accepted_provisional"), identityLineageConflictAssessment: identityAssessment("deprecate") }), /requires an accepted lifecycle-change/); });

test("accepted and rejected finding identities are preserved deterministically", () => { const a = { ...validationFinding(), findingId: "finding:a" }; const b = { ...validationFinding(), findingId: "finding:b" }; const result = constructAuthorisedCalibrationKnowledgeAdmissionDecision({ ...input("deferred"), evidenceAuthorityAssessment: evidenceAssessment([b, a]), acceptedFindingIds: [b.findingId], rejectedFindingIds: [a.findingId] }); assert.deepEqual(result.decision.acceptedFindingIds, ["finding:b"]); assert.deepEqual(result.decision.rejectedFindingIds, ["finding:a"]); });
test("unresolved eligibility conditions are preserved", () => { const result = constructAuthorisedCalibrationKnowledgeAdmissionDecision({ ...input("deferred", "unresolved"), unresolvedConditions: ["Founder review pending."] }); assert.deepEqual(result.decision.unresolvedConditions, ["Evidence remains unresolved.", "Founder review pending."]); });
test("exact proposal revision binding is enforced", () => { assert.throws(() => constructAuthorisedCalibrationKnowledgeAdmissionDecision({ ...input(), proposalIdentity: identity("proposal:1", "2") }), /exact proposal identity and revision/); });
test("exact Evidence package revision binding is enforced", () => { assert.throws(() => constructAuthorisedCalibrationKnowledgeAdmissionDecision({ ...input(), evidencePackageIdentity: identity("evidence:package", "2") }), /exact Evidence package identity and revision/); });
test("exact eligibility policy binding is enforced", () => { assert.throws(() => constructAuthorisedCalibrationKnowledgeAdmissionDecision({ ...input(), policy: { ...admissionPolicy(), policyVersion: "2" } }), /exact eligibility policy/); });
test("inconsistent eligibility binding is rejected", () => { assert.throws(() => constructAuthorisedCalibrationKnowledgeAdmissionDecision({ ...input(), eligibilityAssessment: { ...eligibility(), eligibleForAdmissionDecision: false } }), /inconsistent decision-eligibility/); });

test("decision authority scope must match authority outcome operation and policy", () => { assert.throws(() => constructAuthorisedCalibrationKnowledgeAdmissionDecision({ ...input(), decisionAuthorityScope: { ...authorityScope(), authorityId: "other" } }), /does not belong/); assert.throws(() => constructAuthorisedCalibrationKnowledgeAdmissionDecision({ ...input(), decisionAuthorityScope: { ...authorityScope(), permittedOutcomes: ["rejected"] } }), /does not permit outcome/); });
test("decision date and timestamp are explicit and consistent", () => { assert.throws(() => constructAuthorisedCalibrationKnowledgeAdmissionDecision({ ...input(), decisionDate: "2026-02-30" }), /valid calendar/); assert.throws(() => constructAuthorisedCalibrationKnowledgeAdmissionDecision({ ...input(), decidedAt: "2026-08-02T00:00:00Z" }), /must match/); });
test("corrected decision revisions supersede rather than overwrite", () => { const result = constructAuthorisedCalibrationKnowledgeAdmissionDecision({ ...input(), decisionIdentity: identity("decision:1", "2"), supersededDecisionIdentity: identity("decision:1", "1") }); assert.equal(result.decision.supersededDecisionId, "decision:1"); assert.equal(result.supersededDecisionIdentity?.revision, "1"); });
test("decision revision and supersession combinations are validated", () => { assert.throws(() => constructAuthorisedCalibrationKnowledgeAdmissionDecision({ ...input(), decisionIdentity: identity("decision:1", "2") }), /must supersede/); assert.throws(() => constructAuthorisedCalibrationKnowledgeAdmissionDecision({ ...input(), supersededDecisionIdentity: identity("decision:old") }), /Initial decision/); });
test("duplicate and unknown finding identities are rejected", () => { const finding = validationFinding(); assert.throws(() => constructAuthorisedCalibrationKnowledgeAdmissionDecision({ ...input(), evidenceAuthorityAssessment: evidenceAssessment([finding]), acceptedFindingIds: [finding.findingId, finding.findingId] }), /duplicate/); assert.throws(() => constructAuthorisedCalibrationKnowledgeAdmissionDecision({ ...input(), acceptedFindingIds: ["missing"] }), /unknown finding/); });
test("accepted decisions require only a publication instruction reference", () => { assert.throws(() => constructAuthorisedCalibrationKnowledgeAdmissionDecision({ ...input("accepted_provisional"), publicationInstructionId: null }), /requires a publication instruction reference/); assert.throws(() => constructAuthorisedCalibrationKnowledgeAdmissionDecision({ ...input("deferred"), publicationInstructionId: "instruction:not-allowed" }), /cannot reference/); });

test("output is deterministic recursively frozen and isolated from caller mutation", () => { const unresolved = ["Second", "First"]; const source = { ...input("deferred"), unresolvedConditions: unresolved }; const first = constructAuthorisedCalibrationKnowledgeAdmissionDecision(source); const second = constructAuthorisedCalibrationKnowledgeAdmissionDecision({ ...source, unresolvedConditions: [...unresolved].reverse() }); unresolved[0] = "Changed"; assert.deepEqual(first, second); assert.ok(Object.isFrozen(first)); assert.ok(Object.isFrozen(first.decision)); assert.ok(Object.isFrozen(first.decision.unresolvedConditions)); assert.deepEqual(first.decision.unresolvedConditions, ["First", "Second"]); });
test("constructor exposes no publication execution receipt registry runtime persistence or schema surface", () => { const result = constructAuthorisedCalibrationKnowledgeAdmissionDecision(input()); for (const key of ["publicationReceipt", "publicationExecution", "registry", "runtime", "persistence", "schema"]) assert.equal(Reflect.get(result, key), undefined); });

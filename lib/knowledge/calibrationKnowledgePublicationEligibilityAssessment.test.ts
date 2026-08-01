import assert from "node:assert/strict";
import test from "node:test";
import type { AdmissionStableIdentity, AdmissionValidationFinding } from "./calibrationKnowledgeAdmission.ts";
import type { CalibrationKnowledgeEvidenceAuthorityAssessment } from "./calibrationKnowledgeEvidenceAuthorityAssessment.ts";
import type { CalibrationIdentityLineageConflictAssessment } from "./calibrationKnowledgeIdentityLineageConflictAssessment.ts";
import {
  assessCalibrationKnowledgePublicationEligibility,
  type CalibrationPublicationEligibilityAssessmentInput,
  type CalibrationPublicationEligibilityPolicy,
} from "./calibrationKnowledgePublicationEligibilityAssessment.ts";

const digest = (seed: string): string => `sha256:${[...seed].map((item) => item.charCodeAt(0).toString(16)).join("").padEnd(64, "0").slice(0, 64)}`;
const identity = (id: string): AdmissionStableIdentity => ({ id, revision: "1", contentDigest: digest(id) });
const proposalIdentity = identity("proposal:1");

const policy = (): CalibrationPublicationEligibilityPolicy => ({
  policyId: "eligibility-policy",
  policyVersion: "1",
  compatibleEvidenceAuthorityPolicyId: "evidence-policy",
  compatibleEvidenceAuthorityPolicyVersions: ["1"],
  permittedOperations: ["register", "enrich", "correct", "refine_applicability", "add_evidence", "record_dispute", "resolve_conflict", "supersede", "deprecate", "reject", "restore"],
  eligibleIdentityStates: ["new_calibration", "existing_calibration", "correction", "enrichment", "applicability_refinement", "lifecycle_amendment", "supersession", "source_representation", "restoration"],
  eligibleLineageStates: ["new_root", "valid_successor", "enrichment", "correction", "refinement", "supersession", "restoration", "deprecation", "lifecycle_amendment"],
  blockingFindingSeverities: ["error", "critical"],
  blockingFindingCategories: [],
  reviewFindingSeverities: ["warning"],
});

const evidenceAssessment = (): CalibrationKnowledgeEvidenceAuthorityAssessment => ({
  assessmentIdentity: identity("assessment:evidence"),
  proposalIdentity,
  evidencePackageIdentity: identity("evidence:package"),
  policyId: "evidence-policy",
  policyVersion: "1",
  assessmentDate: "2026-08-01",
  evidenceAssessment: {
    packageIdentity: identity("evidence:package"),
    expectedPackageIdentity: identity("evidence:package"),
    state: "complete",
    references: [],
    missingEvidenceIds: [],
    duplicateEvidenceIds: [],
    staleOrMismatchedIdentity: false,
    sourceIdentityComplete: true,
    transformationHistoryComplete: true,
    chainOfCustodyComplete: true,
    limitations: [],
  },
  assertionEvidenceAssessments: [],
  authorityAssessments: [],
  verificationCeilings: [],
  findings: [],
});

const identityAssessment = (): CalibrationIdentityLineageConflictAssessment => ({
  assessmentIdentity: identity("assessment:identity"),
  proposalIdentity,
  identity: {
    state: "new_calibration",
    proposedStableKnowledgeId: "calibration:1",
    matchedCanonicalKnowledgeIds: [],
    consideredClaimIds: [],
    prohibitedClaimIds: [],
    confidence: "unknown",
    unresolvedReason: null,
  },
  lineage: {
    state: "new_root",
    operation: "register",
    targetStableKnowledgeId: "calibration:1",
    predecessorVersion: null,
    currentCanonicalVersion: null,
    historyPreserved: true,
    unresolvedReason: null,
  },
  conflict: { status: "none", conflicts: [], ambiguityProposalIds: [] },
  canonicalHistorySnapshot: [],
});

function input(
  evidence: CalibrationKnowledgeEvidenceAuthorityAssessment = evidenceAssessment(),
  identityLineage: CalibrationIdentityLineageConflictAssessment = identityAssessment(),
  eligibilityPolicy: CalibrationPublicationEligibilityPolicy = policy(),
): CalibrationPublicationEligibilityAssessmentInput {
  return { assessmentIdentity: identity("assessment:eligibility"), evidenceAuthorityAssessment: evidence, identityLineageConflictAssessment: identityLineage, policy: eligibilityPolicy };
}

const finding = (overrides: Partial<AdmissionValidationFinding> = {}): AdmissionValidationFinding => ({
  findingId: "finding:1",
  findingCode: "REVIEW_REQUIRED",
  severity: "warning",
  category: "publication",
  affectedProposalPaths: [],
  affectedAssertionIds: [],
  affectedEvidenceIds: [],
  affectedAuthorityClaimIds: [],
  message: "Authorised review is required.",
  blocking: false,
  resolutionRequirement: "Review the finding.",
  lifecycle: { status: "assessed", version: "1" },
  ...overrides,
});

test("fully qualified completed assessments are eligible for an Admission Decision", () => {
  const result = assessCalibrationKnowledgePublicationEligibility(input());
  assert.equal(result.state, "eligible");
  assert.equal(result.eligibleForAdmissionDecision, true);
  assert.equal(Reflect.get(result, "decision"), undefined);
});

test("nonblocking review findings produce eligible_with_constraints", () => {
  const result = assessCalibrationKnowledgePublicationEligibility(input({ ...evidenceAssessment(), findings: [finding()] }));
  assert.equal(result.state, "eligible_with_constraints");
  assert.equal(result.publicationConstraints.length, 1);
  assert.equal(result.eligibleForAdmissionDecision, true);
});

test("blocking findings block eligibility", () => {
  const result = assessCalibrationKnowledgePublicationEligibility(input({ ...evidenceAssessment(), findings: [finding({ severity: "error", blocking: true })] }));
  assert.equal(result.state, "blocked");
  assert.equal(result.eligibleForAdmissionDecision, false);
});

test("unresolved Evidence remains unresolved rather than invalid or eligible", () => {
  const evidence = evidenceAssessment();
  const result = assessCalibrationKnowledgePublicationEligibility(input({ ...evidence, evidenceAssessment: { ...evidence.evidenceAssessment, state: "unresolved" } }));
  assert.equal(result.state, "unresolved");
  assert.equal(result.unresolvedConditions[0].kind, "evidence");
});

test("invalid Evidence assessment produces invalid eligibility", () => {
  const evidence = evidenceAssessment();
  const result = assessCalibrationKnowledgePublicationEligibility(input({ ...evidence, evidenceAssessment: { ...evidence.evidenceAssessment, state: "invalid" } }));
  assert.equal(result.state, "invalid");
});

test("blocking structural prerequisite produces invalid eligibility", () => {
  const structural = finding({ findingId: "finding:structural", category: "structural", severity: "critical", blocking: true });
  const result = assessCalibrationKnowledgePublicationEligibility(input({ ...evidenceAssessment(), findings: [structural] }));
  assert.equal(result.state, "invalid");
  assert.equal(result.blockingConditions[0].kind, "structural_prerequisite");
});

test("incompatible policy is a blocking policy condition", () => {
  const result = assessCalibrationKnowledgePublicationEligibility(input(evidenceAssessment(), identityAssessment(), { ...policy(), compatibleEvidenceAuthorityPolicyVersions: ["2"] }));
  assert.equal(result.policyCompliant, false);
  assert.equal(result.state, "blocked");
});

test("lineage conflict preserves predecessor and version incompatibility", () => {
  const source = identityAssessment();
  const changed = { ...source, lineage: { ...source.lineage, state: "conflict" as const, predecessorVersion: "1", currentCanonicalVersion: "2", unresolvedReason: "Predecessor mismatch." } };
  const result = assessCalibrationKnowledgePublicationEligibility(input(evidenceAssessment(), changed));
  assert.equal(result.predecessorCompatible, false);
  assert.equal(result.versionCompatible, false);
  assert.equal(result.state, "blocked");
});

test("unresolved identity remains unresolved", () => {
  const source = identityAssessment();
  const changed = { ...source, identity: { ...source.identity, state: "unresolved" as const, unresolvedReason: "Identity awaits evidence." }, lineage: { ...source.lineage, state: "unresolved" as const, unresolvedReason: "Identity awaits evidence." } };
  const result = assessCalibrationKnowledgePublicationEligibility(input(evidenceAssessment(), changed));
  assert.equal(result.state, "unresolved");
});

test("material conflict blocks eligibility", () => {
  const source = identityAssessment();
  const changed = { ...source, conflict: { status: "unresolved" as const, ambiguityProposalIds: [], conflicts: [{ conflictId: "conflict:1", category: "identity" as const, material: true, ambiguityOnly: false, summary: "Conflict.", assertionIds: [], evidenceIds: [], authorityClaimIds: [], canonicalKnowledgeIds: [], proposalIds: [proposalIdentity.id], unresolvedReason: "Resolve conflict." }] } };
  const result = assessCalibrationKnowledgePublicationEligibility(input(evidenceAssessment(), changed));
  assert.equal(result.state, "blocked");
  assert.equal(result.blockingConditions.some((item) => item.kind === "conflict"), true);
});

test("unsupported operation is blocked by governed policy", () => {
  const narrowed = { ...policy(), permittedOperations: ["enrich" as const] };
  const result = assessCalibrationKnowledgePublicationEligibility(input(evidenceAssessment(), identityAssessment(), narrowed));
  assert.equal(result.operationPermitted, false);
  assert.equal(result.state, "blocked");
});

test("lifecycle incompatibility is distinct from publication operation", () => {
  const narrowed = { ...policy(), eligibleLineageStates: ["valid_successor" as const] };
  const result = assessCalibrationKnowledgePublicationEligibility(input(evidenceAssessment(), identityAssessment(), narrowed));
  assert.equal(result.lifecycleCompatible, false);
  assert.equal(result.operationPermitted, true);
  assert.equal(result.state, "blocked");
});

test("verification above its assessed ceiling is blocked without changing qualification", () => {
  const evidence = evidenceAssessment();
  const changed: CalibrationKnowledgeEvidenceAuthorityAssessment = { ...evidence, verificationCeilings: [{ assertionId: "purpose:1", proposedVerificationStatus: "verified", preservedConfidence: "high", evidenceState: "complete", authorityState: "qualified", maximumPermittedVerificationStatus: "candidate", proposedExceedsCeiling: true, limitations: ["Ceiling exceeded."] }] };
  const result = assessCalibrationKnowledgePublicationEligibility(input(changed));
  assert.equal(result.state, "blocked");
  assert.equal(changed.verificationCeilings[0].proposedVerificationStatus, "verified");
});

test("assessment ordering is deterministic", () => {
  const first = finding({ findingId: "finding:b", message: "B" });
  const second = finding({ findingId: "finding:a", message: "A" });
  const forward = assessCalibrationKnowledgePublicationEligibility(input({ ...evidenceAssessment(), findings: [first, second] }));
  const reverse = assessCalibrationKnowledgePublicationEligibility(input({ ...evidenceAssessment(), findings: [second, first] }));
  assert.deepEqual(forward, reverse);
  assert.deepEqual(forward.publicationConstraints.map((item) => item.conditionId), ["finding:finding:a", "finding:finding:b"]);
});

test("output is recursively frozen and isolated from caller mutation", () => {
  const findings = [finding()];
  const result = assessCalibrationKnowledgePublicationEligibility(input({ ...evidenceAssessment(), findings }));
  findings[0] = finding({ findingId: "changed" });
  assert.equal(result.publicationConstraints[0].sourceFindingIds[0], "finding:1");
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.publicationConstraints));
  assert.ok(Object.isFrozen(result.publicationConstraints[0].sourceFindingIds));
});

test("mismatched completed assessment identities are rejected", () => {
  const source = identityAssessment();
  assert.throws(() => assessCalibrationKnowledgePublicationEligibility(input(evidenceAssessment(), { ...source, proposalIdentity: identity("proposal:other") })), /same proposal identity/);
});

test("invalid policy vocabulary and duplicate values are rejected", () => {
  assert.throws(() => assessCalibrationKnowledgePublicationEligibility(input(evidenceAssessment(), identityAssessment(), { ...policy(), permittedOperations: ["register", "register"] })), /duplicate/);
  assert.throws(() => assessCalibrationKnowledgePublicationEligibility(input(evidenceAssessment(), identityAssessment(), { ...policy(), eligibleLineageStates: [] })), /must not be empty/);
});

test("assessment exposes no Admission Decision Publication Registry or runtime surface", () => {
  const result = assessCalibrationKnowledgePublicationEligibility(input());
  for (const key of ["admissionDecision", "publicationInstruction", "publicationReceipt", "publication", "registry", "runtime"]) assert.equal(Reflect.get(result, key), undefined);
});

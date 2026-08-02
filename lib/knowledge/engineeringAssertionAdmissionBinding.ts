import type {
  AdmissionAuthorityClaim,
  AdmissionEvidencePackage,
  AdmissionStableIdentity,
} from "./calibrationKnowledgeAdmission.ts";
import type {
  KnowledgeConfidenceState,
} from "./stockVariants.ts";
import type {
  KnowledgeVerificationStatus,
} from "./calibrationKnowledge.ts";
import {
  defineEngineeringAssertion,
  type EngineeringAssertion,
} from "./engineeringAssertion.ts";
import {
  deriveEngineeringAssertionRevisionDigests,
} from "./engineeringAssertionCanonicalSerialization.ts";

export type EngineeringAssertionEvidenceRole = "supporting" | "contradictory";
export type EngineeringAssertionMemberRequirement = "required" | "optional";
export type EngineeringAssertionStructuralState = "valid" | "invalid";
export type EngineeringAssertionIdentityState = "resolved" | "unresolved";
export type EngineeringAssertionScopeState = "resolved" | "unresolved";
export type EngineeringAssertionConflictState = "none" | "conflict";
export type EngineeringAssertionHarmState = "none" | "potential" | "material" | "unknown";

export type EngineeringAssertionAdmissionDisposition =
  | "invalid"
  | "requires_evidence"
  | "requires_authority"
  | "identity_unresolved"
  | "scope_unresolved"
  | "conflict"
  | "deferred"
  | "rejected"
  | "accepted_provisional"
  | "accepted_authoritative"
  | "accepted_lifecycle_change"
  | "superseded_proposal"
  | "withdrawn_before_publication";

export type ExactEngineeringAssertionRevisionReference = Readonly<{
  stableAssertionId: string;
  assertionRevision: string;
  canonicalAssertionDigest: string;
  assertionRevisionEnvelopeDigest: string;
}>;

export type EngineeringAssertionEvidenceBinding = Readonly<{
  bindingId: string;
  evidenceId: string;
  assertion: ExactEngineeringAssertionRevisionReference;
  propositionPath: string | null;
  scopePath: string | null;
  role: EngineeringAssertionEvidenceRole;
}>;

export type EngineeringAssertionAdmissionMember = Readonly<{
  assertion: EngineeringAssertion;
  assertionRevisionEnvelopeDigest: string;
  requirement: EngineeringAssertionMemberRequirement;
  authorityClaimIds: readonly string[];
  dependencyStableAssertionIds: readonly string[];
  structuralState: EngineeringAssertionStructuralState;
  identityState: EngineeringAssertionIdentityState;
  scopeState: EngineeringAssertionScopeState;
  conflictState: EngineeringAssertionConflictState;
  harmState: EngineeringAssertionHarmState;
  omissionRequested: boolean;
  omissionReason: string | null;
  parentRemainsStructurallyTruthfulWithoutMember: boolean;
  requiredParentRoleFulfilledWithoutMember: boolean;
}>;

export type EngineeringAssertionAdmissionPolicy = Readonly<{
  policyId: string;
  policyVersion: string;
  authoritativeVerificationStatuses: readonly KnowledgeVerificationStatus[];
  provisionalVerificationStatuses: readonly KnowledgeVerificationStatus[];
  lifecycleChangeStatuses: readonly string[];
}>;

export type EngineeringAssertionAdmissionAssessmentInput = Readonly<{
  assessmentIdentity: AdmissionStableIdentity;
  proposalIdentity: AdmissionStableIdentity;
  evidencePackage: AdmissionEvidencePackage;
  members: readonly EngineeringAssertionAdmissionMember[];
  evidenceBindings: readonly EngineeringAssertionEvidenceBinding[];
  authorityClaims: readonly AdmissionAuthorityClaim[];
  policy: EngineeringAssertionAdmissionPolicy;
  assessmentDate: string;
}>;

export type EngineeringAssertionEvidenceBindingAssessment = Readonly<{
  bindingId: string;
  evidenceId: string;
  assertion: ExactEngineeringAssertionRevisionReference;
  propositionPath: string | null;
  scopePath: string | null;
  role: EngineeringAssertionEvidenceRole;
  exactRevisionMatch: boolean;
}>;

export type EngineeringAssertionMemberAdmissionAssessment = Readonly<{
  assertion: ExactEngineeringAssertionRevisionReference;
  requirement: EngineeringAssertionMemberRequirement;
  disposition: EngineeringAssertionAdmissionDisposition;
  supportingEvidenceBindingIds: readonly string[];
  contradictoryEvidenceBindingIds: readonly string[];
  qualifiedAuthorityClaimIds: readonly string[];
  verificationCeiling: KnowledgeVerificationStatus;
  preservedConfidence: KnowledgeConfidenceState;
  structuralState: EngineeringAssertionStructuralState;
  identityState: EngineeringAssertionIdentityState;
  scopeState: EngineeringAssertionScopeState;
  conflictState: EngineeringAssertionConflictState;
  harmState: EngineeringAssertionHarmState;
  omitted: boolean;
  unresolvedReasons: readonly string[];
}>;

export type EngineeringAssertionCompositeEligibility = Readonly<{
  eligibleForAdmissionDecision: boolean;
  includedAssertionRevisions: readonly ExactEngineeringAssertionRevisionReference[];
  withheldOptionalAssertionRevisions: readonly ExactEngineeringAssertionRevisionReference[];
  blockingAssertionRevisions: readonly ExactEngineeringAssertionRevisionReference[];
  unresolvedConditions: readonly string[];
}>;

export type EngineeringAssertionAdmissionAssessment = Readonly<{
  assessmentIdentity: AdmissionStableIdentity;
  proposalIdentity: AdmissionStableIdentity;
  evidencePackageIdentity: AdmissionStableIdentity;
  policyId: string;
  policyVersion: string;
  assertionAssessments: readonly EngineeringAssertionMemberAdmissionAssessment[];
  evidenceBindingAssessments: readonly EngineeringAssertionEvidenceBindingAssessment[];
  compositeEligibility: EngineeringAssertionCompositeEligibility;
  assessmentDate: string;
}>;

const verificationOrder: readonly KnowledgeVerificationStatus[] = [
  "unknown", "observed", "candidate", "provisional", "verified",
  "founder_verified", "authoritatively_verified", "disputed", "rejected",
  "superseded", "deprecated",
];

function requireNonBlank(value: string, field: string): void {
  if (!value.trim()) throw new Error(`${field} is required.`);
}

function requireDigest(value: string, field: string): void {
  if (!/^sha256:[0-9a-f]{64}$/.test(value)) throw new Error(`${field} must be a qualified SHA-256 digest.`);
}

function requireCalendarDate(value: string, field: string): void {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error(`${field} must be YYYY-MM-DD.`);
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  if (date.toISOString().slice(0, 10) !== value) throw new Error(`${field} is invalid.`);
}

function validateStableIdentity(value: AdmissionStableIdentity, field: string): void {
  requireNonBlank(value.id, `${field} identity`);
  requireNonBlank(value.revision, `${field} revision`);
  if (!/^[a-z0-9][a-z0-9_-]*:[a-f0-9]{32,}$/i.test(value.contentDigest)) throw new Error(`${field} content digest is invalid.`);
}

function requireUnique(values: readonly string[], field: string): void {
  const seen = new Set<string>();
  for (const value of values) {
    requireNonBlank(value, field);
    if (seen.has(value)) throw new Error(`${field} ${value} is duplicated.`);
    seen.add(value);
  }
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function uniqueSorted(values: readonly string[]): readonly string[] {
  return [...new Set(values)].sort(compareText);
}

function deepCloneFreeze<T>(value: T): T {
  if (Array.isArray(value)) return Object.freeze(value.map(deepCloneFreeze)) as T;
  if (value !== null && typeof value === "object") {
    const clone: Record<PropertyKey, unknown> = {};
    for (const key of Reflect.ownKeys(value)) clone[key] = deepCloneFreeze((value as Record<PropertyKey, unknown>)[key]);
    return Object.freeze(clone) as T;
  }
  return value;
}

function revisionReference(member: EngineeringAssertionAdmissionMember): ExactEngineeringAssertionRevisionReference {
  const digests = deriveEngineeringAssertionRevisionDigests(member.assertion);
  if (digests.revisionEnvelopeDigest.qualifiedDigest !== member.assertionRevisionEnvelopeDigest) throw new Error(`Assertion ${member.assertion.identity.stableAssertionId} revision-envelope digest does not match.`);
  return {
    stableAssertionId: member.assertion.identity.stableAssertionId,
    assertionRevision: member.assertion.identity.assertionRevision,
    canonicalAssertionDigest: member.assertion.identity.canonicalAssertionDigest,
    assertionRevisionEnvelopeDigest: member.assertionRevisionEnvelopeDigest,
  };
}

function referenceKey(value: ExactEngineeringAssertionRevisionReference): string {
  return [value.stableAssertionId, value.assertionRevision, value.canonicalAssertionDigest, value.assertionRevisionEnvelopeDigest].join("\u0000");
}

function sameReference(left: ExactEngineeringAssertionRevisionReference, right: ExactEngineeringAssertionRevisionReference): boolean {
  return referenceKey(left) === referenceKey(right);
}

function validatePath(value: string | null, root: "proposition" | "scope", field: string): void {
  if (value === null) return;
  if (!value.startsWith(`/${root}/`) || value.includes("//") || /~(?![01])/.test(value)) throw new Error(`${field} must be a canonical ${root} JSON Pointer.`);
}

function validateBinding(binding: EngineeringAssertionEvidenceBinding): void {
  requireNonBlank(binding.bindingId, "Evidence binding identity");
  requireNonBlank(binding.evidenceId, "Bound Evidence identity");
  requireNonBlank(binding.assertion.stableAssertionId, "Bound stable assertion identity");
  requireNonBlank(binding.assertion.assertionRevision, "Bound assertion revision");
  requireDigest(binding.assertion.canonicalAssertionDigest, "Bound assertion content digest");
  requireDigest(binding.assertion.assertionRevisionEnvelopeDigest, "Bound assertion revision-envelope digest");
  validatePath(binding.propositionPath, "proposition", "Evidence proposition path");
  validatePath(binding.scopePath, "scope", "Evidence scope path");
  if (binding.role !== "supporting" && binding.role !== "contradictory") throw new Error("Evidence binding role is invalid.");
}

function vocabularyKey(value: AdmissionAuthorityClaim["assertionCategories"][number]): string {
  return [value.vocabularyId, value.vocabularyVersion, value.termId].join("\u0000");
}

function authorityQualified(
  claim: AdmissionAuthorityClaim,
  member: EngineeringAssertionAdmissionMember,
  evidenceIds: ReadonlySet<string>,
  assessmentDate: string
): boolean {
  const category = vocabularyKey(member.assertion.assertionClass);
  return claim.lifecycle.status === "submitted" &&
    claim.effectiveFrom <= assessmentDate &&
    (claim.effectiveUntil === null || claim.effectiveUntil >= assessmentDate) &&
    claim.assertionCategories.some((item) => vocabularyKey(item) === category) &&
    claim.supportingAuthorityEvidenceIds.every((id) => evidenceIds.has(id));
}

function strongestVerification(claims: readonly AdmissionAuthorityClaim[]): KnowledgeVerificationStatus {
  if (claims.length === 0) return "candidate";
  return claims.reduce((strongest, claim) => {
    const current = verificationOrder.indexOf(strongest);
    const candidate = verificationOrder.indexOf(claim.permittedVerificationCeiling);
    return candidate > current ? claim.permittedVerificationCeiling : strongest;
  }, "candidate" as KnowledgeVerificationStatus);
}

function dispositionFor(
  member: EngineeringAssertionAdmissionMember,
  supportingCount: number,
  qualifiedClaims: readonly AdmissionAuthorityClaim[],
  policy: EngineeringAssertionAdmissionPolicy
): EngineeringAssertionAdmissionDisposition {
  const verification = member.assertion.qualification.verificationStatus;
  if (member.omissionRequested) return "withdrawn_before_publication";
  if (member.structuralState === "invalid") return "invalid";
  if (member.identityState === "unresolved") return "identity_unresolved";
  if (member.scopeState === "unresolved") return "scope_unresolved";
  if (member.conflictState === "conflict") return "conflict";
  if (member.harmState === "material") return "rejected";
  if (member.harmState === "potential" || member.harmState === "unknown") return "deferred";
  if (supportingCount === 0) return "requires_evidence";
  if (policy.authoritativeVerificationStatuses.includes(verification) && qualifiedClaims.length === 0) return "requires_authority";
  if (policy.lifecycleChangeStatuses.includes(member.assertion.lifecycle.status)) return "accepted_lifecycle_change";
  if (policy.authoritativeVerificationStatuses.includes(verification)) return "accepted_authoritative";
  if (policy.provisionalVerificationStatuses.includes(verification)) return "accepted_provisional";
  return "deferred";
}

function accepted(disposition: EngineeringAssertionAdmissionDisposition): boolean {
  return disposition === "accepted_provisional" || disposition === "accepted_authoritative" || disposition === "accepted_lifecycle_change";
}

export function assessEngineeringAssertionAdmissionBinding(
  input: EngineeringAssertionAdmissionAssessmentInput
): EngineeringAssertionAdmissionAssessment {
  validateStableIdentity(input.assessmentIdentity, "Assertion admission assessment");
  validateStableIdentity(input.proposalIdentity, "Assertion admission proposal");
  validateStableIdentity(input.evidencePackage.packageIdentity, "Evidence package");
  requireNonBlank(input.policy.policyId, "Assertion admission policy identity");
  requireNonBlank(input.policy.policyVersion, "Assertion admission policy version");
  requireUnique(input.policy.authoritativeVerificationStatuses, "Authoritative verification status");
  requireUnique(input.policy.provisionalVerificationStatuses, "Provisional verification status");
  requireUnique([...input.policy.authoritativeVerificationStatuses, ...input.policy.provisionalVerificationStatuses], "Verification policy status");
  for (const status of [...input.policy.authoritativeVerificationStatuses, ...input.policy.provisionalVerificationStatuses]) {
    if (!verificationOrder.includes(status)) throw new Error(`Verification policy status ${status} is invalid.`);
  }
  requireUnique(input.policy.lifecycleChangeStatuses, "Lifecycle-change status");
  requireCalendarDate(input.assessmentDate, "Assertion admission assessment date");
  if (input.members.length === 0) throw new Error("Assertion admission assessment requires a member.");

  const members = input.members.map((member) => {
    defineEngineeringAssertion(member.assertion);
    return { member, reference: revisionReference(member) };
  });
  requireUnique(members.map(({ reference }) => referenceKey(reference)), "Assertion revision reference");
  requireUnique(members.map(({ reference }) => reference.stableAssertionId), "Proposed stable assertion identity");
  requireUnique(input.evidenceBindings.map((item) => item.bindingId), "Evidence binding identity");
  input.evidenceBindings.forEach(validateBinding);
  requireUnique(input.authorityClaims.map((item) => item.claimIdentity.id), "Authority claim identity");
  input.members.forEach((member) => {
    requireUnique(member.authorityClaimIds, "Member authority claim identity");
    requireUnique(member.dependencyStableAssertionIds, "Member dependency assertion identity");
    if (member.omissionRequested && !member.omissionReason?.trim()) throw new Error("Explicit assertion omission requires a reason.");
    if (!member.omissionRequested && member.omissionReason !== null) throw new Error("Included assertion cannot contain an omission reason.");
  });

  const evidenceIds = new Set(input.evidencePackage.evidence.map((item) => item.evidenceId));
  const memberReferences = new Map(members.map(({ reference }) => [referenceKey(reference), reference]));
  const evidenceBindingAssessments = input.evidenceBindings.map((binding) => {
    if (!evidenceIds.has(binding.evidenceId)) throw new Error(`Evidence binding references unknown Evidence ${binding.evidenceId}.`);
    const exactRevisionMatch = memberReferences.has(referenceKey(binding.assertion));
    if (!exactRevisionMatch) throw new Error(`Evidence binding ${binding.bindingId} does not match an exact proposed assertion revision.`);
    return { ...binding, exactRevisionMatch };
  }).sort((left, right) => compareText(left.bindingId, right.bindingId));

  const claimsById = new Map(input.authorityClaims.map((claim) => [claim.claimIdentity.id, claim]));
  const assertionAssessments = members.map(({ member, reference }) => {
    const bindings = evidenceBindingAssessments.filter((item) => sameReference(item.assertion, reference));
    const supporting = bindings.filter((item) => item.role === "supporting");
    const contradictory = bindings.filter((item) => item.role === "contradictory");
    const claims = member.authorityClaimIds.map((id) => {
      const claim = claimsById.get(id);
      if (!claim) throw new Error(`Assertion member references unknown authority claim ${id}.`);
      return claim;
    });
    const qualifiedClaims = claims.filter((claim) => authorityQualified(claim, member, evidenceIds, input.assessmentDate));
    const disposition = dispositionFor(member, supporting.length, qualifiedClaims, input.policy);
    const unresolvedReasons = uniqueSorted([
      ...(member.identityState === "unresolved" ? ["Assertion identity remains unresolved."] : []),
      ...(member.scopeState === "unresolved" ? ["Assertion scope remains unresolved."] : []),
      ...(member.conflictState === "conflict" ? ["Assertion conflict remains unresolved."] : []),
      ...(supporting.length === 0 && !member.omissionRequested ? ["Exact assertion revision requires supporting Evidence."] : []),
      ...(member.harmState !== "none" ? [`Assertion harm assessment is ${member.harmState}.`] : []),
      ...(member.omissionRequested && member.omissionReason ? [member.omissionReason] : []),
    ]);
    return {
      assertion: reference,
      requirement: member.requirement,
      disposition,
      supportingEvidenceBindingIds: supporting.map((item) => item.bindingId).sort(compareText),
      contradictoryEvidenceBindingIds: contradictory.map((item) => item.bindingId).sort(compareText),
      qualifiedAuthorityClaimIds: qualifiedClaims.map((item) => item.claimIdentity.id).sort(compareText),
      verificationCeiling: strongestVerification(qualifiedClaims),
      preservedConfidence: member.assertion.qualification.confidence,
      structuralState: member.structuralState,
      identityState: member.identityState,
      scopeState: member.scopeState,
      conflictState: member.conflictState,
      harmState: member.harmState,
      omitted: member.omissionRequested,
      unresolvedReasons,
    };
  }).sort((left, right) => compareText(referenceKey(left.assertion), referenceKey(right.assertion)));

  const byStableId = new Map(assertionAssessments.map((assessment) => [assessment.assertion.stableAssertionId, assessment]));
  const unresolved: string[] = [];
  const blocking: ExactEngineeringAssertionRevisionReference[] = [];
  const included: ExactEngineeringAssertionRevisionReference[] = [];
  const withheld: ExactEngineeringAssertionRevisionReference[] = [];
  for (const assessment of assertionAssessments) {
    const member = members.find(({ reference }) => sameReference(reference, assessment.assertion))?.member;
    if (!member) throw new Error("Assertion assessment lost its exact member binding.");
    if (assessment.omitted) {
      const acceptedDependent = input.members.some((candidate) => !candidate.omissionRequested && candidate.dependencyStableAssertionIds.includes(assessment.assertion.stableAssertionId));
      const omissionValid = assessment.requirement === "optional" && member.parentRemainsStructurallyTruthfulWithoutMember && member.requiredParentRoleFulfilledWithoutMember && !acceptedDependent;
      if (omissionValid) withheld.push(assessment.assertion);
      else {
        blocking.push(assessment.assertion);
        unresolved.push(`Optional omission for ${assessment.assertion.stableAssertionId} is not structurally safe.`);
      }
      continue;
    }
    const dependenciesAccepted = member.dependencyStableAssertionIds.every((id) => {
      const dependency = byStableId.get(id);
      return dependency !== undefined && accepted(dependency.disposition) && !dependency.omitted;
    });
    if (accepted(assessment.disposition) && dependenciesAccepted) included.push(assessment.assertion);
    else {
      blocking.push(assessment.assertion);
      if (!dependenciesAccepted) unresolved.push(`Assertion ${assessment.assertion.stableAssertionId} has an unavailable dependency.`);
      unresolved.push(...assessment.unresolvedReasons);
    }
  }
  const requiredBlocked = blocking.some((reference) => byStableId.get(reference.stableAssertionId)?.requirement === "required");
  const optionalBlocked = blocking.some((reference) => byStableId.get(reference.stableAssertionId)?.requirement === "optional");
  const compositeEligibility = {
    eligibleForAdmissionDecision: !requiredBlocked && !optionalBlocked,
    includedAssertionRevisions: included.sort((left, right) => compareText(referenceKey(left), referenceKey(right))),
    withheldOptionalAssertionRevisions: withheld.sort((left, right) => compareText(referenceKey(left), referenceKey(right))),
    blockingAssertionRevisions: blocking.sort((left, right) => compareText(referenceKey(left), referenceKey(right))),
    unresolvedConditions: uniqueSorted(unresolved),
  };

  return deepCloneFreeze({
    assessmentIdentity: input.assessmentIdentity,
    proposalIdentity: input.proposalIdentity,
    evidencePackageIdentity: input.evidencePackage.packageIdentity,
    policyId: input.policy.policyId,
    policyVersion: input.policy.policyVersion,
    assertionAssessments,
    evidenceBindingAssessments,
    compositeEligibility,
    assessmentDate: input.assessmentDate,
  });
}

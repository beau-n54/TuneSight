import {
  defineCalibrationKnowledgeAdmissionDecision,
  type AdmissionDecisionOutcome,
  type AdmissionPolicyReference,
  type AdmissionStableIdentity,
  type AdmissionAssertionChangeManifest,
  type AdmissionLifecycleChangeManifest,
  type CalibrationKnowledgeAdmissionDecision,
  type CalibrationKnowledgeAdmissionProposal,
  type PublicationOperation,
} from "./calibrationKnowledgeAdmission.ts";
import type { KnowledgeAuthorityReference } from "./calibrationKnowledge.ts";
import type { CalibrationKnowledgeEvidenceAuthorityAssessment } from "./calibrationKnowledgeEvidenceAuthorityAssessment.ts";
import type { CalibrationIdentityLineageConflictAssessment } from "./calibrationKnowledgeIdentityLineageConflictAssessment.ts";
import type { CalibrationPublicationEligibilityAssessment } from "./calibrationKnowledgePublicationEligibilityAssessment.ts";

export type CalibrationAdmissionDecisionAuthorityScope = Readonly<{
  scopeId: string;
  scopeVersion: string;
  authorityId: string;
  permittedOutcomes: readonly AdmissionDecisionOutcome[];
  permittedOperations: readonly PublicationOperation[];
  permittedPolicyIds: readonly string[];
  limitations: readonly string[];
}>;

export type AuthorisedCalibrationKnowledgeAdmissionDecisionInput = Readonly<{
  decisionIdentity: AdmissionStableIdentity;
  proposal: CalibrationKnowledgeAdmissionProposal;
  proposalIdentity: AdmissionStableIdentity;
  proposedRevisionBinding: CalibrationProposedRevisionDecisionBinding;
  evidencePackageIdentity: AdmissionStableIdentity;
  evidenceAuthorityAssessment: CalibrationKnowledgeEvidenceAuthorityAssessment;
  identityLineageConflictAssessment: CalibrationIdentityLineageConflictAssessment;
  eligibilityAssessment: CalibrationPublicationEligibilityAssessment;
  policy: AdmissionPolicyReference;
  decisionAuthority: KnowledgeAuthorityReference;
  decisionAuthorityScope: CalibrationAdmissionDecisionAuthorityScope;
  outcome: AdmissionDecisionOutcome;
  decisionDate: string;
  decidedAt: string;
  rationale: string;
  acceptedFindingIds: readonly string[];
  rejectedFindingIds: readonly string[];
  unresolvedConditions: readonly string[];
  publicationInstructionId: string | null;
  supersededDecisionIdentity: AdmissionStableIdentity | null;
  contractVersion: string;
}>;

export type CalibrationProposedRevisionDecisionBinding = Readonly<{
  revisionIdentity: AdmissionStableIdentity;
  revisionNumber: string;
  proposedObjectDigest: string;
  proposedStableKnowledgeId: string;
  proposedKnowledgeVersion: string;
  expectedPredecessorStableKnowledgeId: string | null;
  expectedPredecessorKnowledgeVersion: string | null;
  assertionChangeManifest: AdmissionAssertionChangeManifest;
  lifecycleChangeManifest: AdmissionLifecycleChangeManifest;
}>;

export type AuthorisedCalibrationKnowledgeAdmissionDecision = Readonly<{
  decision: CalibrationKnowledgeAdmissionDecision;
  proposalIdentity: AdmissionStableIdentity;
  proposedRevisionBinding: CalibrationProposedRevisionDecisionBinding;
  evidencePackageIdentity: AdmissionStableIdentity;
  evidenceAuthorityAssessmentIdentity: AdmissionStableIdentity;
  identityLineageConflictAssessmentIdentity: AdmissionStableIdentity;
  eligibilityAssessmentIdentity: AdmissionStableIdentity;
  policyId: string;
  policyVersion: string;
  decisionAuthorityScope: CalibrationAdmissionDecisionAuthorityScope;
  decisionDate: string;
  publicationOperation: PublicationOperation;
  preservedEligibilityState: CalibrationPublicationEligibilityAssessment["state"];
  preservedPublicationConstraints: CalibrationPublicationEligibilityAssessment["publicationConstraints"];
  preservedOutstandingEngineeringObligations: readonly string[];
  supersededDecisionIdentity: AdmissionStableIdentity | null;
}>;

const outcomes: readonly AdmissionDecisionOutcome[] = ["invalid", "requires_evidence", "requires_authority", "identity_unresolved", "conflict", "deferred", "rejected", "accepted_provisional", "accepted_authoritative", "accepted_lifecycle_change", "superseded_proposal"];
const operations: readonly PublicationOperation[] = ["register", "enrich", "correct", "refine_applicability", "add_evidence", "record_dispute", "resolve_conflict", "supersede", "deprecate", "reject", "restore"];
const acceptedOutcomes: readonly AdmissionDecisionOutcome[] = ["accepted_provisional", "accepted_authoritative", "accepted_lifecycle_change"];
const lifecycleOperations: readonly PublicationOperation[] = ["record_dispute", "resolve_conflict", "supersede", "deprecate", "reject", "restore"];
const operationByProposal: Readonly<Record<CalibrationKnowledgeAdmissionProposal["proposalKind"], PublicationOperation>> = { register_new: "register", enrich_existing: "enrich", correct_existing: "correct", refine_applicability: "refine_applicability", add_evidence: "add_evidence", record_dispute: "record_dispute", resolve_conflict: "resolve_conflict", supersede: "supersede", deprecate: "deprecate", reject: "reject", restore: "restore" };

function requireNonBlank(value: string, field: string): void {
  if (!value.trim()) throw new Error(`${field} is required.`);
}

function validateIdentity(value: AdmissionStableIdentity, field: string): void {
  requireNonBlank(value.id, `${field} identity`);
  requireNonBlank(value.revision, `${field} revision`);
  if (!/^[a-z0-9][a-z0-9_-]*:[a-f0-9]{32,}$/i.test(value.contentDigest)) throw new Error(`${field} content digest is invalid.`);
}

function sameIdentity(left: AdmissionStableIdentity, right: AdmissionStableIdentity): boolean {
  return left.id === right.id && left.revision === right.revision && left.contentDigest === right.contentDigest;
}

function requireUnique(values: readonly string[], field: string): readonly string[] {
  const sorted = [...values].sort();
  for (let index = 0; index < sorted.length; index += 1) {
    requireNonBlank(sorted[index], field);
    if (index > 0 && sorted[index] === sorted[index - 1]) throw new Error(`${field} contains duplicate ${sorted[index]}.`);
  }
  return sorted;
}

function requireKnownUnique<T extends string>(values: readonly T[], governed: readonly T[], field: string): readonly T[] {
  const sorted = requireUnique(values, field);
  for (const value of sorted) if (!governed.includes(value as T)) throw new Error(`${field} contains unknown value ${value}.`);
  return sorted as readonly T[];
}

function validateDate(value: string): void {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error("Decision date must be YYYY-MM-DD.");
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  if (date.toISOString().slice(0, 10) !== value) throw new Error("Decision date must be a valid calendar date.");
}

function validateAuthorityScope(scope: CalibrationAdmissionDecisionAuthorityScope, authority: KnowledgeAuthorityReference, outcome: AdmissionDecisionOutcome, operation: PublicationOperation, policy: AdmissionPolicyReference): void {
  requireNonBlank(scope.scopeId, "Decision authority scope identity");
  requireNonBlank(scope.scopeVersion, "Decision authority scope version");
  requireNonBlank(scope.authorityId, "Decision authority scope authority identity");
  if (scope.authorityId !== authority.authorityIdentifier) throw new Error("Decision authority scope does not belong to the decision authority.");
  const permittedOutcomes = requireKnownUnique(scope.permittedOutcomes, outcomes, "Decision authority permitted outcome");
  const permittedOperations = requireKnownUnique(scope.permittedOperations, operations, "Decision authority permitted operation");
  const permittedPolicies = requireUnique(scope.permittedPolicyIds, "Decision authority permitted policy");
  scope.limitations.forEach((item) => requireNonBlank(item, "Decision authority limitation"));
  if (!permittedOutcomes.includes(outcome)) throw new Error(`Decision authority scope does not permit outcome ${outcome}.`);
  if (!permittedOperations.includes(operation)) throw new Error(`Decision authority scope does not permit operation ${operation}.`);
  if (!permittedPolicies.includes(policy.policyId)) throw new Error(`Decision authority scope does not permit policy ${policy.policyId}.`);
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

function sorted(values: readonly string[]): readonly string[] { return [...values].sort(); }
function assertionManifestKey(value: AdmissionAssertionChangeManifest): string { return JSON.stringify({ addedAssertionIds: sorted(value.addedAssertionIds), amendedAssertionIds: sorted(value.amendedAssertionIds), retainedAssertionIds: sorted(value.retainedAssertionIds), supersededAssertionIds: sorted(value.supersededAssertionIds), removedFromCurrentAssertionIds: sorted(value.removedFromCurrentAssertionIds) }); }
function lifecycleManifestKey(value: AdmissionLifecycleChangeManifest): string { return JSON.stringify([...value.changes].sort((left, right) => left.sequence - right.sequence || left.changeId.localeCompare(right.changeId))); }
function validateProposedRevisionBinding(input: AuthorisedCalibrationKnowledgeAdmissionDecisionInput): CalibrationProposedRevisionDecisionBinding {
  const revision = input.proposal.proposedRevision;
  const binding = input.proposedRevisionBinding;
  if (!sameIdentity(binding.revisionIdentity, revision.revisionIdentity)) throw new Error("Proposed revision identity does not match the exact authorised proposal revision.");
  if (binding.revisionNumber !== revision.revisionIdentity.revision) throw new Error("Proposed revision number does not match the exact authorised proposal revision.");
  if (binding.proposedObjectDigest !== revision.revisionIdentity.contentDigest) throw new Error("Proposed object digest does not match the exact authorised proposal revision.");
  if (binding.proposedStableKnowledgeId !== revision.proposedStableKnowledgeId) throw new Error("Proposed stable Knowledge identity does not match the exact authorised proposal revision.");
  if (binding.proposedKnowledgeVersion !== revision.proposedKnowledgeVersion) throw new Error("Proposed Knowledge version does not match the exact authorised proposal revision.");
  if (binding.expectedPredecessorStableKnowledgeId !== revision.expectedPredecessorStableKnowledgeId) throw new Error("Expected predecessor stable Knowledge identity does not match the exact authorised proposal revision.");
  if (binding.expectedPredecessorKnowledgeVersion !== revision.expectedPredecessorKnowledgeVersion) throw new Error("Expected predecessor Knowledge version does not match the exact authorised proposal revision.");
  if (assertionManifestKey(binding.assertionChangeManifest) !== assertionManifestKey(revision.changeManifest)) throw new Error("Assertion change manifest does not match the exact authorised proposal revision.");
  if (lifecycleManifestKey(binding.lifecycleChangeManifest) !== lifecycleManifestKey(revision.lifecycleChangeManifest)) throw new Error("Lifecycle-change manifest does not match the exact authorised proposal revision.");
  return deepCloneFreeze({ revisionIdentity: revision.revisionIdentity, revisionNumber: revision.revisionIdentity.revision, proposedObjectDigest: revision.revisionIdentity.contentDigest, proposedStableKnowledgeId: revision.proposedStableKnowledgeId, proposedKnowledgeVersion: revision.proposedKnowledgeVersion, expectedPredecessorStableKnowledgeId: revision.expectedPredecessorStableKnowledgeId, expectedPredecessorKnowledgeVersion: revision.expectedPredecessorKnowledgeVersion, assertionChangeManifest: revision.changeManifest, lifecycleChangeManifest: revision.lifecycleChangeManifest });
}

export function constructAuthorisedCalibrationKnowledgeAdmissionDecision(input: AuthorisedCalibrationKnowledgeAdmissionDecisionInput): AuthorisedCalibrationKnowledgeAdmissionDecision {
  validateIdentity(input.decisionIdentity, "Decision");
  validateIdentity(input.proposalIdentity, "Proposal");
  if (!sameIdentity(input.proposalIdentity, input.proposal.proposalIdentity)) throw new Error("Decision must bind the exact Admission Proposal identity and revision.");
  const proposedRevisionBinding = validateProposedRevisionBinding(input);
  validateIdentity(input.evidencePackageIdentity, "Evidence package");
  if (!sameIdentity(input.proposalIdentity, input.evidenceAuthorityAssessment.proposalIdentity) || !sameIdentity(input.proposalIdentity, input.identityLineageConflictAssessment.proposalIdentity) || !sameIdentity(input.proposalIdentity, input.eligibilityAssessment.proposalIdentity)) throw new Error("Decision must bind the exact proposal identity and revision used by every assessment.");
  if (!sameIdentity(input.evidencePackageIdentity, input.evidenceAuthorityAssessment.evidencePackageIdentity)) throw new Error("Decision must bind the exact Evidence package identity and revision used by assessment.");
  if (input.eligibilityAssessment.policyId !== input.policy.policyId || input.eligibilityAssessment.policyVersion !== input.policy.policyVersion) throw new Error("Decision policy must match the exact eligibility policy identity and version.");
  if (input.eligibilityAssessment.eligibleForAdmissionDecision !== (input.eligibilityAssessment.state === "eligible" || input.eligibilityAssessment.state === "eligible_with_constraints")) throw new Error("Eligibility assessment contains an inconsistent decision-eligibility state.");

  const accepted = acceptedOutcomes.includes(input.outcome);
  if (accepted && !input.eligibilityAssessment.eligibleForAdmissionDecision) throw new Error(`Eligibility state ${input.eligibilityAssessment.state} cannot produce an accepted decision.`);
  if (input.outcome === "accepted_authoritative") {
    if (input.evidenceAuthorityAssessment.verificationCeilings.some((item) => item.proposedExceedsCeiling)) throw new Error("Authoritative acceptance cannot exceed an assessed verification ceiling.");
    if (input.evidenceAuthorityAssessment.authorityAssessments.some((item) => item.state !== "qualified")) throw new Error("Authoritative acceptance requires every assessed authority to remain qualified.");
  }
  const operation = input.identityLineageConflictAssessment.lineage.operation;
  if (operationByProposal[input.proposal.proposalKind] !== operation) throw new Error("Assessed publication operation does not match the exact authorised proposal kind.");
  if (input.outcome === "accepted_lifecycle_change" && !lifecycleOperations.includes(operation)) throw new Error(`Lifecycle acceptance is incompatible with operation ${operation}.`);
  if (input.outcome !== "accepted_lifecycle_change" && accepted && lifecycleOperations.includes(operation)) throw new Error(`Operation ${operation} requires an accepted lifecycle-change decision.`);
  validateAuthorityScope(input.decisionAuthorityScope, input.decisionAuthority, input.outcome, operation, input.policy);

  validateDate(input.decisionDate);
  if (!Number.isFinite(Date.parse(input.decidedAt))) throw new Error("Decision timestamp must be valid and supplied explicitly.");
  if (input.decidedAt.slice(0, 10) !== input.decisionDate) throw new Error("Decision date must match the supplied decision timestamp date.");
  requireNonBlank(input.rationale, "Decision rationale");
  requireNonBlank(input.contractVersion, "Decision contract version");
  const acceptedFindingIds = requireUnique(input.acceptedFindingIds, "Accepted finding identity");
  const rejectedFindingIds = requireUnique(input.rejectedFindingIds, "Rejected finding identity");
  requireUnique([...acceptedFindingIds, ...rejectedFindingIds], "Decision finding identity");
  const availableFindingIds = new Set(input.evidenceAuthorityAssessment.findings.map((item) => item.findingId));
  for (const id of [...acceptedFindingIds, ...rejectedFindingIds]) if (!availableFindingIds.has(id)) throw new Error(`Decision references unknown finding ${id}.`);
  const constraintFindingIds = input.eligibilityAssessment.publicationConstraints.flatMap((item) => item.sourceFindingIds);
  for (const id of constraintFindingIds) if (!acceptedFindingIds.includes(id) && !rejectedFindingIds.includes(id)) throw new Error(`Decision must preserve eligibility constraint finding ${id}.`);

  const unresolvedConditions = requireUnique([...input.unresolvedConditions, ...input.eligibilityAssessment.unresolvedConditions.map((item) => item.message)], "Decision unresolved condition");
  if (input.decisionIdentity.revision === "1" && input.supersededDecisionIdentity !== null) throw new Error("Initial decision revision cannot supersede an earlier decision.");
  if (input.decisionIdentity.revision !== "1" && input.supersededDecisionIdentity === null) throw new Error("Corrected decision revision must supersede an earlier decision.");
  if (input.supersededDecisionIdentity) {
    validateIdentity(input.supersededDecisionIdentity, "Superseded decision");
    if (input.supersededDecisionIdentity.id === input.decisionIdentity.id && input.supersededDecisionIdentity.revision === input.decisionIdentity.revision) throw new Error("Decision cannot supersede itself.");
  }

  const decisionBase = {
    decisionIdentity: input.decisionIdentity,
    proposalIdentity: input.proposalIdentity,
    proposedRevisionBinding,
    assessmentIdentity: input.eligibilityAssessment.assessmentIdentity,
    decisionAuthority: input.decisionAuthority,
    decidedAt: input.decidedAt,
    rationale: input.rationale,
    acceptedFindingIds,
    rejectedFindingIds,
    unresolvedConditions,
    contractVersion: input.contractVersion,
    supersededDecisionId: input.supersededDecisionIdentity?.id ?? null,
    lifecycle: { status: "decided", version: input.decisionIdentity.revision, ...(input.supersededDecisionIdentity ? { supersedesIds: [input.supersededDecisionIdentity.id] } : {}) },
  } as const;
  let decision: CalibrationKnowledgeAdmissionDecision;
  if (input.outcome === "accepted_provisional" || input.outcome === "accepted_authoritative" || input.outcome === "accepted_lifecycle_change") {
    if (input.publicationInstructionId === null) throw new Error("Accepted decision requires a publication instruction reference.");
    decision = defineCalibrationKnowledgeAdmissionDecision({ ...decisionBase, outcome: input.outcome, publicationInstructionId: input.publicationInstructionId });
  } else {
    if (input.publicationInstructionId !== null) throw new Error("Non-accepted decision cannot reference a publication instruction.");
    decision = defineCalibrationKnowledgeAdmissionDecision({ ...decisionBase, outcome: input.outcome, publicationInstructionId: null });
  }

  return deepCloneFreeze({
    decision,
    proposalIdentity: input.proposalIdentity,
    proposedRevisionBinding,
    evidencePackageIdentity: input.evidencePackageIdentity,
    evidenceAuthorityAssessmentIdentity: input.evidenceAuthorityAssessment.assessmentIdentity,
    identityLineageConflictAssessmentIdentity: input.identityLineageConflictAssessment.assessmentIdentity,
    eligibilityAssessmentIdentity: input.eligibilityAssessment.assessmentIdentity,
    policyId: input.policy.policyId,
    policyVersion: input.policy.policyVersion,
    decisionAuthorityScope: input.decisionAuthorityScope,
    decisionDate: input.decisionDate,
    publicationOperation: operation,
    preservedEligibilityState: input.eligibilityAssessment.state,
    preservedPublicationConstraints: input.eligibilityAssessment.publicationConstraints,
    preservedOutstandingEngineeringObligations: input.eligibilityAssessment.outstandingEngineeringObligations,
    supersededDecisionIdentity: input.supersededDecisionIdentity,
  });
}

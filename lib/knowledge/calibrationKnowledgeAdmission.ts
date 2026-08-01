import {
  defineCalibrationKnowledgeObject,
  type CalibrationKnowledgeObject,
  type GovernedVocabularyReference,
  type KnowledgeAuthorityReference,
  type KnowledgeEvidenceReference,
  type KnowledgeProvenanceReference,
  type KnowledgeVerificationStatus,
} from "./calibrationKnowledge.ts";
import type { KnowledgeConfidenceState } from "./stockVariants.ts";

export type AdmissionStableIdentity = Readonly<{
  id: string;
  revision: string;
  contentDigest: string;
}>;

export type AdmissionProposalKind =
  | "register_new"
  | "enrich_existing"
  | "correct_existing"
  | "refine_applicability"
  | "add_evidence"
  | "record_dispute"
  | "resolve_conflict"
  | "supersede"
  | "deprecate"
  | "reject"
  | "restore";

export type AdmissionFindingSeverity = "information" | "warning" | "error" | "critical";
export type AdmissionFindingCategory =
  | "structural"
  | "identity"
  | "evidence"
  | "provenance"
  | "authority"
  | "qualification"
  | "applicability"
  | "vocabulary"
  | "conflict"
  | "lifecycle"
  | "version"
  | "publication"
  | "policy";

export type AdmissionDecisionOutcome =
  | "invalid"
  | "requires_evidence"
  | "requires_authority"
  | "identity_unresolved"
  | "conflict"
  | "deferred"
  | "rejected"
  | "accepted_provisional"
  | "accepted_authoritative"
  | "accepted_lifecycle_change"
  | "superseded_proposal";

export type PublicationOperation =
  | "register"
  | "enrich"
  | "correct"
  | "refine_applicability"
  | "add_evidence"
  | "record_dispute"
  | "resolve_conflict"
  | "supersede"
  | "deprecate"
  | "reject"
  | "restore";

export type PublicationReceiptOutcome = "published" | "publication_blocked";
export type AdmissionIdentityRelationship =
  | "new_identity"
  | "existing_identity"
  | "new_source_representation"
  | "new_knowledge_version"
  | "materially_distinct"
  | "unresolved"
  | "conflict";
export type AdmissionAssertionStatus =
  | "eligible"
  | "ineligible"
  | "requires_evidence"
  | "requires_authority"
  | "unresolved"
  | "conflict";
export type AdmissionConflictStatus = "none" | "unresolved" | "resolved";
export type AdmissionLifecycleStatus =
  | "draft"
  | "submitted"
  | "snapshotted"
  | "assessed"
  | "decision_ready"
  | "decided"
  | "publication_ready"
  | "published"
  | "blocked"
  | "superseded";

export type AdmissionPolicyReference = Readonly<{
  policyId: string;
  policyVersion: string;
  effectiveDate: string;
  applicableProposalKinds: readonly AdmissionProposalKind[];
  validationRuleVersions: readonly string[];
  authorityRuleVersion: string;
  publicationRuleVersion: string;
}>;

export type AdmissionLifecycle = Readonly<{
  status: AdmissionLifecycleStatus;
  version: string;
  effectiveAt?: string;
  supersedesIds?: readonly string[];
}>;

export type AdmissionAssertionChangeManifest = Readonly<{
  addedAssertionIds: readonly string[];
  amendedAssertionIds: readonly string[];
  retainedAssertionIds: readonly string[];
  supersededAssertionIds: readonly string[];
  removedFromCurrentAssertionIds: readonly string[];
}>;

export type ProposedCalibrationKnowledgeRevision = Readonly<{
  revisionIdentity: AdmissionStableIdentity;
  knowledge: CalibrationKnowledgeObject;
  proposedStableKnowledgeId: string;
  proposedKnowledgeVersion: string;
  expectedPredecessorKnowledgeVersion: string | null;
  changeManifest: AdmissionAssertionChangeManifest;
  publicationRationale: string;
}>;

export type AdmissionEvidenceMapping = Readonly<{
  assertionId: string;
  supportingEvidenceIds: readonly string[];
  contradictoryEvidenceIds: readonly string[];
}>;

export type AdmissionEvidencePackage = Readonly<{
  packageIdentity: AdmissionStableIdentity;
  evidence: readonly KnowledgeEvidenceReference[];
  provenance: readonly KnowledgeProvenanceReference[];
  sourceRevisionDigests: readonly AdmissionStableIdentity[];
  assertionMappings: readonly AdmissionEvidenceMapping[];
  collectionMethod: string;
  transformationHistory: readonly string[];
  chainOfCustody: readonly string[];
  knownLimitations: readonly string[];
  createdDate: string;
  supersededPackageRevision: string | null;
}>;

export type AdmissionAuthorityClaim = Readonly<{
  claimIdentity: AdmissionStableIdentity;
  authority: KnowledgeAuthorityReference;
  assertionCategories: readonly GovernedVocabularyReference[];
  applicability: readonly GovernedVocabularyReference[];
  permittedVerificationCeiling: KnowledgeVerificationStatus;
  effectiveFrom: string;
  effectiveUntil: string | null;
  supportingAuthorityEvidenceIds: readonly string[];
  limitations: readonly string[];
  lifecycle: AdmissionLifecycle;
}>;

export type CalibrationKnowledgeAdmissionProposal = Readonly<{
  proposalIdentity: AdmissionStableIdentity;
  proposalKind: AdmissionProposalKind;
  proposedRevision: ProposedCalibrationKnowledgeRevision;
  evidencePackageIdentity: AdmissionStableIdentity;
  authorityClaimIds: readonly string[];
  proposer: KnowledgeAuthorityReference;
  proposerSourceRole: GovernedVocabularyReference;
  intendedPublicationClass: GovernedVocabularyReference;
  submittedAt: string;
  contractVersion: string;
  previousProposalRevision: string | null;
  rationale: string;
  unresolvedQuestions: readonly string[];
  lifecycle: AdmissionLifecycle;
}>;

export type AdmissionValidationFinding = Readonly<{
  findingId: string;
  findingCode: string;
  severity: AdmissionFindingSeverity;
  category: AdmissionFindingCategory;
  affectedProposalPaths: readonly string[];
  affectedAssertionIds: readonly string[];
  affectedEvidenceIds: readonly string[];
  affectedAuthorityClaimIds: readonly string[];
  message: string;
  blocking: boolean;
  resolutionRequirement: string | null;
  lifecycle: AdmissionLifecycle;
}>;

export type AdmissionAssertionAssessment = Readonly<{
  assertionId: string;
  assertionCategory: GovernedVocabularyReference;
  status: AdmissionAssertionStatus;
  evidenceCoverage: GovernedVocabularyReference;
  supportingEvidenceIds: readonly string[];
  contradictoryEvidenceIds: readonly string[];
  provenanceComplete: boolean;
  authorityClaimIds: readonly string[];
  verificationCeiling: KnowledgeVerificationStatus;
  preservedConfidence: KnowledgeConfidenceState;
  applicabilityStatus: GovernedVocabularyReference;
  vocabularyStatus: GovernedVocabularyReference;
  conflictStatus: AdmissionConflictStatus;
  lifecycleStatus: GovernedVocabularyReference;
  publicationEligible: boolean;
  unresolvedReasons: readonly string[];
}>;

export type AdmissionIdentityAssessment = Readonly<{
  assessmentId: string;
  relationship: AdmissionIdentityRelationship;
  proposedStableKnowledgeId: string;
  existingKnowledgeIds: readonly string[];
  candidateKnowledgeIds: readonly string[];
  supportingEvidenceIds: readonly string[];
  contradictoryEvidenceIds: readonly string[];
  proposedLineageOperation: PublicationOperation | null;
  unresolvedReason: string | null;
}>;

export type AdmissionConflict = Readonly<{
  conflictId: string;
  category: AdmissionFindingCategory;
  summary: string;
  assertionIds: readonly string[];
  evidenceIds: readonly string[];
  authorityClaimIds: readonly string[];
  canonicalKnowledgeIds: readonly string[];
  unresolvedReason: string | null;
}>;

export type AdmissionConflictAssessment = Readonly<{
  assessmentId: string;
  status: AdmissionConflictStatus;
  conflicts: readonly AdmissionConflict[];
  unresolvedReason: string | null;
}>;

export type AdmissionPublicationEligibility = Readonly<{
  eligibleOutcomes: readonly AdmissionDecisionOutcome[];
  blockingFindingIds: readonly string[];
  unresolvedConditions: readonly string[];
  publicationEligible: boolean;
}>;

export type CalibrationKnowledgeAdmissionAssessment = Readonly<{
  assessmentIdentity: AdmissionStableIdentity;
  proposalIdentity: AdmissionStableIdentity;
  evidencePackageIdentity: AdmissionStableIdentity;
  canonicalBaselineIdentity: AdmissionStableIdentity;
  policy: AdmissionPolicyReference;
  evaluatedKnowledgeDigest: string;
  findings: readonly AdmissionValidationFinding[];
  assertionAssessments: readonly AdmissionAssertionAssessment[];
  identityAssessment: AdmissionIdentityAssessment;
  conflictAssessment: AdmissionConflictAssessment;
  publicationEligibility: AdmissionPublicationEligibility;
  unresolvedConditions: readonly string[];
  assessedAt: string;
  lifecycle: AdmissionLifecycle;
}>;

type AdmissionDecisionBase = Readonly<{
  decisionIdentity: AdmissionStableIdentity;
  proposalIdentity: AdmissionStableIdentity;
  assessmentIdentity: AdmissionStableIdentity;
  decisionAuthority: KnowledgeAuthorityReference;
  decidedAt: string;
  rationale: string;
  acceptedFindingIds: readonly string[];
  rejectedFindingIds: readonly string[];
  unresolvedConditions: readonly string[];
  contractVersion: string;
  supersededDecisionId: string | null;
  lifecycle: AdmissionLifecycle;
}>;

export type CalibrationKnowledgeAdmissionDecision =
  | (AdmissionDecisionBase & Readonly<{
      outcome: "accepted_provisional" | "accepted_authoritative" | "accepted_lifecycle_change";
      publicationInstructionId: string;
    }>)
  | (AdmissionDecisionBase & Readonly<{
      outcome: Exclude<AdmissionDecisionOutcome, "accepted_provisional" | "accepted_authoritative" | "accepted_lifecycle_change">;
      publicationInstructionId: null;
    }>);

export type CalibrationKnowledgePublicationInstruction = Readonly<{
  instructionIdentity: AdmissionStableIdentity;
  acceptedDecisionIdentity: AdmissionStableIdentity;
  operation: PublicationOperation;
  targetStableKnowledgeId: string;
  expectedPredecessorKnowledgeVersion: string | null;
  acceptedKnowledgeDigest: string;
  resultingKnowledgeVersion: string;
  changeManifest: AdmissionAssertionChangeManifest;
  policy: AdmissionPolicyReference;
  expectedResultingCanonicalDigest: string;
  lifecycle: AdmissionLifecycle;
}>;

export type CalibrationKnowledgePublicationReceipt =
  | Readonly<{
      receiptIdentity: AdmissionStableIdentity;
      instructionIdentity: AdmissionStableIdentity;
      outcome: "published";
      resultingStableKnowledgeId: string;
      resultingKnowledgeVersion: string;
      resultingContentDigest: string;
      predecessorKnowledgeVersion: string | null;
      publishedAt: string;
      publicationSourceRevision: string;
      registrySnapshotReference: string;
      failureReason: null;
      lifecycle: AdmissionLifecycle;
    }>
  | Readonly<{
      receiptIdentity: AdmissionStableIdentity;
      instructionIdentity: AdmissionStableIdentity;
      outcome: "publication_blocked";
      resultingStableKnowledgeId: null;
      resultingKnowledgeVersion: null;
      resultingContentDigest: null;
      predecessorKnowledgeVersion: string | null;
      publishedAt: null;
      publicationSourceRevision: string;
      registrySnapshotReference: null;
      failureReason: string;
      lifecycle: AdmissionLifecycle;
    }>;

const proposalKinds = new Set<AdmissionProposalKind>(["register_new", "enrich_existing", "correct_existing", "refine_applicability", "add_evidence", "record_dispute", "resolve_conflict", "supersede", "deprecate", "reject", "restore"]);
const findingSeverities = new Set<AdmissionFindingSeverity>(["information", "warning", "error", "critical"]);
const findingCategories = new Set<AdmissionFindingCategory>(["structural", "identity", "evidence", "provenance", "authority", "qualification", "applicability", "vocabulary", "conflict", "lifecycle", "version", "publication", "policy"]);
const decisionOutcomes = new Set<AdmissionDecisionOutcome>(["invalid", "requires_evidence", "requires_authority", "identity_unresolved", "conflict", "deferred", "rejected", "accepted_provisional", "accepted_authoritative", "accepted_lifecycle_change", "superseded_proposal"]);
const publicationOperations = new Set<PublicationOperation>(["register", "enrich", "correct", "refine_applicability", "add_evidence", "record_dispute", "resolve_conflict", "supersede", "deprecate", "reject", "restore"]);
const admissionLifecycleStatuses = new Set<AdmissionLifecycleStatus>(["draft", "submitted", "snapshotted", "assessed", "decision_ready", "decided", "publication_ready", "published", "blocked", "superseded"]);
const identityRelationships = new Set<AdmissionIdentityRelationship>(["new_identity", "existing_identity", "new_source_representation", "new_knowledge_version", "materially_distinct", "unresolved", "conflict"]);
const assertionStatuses = new Set<AdmissionAssertionStatus>(["eligible", "ineligible", "requires_evidence", "requires_authority", "unresolved", "conflict"]);
const conflictStatuses = new Set<AdmissionConflictStatus>(["none", "unresolved", "resolved"]);
const verificationStatuses = new Set<KnowledgeVerificationStatus>(["unknown", "observed", "candidate", "provisional", "verified", "founder_verified", "authoritatively_verified", "disputed", "rejected", "superseded", "deprecated"]);
const confidenceStates = new Set<KnowledgeConfidenceState>(["unknown", "low", "medium", "high"]);
const publicationReceiptOutcomes = new Set<PublicationReceiptOutcome>(["published", "publication_blocked"]);

function requireNonBlank(value: string, field: string): void { if (!value.trim()) throw new Error(`${field} is required.`); }
function requireUnique(values: readonly string[], field: string): void { const seen = new Set<string>(); for (const value of values) { requireNonBlank(value, field); if (seen.has(value)) throw new Error(`${field} contains duplicate identity ${value}.`); seen.add(value); } }
function requireKnown<T extends string>(value: string, values: ReadonlySet<T>, field: string): asserts value is T { if (!values.has(value as T)) throw new Error(`${field} is invalid.`); }
function requireIsoDate(value: string, field: string): void { const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value); if (!match) throw new Error(`${field} must be YYYY-MM-DD.`); const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))); if (date.toISOString().slice(0, 10) !== value) throw new Error(`${field} is not a valid calendar date.`); }
function requireTimestamp(value: string, field: string): void { requireNonBlank(value, field); if (!Number.isFinite(Date.parse(value))) throw new Error(`${field} must be a valid timestamp.`); }
function requireDigest(value: string, field: string): void { requireNonBlank(value, field); if (!/^[a-z0-9][a-z0-9_-]*:[a-f0-9]{32,}$/i.test(value)) throw new Error(`${field} must be an algorithm-qualified digest.`); }
function validateIdentity(value: AdmissionStableIdentity, field: string): void { requireNonBlank(value.id, `${field} identity`); requireNonBlank(value.revision, `${field} revision`); requireDigest(value.contentDigest, `${field} content digest`); }
function validateAuthority(value: KnowledgeAuthorityReference, field: string): void { requireNonBlank(value.authorityType, `${field} authority type`); requireNonBlank(value.authorityIdentifier, `${field} authority identifier`); }
function validateVocabulary(value: GovernedVocabularyReference, field: string): void { requireNonBlank(value.vocabularyId, `${field} vocabulary identity`); requireNonBlank(value.vocabularyVersion, `${field} vocabulary version`); requireNonBlank(value.termId, `${field} term identity`); requireNonBlank(value.label, `${field} label`); if (value.recognition !== "known" && value.recognition !== "unknown" && value.recognition !== "unrecognized") throw new Error(`${field} recognition is invalid.`); }
function validateLifecycle(value: AdmissionLifecycle, field: string): void { requireKnown(value.status, admissionLifecycleStatuses, `${field} lifecycle status`); requireNonBlank(value.version, `${field} lifecycle version`); if (value.effectiveAt) requireTimestamp(value.effectiveAt, `${field} effective time`); requireUnique(value.supersedesIds ?? [], `${field} superseded identity`); if (value.status === "superseded" && !(value.supersedesIds?.length)) throw new Error(`${field} superseded lifecycle requires a superseded identity.`); }
function requireLifecycleStatus(value: AdmissionLifecycle, allowed: readonly AdmissionLifecycleStatus[], field: string): void { if (!allowed.includes(value.status)) throw new Error(`${field} lifecycle status ${value.status} is invalid for this contract.`); }
function validatePolicy(value: AdmissionPolicyReference): void { requireNonBlank(value.policyId, "Admission policy identity"); requireNonBlank(value.policyVersion, "Admission policy version"); requireIsoDate(value.effectiveDate, "Admission policy effective date"); if (value.applicableProposalKinds.length === 0) throw new Error("Admission policy requires applicable proposal kinds."); value.applicableProposalKinds.forEach((kind) => requireKnown(kind, proposalKinds, "Admission policy proposal kind")); requireUnique(value.applicableProposalKinds, "Admission policy proposal kind"); requireUnique(value.validationRuleVersions, "Admission validation rule version"); requireNonBlank(value.authorityRuleVersion, "Admission authority rule version"); requireNonBlank(value.publicationRuleVersion, "Admission publication rule version"); }
function validateManifest(value: AdmissionAssertionChangeManifest): void { const groups = [value.addedAssertionIds, value.amendedAssertionIds, value.retainedAssertionIds, value.supersededAssertionIds, value.removedFromCurrentAssertionIds]; groups.forEach((group) => requireUnique(group, "Assertion change identity")); const combined = groups.flat(); requireUnique(combined, "Assertion change identity across manifest"); }
function validateEvidenceReference(value: KnowledgeEvidenceReference): void { requireNonBlank(value.evidenceId, "Evidence identity"); requireNonBlank(value.sourceType, "Evidence source type"); requireNonBlank(value.sourceIdentifier, "Evidence source identity"); }
function validateProvenance(value: KnowledgeProvenanceReference): void { requireNonBlank(value.sourceType, "Provenance source type"); requireNonBlank(value.sourceIdentifier, "Provenance source identity"); }
function deepCloneFreeze<T>(value: T): T { if (Array.isArray(value)) return Object.freeze(value.map(deepCloneFreeze)) as T; if (value !== null && typeof value === "object") { const clone: Record<PropertyKey, unknown> = {}; for (const key of Reflect.ownKeys(value)) clone[key] = deepCloneFreeze((value as Record<PropertyKey, unknown>)[key]); return Object.freeze(clone) as T; } return value; }
function construct<T>(input: T, validate: (value: T) => void): T { validate(input); return deepCloneFreeze(input); }

export function defineProposedCalibrationKnowledgeRevision(input: ProposedCalibrationKnowledgeRevision): ProposedCalibrationKnowledgeRevision { return construct(input, (value) => { validateIdentity(value.revisionIdentity, "Proposed Knowledge revision"); defineCalibrationKnowledgeObject(value.knowledge); requireNonBlank(value.proposedStableKnowledgeId, "Proposed stable Knowledge identity"); requireNonBlank(value.proposedKnowledgeVersion, "Proposed Knowledge version"); if (value.knowledge.identity.value?.stableId !== value.proposedStableKnowledgeId) throw new Error("Proposed stable Knowledge identity must match the canonical object identity."); if (value.knowledge.version !== value.proposedKnowledgeVersion) throw new Error("Proposed Knowledge version must match the canonical object version."); validateManifest(value.changeManifest); requireNonBlank(value.publicationRationale, "Publication rationale"); }); }

export function defineAdmissionEvidencePackage(input: AdmissionEvidencePackage): AdmissionEvidencePackage { return construct(input, (value) => { validateIdentity(value.packageIdentity, "Evidence package"); value.evidence.forEach(validateEvidenceReference); requireUnique(value.evidence.map((item) => item.evidenceId), "Evidence identity"); value.provenance.forEach(validateProvenance); value.sourceRevisionDigests.forEach((item) => validateIdentity(item, "Evidence source revision")); requireUnique(value.sourceRevisionDigests.map((item) => item.id), "Evidence source revision identity"); requireNonBlank(value.collectionMethod, "Evidence collection method"); [value.transformationHistory, value.chainOfCustody, value.knownLimitations].forEach((items) => items.forEach((item) => requireNonBlank(item, "Evidence package statement"))); requireIsoDate(value.createdDate, "Evidence package creation date"); const evidenceIds = new Set(value.evidence.map((item) => item.evidenceId)); requireUnique(value.assertionMappings.map((item) => item.assertionId), "Evidence mapping assertion identity"); value.assertionMappings.forEach((mapping) => { requireUnique(mapping.supportingEvidenceIds, "Supporting Evidence identity"); requireUnique(mapping.contradictoryEvidenceIds, "Contradictory Evidence identity"); for (const id of [...mapping.supportingEvidenceIds, ...mapping.contradictoryEvidenceIds]) if (!evidenceIds.has(id)) throw new Error(`Evidence mapping references unknown Evidence ${id}.`); }); }); }

export function defineAdmissionAuthorityClaim(input: AdmissionAuthorityClaim): AdmissionAuthorityClaim { return construct(input, (value) => { validateIdentity(value.claimIdentity, "Authority claim"); validateAuthority(value.authority, "Admission"); if (value.assertionCategories.length === 0) throw new Error("Authority claim requires an assertion category."); value.assertionCategories.forEach((item) => validateVocabulary(item, "Authority assertion category")); value.applicability.forEach((item) => validateVocabulary(item, "Authority applicability")); requireKnown(value.permittedVerificationCeiling, verificationStatuses, "Authority verification ceiling"); requireIsoDate(value.effectiveFrom, "Authority effective date"); if (value.effectiveUntil) { requireIsoDate(value.effectiveUntil, "Authority expiry date"); if (value.effectiveUntil < value.effectiveFrom) throw new Error("Authority expiry date cannot precede its effective date."); } requireUnique(value.supportingAuthorityEvidenceIds, "Authority supporting Evidence identity"); value.limitations.forEach((item) => requireNonBlank(item, "Authority limitation")); validateLifecycle(value.lifecycle, "Authority claim"); requireLifecycleStatus(value.lifecycle, ["submitted", "superseded"], "Authority claim"); }); }

export function defineCalibrationKnowledgeAdmissionProposal(input: CalibrationKnowledgeAdmissionProposal): CalibrationKnowledgeAdmissionProposal { return construct(input, (value) => { validateIdentity(value.proposalIdentity, "Admission proposal"); requireKnown(value.proposalKind, proposalKinds, "Admission proposal kind"); defineProposedCalibrationKnowledgeRevision(value.proposedRevision); validateIdentity(value.evidencePackageIdentity, "Admission evidence package reference"); requireUnique(value.authorityClaimIds, "Admission authority claim identity"); validateAuthority(value.proposer, "Proposal"); validateVocabulary(value.proposerSourceRole, "Proposer source role"); validateVocabulary(value.intendedPublicationClass, "Intended publication class"); requireTimestamp(value.submittedAt, "Proposal submission time"); requireNonBlank(value.contractVersion, "Admission proposal contract version"); requireNonBlank(value.rationale, "Admission proposal rationale"); value.unresolvedQuestions.forEach((item) => requireNonBlank(item, "Admission unresolved question")); validateLifecycle(value.lifecycle, "Admission proposal"); if (value.lifecycle.status === "draft") throw new Error("Submitted Admission Proposal cannot retain draft lifecycle."); requireLifecycleStatus(value.lifecycle, ["submitted", "superseded"], "Admission proposal"); if (value.proposalKind === "register_new" && value.proposedRevision.expectedPredecessorKnowledgeVersion !== null) throw new Error("New registration cannot declare a predecessor Knowledge version."); if (value.proposalKind !== "register_new" && value.proposedRevision.expectedPredecessorKnowledgeVersion === null) throw new Error("Amendment proposal requires a predecessor Knowledge version."); }); }

export function defineAdmissionValidationFinding(input: AdmissionValidationFinding): AdmissionValidationFinding { return construct(input, (value) => { requireNonBlank(value.findingId, "Finding identity"); requireNonBlank(value.findingCode, "Finding code"); requireKnown(value.severity, findingSeverities, "Finding severity"); requireKnown(value.category, findingCategories, "Finding category"); [value.affectedProposalPaths, value.affectedAssertionIds, value.affectedEvidenceIds, value.affectedAuthorityClaimIds].forEach((items) => requireUnique(items, "Finding reference")); requireNonBlank(value.message, "Finding message"); if (value.blocking && !value.resolutionRequirement?.trim()) throw new Error("Blocking finding requires a resolution requirement."); validateLifecycle(value.lifecycle, "Finding"); requireLifecycleStatus(value.lifecycle, ["assessed", "superseded"], "Finding"); }); }

export function defineAdmissionAssertionAssessment(input: AdmissionAssertionAssessment): AdmissionAssertionAssessment { return construct(input, (value) => { requireNonBlank(value.assertionId, "Assessed assertion identity"); requireKnown(value.status, assertionStatuses, "Assertion assessment status"); requireKnown(value.verificationCeiling, verificationStatuses, "Assertion verification ceiling"); requireKnown(value.preservedConfidence, confidenceStates, "Assertion preserved confidence"); requireKnown(value.conflictStatus, conflictStatuses, "Assertion conflict status"); [value.assertionCategory, value.evidenceCoverage, value.applicabilityStatus, value.vocabularyStatus, value.lifecycleStatus].forEach((item) => validateVocabulary(item, "Assertion assessment vocabulary")); requireUnique(value.supportingEvidenceIds, "Assertion supporting Evidence identity"); requireUnique(value.contradictoryEvidenceIds, "Assertion contradictory Evidence identity"); requireUnique(value.authorityClaimIds, "Assertion authority claim identity"); value.unresolvedReasons.forEach((item) => requireNonBlank(item, "Assertion unresolved reason")); if ((value.status === "unresolved" || value.status === "conflict" || value.status === "requires_evidence" || value.status === "requires_authority") && value.unresolvedReasons.length === 0) throw new Error("Unresolved assertion assessment requires a reason."); if (value.publicationEligible && value.status !== "eligible") throw new Error("Only an eligible assertion assessment may be publication eligible."); }); }

export function defineAdmissionIdentityAssessment(input: AdmissionIdentityAssessment): AdmissionIdentityAssessment { return construct(input, (value) => { requireNonBlank(value.assessmentId, "Identity assessment identity"); requireKnown(value.relationship, identityRelationships, "Identity assessment relationship"); requireNonBlank(value.proposedStableKnowledgeId, "Identity assessment proposed Knowledge identity"); [value.existingKnowledgeIds, value.candidateKnowledgeIds, value.supportingEvidenceIds, value.contradictoryEvidenceIds].forEach((items) => requireUnique(items, "Identity assessment reference")); if (value.proposedLineageOperation) requireKnown(value.proposedLineageOperation, publicationOperations, "Identity assessment lineage operation"); if ((value.relationship === "unresolved" || value.relationship === "conflict") && !value.unresolvedReason?.trim()) throw new Error("Unresolved identity assessment requires a reason."); if (value.relationship === "new_identity" && value.existingKnowledgeIds.length > 0) throw new Error("New identity assessment cannot reference existing Knowledge."); }); }

export function defineAdmissionConflictAssessment(input: AdmissionConflictAssessment): AdmissionConflictAssessment { return construct(input, (value) => { requireNonBlank(value.assessmentId, "Conflict assessment identity"); requireKnown(value.status, conflictStatuses, "Conflict assessment status"); requireUnique(value.conflicts.map((item) => item.conflictId), "Conflict identity"); value.conflicts.forEach((item) => { requireNonBlank(item.summary, "Conflict summary"); requireKnown(item.category, findingCategories, "Conflict category"); [item.assertionIds, item.evidenceIds, item.authorityClaimIds, item.canonicalKnowledgeIds].forEach((items) => requireUnique(items, "Conflict reference")); if (!item.unresolvedReason?.trim() && value.status === "unresolved") throw new Error("Unresolved conflict requires a reason."); }); if (value.status === "none" && value.conflicts.length > 0) throw new Error("Conflict-free assessment cannot contain conflicts."); if (value.status !== "none" && value.conflicts.length === 0) throw new Error("Conflict assessment requires conflict details."); if (value.status === "unresolved" && !value.unresolvedReason?.trim()) throw new Error("Unresolved conflict assessment requires a reason."); }); }

export function defineCalibrationKnowledgeAdmissionAssessment(input: CalibrationKnowledgeAdmissionAssessment): CalibrationKnowledgeAdmissionAssessment { return construct(input, (value) => { [value.assessmentIdentity, value.proposalIdentity, value.evidencePackageIdentity, value.canonicalBaselineIdentity].forEach((item) => validateIdentity(item, "Admission assessment reference")); validatePolicy(value.policy); requireDigest(value.evaluatedKnowledgeDigest, "Evaluated Knowledge digest"); requireUnique(value.findings.map((item) => item.findingId), "Assessment finding identity"); value.findings.forEach(defineAdmissionValidationFinding); requireUnique(value.assertionAssessments.map((item) => item.assertionId), "Assertion assessment identity"); value.assertionAssessments.forEach(defineAdmissionAssertionAssessment); defineAdmissionIdentityAssessment(value.identityAssessment); defineAdmissionConflictAssessment(value.conflictAssessment); value.publicationEligibility.eligibleOutcomes.forEach((item) => requireKnown(item, decisionOutcomes, "Eligible admission outcome")); requireUnique(value.publicationEligibility.eligibleOutcomes, "Eligible admission outcome"); requireUnique(value.publicationEligibility.blockingFindingIds, "Blocking finding identity"); value.publicationEligibility.unresolvedConditions.forEach((item) => requireNonBlank(item, "Publication unresolved condition")); const findingIds = new Set(value.findings.map((item) => item.findingId)); value.publicationEligibility.blockingFindingIds.forEach((id) => { if (!findingIds.has(id)) throw new Error(`Publication eligibility references unknown finding ${id}.`); }); if (value.publicationEligibility.publicationEligible && value.publicationEligibility.blockingFindingIds.length > 0) throw new Error("Publication-eligible assessment cannot retain blocking findings."); value.unresolvedConditions.forEach((item) => requireNonBlank(item, "Assessment unresolved condition")); requireTimestamp(value.assessedAt, "Assessment time"); validateLifecycle(value.lifecycle, "Admission assessment"); requireLifecycleStatus(value.lifecycle, ["assessed", "decision_ready", "superseded"], "Admission assessment"); }); }

export function defineCalibrationKnowledgeAdmissionDecision(input: CalibrationKnowledgeAdmissionDecision): CalibrationKnowledgeAdmissionDecision { return construct(input, (value) => { [value.decisionIdentity, value.proposalIdentity, value.assessmentIdentity].forEach((item) => validateIdentity(item, "Admission decision reference")); requireKnown(value.outcome, decisionOutcomes, "Admission decision outcome"); validateAuthority(value.decisionAuthority, "Decision"); requireTimestamp(value.decidedAt, "Decision time"); requireNonBlank(value.rationale, "Decision rationale"); requireUnique(value.acceptedFindingIds, "Accepted finding identity"); requireUnique(value.rejectedFindingIds, "Rejected finding identity"); requireUnique([...value.acceptedFindingIds, ...value.rejectedFindingIds], "Decision finding identity"); value.unresolvedConditions.forEach((item) => requireNonBlank(item, "Decision unresolved condition")); requireNonBlank(value.contractVersion, "Decision contract version"); validateLifecycle(value.lifecycle, "Admission decision"); requireLifecycleStatus(value.lifecycle, ["decided", "superseded"], "Admission decision"); const accepted = value.outcome === "accepted_provisional" || value.outcome === "accepted_authoritative" || value.outcome === "accepted_lifecycle_change"; if (accepted !== (value.publicationInstructionId !== null)) throw new Error("Only an accepted Admission Decision may reference a publication instruction."); if (value.publicationInstructionId) requireNonBlank(value.publicationInstructionId, "Publication instruction identity"); }); }

export function defineCalibrationKnowledgePublicationInstruction(input: CalibrationKnowledgePublicationInstruction): CalibrationKnowledgePublicationInstruction { return construct(input, (value) => { validateIdentity(value.instructionIdentity, "Publication instruction"); validateIdentity(value.acceptedDecisionIdentity, "Accepted decision"); requireKnown(value.operation, publicationOperations, "Publication operation"); requireNonBlank(value.targetStableKnowledgeId, "Publication target Knowledge identity"); requireDigest(value.acceptedKnowledgeDigest, "Accepted Knowledge digest"); requireNonBlank(value.resultingKnowledgeVersion, "Resulting Knowledge version"); validateManifest(value.changeManifest); validatePolicy(value.policy); requireDigest(value.expectedResultingCanonicalDigest, "Expected canonical digest"); validateLifecycle(value.lifecycle, "Publication instruction"); if (value.operation === "register" && value.expectedPredecessorKnowledgeVersion !== null) throw new Error("Register publication cannot declare a predecessor Knowledge version."); if (value.operation !== "register" && value.expectedPredecessorKnowledgeVersion === null) throw new Error("Amending publication requires a predecessor Knowledge version."); if (value.lifecycle.status !== "publication_ready") throw new Error("Publication instruction must be publication ready."); }); }

export function defineCalibrationKnowledgePublicationReceipt(input: CalibrationKnowledgePublicationReceipt): CalibrationKnowledgePublicationReceipt { return construct(input, (value) => { validateIdentity(value.receiptIdentity, "Publication receipt"); validateIdentity(value.instructionIdentity, "Publication instruction receipt reference"); requireKnown(value.outcome, publicationReceiptOutcomes, "Publication receipt outcome"); requireNonBlank(value.publicationSourceRevision, "Publication source revision"); validateLifecycle(value.lifecycle, "Publication receipt"); if (value.outcome === "published") { requireNonBlank(value.resultingStableKnowledgeId, "Published Knowledge identity"); requireNonBlank(value.resultingKnowledgeVersion, "Published Knowledge version"); requireDigest(value.resultingContentDigest, "Published Knowledge digest"); requireTimestamp(value.publishedAt, "Publication time"); requireNonBlank(value.registrySnapshotReference, "Registry snapshot reference"); if (value.failureReason !== null) throw new Error("Published receipt cannot contain a failure reason."); if (value.lifecycle.status !== "published") throw new Error("Published receipt requires published lifecycle."); } else { if (value.resultingStableKnowledgeId !== null || value.resultingKnowledgeVersion !== null || value.resultingContentDigest !== null || value.publishedAt !== null || value.registrySnapshotReference !== null) throw new Error("Blocked receipt cannot contain published Knowledge results."); requireNonBlank(value.failureReason, "Publication failure reason"); if (value.lifecycle.status !== "blocked") throw new Error("Blocked receipt requires blocked lifecycle."); } }); }

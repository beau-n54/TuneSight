import type {
  AdmissionFindingCategory,
  AdmissionFindingSeverity,
  AdmissionStableIdentity,
  PublicationOperation,
} from "./calibrationKnowledgeAdmission.ts";
import type {
  CalibrationKnowledgeEvidenceAuthorityAssessment,
} from "./calibrationKnowledgeEvidenceAuthorityAssessment.ts";
import type {
  CalibrationIdentityAssessmentState,
  CalibrationIdentityLineageConflictAssessment,
  CalibrationLineageState,
} from "./calibrationKnowledgeIdentityLineageConflictAssessment.ts";

export type CalibrationPublicationEligibilityState =
  | "eligible"
  | "eligible_with_constraints"
  | "blocked"
  | "unresolved"
  | "invalid";

export type CalibrationPublicationEligibilityConditionKind =
  | "structural_prerequisite"
  | "evidence"
  | "authority"
  | "identity"
  | "predecessor"
  | "conflict"
  | "publication_operation"
  | "lifecycle"
  | "policy"
  | "version"
  | "publication_constraint";

export type CalibrationPublicationEligibilityCondition = Readonly<{
  conditionId: string;
  kind: CalibrationPublicationEligibilityConditionKind;
  sourceAssessmentId: string;
  sourceFindingIds: readonly string[];
  message: string;
}>;

export type CalibrationPublicationEligibilityPolicy = Readonly<{
  policyId: string;
  policyVersion: string;
  compatibleEvidenceAuthorityPolicyId: string;
  compatibleEvidenceAuthorityPolicyVersions: readonly string[];
  permittedOperations: readonly PublicationOperation[];
  eligibleIdentityStates: readonly CalibrationIdentityAssessmentState[];
  eligibleLineageStates: readonly CalibrationLineageState[];
  blockingFindingSeverities: readonly AdmissionFindingSeverity[];
  blockingFindingCategories: readonly AdmissionFindingCategory[];
  reviewFindingSeverities: readonly AdmissionFindingSeverity[];
}>;

export type CalibrationPublicationEligibilityAssessmentInput = Readonly<{
  assessmentIdentity: AdmissionStableIdentity;
  evidenceAuthorityAssessment: CalibrationKnowledgeEvidenceAuthorityAssessment;
  identityLineageConflictAssessment: CalibrationIdentityLineageConflictAssessment;
  policy: CalibrationPublicationEligibilityPolicy;
}>;

export type CalibrationPublicationEligibilityAssessment = Readonly<{
  assessmentIdentity: AdmissionStableIdentity;
  proposalIdentity: AdmissionStableIdentity;
  state: CalibrationPublicationEligibilityState;
  policyId: string;
  policyVersion: string;
  policyCompliant: boolean;
  lifecycleCompatible: boolean;
  predecessorCompatible: boolean;
  versionCompatible: boolean;
  operationPermitted: boolean;
  blockingConditions: readonly CalibrationPublicationEligibilityCondition[];
  unresolvedConditions: readonly CalibrationPublicationEligibilityCondition[];
  publicationConstraints: readonly CalibrationPublicationEligibilityCondition[];
  requiredFollowUp: readonly string[];
  outstandingEngineeringObligations: readonly string[];
  eligibleForAdmissionDecision: boolean;
}>;

const operations: readonly PublicationOperation[] = ["register", "enrich", "correct", "refine_applicability", "add_evidence", "record_dispute", "resolve_conflict", "supersede", "deprecate", "reject", "restore"];
const identityStates: readonly CalibrationIdentityAssessmentState[] = ["new_calibration", "existing_calibration", "correction", "enrichment", "applicability_refinement", "lifecycle_amendment", "supersession", "source_representation", "restoration", "unresolved", "conflict"];
const lineageStates: readonly CalibrationLineageState[] = ["new_root", "valid_successor", "enrichment", "correction", "refinement", "supersession", "restoration", "deprecation", "lifecycle_amendment", "unresolved", "conflict"];
const severities: readonly AdmissionFindingSeverity[] = ["information", "warning", "error", "critical"];
const categories: readonly AdmissionFindingCategory[] = ["structural", "identity", "evidence", "provenance", "authority", "qualification", "applicability", "vocabulary", "conflict", "lifecycle", "version", "publication", "policy"];

function requireNonBlank(value: string, field: string): void {
  if (!value.trim()) throw new Error(`${field} is required.`);
}

function requireUniqueKnown<T extends string>(values: readonly T[], governed: readonly T[], field: string, allowEmpty = false): void {
  if (!allowEmpty && values.length === 0) throw new Error(`${field} must not be empty.`);
  const seen = new Set<string>();
  for (const value of values) {
    if (!governed.includes(value)) throw new Error(`${field} contains unknown value ${value}.`);
    if (seen.has(value)) throw new Error(`${field} contains duplicate value ${value}.`);
    seen.add(value);
  }
}

function validateIdentity(value: AdmissionStableIdentity): void {
  requireNonBlank(value.id, "Eligibility assessment identity");
  requireNonBlank(value.revision, "Eligibility assessment revision");
  if (!/^[a-z0-9][a-z0-9_-]*:[a-f0-9]{32,}$/i.test(value.contentDigest)) throw new Error("Eligibility assessment content digest is invalid.");
}

function validatePolicy(policy: CalibrationPublicationEligibilityPolicy): void {
  requireNonBlank(policy.policyId, "Eligibility policy identity");
  requireNonBlank(policy.policyVersion, "Eligibility policy version");
  requireNonBlank(policy.compatibleEvidenceAuthorityPolicyId, "Compatible Evidence and Authority policy identity");
  if (policy.compatibleEvidenceAuthorityPolicyVersions.length === 0) throw new Error("Compatible Evidence and Authority policy versions must not be empty.");
  policy.compatibleEvidenceAuthorityPolicyVersions.forEach((value) => requireNonBlank(value, "Compatible Evidence and Authority policy version"));
  if (new Set(policy.compatibleEvidenceAuthorityPolicyVersions).size !== policy.compatibleEvidenceAuthorityPolicyVersions.length) throw new Error("Compatible Evidence and Authority policy versions contain duplicates.");
  requireUniqueKnown(policy.permittedOperations, operations, "Permitted publication operations");
  requireUniqueKnown(policy.eligibleIdentityStates, identityStates, "Eligible identity states");
  requireUniqueKnown(policy.eligibleLineageStates, lineageStates, "Eligible lineage states");
  requireUniqueKnown(policy.blockingFindingSeverities, severities, "Blocking finding severities", true);
  requireUniqueKnown(policy.blockingFindingCategories, categories, "Blocking finding categories", true);
  requireUniqueKnown(policy.reviewFindingSeverities, severities, "Review finding severities", true);
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

function condition(id: string, kind: CalibrationPublicationEligibilityConditionKind, assessmentId: string, message: string, findingIds: readonly string[] = []): CalibrationPublicationEligibilityCondition {
  return { conditionId: id, kind, sourceAssessmentId: assessmentId, sourceFindingIds: [...findingIds].sort(), message };
}

function uniqueSorted(values: readonly string[]): readonly string[] {
  return [...new Set(values)].sort();
}

function conditionKindForFinding(category: AdmissionFindingCategory): CalibrationPublicationEligibilityConditionKind {
  switch (category) {
    case "structural":
    case "vocabulary": return "structural_prerequisite";
    case "identity": return "identity";
    case "evidence":
    case "provenance": return "evidence";
    case "authority": return "authority";
    case "conflict": return "conflict";
    case "lifecycle": return "lifecycle";
    case "version": return "version";
    case "policy": return "policy";
    case "publication":
    case "qualification":
    case "applicability": return "publication_constraint";
  }
}

export function assessCalibrationKnowledgePublicationEligibility(input: CalibrationPublicationEligibilityAssessmentInput): CalibrationPublicationEligibilityAssessment {
  validateIdentity(input.assessmentIdentity);
  validatePolicy(input.policy);
  const snapshot = deepCloneFreeze(input);
  const evidence = snapshot.evidenceAuthorityAssessment;
  const identity = snapshot.identityLineageConflictAssessment;
  if (evidence.proposalIdentity.id !== identity.proposalIdentity.id || evidence.proposalIdentity.revision !== identity.proposalIdentity.revision || evidence.proposalIdentity.contentDigest !== identity.proposalIdentity.contentDigest) {
    throw new Error("Completed assessments must reference the same proposal identity and revision.");
  }

  const blocking: CalibrationPublicationEligibilityCondition[] = [];
  const unresolved: CalibrationPublicationEligibilityCondition[] = [];
  const constraints: CalibrationPublicationEligibilityCondition[] = [];
  const evidenceAssessmentId = evidence.assessmentIdentity.id;
  const identityAssessmentId = identity.assessmentIdentity.id;
  const policyCompliant = evidence.policyId === snapshot.policy.compatibleEvidenceAuthorityPolicyId && snapshot.policy.compatibleEvidenceAuthorityPolicyVersions.includes(evidence.policyVersion);
  const operationPermitted = snapshot.policy.permittedOperations.includes(identity.lineage.operation);
  const lifecycleCompatible = snapshot.policy.eligibleLineageStates.includes(identity.lineage.state);
  const predecessorCompatible = identity.lineage.state !== "conflict";
  const versionCompatible = identity.lineage.state !== "conflict" && (identity.lineage.state === "new_root" || identity.lineage.predecessorVersion === identity.lineage.currentCanonicalVersion);

  if (!policyCompliant) blocking.push(condition("policy:incompatible", "policy", evidenceAssessmentId, "Evidence and Authority assessment policy is not compatible with the eligibility policy."));
  if (!operationPermitted) blocking.push(condition("operation:unsupported", "publication_operation", identityAssessmentId, `Publication operation ${identity.lineage.operation} is not permitted by policy.`));
  if (!lifecycleCompatible && identity.lineage.state !== "unresolved" && identity.lineage.state !== "conflict") blocking.push(condition("lifecycle:incompatible", "lifecycle", identityAssessmentId, `Lineage state ${identity.lineage.state} is not eligible under policy.`));
  if (!predecessorCompatible) blocking.push(condition("predecessor:mismatch", "predecessor", identityAssessmentId, identity.lineage.unresolvedReason ?? "Expected predecessor is incompatible with canonical history."));
  if (!versionCompatible && identity.lineage.state !== "conflict") blocking.push(condition("version:incompatible", "version", identityAssessmentId, "Proposal and canonical predecessor versions are incompatible."));

  if (identity.identity.state === "unresolved" || identity.lineage.state === "unresolved") unresolved.push(condition("identity:unresolved", "identity", identityAssessmentId, identity.identity.unresolvedReason ?? identity.lineage.unresolvedReason ?? "Identity or lineage remains unresolved."));
  if (identity.identity.state === "conflict") blocking.push(condition("identity:conflict", "identity", identityAssessmentId, identity.identity.unresolvedReason ?? "Identity is in conflict."));
  if (identity.conflict.status === "unresolved") blocking.push(condition("conflict:blocking", "conflict", identityAssessmentId, "Material conflicts remain unresolved.", identity.conflict.conflicts.map((item) => item.conflictId)));
  if (identity.conflict.ambiguityProposalIds.length > 0) unresolved.push(condition("proposal:ambiguity", "conflict", identityAssessmentId, "Concurrent proposal ambiguity requires review."));

  for (const finding of evidence.findings) {
    const item = condition(`finding:${finding.findingId}`, conditionKindForFinding(finding.category), evidenceAssessmentId, finding.message, [finding.findingId]);
    if (finding.blocking || snapshot.policy.blockingFindingSeverities.includes(finding.severity) || snapshot.policy.blockingFindingCategories.includes(finding.category)) blocking.push(item);
    else if (finding.severity === "warning" || snapshot.policy.reviewFindingSeverities.includes(finding.severity)) constraints.push(item);
  }

  if (evidence.evidenceAssessment.state === "invalid") blocking.push(condition("evidence:invalid", "structural_prerequisite", evidenceAssessmentId, "Evidence assessment is invalid."));
  else if (["missing", "partial", "contradictory", "unresolved"].includes(evidence.evidenceAssessment.state)) unresolved.push(condition(`evidence:${evidence.evidenceAssessment.state}`, "evidence", evidenceAssessmentId, `Evidence remains ${evidence.evidenceAssessment.state}.`));
  for (const authority of evidence.authorityAssessments) {
    if (authority.state === "invalid") blocking.push(condition(`authority:${authority.assertionId}:invalid`, "authority", evidenceAssessmentId, `Authority assessment for ${authority.assertionId} is invalid.`));
    else if (authority.state !== "qualified") unresolved.push(condition(`authority:${authority.assertionId}:${authority.state}`, "authority", evidenceAssessmentId, `Authority for ${authority.assertionId} remains ${authority.state}.`));
  }
  for (const ceiling of evidence.verificationCeilings) if (ceiling.proposedExceedsCeiling) blocking.push(condition(`verification:${ceiling.assertionId}:ceiling`, "publication_constraint", evidenceAssessmentId, `Verification for ${ceiling.assertionId} exceeds its assessed ceiling.`));

  const orderedBlocking = blocking.sort((left, right) => left.conditionId.localeCompare(right.conditionId));
  const orderedUnresolved = unresolved.sort((left, right) => left.conditionId.localeCompare(right.conditionId));
  const orderedConstraints = constraints.sort((left, right) => left.conditionId.localeCompare(right.conditionId));
  const invalid = orderedBlocking.some((item) => item.conditionId === "evidence:invalid") || evidence.findings.some((item) => item.blocking && (item.category === "structural" || item.category === "vocabulary"));
  const state: CalibrationPublicationEligibilityState = invalid ? "invalid" : orderedBlocking.length ? "blocked" : orderedUnresolved.length ? "unresolved" : orderedConstraints.length ? "eligible_with_constraints" : "eligible";
  const requiredFollowUp = uniqueSorted([...orderedUnresolved.map((item) => item.message), ...orderedConstraints.map((item) => item.message)]);
  const obligations = uniqueSorted([...orderedBlocking, ...orderedUnresolved, ...orderedConstraints].map((item) => item.message));
  return deepCloneFreeze({ assessmentIdentity: snapshot.assessmentIdentity, proposalIdentity: evidence.proposalIdentity, state, policyId: snapshot.policy.policyId, policyVersion: snapshot.policy.policyVersion, policyCompliant, lifecycleCompatible, predecessorCompatible, versionCompatible, operationPermitted, blockingConditions: orderedBlocking, unresolvedConditions: orderedUnresolved, publicationConstraints: orderedConstraints, requiredFollowUp, outstandingEngineeringObligations: obligations, eligibleForAdmissionDecision: state === "eligible" || state === "eligible_with_constraints" });
}

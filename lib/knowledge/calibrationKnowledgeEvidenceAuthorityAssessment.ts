import type {
  CalibrationKnowledgeObject,
  GovernedVocabularyReference,
  KnowledgeVerificationStatus,
  QualifiedAssertion,
} from "./calibrationKnowledge.ts";
import {
  defineAdmissionValidationFinding,
  defineCalibrationKnowledgeAdmissionProposal,
  type AdmissionAuthorityClaim,
  type AdmissionEvidencePackage,
  type AdmissionStableIdentity,
  type AdmissionValidationFinding,
  type CalibrationKnowledgeAdmissionProposal,
} from "./calibrationKnowledgeAdmission.ts";
import type { KnowledgeConfidenceState } from "./stockVariants.ts";

export type AdmissionEvidenceAssessmentState =
  | "complete"
  | "partial"
  | "missing"
  | "contradictory"
  | "unresolved"
  | "invalid"
  | "not_required";

export type AdmissionAuthorityAssessmentState =
  | "qualified"
  | "partially_qualified"
  | "outside_scope"
  | "expired"
  | "inactive"
  | "unsupported"
  | "unresolved"
  | "invalid";

export type AdmissionEvidenceClassification =
  | "authoritative_documentation"
  | "controlled_founder_evidence"
  | "verified_source_description"
  | "validated_engineering_specification"
  | "governed_engineering_discovery"
  | "xdf_label"
  | "table_address"
  | "filename"
  | "folder"
  | "community_convention"
  | "other";

export type AdmissionEvidenceRequirement = "required" | "not_required";

export type AdmissionEvidenceClassificationReference = Readonly<{
  evidenceId: string;
  classification: AdmissionEvidenceClassification;
}>;

export type AdmissionPropositionCoverage = Readonly<{
  propositionId: string;
  supportingEvidenceIds: readonly string[];
}>;

export type AdmissionAssertionAssessmentRequirement = Readonly<{
  assertionId: string;
  assertionCategory: GovernedVocabularyReference;
  evidenceRequirement: AdmissionEvidenceRequirement;
  propositionIds: readonly string[];
  propositionCoverage: readonly AdmissionPropositionCoverage[];
  applicabilityEvidenceIds: readonly string[];
  provenanceRequired: boolean;
  requestedVerificationStatus: KnowledgeVerificationStatus;
  authorityClaimIds: readonly string[];
  unresolvedAuthorityClaimIds: readonly string[];
  conflictingAuthorityClaimIds: readonly string[];
  requiredAuthorityScopes: readonly GovernedVocabularyReference[];
  requiredSourceScopes: readonly GovernedVocabularyReference[];
  applicableAuthorityLimitationIndexes: Readonly<Record<string, readonly number[]>>;
}>;

export type AdmissionEvidenceAuthorityAssessmentPolicy = Readonly<{
  policyId: string;
  policyVersion: string;
  requireSourceRevision: boolean;
  requireTransformationHistory: boolean;
  requireChainOfCustody: boolean;
  founderAuthorityTypes: readonly string[];
  founderPermittedAssertionCategories: readonly GovernedVocabularyReference[];
  founderProhibitedAssertionCategories: readonly GovernedVocabularyReference[];
}>;

export type AdmissionEvidenceAuthorityAssessmentInput = Readonly<{
  assessmentIdentity: AdmissionStableIdentity;
  proposal: CalibrationKnowledgeAdmissionProposal;
  evidencePackage: AdmissionEvidencePackage;
  authorityClaims: readonly AdmissionAuthorityClaim[];
  evidenceClassifications: readonly AdmissionEvidenceClassificationReference[];
  assertionRequirements: readonly AdmissionAssertionAssessmentRequirement[];
  policy: AdmissionEvidenceAuthorityAssessmentPolicy;
  assessmentDate: string;
}>;

export type AdmissionEvidenceReferenceAssessment = Readonly<{
  evidenceId: string;
  classification: AdmissionEvidenceClassification;
  supportingAssertionIds: readonly string[];
  contradictoryAssertionIds: readonly string[];
  state: AdmissionEvidenceAssessmentState;
  limitations: readonly string[];
}>;

export type AdmissionEvidenceAssessment = Readonly<{
  packageIdentity: AdmissionStableIdentity;
  expectedPackageIdentity: AdmissionStableIdentity;
  state: AdmissionEvidenceAssessmentState;
  references: readonly AdmissionEvidenceReferenceAssessment[];
  missingEvidenceIds: readonly string[];
  duplicateEvidenceIds: readonly string[];
  staleOrMismatchedIdentity: boolean;
  sourceIdentityComplete: boolean;
  transformationHistoryComplete: boolean;
  chainOfCustodyComplete: boolean;
  limitations: readonly string[];
}>;

export type AdmissionAssertionEvidenceAssessment = Readonly<{
  assertionId: string;
  assertionCategory: GovernedVocabularyReference;
  proposedVerificationStatus: KnowledgeVerificationStatus;
  proposedConfidence: KnowledgeConfidenceState;
  state: AdmissionEvidenceAssessmentState;
  supportingEvidenceIds: readonly string[];
  contradictoryEvidenceIds: readonly string[];
  coveredPropositionIds: readonly string[];
  uncoveredPropositionIds: readonly string[];
  applicabilityCovered: boolean;
  provenanceComplete: boolean;
  unresolvedLimitations: readonly string[];
}>;

export type AdmissionAuthorityClaimAssessment = Readonly<{
  assertionId: string;
  claimId: string;
  state: AdmissionAuthorityAssessmentState;
  categoryAuthorised: boolean;
  applicabilityAuthorised: boolean;
  sourceScopeAuthorised: boolean;
  effective: boolean;
  supportingAuthorityRecordPresent: boolean;
  limitationBounded: boolean;
  permittedVerificationCeiling: KnowledgeVerificationStatus;
  limitations: readonly string[];
}>;

export type AdmissionAuthorityAssessment = Readonly<{
  assertionId: string;
  state: AdmissionAuthorityAssessmentState;
  claimAssessments: readonly AdmissionAuthorityClaimAssessment[];
  qualifiedClaimIds: readonly string[];
  limitations: readonly string[];
}>;

export type AdmissionVerificationCeilingAssessment = Readonly<{
  assertionId: string;
  proposedVerificationStatus: KnowledgeVerificationStatus;
  preservedConfidence: KnowledgeConfidenceState;
  evidenceState: AdmissionEvidenceAssessmentState;
  authorityState: AdmissionAuthorityAssessmentState;
  maximumPermittedVerificationStatus: KnowledgeVerificationStatus;
  proposedExceedsCeiling: boolean;
  limitations: readonly string[];
}>;

export type CalibrationKnowledgeEvidenceAuthorityAssessment = Readonly<{
  assessmentIdentity: AdmissionStableIdentity;
  proposalIdentity: AdmissionStableIdentity;
  evidencePackageIdentity: AdmissionStableIdentity;
  policyId: string;
  policyVersion: string;
  assessmentDate: string;
  evidenceAssessment: AdmissionEvidenceAssessment;
  assertionEvidenceAssessments: readonly AdmissionAssertionEvidenceAssessment[];
  authorityAssessments: readonly AdmissionAuthorityAssessment[];
  verificationCeilings: readonly AdmissionVerificationCeilingAssessment[];
  findings: readonly AdmissionValidationFinding[];
}>;

const supportVerificationOrder: readonly KnowledgeVerificationStatus[] = [
  "unknown",
  "observed",
  "candidate",
  "provisional",
  "verified",
  "founder_verified",
  "authoritatively_verified",
];

const weakEvidenceClassifications = new Set<AdmissionEvidenceClassification>([
  "xdf_label",
  "table_address",
  "filename",
  "folder",
  "community_convention",
  "other",
]);

const assertionCategories = {
  identity: "identity",
  canonicalName: "canonical_name",
  purpose: "purpose",
  engineeringIntent: "engineering_intent",
  directionalBehaviour: "directional_behaviour",
  protectiveResponse: "protective_response",
} as const;

function requireNonBlank(value: string, field: string): void {
  if (!value.trim()) throw new Error(`${field} is required.`);
}

function validDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.toISOString().slice(0, 10) === value;
}

function stableVocabulary(value: GovernedVocabularyReference): string {
  return JSON.stringify([value.vocabularyId, value.vocabularyVersion, value.termId]);
}

function sameVocabulary(left: GovernedVocabularyReference, right: GovernedVocabularyReference): boolean {
  return stableVocabulary(left) === stableVocabulary(right);
}

function deepCloneFreeze<T>(value: T): T {
  if (Array.isArray(value)) return Object.freeze(value.map(deepCloneFreeze)) as T;
  if (value !== null && typeof value === "object") {
    const clone: Record<PropertyKey, unknown> = {};
    for (const key of Reflect.ownKeys(value)) {
      clone[key] = deepCloneFreeze((value as Record<PropertyKey, unknown>)[key]);
    }
    return Object.freeze(clone) as T;
  }
  return value;
}

function uniqueSorted(values: readonly string[]): readonly string[] {
  return [...new Set(values)].sort();
}

function validateIdentity(value: AdmissionStableIdentity, field: string): void {
  requireNonBlank(value.id, `${field} identity`);
  requireNonBlank(value.revision, `${field} revision`);
  requireNonBlank(value.contentDigest, `${field} digest`);
}

function collectAssertions(knowledge: CalibrationKnowledgeObject): readonly QualifiedAssertion<unknown>[] {
  const assertions: QualifiedAssertion<unknown>[] = [
    knowledge.identity,
    knowledge.canonicalName,
    ...knowledge.aliases,
    ...knowledge.purposes,
    ...knowledge.engineeringIntents,
    knowledge.calibrationKind,
    knowledge.primarySubsystem,
    ...knowledge.relatedSubsystems,
    knowledge.applicability,
    ...knowledge.sourceRepresentations,
    ...knowledge.directionalBehaviours,
    ...knowledge.relationships,
  ];
  for (const behaviour of knowledge.directionalBehaviours) {
    if (!behaviour.value) continue;
    assertions.push(
      ...behaviour.value.boundaryConditions,
      ...behaviour.value.nonlinearCharacteristics,
      ...behaviour.value.potentialProtectiveResponses
    );
  }
  return assertions;
}

function exactIdentity(left: AdmissionStableIdentity, right: AdmissionStableIdentity): boolean {
  return left.id === right.id && left.revision === right.revision && left.contentDigest === right.contentDigest;
}

function validateInput(input: AdmissionEvidenceAuthorityAssessmentInput): void {
  validateIdentity(input.assessmentIdentity, "Assessment");
  defineCalibrationKnowledgeAdmissionProposal(input.proposal);
  if (!validDate(input.assessmentDate)) throw new Error("Assessment date must be a valid YYYY-MM-DD calendar date.");
  requireNonBlank(input.policy.policyId, "Assessment policy identity");
  requireNonBlank(input.policy.policyVersion, "Assessment policy version");
  const assertions = collectAssertions(input.proposal.proposedRevision.knowledge);
  const assertionIds = new Set(assertions.map((item) => item.assertionId));
  const requirementIds = input.assertionRequirements.map((item) => item.assertionId);
  if (new Set(requirementIds).size !== requirementIds.length) throw new Error("Assertion assessment requirements contain duplicate assertion identities.");
  for (const assertionId of assertionIds) {
    if (!requirementIds.includes(assertionId)) throw new Error(`Material assertion ${assertionId} requires an assessment requirement.`);
  }
  for (const requirement of input.assertionRequirements) {
    if (!assertionIds.has(requirement.assertionId)) throw new Error(`Assessment requirement references unknown assertion ${requirement.assertionId}.`);
    const assertion = assertions.find((item) => item.assertionId === requirement.assertionId);
    if (assertion?.verificationStatus !== requirement.requestedVerificationStatus) throw new Error(`Assertion ${requirement.assertionId} requested verification does not match the proposed assertion.`);
    requireNonBlank(requirement.assertionCategory.termId, "Assertion category");
    const propositionIds = requirement.propositionIds;
    if (new Set(propositionIds).size !== propositionIds.length || propositionIds.some((item) => !item.trim())) throw new Error(`Assertion ${requirement.assertionId} has invalid proposition identities.`);
    if (new Set(requirement.propositionCoverage.map((item) => item.propositionId)).size !== requirement.propositionCoverage.length) throw new Error(`Assertion ${requirement.assertionId} has duplicate proposition coverage.`);
    for (const coverage of requirement.propositionCoverage) {
      if (!propositionIds.includes(coverage.propositionId)) throw new Error(`Assertion ${requirement.assertionId} covers unknown proposition ${coverage.propositionId}.`);
    }
    for (const id of [...requirement.unresolvedAuthorityClaimIds, ...requirement.conflictingAuthorityClaimIds]) {
      if (!requirement.authorityClaimIds.includes(id)) throw new Error(`Assertion ${requirement.assertionId} qualifies unknown authority claim ${id}.`);
    }
  }
  const classificationIds = input.evidenceClassifications.map((item) => item.evidenceId);
  if (new Set(classificationIds).size !== classificationIds.length) throw new Error("Evidence classifications contain duplicate Evidence identities.");
  const claimIds = input.authorityClaims.map((item) => item.claimIdentity.id);
  if (new Set(claimIds).size !== claimIds.length) throw new Error("Authority claims contain duplicate identities.");
}

function finding(code: string, category: AdmissionValidationFinding["category"], message: string, affectedAssertionIds: readonly string[] = [], affectedEvidenceIds: readonly string[] = [], blocking = false): AdmissionValidationFinding {
  return defineAdmissionValidationFinding({
    findingId: `slice-4.2:${code}:${uniqueSorted([...affectedAssertionIds, ...affectedEvidenceIds]).join(":") || "global"}`,
    findingCode: code,
    severity: blocking ? "error" : "warning",
    category,
    affectedProposalPaths: [],
    affectedAssertionIds: uniqueSorted(affectedAssertionIds),
    affectedEvidenceIds: uniqueSorted(affectedEvidenceIds),
    affectedAuthorityClaimIds: [],
    message,
    blocking,
    resolutionRequirement: blocking ? message : null,
    lifecycle: { status: "assessed", version: "1" },
  });
}

function assessEvidenceIntegrity(input: AdmissionEvidenceAuthorityAssessmentInput): AdmissionEvidenceAssessment {
  const evidenceIds = input.evidencePackage.evidence.map((item) => item.evidenceId);
  const duplicateEvidenceIds = uniqueSorted(evidenceIds.filter((item, index) => evidenceIds.indexOf(item) !== index));
  const knownEvidenceIds = new Set(evidenceIds);
  const mapped = input.evidencePackage.assertionMappings.flatMap((item) => [...item.supportingEvidenceIds, ...item.contradictoryEvidenceIds]);
  const missingEvidenceIds = uniqueSorted(mapped.filter((item) => !knownEvidenceIds.has(item)));
  const classifications = new Map(input.evidenceClassifications.map((item) => [item.evidenceId, item.classification]));
  const references = input.evidencePackage.evidence
    .map((evidence): AdmissionEvidenceReferenceAssessment => {
      const classification = classifications.get(evidence.evidenceId) ?? "other";
      const supportingAssertionIds = uniqueSorted(input.evidencePackage.assertionMappings.filter((item) => item.supportingEvidenceIds.includes(evidence.evidenceId)).map((item) => item.assertionId));
      const contradictoryAssertionIds = uniqueSorted(input.evidencePackage.assertionMappings.filter((item) => item.contradictoryEvidenceIds.includes(evidence.evidenceId)).map((item) => item.assertionId));
      const limitations = classification === "other" ? ["Evidence classification remains unresolved."] : [];
      return { evidenceId: evidence.evidenceId, classification, supportingAssertionIds, contradictoryAssertionIds, state: classification === "other" ? "unresolved" : contradictoryAssertionIds.length > 0 ? "contradictory" : "complete", limitations };
    })
    .sort((left, right) => left.evidenceId.localeCompare(right.evidenceId));
  const staleOrMismatchedIdentity = !exactIdentity(input.proposal.evidencePackageIdentity, input.evidencePackage.packageIdentity);
  const sourceIdentityComplete = input.evidencePackage.evidence.every((item) => !!item.evidenceId.trim() && !!item.sourceType.trim() && !!item.sourceIdentifier.trim()) && input.evidencePackage.provenance.every((item) => !!item.sourceType.trim() && !!item.sourceIdentifier.trim()) && (!input.policy.requireSourceRevision || (input.evidencePackage.sourceRevisionDigests.length > 0 && input.evidencePackage.sourceRevisionDigests.every((item) => !!item.id.trim() && !!item.revision.trim() && !!item.contentDigest.trim())));
  const transformationHistoryComplete = !input.policy.requireTransformationHistory || input.evidencePackage.transformationHistory.length > 0;
  const chainOfCustodyComplete = !input.policy.requireChainOfCustody || input.evidencePackage.chainOfCustody.length > 0;
  const limitations = uniqueSorted([
    ...(staleOrMismatchedIdentity ? ["Evidence package identity, revision, or digest does not match the proposal reference."] : []),
    ...(missingEvidenceIds.length ? ["Evidence mappings contain unresolved Evidence references."] : []),
    ...(duplicateEvidenceIds.length ? ["Evidence package contains duplicate Evidence identities."] : []),
    ...(!sourceIdentityComplete ? ["Evidence source identity or source revision is incomplete."] : []),
    ...(!transformationHistoryComplete ? ["Required transformation history is incomplete."] : []),
    ...(!chainOfCustodyComplete ? ["Required chain of custody is incomplete."] : []),
    ...input.evidencePackage.knownLimitations,
  ]);
  const invalid = staleOrMismatchedIdentity || duplicateEvidenceIds.length > 0;
  const partial = missingEvidenceIds.length > 0 || !sourceIdentityComplete || !transformationHistoryComplete || !chainOfCustodyComplete;
  const unresolved = input.evidencePackage.knownLimitations.length > 0 || references.some((item) => item.state === "unresolved");
  return deepCloneFreeze({ packageIdentity: input.evidencePackage.packageIdentity, expectedPackageIdentity: input.proposal.evidencePackageIdentity, state: invalid ? "invalid" : partial ? "partial" : unresolved ? "unresolved" : "complete", references, missingEvidenceIds, duplicateEvidenceIds, staleOrMismatchedIdentity, sourceIdentityComplete, transformationHistoryComplete, chainOfCustodyComplete, limitations });
}

function classificationsById(input: AdmissionEvidenceAuthorityAssessmentInput): ReadonlyMap<string, AdmissionEvidenceClassification> {
  return new Map(input.evidenceClassifications.map((item) => [item.evidenceId, item.classification]));
}

function categoryWeakEvidence(classification: AdmissionEvidenceClassification, category: string): boolean {
  if (!weakEvidenceClassifications.has(classification)) return false;
  if (classification === "other") return true;
  if (category === assertionCategories.purpose || category === assertionCategories.engineeringIntent) return true;
  if (category === assertionCategories.identity && (classification === "table_address" || classification === "filename" || classification === "folder" || classification === "xdf_label")) return true;
  return classification === "filename" || classification === "folder";
}

function assessAssertionEvidence(input: AdmissionEvidenceAuthorityAssessmentInput, assertions: ReadonlyMap<string, QualifiedAssertion<unknown>>): readonly AdmissionAssertionEvidenceAssessment[] {
  const mappings = new Map(input.evidencePackage.assertionMappings.map((item) => [item.assertionId, item]));
  const evidenceIds = new Set(input.evidencePackage.evidence.map((item) => item.evidenceId));
  const classifications = classificationsById(input);
  return input.assertionRequirements
    .map((requirement): AdmissionAssertionEvidenceAssessment => {
      const assertion = assertions.get(requirement.assertionId);
      if (!assertion) throw new Error(`Missing assertion ${requirement.assertionId}.`);
      const mapping = mappings.get(requirement.assertionId);
      const supportingEvidenceIds = uniqueSorted(mapping?.supportingEvidenceIds.filter((item) => evidenceIds.has(item)) ?? []);
      const contradictoryEvidenceIds = uniqueSorted(mapping?.contradictoryEvidenceIds.filter((item) => evidenceIds.has(item)) ?? []);
      const coveredPropositionIds = uniqueSorted(requirement.propositionCoverage.filter((item) => item.supportingEvidenceIds.some((id) => supportingEvidenceIds.includes(id))).map((item) => item.propositionId));
      const uncoveredPropositionIds = requirement.propositionIds.filter((item) => !coveredPropositionIds.includes(item)).sort();
      const applicabilityCovered = requirement.applicabilityEvidenceIds.length === 0 || requirement.applicabilityEvidenceIds.every((item) => supportingEvidenceIds.includes(item));
      const provenanceComplete = !requirement.provenanceRequired || assertion.provenance.every((item) => !!item.sourceType.trim() && !!item.sourceIdentifier.trim()) && assertion.provenance.length > 0;
      const weakSupporting = supportingEvidenceIds.some((id) => categoryWeakEvidence(classifications.get(id) ?? "other", requirement.assertionCategory.termId));
      const unresolvedLimitations = uniqueSorted([
        ...(mapping ? [] : ["No exact assertion-to-Evidence mapping exists."]),
        ...(uncoveredPropositionIds.length ? ["One or more embedded propositions exceed mapped Evidence coverage."] : []),
        ...(!applicabilityCovered ? ["Assertion applicability is not covered by mapped Evidence."] : []),
        ...(!provenanceComplete ? ["Assertion provenance is incomplete."] : []),
        ...(weakSupporting ? ["Mapped Evidence classification cannot establish the requested engineering meaning."] : []),
      ]);
      let state: AdmissionEvidenceAssessmentState;
      if (requirement.evidenceRequirement === "not_required") state = "not_required";
      else if (!mapping || supportingEvidenceIds.length === 0) state = "missing";
      else if (contradictoryEvidenceIds.length > 0) state = "contradictory";
      else if (weakSupporting || uncoveredPropositionIds.length > 0 || !applicabilityCovered || !provenanceComplete) state = "partial";
      else state = "complete";
      return { assertionId: requirement.assertionId, assertionCategory: requirement.assertionCategory, proposedVerificationStatus: assertion.verificationStatus, proposedConfidence: assertion.confidence, state, supportingEvidenceIds, contradictoryEvidenceIds, coveredPropositionIds, uncoveredPropositionIds, applicabilityCovered, provenanceComplete, unresolvedLimitations };
    })
    .sort((left, right) => left.assertionId.localeCompare(right.assertionId));
}

function scopeIncludes(claim: AdmissionAuthorityClaim, required: readonly GovernedVocabularyReference[]): boolean {
  return required.every((scope) => claim.applicability.some((item) => sameVocabulary(item, scope)));
}

function isFounderClaim(input: AdmissionEvidenceAuthorityAssessmentInput, claim: AdmissionAuthorityClaim): boolean {
  return input.policy.founderAuthorityTypes.includes(claim.authority.authorityType);
}

function assessClaim(input: AdmissionEvidenceAuthorityAssessmentInput, requirement: AdmissionAssertionAssessmentRequirement, claim: AdmissionAuthorityClaim): AdmissionAuthorityClaimAssessment {
  const evidenceIds = new Set(input.evidencePackage.evidence.map((item) => item.evidenceId));
  const categoryAuthorised = claim.assertionCategories.some((item) => sameVocabulary(item, requirement.assertionCategory));
  const applicabilityAuthorised = scopeIncludes(claim, requirement.requiredAuthorityScopes);
  const sourceScopeAuthorised = scopeIncludes(claim, requirement.requiredSourceScopes);
  const effective = claim.effectiveFrom <= input.assessmentDate && (claim.effectiveUntil === null || claim.effectiveUntil >= input.assessmentDate);
  const supportingAuthorityRecordPresent = claim.supportingAuthorityEvidenceIds.length > 0 && claim.supportingAuthorityEvidenceIds.every((item) => evidenceIds.has(item));
  const limitationIndexes = requirement.applicableAuthorityLimitationIndexes[claim.claimIdentity.id] ?? [];
  const limitationBounded = limitationIndexes.length > 0;
  const founder = isFounderClaim(input, claim);
  const founderPermitted = !founder || input.policy.founderPermittedAssertionCategories.some((item) => sameVocabulary(item, requirement.assertionCategory));
  const founderProhibited = founder && input.policy.founderProhibitedAssertionCategories.some((item) => sameVocabulary(item, requirement.assertionCategory));
  const structurallyValid = !!claim.claimIdentity.id.trim() && !!claim.claimIdentity.revision.trim() && !!claim.claimIdentity.contentDigest.trim() && !!claim.authority.authorityType.trim() && !!claim.authority.authorityIdentifier.trim() && validDate(claim.effectiveFrom) && (claim.effectiveUntil === null || validDate(claim.effectiveUntil));
  const explicitlyUnresolved = requirement.unresolvedAuthorityClaimIds.includes(claim.claimIdentity.id) || requirement.conflictingAuthorityClaimIds.includes(claim.claimIdentity.id);
  const limitations = uniqueSorted([
    ...(!categoryAuthorised ? ["Authority claim does not cover the assertion category."] : []),
    ...(!applicabilityAuthorised ? ["Authority claim does not cover required applicability."] : []),
    ...(!sourceScopeAuthorised ? ["Authority claim does not cover required source scope."] : []),
    ...(!effective ? [claim.effectiveUntil !== null && claim.effectiveUntil < input.assessmentDate ? "Authority claim is expired." : "Authority claim is not yet effective."] : []),
    ...(claim.lifecycle.status === "superseded" ? ["Authority claim is inactive."] : []),
    ...(!supportingAuthorityRecordPresent ? ["Supporting authority record is missing."] : []),
    ...(limitationBounded ? ["An applicable authority limitation prevents full qualification."] : []),
    ...(!founderPermitted || founderProhibited ? ["Founder authority is outside its permitted assertion scope."] : []),
    ...(!structurallyValid ? ["Authority claim structure is invalid."] : []),
    ...(explicitlyUnresolved ? ["Authority claim remains unresolved or conflicts with another claim."] : []),
  ]);
  let state: AdmissionAuthorityAssessmentState;
  if (!structurallyValid) state = "invalid";
  else if (explicitlyUnresolved) state = "unresolved";
  else if (claim.lifecycle.status === "superseded") state = "inactive";
  else if (!effective) state = claim.effectiveUntil !== null && claim.effectiveUntil < input.assessmentDate ? "expired" : "inactive";
  else if (!supportingAuthorityRecordPresent) state = "unsupported";
  else if (!categoryAuthorised || !applicabilityAuthorised || !sourceScopeAuthorised || !founderPermitted || founderProhibited) state = "outside_scope";
  else if (limitationBounded) state = "partially_qualified";
  else state = "qualified";
  return deepCloneFreeze({ assertionId: requirement.assertionId, claimId: claim.claimIdentity.id, state, categoryAuthorised, applicabilityAuthorised, sourceScopeAuthorised, effective, supportingAuthorityRecordPresent, limitationBounded, permittedVerificationCeiling: claim.permittedVerificationCeiling, limitations });
}

function assessAuthority(input: AdmissionEvidenceAuthorityAssessmentInput): readonly AdmissionAuthorityAssessment[] {
  const claims = new Map(input.authorityClaims.map((item) => [item.claimIdentity.id, item]));
  return input.assertionRequirements
    .map((requirement): AdmissionAuthorityAssessment => {
      const missingClaimIds = requirement.authorityClaimIds.filter((item) => !claims.has(item));
      const claimAssessments = requirement.authorityClaimIds.map((id) => claims.get(id)).filter((item): item is AdmissionAuthorityClaim => !!item).map((claim) => assessClaim(input, requirement, claim)).sort((left, right) => left.claimId.localeCompare(right.claimId));
      const qualifiedClaimIds = claimAssessments.filter((item) => item.state === "qualified").map((item) => item.claimId);
      const limitations = uniqueSorted([...missingClaimIds.map((id) => `Authority claim ${id} is missing.`), ...claimAssessments.flatMap((item) => item.limitations)]);
      let state: AdmissionAuthorityAssessmentState;
      if (missingClaimIds.length > 0 && claimAssessments.length === 0) state = "invalid";
      else if (claimAssessments.some((item) => item.state === "invalid")) state = "invalid";
      else if (claimAssessments.some((item) => item.state === "unresolved")) state = "unresolved";
      else if (qualifiedClaimIds.length > 0) state = "qualified";
      else if (claimAssessments.some((item) => item.state === "partially_qualified")) state = "partially_qualified";
      else if (claimAssessments.length === 0) state = "unsupported";
      else if (claimAssessments.every((item) => item.state === "expired")) state = "expired";
      else if (claimAssessments.every((item) => item.state === "inactive")) state = "inactive";
      else if (claimAssessments.every((item) => item.state === "outside_scope")) state = "outside_scope";
      else state = "unsupported";
      return { assertionId: requirement.assertionId, state, claimAssessments, qualifiedClaimIds: uniqueSorted(qualifiedClaimIds), limitations };
    })
    .sort((left, right) => left.assertionId.localeCompare(right.assertionId))
    .map(deepCloneFreeze);
}

function statusIndex(status: KnowledgeVerificationStatus): number {
  const index = supportVerificationOrder.indexOf(status);
  return index === -1 ? 0 : index;
}

function strongestQualifiedCeiling(authority: AdmissionAuthorityAssessment): KnowledgeVerificationStatus {
  const qualified = authority.claimAssessments.filter((item) => item.state === "qualified").map((item) => item.permittedVerificationCeiling);
  return qualified.reduce<KnowledgeVerificationStatus>((strongest, item) => statusIndex(item) > statusIndex(strongest) ? item : strongest, "unknown");
}

function deriveCeilings(assertions: ReadonlyMap<string, QualifiedAssertion<unknown>>, evidence: readonly AdmissionAssertionEvidenceAssessment[], authorities: readonly AdmissionAuthorityAssessment[]): readonly AdmissionVerificationCeilingAssessment[] {
  const authorityByAssertion = new Map(authorities.map((item) => [item.assertionId, item]));
  return evidence.map((evidenceAssessment): AdmissionVerificationCeilingAssessment => {
    const assertion = assertions.get(evidenceAssessment.assertionId);
    if (!assertion) throw new Error(`Missing assertion ${evidenceAssessment.assertionId}.`);
    const authority = authorityByAssertion.get(evidenceAssessment.assertionId);
    if (!authority) throw new Error(`Missing authority assessment for ${evidenceAssessment.assertionId}.`);
    let maximum: KnowledgeVerificationStatus = "unknown";
    if (evidenceAssessment.state === "complete" || evidenceAssessment.state === "not_required") {
      maximum = authority.state === "qualified" ? strongestQualifiedCeiling(authority) : "candidate";
    } else if (evidenceAssessment.state === "partial" || evidenceAssessment.state === "contradictory") {
      maximum = "candidate";
    }
    const proposedExceedsCeiling = statusIndex(assertion.verificationStatus) > statusIndex(maximum);
    return deepCloneFreeze({ assertionId: assertion.assertionId, proposedVerificationStatus: assertion.verificationStatus, preservedConfidence: assertion.confidence, evidenceState: evidenceAssessment.state, authorityState: authority.state, maximumPermittedVerificationStatus: maximum, proposedExceedsCeiling, limitations: uniqueSorted([...evidenceAssessment.unresolvedLimitations, ...authority.limitations, ...(proposedExceedsCeiling ? ["Proposed verification exceeds the Evidence and authority ceiling."] : [])]) });
  }).sort((left, right) => left.assertionId.localeCompare(right.assertionId));
}

function buildFindings(evidence: AdmissionEvidenceAssessment, assertions: readonly AdmissionAssertionEvidenceAssessment[], authorities: readonly AdmissionAuthorityAssessment[], ceilings: readonly AdmissionVerificationCeilingAssessment[]): readonly AdmissionValidationFinding[] {
  const findings: AdmissionValidationFinding[] = [];
  if (evidence.state !== "complete") findings.push(finding("EVIDENCE_PACKAGE_INCOMPLETE", "evidence", "Evidence package integrity remains incomplete.", [], evidence.missingEvidenceIds, evidence.state === "invalid"));
  for (const item of assertions) {
    if (item.state !== "complete" && item.state !== "not_required") findings.push(finding(`ASSERTION_EVIDENCE_${item.state.toUpperCase()}`, "evidence", `Assertion Evidence is ${item.state}.`, [item.assertionId], [...item.supportingEvidenceIds, ...item.contradictoryEvidenceIds]));
  }
  for (const item of authorities) {
    if (item.state !== "qualified") findings.push(finding(`AUTHORITY_${item.state.toUpperCase()}`, "authority", `Assertion authority is ${item.state}.`, [item.assertionId]));
  }
  for (const item of ceilings) {
    if (item.proposedExceedsCeiling) findings.push(finding("VERIFICATION_EXCEEDS_CEILING", "qualification", "Proposed verification exceeds the supported ceiling.", [item.assertionId], [], true));
  }
  return findings.sort((left, right) => left.findingId.localeCompare(right.findingId));
}

export function assessCalibrationKnowledgeEvidenceAndAuthority(input: AdmissionEvidenceAuthorityAssessmentInput): CalibrationKnowledgeEvidenceAuthorityAssessment {
  validateInput(input);
  const snapshot = deepCloneFreeze(input);
  const assertions = new Map(collectAssertions(snapshot.proposal.proposedRevision.knowledge).map((item) => [item.assertionId, item]));
  const evidenceAssessment = assessEvidenceIntegrity(snapshot);
  const assertionEvidenceAssessments = assessAssertionEvidence(snapshot, assertions);
  const authorityAssessments = assessAuthority(snapshot);
  const verificationCeilings = deriveCeilings(assertions, assertionEvidenceAssessments, authorityAssessments);
  const findings = buildFindings(evidenceAssessment, assertionEvidenceAssessments, authorityAssessments, verificationCeilings);
  return deepCloneFreeze({ assessmentIdentity: snapshot.assessmentIdentity, proposalIdentity: snapshot.proposal.proposalIdentity, evidencePackageIdentity: snapshot.evidencePackage.packageIdentity, policyId: snapshot.policy.policyId, policyVersion: snapshot.policy.policyVersion, assessmentDate: snapshot.assessmentDate, evidenceAssessment, assertionEvidenceAssessments, authorityAssessments, verificationCeilings, findings });
}

import {
  type CalibrationApplicability,
  type GovernedVocabularyReference,
  type KnowledgeAuthorityReference,
  type KnowledgeConflictState,
  type KnowledgeEvidenceReference,
  type KnowledgeLifecycleReference,
  type KnowledgeProvenanceReference,
  type KnowledgeVerificationStatus,
  type QualifiedAssertion,
  validateQualifiedAssertion,
} from "./calibrationKnowledge.ts";

export type EngineeringAssertionStableIdentity = Readonly<{
  stableAssertionId: string;
}>;

export type EngineeringAssertionRevisionIdentity = Readonly<{
  stableAssertionId: string;
  assertionRevision: string;
  canonicalAssertionDigest: string;
}>;

export type CanonicalStatementRepresentation = Readonly<{
  statementRepresentationId: string;
  statementRevision: string;
  language: string;
  text: string;
  canonicalStatementDigest: string;
}>;

export type EngineeringAssertionTerm = Readonly<{
  knowledgeId: string | null;
  governedTerm: GovernedVocabularyReference | null;
  literal: string | null;
}>;

export type EngineeringAssertionProposition = Readonly<{
  subject: EngineeringAssertionTerm;
  predicate: GovernedVocabularyReference;
  object: EngineeringAssertionTerm;
  direction: GovernedVocabularyReference | null;
  modality: GovernedVocabularyReference;
  causality: GovernedVocabularyReference;
}>;

export type EngineeringAssertionScope = Readonly<{
  applicability: CalibrationApplicability;
  preconditions: readonly QualifiedAssertion<string>[];
  exclusions: readonly QualifiedAssertion<string>[];
  knownLimitations: readonly QualifiedAssertion<string>[];
  unresolvedDimensions: readonly QualifiedAssertion<string>[];
}>;

export type EngineeringAssertionQualification = Readonly<{
  verificationStatus: KnowledgeVerificationStatus;
  confidence: QualifiedAssertion<GovernedVocabularyReference>["confidence"];
  authority: KnowledgeAuthorityReference | null;
  provenance: readonly KnowledgeProvenanceReference[];
  supportingEvidence: readonly KnowledgeEvidenceReference[];
  contradictoryEvidence: readonly KnowledgeEvidenceReference[];
  conflictState: KnowledgeConflictState;
  unresolvedReason: string | null;
}>;

export type EngineeringAssertionMembershipContext = Readonly<{
  calibrationKnowledgeStableId: string;
  calibrationKnowledgeVersion: string;
  role: GovernedVocabularyReference;
  requirement: GovernedVocabularyReference;
}>;

export type EngineeringAssertionRelationshipReference = Readonly<{
  relationshipStableId: string;
  relationshipRevision: string;
  relationshipDigest: string;
  relatedStableAssertionId: string;
  relatedAssertionRevision: string;
  relatedAssertionDigest: string;
  direction: GovernedVocabularyReference;
}>;

export type EngineeringAssertion = Readonly<{
  identity: EngineeringAssertionRevisionIdentity;
  statement: CanonicalStatementRepresentation;
  assertionClass: GovernedVocabularyReference;
  proposition: EngineeringAssertionProposition;
  scope: EngineeringAssertionScope;
  qualification: EngineeringAssertionQualification;
  memberships: readonly EngineeringAssertionMembershipContext[];
  relationships: readonly EngineeringAssertionRelationshipReference[];
  lifecycle: KnowledgeLifecycleReference;
  contractVersion: string;
}>;

function requireNonBlank(value: string, field: string): void {
  if (!value.trim()) throw new Error(`${field} is required.`);
}

function requireDigest(value: string, field: string): void {
  if (!/^sha256:[0-9a-f]{64}$/.test(value)) {
    throw new Error(`${field} must be a qualified SHA-256 digest.`);
  }
}

function validateVocabulary(
  value: GovernedVocabularyReference,
  field: string
): void {
  requireNonBlank(value.vocabularyId, `${field} vocabulary identity`);
  requireNonBlank(value.vocabularyVersion, `${field} vocabulary version`);
  requireNonBlank(value.termId, `${field} term identity`);
  requireNonBlank(value.label, `${field} label`);
  if (!(["known", "unknown", "unrecognized"] as const).includes(value.recognition)) {
    throw new Error(`${field} recognition is invalid.`);
  }
}

function validateTerm(value: EngineeringAssertionTerm, field: string): void {
  const representations = [value.knowledgeId, value.governedTerm, value.literal].filter(
    (item) => item !== null
  );
  if (representations.length !== 1) {
    throw new Error(`${field} requires exactly one representation.`);
  }
  if (value.knowledgeId !== null) requireNonBlank(value.knowledgeId, `${field} Knowledge identity`);
  if (value.governedTerm !== null) validateVocabulary(value.governedTerm, field);
  if (value.literal !== null) requireNonBlank(value.literal, `${field} literal`);
}

function validateEvidence(value: KnowledgeEvidenceReference, field: string): void {
  requireNonBlank(value.evidenceId, `${field} Evidence identity`);
  requireNonBlank(value.sourceType, `${field} Evidence source type`);
  requireNonBlank(value.sourceIdentifier, `${field} Evidence source identity`);
}

function requireUnique(values: readonly string[], field: string): void {
  const seen = new Set<string>();
  for (const value of values) {
    requireNonBlank(value, field);
    if (seen.has(value)) throw new Error(`${field} ${value} is duplicated.`);
    seen.add(value);
  }
}

function validateQualifiedText(
  assertion: QualifiedAssertion<string>,
  field: string
): void {
  validateQualifiedAssertion(assertion, field);
  if (assertion.value !== null) requireNonBlank(assertion.value, `${field} value`);
}

function isAuthoritative(status: KnowledgeVerificationStatus): boolean {
  return status === "verified" || status === "founder_verified" || status === "authoritatively_verified";
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

export function defineEngineeringAssertion(input: EngineeringAssertion): EngineeringAssertion {
  requireNonBlank(input.identity.stableAssertionId, "Stable assertion identity");
  requireNonBlank(input.identity.assertionRevision, "Assertion revision identity");
  requireDigest(input.identity.canonicalAssertionDigest, "Canonical assertion digest");
  requireNonBlank(input.contractVersion, "Engineering Assertion contract version");

  requireNonBlank(input.statement.statementRepresentationId, "Statement representation identity");
  requireNonBlank(input.statement.statementRevision, "Statement revision");
  requireNonBlank(input.statement.language, "Statement language");
  requireNonBlank(input.statement.text, "Canonical statement text");
  requireDigest(input.statement.canonicalStatementDigest, "Canonical statement digest");

  validateVocabulary(input.assertionClass, "Assertion class");
  validateTerm(input.proposition.subject, "Proposition subject");
  validateVocabulary(input.proposition.predicate, "Proposition predicate");
  validateTerm(input.proposition.object, "Proposition object");
  if (input.proposition.direction !== null) validateVocabulary(input.proposition.direction, "Proposition direction");
  validateVocabulary(input.proposition.modality, "Proposition modality");
  validateVocabulary(input.proposition.causality, "Proposition causality");

  const scopeAssertionIds: string[] = [];
  for (const [name, values] of Object.entries({
    precondition: input.scope.preconditions,
    exclusion: input.scope.exclusions,
    limitation: input.scope.knownLimitations,
    unresolvedDimension: input.scope.unresolvedDimensions,
  })) {
    values.forEach((value) => {
      validateQualifiedText(value, `Assertion ${name}`);
      scopeAssertionIds.push(value.assertionId);
    });
  }
  requireUnique(scopeAssertionIds, "Scope assertion identity");

  const qualificationProxy: QualifiedAssertion<null> = {
    assertionId: input.identity.stableAssertionId,
    value: null,
    verificationStatus: input.qualification.verificationStatus,
    confidence: input.qualification.confidence,
    authority: input.qualification.authority,
    provenance: input.qualification.provenance,
    supportingEvidence: input.qualification.supportingEvidence,
    contradictoryEvidence: input.qualification.contradictoryEvidence,
    applicability: input.scope.applicability,
    conflictState: input.qualification.conflictState,
    unresolvedReason: input.qualification.unresolvedReason ?? "Canonical assertion value is represented by the proposition.",
    version: input.identity.assertionRevision,
    lifecycle: input.lifecycle,
  };
  validateQualifiedAssertion(qualificationProxy, "Engineering Assertion", [
    input.assertionClass,
    input.proposition.predicate,
    input.proposition.modality,
    input.proposition.causality,
    ...(input.proposition.direction === null ? [] : [input.proposition.direction]),
    ...(input.proposition.subject.governedTerm === null ? [] : [input.proposition.subject.governedTerm]),
    ...(input.proposition.object.governedTerm === null ? [] : [input.proposition.object.governedTerm]),
  ]);
  if (
    (input.qualification.verificationStatus === "unknown" ||
      input.qualification.conflictState === "unresolved") &&
    !input.qualification.unresolvedReason?.trim()
  ) {
    throw new Error("Engineering Assertion requires an unresolved reason.");
  }
  if (isAuthoritative(input.qualification.verificationStatus) && input.assertionClass.recognition !== "known") {
    throw new Error("Authoritative Engineering Assertion requires an admitted assertion-class vocabulary.");
  }
  requireUnique(input.qualification.supportingEvidence.map((item) => item.evidenceId), "Supporting Evidence identity");
  requireUnique(input.qualification.contradictoryEvidence.map((item) => item.evidenceId), "Contradictory Evidence identity");
  input.qualification.supportingEvidence.forEach((item) => validateEvidence(item, "Supporting"));
  input.qualification.contradictoryEvidence.forEach((item) => validateEvidence(item, "Contradictory"));
  const evidenceRoles = new Set(input.qualification.supportingEvidence.map((item) => item.evidenceId));
  for (const item of input.qualification.contradictoryEvidence) {
    if (evidenceRoles.has(item.evidenceId)) throw new Error(`Evidence ${item.evidenceId} cannot be both supporting and contradictory.`);
  }

  requireUnique(input.memberships.map((item) => `${item.calibrationKnowledgeStableId}:${item.calibrationKnowledgeVersion}`), "Membership identity");
  input.memberships.forEach((item) => {
    requireNonBlank(item.calibrationKnowledgeStableId, "Membership Knowledge identity");
    requireNonBlank(item.calibrationKnowledgeVersion, "Membership Knowledge version");
    validateVocabulary(item.role, "Membership role");
    validateVocabulary(item.requirement, "Membership requirement");
  });
  requireUnique(input.relationships.map((item) => item.relationshipStableId), "Relationship identity");
  input.relationships.forEach((item) => {
    requireNonBlank(item.relationshipStableId, "Relationship stable identity");
    requireNonBlank(item.relationshipRevision, "Relationship revision");
    requireDigest(item.relationshipDigest, "Relationship digest");
    requireNonBlank(item.relatedStableAssertionId, "Related assertion identity");
    requireNonBlank(item.relatedAssertionRevision, "Related assertion revision");
    requireDigest(item.relatedAssertionDigest, "Related assertion digest");
    validateVocabulary(item.direction, "Relationship direction");
  });

  return deepCloneFreeze(input);
}

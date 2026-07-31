import {
  isAuthoritativeStockVariantStatus,
  type KnowledgeConfidenceState,
  type StockVariantConflictState,
  type StockVariantLifecycleStatus,
  type StockVariantProvenance,
  type StockVariantVerificationStatus,
} from "./stockVariants.ts";

export type KnowledgeVerificationStatus = StockVariantVerificationStatus;
export type KnowledgeLifecycleStatus = StockVariantLifecycleStatus;
export type KnowledgeConflictState = StockVariantConflictState;
export type KnowledgeProvenanceReference = StockVariantProvenance;

export type KnowledgeAuthorityReference = Readonly<{
  authorityType: string;
  authorityIdentifier: string;
}>;

export type KnowledgeEvidenceReference = Readonly<{
  evidenceId: string;
  sourceType: string;
  sourceIdentifier: string;
  description?: string;
}>;

export type KnowledgeLifecycleReference = Readonly<{
  status: KnowledgeLifecycleStatus;
  version: string;
  effectiveAt?: string;
  supersedesIds?: readonly string[];
}>;

export type VocabularyRecognition = "known" | "unknown" | "unrecognized";

export type GovernedVocabularyReference = Readonly<{
  vocabularyId: string;
  vocabularyVersion: string;
  termId: string;
  label: string;
  recognition: VocabularyRecognition;
}>;

export type CalibrationKindReference = GovernedVocabularyReference;
export type DirectionalResponseReference = GovernedVocabularyReference;
export type EngineeringSubsystemReference = GovernedVocabularyReference;
export type CalibrationRelationshipKindReference = GovernedVocabularyReference;

export type CalibrationApplicability = Readonly<{
  scope: GovernedVocabularyReference;
  platforms: readonly string[];
  engineFamilies: readonly string[];
  ecuFamilies: readonly string[];
  dmeVariants: readonly string[];
  controlStrategies: readonly string[];
  romFamilies: readonly string[];
  softwareVersions: readonly string[];
  calibrationIds: readonly string[];
  stockVariantIds: readonly string[];
  operatingModes: readonly string[];
  transmissions: readonly string[];
  regions: readonly string[];
  emissionsSpecifications: readonly string[];
  hardwareConfigurations: readonly string[];
  sourceReferenceIds: readonly string[];
  unresolvedReason: string | null;
}>;

export type QualifiedAssertion<T> = Readonly<{
  assertionId: string;
  value: T | null;
  verificationStatus: KnowledgeVerificationStatus;
  confidence: KnowledgeConfidenceState;
  authority: KnowledgeAuthorityReference | null;
  provenance: readonly KnowledgeProvenanceReference[];
  supportingEvidence: readonly KnowledgeEvidenceReference[];
  contradictoryEvidence: readonly KnowledgeEvidenceReference[];
  applicability: CalibrationApplicability;
  conflictState: KnowledgeConflictState;
  unresolvedReason: string | null;
  version: string;
  lifecycle: KnowledgeLifecycleReference;
}>;

export type CalibrationIdentity = Readonly<{
  stableId: string;
}>;

export type CalibrationAlias = Readonly<{
  name: string;
  sourceReferenceId?: string;
}>;

export type CalibrationPurpose = Readonly<{
  summary: string;
  representedQuantity?: string;
  controlledFunction?: string;
  controlRole?: string;
  strategyContext?: string;
}>;

export type EngineeringObjectiveReference = Readonly<{
  objectiveId: string;
  canonicalName: string;
  vocabulary: GovernedVocabularyReference;
}>;

export type EngineeringIntent = Readonly<{
  summary: string;
  engineeringObjectives: readonly EngineeringObjectiveReference[];
  participatingSubsystems: readonly EngineeringSubsystemReference[];
  strategyContext?: string;
  protectedInterests: readonly string[];
  governingConstraints: readonly string[];
  documentedTradeoffs: readonly string[];
}>;

export type CalibrationSourceReference = Readonly<{
  sourceReferenceId: string;
  sourceType: GovernedVocabularyReference;
  sourceIdentifier: string;
  displayedName?: string;
  addressOrRegion?: string;
  axes: readonly string[];
  units?: string;
  conversionMetadata: Readonly<Record<string, string>>;
}>;

export type CalibrationBoundaryCondition = Readonly<{
  conditionId: string;
  quantity: string;
  relationship: GovernedVocabularyReference;
  valueDescription: string;
  unit?: string;
  operatingRegion?: string;
}>;

export type CalibrationProtectiveResponse = Readonly<{
  responseId: string;
  response: GovernedVocabularyReference;
  activationConditions: readonly string[];
  affectedSubsystems: readonly EngineeringSubsystemReference[];
  expectedIntervention?: string;
  relatedCalibrationIds: readonly string[];
  protectedInterests: readonly string[];
}>;

export type CalibrationBehaviour = Readonly<{
  manipulatedQuantity: string;
  response: DirectionalResponseReference;
  expectedEffect: string;
  affectedSubsystems: readonly EngineeringSubsystemReference[];
  operatingRegion?: string;
  preconditions: readonly string[];
  boundaryConditions: readonly QualifiedAssertion<CalibrationBoundaryCondition>[];
  nonlinearCharacteristics: readonly QualifiedAssertion<GovernedVocabularyReference>[];
  potentialProtectiveResponses: readonly QualifiedAssertion<CalibrationProtectiveResponse>[];
  dependencyCalibrationIds: readonly string[];
  exceptions: readonly string[];
}>;

export type CalibrationRelationship = Readonly<{
  relationshipId: string;
  sourceCalibrationId: string;
  targetKnowledgeId: string;
  kind: CalibrationRelationshipKindReference;
  direction: GovernedVocabularyReference;
  meaning: string;
}>;

export type CalibrationKnowledgeObject = Readonly<{
  identity: QualifiedAssertion<CalibrationIdentity>;
  canonicalName: QualifiedAssertion<string>;
  aliases: readonly QualifiedAssertion<CalibrationAlias>[];
  purposes: readonly QualifiedAssertion<CalibrationPurpose>[];
  engineeringIntents: readonly QualifiedAssertion<EngineeringIntent>[];
  calibrationKind: QualifiedAssertion<CalibrationKindReference>;
  primarySubsystem: QualifiedAssertion<EngineeringSubsystemReference>;
  relatedSubsystems: readonly QualifiedAssertion<EngineeringSubsystemReference>[];
  applicability: QualifiedAssertion<CalibrationApplicability>;
  sourceRepresentations: readonly QualifiedAssertion<CalibrationSourceReference>[];
  directionalBehaviours: readonly QualifiedAssertion<CalibrationBehaviour>[];
  relationships: readonly QualifiedAssertion<CalibrationRelationship>[];
  provenance: readonly KnowledgeProvenanceReference[];
  lifecycle: KnowledgeLifecycleReference;
  version: string;
}>;

function requireNonBlank(value: string, field: string): void {
  if (!value.trim()) {
    throw new Error(`${field} is required.`);
  }
}

function validateVocabulary(
  reference: GovernedVocabularyReference,
  field: string
): void {
  requireNonBlank(reference.vocabularyId, `${field} vocabulary identity`);
  requireNonBlank(reference.vocabularyVersion, `${field} vocabulary version`);
  requireNonBlank(reference.termId, `${field} term identity`);
  requireNonBlank(reference.label, `${field} label`);
}

function isValidIsoDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());

  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function validateLifecycle(
  lifecycle: KnowledgeLifecycleReference,
  field: string
): void {
  requireNonBlank(lifecycle.version, `${field} lifecycle version`);
}

function validateApplicability(
  applicability: CalibrationApplicability,
  field: string
): void {
  validateVocabulary(applicability.scope, `${field} applicability scope`);

  if (
    applicability.scope.recognition !== "known" &&
    !applicability.unresolvedReason?.trim()
  ) {
    throw new Error(
      `${field} requires an unresolved reason for unknown or unrecognized applicability.`
    );
  }
}

function validateEvidenceReference(
  evidence: KnowledgeEvidenceReference,
  field: string
): void {
  requireNonBlank(evidence.evidenceId, `${field} evidence identity`);
  requireNonBlank(evidence.sourceType, `${field} evidence source type`);
  requireNonBlank(
    evidence.sourceIdentifier,
    `${field} evidence source identifier`
  );
}

function validateProvenance(
  provenance: KnowledgeProvenanceReference,
  field: string
): void {
  requireNonBlank(provenance.sourceType, `${field} provenance source type`);
  requireNonBlank(
    provenance.sourceIdentifier,
    `${field} provenance source identifier`
  );
}

function validateAssertion<T>(
  assertion: QualifiedAssertion<T>,
  field: string
): void {
  requireNonBlank(assertion.assertionId, `${field} assertion identity`);
  requireNonBlank(assertion.version, `${field} assertion version`);
  validateLifecycle(assertion.lifecycle, field);
  validateApplicability(assertion.applicability, field);

  assertion.provenance.forEach((item) => validateProvenance(item, field));
  assertion.supportingEvidence.forEach((item) =>
    validateEvidenceReference(item, field)
  );
  assertion.contradictoryEvidence.forEach((item) =>
    validateEvidenceReference(item, field)
  );

  if (
    (assertion.value === null ||
      assertion.verificationStatus === "unknown" ||
      assertion.conflictState === "unresolved") &&
    !assertion.unresolvedReason?.trim()
  ) {
    throw new Error(`${field} requires an unresolved reason.`);
  }

  if (isAuthoritativeStockVariantStatus(assertion.verificationStatus)) {
    if (assertion.applicability.scope.recognition !== "known") {
      throw new Error(
        `${field} with unknown or unrecognized applicability vocabulary cannot be authoritative.`
      );
    }

    if (!assertion.authority) {
      throw new Error(`${field} requires an authority reference.`);
    }

    requireNonBlank(
      assertion.authority.authorityType,
      `${field} authority type`
    );
    requireNonBlank(
      assertion.authority.authorityIdentifier,
      `${field} authority identifier`
    );

    const hasInvalidValidationDate = assertion.provenance.some(
      (item) =>
        !!item.validationDate?.trim() && !isValidIsoDate(item.validationDate)
    );

    if (hasInvalidValidationDate) {
      throw new Error(`${field} has an invalid validation date.`);
    }

    const verifiedProvenance = assertion.provenance.find(
      (item) =>
        !!item.validationMethod?.trim() &&
        !!item.validationAuthority?.trim() &&
        !!item.validationDate?.trim()
    );

    if (!verifiedProvenance) {
      throw new Error(
        `${field} requires provenance with validation method, validation authority, and validation date.`
      );
    }

    if (assertion.supportingEvidence.length === 0) {
      throw new Error(`${field} requires supporting evidence.`);
    }
  }
}

function validateVocabularyQualification<T>(
  assertion: QualifiedAssertion<T>,
  references: readonly GovernedVocabularyReference[],
  field: string
): void {
  references.forEach((reference) => validateVocabulary(reference, field));

  if (
    references.some((reference) => reference.recognition !== "known") &&
    isAuthoritativeStockVariantStatus(assertion.verificationStatus)
  ) {
    throw new Error(
      `${field} with unknown or unrecognized vocabulary cannot be authoritative.`
    );
  }
}

function cloneAndFreeze<T>(value: T): T {
  if (Array.isArray(value)) {
    return Object.freeze(value.map((item) => cloneAndFreeze(item))) as T;
  }

  if (value !== null && typeof value === "object") {
    const clone: Record<PropertyKey, unknown> = {};

    for (const key of Reflect.ownKeys(value)) {
      clone[key] = cloneAndFreeze(
        (value as Record<PropertyKey, unknown>)[key]
      );
    }

    return Object.freeze(clone) as T;
  }

  return value;
}

export function defineCalibrationKnowledgeObject(
  input: CalibrationKnowledgeObject
): CalibrationKnowledgeObject {
  validateAssertion(input.identity, "Calibration identity");
  validateAssertion(input.canonicalName, "Canonical name");

  if (!input.identity.value) {
    throw new Error("Calibration identity value is required.");
  }

  requireNonBlank(input.identity.value.stableId, "Stable calibration identity");

  if (!input.canonicalName.value) {
    throw new Error("Canonical calibration name is required.");
  }

  requireNonBlank(input.canonicalName.value, "Canonical calibration name");
  requireNonBlank(input.version, "Calibration Knowledge version");
  validateLifecycle(input.lifecycle, "Calibration Knowledge");
  input.provenance.forEach((item) =>
    validateProvenance(item, "Calibration Knowledge")
  );

  validateAssertion(input.calibrationKind, "Calibration kind");
  validateAssertion(input.primarySubsystem, "Primary subsystem");
  validateAssertion(input.applicability, "Calibration applicability");

  if (input.calibrationKind.value) {
    validateVocabularyQualification(
      input.calibrationKind,
      [input.calibrationKind.value],
      "Calibration kind"
    );
  }
  if (input.primarySubsystem.value) {
    validateVocabularyQualification(
      input.primarySubsystem,
      [input.primarySubsystem.value],
      "Primary subsystem"
    );
  }

  if (input.applicability.value) {
    validateApplicability(
      input.applicability.value,
      "Calibration applicability value"
    );
    validateVocabularyQualification(
      input.applicability,
      [input.applicability.value.scope],
      "Calibration applicability"
    );
  }

  input.aliases.forEach((value) => {
    validateAssertion(value, "Alias");
    if (value.value) requireNonBlank(value.value.name, "Alias name");
  });
  input.purposes.forEach((value) => {
    validateAssertion(value, "Purpose");
    if (value.value) requireNonBlank(value.value.summary, "Purpose summary");
  });
  input.engineeringIntents.forEach((value) => {
    validateAssertion(value, "Engineering Intent");
    if (value.value) {
      requireNonBlank(value.value.summary, "Engineering Intent summary");
    }
    value.value?.engineeringObjectives.forEach((objective) => {
      requireNonBlank(objective.objectiveId, "Engineering Objective identity");
      requireNonBlank(objective.canonicalName, "Engineering Objective name");
      validateVocabulary(objective.vocabulary, "Engineering Objective");
    });
    value.value?.participatingSubsystems.forEach((subsystem) =>
      validateVocabulary(subsystem, "Engineering Intent subsystem")
    );
    if (value.value) {
      validateVocabularyQualification(
        value,
        [
          ...value.value.engineeringObjectives.map(
            (objective) => objective.vocabulary
          ),
          ...value.value.participatingSubsystems,
        ],
        "Engineering Intent"
      );
    }
  });
  input.relatedSubsystems.forEach((value) => {
    validateAssertion(value, "Related subsystem");
    if (value.value) {
      validateVocabularyQualification(
        value,
        [value.value],
        "Related subsystem"
      );
    }
  });
  input.sourceRepresentations.forEach((value) => {
    validateAssertion(value, "Source representation");
    if (value.value) {
      requireNonBlank(value.value.sourceReferenceId, "Source reference identity");
      requireNonBlank(value.value.sourceIdentifier, "Source identifier");
      validateVocabularyQualification(
        value,
        [value.value.sourceType],
        "Source type"
      );
    }
  });
  input.relationships.forEach((value) => {
    validateAssertion(value, "Calibration relationship");
    if (value.value) {
      requireNonBlank(value.value.relationshipId, "Relationship identity");
      requireNonBlank(value.value.sourceCalibrationId, "Relationship source");
      requireNonBlank(value.value.targetKnowledgeId, "Relationship target");
      requireNonBlank(value.value.meaning, "Relationship meaning");
      validateVocabularyQualification(
        value,
        [value.value.kind, value.value.direction],
        "Calibration relationship"
      );
    }
  });

  input.directionalBehaviours.forEach((assertion) => {
    validateAssertion(assertion, "Directional behaviour");
    if (!assertion.value) return;

    requireNonBlank(
      assertion.value.manipulatedQuantity,
      "Directional behaviour manipulated quantity"
    );
    requireNonBlank(
      assertion.value.expectedEffect,
      "Directional behaviour expected effect"
    );
    validateVocabularyQualification(
      assertion,
      [assertion.value.response, ...assertion.value.affectedSubsystems],
      "Directional behaviour"
    );
    assertion.value.boundaryConditions.forEach((value) => {
      validateAssertion(value, "Boundary condition");
      if (value.value) {
        requireNonBlank(value.value.conditionId, "Boundary condition identity");
        requireNonBlank(value.value.quantity, "Boundary condition quantity");
        requireNonBlank(
          value.value.valueDescription,
          "Boundary condition value description"
        );
        validateVocabularyQualification(
          value,
          [value.value.relationship],
          "Boundary condition relationship"
        );
      }
    });
    assertion.value.nonlinearCharacteristics.forEach((value) => {
      validateAssertion(value, "Nonlinear characteristic");
      if (value.value) {
        validateVocabularyQualification(
          value,
          [value.value],
          "Nonlinear characteristic"
        );
      }
    });
    assertion.value.potentialProtectiveResponses.forEach((value) => {
      validateAssertion(value, "Potential protective response");
      if (value.value) {
        requireNonBlank(
          value.value.responseId,
          "Protective response identity"
        );
        validateVocabularyQualification(
          value,
          [value.value.response, ...value.value.affectedSubsystems],
          "Potential protective response"
        );
      }
    });
  });

  return cloneAndFreeze(input);
}

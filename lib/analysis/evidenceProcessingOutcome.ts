import type { LoggerPlatform } from "../logging/types";

export const EVIDENCE_PROCESSING_STAGES = Object.freeze([
  "source_registration",
  "raw_source_storage",
  "source_classification",
  "translation",
  "evidence_derivation",
  "evidence_persistence",
] as const);

export type EvidenceProcessingStage =
  (typeof EVIDENCE_PROCESSING_STAGES)[number];

export const EVIDENCE_PROCESSING_OUTCOME_KINDS = Object.freeze([
  "evidence_established",
  "unsupported_source",
  "invalid_or_incomplete_source",
  "processing_failed",
  "persistence_failed",
] as const);

export type EvidenceProcessingOutcomeKind =
  (typeof EVIDENCE_PROCESSING_OUTCOME_KINDS)[number];

export const EVIDENCE_SOURCE_AVAILABILITIES = Object.freeze([
  "available",
  "unavailable",
  "unknown",
] as const);

export type EvidenceSourceAvailability =
  (typeof EVIDENCE_SOURCE_AVAILABILITIES)[number];

export const EVIDENCE_RETRY_DISPOSITIONS = Object.freeze([
  "not_required",
  "retryable_from_source",
  "not_retryable",
  "retryability_unknown",
] as const);

export type EvidenceRetryDisposition =
  (typeof EVIDENCE_RETRY_DISPOSITIONS)[number];

export const UNSUPPORTED_SOURCE_REASON_CODES = Object.freeze([
  "unknown_source_format",
  "translator_unavailable",
] as const);

export type UnsupportedSourceReasonCode =
  (typeof UNSUPPORTED_SOURCE_REASON_CODES)[number];

export const INVALID_OR_INCOMPLETE_SOURCE_REASON_CODES = Object.freeze([
  "no_usable_rows",
  "missing_required_core_channels",
  "invalid_source_observations",
  "insufficient_usable_evidence",
] as const);

export type InvalidOrIncompleteSourceReasonCode =
  (typeof INVALID_OR_INCOMPLETE_SOURCE_REASON_CODES)[number];

export const PROCESSING_FAILURE_REASON_CODES = Object.freeze([
  "source_registration_failure",
  "raw_source_storage_failure",
  "source_classification_failure",
  "translation_processing_failure",
  "evidence_derivation_failure",
] as const);

export type ProcessingFailureReasonCode =
  (typeof PROCESSING_FAILURE_REASON_CODES)[number];

export const PERSISTENCE_FAILURE_REASON_CODES = Object.freeze([
  "authoritative_evidence_write_failure",
] as const);

export type PersistenceFailureReasonCode =
  (typeof PERSISTENCE_FAILURE_REASON_CODES)[number];

export type AuthoritativeEvidenceReference = Readonly<{
  evidenceId: string;
  persistenceReference: string;
}>;

type EvidenceProcessingOutcomeBase = Readonly<{
  contractVersion: "1.0";
  sourceLogId: string | null;
  loggerPlatform: LoggerPlatform | null;
  sourceAvailability: EvidenceSourceAvailability;
}>;

export type EvidenceEstablishedOutcome = EvidenceProcessingOutcomeBase &
  Readonly<{
    kind: "evidence_established";
    stage: "evidence_persistence";
    evidenceAvailability: "authoritative";
    downstreamConsumption: "permitted";
    retryDisposition: "not_required";
    authoritativeEvidenceReference: AuthoritativeEvidenceReference;
  }>;

export type UnsupportedSourceOutcome = EvidenceProcessingOutcomeBase &
  Readonly<{
    kind: "unsupported_source";
    stage: "source_classification" | "translation";
    evidenceAvailability: "unavailable";
    downstreamConsumption: "blocked";
    retryDisposition: Exclude<EvidenceRetryDisposition, "not_required">;
    reasonCode: UnsupportedSourceReasonCode;
  }>;

export type InvalidOrIncompleteSourceOutcome =
  EvidenceProcessingOutcomeBase &
    Readonly<{
      kind: "invalid_or_incomplete_source";
      stage: "translation";
      evidenceAvailability: "unavailable";
      downstreamConsumption: "blocked";
      retryDisposition: Exclude<EvidenceRetryDisposition, "not_required">;
      reasonCode: InvalidOrIncompleteSourceReasonCode;
    }>;

export type ProcessingFailedOutcome = EvidenceProcessingOutcomeBase &
  Readonly<{
    kind: "processing_failed";
    stage: Exclude<EvidenceProcessingStage, "evidence_persistence">;
    evidenceAvailability: "unavailable";
    downstreamConsumption: "blocked";
    retryDisposition: Exclude<EvidenceRetryDisposition, "not_required">;
    reasonCode: ProcessingFailureReasonCode;
    diagnosticReference: string | null;
  }>;

export type PersistenceFailedOutcome = EvidenceProcessingOutcomeBase &
  Readonly<{
    kind: "persistence_failed";
    stage: "evidence_persistence";
    evidenceAvailability: "unavailable";
    downstreamConsumption: "blocked";
    retryDisposition: Exclude<EvidenceRetryDisposition, "not_required">;
    reasonCode: PersistenceFailureReasonCode;
    diagnosticReference: string | null;
  }>;

export type EvidenceProcessingOutcome =
  | EvidenceEstablishedOutcome
  | UnsupportedSourceOutcome
  | InvalidOrIncompleteSourceOutcome
  | ProcessingFailedOutcome
  | PersistenceFailedOutcome;

const stageSet = new Set<string>(EVIDENCE_PROCESSING_STAGES);
const outcomeKindSet = new Set<string>(EVIDENCE_PROCESSING_OUTCOME_KINDS);
const sourceAvailabilitySet = new Set<string>(EVIDENCE_SOURCE_AVAILABILITIES);
const retryDispositionSet = new Set<string>(EVIDENCE_RETRY_DISPOSITIONS);
const unsupportedReasonSet = new Set<string>(UNSUPPORTED_SOURCE_REASON_CODES);
const invalidReasonSet = new Set<string>(
  INVALID_OR_INCOMPLETE_SOURCE_REASON_CODES
);
const processingReasonSet = new Set<string>(PROCESSING_FAILURE_REASON_CODES);
const persistenceReasonSet = new Set<string>(PERSISTENCE_FAILURE_REASON_CODES);
const loggerPlatformSet = new Set<string>([
  "mhd",
  "bm3",
  "dimsport",
  "protool",
  "xhp",
  "unknown",
]);

const processingReasonStage: Readonly<
  Record<ProcessingFailureReasonCode, ProcessingFailedOutcome["stage"]>
> = Object.freeze({
  source_registration_failure: "source_registration",
  raw_source_storage_failure: "raw_source_storage",
  source_classification_failure: "source_classification",
  translation_processing_failure: "translation",
  evidence_derivation_failure: "evidence_derivation",
});

const commonKeys = Object.freeze([
  "contractVersion",
  "kind",
  "stage",
  "sourceLogId",
  "loggerPlatform",
  "sourceAvailability",
  "evidenceAvailability",
  "downstreamConsumption",
  "retryDisposition",
] as const);

function requireNonBlank(value: unknown, field: string): asserts value is string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${field} must be a non-blank string.`);
  }
}

function requireNullableNonBlank(value: unknown, field: string): void {
  if (value !== null) requireNonBlank(value, field);
}

function requireDiagnosticReference(value: unknown): void {
  if (value === null) return;
  requireNonBlank(value, "Diagnostic reference");
  if (!/^[a-z0-9][a-z0-9._:/-]*$/i.test(value)) {
    throw new Error(
      "Diagnostic reference must be a bounded identity, not diagnostic prose."
    );
  }
}

function requireMember(
  value: unknown,
  allowed: ReadonlySet<string>,
  field: string
): asserts value is string {
  if (typeof value !== "string" || !allowed.has(value)) {
    throw new Error(`${field} is invalid.`);
  }
}

function requireExactKeys(
  value: Readonly<Record<string, unknown>>,
  additionalKeys: readonly string[]
): void {
  const permitted = new Set<string>([...commonKeys, ...additionalKeys]);
  const unknownKeys = Object.keys(value).filter((key) => !permitted.has(key));
  if (unknownKeys.length > 0) {
    throw new Error(
      `Evidence processing outcome contains unsupported field ${unknownKeys[0]}.`
    );
  }
}

function deepCloneFreeze<T>(value: T): T {
  if (Array.isArray(value)) {
    return Object.freeze(value.map(deepCloneFreeze)) as T;
  }

  if (value !== null && typeof value === "object") {
    const clone: Record<PropertyKey, unknown> = {};
    for (const key of Reflect.ownKeys(value)) {
      clone[key] = deepCloneFreeze(
        (value as Readonly<Record<PropertyKey, unknown>>)[key]
      );
    }
    return Object.freeze(clone) as T;
  }

  return value;
}

function validateCommon(value: Readonly<Record<string, unknown>>): void {
  if (value.contractVersion !== "1.0") {
    throw new Error("Evidence processing contract version must be 1.0.");
  }
  requireMember(value.kind, outcomeKindSet, "Evidence processing outcome kind");
  requireMember(value.stage, stageSet, "Evidence processing stage");
  requireNullableNonBlank(value.sourceLogId, "Source log identity");
  requireNullableNonBlank(value.loggerPlatform, "Logger platform");
  if (value.loggerPlatform !== null) {
    requireMember(value.loggerPlatform, loggerPlatformSet, "Logger platform");
  }
  requireMember(
    value.sourceAvailability,
    sourceAvailabilitySet,
    "Source availability"
  );
  requireMember(value.retryDisposition, retryDispositionSet, "Retry disposition");

  if (
    value.sourceAvailability === "available" &&
    value.sourceLogId === null
  ) {
    throw new Error("Available source requires a source log identity.");
  }
  if (
    value.retryDisposition === "retryable_from_source" &&
    value.sourceAvailability !== "available"
  ) {
    throw new Error("Source retry requires an available raw source.");
  }
}

function validateEstablished(value: Readonly<Record<string, unknown>>): void {
  requireExactKeys(value, ["authoritativeEvidenceReference"]);
  if (
    value.stage !== "evidence_persistence" ||
    value.evidenceAvailability !== "authoritative" ||
    value.downstreamConsumption !== "permitted" ||
    value.retryDisposition !== "not_required"
  ) {
    throw new Error(
      "Established Evidence requires completed persistence, authoritative availability, permitted consumption and no retry."
    );
  }
  requireNonBlank(value.sourceLogId, "Established Evidence source log identity");
  if (
    value.authoritativeEvidenceReference === null ||
    typeof value.authoritativeEvidenceReference !== "object" ||
    Array.isArray(value.authoritativeEvidenceReference)
  ) {
    throw new Error("Established Evidence requires an authoritative reference.");
  }
  const reference = value.authoritativeEvidenceReference as Readonly<
    Record<string, unknown>
  >;
  const referenceKeys = Object.keys(reference).sort();
  if (
    referenceKeys.length !== 2 ||
    referenceKeys[0] !== "evidenceId" ||
    referenceKeys[1] !== "persistenceReference"
  ) {
    throw new Error("Authoritative Evidence reference contains invalid fields.");
  }
  requireNonBlank(reference.evidenceId, "Authoritative Evidence identity");
  requireNonBlank(
    reference.persistenceReference,
    "Authoritative Evidence persistence reference"
  );
}

function validateNonEstablishment(
  value: Readonly<Record<string, unknown>>
): void {
  if (
    value.evidenceAvailability !== "unavailable" ||
    value.downstreamConsumption !== "blocked" ||
    value.retryDisposition === "not_required"
  ) {
    throw new Error(
      "Non-established Evidence must be unavailable, block downstream consumption and declare retry disposition."
    );
  }
}

function validateUnsupported(value: Readonly<Record<string, unknown>>): void {
  requireExactKeys(value, ["reasonCode"]);
  validateNonEstablishment(value);
  if (value.stage !== "source_classification" && value.stage !== "translation") {
    throw new Error("Unsupported source stage is invalid.");
  }
  requireMember(
    value.reasonCode,
    unsupportedReasonSet,
    "Unsupported source reason code"
  );
}

function validateInvalidSource(value: Readonly<Record<string, unknown>>): void {
  requireExactKeys(value, ["reasonCode"]);
  validateNonEstablishment(value);
  if (value.stage !== "translation") {
    throw new Error("Invalid or incomplete source must terminate at translation.");
  }
  requireMember(
    value.reasonCode,
    invalidReasonSet,
    "Invalid or incomplete source reason code"
  );
}

function validateProcessingFailure(
  value: Readonly<Record<string, unknown>>
): void {
  requireExactKeys(value, ["reasonCode", "diagnosticReference"]);
  validateNonEstablishment(value);
  requireMember(
    value.reasonCode,
    processingReasonSet,
    "Processing failure reason code"
  );
  if (
    value.stage !==
    processingReasonStage[value.reasonCode as ProcessingFailureReasonCode]
  ) {
    throw new Error("Processing failure reason does not match its failed stage.");
  }
  requireDiagnosticReference(value.diagnosticReference);
}

function validatePersistenceFailure(
  value: Readonly<Record<string, unknown>>
): void {
  requireExactKeys(value, ["reasonCode", "diagnosticReference"]);
  validateNonEstablishment(value);
  if (value.stage !== "evidence_persistence") {
    throw new Error("Persistence failure must terminate at Evidence persistence.");
  }
  requireMember(
    value.reasonCode,
    persistenceReasonSet,
    "Persistence failure reason code"
  );
  requireDiagnosticReference(value.diagnosticReference);
}

export function defineEvidenceProcessingOutcome<T extends EvidenceProcessingOutcome>(
  input: T
): T {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Evidence processing outcome must be an object.");
  }

  const value = input as Readonly<Record<string, unknown>>;
  validateCommon(value);

  switch (value.kind) {
    case "evidence_established":
      validateEstablished(value);
      break;
    case "unsupported_source":
      validateUnsupported(value);
      break;
    case "invalid_or_incomplete_source":
      validateInvalidSource(value);
      break;
    case "processing_failed":
      validateProcessingFailure(value);
      break;
    case "persistence_failed":
      validatePersistenceFailure(value);
      break;
    default:
      throw new Error("Evidence processing outcome kind is invalid.");
  }

  const common = {
    contractVersion: input.contractVersion,
    kind: input.kind,
    stage: input.stage,
    sourceLogId: input.sourceLogId,
    loggerPlatform: input.loggerPlatform,
    sourceAvailability: input.sourceAvailability,
    evidenceAvailability: input.evidenceAvailability,
    downstreamConsumption: input.downstreamConsumption,
    retryDisposition: input.retryDisposition,
  };

  switch (input.kind) {
    case "evidence_established":
      return deepCloneFreeze({
        ...common,
        authoritativeEvidenceReference: {
          evidenceId: input.authoritativeEvidenceReference.evidenceId,
          persistenceReference:
            input.authoritativeEvidenceReference.persistenceReference,
        },
      }) as T;
    case "unsupported_source":
    case "invalid_or_incomplete_source":
      return deepCloneFreeze({
        ...common,
        reasonCode: input.reasonCode,
      }) as T;
    case "processing_failed":
    case "persistence_failed":
      return deepCloneFreeze({
        ...common,
        reasonCode: input.reasonCode,
        diagnosticReference: input.diagnosticReference,
      }) as T;
  }
}

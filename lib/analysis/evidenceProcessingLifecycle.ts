import {
  defineEvidenceProcessingOutcome,
  type EvidenceProcessingOutcome,
  type EvidenceProcessingOutcomeKind,
  type EvidenceProcessingStage,
  type EvidenceRetryDisposition,
  type EvidenceSourceAvailability,
  type InvalidOrIncompleteSourceReasonCode,
  type PersistenceFailureReasonCode,
  type ProcessingFailureReasonCode,
  type UnsupportedSourceReasonCode,
} from "./evidenceProcessingOutcome.ts";
import type { LoggerPlatform } from "../logging/types.ts";

export const EVIDENCE_LIFECYCLE_STATES = Object.freeze([
  "legacy_unclassified",
  "processing",
  "terminal",
] as const);

export type EvidenceLifecycleState =
  (typeof EVIDENCE_LIFECYCLE_STATES)[number];

export type PersistedEvidenceLifecycle = Readonly<{
  logId: string;
  rawSourceStoragePath: string | null;
  sourceAvailability: EvidenceSourceAvailability;
  lifecycleState: EvidenceLifecycleState;
  processingContractVersion: "1.0" | null;
  processingStage: EvidenceProcessingStage | null;
  processingOutcomeKind: EvidenceProcessingOutcomeKind | null;
  loggerPlatform: LoggerPlatform | null;
  processingReasonCode: string | null;
  retryDisposition: EvidenceRetryDisposition | null;
  diagnosticReference: string | null;
  processingStartedAt: string | null;
  processingCompletedAt: string | null;
  authoritativeLogSummaryId: string | null;
}>;

export type CurrentAuthoritativeEvidence = Readonly<{
  summaryId: string;
  evidenceId: string;
  persistenceReference: string;
}>;

export type DurableEvidenceProcessingLifecycle = Readonly<{
  persisted: PersistedEvidenceLifecycle;
  latestOutcome: EvidenceProcessingOutcome | null;
  currentAuthority: CurrentAuthoritativeEvidence | null;
}>;

const lifecycleStateSet = new Set<string>(EVIDENCE_LIFECYCLE_STATES);
const stageSet = new Set<string>([
  "source_registration",
  "raw_source_storage",
  "source_classification",
  "translation",
  "evidence_derivation",
  "evidence_persistence",
]);
const outcomeSet = new Set<string>([
  "evidence_established",
  "unsupported_source",
  "invalid_or_incomplete_source",
  "processing_failed",
  "persistence_failed",
]);
const sourceAvailabilitySet = new Set<string>([
  "available",
  "unavailable",
  "unknown",
]);
const retryDispositionSet = new Set<string>([
  "not_required",
  "retryable_from_source",
  "not_retryable",
  "retryability_unknown",
]);
const loggerPlatformSet = new Set<string>([
  "mhd",
  "bm3",
  "dimsport",
  "protool",
  "xhp",
  "unknown",
]);
const persistedKeys = Object.freeze([
  "logId",
  "rawSourceStoragePath",
  "sourceAvailability",
  "lifecycleState",
  "processingContractVersion",
  "processingStage",
  "processingOutcomeKind",
  "loggerPlatform",
  "processingReasonCode",
  "retryDisposition",
  "diagnosticReference",
  "processingStartedAt",
  "processingCompletedAt",
  "authoritativeLogSummaryId",
] as const);

function requireNonBlank(value: unknown, field: string): asserts value is string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${field} must be a non-blank string.`);
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

function requireNullableNonBlank(value: unknown, field: string): void {
  if (value !== null) requireNonBlank(value, field);
}

function requireTimestamp(value: unknown, field: string): asserts value is string {
  requireNonBlank(value, field);
  if (!Number.isFinite(Date.parse(value))) {
    throw new Error(`${field} must be an ISO-compatible timestamp.`);
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

function currentAuthority(
  summaryId: string | null
): CurrentAuthoritativeEvidence | null {
  if (summaryId === null) return null;
  requireNonBlank(summaryId, "Authoritative log summary identity");
  return {
    summaryId,
    evidenceId: `log-summary:${summaryId}`,
    persistenceReference: `log_summaries:${summaryId}`,
  };
}

function reconstructTerminalOutcome(
  value: PersistedEvidenceLifecycle,
  authority: CurrentAuthoritativeEvidence | null
): EvidenceProcessingOutcome {
  if (
    value.processingContractVersion !== "1.0" ||
    value.processingStage === null ||
    value.processingOutcomeKind === null ||
    value.retryDisposition === null ||
    value.processingStartedAt === null ||
    value.processingCompletedAt === null
  ) {
    throw new Error("Terminal lifecycle requires complete processing metadata.");
  }

  const common = {
    contractVersion: "1.0" as const,
    sourceLogId: value.logId,
    loggerPlatform: value.loggerPlatform,
    sourceAvailability: value.sourceAvailability,
  };

  switch (value.processingOutcomeKind) {
    case "evidence_established":
      if (authority === null) {
        throw new Error("Established Evidence requires current authority.");
      }
      if (
        value.processingStage !== "evidence_persistence" ||
        value.retryDisposition !== "not_required"
      ) {
        throw new Error(
          "Established Evidence requires persistence stage and no retry."
        );
      }
      return defineEvidenceProcessingOutcome({
        ...common,
        kind: "evidence_established",
        stage: "evidence_persistence",
        evidenceAvailability: "authoritative",
        downstreamConsumption: "permitted",
        retryDisposition: "not_required",
        authoritativeEvidenceReference: {
          evidenceId: authority.evidenceId,
          persistenceReference: authority.persistenceReference,
        },
      });
    case "unsupported_source":
      return defineEvidenceProcessingOutcome({
        ...common,
        kind: "unsupported_source",
        stage: value.processingStage as "source_classification" | "translation",
        evidenceAvailability: "unavailable",
        downstreamConsumption: "blocked",
        retryDisposition: value.retryDisposition as Exclude<
          EvidenceRetryDisposition,
          "not_required"
        >,
        reasonCode: value.processingReasonCode as UnsupportedSourceReasonCode,
      });
    case "invalid_or_incomplete_source":
      return defineEvidenceProcessingOutcome({
        ...common,
        kind: "invalid_or_incomplete_source",
        stage: value.processingStage as "translation",
        evidenceAvailability: "unavailable",
        downstreamConsumption: "blocked",
        retryDisposition: value.retryDisposition as Exclude<
          EvidenceRetryDisposition,
          "not_required"
        >,
        reasonCode:
          value.processingReasonCode as InvalidOrIncompleteSourceReasonCode,
      });
    case "processing_failed":
      return defineEvidenceProcessingOutcome({
        ...common,
        kind: "processing_failed",
        stage: value.processingStage as Exclude<
          EvidenceProcessingStage,
          "evidence_persistence"
        >,
        evidenceAvailability: "unavailable",
        downstreamConsumption: "blocked",
        retryDisposition: value.retryDisposition as Exclude<
          EvidenceRetryDisposition,
          "not_required"
        >,
        reasonCode: value.processingReasonCode as ProcessingFailureReasonCode,
        diagnosticReference: value.diagnosticReference,
      });
    case "persistence_failed":
      return defineEvidenceProcessingOutcome({
        ...common,
        kind: "persistence_failed",
        stage: value.processingStage as "evidence_persistence",
        evidenceAvailability: "unavailable",
        downstreamConsumption: "blocked",
        retryDisposition: value.retryDisposition as Exclude<
          EvidenceRetryDisposition,
          "not_required"
        >,
        reasonCode: value.processingReasonCode as PersistenceFailureReasonCode,
        diagnosticReference: value.diagnosticReference,
      });
  }
}

export function defineDurableEvidenceProcessingLifecycle(
  input: PersistedEvidenceLifecycle
): DurableEvidenceProcessingLifecycle {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Persisted Evidence lifecycle must be an object.");
  }

  const actualKeys = Object.keys(input).sort();
  const expectedKeys = [...persistedKeys].sort();
  if (
    actualKeys.length !== expectedKeys.length ||
    actualKeys.some((key, index) => key !== expectedKeys[index])
  ) {
    throw new Error("Persisted Evidence lifecycle fields are invalid.");
  }

  requireNonBlank(input.logId, "Evidence source log identity");
  requireNullableNonBlank(input.rawSourceStoragePath, "Raw source storage path");
  requireMember(
    input.sourceAvailability,
    sourceAvailabilitySet,
    "Evidence source availability"
  );
  requireMember(input.lifecycleState, lifecycleStateSet, "Evidence lifecycle state");
  requireNullableNonBlank(
    input.processingContractVersion,
    "Evidence processing contract version"
  );
  if (input.processingStage !== null) {
    requireMember(input.processingStage, stageSet, "Evidence processing stage");
  }
  if (input.processingOutcomeKind !== null) {
    requireMember(
      input.processingOutcomeKind,
      outcomeSet,
      "Evidence processing outcome kind"
    );
  }
  if (input.loggerPlatform !== null) {
    requireMember(input.loggerPlatform, loggerPlatformSet, "Logger platform");
  }
  if (input.retryDisposition !== null) {
    requireMember(
      input.retryDisposition,
      retryDispositionSet,
      "Evidence retry disposition"
    );
  }
  requireNullableNonBlank(input.processingReasonCode, "Processing reason code");
  requireNullableNonBlank(input.diagnosticReference, "Diagnostic reference");

  if (
    input.sourceAvailability === "available" &&
    input.rawSourceStoragePath === null
  ) {
    throw new Error("Available source requires a raw source storage path.");
  }

  const authority = currentAuthority(input.authoritativeLogSummaryId);
  let latestOutcome: EvidenceProcessingOutcome | null = null;

  if (input.lifecycleState === "legacy_unclassified") {
    if (
      input.sourceAvailability !== "unknown" ||
      input.processingContractVersion !== null ||
      input.processingStage !== null ||
      input.processingOutcomeKind !== null ||
      input.loggerPlatform !== null ||
      input.processingReasonCode !== null ||
      input.retryDisposition !== null ||
      input.diagnosticReference !== null ||
      input.processingStartedAt !== null ||
      input.processingCompletedAt !== null
    ) {
      throw new Error("Legacy lifecycle cannot fabricate modern processing metadata.");
    }
  } else if (input.lifecycleState === "processing") {
    if (
      input.processingContractVersion !== "1.0" ||
      input.processingStage === null ||
      input.processingOutcomeKind !== null ||
      input.processingReasonCode !== null ||
      input.retryDisposition !== null ||
      input.diagnosticReference !== null ||
      input.processingStartedAt === null ||
      input.processingCompletedAt !== null
    ) {
      throw new Error("Processing lifecycle shape is invalid.");
    }
    requireTimestamp(input.processingStartedAt, "Processing start time");
  } else {
    requireTimestamp(input.processingStartedAt, "Processing start time");
    requireTimestamp(input.processingCompletedAt, "Processing completion time");
    if (Date.parse(input.processingCompletedAt) < Date.parse(input.processingStartedAt)) {
      throw new Error("Processing completion cannot precede processing start.");
    }
    latestOutcome = reconstructTerminalOutcome(input, authority);
  }

  const persisted: PersistedEvidenceLifecycle = {
    logId: input.logId,
    rawSourceStoragePath: input.rawSourceStoragePath,
    sourceAvailability: input.sourceAvailability,
    lifecycleState: input.lifecycleState,
    processingContractVersion: input.processingContractVersion,
    processingStage: input.processingStage,
    processingOutcomeKind: input.processingOutcomeKind,
    loggerPlatform: input.loggerPlatform,
    processingReasonCode: input.processingReasonCode,
    retryDisposition: input.retryDisposition,
    diagnosticReference: input.diagnosticReference,
    processingStartedAt: input.processingStartedAt,
    processingCompletedAt: input.processingCompletedAt,
    authoritativeLogSummaryId: input.authoritativeLogSummaryId,
  };

  return deepCloneFreeze({
    persisted,
    latestOutcome,
    currentAuthority: authority,
  });
}

export function serializeDurableEvidenceProcessingLifecycle(
  input: PersistedEvidenceLifecycle
): string {
  return JSON.stringify(defineDurableEvidenceProcessingLifecycle(input));
}

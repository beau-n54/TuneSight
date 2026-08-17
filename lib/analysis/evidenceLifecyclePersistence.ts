import type { SupabaseClient } from "@supabase/supabase-js";
import type { LoggerPlatform } from "../logging/types.ts";
import type {
  EvidenceProcessingStage,
  EvidenceRetryDisposition,
  EvidenceSourceAvailability,
  InvalidOrIncompleteSourceOutcome,
  UnsupportedSourceOutcome,
} from "./evidenceProcessingOutcome.ts";

type LifecycleDatabaseResult = Readonly<{
  data: unknown;
  failed: boolean;
}>;

export type EvidenceLifecycleDatabase = Readonly<{
  record(input: Readonly<Record<string, unknown>>): Promise<LifecycleDatabaseResult>;
}>;

export type EvidenceLifecycleContext = Readonly<{
  logId: string;
  expectedUserId: string;
  processingStartedAt: string;
  rawSourceStoragePath: string | null;
  sourceAvailability: EvidenceSourceAvailability;
}>;

export class EvidenceLifecycleWriteError extends Error {
  readonly code = "evidence_lifecycle_write_failed";

  constructor() {
    super("Durable Evidence lifecycle recording failed.");
    this.name = "EvidenceLifecycleWriteError";
  }
}

function retryDisposition(
  availability: EvidenceSourceAvailability
): Exclude<EvidenceRetryDisposition, "not_required"> {
  if (availability === "available") return "retryable_from_source";
  if (availability === "unavailable") return "not_retryable";
  return "retryability_unknown";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function lifecycleRow(value: unknown): Record<string, unknown> | null {
  const row = Array.isArray(value) && value.length === 1 ? value[0] : value;
  return isRecord(row) ? row : null;
}

async function persistLifecycle(
  database: EvidenceLifecycleDatabase,
  context: EvidenceLifecycleContext,
  values: Readonly<Record<string, unknown>>,
  expectedLifecycleState: "processing" | "terminal",
  expectedOutcomeKind: string | null
): Promise<void> {
  let response: LifecycleDatabaseResult;
  try {
    response = await database.record({
      p_log_id: context.logId,
      p_expected_user_id: context.expectedUserId,
      p_contract_version: "1.0",
      p_source_availability: context.sourceAvailability,
      p_processing_started_at: context.processingStartedAt,
      p_raw_source_storage_path: context.rawSourceStoragePath,
      ...values,
    });
  } catch {
    throw new EvidenceLifecycleWriteError();
  }

  const row = lifecycleRow(response.data);
  if (
    response.failed ||
    row === null ||
    row.log_id !== context.logId ||
    row.lifecycle_state !== expectedLifecycleState ||
    row.outcome_kind !== expectedOutcomeKind ||
    (expectedLifecycleState === "terminal" &&
      (typeof row.completed_at !== "string" || row.completed_at.length === 0)) ||
    (expectedLifecycleState === "processing" && row.completed_at !== null)
  ) {
    throw new EvidenceLifecycleWriteError();
  }
}

export async function recordEvidenceProcessingStage(
  database: EvidenceLifecycleDatabase,
  context: EvidenceLifecycleContext,
  stage: EvidenceProcessingStage,
  loggerPlatform: LoggerPlatform | null
): Promise<void> {
  await persistLifecycle(
    database,
    context,
    {
      p_lifecycle_state: "processing",
      p_processing_stage: stage,
      p_outcome_kind: null,
      p_logger_platform: loggerPlatform,
      p_reason_code: null,
      p_retry_disposition: null,
      p_diagnostic_reference: null,
    },
    "processing",
    null
  );
}

export async function recordQualificationTerminal(
  database: EvidenceLifecycleDatabase,
  context: EvidenceLifecycleContext,
  outcome: UnsupportedSourceOutcome | InvalidOrIncompleteSourceOutcome,
  loggerPlatform: LoggerPlatform
): Promise<void> {
  await persistLifecycle(
    database,
    context,
    {
      p_lifecycle_state: "terminal",
      p_processing_stage: outcome.stage,
      p_outcome_kind: outcome.kind,
      p_logger_platform: loggerPlatform,
      p_reason_code: outcome.reasonCode,
      p_retry_disposition: outcome.retryDisposition,
      p_diagnostic_reference: null,
    },
    "terminal",
    outcome.kind
  );
}

const failureStageReason = Object.freeze({
  source_registration: "source_registration_failure",
  raw_source_storage: "raw_source_storage_failure",
  source_classification: "source_classification_failure",
  translation: "translation_processing_failure",
  evidence_derivation: "evidence_derivation_failure",
} as const);

export async function recordEvidenceProcessingFailure(
  database: EvidenceLifecycleDatabase,
  context: EvidenceLifecycleContext,
  stage: keyof typeof failureStageReason,
  loggerPlatform: LoggerPlatform | null,
  diagnosticReference: string | null = null
): Promise<void> {
  await persistLifecycle(
    database,
    context,
    {
      p_lifecycle_state: "terminal",
      p_processing_stage: stage,
      p_outcome_kind: "processing_failed",
      p_logger_platform: loggerPlatform,
      p_reason_code: failureStageReason[stage],
      p_retry_disposition: retryDisposition(context.sourceAvailability),
      p_diagnostic_reference: diagnosticReference,
    },
    "terminal",
    "processing_failed"
  );
}

export async function recordEvidencePersistenceFailure(
  database: EvidenceLifecycleDatabase,
  context: EvidenceLifecycleContext,
  loggerPlatform: LoggerPlatform,
  diagnosticReference: string | null = null
): Promise<void> {
  await persistLifecycle(
    database,
    context,
    {
      p_lifecycle_state: "terminal",
      p_processing_stage: "evidence_persistence",
      p_outcome_kind: "persistence_failed",
      p_logger_platform: loggerPlatform,
      p_reason_code: "authoritative_evidence_write_failure",
      p_retry_disposition: retryDisposition(context.sourceAvailability),
      p_diagnostic_reference: diagnosticReference,
    },
    "terminal",
    "persistence_failed"
  );
}

export function createSupabaseEvidenceLifecycleDatabase(
  client: SupabaseClient
): EvidenceLifecycleDatabase {
  return Object.freeze({
    async record(input) {
      const { data, error } = await client.rpc(
        "record_log_evidence_lifecycle_v1",
        input
      );
      return { data, failed: error !== null };
    },
  });
}

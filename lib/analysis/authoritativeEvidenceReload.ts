import {
  defineDurableEvidenceProcessingLifecycle,
  type DurableEvidenceProcessingLifecycle,
  type PersistedEvidenceLifecycle,
} from "./evidenceProcessingLifecycle.ts";

export type EvidenceReloadLogRow = Readonly<Record<string, unknown>>;
export type EvidenceReloadSummaryRow = Readonly<Record<string, unknown>>;

export type EvidenceReloadDatabase = Readonly<{
  loadLog: (logId: string) => Promise<unknown>;
  loadSummary: (summaryId: string) => Promise<unknown>;
}>;

export type AuthorityIntegrityReason =
  | "log_unavailable"
  | "log_identity_mismatch"
  | "log_ownership_mismatch"
  | "summary_unavailable"
  | "summary_identity_mismatch"
  | "summary_log_mismatch"
  | "summary_user_mismatch"
  | "summary_vehicle_mismatch"
  | "malformed_engine_v2";

export type CurrentAuthoritativeEvidenceState =
  | Readonly<{
      state: "absent";
      summaryId: null;
      summary: null;
      engineV2: null;
    }>
  | Readonly<{
      state: "available";
      summaryId: string;
      summary: EvidenceReloadSummaryRow;
      engineV2: Readonly<Record<string, unknown>>;
    }>
  | Readonly<{
      state: "integrity_failure";
      reason: AuthorityIntegrityReason;
      summaryId: string | null;
      summary: null;
      engineV2: null;
    }>;

export type EvidenceReloadState = Readonly<{
  logId: string;
  processingLifecycle: DurableEvidenceProcessingLifecycle | null;
  lifecycleIntegrityFailure: "invalid_lifecycle" | null;
  currentAuthority: CurrentAuthoritativeEvidenceState;
}>;

export type EvidenceReloadRequest = Readonly<{
  logId: string;
  expectedUserId: string;
  expectedVehicleId: string;
}>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function nonBlank(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function deepCloneFreeze<T>(value: T): T {
  if (Array.isArray(value)) {
    return Object.freeze(value.map(deepCloneFreeze)) as T;
  }
  if (isRecord(value)) {
    const clone: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      clone[key] = deepCloneFreeze(item);
    }
    return Object.freeze(clone) as T;
  }
  return value;
}

function integrityFailure(
  reason: AuthorityIntegrityReason,
  summaryId: string | null
): CurrentAuthoritativeEvidenceState {
  return Object.freeze({
    state: "integrity_failure" as const,
    reason,
    summaryId,
    summary: null,
    engineV2: null,
  });
}

function persistedLifecycle(
  log: Record<string, unknown>
): PersistedEvidenceLifecycle {
  return {
    logId: log.id as string,
    rawSourceStoragePath: log.raw_source_storage_path as string | null,
    sourceAvailability: log.evidence_source_availability as PersistedEvidenceLifecycle["sourceAvailability"],
    lifecycleState: log.evidence_lifecycle_state as PersistedEvidenceLifecycle["lifecycleState"],
    processingContractVersion: log.evidence_processing_contract_version as PersistedEvidenceLifecycle["processingContractVersion"],
    processingStage: log.evidence_processing_stage as PersistedEvidenceLifecycle["processingStage"],
    processingOutcomeKind: log.evidence_processing_outcome_kind as PersistedEvidenceLifecycle["processingOutcomeKind"],
    loggerPlatform: log.evidence_logger_platform as PersistedEvidenceLifecycle["loggerPlatform"],
    processingReasonCode: log.evidence_processing_reason_code as string | null,
    retryDisposition: log.evidence_retry_disposition as PersistedEvidenceLifecycle["retryDisposition"],
    diagnosticReference: log.evidence_diagnostic_reference as string | null,
    processingStartedAt: log.evidence_processing_started_at as string | null,
    processingCompletedAt: log.evidence_processing_completed_at as string | null,
    authoritativeLogSummaryId: log.authoritative_log_summary_id as string | null,
  };
}

function reconstructLifecycle(
  log: Record<string, unknown>
): Pick<EvidenceReloadState, "processingLifecycle" | "lifecycleIntegrityFailure"> {
  try {
    return {
      processingLifecycle: defineDurableEvidenceProcessingLifecycle(
        persistedLifecycle(log)
      ),
      lifecycleIntegrityFailure: null,
    };
  } catch {
    return {
      processingLifecycle: null,
      lifecycleIntegrityFailure: "invalid_lifecycle",
    };
  }
}

async function resolveAuthority(
  database: EvidenceReloadDatabase,
  log: Record<string, unknown>,
  request: EvidenceReloadRequest
): Promise<CurrentAuthoritativeEvidenceState> {
  const pointer = log.authoritative_log_summary_id;
  if (pointer === null) {
    return Object.freeze({
      state: "absent" as const,
      summaryId: null,
      summary: null,
      engineV2: null,
    });
  }
  if (!nonBlank(pointer)) {
    return integrityFailure("summary_identity_mismatch", null);
  }

  const candidate = await database.loadSummary(pointer);
  if (!isRecord(candidate)) {
    return integrityFailure("summary_unavailable", pointer);
  }
  if (candidate.id !== pointer) {
    return integrityFailure("summary_identity_mismatch", pointer);
  }
  if (candidate.log_id !== request.logId) {
    return integrityFailure("summary_log_mismatch", pointer);
  }
  if (candidate.user_id !== request.expectedUserId) {
    return integrityFailure("summary_user_mismatch", pointer);
  }
  if (candidate.vehicle_id !== request.expectedVehicleId) {
    return integrityFailure("summary_vehicle_mismatch", pointer);
  }
  if (!isRecord(candidate.summary) || !isRecord(candidate.summary.engine_v2)) {
    return integrityFailure("malformed_engine_v2", pointer);
  }
  const engineV2 = deepCloneFreeze(candidate.summary.engine_v2);

  const summary = deepCloneFreeze(candidate);
  return Object.freeze({
    state: "available" as const,
    summaryId: pointer,
    summary,
    engineV2,
  });
}

export async function loadEvidenceReloadState(
  database: EvidenceReloadDatabase,
  request: EvidenceReloadRequest
): Promise<EvidenceReloadState> {
  const rawLog = await database.loadLog(request.logId);
  if (!isRecord(rawLog)) {
    return Object.freeze({
      logId: request.logId,
      processingLifecycle: null,
      lifecycleIntegrityFailure: null,
      currentAuthority: integrityFailure("log_unavailable", null),
    });
  }
  if (rawLog.id !== request.logId) {
    return Object.freeze({
      logId: request.logId,
      processingLifecycle: null,
      lifecycleIntegrityFailure: null,
      currentAuthority: integrityFailure("log_identity_mismatch", null),
    });
  }
  if (
    rawLog.user_id !== request.expectedUserId ||
    rawLog.vehicle_id !== request.expectedVehicleId
  ) {
    return Object.freeze({
      logId: request.logId,
      processingLifecycle: null,
      lifecycleIntegrityFailure: null,
      currentAuthority: integrityFailure("log_ownership_mismatch", null),
    });
  }

  const lifecycle = reconstructLifecycle(rawLog);
  const currentAuthority = await resolveAuthority(database, rawLog, request);
  return deepCloneFreeze({
    logId: request.logId,
    ...lifecycle,
    currentAuthority,
  });
}

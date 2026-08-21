import type { LoggerPlatform } from "../logging/types.ts";
import type {
  EvidenceSourceAvailability,
} from "./evidenceProcessingOutcome.ts";
import {
  loadEvidenceReloadState,
  type AuthorityIntegrityReason,
  type EvidenceReloadDatabase,
  type EvidenceReloadRequest,
  type EvidenceReloadState,
} from "./authoritativeEvidenceReload.ts";

export const EVIDENCE_PROVENANCE_CLASSIFICATIONS = Object.freeze([
  "modern_known",
  "legacy_partial",
  "legacy_unknown",
] as const);

export type EvidenceProvenanceClassification =
  (typeof EVIDENCE_PROVENANCE_CLASSIFICATIONS)[number];

export type StoredEvidenceProvenanceV1 = Readonly<{
  provenanceContractVersion: "1.0";
  logId: string;
  vehicleId: string;
  userId: string;
  sourceAvailability: EvidenceSourceAvailability;
  rawSourceStoragePath: string | null;
  loggerPlatform: LoggerPlatform;
  processingContractVersion: "1.0";
  processingStartedAt: string;
}>;

export type MinimumEvidenceProvenance = Readonly<{
  provenanceContractVersion: "1.0";
  provenanceClassification: EvidenceProvenanceClassification;
  logId: string;
  authoritativeSummaryId: string;
  vehicleId: string;
  userId: string;
  sourceAvailability: EvidenceSourceAvailability;
  rawSourceStoragePath: string | null;
  loggerPlatform: LoggerPlatform | null;
  processingContractVersion: "1.0" | null;
  processingStartedAt: string | null;
  processingCompletedAt: string | null;
}>;

export type EvidenceProvenanceIntegrityReason =
  | AuthorityIntegrityReason
  | "invalid_lifecycle"
  | "authority_provenance_unavailable"
  | "provenance_shape_invalid"
  | "provenance_log_mismatch"
  | "provenance_user_mismatch"
  | "provenance_vehicle_mismatch"
  | "provenance_source_path_mismatch"
  | "provenance_lifecycle_mismatch";

export type EvidenceProvenanceState =
  | Readonly<{ state: "absent"; provenance: null }>
  | Readonly<{
      state: "available";
      provenance: MinimumEvidenceProvenance;
    }>
  | Readonly<{
      state: "integrity_failure";
      reason: EvidenceProvenanceIntegrityReason;
      provenance: null;
    }>;

export type EvidenceReloadWithProvenance = EvidenceReloadState &
  Readonly<{ evidenceProvenance: EvidenceProvenanceState }>;

const sourceAvailabilities = new Set<string>([
  "available",
  "unavailable",
  "unknown",
]);
const loggerPlatforms = new Set<string>([
  "mhd",
  "bm3",
  "dimsport",
  "protool",
  "xhp",
  "unknown",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function nonBlank(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function timestamp(value: unknown): value is string {
  return nonBlank(value) && Number.isFinite(Date.parse(value));
}

function freeze<T extends object>(value: T): Readonly<T> {
  return Object.freeze({ ...value });
}

function failure(
  reason: EvidenceProvenanceIntegrityReason
): EvidenceProvenanceState {
  return freeze({ state: "integrity_failure" as const, reason, provenance: null });
}

function validSource(
  availability: EvidenceSourceAvailability,
  path: string | null
): boolean {
  return availability !== "available" || nonBlank(path);
}

export function defineStoredEvidenceProvenanceV1(
  input: StoredEvidenceProvenanceV1
): StoredEvidenceProvenanceV1 {
  const expectedKeys = [
    "provenanceContractVersion",
    "logId",
    "vehicleId",
    "userId",
    "sourceAvailability",
    "rawSourceStoragePath",
    "loggerPlatform",
    "processingContractVersion",
    "processingStartedAt",
  ].sort();
  const actualKeys = Object.keys(input).sort();
  if (
    actualKeys.length !== expectedKeys.length ||
    actualKeys.some((key, index) => key !== expectedKeys[index]) ||
    input.provenanceContractVersion !== "1.0" ||
    !nonBlank(input.logId) ||
    !nonBlank(input.vehicleId) ||
    !nonBlank(input.userId) ||
    !sourceAvailabilities.has(input.sourceAvailability) ||
    (input.rawSourceStoragePath !== null &&
      !nonBlank(input.rawSourceStoragePath)) ||
    !loggerPlatforms.has(input.loggerPlatform) ||
    input.processingContractVersion !== "1.0" ||
    !timestamp(input.processingStartedAt) ||
    !validSource(input.sourceAvailability, input.rawSourceStoragePath)
  ) {
    throw new Error("Stored Evidence provenance is invalid.");
  }
  return freeze(input) as StoredEvidenceProvenanceV1;
}

function readStoredProvenance(
  engineV2: Readonly<Record<string, unknown>>
): StoredEvidenceProvenanceV1 | null | "invalid" {
  const value = engineV2.evidenceProvenance;
  if (value === undefined) return null;
  if (!isRecord(value)) return "invalid";
  try {
    return defineStoredEvidenceProvenanceV1(
      value as StoredEvidenceProvenanceV1
    );
  } catch {
    return "invalid";
  }
}

function available(
  provenance: MinimumEvidenceProvenance
): EvidenceProvenanceState {
  return freeze({
    state: "available" as const,
    provenance: freeze(provenance) as MinimumEvidenceProvenance,
  });
}

function legacyProvenance(
  reload: EvidenceReloadState
): EvidenceProvenanceState {
  if (
    reload.currentAuthority.state !== "available" ||
    reload.processingLifecycle === null
  ) {
    return failure("authority_provenance_unavailable");
  }
  const persisted = reload.processingLifecycle.persisted;
  const summary = reload.currentAuthority.summary;
  return available({
    provenanceContractVersion: "1.0",
    provenanceClassification: nonBlank(persisted.rawSourceStoragePath)
      ? "legacy_partial"
      : "legacy_unknown",
    logId: persisted.logId,
    authoritativeSummaryId: reload.currentAuthority.summaryId,
    vehicleId: summary.vehicle_id as string,
    userId: summary.user_id as string,
    sourceAvailability: persisted.sourceAvailability,
    rawSourceStoragePath: persisted.rawSourceStoragePath,
    loggerPlatform: null,
    processingContractVersion: null,
    processingStartedAt: null,
    processingCompletedAt: null,
  });
}

function modernProvenance(
  reload: EvidenceReloadState,
  stored: StoredEvidenceProvenanceV1
): EvidenceProvenanceState {
  if (reload.currentAuthority.state !== "available") {
    return failure("authority_provenance_unavailable");
  }
  const summary = reload.currentAuthority.summary;
  if (stored.logId !== reload.logId) return failure("provenance_log_mismatch");
  if (stored.userId !== summary.user_id) return failure("provenance_user_mismatch");
  if (stored.vehicleId !== summary.vehicle_id) {
    return failure("provenance_vehicle_mismatch");
  }
  if (!validSource(stored.sourceAvailability, stored.rawSourceStoragePath)) {
    return failure("provenance_source_path_mismatch");
  }

  const lifecycle = reload.processingLifecycle;
  const currentEstablishment =
    lifecycle?.latestOutcome?.kind === "evidence_established" &&
    lifecycle.persisted.authoritativeLogSummaryId ===
      reload.currentAuthority.summaryId;
  if (
    currentEstablishment &&
    (lifecycle.persisted.processingContractVersion !==
      stored.processingContractVersion ||
      lifecycle.persisted.loggerPlatform !== stored.loggerPlatform ||
      lifecycle.persisted.sourceAvailability !== stored.sourceAvailability ||
      lifecycle.persisted.rawSourceStoragePath !== stored.rawSourceStoragePath ||
      lifecycle.persisted.processingStartedAt !== stored.processingStartedAt)
  ) {
    return failure("provenance_lifecycle_mismatch");
  }

  return available({
    provenanceContractVersion: "1.0",
    provenanceClassification: "modern_known",
    logId: stored.logId,
    authoritativeSummaryId: reload.currentAuthority.summaryId,
    vehicleId: stored.vehicleId,
    userId: stored.userId,
    sourceAvailability: stored.sourceAvailability,
    rawSourceStoragePath: stored.rawSourceStoragePath,
    loggerPlatform: stored.loggerPlatform,
    processingContractVersion: stored.processingContractVersion,
    processingStartedAt: stored.processingStartedAt,
    processingCompletedAt: currentEstablishment
      ? lifecycle.persisted.processingCompletedAt
      : null,
  });
}

export function deriveMinimumEvidenceProvenance(
  reload: EvidenceReloadState
): EvidenceProvenanceState {
  if (reload.currentAuthority.state === "absent") {
    return freeze({ state: "absent" as const, provenance: null });
  }
  if (reload.currentAuthority.state === "integrity_failure") {
    return failure(reload.currentAuthority.reason);
  }
  if (reload.lifecycleIntegrityFailure !== null || reload.processingLifecycle === null) {
    return failure("invalid_lifecycle");
  }

  const stored = readStoredProvenance(reload.currentAuthority.engineV2);
  if (stored === "invalid") return failure("provenance_shape_invalid");
  if (stored !== null) return modernProvenance(reload, stored);
  if (
    reload.processingLifecycle.persisted.lifecycleState ===
    "legacy_unclassified"
  ) {
    return legacyProvenance(reload);
  }
  return failure("authority_provenance_unavailable");
}

export async function loadEvidenceReloadWithProvenance(
  database: EvidenceReloadDatabase,
  request: EvidenceReloadRequest
): Promise<EvidenceReloadWithProvenance> {
  const reload = await loadEvidenceReloadState(database, request);
  return freeze({
    ...reload,
    evidenceProvenance: deriveMinimumEvidenceProvenance(reload),
  }) as EvidenceReloadWithProvenance;
}

export function serializeMinimumEvidenceProvenance(
  provenance: MinimumEvidenceProvenance
): string {
  return JSON.stringify(provenance);
}

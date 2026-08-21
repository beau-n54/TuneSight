import type { SupabaseClient } from "@supabase/supabase-js";
import type { LoggerPlatform } from "../logging/types.ts";
import type { EvidenceSourceAvailability } from "./evidenceProcessingOutcome.ts";
import {
  defineStoredEvidenceProvenanceV1,
  type StoredEvidenceProvenanceV1,
} from "./evidenceProvenance.ts";

export const EVIDENCE_PROMOTION_RESOLUTIONS = Object.freeze([
  "confirmed_established",
  "confirmed_not_established",
  "reconciliation_required",
] as const);

export type EvidencePromotionResolution =
  (typeof EVIDENCE_PROMOTION_RESOLUTIONS)[number];

export type EvidencePromotionFinding =
  | "candidate_insert_failed"
  | "candidate_verification_failed"
  | "authority_snapshot_failed"
  | "promotion_response_reconciled"
  | "promotion_not_established"
  | "authority_integrity_discrepancy"
  | "authority_reconciliation_failed";

export type EvidencePromotionOperationResult = Readonly<{
  logId: string;
  candidateSummaryId: string | null;
  previousAuthorityKnown: boolean;
  previousAuthorityId: string | null;
  resolution: EvidencePromotionResolution;
  currentAuthorityKnown: boolean;
  currentAuthorityId: string | null;
  reconciliationPerformed: boolean;
  finding: EvidencePromotionFinding | null;
  completedAt: string | null;
}>;

export type CandidateEvidenceSummaryInput = Readonly<{
  logId: string;
  vehicleId: string;
  userId: string;
  summaryPayload: Readonly<Record<string, unknown>>;
  processingContractVersion: "1.0";
  loggerPlatform: LoggerPlatform;
  sourceAvailability: EvidenceSourceAvailability;
  rawSourceStoragePath: string | null;
  processingStartedAt: string;
}>;

type CandidateSummaryRow = Readonly<{
  id: string;
  log_id: string;
  vehicle_id: string;
  user_id: string;
  summary: unknown;
}>;

type PromotionRow = Readonly<{
  log_id: string;
  previous_authoritative_log_summary_id: string | null;
  authoritative_log_summary_id: string;
  outcome_kind: string;
  completed_at: string;
}>;

type DatabaseResult<T> = Readonly<{
  data: T | null;
  failed: boolean;
}>;

export type EvidencePersistenceDatabase = Readonly<{
  insertCandidate(
    row: Readonly<Record<string, unknown>>
  ): Promise<DatabaseResult<unknown>>;
  readCandidate(candidateId: string): Promise<DatabaseResult<unknown>>;
  readAuthority(logId: string): Promise<DatabaseResult<unknown>>;
  promoteCandidate(
    input: Readonly<Record<string, unknown>>
  ): Promise<DatabaseResult<unknown>>;
}>;

function result(
  value: EvidencePromotionOperationResult
): EvidencePromotionOperationResult {
  return Object.freeze({ ...value });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isCandidateRow(value: unknown): value is CandidateSummaryRow {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.log_id === "string" &&
    typeof value.user_id === "string" &&
    typeof value.vehicle_id === "string" &&
    isRecord(value.summary) &&
    isRecord(value.summary.engine_v2)
  );
}

function candidateProvenance(
  input: CandidateEvidenceSummaryInput
): StoredEvidenceProvenanceV1 {
  return defineStoredEvidenceProvenanceV1({
    provenanceContractVersion: "1.0",
    logId: input.logId,
    vehicleId: input.vehicleId,
    userId: input.userId,
    sourceAvailability: input.sourceAvailability,
    rawSourceStoragePath: input.rawSourceStoragePath,
    loggerPlatform: input.loggerPlatform,
    processingContractVersion: input.processingContractVersion,
    processingStartedAt: input.processingStartedAt,
  });
}

function candidatePayload(
  input: CandidateEvidenceSummaryInput,
  provenance: StoredEvidenceProvenanceV1
): Readonly<Record<string, unknown>> {
  if (
    !isRecord(input.summaryPayload.summary) ||
    !isRecord(input.summaryPayload.summary.engine_v2)
  ) {
    throw new Error("Candidate Evidence payload requires engine_v2.");
  }
  return {
    ...input.summaryPayload,
    summary: {
      ...input.summaryPayload.summary,
      engine_v2: {
        ...input.summaryPayload.summary.engine_v2,
        evidenceProvenance: provenance,
      },
    },
    log_id: input.logId,
    vehicle_id: input.vehicleId,
    user_id: input.userId,
  };
}

function verifiedProvenanceMatches(
  row: CandidateSummaryRow,
  expected: StoredEvidenceProvenanceV1
): boolean {
  if (!isRecord(row.summary) || !isRecord(row.summary.engine_v2)) return false;
  const actual = row.summary.engine_v2.evidenceProvenance;
  if (!isRecord(actual)) return false;
  try {
    const validated = defineStoredEvidenceProvenanceV1(
      actual as StoredEvidenceProvenanceV1
    );
    return (
      validated.provenanceContractVersion === expected.provenanceContractVersion &&
      validated.logId === expected.logId &&
      validated.vehicleId === expected.vehicleId &&
      validated.userId === expected.userId &&
      validated.sourceAvailability === expected.sourceAvailability &&
      validated.rawSourceStoragePath === expected.rawSourceStoragePath &&
      validated.loggerPlatform === expected.loggerPlatform &&
      validated.processingContractVersion === expected.processingContractVersion &&
      validated.processingStartedAt === expected.processingStartedAt
    );
  } catch {
    return false;
  }
}

function readAuthorityId(value: unknown): {
  valid: boolean;
  authorityId: string | null;
} {
  if (!isRecord(value)) return { valid: false, authorityId: null };
  const authorityId = value.authoritative_log_summary_id;
  if (authorityId !== null && typeof authorityId !== "string") {
    return { valid: false, authorityId: null };
  }
  return { valid: true, authorityId };
}

function promotionRow(value: unknown): PromotionRow | null {
  const row = Array.isArray(value) && value.length === 1 ? value[0] : value;
  if (!isRecord(row)) return null;
  if (
    typeof row.log_id !== "string" ||
    (row.previous_authoritative_log_summary_id !== null &&
      typeof row.previous_authoritative_log_summary_id !== "string") ||
    typeof row.authoritative_log_summary_id !== "string" ||
    typeof row.outcome_kind !== "string" ||
    typeof row.completed_at !== "string" ||
    row.completed_at.length === 0
  ) {
    return null;
  }
  return row as PromotionRow;
}

function notEstablished(
  input: CandidateEvidenceSummaryInput,
  candidateSummaryId: string | null,
  finding: EvidencePromotionFinding,
  previousAuthorityKnown = false,
  previousAuthorityId: string | null = null,
  reconciliationPerformed = false
): EvidencePromotionOperationResult {
  return result({
    logId: input.logId,
    candidateSummaryId,
    previousAuthorityKnown,
    previousAuthorityId,
    resolution: "confirmed_not_established",
    currentAuthorityKnown: previousAuthorityKnown,
    currentAuthorityId: previousAuthorityId,
    reconciliationPerformed,
    finding,
    completedAt: null,
  });
}

async function reconcileAuthority(
  database: EvidencePersistenceDatabase,
  input: CandidateEvidenceSummaryInput,
  candidateSummaryId: string,
  previousAuthorityId: string | null
): Promise<EvidencePromotionOperationResult> {
  let authorityRead: DatabaseResult<unknown>;
  try {
    authorityRead = await database.readAuthority(input.logId);
  } catch {
    authorityRead = { data: null, failed: true };
  }

  const current = readAuthorityId(authorityRead.data);
  if (authorityRead.failed || !current.valid) {
    return result({
      logId: input.logId,
      candidateSummaryId,
      previousAuthorityKnown: true,
      previousAuthorityId,
      resolution: "reconciliation_required",
      currentAuthorityKnown: false,
      currentAuthorityId: null,
      reconciliationPerformed: true,
      finding: "authority_reconciliation_failed",
      completedAt: null,
    });
  }

  if (current.authorityId === candidateSummaryId) {
    return result({
      logId: input.logId,
      candidateSummaryId,
      previousAuthorityKnown: true,
      previousAuthorityId,
      resolution: "confirmed_established",
      currentAuthorityKnown: true,
      currentAuthorityId: candidateSummaryId,
      reconciliationPerformed: true,
      finding: "promotion_response_reconciled",
      completedAt: null,
    });
  }

  if (current.authorityId === previousAuthorityId) {
    return notEstablished(
      input,
      candidateSummaryId,
      "promotion_not_established",
      true,
      previousAuthorityId,
      true
    );
  }

  return result({
    logId: input.logId,
    candidateSummaryId,
    previousAuthorityKnown: true,
    previousAuthorityId,
    resolution: "reconciliation_required",
    currentAuthorityKnown: true,
    currentAuthorityId: current.authorityId,
    reconciliationPerformed: true,
    finding: "authority_integrity_discrepancy",
    completedAt: null,
  });
}

export async function persistCandidateEvidenceSummary(
  database: EvidencePersistenceDatabase,
  input: CandidateEvidenceSummaryInput
): Promise<EvidencePromotionOperationResult> {
  let inserted: DatabaseResult<unknown>;
  let provenance: StoredEvidenceProvenanceV1 | null = null;
  try {
    provenance = candidateProvenance(input);
    inserted = await database.insertCandidate(candidatePayload(input, provenance));
  } catch {
    inserted = { data: null, failed: true };
  }

  if (
    provenance === null ||
    inserted.failed ||
    !isRecord(inserted.data) ||
    typeof inserted.data.id !== "string"
  ) {
    return notEstablished(input, null, "candidate_insert_failed");
  }
  const candidateSummaryId = inserted.data.id;

  let verified: DatabaseResult<unknown>;
  try {
    verified = await database.readCandidate(candidateSummaryId);
  } catch {
    verified = { data: null, failed: true };
  }
  if (
    verified.failed ||
    !isCandidateRow(verified.data) ||
    verified.data.id !== candidateSummaryId ||
    verified.data.log_id !== input.logId ||
    verified.data.user_id !== input.userId ||
    verified.data.vehicle_id !== input.vehicleId ||
    !verifiedProvenanceMatches(verified.data, provenance)
  ) {
    return notEstablished(
      input,
      candidateSummaryId,
      "candidate_verification_failed"
    );
  }

  let previousRead: DatabaseResult<unknown>;
  try {
    previousRead = await database.readAuthority(input.logId);
  } catch {
    previousRead = { data: null, failed: true };
  }
  const previous = readAuthorityId(previousRead.data);
  if (previousRead.failed || !previous.valid) {
    return notEstablished(
      input,
      candidateSummaryId,
      "authority_snapshot_failed"
    );
  }

  let promotion: DatabaseResult<unknown>;
  try {
    promotion = await database.promoteCandidate({
      p_log_id: input.logId,
      p_candidate_summary_id: candidateSummaryId,
      p_expected_user_id: input.userId,
      p_contract_version: input.processingContractVersion,
      p_logger_platform: input.loggerPlatform,
      p_source_availability: input.sourceAvailability,
      p_processing_started_at: input.processingStartedAt,
    });
  } catch {
    promotion = { data: null, failed: true };
  }

  const promoted = promotionRow(promotion.data);
  if (
    !promotion.failed &&
    promoted !== null &&
    promoted.log_id === input.logId &&
    promoted.previous_authoritative_log_summary_id === previous.authorityId &&
    promoted.authoritative_log_summary_id === candidateSummaryId &&
    promoted.outcome_kind === "evidence_established"
  ) {
    return result({
      logId: input.logId,
      candidateSummaryId,
      previousAuthorityKnown: true,
      previousAuthorityId: previous.authorityId,
      resolution: "confirmed_established",
      currentAuthorityKnown: true,
      currentAuthorityId: candidateSummaryId,
      reconciliationPerformed: false,
      finding: null,
      completedAt: promoted.completed_at,
    });
  }

  return reconcileAuthority(
    database,
    input,
    candidateSummaryId,
    previous.authorityId
  );
}

export function createSupabaseEvidencePersistenceDatabase(
  client: SupabaseClient
): EvidencePersistenceDatabase {
  return Object.freeze({
    async insertCandidate(row) {
      const { data, error } = await client
        .from("log_summaries")
        .insert(row)
        .select("id")
        .single();
      return { data, failed: error !== null };
    },
    async readCandidate(candidateId) {
      const { data, error } = await client
        .from("log_summaries")
        .select("id, log_id, user_id, vehicle_id, summary")
        .eq("id", candidateId)
        .single();
      return { data, failed: error !== null };
    },
    async readAuthority(logId) {
      const { data, error } = await client
        .from("logs")
        .select("authoritative_log_summary_id")
        .eq("id", logId)
        .single();
      return { data, failed: error !== null };
    },
    async promoteCandidate(input) {
      const { data, error } = await client.rpc(
        "establish_log_summary_authority_v1",
        input
      );
      return { data, failed: error !== null };
    },
  });
}

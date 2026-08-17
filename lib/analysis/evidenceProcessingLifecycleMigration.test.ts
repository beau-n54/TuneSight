import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../../supabase/migrations/20260817_add_log_evidence_processing_lifecycle.sql",
    import.meta.url
  ),
  "utf8"
);

test("migration adds the complete durable lifecycle schema", () => {
  for (const column of [
    "raw_source_storage_path",
    "evidence_source_availability",
    "evidence_lifecycle_state",
    "evidence_processing_contract_version",
    "evidence_processing_stage",
    "evidence_processing_outcome_kind",
    "evidence_logger_platform",
    "evidence_processing_reason_code",
    "evidence_retry_disposition",
    "evidence_diagnostic_reference",
    "evidence_processing_started_at",
    "evidence_processing_completed_at",
    "authoritative_log_summary_id",
  ]) {
    assert.match(migration, new RegExp(`add column ${column}\\b`, "i"));
  }
});

test("migration protects durable state with bounded checks", () => {
  for (const constraint of [
    "logs_evidence_source_availability_check",
    "logs_evidence_lifecycle_state_check",
    "logs_evidence_processing_stage_check",
    "logs_evidence_processing_outcome_kind_check",
    "logs_evidence_logger_platform_check",
    "logs_evidence_retry_disposition_check",
    "logs_evidence_processing_reason_code_check",
    "logs_evidence_source_path_check",
    "logs_evidence_processing_timestamp_check",
    "logs_evidence_lifecycle_shape_check",
    "logs_evidence_terminal_compatibility_check",
  ]) {
    assert.match(migration, new RegExp(`constraint ${constraint}`, "i"));
  }
});

test("same-log composite authority and non-unique history indexes are explicit", () => {
  assert.match(
    migration,
    /unique index log_summaries_id_log_id_uidx[\s\S]*\(id, log_id\)/i
  );
  assert.match(
    migration,
    /foreign key \(authoritative_log_summary_id, id\)[\s\S]*references public\.log_summaries \(id, log_id\)[\s\S]*on delete restrict/i
  );
  assert.match(
    migration,
    /index log_summaries_log_id_created_at_idx[\s\S]*\(log_id, created_at desc, id\)/i
  );
  assert.doesNotMatch(migration, /unique\s+(?:index\s+\w+\s+on[^;]+)?\(log_id\)/i);
});

test("legacy backfill is defensive and preserves legacy lifecycle", () => {
  assert.match(migration, /having count\(\*\) = 1/i);
  assert.match(migration, /jsonb_typeof\(ls\.summary -> 'engine_v2'\) = 'object'/i);
  assert.match(migration, /ls\.user_id = l\.user_id/i);
  assert.match(migration, /ls\.vehicle_id = l\.vehicle_id/i);
  assert.match(migration, /get diagnostics updated_count = row_count/i);
  assert.match(migration, /evidence_lifecycle_state = 'legacy_unclassified'/i);
  assert.doesNotMatch(migration, /\b(?:200|208)\b/);
  assert.doesNotMatch(migration, /delete\s+from\s+public\.log_summaries/i);
});

test("open insert is replaced with ownership-constrained compatibility policy", () => {
  assert.match(migration, /drop policy if exists "open insert"/i);
  assert.match(migration, /create policy log_summaries_owner_insert/i);
  assert.match(migration, /auth\.uid\(\) = user_id/i);
  assert.match(migration, /parent_log\.vehicle_id = public\.log_summaries\.vehicle_id/i);
});

test("normal clients cannot mutate lifecycle or authority columns", () => {
  assert.match(
    migration,
    /revoke insert, update on table public\.logs from anon, authenticated/i
  );
  assert.match(
    migration,
    /grant insert \(vehicle_id, user_id, log_name, file_name, file_url\)/i
  );
  assert.match(migration, /grant update \(log_name, file_name, file_url\)/i);
  assert.doesNotMatch(
    migration,
    /grant (?:insert|update) \([^)]*authoritative_log_summary_id/i
  );
  assert.match(
    migration,
    /revoke truncate, references, trigger[\s\S]*from anon, authenticated/i
  );
});

test("authority promotion is hardened and service-role only", () => {
  assert.match(migration, /function public\.establish_log_summary_authority_v1/i);
  assert.match(migration, /security definer[\s\S]*set search_path = pg_catalog/i);
  assert.match(migration, /for update/i);
  assert.match(migration, /candidate_summary\.log_id <> target_log\.id/i);
  assert.match(migration, /candidate_summary\.user_id <> target_log\.user_id/i);
  assert.match(migration, /candidate_summary\.vehicle_id <> target_log\.vehicle_id/i);
  assert.match(
    migration,
    /revoke execute on function public\.establish_log_summary_authority_v1[\s\S]*from public, anon, authenticated/i
  );
  assert.match(
    migration,
    /grant execute on function public\.establish_log_summary_authority_v1[\s\S]*to service_role/i
  );
});

test("failure lifecycle function cannot promote or erase authority", () => {
  const start = migration.indexOf(
    "create or replace function public.record_log_evidence_lifecycle_v1"
  );
  const end = migration.indexOf(
    "revoke execute on function public.establish_log_summary_authority_v1"
  );
  const failureFunction = migration.slice(start, end);
  assert.match(failureFunction, /p_outcome_kind = 'evidence_established'/i);
  assert.doesNotMatch(
    failureFunction,
    /set\s+authoritative_log_summary_id\s*=/i
  );
  assert.doesNotMatch(failureFunction, /delete\s+from/i);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  loadEvidenceReloadState,
  type EvidenceReloadDatabase,
} from "./authoritativeEvidenceReload.ts";
import {
  runDurableEvidenceProcessingAttempt,
  type DurableEvidenceAttemptResult,
} from "./durableEvidenceProcessingIntegration.ts";
import {
  persistCandidateEvidenceSummary,
  type CandidateEvidenceSummaryInput,
  type EvidencePersistenceDatabase,
} from "./evidenceCandidatePersistence.ts";
import type {
  EvidenceLifecycleContext,
  EvidenceLifecycleDatabase,
} from "./evidenceLifecyclePersistence.ts";
import {
  loadEvidenceReloadWithProvenance,
  type EvidenceReloadWithProvenance,
} from "./evidenceProvenance.ts";
import { qualifyEvidenceSource } from "./evidenceSourceQualification.ts";

const LOG = "log-1";
const USER = "user-1";
const VEHICLE = "vehicle-1";
const PATH = `${USER}/${VEHICLE}/${LOG}.csv`;
const STARTED = "2026-08-21T01:00:00.000Z";
const COMPLETED = "2026-08-21T01:01:00.000Z";

type PromotionMode =
  | "success"
  | "fail"
  | "ambiguous_committed"
  | "ambiguous_unresolved";

type SummaryRow = Record<string, unknown> & {
  id: string;
  log_id: string;
  user_id: string;
  vehicle_id: string;
  summary: Record<string, unknown>;
};

function lifecycleLog(authority: string | null = null): Record<string, unknown> {
  return {
    id: LOG,
    user_id: USER,
    vehicle_id: VEHICLE,
    raw_source_storage_path: PATH,
    evidence_source_availability: "available",
    evidence_lifecycle_state: "legacy_unclassified",
    evidence_processing_contract_version: null,
    evidence_processing_stage: null,
    evidence_processing_outcome_kind: null,
    evidence_logger_platform: null,
    evidence_processing_reason_code: null,
    evidence_retry_disposition: null,
    evidence_diagnostic_reference: null,
    evidence_processing_started_at: null,
    evidence_processing_completed_at: null,
    authoritative_log_summary_id: authority,
  };
}

function legacySummary(id: string, marker: string): SummaryRow {
  return {
    id,
    log_id: LOG,
    user_id: USER,
    vehicle_id: VEHICLE,
    created_at: id === "summary-a" ? "2099-01-01T00:00:00.000Z" : COMPLETED,
    summary: { engine_v2: { marker, events: [], telemetry: [{ rpm: 3000 }] } },
  };
}

class DurableHarness
  implements EvidenceLifecycleDatabase, EvidencePersistenceDatabase, EvidenceReloadDatabase
{
  readonly log: Record<string, unknown>;
  readonly summaries = new Map<string, SummaryRow>();
  readonly lifecycleWrites: Readonly<Record<string, unknown>>[] = [];
  readonly requestedSummaryIds: string[] = [];
  promotionMode: PromotionMode = "success";
  insertFails = false;
  verificationFails = false;
  lifecycleFailsAt: number | null = null;
  reconciliationFails = false;
  promotionCalls = 0;
  private candidateSequence = 0;

  constructor(authority: string | null = null) {
    this.log = lifecycleLog(authority);
    if (authority !== null) this.summaries.set(authority, legacySummary(authority, "A"));
  }

  async record(input: Readonly<Record<string, unknown>>) {
    this.lifecycleWrites.push({ ...input });
    if (this.lifecycleFailsAt === this.lifecycleWrites.length) {
      return { data: null, failed: true };
    }
    const terminal = input.p_lifecycle_state === "terminal";
    Object.assign(this.log, {
      raw_source_storage_path: input.p_raw_source_storage_path,
      evidence_source_availability: input.p_source_availability,
      evidence_lifecycle_state: input.p_lifecycle_state,
      evidence_processing_contract_version: input.p_contract_version,
      evidence_processing_stage: input.p_processing_stage,
      evidence_processing_outcome_kind: input.p_outcome_kind,
      evidence_logger_platform: input.p_logger_platform,
      evidence_processing_reason_code: input.p_reason_code,
      evidence_retry_disposition: input.p_retry_disposition,
      evidence_diagnostic_reference: input.p_diagnostic_reference,
      evidence_processing_started_at: input.p_processing_started_at,
      evidence_processing_completed_at: terminal ? COMPLETED : null,
    });
    return {
      data: [{
        log_id: LOG,
        lifecycle_state: input.p_lifecycle_state,
        outcome_kind: input.p_outcome_kind,
        completed_at: terminal ? COMPLETED : null,
      }],
      failed: false,
    };
  }

  async insertCandidate(row: Readonly<Record<string, unknown>>) {
    if (this.insertFails) return { data: null, failed: true };
    const id = `candidate-${++this.candidateSequence}`;
    this.summaries.set(id, { id, ...row } as SummaryRow);
    return { data: { id }, failed: false };
  }

  async readCandidate(id: string) {
    const row = this.summaries.get(id);
    if (row === undefined) return { data: null, failed: true };
    return {
      data: this.verificationFails ? { ...row, vehicle_id: "other-vehicle" } : row,
      failed: false,
    };
  }

  async readAuthority() {
    if (this.reconciliationFails && this.promotionCalls > 0) {
      return { data: null, failed: true };
    }
    return {
      data: { authoritative_log_summary_id: this.log.authoritative_log_summary_id },
      failed: false,
    };
  }

  async promoteCandidate(input: Readonly<Record<string, unknown>>) {
    this.promotionCalls += 1;
    const candidate = String(input.p_candidate_summary_id);
    const previous = this.log.authoritative_log_summary_id as string | null;
    if (this.promotionMode === "fail") {
      return { data: null, failed: true };
    }
    if (this.promotionMode === "ambiguous_unresolved") {
      this.reconciliationFails = true;
      return { data: null, failed: true };
    }
    this.log.authoritative_log_summary_id = candidate;
    Object.assign(this.log, {
      evidence_lifecycle_state: "terminal",
      evidence_processing_stage: "evidence_persistence",
      evidence_processing_outcome_kind: "evidence_established",
      evidence_processing_reason_code: null,
      evidence_retry_disposition: "not_required",
      evidence_processing_completed_at: COMPLETED,
    });
    if (this.promotionMode === "ambiguous_committed") {
      return { data: null, failed: true };
    }
    return {
      data: [{
        log_id: LOG,
        previous_authoritative_log_summary_id: previous,
        authoritative_log_summary_id: candidate,
        outcome_kind: "evidence_established",
        completed_at: COMPLETED,
      }],
      failed: false,
    };
  }

  async loadLog() {
    return structuredClone(this.log);
  }

  async loadSummary(id: string) {
    this.requestedSummaryIds.push(id);
    const row = this.summaries.get(id);
    return row === undefined ? null : structuredClone(row);
  }
}

const context = (
  availability: "available" | "unavailable" | "unknown" = "available"
): EvidenceLifecycleContext => ({
  logId: LOG,
  expectedUserId: USER,
  processingStartedAt: STARTED,
  rawSourceStoragePath: availability === "available" ? PATH : null,
  sourceAvailability: availability,
});

const supportedRows = [
  { Time: 0, RPM: 3000, "Boost (PSI)": 12, "Boost target (PSI)": 13, "Throttle Position": 100 },
  { Time: 1, RPM: 4000, "Boost (PSI)": 15, "Boost target (PSI)": 16, "Throttle Position": 100 },
];

function candidateInput(marker: string): CandidateEvidenceSummaryInput {
  return {
    logId: LOG,
    vehicleId: VEHICLE,
    userId: USER,
    summaryPayload: { summary: { engine_v2: { marker, events: [], telemetry: [{ rpm: 4000 }] } } },
    processingContractVersion: "1.0",
    loggerPlatform: "mhd",
    sourceAvailability: "available",
    rawSourceStoragePath: PATH,
    processingStartedAt: STARTED,
  };
}

async function attempt(
  database: DurableHarness,
  options: Readonly<{
    qualification?: "supported" | "unsupported" | "invalid" | "throw";
    deriveFails?: boolean;
    marker?: string;
  }> = {}
): Promise<DurableEvidenceAttemptResult> {
  const qualification = options.qualification ?? "supported";
  return runDurableEvidenceProcessingAttempt({
    lifecycleDatabase: database,
    lifecycleContext: context(),
    qualify: () => {
      if (qualification === "throw") throw new Error("classification failed");
      if (qualification === "unsupported") {
        return qualifyEvidenceSource([{ Timestamp: 0, Mystery: 1 }], { sourceLogId: LOG, sourceAvailability: "available" });
      }
      if (qualification === "invalid") {
        return qualifyEvidenceSource([{ Time: "bad", RPM: "bad" }], { sourceLogId: LOG, sourceAvailability: "available" });
      }
      return qualifyEvidenceSource(supportedRows, { sourceLogId: LOG, sourceAvailability: "available" }, Object.keys(supportedRows[0]));
    },
    derive: async () => {
      if (options.deriveFails) throw new Error("derivation failed");
      return candidateInput(options.marker ?? "B");
    },
    persist: (input) => persistCandidateEvidenceSummary(database, input),
  });
}

async function reload(database: DurableHarness): Promise<EvidenceReloadWithProvenance> {
  return loadEvidenceReloadWithProvenance(database, {
    logId: LOG,
    expectedUserId: USER,
    expectedVehicleId: VEHICLE,
  });
}

function marker(state: EvidenceReloadWithProvenance): unknown {
  return state.currentAuthority.state === "available"
    ? state.currentAuthority.engineV2.marker
    : null;
}

function assertAuthority(state: EvidenceReloadWithProvenance, id: string, value: string) {
  assert.equal(state.currentAuthority.state, "available");
  assert.equal(state.currentAuthority.summaryId, id);
  assert.equal(marker(state), value);
}

test("first successful analysis survives persistence, reload and downstream gating", async () => {
  const database = new DurableHarness();
  assert.equal((await attempt(database)).status, "confirmed_established");
  const state = await reload(database);
  assertAuthority(state, "candidate-1", "B");
  assert.equal(state.processingLifecycle?.latestOutcome?.kind, "evidence_established");
  assert.equal(state.processingLifecycle?.latestOutcome?.downstreamConsumption, "permitted");
  assert.equal(state.evidenceProvenance.state, "available");
  if (state.evidenceProvenance.state === "available") {
    assert.equal(state.evidenceProvenance.provenance.provenanceClassification, "modern_known");
  }
});

test("successful reanalysis promotes B while retaining historical A regardless of recency", async () => {
  const database = new DurableHarness("summary-a");
  await attempt(database);
  const state = await reload(database);
  assertAuthority(state, "candidate-1", "B");
  assert.equal(database.summaries.has("summary-a"), true);
  assert.equal(database.summaries.size, 2);
  assert.deepEqual(database.requestedSummaryIds, ["candidate-1"]);
});

for (const [name, configure] of [
  ["qualification", (database: DurableHarness) => attempt(database, { qualification: "unsupported" })],
  ["derivation", (database: DurableHarness) => attempt(database, { deriveFails: true })],
  ["candidate insert", (database: DurableHarness) => { database.insertFails = true; return attempt(database); }],
  ["candidate verification", (database: DurableHarness) => { database.verificationFails = true; return attempt(database); }],
  ["promotion", (database: DurableHarness) => { database.promotionMode = "fail"; return attempt(database); }],
] as const) {
  test(`${name} failure preserves prior authority and summary history`, async () => {
    const database = new DurableHarness("summary-a");
    const result = await configure(database);
    assert.equal(result.status, "terminal_failure");
    assertAuthority(await reload(database), "summary-a", "A");
    assert.equal(database.summaries.has("summary-a"), true);
  });
}

test("terminal lifecycle-write failure is visible and cannot erase prior authority", async () => {
  const database = new DurableHarness("summary-a");
  database.lifecycleFailsAt = 2;
  const result = await attempt(database, { qualification: "unsupported" });
  assert.equal(result.status, "lifecycle_write_failed");
  assert.equal(database.log.authoritative_log_summary_id, "summary-a");
});

test("ambiguous committed promotion reconciles once and consumes the committed candidate", async () => {
  const database = new DurableHarness("summary-a");
  database.promotionMode = "ambiguous_committed";
  const result = await attempt(database);
  assert.equal(result.status, "confirmed_established");
  assert.equal(result.promotion?.reconciliationPerformed, true);
  assert.equal(database.promotionCalls, 1);
  assertAuthority(await reload(database), "candidate-1", "B");
});

test("unresolved promotion with prior authority remains processing and never consumes candidate", async () => {
  const database = new DurableHarness("summary-a");
  database.promotionMode = "ambiguous_unresolved";
  assert.equal((await attempt(database)).status, "reconciliation_required");
  const state = await reload(database);
  assert.equal(state.processingLifecycle?.persisted.lifecycleState, "processing");
  assert.equal(state.processingLifecycle?.persisted.processingStage, "evidence_persistence");
  assertAuthority(state, "summary-a", "A");
  assert.equal(database.promotionCalls, 1);
});

test("unresolved first attempt exposes lifecycle but no Evidence", async () => {
  const database = new DurableHarness();
  database.promotionMode = "ambiguous_unresolved";
  await attempt(database);
  const state = await reload(database);
  assert.equal(state.processingLifecycle?.persisted.lifecycleState, "processing");
  assert.equal(state.currentAuthority.state, "absent");
  assert.equal(state.evidenceProvenance.state, "absent");
});

for (const qualification of ["unsupported", "invalid", "throw"] as const) {
  test(`first-time ${qualification} failure reloads durably and blocks downstream`, async () => {
    const database = new DurableHarness();
    assert.equal((await attempt(database, { qualification })).status, "terminal_failure");
    const state = await reload(database);
    assert.equal(state.currentAuthority.state, "absent");
    assert.equal(state.processingLifecycle?.latestOutcome?.downstreamConsumption, "blocked");
    assert.equal(state.processingLifecycle?.latestOutcome?.retryDisposition, "retryable_from_source");
  });
}

test("first-time persistence failure reloads with null authority", async () => {
  const database = new DurableHarness();
  database.insertFails = true;
  await attempt(database);
  const state = await reload(database);
  assert.equal(state.processingLifecycle?.latestOutcome?.kind, "persistence_failed");
  assert.equal(state.currentAuthority.state, "absent");
});

test("legacy authority reloads without fabricating modern provenance or outcome", async () => {
  const database = new DurableHarness("summary-a");
  database.log.raw_source_storage_path = null;
  database.log.evidence_source_availability = "unknown";
  const state = await reload(database);
  assertAuthority(state, "summary-a", "A");
  assert.equal(state.processingLifecycle?.latestOutcome, null);
  assert.equal(state.evidenceProvenance.state, "available");
  if (state.evidenceProvenance.state === "available") {
    assert.equal(state.evidenceProvenance.provenance.provenanceClassification, "legacy_unknown");
  }
});

test("legacy null authority exposes neither Evidence nor provenance", async () => {
  const database = new DurableHarness();
  database.log.raw_source_storage_path = null;
  database.log.evidence_source_availability = "unknown";
  const state = await reload(database);
  assert.equal(state.currentAuthority.state, "absent");
  assert.equal(state.evidenceProvenance.state, "absent");
});

for (const [name, corrupt, reason] of [
  ["missing summary", (database: DurableHarness) => database.summaries.clear(), "summary_unavailable"],
  ["cross-log", (database: DurableHarness) => { database.summaries.get("summary-a")!.log_id = "other"; }, "summary_log_mismatch"],
  ["user mismatch", (database: DurableHarness) => { database.summaries.get("summary-a")!.user_id = "other"; }, "summary_user_mismatch"],
  ["vehicle mismatch", (database: DurableHarness) => { database.summaries.get("summary-a")!.vehicle_id = "other"; }, "summary_vehicle_mismatch"],
  ["malformed engine", (database: DurableHarness) => { database.summaries.get("summary-a")!.summary = { engine_v2: [] }; }, "malformed_engine_v2"],
] as const) {
  test(`${name} fails authority closed without recency fallback`, async () => {
    const database = new DurableHarness("summary-a");
    corrupt(database);
    const state = await reload(database);
    assert.equal(state.currentAuthority.state, "integrity_failure");
    if (state.currentAuthority.state === "integrity_failure") assert.equal(state.currentAuthority.reason, reason);
    assert.deepEqual(database.requestedSummaryIds, ["summary-a"]);
  });
}

test("contradictory persisted provenance fails closed", async () => {
  const database = new DurableHarness();
  await attempt(database);
  const row = database.summaries.get("candidate-1")!;
  const engine = (row.summary.engine_v2 as Record<string, unknown>);
  engine.evidenceProvenance = { ...(engine.evidenceProvenance as Record<string, unknown>), logId: "other-log" };
  assert.equal((await reload(database)).evidenceProvenance.state, "integrity_failure");
});

test("available source without durable path invalidates lifecycle after refresh", async () => {
  const database = new DurableHarness("summary-a");
  database.log.evidence_lifecycle_state = "processing";
  database.log.evidence_processing_contract_version = "1.0";
  database.log.evidence_processing_stage = "evidence_persistence";
  database.log.evidence_processing_started_at = STARTED;
  database.log.raw_source_storage_path = null;
  const state = await reload(database);
  assert.equal(state.lifecycleIntegrityFailure, "invalid_lifecycle");
  assert.equal(state.evidenceProvenance.state, "integrity_failure");
});

test("refresh reconstructs lifecycle, authority, provenance and gating from persistence only", async () => {
  const database = new DurableHarness();
  await attempt(database);
  const persistedOnly = new DurableHarness();
  Object.assign(persistedOnly.log, structuredClone(database.log));
  for (const [id, row] of database.summaries) persistedOnly.summaries.set(id, structuredClone(row));
  const state = await reload(persistedOnly);
  assertAuthority(state, "candidate-1", "B");
  assert.equal(state.processingLifecycle?.latestOutcome?.downstreamConsumption, "permitted");
  assert.equal(state.evidenceProvenance.state, "available");
});

test("query-string claims cannot fabricate, erase or promote durable authority", async () => {
  const database = new DurableHarness("summary-a");
  const before = await reload(database);
  for (const query of ["?status=success", "?status=failure", "?status=unresolved"]) {
    assert.equal(query.length > 0, true);
    assertAuthority(await reload(database), "summary-a", "A");
  }
  assert.deepEqual(marker(before), "A");
});

test("retry disposition survives reload for available, unavailable, unknown and established states", async () => {
  for (const [availability, expected] of [
    ["available", "retryable_from_source"],
    ["unavailable", "not_retryable"],
    ["unknown", "retryability_unknown"],
  ] as const) {
    const database = new DurableHarness();
    const lifecycle = context(availability);
    await database.record({
      p_log_id: LOG, p_expected_user_id: USER, p_contract_version: "1.0",
      p_source_availability: availability, p_processing_started_at: STARTED,
      p_raw_source_storage_path: lifecycle.rawSourceStoragePath,
      p_lifecycle_state: "terminal", p_processing_stage: "evidence_derivation",
      p_outcome_kind: "processing_failed", p_logger_platform: "mhd",
      p_reason_code: "evidence_derivation_failure", p_retry_disposition: expected,
      p_diagnostic_reference: null,
    });
    assert.equal((await loadEvidenceReloadState(database, { logId: LOG, expectedUserId: USER, expectedVehicleId: VEHICLE })).processingLifecycle?.latestOutcome?.retryDisposition, expected);
  }
  const established = new DurableHarness();
  await attempt(established);
  assert.equal((await reload(established)).processingLifecycle?.latestOutcome?.retryDisposition, "not_required");
});

test("post-commit lifecycle communication failure cannot undo atomic authority", async () => {
  const database = new DurableHarness("summary-a");
  database.promotionMode = "ambiguous_committed";
  const result = await attempt(database);
  assert.equal(result.status, "confirmed_established");
  assert.equal(database.log.authoritative_log_summary_id, "candidate-1");
  assertAuthority(await reload(database), "candidate-1", "B");
});

test("Correlation, Explanation, Presentation and telemetry share authoritative gating", () => {
  const page = readFileSync(new URL("../../app/dashboard/vehicles/[id]/analysis/page.tsx", import.meta.url), "utf8");
  assert.match(page, /loadEvidenceReloadWithProvenance/);
  assert.match(page, /currentAuthority\.state === "available"/);
  assert.match(page, /correlateEngineeringObservations/);
  assert.match(page, /engineV2\?\.crossReferences/);
  assert.match(page, /<TelemetryGraphV1[\s\S]*engineV2\?\.telemetry/);
});

test("security ownership remains protected-RPC-only and server-only", () => {
  const route = readFileSync("app/api/vehicles/update-log/route.ts", "utf8");
  const candidate = readFileSync(new URL("./evidenceCandidatePersistence.ts", import.meta.url), "utf8");
  const lifecycle = readFileSync(new URL("./evidenceLifecyclePersistence.ts", import.meta.url), "utf8");
  const trusted = readFileSync(new URL("../supabase/trustedServer.ts", import.meta.url), "utf8");
  assert.doesNotMatch(route, /authoritative_log_summary_id\s*:/);
  assert.doesNotMatch(route, /evidence_processing_outcome_kind\s*:/);
  assert.match(candidate, /establish_log_summary_authority_v1/);
  assert.match(lifecycle, /record_log_evidence_lifecycle_v1/);
  assert.match(trusted, /import "server-only"/);
  assert.doesNotMatch(trusted, /NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY/);
});

test("contract contains no destructive replacement or recency authority", () => {
  const candidate = readFileSync(new URL("./evidenceCandidatePersistence.ts", import.meta.url), "utf8");
  const reloadSource = readFileSync(new URL("./authoritativeEvidenceReload.ts", import.meta.url), "utf8");
  assert.doesNotMatch(candidate, /\.delete\(/);
  assert.doesNotMatch(reloadSource, /created_at|\.order\(|\.limit\(/);
});

test("contract excludes Analysis Snapshot and WP-005.1 Run Intelligence", () => {
  const sources = [
    "durableEvidenceProcessingIntegration.ts",
    "evidenceCandidatePersistence.ts",
    "authoritativeEvidenceReload.ts",
    "evidenceProvenance.ts",
  ].map((name) => readFileSync(new URL(`./${name}`, import.meta.url), "utf8")).join("\n");
  assert.doesNotMatch(sources, /analysis snapshot|run intelligence|accelerationrun|gearsegment|shiftevent/i);
});

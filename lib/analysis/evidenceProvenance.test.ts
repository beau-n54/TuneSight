import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  defineStoredEvidenceProvenanceV1,
  loadEvidenceReloadWithProvenance,
  serializeMinimumEvidenceProvenance,
} from "./evidenceProvenance.ts";
import type { EvidenceReloadDatabase } from "./authoritativeEvidenceReload.ts";

const LOG = "log-1";
const USER = "user-1";
const VEHICLE = "vehicle-1";
const SUMMARY = "summary-a";
const PATH = `${USER}/${VEHICLE}/${LOG}.csv`;

function legacyLog(authority: string | null = SUMMARY) {
  return {
    id: LOG,
    user_id: USER,
    vehicle_id: VEHICLE,
    raw_source_storage_path: null,
    evidence_source_availability: "unknown",
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

function establishedLog(authority: string | null = SUMMARY) {
  return {
    ...legacyLog(authority),
    raw_source_storage_path: PATH,
    evidence_source_availability: "available",
    evidence_lifecycle_state: "terminal",
    evidence_processing_contract_version: "1.0",
    evidence_processing_stage: "evidence_persistence",
    evidence_processing_outcome_kind: "evidence_established",
    evidence_logger_platform: "mhd",
    evidence_retry_disposition: "not_required",
    evidence_processing_started_at: "2026-08-21T00:00:00.000Z",
    evidence_processing_completed_at: "2026-08-21T00:01:00.000Z",
  };
}

function storedProvenance(overrides: Record<string, unknown> = {}) {
  return {
    provenanceContractVersion: "1.0",
    logId: LOG,
    vehicleId: VEHICLE,
    userId: USER,
    sourceAvailability: "available",
    rawSourceStoragePath: PATH,
    loggerPlatform: "mhd",
    processingContractVersion: "1.0",
    processingStartedAt: "2026-08-21T00:00:00.000Z",
    ...overrides,
  };
}

function summary(
  id = SUMMARY,
  overrides: Record<string, unknown> = {},
  provenance: Record<string, unknown> | null = storedProvenance()
) {
  return {
    id,
    log_id: LOG,
    user_id: USER,
    vehicle_id: VEHICLE,
    created_at: id === SUMMARY ? "2026-08-20T00:00:00Z" : "2099-01-01T00:00:00Z",
    summary: {
      engine_v2: {
        marker: id,
        ...(provenance === null ? {} : { evidenceProvenance: provenance }),
      },
    },
    ...overrides,
  };
}

function database(
  log: unknown,
  summaries: readonly Record<string, unknown>[]
): EvidenceReloadDatabase & { requested: string[] } {
  const requested: string[] = [];
  return {
    requested,
    async loadLog() {
      return log;
    },
    async loadSummary(id) {
      requested.push(id);
      return summaries.find((item) => item.id === id) ?? null;
    },
  };
}

async function reload(
  log: unknown = establishedLog(),
  summaries: readonly Record<string, unknown>[] = [summary()]
) {
  const source = database(log, summaries);
  const result = await loadEvidenceReloadWithProvenance(source, {
    logId: LOG,
    expectedUserId: USER,
    expectedVehicleId: VEHICLE,
  });
  return { result, source };
}

function provenance(
  result: Awaited<ReturnType<typeof reload>>["result"]
) {
  assert.equal(result.evidenceProvenance.state, "available");
  if (result.evidenceProvenance.state !== "available") {
    throw new Error("Expected available provenance.");
  }
  return result.evidenceProvenance.provenance;
}

test("modern established Evidence reconstructs complete minimum provenance", async () => {
  const value = provenance((await reload()).result);
  assert.deepEqual(value, {
    provenanceContractVersion: "1.0",
    provenanceClassification: "modern_known",
    logId: LOG,
    authoritativeSummaryId: SUMMARY,
    vehicleId: VEHICLE,
    userId: USER,
    sourceAvailability: "available",
    rawSourceStoragePath: PATH,
    loggerPlatform: "mhd",
    processingContractVersion: "1.0",
    processingStartedAt: "2026-08-21T00:00:00.000Z",
    processingCompletedAt: "2026-08-21T00:01:00.000Z",
  });
});

test("legacy authority represents unknown modern production provenance honestly", async () => {
  const value = provenance((await reload(legacyLog(), [summary(SUMMARY, {}, null)])).result);
  assert.equal(value.provenanceClassification, "legacy_unknown");
  assert.equal(value.authoritativeSummaryId, SUMMARY);
  assert.equal(value.loggerPlatform, null);
  assert.equal(value.processingContractVersion, null);
});

test("legacy durable source identity produces only partial provenance", async () => {
  const value = provenance(
    (await reload(
      { ...legacyLog(), raw_source_storage_path: "legacy/source.csv" },
      [summary(SUMMARY, {}, null)]
    )).result
  );
  assert.equal(value.provenanceClassification, "legacy_partial");
  assert.equal(value.rawSourceStoragePath, "legacy/source.csv");
});

test("legacy no-authority exposes no Evidence provenance", async () => {
  const { result } = await reload(legacyLog(null), []);
  assert.deepEqual(result.evidenceProvenance, { state: "absent", provenance: null });
});

test("modern authority provenance uses the exact pointer identity", async () => {
  const { result, source } = await reload(establishedLog(SUMMARY), [
    summary(SUMMARY),
    summary("summary-newer", {}, storedProvenance()),
  ]);
  assert.equal(provenance(result).authoritativeSummaryId, SUMMARY);
  assert.deepEqual(source.requested, [SUMMARY]);
});

for (const [label, overrides, reason] of [
  ["log", { log_id: "other-log" }, "summary_log_mismatch"],
  ["user", { user_id: "other-user" }, "summary_user_mismatch"],
  ["vehicle", { vehicle_id: "other-vehicle" }, "summary_vehicle_mismatch"],
] as const) {
  test(`${label} mismatch fails provenance closed`, async () => {
    const { result } = await reload(establishedLog(), [summary(SUMMARY, overrides)]);
    assert.equal(result.evidenceProvenance.state, "integrity_failure");
    if (result.evidenceProvenance.state === "integrity_failure") {
      assert.equal(result.evidenceProvenance.reason, reason);
    }
  });
}

test("available source without a raw path is rejected by the lifecycle contract", async () => {
  const { result } = await reload({ ...establishedLog(), raw_source_storage_path: null });
  assert.equal(result.lifecycleIntegrityFailure, "invalid_lifecycle");
  assert.deepEqual(result.evidenceProvenance, {
    state: "integrity_failure",
    reason: "invalid_lifecycle",
    provenance: null,
  });
});

test("modern processing contract version is surfaced exactly", async () => {
  assert.equal(provenance((await reload()).result).processingContractVersion, "1.0");
});

test("logger platform is surfaced exactly when durably known", async () => {
  assert.equal(provenance((await reload()).result).loggerPlatform, "mhd");
});

test("unknown logger remains unknown rather than becoming a specific platform", async () => {
  const log = { ...establishedLog(), evidence_logger_platform: "unknown" };
  const row = summary(SUMMARY, {}, storedProvenance({ loggerPlatform: "unknown" }));
  assert.equal(provenance((await reload(log, [row])).result).loggerPlatform, "unknown");
});

test("legacy processing timestamps remain null", async () => {
  const value = provenance((await reload(legacyLog(), [summary(SUMMARY, {}, null)])).result);
  assert.equal(value.processingStartedAt, null);
  assert.equal(value.processingCompletedAt, null);
});

test("newer candidate and superseded rows cannot influence provenance", async () => {
  const candidate = summary("candidate-new", {}, storedProvenance({ loggerPlatform: "bm3" }));
  const { result } = await reload(establishedLog(SUMMARY), [summary(), candidate]);
  assert.equal(provenance(result).loggerPlatform, "mhd");
  assert.equal(provenance(result).authoritativeSummaryId, SUMMARY);
});

test("provenance is immutable", async () => {
  const state = (await reload()).result.evidenceProvenance;
  assert.equal(Object.isFrozen(state), true);
  assert.equal(state.state === "available" && Object.isFrozen(state.provenance), true);
});

test("provenance serialization is deterministic", async () => {
  const first = provenance((await reload()).result);
  const second = provenance((await reload()).result);
  assert.equal(
    serializeMinimumEvidenceProvenance(first),
    serializeMinimumEvidenceProvenance(second)
  );
});

test("stored provenance is reconstructable without transient route memory", async () => {
  const stored = defineStoredEvidenceProvenanceV1(storedProvenance() as ReturnType<typeof defineStoredEvidenceProvenanceV1>);
  const reloaded = provenance(
    (await reload(establishedLog(), [summary(SUMMARY, {}, stored)])).result
  );
  assert.equal(reloaded.rawSourceStoragePath, PATH);
  assert.equal(reloaded.processingStartedAt, stored.processingStartedAt);
});

test("contradictory stored provenance fails closed", async () => {
  const row = summary(SUMMARY, {}, storedProvenance({ logId: "other-log" }));
  const { result } = await reload(establishedLog(), [row]);
  assert.deepEqual(result.evidenceProvenance, {
    state: "integrity_failure",
    reason: "provenance_log_mismatch",
    provenance: null,
  });
});

test("production contract excludes Analysis Snapshot and generalized provenance", () => {
  const source = readFileSync(new URL("./evidenceProvenance.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /analysis snapshot|transformation dag|audit ledger/i);
});

test("WP-005.1 Run Intelligence remains excluded", () => {
  const source = readFileSync(new URL("./evidenceProvenance.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /run intelligence|accelerationrun|gearsegment|shiftevent/i);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  loadEvidenceReloadState,
  type EvidenceReloadDatabase,
} from "./authoritativeEvidenceReload.ts";

const USER = "user-1";
const VEHICLE = "vehicle-1";
const LOG = "log-1";

function legacyLog(authority: string | null = "summary-a") {
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

function processingLog(authority: string | null = "summary-a") {
  return {
    ...legacyLog(authority),
    raw_source_storage_path: `${USER}/${VEHICLE}/${LOG}.csv`,
    evidence_source_availability: "available",
    evidence_lifecycle_state: "processing",
    evidence_processing_contract_version: "1.0",
    evidence_processing_stage: "evidence_persistence",
    evidence_processing_started_at: "2026-08-21T00:00:00.000Z",
  };
}

function failedLog(authority: string | null = "summary-a") {
  return {
    ...processingLog(authority),
    evidence_lifecycle_state: "terminal",
    evidence_processing_outcome_kind: "persistence_failed",
    evidence_processing_reason_code: "authoritative_evidence_write_failure",
    evidence_retry_disposition: "retryable_from_source",
    evidence_processing_completed_at: "2026-08-21T00:01:00.000Z",
  };
}

function establishedLog(authority: string | null = "summary-a") {
  return {
    ...processingLog(authority),
    evidence_lifecycle_state: "terminal",
    evidence_processing_outcome_kind: "evidence_established",
    evidence_retry_disposition: "not_required",
    evidence_processing_completed_at: "2026-08-21T00:01:00.000Z",
  };
}

function summary(
  id: string,
  marker: string,
  overrides: Record<string, unknown> = {}
) {
  return {
    id,
    log_id: LOG,
    user_id: USER,
    vehicle_id: VEHICLE,
    created_at:
      id === "summary-a"
        ? "2026-08-20T00:00:00.000Z"
        : "2099-01-01T00:00:00.000Z",
    summary: { engine_v2: { marker, events: [], pullWindows: [] } },
    ...overrides,
  };
}

function database(
  log: unknown,
  summaries: readonly Record<string, unknown>[] = [
    summary("summary-a", "A"),
    summary("summary-b", "B"),
  ]
): EvidenceReloadDatabase & { requestedSummaries: string[] } {
  const requestedSummaries: string[] = [];
  return {
    requestedSummaries,
    async loadLog() {
      return log;
    },
    async loadSummary(id) {
      requestedSummaries.push(id);
      return summaries.find((item) => item.id === id) ?? null;
    },
  };
}

async function reload(
  log: unknown,
  summaries?: readonly Record<string, unknown>[]
) {
  const source = database(log, summaries);
  const result = await loadEvidenceReloadState(source, {
    logId: LOG,
    expectedUserId: USER,
    expectedVehicleId: VEHICLE,
  });
  return { result, source };
}

function marker(result: Awaited<ReturnType<typeof reload>>["result"]): unknown {
  return result.currentAuthority.state === "available"
    ? result.currentAuthority.engineV2.marker
    : null;
}

test("authority pointer selects the exact summary and ignores newer candidates", async () => {
  const { result, source } = await reload(legacyLog("summary-a"));
  assert.equal(result.currentAuthority.state, "available");
  assert.equal(marker(result), "A");
  assert.deepEqual(source.requestedSummaries, ["summary-a"]);
});

test("authority change A to B changes reload without using created_at", async () => {
  assert.equal(marker((await reload(legacyLog("summary-a"))).result), "A");
  assert.equal(marker((await reload(legacyLog("summary-b"))).result), "B");
});

test("null authority returns no Evidence and does not query summaries", async () => {
  const { result, source } = await reload(legacyLog(null));
  assert.equal(result.currentAuthority.state, "absent");
  assert.deepEqual(source.requestedSummaries, []);
});

test("missing referenced summary fails closed", async () => {
  const { result } = await reload(legacyLog("missing"));
  assert.deepEqual(result.currentAuthority, {
    state: "integrity_failure",
    reason: "summary_unavailable",
    summaryId: "missing",
    summary: null,
    engineV2: null,
  });
});

for (const [name, replacement, reason] of [
  ["cross-log", { log_id: "other-log" }, "summary_log_mismatch"],
  ["user", { user_id: "other-user" }, "summary_user_mismatch"],
  ["vehicle", { vehicle_id: "other-vehicle" }, "summary_vehicle_mismatch"],
] as const) {
  test(`${name} mismatch fails closed`, async () => {
    const { result } = await reload(legacyLog(), [
      summary("summary-a", "A", replacement),
    ]);
    assert.equal(result.currentAuthority.state, "integrity_failure");
    if (result.currentAuthority.state === "integrity_failure") {
      assert.equal(result.currentAuthority.reason, reason);
    }
  });
}

test("malformed engine_v2 fails closed", async () => {
  const { result } = await reload(legacyLog(), [
    summary("summary-a", "A", { summary: { engine_v2: [] } }),
  ]);
  assert.equal(result.currentAuthority.state, "integrity_failure");
  if (result.currentAuthority.state === "integrity_failure") {
    assert.equal(result.currentAuthority.reason, "malformed_engine_v2");
  }
});

test("legacy authority remains usable without fabricating a modern outcome", async () => {
  const { result } = await reload(legacyLog());
  assert.equal(result.processingLifecycle?.persisted.lifecycleState, "legacy_unclassified");
  assert.equal(result.processingLifecycle?.latestOutcome, null);
  assert.equal(result.currentAuthority.state, "available");
});

test("legacy null authority remains explicitly unavailable", async () => {
  const { result } = await reload(legacyLog(null));
  assert.equal(result.processingLifecycle?.persisted.lifecycleState, "legacy_unclassified");
  assert.equal(result.currentAuthority.state, "absent");
});

test("processing with prior authority exposes unresolved processing and Evidence", async () => {
  const { result } = await reload(processingLog());
  assert.equal(result.processingLifecycle?.persisted.lifecycleState, "processing");
  assert.equal(result.processingLifecycle?.persisted.processingStage, "evidence_persistence");
  assert.equal(result.currentAuthority.state, "available");
  assert.equal(marker(result), "A");
});

test("processing first attempt exposes no Evidence", async () => {
  const { result } = await reload(processingLog(null));
  assert.equal(result.processingLifecycle?.persisted.lifecycleState, "processing");
  assert.equal(result.currentAuthority.state, "absent");
});

test("terminal failure preserves both failure and prior authority", async () => {
  const { result } = await reload(failedLog());
  assert.equal(result.processingLifecycle?.latestOutcome?.kind, "persistence_failed");
  assert.equal(result.currentAuthority.state, "available");
  assert.equal(marker(result), "A");
});

test("terminal failure first attempt exposes failure without Evidence", async () => {
  const { result } = await reload(failedLog(null));
  assert.equal(result.processingLifecycle?.latestOutcome?.kind, "persistence_failed");
  assert.equal(result.currentAuthority.state, "absent");
});

test("evidence_established requires authority", async () => {
  const { result } = await reload(establishedLog(null));
  assert.equal(result.processingLifecycle, null);
  assert.equal(result.lifecycleIntegrityFailure, "invalid_lifecycle");
  assert.equal(result.currentAuthority.state, "absent");
});

test("established Evidence and downstream payload come only from authority", async () => {
  const { result } = await reload(establishedLog("summary-a"));
  assert.equal(result.processingLifecycle?.latestOutcome?.kind, "evidence_established");
  assert.equal(marker(result), "A");
});

test("log identity and ownership discrepancies fail closed before summary loading", async () => {
  for (const log of [
    { ...legacyLog(), id: "other-log" },
    { ...legacyLog(), user_id: "other-user" },
    { ...legacyLog(), vehicle_id: "other-vehicle" },
  ]) {
    const { result, source } = await reload(log);
    assert.equal(result.currentAuthority.state, "integrity_failure");
    assert.deepEqual(source.requestedSummaries, []);
  }
});

function analysisPageSource(): string {
  return readFileSync(
    new URL(
      "../../app/dashboard/vehicles/[id]/analysis/page.tsx",
      import.meta.url
    ),
    "utf8"
  );
}

test("Correlation receives events from only the authoritative summary", () => {
  const page = analysisPageSource();
  assert.match(page, /const engineV2 = getEngineV2\(latestSummary\)/);
  assert.match(page, /correlateEngineeringObservations\([\s\S]*latestSummary\?\.id/);
});

test("Explanation surfaces inherit only authoritative cross-reference Evidence", () => {
  const page = analysisPageSource();
  assert.match(page, /const engineCrossReferences =/);
  assert.match(page, /engineV2\?\.crossReferences/);
  assert.match(page, /<WorkshopDiagnosticCard/);
});

test("Presentation and telemetry reload from only authoritative engine_v2", () => {
  const page = analysisPageSource();
  assert.match(page, /loadEvidenceReloadWithProvenance/);
  assert.match(page, /currentAuthority\.state === "available"/);
  assert.match(page, /<TelemetryGraphV1[\s\S]*engineV2\?\.telemetry/);
});

test("no active current-Evidence query establishes authority by created_at", () => {
  const page = analysisPageSource();
  assert.doesNotMatch(
    page,
    /from\("log_summaries"\)[\s\S]{0,240}order\("created_at"/
  );
});

test("query-string success cannot create authority over durable no-authority state", async () => {
  const helper = readFileSync(new URL("./authoritativeEvidenceReload.ts", import.meta.url), "utf8");
  assert.doesNotMatch(helper, /searchParams|query[-_ ]string|evidence_status/i);
  assert.equal((await reload(failedLog(null))).result.currentAuthority.state, "absent");
});

test("query-string failure cannot erase durable prior authority", async () => {
  const { result } = await reload(failedLog("summary-a"));
  assert.equal(result.currentAuthority.state, "available");
  assert.equal(marker(result), "A");
});

test("authority selection remains server/data-layer owned", () => {
  const helper = readFileSync(new URL("./authoritativeEvidenceReload.ts", import.meta.url), "utf8");
  const page = analysisPageSource();
  assert.doesNotMatch(helper, /["']use client["']/);
  assert.doesNotMatch(page, /["']use client["']/);
  assert.doesNotMatch(helper, /created_at|\.order\(|\.limit\(/);
});

test("WP-005.1 Run Intelligence remains excluded", () => {
  const helper = readFileSync(new URL("./authoritativeEvidenceReload.ts", import.meta.url), "utf8");
  assert.doesNotMatch(
    helper,
    /run intelligence|accelerationrun|gearsegment|shiftevent/i
  );
});

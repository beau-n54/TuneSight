import assert from "node:assert/strict";
import test from "node:test";
import {
  defineDurableEvidenceProcessingLifecycle,
  serializeDurableEvidenceProcessingLifecycle,
  type PersistedEvidenceLifecycle,
} from "./evidenceProcessingLifecycle.ts";

const base = (): PersistedEvidenceLifecycle => ({
  logId: "log-1",
  rawSourceStoragePath: null,
  sourceAvailability: "unknown",
  lifecycleState: "legacy_unclassified",
  processingContractVersion: null,
  processingStage: null,
  processingOutcomeKind: null,
  loggerPlatform: null,
  processingReasonCode: null,
  retryDisposition: null,
  diagnosticReference: null,
  processingStartedAt: null,
  processingCompletedAt: null,
  authoritativeLogSummaryId: null,
});

const processing = (
  authority: string | null = null
): PersistedEvidenceLifecycle => ({
  ...base(),
  rawSourceStoragePath: "user/vehicle/log-1.csv",
  sourceAvailability: "available",
  lifecycleState: "processing",
  processingContractVersion: "1.0",
  processingStage: "evidence_derivation",
  loggerPlatform: "mhd",
  processingStartedAt: "2026-08-17T01:00:00.000Z",
  authoritativeLogSummaryId: authority,
});

const terminal = (
  outcome: "evidence_established" | "processing_failed",
  authority: string | null
): PersistedEvidenceLifecycle => ({
  ...processing(authority),
  lifecycleState: "terminal",
  processingStage:
    outcome === "evidence_established"
      ? "evidence_persistence"
      : "evidence_derivation",
  processingOutcomeKind: outcome,
  processingReasonCode:
    outcome === "evidence_established" ? null : "evidence_derivation_failure",
  retryDisposition:
    outcome === "evidence_established" ? "not_required" : "retryable_from_source",
  diagnosticReference: outcome === "evidence_established" ? null : "analysis:failed",
  processingCompletedAt: "2026-08-17T01:01:00.000Z",
});

test("legacy unclassified without authority preserves uncertainty", () => {
  const result = defineDurableEvidenceProcessingLifecycle(base());
  assert.equal(result.latestOutcome, null);
  assert.equal(result.currentAuthority, null);
});

test("legacy unclassified may preserve a provable authority reference", () => {
  const result = defineDurableEvidenceProcessingLifecycle({
    ...base(),
    authoritativeLogSummaryId: "summary-legacy",
  });
  assert.equal(result.latestOutcome, null);
  assert.equal(result.currentAuthority?.summaryId, "summary-legacy");
});

test("processing may preserve prior authority", () => {
  const result = defineDurableEvidenceProcessingLifecycle(processing("summary-a"));
  assert.equal(result.latestOutcome, null);
  assert.equal(result.currentAuthority?.summaryId, "summary-a");
});

test("first processing attempt may have no authority", () => {
  const result = defineDurableEvidenceProcessingLifecycle(processing());
  assert.equal(result.currentAuthority, null);
});

test("established terminal lifecycle requires authority", () => {
  assert.throws(
    () => defineDurableEvidenceProcessingLifecycle(terminal("evidence_established", null)),
    /requires current authority/
  );
});

test("established terminal lifecycle reconstructs canonical outcome", () => {
  const result = defineDurableEvidenceProcessingLifecycle(
    terminal("evidence_established", "summary-b")
  );
  assert.equal(result.latestOutcome?.kind, "evidence_established");
  if (result.latestOutcome?.kind !== "evidence_established") return;
  assert.equal(
    result.latestOutcome.authoritativeEvidenceReference.persistenceReference,
    "log_summaries:summary-b"
  );
});

test("failed terminal lifecycle preserves prior authority", () => {
  const result = defineDurableEvidenceProcessingLifecycle(
    terminal("processing_failed", "summary-a")
  );
  assert.equal(result.latestOutcome?.kind, "processing_failed");
  assert.equal(result.currentAuthority?.summaryId, "summary-a");
});

test("first failed terminal lifecycle is valid without authority", () => {
  const result = defineDurableEvidenceProcessingLifecycle(
    terminal("processing_failed", null)
  );
  assert.equal(result.latestOutcome?.kind, "processing_failed");
  assert.equal(result.currentAuthority, null);
});

test("failed reconstruction preserves canonical reason and stage semantics", () => {
  const result = defineDurableEvidenceProcessingLifecycle(
    terminal("processing_failed", "summary-a")
  );
  if (result.latestOutcome?.kind !== "processing_failed") return;
  assert.equal(result.latestOutcome.stage, "evidence_derivation");
  assert.equal(result.latestOutcome.reasonCode, "evidence_derivation_failure");
});

test("impossible terminal reason and stage combination is rejected", () => {
  assert.throws(
    () =>
      defineDurableEvidenceProcessingLifecycle({
        ...terminal("processing_failed", null),
        processingStage: "translation",
      }),
    /failed stage/
  );
});

test("legacy state rejects fabricated modern metadata", () => {
  assert.throws(
    () =>
      defineDurableEvidenceProcessingLifecycle({
        ...base(),
        loggerPlatform: "mhd",
      }),
    /cannot fabricate/
  );
});

test("available source requires stable storage path", () => {
  assert.throws(
    () =>
      defineDurableEvidenceProcessingLifecycle({
        ...processing(),
        rawSourceStoragePath: null,
      }),
    /requires a raw source storage path/
  );
});

test("authority remains separate from latest failed attempt", () => {
  const result = defineDurableEvidenceProcessingLifecycle(
    terminal("processing_failed", "summary-a")
  );
  assert.equal(result.latestOutcome?.evidenceAvailability, "unavailable");
  assert.equal(result.currentAuthority?.evidenceId, "log-summary:summary-a");
});

test("serialization is deterministic", () => {
  const input = terminal("processing_failed", "summary-a");
  const reversed = Object.fromEntries(
    Object.entries(input).reverse()
  ) as unknown as PersistedEvidenceLifecycle;
  assert.equal(
    serializeDurableEvidenceProcessingLifecycle(input),
    serializeDurableEvidenceProcessingLifecycle(reversed)
  );
});

test("unsupported persisted fields are rejected", () => {
  assert.throws(
    () =>
      defineDurableEvidenceProcessingLifecycle({
        ...base(),
        analysisSnapshotId: "outside-scope",
      } as PersistedEvidenceLifecycle),
    /fields are invalid/
  );
});

test("lifecycle output is recursively immutable and input remains isolated", () => {
  const input = terminal("processing_failed", "summary-a");
  const result = defineDurableEvidenceProcessingLifecycle(input);
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.persisted));
  assert.ok(Object.isFrozen(result.latestOutcome));
  assert.ok(Object.isFrozen(result.currentAuthority));
  assert.notEqual(result.persisted, input);
});

test("contract contains no Analysis Snapshot or Run Intelligence state", () => {
  const serialized = serializeDurableEvidenceProcessingLifecycle(
    terminal("processing_failed", "summary-a")
  );
  assert.doesNotMatch(serialized, /analysisSnapshot|gearSegment|shiftEvent|accelerationRun/i);
});

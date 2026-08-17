import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  runDurableEvidenceProcessingAttempt,
  type DurableEvidenceAttemptDependencies,
} from "./durableEvidenceProcessingIntegration.ts";
import type {
  EvidencePromotionFinding,
  EvidencePromotionOperationResult,
} from "./evidenceCandidatePersistence.ts";
import {
  recordEvidenceProcessingFailure,
  type EvidenceLifecycleContext,
  type EvidenceLifecycleDatabase,
} from "./evidenceLifecyclePersistence.ts";
import { qualifyEvidenceSource } from "./evidenceSourceQualification.ts";

const lifecycleContext = (
  rawSourceStoragePath: string | null = "user-1/vehicle-1/log-1.csv",
  sourceAvailability: "available" | "unavailable" | "unknown" = "available"
): EvidenceLifecycleContext => ({
  logId: "log-1",
  expectedUserId: "user-1",
  processingStartedAt: "2026-08-18T01:00:00.000Z",
  rawSourceStoragePath,
  sourceAvailability,
});

const qualificationContext = () => ({
  sourceLogId: "log-1",
  sourceAvailability: "available" as const,
});

const mhdRows = () => [
  {
    Time: 0,
    RPM: 3000,
    "Boost (PSI)": 12,
    "Boost target (PSI)": 13,
    "Throttle Position": 100,
  },
  {
    Time: 1,
    RPM: 4000,
    "Boost (PSI)": 15,
    "Boost target (PSI)": 16,
    "Throttle Position": 100,
  },
];

class FakeLifecycleDatabase implements EvidenceLifecycleDatabase {
  readonly writes: Readonly<Record<string, unknown>>[] = [];
  failAtWrite: number | null = null;
  authority: string | null;

  constructor(authority: string | null = null) {
    this.authority = authority;
  }

  async record(input: Readonly<Record<string, unknown>>) {
    this.writes.push({ ...input });
    if (this.failAtWrite === this.writes.length) {
      return { data: null, failed: true };
    }
    const terminal = input.p_lifecycle_state === "terminal";
    return {
      data: [
        {
          log_id: input.p_log_id,
          lifecycle_state: input.p_lifecycle_state,
          outcome_kind: input.p_outcome_kind,
          authoritative_log_summary_id: this.authority,
          completed_at: terminal ? "2026-08-18T01:01:00.000Z" : null,
        },
      ],
      failed: false,
    };
  }
}

function promotion(
  resolution: EvidencePromotionOperationResult["resolution"],
  previousAuthorityId: string | null,
  finding: EvidencePromotionFinding | null = null
): EvidencePromotionOperationResult {
  const currentAuthorityId =
    resolution === "confirmed_established"
      ? "summary-b"
      : resolution === "confirmed_not_established"
        ? previousAuthorityId
        : "summary-unresolved";
  return Object.freeze({
    logId: "log-1",
    candidateSummaryId: "summary-b",
    previousAuthorityKnown: true,
    previousAuthorityId,
    resolution,
    currentAuthorityKnown: resolution !== "reconciliation_required",
    currentAuthorityId,
    reconciliationPerformed: resolution === "reconciliation_required",
    finding,
    completedAt:
      resolution === "confirmed_established"
        ? "2026-08-18T01:01:00.000Z"
        : null,
  });
}

function dependencies(
  database: FakeLifecycleDatabase,
  promotionResult: EvidencePromotionOperationResult = promotion(
    "confirmed_established",
    database.authority
  )
): DurableEvidenceAttemptDependencies<{ summary: string }> {
  return {
    lifecycleDatabase: database,
    lifecycleContext: lifecycleContext(),
    qualify: () =>
      qualifyEvidenceSource(
        mhdRows(),
        qualificationContext(),
        Object.keys(mhdRows()[0])
      ),
    derive: async () => ({ summary: "derived" }),
    persist: async () => {
      if (promotionResult.resolution === "confirmed_established") {
        database.authority = promotionResult.candidateSummaryId;
      }
      return promotionResult;
    },
  };
}

test("successful processing records three meaningful stages and no duplicate terminal success", async () => {
  const database = new FakeLifecycleDatabase();
  const result = await runDurableEvidenceProcessingAttempt(
    dependencies(database)
  );

  assert.equal(result.status, "confirmed_established");
  assert.equal(database.authority, "summary-b");
  assert.deepEqual(
    database.writes.map((write) => write.p_processing_stage),
    ["source_classification", "evidence_derivation", "evidence_persistence"]
  );
  assert.equal(
    database.writes.some((write) => write.p_outcome_kind === "evidence_established"),
    false
  );
  assert.equal(
    database.writes.every(
      (write) =>
        write.p_raw_source_storage_path === "user-1/vehicle-1/log-1.csv"
    ),
    true
  );
});

test("unsupported source becomes a durable canonical terminal and blocks derivation", async () => {
  const database = new FakeLifecycleDatabase("summary-a");
  let derivations = 0;
  const result = await runDurableEvidenceProcessingAttempt({
    ...dependencies(database),
    qualify: () =>
      qualifyEvidenceSource(
        [{ Timestamp: 0, "Unrecognised Channel": 1 }],
        qualificationContext()
      ),
    derive: async () => {
      derivations += 1;
      return { summary: "must-not-exist" };
    },
  });

  assert.equal(result.status, "terminal_failure");
  assert.equal(derivations, 0);
  assert.equal(database.authority, "summary-a");
  assert.equal(database.writes.at(-1)?.p_outcome_kind, "unsupported_source");
  assert.equal(database.writes.at(-1)?.p_reason_code, "unknown_source_format");
  assert.equal(database.writes.at(-1)?.p_processing_stage, "source_classification");
});

test("invalid source becomes a durable invalid_or_incomplete terminal", async () => {
  const database = new FakeLifecycleDatabase("summary-a");
  const result = await runDurableEvidenceProcessingAttempt({
    ...dependencies(database),
    qualify: () =>
      qualifyEvidenceSource(
        [
          {
            Time: "not-numeric",
            RPM: "not-numeric",
            "Boost (PSI)": "not-numeric",
            "Boost target (PSI)": "not-numeric",
            "Throttle Position": "not-numeric",
          },
        ],
        qualificationContext()
      ),
  });

  assert.equal(result.status, "terminal_failure");
  assert.equal(database.authority, "summary-a");
  assert.equal(
    database.writes.at(-1)?.p_outcome_kind,
    "invalid_or_incomplete_source"
  );
  assert.equal(database.writes.at(-1)?.p_processing_stage, "translation");
});

test("qualification exception becomes source-classification processing failure", async () => {
  const database = new FakeLifecycleDatabase("summary-a");
  const result = await runDurableEvidenceProcessingAttempt({
    ...dependencies(database),
    qualify: () => {
      throw new Error("synthetic classification failure");
    },
  });

  assert.equal(result.status, "terminal_failure");
  assert.equal(database.authority, "summary-a");
  assert.equal(database.writes.at(-1)?.p_outcome_kind, "processing_failed");
  assert.equal(
    database.writes.at(-1)?.p_reason_code,
    "source_classification_failure"
  );
});

test("derivation failure uses the exact governed stage and reason", async () => {
  const database = new FakeLifecycleDatabase("summary-a");
  const result = await runDurableEvidenceProcessingAttempt({
    ...dependencies(database),
    derive: async () => {
      throw new Error("synthetic derivation failure");
    },
  });

  assert.equal(result.status, "terminal_failure");
  assert.equal(database.authority, "summary-a");
  assert.equal(database.writes.at(-1)?.p_processing_stage, "evidence_derivation");
  assert.equal(
    database.writes.at(-1)?.p_reason_code,
    "evidence_derivation_failure"
  );
});

for (const finding of [
  "candidate_insert_failed",
  "candidate_verification_failed",
  "promotion_not_established",
] as const) {
  test(`${finding} becomes persistence_failed without replacing authority`, async () => {
    const database = new FakeLifecycleDatabase("summary-a");
    const result = await runDurableEvidenceProcessingAttempt(
      dependencies(
        database,
        promotion("confirmed_not_established", "summary-a", finding)
      )
    );

    assert.equal(result.status, "terminal_failure");
    assert.equal(database.authority, "summary-a");
    assert.equal(database.writes.at(-1)?.p_outcome_kind, "persistence_failed");
    assert.equal(
      database.writes.at(-1)?.p_reason_code,
      "authoritative_evidence_write_failure"
    );
    assert.equal(
      database.writes.at(-1)?.p_retry_disposition,
      "retryable_from_source"
    );
  });
}

test("unresolved promotion remains durably non-terminal at evidence_persistence", async () => {
  const database = new FakeLifecycleDatabase("summary-a");
  const result = await runDurableEvidenceProcessingAttempt(
    dependencies(
      database,
      promotion(
        "reconciliation_required",
        "summary-a",
        "authority_reconciliation_failed"
      )
    )
  );

  assert.equal(result.status, "reconciliation_required");
  assert.equal(database.authority, "summary-a");
  assert.equal(database.writes.at(-1)?.p_lifecycle_state, "processing");
  assert.equal(database.writes.at(-1)?.p_processing_stage, "evidence_persistence");
  assert.equal(database.writes.at(-1)?.p_outcome_kind, null);
});

test("first-time known failure persists terminal state and leaves authority null", async () => {
  const database = new FakeLifecycleDatabase();
  const result = await runDurableEvidenceProcessingAttempt(
    dependencies(
      database,
      promotion(
        "confirmed_not_established",
        null,
        "candidate_insert_failed"
      )
    )
  );

  assert.equal(result.status, "terminal_failure");
  assert.equal(database.authority, null);
  assert.equal(database.writes.at(-1)?.p_outcome_kind, "persistence_failed");
});

test("processing-start lifecycle failure stops qualification and is not concealed", async () => {
  const database = new FakeLifecycleDatabase();
  database.failAtWrite = 1;
  let qualifications = 0;
  const result = await runDurableEvidenceProcessingAttempt({
    ...dependencies(database),
    qualify: () => {
      qualifications += 1;
      return qualifyEvidenceSource(mhdRows(), qualificationContext());
    },
  });

  assert.equal(result.status, "lifecycle_write_failed");
  assert.equal(qualifications, 0);
  assert.equal(database.writes.length, 1);
});

test("terminal lifecycle write failure is reported rather than fabricated", async () => {
  const database = new FakeLifecycleDatabase("summary-a");
  database.failAtWrite = 2;
  const result = await runDurableEvidenceProcessingAttempt({
    ...dependencies(database),
    qualify: () =>
      qualifyEvidenceSource(
        [{ Timestamp: 0, "Unrecognised Channel": 1 }],
        qualificationContext()
      ),
  });

  assert.equal(result.status, "lifecycle_write_failed");
  assert.equal(database.authority, "summary-a");
});

test("unavailable raw source maps to non-retryable storage failure", async () => {
  const database = new FakeLifecycleDatabase();
  await recordEvidenceProcessingFailure(
    database,
    lifecycleContext(null, "unavailable"),
    "raw_source_storage",
    null
  );

  assert.equal(database.writes[0].p_raw_source_storage_path, null);
  assert.equal(database.writes[0].p_source_availability, "unavailable");
  assert.equal(database.writes[0].p_retry_disposition, "not_retryable");
  assert.equal(database.writes[0].p_reason_code, "raw_source_storage_failure");
});

test("route preserves exact Storage path and all authority boundaries", () => {
  const route = readFileSync("app/api/vehicles/update-log/route.ts", "utf8");
  const lifecycle = readFileSync(
    "lib/analysis/evidenceLifecyclePersistence.ts",
    "utf8"
  );

  assert.match(route, /rawSourceStoragePath: filePath/);
  assert.doesNotMatch(route, /rawSourceStoragePath:\s*signedUrlData/);
  assert.doesNotMatch(route, /from\("log_summaries"\)\.delete/);
  assert.doesNotMatch(route, /authoritative_log_summary_id\s*:/);
  assert.doesNotMatch(route, /evidence_processing_outcome_kind\s*:/);
  assert.match(lifecycle, /record_log_evidence_lifecycle_v1/);
  assert.doesNotMatch(lifecycle, /\.update\(/);
  assert.doesNotMatch(lifecycle, /GearSegment|ShiftEvent|AccelerationRun/);
});

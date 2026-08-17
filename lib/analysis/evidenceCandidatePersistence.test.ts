import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  persistCandidateEvidenceSummary,
  type CandidateEvidenceSummaryInput,
  type EvidencePersistenceDatabase,
} from "./evidenceCandidatePersistence.ts";
import { resolveTrustedServerConfiguration } from "../supabase/trustedServerConfiguration.ts";

const input = (): CandidateEvidenceSummaryInput => ({
  logId: "log-1",
  vehicleId: "vehicle-1",
  userId: "user-1",
  summaryPayload: {
    avg_boost: 18.4,
    max_boost: 22.1,
    summary: {
      rows_parsed: 42,
      engine_v2: { quickVerdict: "Synthetic test verdict" },
    },
  },
  processingContractVersion: "1.0",
  loggerPlatform: "mhd",
  sourceAvailability: "available",
  processingStartedAt: "2026-08-18T00:00:00.000Z",
});

type PromotionMode =
  | "valid"
  | "throw_before_commit"
  | "throw_after_commit"
  | "malformed_before_commit"
  | "malformed_after_commit"
  | "third_authority";

class FakeDatabase implements EvidencePersistenceDatabase {
  readonly summaries = new Map<string, Record<string, unknown>>();
  authority: string | null;
  insertFails = false;
  verificationFails = false;
  reconciliationReadFails = false;
  promotionMode: PromotionMode = "valid";
  promotionCalls = 0;
  authorityReads = 0;
  private nextCandidate = 1;

  constructor(previousAuthority: string | null = null) {
    this.authority = previousAuthority;
    if (previousAuthority) {
      this.summaries.set(previousAuthority, {
        id: previousAuthority,
        log_id: "log-1",
        vehicle_id: "vehicle-1",
        user_id: "user-1",
        summary: { engine_v2: { historical: true } },
        created_at: "2099-01-01T00:00:00.000Z",
      });
    }
  }

  async insertCandidate(row: Readonly<Record<string, unknown>>) {
    if (this.insertFails) return { data: null, failed: true };
    const id = `candidate-${this.nextCandidate++}`;
    this.summaries.set(id, { id, ...row });
    return { data: { id }, failed: false };
  }

  async readCandidate(candidateId: string) {
    const candidate = this.summaries.get(candidateId);
    if (!candidate) return { data: null, failed: true };
    if (this.verificationFails) {
      return {
        data: { ...candidate, log_id: "different-log" },
        failed: false,
      };
    }
    return { data: candidate, failed: false };
  }

  async readAuthority() {
    this.authorityReads += 1;
    if (this.reconciliationReadFails && this.authorityReads > 1) {
      return { data: null, failed: true };
    }
    return {
      data: { authoritative_log_summary_id: this.authority },
      failed: false,
    };
  }

  async promoteCandidate(values: Readonly<Record<string, unknown>>) {
    this.promotionCalls += 1;
    const candidate = String(values.p_candidate_summary_id);
    const previous = this.authority;

    if (this.promotionMode === "throw_before_commit") {
      throw new Error("synthetic transport failure");
    }
    if (this.promotionMode === "throw_after_commit") {
      this.authority = candidate;
      throw new Error("synthetic lost response");
    }
    if (this.promotionMode === "malformed_before_commit") {
      return { data: [{ unexpected: true }], failed: false };
    }
    if (this.promotionMode === "malformed_after_commit") {
      this.authority = candidate;
      return { data: [{ unexpected: true }], failed: false };
    }
    if (this.promotionMode === "third_authority") {
      this.authority = "summary-third";
      return { data: null, failed: true };
    }

    this.authority = candidate;
    return {
      data: [
        {
          log_id: values.p_log_id,
          previous_authoritative_log_summary_id: previous,
          authoritative_log_summary_id: candidate,
          outcome_kind: "evidence_established",
          completed_at: "2026-08-18T00:01:00.000Z",
        },
      ],
      failed: false,
    };
  }
}

test("first analysis persists, verifies and promotes an exact candidate", async () => {
  const database = new FakeDatabase();
  const promotion = await persistCandidateEvidenceSummary(database, input());

  assert.equal(promotion.resolution, "confirmed_established");
  assert.equal(promotion.previousAuthorityId, null);
  assert.equal(database.authority, promotion.candidateSummaryId);
  assert.equal(database.summaries.size, 1);
  assert.equal(database.promotionCalls, 1);
});

test("reanalysis retains prior history and promotes the returned candidate ID", async () => {
  const database = new FakeDatabase("summary-a");
  const promotion = await persistCandidateEvidenceSummary(database, input());

  assert.equal(promotion.resolution, "confirmed_established");
  assert.equal(promotion.previousAuthorityId, "summary-a");
  assert.equal(database.authority, "candidate-1");
  assert.equal(database.summaries.has("summary-a"), true);
  assert.equal(database.summaries.has("candidate-1"), true);
  assert.equal(database.summaries.size, 2);
});

test("candidate insertion preserves scalar and engine_v2 payload semantics", async () => {
  const database = new FakeDatabase();
  await persistCandidateEvidenceSummary(database, input());
  const candidate = database.summaries.get("candidate-1");

  assert.equal(candidate?.avg_boost, 18.4);
  assert.equal(candidate?.max_boost, 22.1);
  assert.deepEqual(candidate?.summary, {
    rows_parsed: 42,
    engine_v2: { quickVerdict: "Synthetic test verdict" },
  });
  assert.equal(candidate?.log_id, "log-1");
  assert.equal(candidate?.vehicle_id, "vehicle-1");
  assert.equal(candidate?.user_id, "user-1");
});

test("governed source identities cannot be replaced by payload fields", async () => {
  const database = new FakeDatabase();
  const candidateInput = input();
  await persistCandidateEvidenceSummary(database, {
    ...candidateInput,
    summaryPayload: {
      ...candidateInput.summaryPayload,
      log_id: "payload-log",
      vehicle_id: "payload-vehicle",
      user_id: "payload-user",
    },
  });
  const candidate = database.summaries.get("candidate-1");

  assert.equal(candidate?.log_id, "log-1");
  assert.equal(candidate?.vehicle_id, "vehicle-1");
  assert.equal(candidate?.user_id, "user-1");
});

test("candidate insert failure confirms no promotion was established", async () => {
  const database = new FakeDatabase("summary-a");
  database.insertFails = true;
  const promotion = await persistCandidateEvidenceSummary(database, input());

  assert.equal(promotion.resolution, "confirmed_not_established");
  assert.equal(promotion.finding, "candidate_insert_failed");
  assert.equal(database.authority, "summary-a");
  assert.equal(database.promotionCalls, 0);
});

test("candidate verification failure never invokes promotion", async () => {
  const database = new FakeDatabase("summary-a");
  database.verificationFails = true;
  const promotion = await persistCandidateEvidenceSummary(database, input());

  assert.equal(promotion.resolution, "confirmed_not_established");
  assert.equal(promotion.finding, "candidate_verification_failed");
  assert.equal(database.authority, "summary-a");
  assert.equal(database.promotionCalls, 0);
});

test("a valid RPC response confirms establishment without reconciliation", async () => {
  const database = new FakeDatabase("summary-a");
  const promotion = await persistCandidateEvidenceSummary(database, input());

  assert.equal(promotion.resolution, "confirmed_established");
  assert.equal(promotion.reconciliationPerformed, false);
  assert.equal(promotion.currentAuthorityId, "candidate-1");
  assert.equal(promotion.completedAt, "2026-08-18T00:01:00.000Z");
});

test("lost response after commit reconciles candidate as established", async () => {
  const database = new FakeDatabase("summary-a");
  database.promotionMode = "throw_after_commit";
  const promotion = await persistCandidateEvidenceSummary(database, input());

  assert.equal(promotion.resolution, "confirmed_established");
  assert.equal(promotion.reconciliationPerformed, true);
  assert.equal(promotion.currentAuthorityId, "candidate-1");
  assert.equal(database.promotionCalls, 1);
});

test("transport failure before commit reconciles prior authority", async () => {
  const database = new FakeDatabase("summary-a");
  database.promotionMode = "throw_before_commit";
  const promotion = await persistCandidateEvidenceSummary(database, input());

  assert.equal(promotion.resolution, "confirmed_not_established");
  assert.equal(promotion.reconciliationPerformed, true);
  assert.equal(promotion.currentAuthorityId, "summary-a");
  assert.equal(database.promotionCalls, 1);
});

test("malformed response is reconciled and never blindly retried", async () => {
  const database = new FakeDatabase("summary-a");
  database.promotionMode = "malformed_after_commit";
  const promotion = await persistCandidateEvidenceSummary(database, input());

  assert.equal(promotion.resolution, "confirmed_established");
  assert.equal(promotion.reconciliationPerformed, true);
  assert.equal(database.promotionCalls, 1);
});

test("null prior authority remaining null confirms not established", async () => {
  const database = new FakeDatabase();
  database.promotionMode = "malformed_before_commit";
  const promotion = await persistCandidateEvidenceSummary(database, input());

  assert.equal(promotion.resolution, "confirmed_not_established");
  assert.equal(promotion.previousAuthorityId, null);
  assert.equal(promotion.currentAuthorityId, null);
});

test("unexpected third authority requires reconciliation", async () => {
  const database = new FakeDatabase("summary-a");
  database.promotionMode = "third_authority";
  const promotion = await persistCandidateEvidenceSummary(database, input());

  assert.equal(promotion.resolution, "reconciliation_required");
  assert.equal(promotion.currentAuthorityKnown, true);
  assert.equal(promotion.currentAuthorityId, "summary-third");
  assert.equal(promotion.finding, "authority_integrity_discrepancy");
});

test("failed reconciliation read remains operationally indeterminate", async () => {
  const database = new FakeDatabase("summary-a");
  database.promotionMode = "throw_before_commit";
  database.reconciliationReadFails = true;
  const promotion = await persistCandidateEvidenceSummary(database, input());

  assert.equal(promotion.resolution, "reconciliation_required");
  assert.equal(promotion.currentAuthorityKnown, false);
  assert.equal(promotion.finding, "authority_reconciliation_failed");
});

test("promotion results are immutable operational state", async () => {
  const promotion = await persistCandidateEvidenceSummary(
    new FakeDatabase(),
    input()
  );
  assert.equal(Object.isFrozen(promotion), true);
});

test("trusted server configuration fails closed without its private key", () => {
  assert.throws(
    () =>
      resolveTrustedServerConfiguration({
        NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      }),
    /trusted supabase server configuration is unavailable/i
  );
  assert.deepEqual(
    resolveTrustedServerConfiguration({
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "synthetic-test-key",
    }),
    {
      supabaseUrl: "https://example.supabase.co",
      serviceRoleKey: "synthetic-test-key",
    }
  );
});

test("runtime path is server-only and contains no destructive replacement", () => {
  const route = readFileSync(
    "app/api/vehicles/update-log/route.ts",
    "utf8"
  );
  const trustedServer = readFileSync(
    "lib/supabase/trustedServer.ts",
    "utf8"
  );
  const trustedConfiguration = readFileSync(
    "lib/supabase/trustedServerConfiguration.ts",
    "utf8"
  );
  const persistence = readFileSync(
    "lib/analysis/evidenceCandidatePersistence.ts",
    "utf8"
  );

  assert.match(trustedServer, /^import "server-only";/);
  assert.match(trustedConfiguration, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(
    `${trustedServer}\n${trustedConfiguration}`,
    /NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY/
  );
  assert.doesNotMatch(route, /from\("log_summaries"\)\.delete/);
  assert.doesNotMatch(route, /authoritative_log_summary_id\s*:/);
  assert.doesNotMatch(route, /evidence_processing_outcome_kind\s*:/);
  assert.match(
    persistence,
    /client\.rpc\(\s*"establish_log_summary_authority_v1"/
  );
  assert.doesNotMatch(persistence, /\.update\(/);
  assert.doesNotMatch(persistence, /\.delete\(/);
  assert.doesNotMatch(persistence, /created_at/);
  assert.doesNotMatch(persistence, /GearSegment|ShiftEvent|AccelerationRun/);
});

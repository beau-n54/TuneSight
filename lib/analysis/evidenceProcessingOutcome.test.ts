import assert from "node:assert/strict";
import test from "node:test";
import {
  EVIDENCE_PROCESSING_OUTCOME_KINDS,
  EVIDENCE_PROCESSING_STAGES,
  defineEvidenceProcessingOutcome,
  type EvidenceEstablishedOutcome,
  type EvidenceProcessingOutcome,
} from "./evidenceProcessingOutcome.ts";

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends
  <Value>() => Value extends Right ? 1 : 2
    ? true
    : false;
type Assert<Value extends true> = Value;
type FailureOutcome = Exclude<
  EvidenceProcessingOutcome,
  EvidenceEstablishedOutcome
>;

type EstablishedAvailabilityIsAuthoritative = Assert<
  Equal<EvidenceEstablishedOutcome["evidenceAvailability"], "authoritative">
>;
type EstablishedConsumptionIsPermitted = Assert<
  Equal<EvidenceEstablishedOutcome["downstreamConsumption"], "permitted">
>;
type FailureAvailabilityIsUnavailable = Assert<
  Equal<FailureOutcome["evidenceAvailability"], "unavailable">
>;
type FailureConsumptionIsBlocked = Assert<
  Equal<FailureOutcome["downstreamConsumption"], "blocked">
>;

const compileTimeContractChecks: readonly [
  EstablishedAvailabilityIsAuthoritative,
  EstablishedConsumptionIsPermitted,
  FailureAvailabilityIsUnavailable,
  FailureConsumptionIsBlocked,
] = [true, true, true, true];

const establishedInput = (): EvidenceEstablishedOutcome => ({
  contractVersion: "1.0",
  kind: "evidence_established",
  stage: "evidence_persistence",
  sourceLogId: "log:1",
  loggerPlatform: "mhd",
  sourceAvailability: "available",
  evidenceAvailability: "authoritative",
  downstreamConsumption: "permitted",
  retryDisposition: "not_required",
  authoritativeEvidenceReference: {
    evidenceId: "evidence:1",
    persistenceReference: "log_summaries:1",
  },
});

test("defines exactly five terminal outcomes separate from six processing stages", () => {
  assert.deepEqual(EVIDENCE_PROCESSING_OUTCOME_KINDS, [
    "evidence_established",
    "unsupported_source",
    "invalid_or_incomplete_source",
    "processing_failed",
    "persistence_failed",
  ]);
  assert.deepEqual(EVIDENCE_PROCESSING_STAGES, [
    "source_registration",
    "raw_source_storage",
    "source_classification",
    "translation",
    "evidence_derivation",
    "evidence_persistence",
  ]);
  assert.equal(
    EVIDENCE_PROCESSING_OUTCOME_KINDS.some((kind) =>
      (EVIDENCE_PROCESSING_STAGES as readonly string[]).includes(kind)
    ),
    false
  );
  assert.deepEqual(compileTimeContractChecks, [true, true, true, true]);
});

test("establishes only persisted authoritative Evidence for downstream consumption", () => {
  const outcome = defineEvidenceProcessingOutcome(establishedInput());
  assert.equal(outcome.evidenceAvailability, "authoritative");
  assert.equal(outcome.downstreamConsumption, "permitted");
  assert.equal(outcome.retryDisposition, "not_required");
  assert.deepEqual(outcome.authoritativeEvidenceReference, {
    evidenceId: "evidence:1",
    persistenceReference: "log_summaries:1",
  });

  assert.throws(
    () =>
      defineEvidenceProcessingOutcome({
        ...establishedInput(),
        stage: "evidence_derivation",
      } as unknown as EvidenceProcessingOutcome),
    /completed persistence/
  );
  assert.throws(
    () =>
      defineEvidenceProcessingOutcome({
        ...establishedInput(),
        authoritativeEvidenceReference: null,
      } as unknown as EvidenceProcessingOutcome),
    /authoritative reference/
  );
});

test("keeps unsupported reasons exclusive to unsupported source outcomes", () => {
  const outcome = defineEvidenceProcessingOutcome({
    contractVersion: "1.0",
    kind: "unsupported_source",
    stage: "source_classification",
    sourceLogId: "log:2",
    loggerPlatform: "unknown",
    sourceAvailability: "available",
    evidenceAvailability: "unavailable",
    downstreamConsumption: "blocked",
    retryDisposition: "retryable_from_source",
    reasonCode: "unknown_source_format",
  });
  assert.equal(outcome.reasonCode, "unknown_source_format");
  assert.equal(outcome.evidenceAvailability, "unavailable");

  assert.throws(
    () =>
      defineEvidenceProcessingOutcome({
        ...outcome,
        reasonCode: "no_usable_rows",
      } as unknown as EvidenceProcessingOutcome),
    /Unsupported source reason code/
  );
});

test("keeps invalid-source reasons exclusive to invalid or incomplete outcomes", () => {
  const outcome = defineEvidenceProcessingOutcome({
    contractVersion: "1.0",
    kind: "invalid_or_incomplete_source",
    stage: "translation",
    sourceLogId: "log:3",
    loggerPlatform: "bm3",
    sourceAvailability: "available",
    evidenceAvailability: "unavailable",
    downstreamConsumption: "blocked",
    retryDisposition: "not_retryable",
    reasonCode: "missing_required_core_channels",
  });
  assert.equal(outcome.reasonCode, "missing_required_core_channels");

  assert.throws(
    () =>
      defineEvidenceProcessingOutcome({
        ...outcome,
        reasonCode: "translator_unavailable",
      } as unknown as EvidenceProcessingOutcome),
    /Invalid or incomplete source reason code/
  );
});

test("binds processing failure reason to the exact failed stage", () => {
  const outcome = defineEvidenceProcessingOutcome({
    contractVersion: "1.0",
    kind: "processing_failed",
    stage: "evidence_derivation",
    sourceLogId: "log:4",
    loggerPlatform: "mhd",
    sourceAvailability: "available",
    evidenceAvailability: "unavailable",
    downstreamConsumption: "blocked",
    retryDisposition: "retryable_from_source",
    reasonCode: "evidence_derivation_failure",
    diagnosticReference: "diagnostic:4",
  });
  assert.equal(outcome.stage, "evidence_derivation");
  assert.equal(outcome.downstreamConsumption, "blocked");

  assert.throws(
    () =>
      defineEvidenceProcessingOutcome({
        ...outcome,
        stage: "translation",
      } as unknown as EvidenceProcessingOutcome),
    /does not match its failed stage/
  );
  assert.throws(
    () =>
      defineEvidenceProcessingOutcome({
        ...outcome,
        diagnosticReference: "Raw exception text must not become authority",
      }),
    /bounded identity, not diagnostic prose/
  );
});

test("makes persistence failure the failed authority boundary without transient Evidence", () => {
  const outcome = defineEvidenceProcessingOutcome({
    contractVersion: "1.0",
    kind: "persistence_failed",
    stage: "evidence_persistence",
    sourceLogId: "log:5",
    loggerPlatform: "mhd",
    sourceAvailability: "available",
    evidenceAvailability: "unavailable",
    downstreamConsumption: "blocked",
    retryDisposition: "retryable_from_source",
    reasonCode: "authoritative_evidence_write_failure",
    diagnosticReference: null,
  });
  assert.equal(outcome.evidenceAvailability, "unavailable");
  assert.equal("authoritativeEvidenceReference" in outcome, false);

  assert.throws(
    () =>
      defineEvidenceProcessingOutcome({
        ...outcome,
        transientComputedEvidence: { events: [] },
      } as unknown as EvidenceProcessingOutcome),
    /unsupported field transientComputedEvidence/
  );
});

test("keeps raw-source availability independent from Evidence availability", () => {
  const available = defineEvidenceProcessingOutcome({
    contractVersion: "1.0",
    kind: "unsupported_source",
    stage: "translation",
    sourceLogId: "log:6",
    loggerPlatform: "xhp",
    sourceAvailability: "available",
    evidenceAvailability: "unavailable",
    downstreamConsumption: "blocked",
    retryDisposition: "retryable_from_source",
    reasonCode: "translator_unavailable",
  });
  const unavailable = defineEvidenceProcessingOutcome({
    contractVersion: "1.0",
    kind: "processing_failed",
    stage: "raw_source_storage",
    sourceLogId: "log:7",
    loggerPlatform: null,
    sourceAvailability: "unavailable",
    evidenceAvailability: "unavailable",
    downstreamConsumption: "blocked",
    retryDisposition: "not_retryable",
    reasonCode: "raw_source_storage_failure",
    diagnosticReference: null,
  });
  assert.equal(available.sourceAvailability, "available");
  assert.equal(unavailable.sourceAvailability, "unavailable");
  assert.equal(available.evidenceAvailability, unavailable.evidenceAvailability);
});

test("requires retry capability to agree with preserved source availability", () => {
  assert.throws(
    () =>
      defineEvidenceProcessingOutcome({
        contractVersion: "1.0",
        kind: "processing_failed",
        stage: "source_registration",
        sourceLogId: null,
        loggerPlatform: null,
        sourceAvailability: "unavailable",
        evidenceAvailability: "unavailable",
        downstreamConsumption: "blocked",
        retryDisposition: "retryable_from_source",
        reasonCode: "source_registration_failure",
        diagnosticReference: null,
      }),
    /Source retry requires an available raw source/
  );
});

test("constructs deeply immutable isolated JSON-compatible records deterministically", () => {
  const input = establishedInput();
  const first = defineEvidenceProcessingOutcome(input);
  const second = defineEvidenceProcessingOutcome(establishedInput());
  const reordered = defineEvidenceProcessingOutcome({
    authoritativeEvidenceReference: {
      persistenceReference: "log_summaries:1",
      evidenceId: "evidence:1",
    },
    retryDisposition: "not_required",
    downstreamConsumption: "permitted",
    evidenceAvailability: "authoritative",
    sourceAvailability: "available",
    loggerPlatform: "mhd",
    sourceLogId: "log:1",
    stage: "evidence_persistence",
    kind: "evidence_established",
    contractVersion: "1.0",
  });

  assert.notEqual(first, input);
  assert.notEqual(
    first.authoritativeEvidenceReference,
    input.authoritativeEvidenceReference
  );
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.authoritativeEvidenceReference), true);
  assert.equal(JSON.stringify(first), JSON.stringify(second));
  assert.equal(JSON.stringify(first), JSON.stringify(reordered));
  assert.deepEqual(JSON.parse(JSON.stringify(first)), first);

  assert.throws(() => {
    (first.authoritativeEvidenceReference as { evidenceId: string }).evidenceId =
      "changed";
  }, TypeError);
  assert.equal(input.authoritativeEvidenceReference.evidenceId, "evidence:1");
});

test("keeps Analysis Snapshot and Run Intelligence outside the contract", () => {
  const serialized = JSON.stringify(defineEvidenceProcessingOutcome(establishedInput()));
  for (const prohibited of [
    "analysisSnapshot",
    "gearEvidence",
    "gearSegment",
    "shiftEvent",
    "accelerationRun",
  ]) {
    assert.equal(serialized.includes(prohibited), false);
  }
});

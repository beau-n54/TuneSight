import assert from "node:assert/strict";
import test from "node:test";
import type { TranslatedLog } from "../logging/types.ts";
import {
  qualifyEvidenceSource,
  qualifyTranslatedEvidenceSource,
  type EvidenceSourceQualification,
} from "./evidenceSourceQualification.ts";

const context = Object.freeze({
  sourceLogId: "log:qualification",
  sourceAvailability: "available" as const,
});

const mhdRows = () => [
  {
    Time: 0,
    RPM: 3000,
    "Boost Mean PSI": 15,
    "Boost Target": 17,
    WGDC: 70,
    "Accel. Pedal[%]": 100,
  },
  {
    Time: 0.1,
    RPM: 3200,
    "Boost Mean PSI": 16,
    "Boost Target": 18,
    WGDC: 72,
    "Accel. Pedal[%]": 100,
  },
];

const bm3Rows = () => [
  {
    Time: 0,
    RPM: 3000,
    "Load Actual": 120,
    "Boost Pressure": 15,
    "Target Boost": 17,
    "Pedal Position": 100,
  },
  {
    Time: 0.1,
    RPM: 3200,
    "Load Actual": 125,
    "Boost Pressure": 16,
    "Target Boost": 18,
    "Pedal Position": 100,
  },
];

function canDeriveEvidence(qualification: EvidenceSourceQualification): boolean {
  return qualification.kind === "supported_and_usable";
}

test("valid MHD qualifies as supported and usable without changing telemetry", () => {
  const qualification = qualifyEvidenceSource(mhdRows(), context);
  assert.equal(qualification.kind, "supported_and_usable");
  assert.equal(canDeriveEvidence(qualification), true);
  assert.equal(qualification.translatedLog.platform, "mhd");
  assert.deepEqual(qualification.translatedLog.rows.map((row) => row.rpm), [
    3000,
    3200,
  ]);
  assert.deepEqual(
    qualification.translatedLog.rows.map((row) => row.throttle),
    [100, 100]
  );
});

test("valid BM3 qualifies as supported and usable without changing telemetry", () => {
  const qualification = qualifyEvidenceSource(bm3Rows(), context);
  assert.equal(qualification.kind, "supported_and_usable");
  assert.equal(qualification.translatedLog.platform, "bm3");
  assert.deepEqual(
    qualification.translatedLog.rows.map((row) => row.boostPsi),
    [15, 16]
  );
  assert.deepEqual(
    qualification.translatedLog.rows.map((row) => row.boostTargetPsi),
    [17, 18]
  );
});

test("unknown source maps to the canonical unsupported outcome", () => {
  const qualification = qualifyEvidenceSource(
    [{ Timestamp: 0, "Unrecognised Channel": 1 }],
    context
  );
  assert.equal(qualification.kind, "unsupported_source");
  assert.equal(canDeriveEvidence(qualification), false);
  if (qualification.kind !== "unsupported_source") return;
  assert.equal(qualification.outcome.reasonCode, "unknown_source_format");
  assert.equal(qualification.outcome.stage, "source_classification");
  assert.equal(qualification.outcome.evidenceAvailability, "unavailable");
  assert.equal(qualification.outcome.downstreamConsumption, "blocked");
  assert.equal(qualification.outcome.sourceAvailability, "available");
});

test("recognised unimplemented translators remain unsupported capabilities", () => {
  const cases = [
    { row: { Gear: 3 }, platform: "xhp" },
    { row: { "Manifold Pressure": 20 }, platform: "dimsport" },
    { row: { ProTool: 1 }, platform: "protool" },
  ] as const;

  for (const item of cases) {
    const qualification = qualifyEvidenceSource([item.row], context);
    assert.equal(qualification.kind, "unsupported_source");
    if (qualification.kind !== "unsupported_source") continue;
    assert.equal(qualification.translatedLog.platform, item.platform);
    assert.equal(qualification.outcome.reasonCode, "translator_unavailable");
    assert.equal(qualification.outcome.stage, "translation");
    assert.equal(qualification.outcome.evidenceAvailability, "unavailable");
    assert.equal(qualification.outcome.downstreamConsumption, "blocked");
  }
});

test("implemented translator with no translated rows is invalid rather than unsupported", () => {
  const translated: TranslatedLog = {
    platform: "mhd",
    confidence: 0.9,
    rowCount: 0,
    rows: [],
    detectedHeaders: ["Boost Mean PSI"],
    missingCoreChannels: ["rpm", "boostTargetPsi", "throttle"],
  };
  const qualification = qualifyTranslatedEvidenceSource(translated, context);
  assert.equal(qualification.kind, "invalid_or_incomplete_source");
  if (qualification.kind !== "invalid_or_incomplete_source") return;
  assert.equal(qualification.outcome.reasonCode, "no_usable_rows");
  assert.equal(qualification.outcome.stage, "translation");
  assert.equal(qualification.outcome.evidenceAvailability, "unavailable");
  assert.equal(qualification.outcome.downstreamConsumption, "blocked");
});

test("supported headers with no usable numeric observations remain invalid, not unknown", () => {
  const qualification = qualifyEvidenceSource(
    [{}],
    context,
    ["RPM", "Boost Mean PSI", "Boost Target", "Accel. Pedal[%]"]
  );
  assert.equal(qualification.kind, "invalid_or_incomplete_source");
  if (qualification.kind !== "invalid_or_incomplete_source") return;
  assert.equal(qualification.translatedLog.platform, "mhd");
  assert.equal(qualification.outcome.reasonCode, "no_usable_rows");
});

test("supported header-only source remains invalid rather than unknown", () => {
  const qualification = qualifyEvidenceSource(
    [],
    context,
    ["RPM", "Boost Pressure", "Target Boost", "Pedal Position"]
  );
  assert.equal(qualification.kind, "invalid_or_incomplete_source");
  if (qualification.kind !== "invalid_or_incomplete_source") return;
  assert.equal(qualification.translatedLog.platform, "bm3");
  assert.equal(qualification.translatedLog.rowCount, 0);
  assert.deepEqual(qualification.translatedLog.rows, []);
  assert.equal(qualification.outcome.reasonCode, "no_usable_rows");
});

test("missing governed core channels preserves exact diagnostic identities", () => {
  const qualification = qualifyEvidenceSource(
    [
      {
        RPM: 3000,
        "Boost Mean PSI": 15,
        "Boost Target": 17,
      },
    ],
    context
  );
  assert.equal(qualification.kind, "invalid_or_incomplete_source");
  if (qualification.kind !== "invalid_or_incomplete_source") return;
  assert.equal(
    qualification.outcome.reasonCode,
    "missing_required_core_channels"
  );
  assert.deepEqual(qualification.missingRequiredCoreChannels, ["throttle"]);
});

test("non-finite core observations and row misalignment are structurally invalid", () => {
  const base: TranslatedLog = {
    platform: "bm3",
    confidence: 0.9,
    rowCount: 1,
    rows: [
      {
        rpm: 3000,
        boostPsi: 15,
        boostTargetPsi: 17,
        throttle: Number.POSITIVE_INFINITY,
      },
    ],
    detectedHeaders: ["RPM", "Boost Pressure", "Boost Target", "Pedal Position"],
    missingCoreChannels: [],
  };
  const nonFinite = qualifyTranslatedEvidenceSource(base, context);
  assert.equal(nonFinite.kind, "invalid_or_incomplete_source");
  if (nonFinite.kind === "invalid_or_incomplete_source") {
    assert.equal(nonFinite.outcome.reasonCode, "invalid_source_observations");
  }

  const misaligned = qualifyTranslatedEvidenceSource(
    { ...base, rowCount: 2, rows: [{ ...base.rows[0], throttle: 100 }] },
    context
  );
  assert.equal(misaligned.kind, "invalid_or_incomplete_source");
  if (misaligned.kind === "invalid_or_incomplete_source") {
    assert.equal(misaligned.outcome.reasonCode, "invalid_source_observations");
  }
});

test("source availability remains independent and controls retry truthfully", () => {
  const qualification = qualifyEvidenceSource(
    [{ Unknown: 1 }],
    { sourceLogId: null, sourceAvailability: "unknown" }
  );
  assert.equal(qualification.kind, "unsupported_source");
  if (qualification.kind !== "unsupported_source") return;
  assert.equal(qualification.outcome.sourceAvailability, "unknown");
  assert.equal(qualification.outcome.evidenceAvailability, "unavailable");
  assert.equal(qualification.outcome.retryDisposition, "retryability_unknown");
});

test("generic gear header does not alter existing MHD-first precedence", () => {
  const mixed = mhdRows().map((row) => ({ ...row, Gear: 3 }));
  const qualification = qualifyEvidenceSource(mixed, context);
  assert.equal(qualification.kind, "supported_and_usable");
  assert.equal(qualification.translatedLog.platform, "mhd");
});

test("generic gear header does not displace existing BM3 precedence", () => {
  const mixed = bm3Rows().map((row) => ({ ...row, Gear: 3 }));
  const qualification = qualifyEvidenceSource(mixed, context);
  assert.equal(qualification.kind, "supported_and_usable");
  assert.equal(qualification.translatedLog.platform, "bm3");
});

test("qualification is deterministic, immutable and leaves input untouched", () => {
  const rows = mhdRows();
  const before = structuredClone(rows);
  const first = qualifyEvidenceSource(rows, context);
  const second = qualifyEvidenceSource(rows, context);
  assert.deepEqual(first, second);
  assert.equal(JSON.stringify(first), JSON.stringify(second));
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.translatedLog), true);
  assert.equal(Object.isFrozen(first.translatedLog.rows), true);
  assert.deepEqual(rows, before);
});

test("qualification contains no persistence lifecycle, snapshot or Run Intelligence", () => {
  const serialized = JSON.stringify(qualifyEvidenceSource(mhdRows(), context));
  for (const prohibited of [
    "analysisSnapshot",
    "gearEvidence",
    "gearSegment",
    "shiftEvent",
    "accelerationRun",
    "processingAttempt",
  ]) {
    assert.equal(serialized.includes(prohibited), false);
  }
});

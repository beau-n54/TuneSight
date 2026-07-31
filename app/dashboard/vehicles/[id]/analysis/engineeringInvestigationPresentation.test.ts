import assert from "node:assert/strict";
import test from "node:test";
import { buildCalibrationInspectionRecords } from "./engineeringInvestigationPresentation.ts";

test("identified XDF records preserve supplied identity and remain inferred", () => {
  const records = buildCalibrationInspectionRecords({
    analysisId: "analysis-1",
    event: {
      id: "event-1",
      rpmStart: 3200,
      rpmEnd: 4100,
      supportingChannels: ["boost", "boost_target"],
      metrics: { peakBoostError: 4.25 },
    },
    relatedXdfTables: [
      {
        tableId: "xdf-table-42",
        tableName: "Boost Target Main",
        category: "boost",
        reason: "Matched overboost to boost table category.",
        confidence: 82,
      },
    ],
    rootCause: {
      rank: "primary",
      cause: "Boost target mismatch",
      confidence: 76,
    },
    tuneId: "tune-1",
    vehicleId: "vehicle-1",
  });

  assert.equal(records.length, 1);
  assert.equal(records[0].exactIdentifier, "xdf-table-42");
  assert.equal(records[0].authorityState, "inferred");
  assert.deepEqual(records[0].rpmRange, [3200, 4100]);
  assert.deepEqual(records[0].supportingChannels, [
    "boost",
    "boost_target",
  ]);
  assert.deepEqual(records[0].measuredValues, [
    { label: "Peak Boost Error", value: "4.25" },
  ]);
  assert.equal(records[0].supports, "primary cause");
});

test("table-name-only guidance remains provisional and never fabricates identity", () => {
  const records = buildCalibrationInspectionRecords({
    event: { id: "event-2" },
    relatedXdfTables: [],
    rootCause: {
      rank: "secondary",
      cause: "Alternative control limit",
      relatedTables: ["Wastegate Duty Cycle Base"],
    },
  });

  assert.equal(records.length, 1);
  assert.equal(records[0].exactIdentifier, null);
  assert.equal(records[0].authorityState, "provisional");
  assert.equal(records[0].subsystem, null);
  assert.equal(records[0].axes.length, 0);
  assert.equal(records[0].supports, "alternative supported cause");
});

test("comparison handoff remains disabled with complete truthful context", () => {
  const record = buildCalibrationInspectionRecords({
    analysisId: "analysis-3",
    event: {
      id: "event-3",
      rpmStart: 2800,
      rpmEnd: 3300,
    },
    observation: 2,
    relatedXdfTables: [{ tableName: "Load Limit" }],
    rootCause: {
      rank: "primary",
      cause: "Torque intervention",
    },
    tuneId: "tune-3",
    vehicleId: "vehicle-3",
  })[0];

  assert.equal(record.comparisonHandoff.enabled, false);
  assert.match(
    record.comparisonHandoff.unavailableReason,
    /not implemented/
  );
  assert.deepEqual(record.comparisonHandoff.context, {
    vehicleId: "vehicle-3",
    tuneId: "tune-3",
    analysisId: "analysis-3",
    eventId: "event-3",
    observation: 2,
    rpmStart: 2800,
    rpmEnd: 3300,
    recommendedTable: "Load Limit",
    reason:
      "The supplied event-scoped engineering result identifies Load Limit as a calibration area for inspection.",
  });
});

test("no XDF recommendation produces no fabricated inspection record", () => {
  const records = buildCalibrationInspectionRecords({
    event: null,
    relatedXdfTables: [],
    rootCause: {
      rank: "primary",
      cause: "Unresolved",
    },
  });

  assert.deepEqual(records, []);
});

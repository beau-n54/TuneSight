import assert from "node:assert/strict";
import test from "node:test";
import {
  buildGraphPoints,
  getSeries,
  getHorizontalAxisPresentation,
  hasRecordedTelemetry,
  resolveGraphSeries,
  resolveRegionCoordinates,
  TELEMETRY_CHANNELS,
  TELEMETRY_PANEL_CLASS_NAME,
  TELEMETRY_SECTION_CLASS_NAME,
} from "./telemetryGraphPresentation.ts";

test("graph points preserve every original telemetry sample", () => {
  const boost = [2.1, 8.7, 5.4, 12.3];
  const rpm = [1800, 2400, 3000, 3600];
  const series = resolveGraphSeries(
    { boost },
    [TELEMETRY_CHANNELS.boostActual]
  );

  const result = buildGraphPoints(series, rpm);

  assert.equal(result.usesRpm, true);
  assert.deepEqual(
    result.points.map((point) => point.boost_actual),
    boost
  );
  assert.deepEqual(
    result.points.map((point) => point.x),
    rpm
  );
  assert.equal(Math.max(...boost), 12.3);
  assert.equal(Math.min(...boost), 2.1);
});

test("missing RPM never creates estimated engineering values", () => {
  const series = resolveGraphSeries(
    { boost: [1, 4, 2] },
    [TELEMETRY_CHANNELS.boostActual]
  );

  const result = buildGraphPoints(series, []);

  assert.equal(result.usesRpm, false);
  assert.deepEqual(
    result.points.map((point) => point.x),
    [0, 1, 2]
  );
  assert.deepEqual(
    result.points.map((point) => point.rpm),
    [null, null, null]
  );
});

test("multi-pull RPM resets use sample sequence without losing RPM", () => {
  const series = resolveGraphSeries(
    { boost: [1, 4, 2, 5] },
    [TELEMETRY_CHANNELS.boostActual]
  );
  const rpm = [2000, 5000, 1800, 5200];

  const result = buildGraphPoints(series, rpm);

  assert.equal(result.usesRpm, false);
  assert.equal(result.hasStoredRpm, true);
  assert.deepEqual(
    result.points.map((point) => point.x),
    [0, 1, 2, 3]
  );
  assert.deepEqual(
    result.points.map((point) => point.rpm),
    rpm
  );
});

test("axis labels distinguish RPM from sample sequence", () => {
  assert.deepEqual(
    getHorizontalAxisPresentation({
      usesRpm: true,
      hasStoredRpm: true,
    }),
    {
      label: "Engine Speed (RPM)",
      note: "RPM-indexed record.",
    }
  );

  assert.deepEqual(
    getHorizontalAxisPresentation({
      usesRpm: false,
      hasStoredRpm: true,
    }),
    {
      label: "Sample Sequence",
      note:
        "Sample-sequenced record. Hover for exact recorded RPM.",
    }
  );
});

test("canonical BMW border convention is applied to telemetry section", () => {
  assert.match(TELEMETRY_SECTION_CLASS_NAME, /\bbmw-border\b/);
  assert.match(TELEMETRY_PANEL_CLASS_NAME, /\bbmw-border\b/);
  assert.match(TELEMETRY_PANEL_CLASS_NAME, /\bborder-zinc-800\b/);
});

test("empty-state logic preserves legitimate zero telemetry", () => {
  assert.equal(hasRecordedTelemetry([]), false);
  assert.equal(hasRecordedTelemetry([0, 0, 0]), true);
});

test("shared panel resolution is platform agnostic", () => {
  const representativeTelemetry = [
    { boost: [1, 2], boostTarget: [2, 3] },
    { wgdc: [80, 90], throttle: [100, 100] },
    { cyl1TimingCorrection: [0, -1] },
  ];

  for (const telemetry of representativeTelemetry) {
    const resolved = resolveGraphSeries(telemetry, [
      TELEMETRY_CHANNELS.boostActual,
      TELEMETRY_CHANNELS.boostTarget,
      TELEMETRY_CHANNELS.wastegateDuty,
      TELEMETRY_CHANNELS.throttlePosition,
    ]);

    assert.ok(Array.isArray(resolved));
  }
});

test("target and actual values remain separate unchanged series", () => {
  const actual = [10, 12, 11];
  const target = [11, 13, 13];
  const series = resolveGraphSeries(
    { boost: actual, boostTarget: target },
    [
      TELEMETRY_CHANNELS.boostActual,
      TELEMETRY_CHANNELS.boostTarget,
    ]
  );

  const { points } = buildGraphPoints(series, [2500, 3000, 3500]);

  assert.deepEqual(
    points.map((point) => point.boost_actual),
    actual
  );
  assert.deepEqual(
    points.map((point) => point.boost_target),
    target
  );
});

test("pull and event regions use exact supplied sample boundaries", () => {
  const series = resolveGraphSeries(
    { boost: [1, 2, 3, 4, 5] },
    [TELEMETRY_CHANNELS.boostActual]
  );
  const { points } = buildGraphPoints(
    series,
    [1800, 2200, 2600, 3000, 3400]
  );

  const regions = resolveRegionCoordinates(
    [
      {
        id: "pull_1",
        label: "Pull 1",
        startIndex: 1,
        endIndex: 4,
        kind: "pull",
        supportingChannels: [],
      },
      {
        id: "event_1",
        label: "Boost undershoot",
        startIndex: 2,
        endIndex: 3,
        kind: "event",
        supportingChannels: ["boost", "boost_target"],
      },
    ],
    points
  );

  assert.deepEqual(
    regions.map(({ x1, x2 }) => [x1, x2]),
    [
      [2200, 3400],
      [2600, 3000],
    ]
  );
});

test("channel aliases resolve without changing their samples", () => {
  const values = [1000, 1500, 1700];

  assert.deepEqual(
    getSeries({ rail_pressure: values }, ["railPressure", "rail_pressure"]),
    values
  );
});

test("invalid source samples are not removed or shifted", () => {
  assert.deepEqual(
    getSeries(
      { boost: [1, "invalid", 3] },
      TELEMETRY_CHANNELS.boostActual.aliases
    ),
    []
  );
});

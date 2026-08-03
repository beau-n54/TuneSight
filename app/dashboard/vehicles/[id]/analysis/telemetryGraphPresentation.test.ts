import assert from "node:assert/strict";
import test from "node:test";
import {
  buildGraphPoints,
  formatHorizontalAxisTick,
  getSeries,
  getRpmSeries,
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

test("placeholder RPM values retain the truthful Sample Sequence fallback", () => {
  const series = resolveGraphSeries(
    { boost: [1, 4, 2] },
    [TELEMETRY_CHANNELS.boostActual]
  );

  const result = buildGraphPoints(series, [0, 0, 0]);

  assert.equal(result.usesRpm, false);
  assert.equal(result.hasStoredRpm, false);
  assert.deepEqual(
    result.points.map((point) => point.x),
    [0, 1, 2]
  );
  assert.deepEqual(
    result.points.map((point) => point.rpm),
    [null, null, null]
  );
});

test("multi-pull RPM resets preserve sample order with Sample Sequence", () => {
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

test("separate pulls cannot become one continuous RPM sweep", () => {
  const series = resolveGraphSeries(
    { boost: [1, 2, 3, 4] },
    [TELEMETRY_CHANNELS.boostActual]
  );
  const result = buildGraphPoints(
    series,
    [2000, 3000, 4000, 5000],
    4,
    true
  );

  assert.equal(result.axisMode, "sample_sequence");
  assert.deepEqual(
    result.points.map((point) => point.x),
    [0, 1, 2, 3]
  );
});

test("individual pull points retain exact source sample identity", () => {
  const series = resolveGraphSeries(
    { boost: [4, 6, 8] },
    [TELEMETRY_CHANNELS.boostActual]
  );
  const result = buildGraphPoints(
    series,
    [2200, 2800, 3400],
    3,
    false,
    7
  );

  assert.deepEqual(result.points.map(({ index }) => index), [7, 8, 9]);
  assert.deepEqual(result.points.map(({ x }) => x), [2200, 2800, 3400]);
});

test("individual pull with non-monotonic RPM retains source Sample Sequence", () => {
  const series = resolveGraphSeries(
    { boost: [4, 6, 8] },
    [TELEMETRY_CHANNELS.boostActual]
  );
  const result = buildGraphPoints(
    series,
    [2200, 3000, 2800],
    3,
    false,
    7
  );

  assert.equal(result.axisMode, "sample_sequence");
  assert.deepEqual(result.points.map(({ index }) => index), [7, 8, 9]);
  assert.deepEqual(result.points.map(({ x }) => x), [7, 8, 9]);
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
      hasStoredRpm: false,
    }),
    {
      label: "Sample Sequence",
      note: "Sample-sequenced record. RPM was not recorded.",
    }
  );
});

test("visible axis labels use recorded RPM without changing sample coordinates", () => {
  const series = resolveGraphSeries(
    { boost: [1, 4, 2, 5] },
    [TELEMETRY_CHANNELS.boostActual]
  );
  const result = buildGraphPoints(series, [2000, 3000, 4000, 5000]);

  assert.deepEqual(
    result.points.map((point) => point.x),
    [2000, 3000, 4000, 5000]
  );
  assert.deepEqual(
    result.points.map((point) => point.rpm),
    [2000, 3000, 4000, 5000]
  );
  assert.equal(
    formatHorizontalAxisTick(2000, result.points, result.usesRpm),
    "2,000"
  );
  assert.equal(
    formatHorizontalAxisTick(4000, result.points, result.usesRpm),
    "4,000"
  );
  assert.equal(
    formatHorizontalAxisTick(2, result.points, false),
    "3"
  );
});

test("duplicate RPM values remain deterministic on the RPM domain", () => {
  const series = resolveGraphSeries(
    { boost: [1, 2, 3, 4] },
    [TELEMETRY_CHANNELS.boostActual]
  );
  const result = buildGraphPoints(series, [2000, 2500, 2500, 3000]);

  assert.equal(result.usesRpm, true);
  assert.deepEqual(
    result.points.map((point) => point.x),
    [2000, 2500, 2500, 3000]
  );
  assert.deepEqual(
    result.points.map((point) => point.index),
    [0, 1, 2, 3]
  );
});

test("partially invalid RPM preserves sample identity and valid tooltip RPM", () => {
  const series = resolveGraphSeries(
    { boost: [1, 2, 3, 4] },
    [TELEMETRY_CHANNELS.boostActual]
  );
  const rpm = getRpmSeries(
    { rpm: [1800, "invalid", 2800, 3400] },
    ["rpm"]
  );
  const result = buildGraphPoints(series, rpm);

  assert.equal(result.usesRpm, false);
  assert.equal(result.hasStoredRpm, true);
  assert.deepEqual(
    result.points.map((point) => point.x),
    [0, 1, 2, 3]
  );
  assert.deepEqual(
    result.points.map((point) => point.rpm),
    [1800, null, 2800, 3400]
  );
});

test("observed backward RPM sequence cannot claim an RPM-indexed axis", () => {
  const series = resolveGraphSeries(
    { boost: [1, 2, 3, 4, 5] },
    [TELEMETRY_CHANNELS.boostActual]
  );
  const result = buildGraphPoints(
    series,
    [820, 815, 6348, 5921, 7000]
  );

  assert.equal(result.usesRpm, false);
  assert.equal(result.axisMode, "sample_sequence");
  assert.deepEqual(
    result.points.map((point) => point.x),
    [0, 1, 2, 3, 4]
  );
  assert.deepEqual(
    getHorizontalAxisPresentation(result),
    {
      label: "Sample Sequence",
      note: "Sample-sequenced record. Hover for exact recorded RPM.",
    }
  );
});

test("shared sample count gives every panel the same x-domain contract", () => {
  const boost = resolveGraphSeries(
    { boost: [1, 2, 3, 4] },
    [TELEMETRY_CHANNELS.boostActual]
  );
  const fuel = resolveGraphSeries(
    { rail_pressure: [1000, 1200, 1400] },
    [TELEMETRY_CHANNELS.highPressureFuel]
  );
  const rpm = [2000, 3000, 2500, 4000];

  const boostResult = buildGraphPoints(boost, rpm, 4);
  const fuelResult = buildGraphPoints(fuel, rpm, 4);

  assert.equal(boostResult.axisMode, "sample_sequence");
  assert.equal(fuelResult.axisMode, "sample_sequence");
  assert.deepEqual(
    fuelResult.points.map((point) => point.x),
    [0, 1, 2, 3]
  );
});

test("event regions retain sample identity in both axis modes", () => {
  const series = resolveGraphSeries(
    { boost: [1, 2, 3, 4] },
    [TELEMETRY_CHANNELS.boostActual]
  );
  const region = {
    id: "event-1",
    label: "Event",
    startIndex: 1,
    endIndex: 2,
    kind: "event" as const,
    supportingChannels: ["boost"],
  };

  const rpmPoints = buildGraphPoints(
    series,
    [2000, 2500, 3000, 3500]
  ).points;
  const samplePoints = buildGraphPoints(
    series,
    [2000, 3500, 2400, 4000]
  ).points;

  assert.deepEqual(
    resolveRegionCoordinates([region], rpmPoints).map(({ x1, x2 }) => [
      x1,
      x2,
    ]),
    [[2500, 3000]]
  );
  assert.deepEqual(
    resolveRegionCoordinates([region], samplePoints).map(
      ({ x1, x2 }) => [x1, x2]
    ),
    [[1, 2]]
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

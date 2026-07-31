import assert from "node:assert/strict";
import test from "node:test";
import { getRootCauseResults } from "../analysis/rootCauseEngine.ts";
import type { DetectedEvent, ParsedLog } from "../analysis/types.ts";
import { detectEvents } from "./detectEvents.ts";

function buildLog(args: {
  boost: number[];
  boostTarget?: number[];
  throttle?: number[];
  wgdc?: number[];
  rpm?: number[];
  timestamps?: number[];
  lpfp?: number[];
  railPressure?: number[];
  afr?: number[];
  timingCyl1?: number[];
}): ParsedLog {
  const sampleCount = args.boost.length;
  const rpm =
    args.rpm ??
    Array.from({ length: sampleCount }, (_, index) => 2000 + index * 400);

  return {
    sampleCount,
    durationSec: sampleCount > 1 ? (sampleCount - 1) * 0.1 : 0,
    timestamps:
      args.timestamps ??
      Array.from({ length: sampleCount }, (_, index) => index * 0.1),
    rpm,
    channels: {
      boost: args.boost,
      boost_target:
        args.boostTarget ?? Array.from({ length: sampleCount }, () => 20),
      wgdc: args.wgdc ?? Array.from({ length: sampleCount }, () => 80),
      throttle:
        args.throttle ?? Array.from({ length: sampleCount }, () => 100),
      lpfp: args.lpfp ?? [],
      rail_pressure: args.railPressure ?? [],
      afr: args.afr ?? [],
      timing_correction_cyl_1: args.timingCyl1 ?? [],
      rpm,
    },
  };
}

function boostEvents(log: ParsedLog): DetectedEvent[] {
  return detectEvents(log, []).filter(
    (event) =>
      event.type === "boost_overshoot" ||
      event.type === "boost_undershoot"
  );
}

function eventsOfType(
  log: ParsedLog,
  type: DetectedEvent["type"]
): DetectedEvent[] {
  return detectEvents(log, []).filter((event) => event.type === type);
}

test("sustained aligned overshoot qualifies", () => {
  const events = eventsOfType(
    buildLog({ boost: [20, 24, 25, 20] }),
    "boost_overshoot"
  );

  assert.equal(events.length, 1);
  assert.equal(events[0].startIndex, 1);
  assert.equal(events[0].endIndex, 2);
});

test("sustained aligned undershoot qualifies", () => {
  const events = eventsOfType(
    buildLog({ boost: [20, 16, 15, 20] }),
    "boost_undershoot"
  );

  assert.equal(events.length, 1);
  assert.equal(events[0].startIndex, 1);
  assert.equal(events[0].endIndex, 2);
});

test("full-pull average below threshold does not suppress local overshoot", () => {
  const events = eventsOfType(
    buildLog({ boost: [10, 10, 26, 26, 20, 20] }),
    "boost_overshoot"
  );

  assert.equal(events.length, 1);
  assert.equal(events[0].startIndex, 2);
  assert.equal(events[0].endIndex, 3);
});

test("full-pull average above threshold does not create an event without a persistent local region", () => {
  const events = boostEvents(
    buildLog({ boost: [28, 20, 28, 20, 28, 20] })
  );

  assert.equal(events.length, 0);
});

test("independent maxima at different samples do not create an event", () => {
  const events = boostEvents(
    buildLog({
      boost: [30, 20, 20],
      boostTarget: [20, 30, 20],
    })
  );

  assert.equal(events.length, 0);
});

test("isolated deviation spike is rejected", () => {
  const events = boostEvents(buildLog({ boost: [20, 30, 20] }));

  assert.equal(events.length, 0);
});

test("separate overshoot regions remain separate", () => {
  const events = eventsOfType(
    buildLog({ boost: [24, 24, 20, 25, 25] }),
    "boost_overshoot"
  );

  assert.equal(events.length, 2);
  assert.deepEqual(
    events.map((event) => [event.startIndex, event.endIndex]),
    [
      [0, 1],
      [3, 4],
    ]
  );
});

test("separate undershoot regions remain separate", () => {
  const events = eventsOfType(
    buildLog({ boost: [16, 16, 20, 15, 15] }),
    "boost_undershoot"
  );

  assert.equal(events.length, 2);
});

test("throttle qualification terminates and rejects deviation regions", () => {
  const events = eventsOfType(
    buildLog({
      boost: [24, 24, 24],
      throttle: [100, 60, 100],
    }),
    "boost_overshoot"
  );

  assert.equal(events.length, 0);
});

test("invalid aligned samples do not create or bridge false evidence", () => {
  const events = eventsOfType(
    buildLog({ boost: [24, Number.NaN, 24] }),
    "boost_overshoot"
  );

  assert.equal(events.length, 0);
});

test("absent measured boost channel does not create evidence", () => {
  const events = boostEvents(buildLog({ boost: [0, 0, 0] }));

  assert.equal(events.length, 0);
});

test("RPM boundaries match the qualifying region", () => {
  const event = eventsOfType(
    buildLog({
      boost: [20, 24, 25, 20],
      rpm: [2000, 2750, 3100, 3500],
    }),
    "boost_overshoot"
  )[0];

  assert.equal(event.rpmStart, 2750);
  assert.equal(event.rpmEnd, 3100);
  assert.equal(event.metrics.minRpm, 2750);
  assert.equal(event.metrics.maxRpm, 3100);
});

test("duration matches recorded timestamps for the qualifying region", () => {
  const event = eventsOfType(
    buildLog({
      boost: [20, 24, 25, 26, 20],
      timestamps: [10, 10.08, 10.16, 10.24, 10.32],
    }),
    "boost_overshoot"
  )[0];

  assert.ok(Math.abs(Number(event.metrics.durationSec) - 0.16) < 1e-9);
  assert.equal(event.metrics.startTime, 10.08);
  assert.equal(event.metrics.endTime, 10.24);
});

test("sample count is retained when recorded duration is unavailable", () => {
  const log = buildLog({
    boost: [24, 25, 20],
    timestamps: [],
  });
  const event = detectEvents(log, [
    {
      id: "pull_1",
      startIndex: 0,
      endIndex: 2,
      rpmStart: log.rpm[0],
      rpmEnd: log.rpm[2],
      durationSec: 0,
      avgThrottle: 100,
      isValidWot: true,
      quality: "strong",
      issues: [],
    },
  ]).find((candidate) => candidate.type === "boost_overshoot");

  assert.ok(event);
  assert.equal(event.metrics.durationSec, null);
  assert.equal(event.metrics.qualifyingSampleCount, 2);
});

test("peak error is calculated from measured and target values at the same sample", () => {
  const event = eventsOfType(
    buildLog({
      boost: [24, 29, 25],
      boostTarget: [20, 23, 21],
    }),
    "boost_overshoot"
  )[0];

  assert.equal(event.metrics.peakBoostError, 6);
  assert.equal(event.metrics.measuredBoostAtPeak, 29);
  assert.equal(event.metrics.targetBoostAtPeak, 23);
  assert.equal(event.metrics.peakSampleIndex, 1);
});

test("average event-region error excludes non-event samples", () => {
  const event = eventsOfType(
    buildLog({ boost: [0, 24, 26, 20, 0] }),
    "boost_overshoot"
  )[0];

  assert.equal(event.metrics.avgBoostError, 5);
  assert.equal(event.metrics.qualifyingSampleCount, 2);
});

test("duplicate RPM values do not collapse qualifying samples", () => {
  const event = eventsOfType(
    buildLog({
      boost: [24, 25, 26],
      rpm: [3000, 3000, 3000],
    }),
    "boost_overshoot"
  )[0];

  assert.equal(event.startIndex, 0);
  assert.equal(event.endIndex, 2);
  assert.equal(event.metrics.qualifyingSampleCount, 3);
});

test("Top End Taper remains independent from overshoot", () => {
  const types = detectEvents(
    buildLog({ boost: [20, 20, 20, 20, 20, 20, 15, 15, 15] }),
    []
  ).map((event) => event.type);

  assert.ok(types.includes("top_end_taper"));
  assert.equal(types.includes("boost_overshoot"), false);
});

test("LPFP detection remains unchanged", () => {
  const events = eventsOfType(
    buildLog({
      boost: [20, 20, 20],
      lpfp: [40, 40, 40],
    }),
    "lpfp_drop"
  );

  assert.ok(events.length > 0);
});

test("HPFP detection remains unchanged", () => {
  const events = detectEvents(
    buildLog({
      boost: [20, 20, 20],
      railPressure: [1200, 1200, 1200],
    }),
    []
  );

  assert.ok(
    events.some(
      (event) =>
        event.type === "hpfp_capacity_limit" ||
        event.type === "rail_pressure_drop"
    )
  );
});

test("Lean Under Load remains unchanged", () => {
  const events = eventsOfType(
    buildLog({
      boost: [20, 20, 20],
      afr: [13.2, 13.1, 13.3],
    }),
    "lean_under_load"
  );

  assert.equal(events.length, 1);
});

test("Timing events remain unchanged", () => {
  const events = eventsOfType(
    buildLog({
      boost: [20, 20, 20],
      timingCyl1: [0, -3, 0],
    }),
    "timing_correction"
  );

  assert.equal(events.length, 1);
});

test("Throttle events remain unchanged", () => {
  const events = eventsOfType(
    buildLog({
      boost: [20, 20, 20],
      throttle: [100, 50, 100],
    }),
    "throttle_closure"
  );

  assert.equal(events.length, 1);
});

test("event ordering and identifiers remain deterministic", () => {
  const log = buildLog({ boost: [24, 24, 20, 15, 15] });
  const first = detectEvents(log, []);
  const second = detectEvents(log, []);

  assert.deepEqual(first, second);
  assert.equal(new Set(first.map((event) => event.id)).size, first.length);
});

test("existing Root Cause handlers receive unchanged boost event types", () => {
  const events = boostEvents(buildLog({ boost: [24, 24, 20, 15, 15] }));

  for (const event of events) {
    const rootCauses = getRootCauseResults({
      eventType: event.type,
      avgWgdc: Number(event.metrics.avgWgdc),
      throttle: Number(event.metrics.avgThrottle),
      boostError: Number(event.metrics.avgBoostError),
    });

    assert.ok(rootCauses.length > 0);
  }
});

test("event persistence shape remains JSON-compatible", () => {
  const events = detectEvents(buildLog({ boost: [24, 24, 20] }), []);
  const persisted = JSON.parse(JSON.stringify({ engine_v2: { events } }));

  assert.deepEqual(persisted.engine_v2.events, events);
  assert.ok(
    persisted.engine_v2.events.some(
      (event: DetectedEvent) => event.type === "boost_overshoot"
    )
  );
});

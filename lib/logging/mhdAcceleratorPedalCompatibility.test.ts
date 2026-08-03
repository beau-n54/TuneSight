import assert from "node:assert/strict";
import test from "node:test";
import type { ParsedLog } from "../analysis/types.ts";
import { segmentPulls } from "../logs/segmentPulls.ts";
import { translateMhdRows } from "./mhd.ts";

const acceleratorPedal = [0, 90, 92, 94, 0, 88, 89, 0];
const rpm = [1800, 2200, 3200, 4200, 2500, 2800, 3900, 2600];
const timestamps = [0, 1, 2, 3, 4, 5, 6, 7];

function buildN54ShowcaseCompatibilityRows(): Record<string, unknown>[] {
  return acceleratorPedal.map((pedal, index) => ({
    Time: timestamps[index],
    RPM: rpm[index],
    "Accel Ped. Pos. (%)": pedal,
    "Throttle Position": 45,
    "Boost Mean PSI": index,
    "Boost target (PSI)": index + 1,
    "WGDC Bank 1 (%)": 50,
  }));
}

function toParsedLog(rows: ReturnType<typeof translateMhdRows>["rows"]): ParsedLog {
  const translatedRpm = rows.map((row) => row.rpm ?? 0);

  return {
    sampleCount: rows.length,
    durationSec: (rows.at(-1)?.time ?? 0) - (rows[0]?.time ?? 0),
    timestamps: rows.map((row, index) => row.time ?? index),
    rpm: translatedRpm,
    channels: {
      rpm: translatedRpm,
      throttle: rows.map((row) => row.throttle ?? 0),
      boost: rows.map((row) => row.boostPsi ?? 0),
      boost_target: rows.map((row) => row.boostTargetPsi ?? 0),
      wgdc: rows.map((row) => row.wgdc ?? 0),
    },
  };
}

test("exact N54 MHD accelerator-pedal header resolves into canonical pull demand", () => {
  const translated = translateMhdRows(buildN54ShowcaseCompatibilityRows());

  assert.equal(translated.platform, "mhd");
  assert.deepEqual(
    translated.rows.map((row) => row.throttle),
    acceleratorPedal,
  );
  assert.equal(translated.missingCoreChannels.includes("throttle"), false);
});

test("N54 accelerator-pedal input produces deterministic exact PullWindow records", () => {
  const parsedLog = toParsedLog(
    translateMhdRows(buildN54ShowcaseCompatibilityRows()).rows,
  );
  const expected = [
    {
      id: "pull_1",
      startIndex: 1,
      endIndex: 3,
      rpmStart: 2200,
      rpmEnd: 4200,
      durationSec: 2,
      avgThrottle: 92,
      isValidWot: true,
      quality: "strong",
      issues: [],
    },
    {
      id: "pull_2",
      startIndex: 5,
      endIndex: 6,
      rpmStart: 2800,
      rpmEnd: 3900,
      durationSec: 1,
      avgThrottle: 88.5,
      isValidWot: false,
      quality: "questionable",
      issues: [
        "Short pull duration",
        "Limited RPM span",
        "Throttle not fully stable",
      ],
    },
  ];

  assert.deepEqual(segmentPulls(parsedLog), expected);
  assert.deepEqual(segmentPulls(parsedLog), expected);
});

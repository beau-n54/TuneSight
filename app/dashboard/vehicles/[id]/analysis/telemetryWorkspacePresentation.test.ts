import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  collectAuthoritativePulls,
  DEFAULT_TELEMETRY_WORKSPACE_MODE,
  eventsWithinPull,
  sliceTelemetryToPull,
} from "./telemetryWorkspacePresentation.ts";

const pulls = [
  { id: "pull_1", startIndex: 2, endIndex: 4, quality: "strong" as const },
  { id: "pull_2", startIndex: 7, endIndex: 9, quality: "questionable" as const },
];

test("Engineer View is the default", () => {
  assert.equal(DEFAULT_TELEMETRY_WORKSPACE_MODE, "engineer");
});

test("pull selector preserves authoritative source order and stable identities", () => {
  assert.deepEqual(
    collectAuthoritativePulls(pulls, 10).map(({ id }) => id),
    ["pull_1", "pull_2"]
  );
});

test("selected pull filtering preserves exact samples without stitching or reordering", () => {
  const telemetry = {
    rpm: [1000, 1100, 2000, 2500, 3000, 1200, 1300, 2100, 2600, 3100],
    boost: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  };

  assert.deepEqual(sliceTelemetryToPull(telemetry, pulls[1]), {
    rpm: [2100, 2600, 3100],
    boost: [7, 8, 9],
  });
});

test("events remain only when their exact boundaries belong to the pull", () => {
  const events = [
    { id: "before", startIndex: 0, endIndex: 1 },
    { id: "inside", startIndex: 2, endIndex: 3 },
    { id: "crossing", startIndex: 3, endIndex: 6 },
  ];

  assert.deepEqual(
    eventsWithinPull(events, pulls[0]).map(({ id }) => id),
    ["inside"]
  );
});

test("Individual Pull is unavailable without stable identity and valid boundaries", () => {
  assert.deepEqual(
    collectAuthoritativePulls(
      [
        { id: "", startIndex: 0, endIndex: 2 },
        { id: "outside", startIndex: 2, endIndex: 10 },
      ],
      10
    ),
    []
  );
});

test("mode and pull controls retain a responsive mobile-first structure", () => {
  const source = readFileSync(
    new URL("./TelemetryGraphV1.tsx", import.meta.url),
    "utf8"
  );

  assert.match(source, /aria-label="Telemetry viewing mode"/);
  assert.match(source, /className="flex flex-col gap-4 lg:flex-row/);
  assert.match(source, /className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5"/);
});

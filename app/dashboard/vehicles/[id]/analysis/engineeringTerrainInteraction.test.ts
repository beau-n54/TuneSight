import assert from "node:assert/strict";
import test from "node:test";
import type { GraphPoint, GraphRegion } from "./telemetryGraphPresentation";
import type { ProjectedAuthoritativeTerrainVertex } from "./engineeringTerrainProjection.ts";
import {
  moveTerrainKeyboardPoint,
  resolveTerrainPointer,
  terrainRegionsForPoint,
} from "./engineeringTerrainInteraction.ts";

const points: GraphPoint[] = [
  { boost_actual: 2, index: 40, rpm: 2000, x: 2000 },
  { boost_actual: null, index: 41, rpm: 2500, x: 2500 },
  { boost_actual: 8, index: 42, rpm: 3000, x: 3000 },
];

function vertex(
  sourcePosition: number,
  screenX: number,
  screenY: number | null
): ProjectedAuthoritativeTerrainVertex {
  return {
    depth: 0.65,
    exactValue: points[sourcePosition].boost_actual,
    height: screenY === null ? null : 0.5,
    isAuthoritative: true,
    kind: "authoritative",
    normalizedX: sourcePosition / 2,
    rowIndex: 5,
    screenX,
    screenY,
    sourcePoint: points[sourcePosition],
    sourcePosition,
  };
}

test("pointer inspection returns the original GraphPoint reference", () => {
  const vertices = [vertex(0, 50, 100), vertex(1, 100, null), vertex(2, 150, 70)];
  const resolved = resolveTerrainPointer(vertices, { x: 148, y: 72 });

  assert.equal(resolved, points[2]);
  assert.equal(resolveTerrainPointer(vertices, { x: 100, y: 100 }), null);
});

test("equal-distance pointer ties resolve by original source order", () => {
  const vertices = [vertex(0, 90, 80), vertex(2, 110, 80)];
  assert.equal(
    resolveTerrainPointer(vertices, { x: 100, y: 80 }),
    points[0]
  );
});

test("keyboard traversal preserves original source order including null values", () => {
  assert.equal(moveTerrainKeyboardPoint(points, null, "next"), points[0]);
  assert.equal(moveTerrainKeyboardPoint(points, points[0], "next"), points[1]);
  assert.equal(moveTerrainKeyboardPoint(points, points[2], "previous"), points[1]);
  assert.equal(moveTerrainKeyboardPoint(points, points[1], "home"), points[0]);
  assert.equal(moveTerrainKeyboardPoint(points, points[1], "end"), points[2]);
});

test("pull and event membership uses exact source indices", () => {
  const regions: GraphRegion[] = [
    {
      endIndex: 42,
      id: "pull-1",
      kind: "pull",
      label: "Pull 1",
      startIndex: 40,
      supportingChannels: [],
    },
    {
      endIndex: 42,
      id: "event-1",
      kind: "event",
      label: "Event 1",
      startIndex: 42,
      supportingChannels: ["boost_actual"],
    },
  ];

  assert.deepEqual(
    terrainRegionsForPoint(points[2], regions).map((region) => region.id),
    ["pull-1", "event-1"]
  );
});

import assert from "node:assert/strict";
import test from "node:test";
import type { GraphPoint } from "./telemetryGraphPresentation";
import { buildEngineeringTerrainHeightfield } from "./engineeringTerrainHeightfield.ts";
import {
  emphasizeDecorativeTerrainHeight,
  getTerrainResponsiveProfile,
  projectEngineeringTerrain,
  projectTerrainVertex,
  projectedTerrainColumn,
  TERRAIN_DEPTH_PROJECTION_EXPONENT,
  TERRAIN_DISTANCE_WIDTH_SCALE,
  TERRAIN_HORIZON_RATIO,
  TERRAIN_RELIEF_CURVE_EXPONENT,
  TERRAIN_RELIEF_MULTIPLIER,
  terrainDevicePixelRatio,
} from "./engineeringTerrainProjection.ts";

const points: GraphPoint[] = [
  { boost_actual: 0, index: 0, rpm: 2000, x: 2000 },
  { boost_actual: 8, index: 1, rpm: 3000, x: 3000 },
  { boost_actual: 4, index: 2, rpm: 4000, x: 4000 },
];

test("fixed-camera projection converges from foreground to horizon", () => {
  const heightfield = buildEngineeringTerrainHeightfield(
    points,
    "boost_actual",
    { depthRowCount: 9, majorColumnCount: 3, minorColumnCount: 3 }
  );
  assert.ok(heightfield);
  const projected = projectEngineeringTerrain(heightfield, {
    height: 320,
    width: 900,
  });
  const horizon = projected.rows[0].vertices;
  const foreground = projected.rows.at(-1)?.vertices;

  assert.ok(foreground);
  assert.ok(horizon[0].screenX > foreground[0].screenX);
  assert.ok(horizon.at(-1)!.screenX < foreground.at(-1)!.screenX);
  assert.ok(projected.horizonY < foreground[0].screenY!);
});

test("projection preserves point order and Y ordering", () => {
  const heightfield = buildEngineeringTerrainHeightfield(
    points,
    "boost_actual",
    { depthRowCount: 9, majorColumnCount: 3, minorColumnCount: 3 }
  );
  assert.ok(heightfield);
  const projected = projectEngineeringTerrain(heightfield, {
    height: 320,
    width: 900,
  });
  const ridge = projected.rows[projected.authoritativeRowIndex].vertices;

  assert.ok(ridge[0].screenX < ridge[1].screenX);
  assert.ok(ridge[1].screenX < ridge[2].screenX);
  assert.ok(ridge[1].screenY! < ridge[2].screenY!);
  assert.ok(ridge[2].screenY! < ridge[0].screenY!);
});

test("refined projection increases visual relief without altering exact values", () => {
  assert.equal(TERRAIN_DEPTH_PROJECTION_EXPONENT, 1.72);
  assert.equal(TERRAIN_DISTANCE_WIDTH_SCALE, 0.16);
  assert.equal(TERRAIN_RELIEF_CURVE_EXPONENT, 0.82);
  assert.equal(TERRAIN_RELIEF_MULTIPLIER, 1.3);
  assert.equal(TERRAIN_HORIZON_RATIO, 0.14);
  const heightfield = buildEngineeringTerrainHeightfield(
    points,
    "boost_actual",
    { depthRowCount: 9, majorColumnCount: 3, minorColumnCount: 3 }
  );
  assert.ok(heightfield);
  const projected = projectEngineeringTerrain(heightfield, {
    height: 320,
    width: 900,
  });

  assert.equal(projected.horizonY, 320 * TERRAIN_HORIZON_RATIO);
  const exactVertex =
    projected.rows[projected.authoritativeRowIndex].vertices[1];
  assert.equal(exactVertex.kind, "authoritative");
  assert.equal(
    exactVertex.kind === "authoritative" ? exactVertex.exactValue : null,
    8
  );
});

test("identical inputs produce identical projected vertices", () => {
  const heightfield = buildEngineeringTerrainHeightfield(
    points,
    "boost_actual",
    { depthRowCount: 9, majorColumnCount: 3, minorColumnCount: 3 }
  );
  assert.ok(heightfield);
  const viewport = { height: 320, width: 900 };

  assert.deepEqual(
    projectEngineeringTerrain(heightfield, viewport),
    projectEngineeringTerrain(heightfield, viewport)
  );
});

test("responsive profiles affect decorative density only", () => {
  const mobile = getTerrainResponsiveProfile(480);
  const tablet = getTerrainResponsiveProfile(800);
  const desktop = getTerrainResponsiveProfile(1280);

  assert.equal(mobile.profile, "mobile");
  assert.equal(tablet.profile, "tablet");
  assert.equal(desktop.profile, "desktop");
  assert.ok(mobile.depthRowCount < tablet.depthRowCount);
  assert.ok(tablet.depthRowCount < desktop.depthRowCount);
  assert.ok(mobile.minorColumnCount < tablet.minorColumnCount);
  assert.ok(tablet.minorColumnCount < desktop.minorColumnCount);
  assert.deepEqual(
    [
      mobile.maximumPresentationVertexCount,
      tablet.maximumPresentationVertexCount,
      desktop.maximumPresentationVertexCount,
    ],
    [320, 480, 720]
  );
});

test("Canvas DPR is capped without affecting CSS projection", () => {
  assert.equal(terrainDevicePixelRatio(1), 1);
  assert.equal(terrainDevicePixelRatio(1.5), 1.5);
  assert.equal(terrainDevicePixelRatio(4), 2);
  assert.equal(terrainDevicePixelRatio(Number.NaN), 1);
});

test("cross-grid columns connect every depth row deterministically", () => {
  const heightfield = buildEngineeringTerrainHeightfield(
    points,
    "boost_actual",
    { depthRowCount: 9, majorColumnCount: 3, minorColumnCount: 9 }
  );
  assert.ok(heightfield);
  const projected = projectEngineeringTerrain(heightfield, {
    height: 320,
    width: 900,
  });

  const first = projectedTerrainColumn(projected, 0.5);
  const second = projectedTerrainColumn(projected, 0.5);
  assert.equal(first.length, projected.rows.length);
  assert.deepEqual(first, second);
  assert.equal(
    first.filter((vertex) => vertex.kind === "authoritative").length,
    1
  );
  assert.equal(
    first.filter((vertex) => vertex.kind === "presentation").length,
    projected.rows.length - 1
  );
});

test("depth creates bounded lateral convergence and nonlinear horizon recession", () => {
  const vertex = {
    height: 0,
    kind: "presentation" as const,
    normalizedX: 0,
    presentationPosition: 0,
  };
  const viewport = { height: 360, width: 1000 };
  const distance = projectTerrainVertex(vertex, 0, 11, 7, viewport, 0);
  const middle = projectTerrainVertex(vertex, 5, 11, 7, viewport, 0);
  const foreground = projectTerrainVertex(vertex, 10, 11, 7, viewport, 0);
  const centerX = 58 + (viewport.width - 76) / 2;

  assert.ok(Math.abs(distance.screenX - centerX) < Math.abs(middle.screenX - centerX));
  assert.ok(Math.abs(middle.screenX - centerX) < Math.abs(foreground.screenX - centerX));
  assert.ok(distance.screenY! < middle.screenY!);
  assert.ok(middle.screenY! < foreground.screenY!);
  assert.equal(distance.screenY, viewport.height * TERRAIN_HORIZON_RATIO);
});

test("decorative relief is bounded, monotonic, deterministic, and direction preserving", () => {
  const inputs = [0, 0.2, 0.4, 0.5, 0.6, 0.8, 1];
  const emphasized = inputs.map((height) =>
    emphasizeDecorativeTerrainHeight(height, 0.5)
  );

  assert.deepEqual(
    emphasized,
    inputs.map((height) => emphasizeDecorativeTerrainHeight(height, 0.5))
  );
  assert.ok(emphasized.every((height) => height >= 0 && height <= 1));
  assert.ok(emphasized.every((height, index) => index === 0 || height >= emphasized[index - 1]));
  assert.equal(emphasized[3], 0.5);
  assert.ok(emphasized[2] < 0.4);
  assert.ok(emphasized[4] > 0.6);
  assert.equal(Math.min(...emphasized), 0);
  assert.equal(Math.max(...emphasized), 1);
});

test("authoritative projection bypasses decorative relief emphasis", () => {
  const authoritative = {
    exactValue: -6,
    height: 0.25,
    kind: "authoritative" as const,
    normalizedX: 0.5,
    sourcePoint: points[0],
    sourcePosition: 0,
  };
  const viewport = { height: 320, width: 900 };
  const lowNeutral = projectTerrainVertex(
    authoritative,
    5,
    9,
    5,
    viewport,
    0.1
  );
  const highNeutral = projectTerrainVertex(
    authoritative,
    5,
    9,
    5,
    viewport,
    0.9
  );

  assert.equal(lowNeutral.screenY, highNeutral.screenY);
  assert.equal(
    lowNeutral.kind === "authoritative" ? lowNeutral.exactValue : null,
    -6
  );
  assert.equal(lowNeutral.height, 0.25);
});

test("camera geometry is stable across engineering channel metadata", () => {
  const viewport = { height: 320, width: 900 };
  const baseVertex = {
    exactValue: 12,
    height: 0.6,
    kind: "authoritative" as const,
    normalizedX: 0.4,
    sourcePosition: 0,
  };
  const boost = projectTerrainVertex(
    { ...baseVertex, sourcePoint: { boost_actual: 12, index: 0, rpm: 3000, x: 3000 } },
    5,
    9,
    5,
    viewport
  );
  const temperature = projectTerrainVertex(
    { ...baseVertex, sourcePoint: { iat: 42, index: 0, rpm: 3000, x: 3000 } },
    5,
    9,
    5,
    viewport
  );

  assert.equal(boost.screenX, temperature.screenX);
  assert.equal(boost.screenY, temperature.screenY);
});

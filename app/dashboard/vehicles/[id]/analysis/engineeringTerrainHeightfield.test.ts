import assert from "node:assert/strict";
import test from "node:test";
import type { GraphPoint } from "./telemetryGraphPresentation";
import {
  buildEngineeringTerrainHeightfield,
  selectTerrainColumnPositions,
  terrainPresentationPositions,
  terrainPresentationVertexCount,
} from "./engineeringTerrainHeightfield.ts";

const options = {
  depthRowCount: 9,
  majorColumnCount: 5,
  minorColumnCount: 9,
};

function points(values: readonly (number | null)[]): GraphPoint[] {
  return values.map((value, index) => ({
    boost_actual: value,
    index: 40 + index,
    rpm: 2000 + index * 500,
    x: 2000 + index * 500,
  }));
}

test("authoritative row preserves every source point and exact value", () => {
  const source = points([2, 5, null, -3]);
  const before = structuredClone(source);
  const terrain = buildEngineeringTerrainHeightfield(
    source,
    "boost_actual",
    options
  );

  assert.ok(terrain);
  const ridge = terrain.rows[terrain.authoritativeRowIndex];
  const authoritativeVertices = ridge.vertices.filter(
    (vertex) => vertex.kind === "authoritative"
  );
  assert.equal(ridge.isAuthoritative, true);
  assert.deepEqual(
    authoritativeVertices.map((vertex) => vertex.exactValue),
    [2, 5, null, -3]
  );
  assert.deepEqual(
    authoritativeVertices.map((vertex) => vertex.sourcePoint),
    source
  );
  assert.equal(authoritativeVertices[0].sourcePoint, source[0]);
  assert.deepEqual(source, before);
  assert.deepEqual(
    authoritativeVertices.map((vertex) => vertex.normalizedX),
    [0, 1 / 3, 2 / 3, 1]
  );
  assert.equal(terrain.domain.xMinimum, 41);
  assert.equal(terrain.domain.xMaximum, 44);
});

test("Terrain horizontal geometry ignores qualified RPM spacing", () => {
  const source = points([2, 5, 8]);
  source[0].x = 2000;
  source[1].x = 2010;
  source[2].x = 7000;
  const terrain = buildEngineeringTerrainHeightfield(
    source,
    "boost_actual",
    options
  );

  assert.ok(terrain);
  const ridge = terrain.rows[terrain.authoritativeRowIndex].vertices.filter(
    (vertex) => vertex.kind === "authoritative"
  );
  assert.deepEqual(
    ridge.map((vertex) => vertex.normalizedX),
    [0, 0.5, 1]
  );
  assert.deepEqual(
    ridge.map((vertex) => vertex.sourcePoint.x),
    [2000, 2010, 7000]
  );
});

test("visual envelope is exact at the spine and monotonic away from it", () => {
  const terrain = buildEngineeringTerrainHeightfield(
    points([1, 3, 2]),
    "boost_actual",
    options
  );

  assert.ok(terrain);
  assert.equal(terrain.rows[terrain.authoritativeRowIndex].envelope, 1);
  for (let index = 1; index <= terrain.authoritativeRowIndex; index += 1) {
    assert.ok(terrain.rows[index].envelope >= terrain.rows[index - 1].envelope);
  }
  for (
    let index = terrain.authoritativeRowIndex + 1;
    index < terrain.rows.length;
    index += 1
  ) {
    assert.ok(terrain.rows[index].envelope <= terrain.rows[index - 1].envelope);
  }
});

test("nulls break every visual row without synthesizing a value", () => {
  const terrain = buildEngineeringTerrainHeightfield(
    points([2, null, 4]),
    "boost_actual",
    options
  );

  assert.ok(terrain);
  const ridge = terrain.rows[terrain.authoritativeRowIndex].vertices.filter(
    (vertex) => vertex.kind === "authoritative"
  );
  assert.equal(ridge[1].exactValue, null);
  assert.equal(ridge[1].height, null);
  for (const row of terrain.rows.filter((entry) => !entry.isAuthoritative)) {
    assert.ok(row.vertices.some((vertex) => vertex.height === null));
  }
});

test("constant values create an exact plateau with a visible domain", () => {
  const terrain = buildEngineeringTerrainHeightfield(
    points([12, 12, 12]),
    "boost_actual",
    options
  );

  assert.ok(terrain);
  assert.ok(terrain.domain.yMinimum < 12);
  assert.ok(terrain.domain.yMaximum > 12);
  assert.deepEqual(
    terrain.rows[terrain.authoritativeRowIndex].vertices
      .filter((vertex) => vertex.kind === "authoritative")
      .map((vertex) => vertex.exactValue),
    [12, 12, 12]
  );
});

test("mixed-sign data preserves sign and a truthful zero reference", () => {
  const terrain = buildEngineeringTerrainHeightfield(
    points([-6, 0, 4]),
    "boost_actual",
    options
  );

  assert.ok(terrain);
  assert.notEqual(terrain.domain.zeroPosition, null);
  assert.deepEqual(
    terrain.rows[terrain.authoritativeRowIndex].vertices
      .filter((vertex) => vertex.kind === "authoritative")
      .map((vertex) => vertex.exactValue),
    [-6, 0, 4]
  );
});

test("governed chart domains produce restrained truthful engineering ticks", () => {
  const boost = buildEngineeringTerrainHeightfield(
    points([14, 26, 35.5]),
    "boost_actual",
    { ...options, valueDomain: [0, "auto"] }
  );
  const percentage = buildEngineeringTerrainHeightfield(
    points([49, 87, 97]),
    "boost_actual",
    { ...options, valueDomain: [0, 100] }
  );
  const timing = buildEngineeringTerrainHeightfield(
    points([-6, -2, 0]),
    "boost_actual",
    { ...options, valueDomain: ["auto", "auto"] }
  );

  assert.deepEqual(boost?.majorValueTicks, [0, 10, 20, 30, 40]);
  assert.deepEqual(percentage?.majorValueTicks, [0, 20, 40, 60, 80, 100]);
  assert.deepEqual(timing?.majorValueTicks, [-6, -4, -2, 0]);
});

test("sparse and dense column selection is deterministic and source-indexed", () => {
  assert.deepEqual(selectTerrainColumnPositions(3, 8), [0, 1, 2]);
  assert.deepEqual(selectTerrainColumnPositions(20, 5), [0, 5, 10, 14, 19]);
  assert.deepEqual(
    selectTerrainColumnPositions(20, 5),
    selectTerrainColumnPositions(20, 5)
  );
});

test("presentation density is deterministic, bounded, and independent of source identity", () => {
  const source = points([0, -6, -5.5, -5, 0]);
  const terrain = buildEngineeringTerrainHeightfield(
    source,
    "boost_actual",
    { ...options, maximumPresentationVertexCount: 20 }
  );

  assert.ok(terrain);
  const ridge = terrain.rows[terrain.authoritativeRowIndex];
  const decorativeRow = terrain.rows.find((row) => !row.isAuthoritative);
  assert.ok(decorativeRow);
  assert.equal(ridge.vertices.length, source.length);
  assert.equal(decorativeRow.vertices.length, 20);
  assert.ok(decorativeRow.vertices.length > source.length);
  assert.ok(
    decorativeRow.vertices.every(
      (vertex) =>
        vertex.kind === "presentation" &&
        !("sourcePoint" in vertex) &&
        !("exactValue" in vertex)
    )
  );
  assert.deepEqual(
    ridge.vertices
      .filter((vertex) => vertex.kind === "authoritative")
      .map((vertex) => vertex.exactValue),
    [0, -6, -5.5, -5, 0]
  );
  assert.equal(terrainPresentationVertexCount(1, 20), 1);
  assert.equal(terrainPresentationVertexCount(5, 20), 20);
  assert.equal(terrainPresentationVertexCount(200, 320), 320);
  assert.equal(terrainPresentationVertexCount(130, 720), 720);
  assert.equal(terrainPresentationVertexCount(5, 20), 20);
  for (const anchor of [0, 0.25, 0.5, 0.75, 1]) {
    assert.ok(terrainPresentationPositions(5, 20).includes(anchor));
    const vertex = decorativeRow.vertices.find(
      (candidate) => candidate.normalizedX === anchor
    );
    assert.ok(vertex);
    assert.notEqual(vertex.height, null);
  }
});

test("a one-sample telemetry window remains valid without fabricated identity", () => {
  const source = points([-6]);
  const terrain = buildEngineeringTerrainHeightfield(
    source,
    "boost_actual",
    { ...options, maximumPresentationVertexCount: 20 }
  );

  assert.ok(terrain);
  assert.equal(
    terrain.rows[terrain.authoritativeRowIndex].vertices.length,
    1
  );
  assert.ok(
    terrain.rows
      .filter((row) => !row.isAuthoritative)
      .every(
        (row) =>
          row.vertices.length === 1 &&
          row.vertices[0].kind === "presentation"
      )
  );
});

test("the validated timing-correction valley keeps exact channel minima", () => {
  const source: GraphPoint[] = [
    {
      index: 415,
      rpm: 5300,
      timing_correction_1: -6,
      timing_correction_2: -5.5,
      timing_correction_3: -5,
      x: 5300,
    },
    {
      index: 416,
      rpm: 5350,
      timing_correction_1: -6,
      timing_correction_2: -5.5,
      timing_correction_3: -5,
      x: 5350,
    },
  ];

  for (const [seriesId, expectedMinimum] of [
    ["timing_correction_1", -6],
    ["timing_correction_2", -5.5],
    ["timing_correction_3", -5],
  ] as const) {
    const terrain = buildEngineeringTerrainHeightfield(
      source,
      seriesId,
      options
    );
    assert.ok(terrain);
    const exactValues = terrain.rows[terrain.authoritativeRowIndex].vertices
      .filter((vertex) => vertex.kind === "authoritative")
      .flatMap((vertex) =>
        vertex.exactValue === null ? [] : [vertex.exactValue]
      );
    assert.equal(Math.min(...exactValues), expectedMinimum);
  }
});

test("decorative X/Z topology is not a scalar copy of a local peak", () => {
  const terrain = buildEngineeringTerrainHeightfield(
    points([0, 0, 10, 0, 0]),
    "boost_actual",
    { ...options, maximumPresentationVertexCount: 25 }
  );

  assert.ok(terrain);
  const farRow = terrain.rows[0];
  const finiteHeights = farRow.vertices.flatMap((vertex) =>
    vertex.height === null ? [] : [vertex.height]
  );
  const centerHeight = finiteHeights[Math.floor(finiteHeights.length / 2)];
  assert.ok(centerHeight > finiteHeights[0]);
  assert.ok(centerHeight > finiteHeights.at(-1)!);
  assert.ok(new Set(finiteHeights.map((height) => height.toFixed(6))).size > 3);

  const ridge = terrain.rows[terrain.authoritativeRowIndex].vertices.filter(
    (vertex) => vertex.kind === "authoritative"
  );
  const scalarRatios = farRow.vertices.flatMap((vertex) => {
    if (vertex.height === null) {
      return [];
    }
    const sourceCoordinate = vertex.normalizedX * (ridge.length - 1);
    const leftPosition = Math.floor(sourceCoordinate);
    const rightPosition = Math.min(ridge.length - 1, leftPosition + 1);
    const leftHeight = ridge[leftPosition].height;
    const rightHeight = ridge[rightPosition].height;
    if (leftHeight === null || rightHeight === null) {
      return [];
    }
    const progress = sourceCoordinate - leftPosition;
    const ridgeHeight = leftHeight + (rightHeight - leftHeight) * progress;
    return ridgeHeight === 0 ? [] : [vertex.height / ridgeHeight];
  });
  assert.ok(
    new Set(scalarRatios.map((ratio) => ratio.toFixed(6))).size > 3
  );
  assert.equal(ridge[2].exactValue, 10);
  assert.equal(ridge.length, 5);
});

test("flat input creates restrained X planes without artificial peaks", () => {
  const terrain = buildEngineeringTerrainHeightfield(
    points(Array.from({ length: 20 }, () => 12)),
    "boost_actual",
    { ...options, maximumPresentationVertexCount: 120 }
  );

  assert.ok(terrain);
  for (const row of terrain.rows.filter((entry) => !entry.isAuthoritative)) {
    const heights = row.vertices.flatMap((vertex) =>
      vertex.height === null ? [] : [vertex.height]
    );
    assert.equal(new Set(heights.map((height) => height.toFixed(12))).size, 1);
  }
  assert.equal(
    terrain.rows[terrain.authoritativeRowIndex].vertices.length,
    20
  );
  assert.equal(terrain.rows[0].vertices.length, 115);
});

test("a sustained trough forms a bounded valley while preserving its exact floor", () => {
  const terrain = buildEngineeringTerrainHeightfield(
    points([0, 0, -6, -6, -6, 0, 0]),
    "boost_actual",
    { ...options, maximumPresentationVertexCount: 40 }
  );

  assert.ok(terrain);
  const farHeights = terrain.rows[0].vertices.flatMap((vertex) =>
    vertex.height === null ? [] : [vertex.height]
  );
  const middle = farHeights.slice(14, 26);
  assert.ok(Math.min(...middle) < farHeights[0]);
  assert.ok(Math.min(...middle) < farHeights.at(-1)!);
  const exactValues = terrain.rows[terrain.authoritativeRowIndex].vertices
    .filter((vertex) => vertex.kind === "authoritative")
    .flatMap((vertex) =>
      vertex.exactValue === null ? [] : [vertex.exactValue]
    );
  assert.equal(Math.min(...exactValues), -6);
});

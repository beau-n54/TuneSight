import type { GraphPoint } from "./telemetryGraphPresentation";

export type TerrainDomain = {
  neutralPosition: number;
  xMaximum: number;
  xMinimum: number;
  yMaximum: number;
  yMinimum: number;
  zeroPosition: number | null;
};

type TerrainVertexGeometry = {
  height: number | null;
  normalizedX: number;
};

export type AuthoritativeTerrainVertex = TerrainVertexGeometry & {
  exactValue: number | null;
  kind: "authoritative";
  sourcePoint: GraphPoint;
  sourcePosition: number;
};

export type PresentationTerrainVertex = TerrainVertexGeometry & {
  kind: "presentation";
  presentationPosition: number;
};

export type TerrainHeightfieldVertex =
  | AuthoritativeTerrainVertex
  | PresentationTerrainVertex;

export type TerrainHeightfieldRow = {
  depth: number;
  envelope: number;
  isAuthoritative: boolean;
  rowIndex: number;
  vertices: readonly TerrainHeightfieldVertex[];
};

export type EngineeringTerrainHeightfield = {
  authoritativeRowIndex: number;
  domain: TerrainDomain;
  majorColumnPositions: readonly number[];
  majorValueTicks: readonly number[];
  minorColumnPositions: readonly number[];
  rows: readonly TerrainHeightfieldRow[];
};

export type TerrainHeightfieldOptions = {
  depthRowCount: number;
  majorColumnCount: number;
  maximumPresentationVertexCount?: number;
  minorColumnCount: number;
  valueDomain?: readonly [number | "auto", number | "auto"];
};

export const TERRAIN_LONGITUDINAL_SUBDIVISIONS = 6;
export const TERRAIN_MINIMUM_PRESENTATION_VERTEX_CAP = 2;

export function terrainPresentationVertexCount(
  authoritativePointCount: number,
  maximumPresentationVertexCount = 720
): number {
  if (authoritativePointCount <= 0) {
    return 0;
  }
  if (authoritativePointCount === 1) {
    return 1;
  }

  const cap = Math.max(
    TERRAIN_MINIMUM_PRESENTATION_VERTEX_CAP,
    Math.floor(maximumPresentationVertexCount)
  );
  return Math.min(
    (authoritativePointCount - 1) * TERRAIN_LONGITUDINAL_SUBDIVISIONS + 1,
    Math.max(authoritativePointCount, cap)
  );
}

export function terrainPresentationPositions(
  authoritativePointCount: number,
  maximumPresentationVertexCount = 720
): number[] {
  const vertexCount = terrainPresentationVertexCount(
    authoritativePointCount,
    maximumPresentationVertexCount
  );
  if (vertexCount === 0) {
    return [];
  }
  if (vertexCount === 1) {
    return [0.5];
  }

  const intervalCount = authoritativePointCount - 1;
  const extraVertexCount = vertexCount - authoritativePointCount;
  const baseExtrasPerInterval = Math.floor(extraVertexCount / intervalCount);
  const intervalsWithOneMore = extraVertexCount % intervalCount;
  const positions = [0];

  for (let interval = 0; interval < intervalCount; interval += 1) {
    const stepCount =
      1 +
      baseExtrasPerInterval +
      (interval < intervalsWithOneMore ? 1 : 0);
    for (let step = 1; step <= stepCount; step += 1) {
      positions.push((interval + step / stepCount) / intervalCount);
    }
  }

  return positions;
}

function finiteValue(point: GraphPoint, seriesId: string): number | null {
  const value = point[seriesId];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function domainForValues(values: readonly number[]): {
  maximum: number;
  minimum: number;
} {
  const rawMinimum = Math.min(...values);
  const rawMaximum = Math.max(...values);

  if (rawMinimum !== rawMaximum) {
    const padding = (rawMaximum - rawMinimum) * 0.08;
    return {
      maximum: rawMaximum + padding,
      minimum: rawMinimum - padding,
    };
  }

  const padding = Math.max(Math.abs(rawMinimum) * 0.08, 1);
  return {
    maximum: rawMaximum + padding,
    minimum: rawMinimum - padding,
  };
}

function niceInterval(range: number): number {
  const roughInterval = range / 5;
  const magnitude = 10 ** Math.floor(Math.log10(roughInterval));
  const normalized = roughInterval / magnitude;
  const multiplier =
    normalized <= 1
      ? 1
      : normalized <= 2
        ? 2
        : normalized <= 2.5
          ? 2.5
          : normalized <= 5
            ? 5
            : 10;

  return multiplier * magnitude;
}

function governedValueDomain(
  values: readonly number[],
  requestedDomain: TerrainHeightfieldOptions["valueDomain"]
): { maximum: number; minimum: number; ticks: number[] } {
  const fallback = domainForValues(values);
  if (!requestedDomain) {
    return {
      ...fallback,
      ticks: majorValueTicks(fallback.minimum, fallback.maximum),
    };
  }

  const rawMinimum = Math.min(...values);
  const rawMaximum = Math.max(...values);
  const requestedMinimum = requestedDomain[0];
  const requestedMaximum = requestedDomain[1];
  const provisionalMinimum =
    requestedMinimum === "auto" ? rawMinimum : requestedMinimum;
  const provisionalMaximum =
    requestedMaximum === "auto" ? rawMaximum : requestedMaximum;
  if (provisionalMinimum === provisionalMaximum) {
    return {
      ...fallback,
      ticks: majorValueTicks(fallback.minimum, fallback.maximum),
    };
  }

  const interval = niceInterval(provisionalMaximum - provisionalMinimum);
  const minimum =
    requestedMinimum === "auto"
      ? Math.floor(provisionalMinimum / interval) * interval
      : provisionalMinimum;
  const maximum =
    requestedMaximum === "auto"
      ? Math.ceil(provisionalMaximum / interval) * interval
      : provisionalMaximum;

  return { maximum, minimum, ticks: majorValueTicks(minimum, maximum) };
}

function majorValueTicks(minimum: number, maximum: number): number[] {
  const interval = niceInterval(maximum - minimum);
  const precision = Math.max(0, -Math.floor(Math.log10(interval)) + 1);
  const firstTick = Math.ceil(minimum / interval) * interval;
  const ticks: number[] = [];

  for (let value = firstTick; value <= maximum + interval / 1000; value += interval) {
    ticks.push(Number(value.toFixed(precision)));
  }

  return ticks;
}

function positionInDomain(value: number, minimum: number, maximum: number) {
  return maximum === minimum ? 0.5 : (value - minimum) / (maximum - minimum);
}

function interpolateAuthoritativeHeight(
  vertices: readonly AuthoritativeTerrainVertex[],
  normalizedX: number
): number | null {
  if (vertices.length === 1) {
    return vertices[0].height;
  }

  const sourceCoordinate = normalizedX * (vertices.length - 1);
  const leftPosition = Math.floor(sourceCoordinate);
  const rightPosition = Math.min(vertices.length - 1, leftPosition + 1);
  const leftHeight = vertices[leftPosition].height;
  const rightHeight = vertices[rightPosition].height;
  if (leftHeight === null || rightHeight === null) {
    return null;
  }

  const progress = sourceCoordinate - leftPosition;
  return leftHeight + (rightHeight - leftHeight) * progress;
}

function localPresentationInfluence(
  heights: readonly (number | null)[],
  centerPosition: number,
  radius: number
): number | null {
  const centerHeight = heights[centerPosition];
  if (centerHeight === null) {
    return null;
  }

  let weightedHeight = centerHeight;
  let totalWeight = 1;
  for (const direction of [-1, 1] as const) {
    for (let distance = 1; distance <= radius; distance += 1) {
      const position = centerPosition + direction * distance;
      if (position < 0 || position >= heights.length) {
        break;
      }
      const height = heights[position];
      if (height === null) {
        break;
      }
      const weight = 1 - distance / (radius + 1);
      weightedHeight += height * weight;
      totalWeight += weight;
    }
  }

  return weightedHeight / totalWeight;
}

export function selectTerrainColumnPositions(
  pointCount: number,
  requestedCount: number
): number[] {
  if (pointCount <= 0 || requestedCount <= 0) {
    return [];
  }

  if (pointCount <= requestedCount) {
    return Array.from({ length: pointCount }, (_, index) => index);
  }

  if (requestedCount === 1) {
    return [0];
  }

  const positions = new Set<number>([0, pointCount - 1]);
  for (let position = 1; position < requestedCount - 1; position += 1) {
    positions.add(
      Math.round((position * (pointCount - 1)) / (requestedCount - 1))
    );
  }

  return [...positions].sort((left, right) => left - right);
}

export function buildEngineeringTerrainHeightfield(
  points: readonly GraphPoint[],
  seriesId: string,
  options: TerrainHeightfieldOptions
): EngineeringTerrainHeightfield | null {
  const depthRowCount = Math.max(3, Math.floor(options.depthRowCount));
  const finiteValues = points.flatMap((point) => {
    const value = finiteValue(point, seriesId);
    return value === null ? [] : [value];
  });

  if (points.length === 0 || finiteValues.length === 0) {
    return null;
  }

  const xMinimum = points[0].index + 1;
  const xMaximum = points.at(-1)!.index + 1;
  const yDomain = governedValueDomain(finiteValues, options.valueDomain);
  const crossesZero =
    Math.min(...finiteValues) < 0 && Math.max(...finiteValues) > 0;
  const zeroPosition = crossesZero
    ? positionInDomain(0, yDomain.minimum, yDomain.maximum)
    : null;
  const anchor = zeroPosition ?? (Math.max(...finiteValues) <= 0 ? 1 : 0);
  const authoritativeRowIndex = Math.round((depthRowCount - 1) * (2 / 3));
  const maximumRowDistance = Math.max(
    authoritativeRowIndex,
    depthRowCount - 1 - authoritativeRowIndex
  );
  const presentationVertexCount = terrainPresentationVertexCount(
    points.length,
    options.maximumPresentationVertexCount
  );
  const presentationPositions = terrainPresentationPositions(
    points.length,
    options.maximumPresentationVertexCount
  );
  const authoritativeVertices: AuthoritativeTerrainVertex[] = points.map(
    (sourcePoint, sourcePosition) => {
      const exactValue = finiteValue(sourcePoint, seriesId);
      return {
        exactValue,
        height:
          exactValue === null
            ? null
            : positionInDomain(exactValue, yDomain.minimum, yDomain.maximum),
        kind: "authoritative",
        normalizedX:
          points.length === 1 ? 0.5 : sourcePosition / (points.length - 1),
        sourcePoint,
        sourcePosition,
      };
    }
  );
  const basePresentationHeights = presentationPositions.map((normalizedX) =>
    interpolateAuthoritativeHeight(authoritativeVertices, normalizedX)
  );
  const rows = Array.from({ length: depthRowCount }, (_, rowIndex) => {
    const rowDistance = Math.abs(rowIndex - authoritativeRowIndex);
    const normalizedDepthDistance = rowDistance / maximumRowDistance;
    const envelope = 1 - normalizedDepthDistance * 0.72;
    const influenceRadius = Math.max(
      1,
      Math.round(
        1 + normalizedDepthDistance * presentationVertexCount * 0.14
      )
    );
    const influenceBlend = Math.pow(normalizedDepthDistance, 0.72) * 0.78;
    const presentationVertices: PresentationTerrainVertex[] =
      presentationPositions.map((normalizedX, presentationPosition) => {
        const ridgeHeight = basePresentationHeights[presentationPosition];
        const influencedHeight = localPresentationInfluence(
          basePresentationHeights,
          presentationPosition,
          influenceRadius
        );
        const shapedHeight =
          ridgeHeight === null || influencedHeight === null
            ? null
            : ridgeHeight +
              (influencedHeight - ridgeHeight) * influenceBlend;

        return {
          height:
            shapedHeight === null
              ? null
              : anchor + (shapedHeight - anchor) * envelope,
          kind: "presentation",
          normalizedX,
          presentationPosition,
        };
      });
    const vertices: TerrainHeightfieldVertex[] =
      rowIndex === authoritativeRowIndex
        ? authoritativeVertices
        : presentationVertices;

    return {
      depth: rowIndex / (depthRowCount - 1),
      envelope,
      isAuthoritative: rowIndex === authoritativeRowIndex,
      rowIndex,
      vertices,
    };
  });
  const majorColumnPositions = selectTerrainColumnPositions(
    presentationVertexCount,
    options.majorColumnCount
  );
  const majorSet = new Set(majorColumnPositions);
  const minorColumnPositions = selectTerrainColumnPositions(
    presentationVertexCount,
    options.minorColumnCount
  ).filter((position) => !majorSet.has(position));

  return {
    authoritativeRowIndex,
    domain: {
      neutralPosition: anchor,
      xMaximum,
      xMinimum,
      yMaximum: yDomain.maximum,
      yMinimum: yDomain.minimum,
      zeroPosition,
    },
    majorColumnPositions,
    majorValueTicks: yDomain.ticks,
    minorColumnPositions,
    rows,
  };
}

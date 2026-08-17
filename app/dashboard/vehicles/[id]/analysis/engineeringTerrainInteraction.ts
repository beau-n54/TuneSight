import type { GraphPoint, GraphRegion } from "./telemetryGraphPresentation";
import type { ProjectedAuthoritativeTerrainVertex } from "./engineeringTerrainProjection.ts";

export type TerrainPointer = {
  x: number;
  y: number;
};

export function resolveTerrainPointer(
  authoritativeVertices: readonly ProjectedAuthoritativeTerrainVertex[],
  pointer: TerrainPointer,
  maximumDistance = 28
): GraphPoint | null {
  let closest:
    | { distanceSquared: number; sourcePoint: GraphPoint; sourcePosition: number }
    | null = null;
  const maximumDistanceSquared = maximumDistance * maximumDistance;

  for (const vertex of authoritativeVertices) {
    if (vertex.screenY === null || vertex.exactValue === null) {
      continue;
    }

    const horizontalDistance = vertex.screenX - pointer.x;
    const verticalDistance = vertex.screenY - pointer.y;
    const distanceSquared =
      horizontalDistance * horizontalDistance +
      verticalDistance * verticalDistance;

    if (
      distanceSquared <= maximumDistanceSquared &&
      (closest === null ||
        distanceSquared < closest.distanceSquared ||
        (distanceSquared === closest.distanceSquared &&
          vertex.sourcePosition < closest.sourcePosition))
    ) {
      closest = {
        distanceSquared,
        sourcePoint: vertex.sourcePoint,
        sourcePosition: vertex.sourcePosition,
      };
    }
  }

  return closest?.sourcePoint ?? null;
}

export function moveTerrainKeyboardPoint(
  points: readonly GraphPoint[],
  currentPoint: GraphPoint | null,
  movement: "end" | "home" | "next" | "previous"
): GraphPoint | null {
  if (points.length === 0) {
    return null;
  }

  if (movement === "home") {
    return points[0];
  }

  if (movement === "end") {
    return points[points.length - 1];
  }

  const currentPosition = currentPoint
    ? points.findIndex((point) => point === currentPoint)
    : -1;

  if (movement === "previous") {
    return points[Math.max(0, currentPosition < 0 ? 0 : currentPosition - 1)];
  }

  return points[Math.min(points.length - 1, currentPosition + 1)];
}

export function terrainRegionsForPoint(
  point: GraphPoint,
  regions: readonly GraphRegion[]
): GraphRegion[] {
  return regions.filter(
    (region) =>
      point.index >= region.startIndex && point.index <= region.endIndex
  );
}

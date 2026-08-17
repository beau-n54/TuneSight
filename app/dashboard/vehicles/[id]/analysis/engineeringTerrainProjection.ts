import type {
  EngineeringTerrainHeightfield,
  TerrainHeightfieldVertex,
} from "./engineeringTerrainHeightfield.ts";

export type TerrainResponsiveProfile = {
  canvasHeight: number;
  depthRowCount: number;
  majorColumnCount: number;
  maximumPresentationVertexCount: number;
  minorColumnCount: number;
  profile: "desktop" | "mobile" | "tablet";
};

export type TerrainViewport = {
  height: number;
  width: number;
};

export type ProjectedTerrainVertex = TerrainHeightfieldVertex & {
  depth: number;
  isAuthoritative: boolean;
  rowIndex: number;
  screenX: number;
  screenY: number | null;
};

export type ProjectedAuthoritativeTerrainVertex = Extract<
  ProjectedTerrainVertex,
  { kind: "authoritative" }
>;

export type ProjectedTerrainRow = {
  depth: number;
  isAuthoritative: boolean;
  rowIndex: number;
  vertices: readonly ProjectedTerrainVertex[];
};

export type ProjectedEngineeringTerrain = {
  authoritativeRowIndex: number;
  horizonY: number;
  rows: readonly ProjectedTerrainRow[];
};

export const TERRAIN_DEVICE_PIXEL_RATIO_CEILING = 2;
export const TERRAIN_DEPTH_PROJECTION_EXPONENT = 1.72;
export const TERRAIN_DISTANCE_WIDTH_SCALE = 0.16;
export const TERRAIN_HORIZON_RATIO = 0.14;
export const TERRAIN_RELIEF_CURVE_EXPONENT = 0.82;
export const TERRAIN_RELIEF_MULTIPLIER = 1.3;

export function emphasizeDecorativeTerrainHeight(
  height: number,
  neutralPosition: number
): number {
  const neutral = Math.max(0, Math.min(1, neutralPosition));
  const delta = height - neutral;
  if (delta === 0) {
    return neutral;
  }

  const availableRange = delta > 0 ? 1 - neutral : neutral;
  if (availableRange === 0) {
    return neutral;
  }
  const normalizedMagnitude = Math.min(1, Math.abs(delta) / availableRange);
  const emphasizedMagnitude =
    normalizedMagnitude ** TERRAIN_RELIEF_CURVE_EXPONENT;
  return (
    neutral + Math.sign(delta) * emphasizedMagnitude * availableRange
  );
}

export function getTerrainResponsiveProfile(
  width: number
): TerrainResponsiveProfile {
  if (width < 640) {
    return {
      canvasHeight: 280,
      depthRowCount: 17,
      majorColumnCount: 7,
      maximumPresentationVertexCount: 320,
      minorColumnCount: 55,
      profile: "mobile",
    };
  }

  if (width < 1024) {
    return {
      canvasHeight: 320,
      depthRowCount: 25,
      majorColumnCount: 9,
      maximumPresentationVertexCount: 480,
      minorColumnCount: 85,
      profile: "tablet",
    };
  }

  return {
    canvasHeight: 360,
    depthRowCount: 35,
    majorColumnCount: 11,
    maximumPresentationVertexCount: 720,
    minorColumnCount: 125,
    profile: "desktop",
  };
}

export function terrainDevicePixelRatio(devicePixelRatio: number): number {
  if (!Number.isFinite(devicePixelRatio) || devicePixelRatio <= 0) {
    return 1;
  }

  return Math.min(devicePixelRatio, TERRAIN_DEVICE_PIXEL_RATIO_CEILING);
}

export function projectTerrainVertex(
  vertex: TerrainHeightfieldVertex,
  rowIndex: number,
  rowCount: number,
  authoritativeRowIndex: number,
  viewport: TerrainViewport,
  neutralPosition = 0.5
): ProjectedTerrainVertex {
  const depth = rowCount <= 1 ? 0 : rowIndex / (rowCount - 1);
  const horizonY = viewport.height * TERRAIN_HORIZON_RATIO;
  const foregroundY = viewport.height * 0.78;
  const depthCurve = Math.pow(depth, TERRAIN_DEPTH_PROJECTION_EXPONENT);
  const rowFloorY = horizonY + (foregroundY - horizonY) * depthCurve;
  const usableWidth = Math.max(0, viewport.width - 76);
  const centerX = 58 + usableWidth / 2;
  const widthScale =
    TERRAIN_DISTANCE_WIDTH_SCALE +
    Math.pow(depth, 0.92) * (1 - TERRAIN_DISTANCE_WIDTH_SCALE);
  const amplitudeScale =
    viewport.height *
    (0.1 + Math.pow(depth, 1.08) * 0.34) *
    TERRAIN_RELIEF_MULTIPLIER;
  const authoritativeDepth =
    rowCount <= 1 ? 0 : authoritativeRowIndex / (rowCount - 1);
  const spineEmphasis =
    1 - Math.abs(depth - authoritativeDepth) * 0.12;
  const projectedHeight =
    vertex.height === null
      ? null
      : vertex.kind === "authoritative"
        ? vertex.height
        : emphasizeDecorativeTerrainHeight(
            vertex.height,
            neutralPosition
          );

  return {
    ...vertex,
    depth,
    isAuthoritative: rowIndex === authoritativeRowIndex,
    rowIndex,
    screenX:
      centerX + (vertex.normalizedX - 0.5) * usableWidth * widthScale,
    screenY:
      projectedHeight === null
        ? null
        : rowFloorY - projectedHeight * amplitudeScale * spineEmphasis,
  };
}

export function projectEngineeringTerrain(
  heightfield: EngineeringTerrainHeightfield,
  viewport: TerrainViewport
): ProjectedEngineeringTerrain {
  return {
    authoritativeRowIndex: heightfield.authoritativeRowIndex,
    horizonY: viewport.height * TERRAIN_HORIZON_RATIO,
    rows: heightfield.rows.map((row) => ({
      depth: row.depth,
      isAuthoritative: row.isAuthoritative,
      rowIndex: row.rowIndex,
      vertices: row.vertices.map((vertex) =>
        projectTerrainVertex(
          vertex,
          row.rowIndex,
          heightfield.rows.length,
          heightfield.authoritativeRowIndex,
          viewport,
          heightfield.domain.neutralPosition
        )
      ),
    })),
  };
}

export function projectedTerrainColumn(
  terrain: ProjectedEngineeringTerrain,
  normalizedX: number
): ProjectedTerrainVertex[] {
  const boundedX = Math.max(0, Math.min(1, normalizedX));
  return terrain.rows.flatMap((row) => {
    let nearest: ProjectedTerrainVertex | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (const vertex of row.vertices) {
      const distance = Math.abs(vertex.normalizedX - boundedX);
      if (distance < nearestDistance) {
        nearest = vertex;
        nearestDistance = distance;
      }
    }
    return nearest ? [nearest] : [];
  });
}

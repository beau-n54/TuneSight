"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import {
  formatGraphValue,
  type GraphPoint,
  type GraphRegion,
  type GraphSeries,
} from "./telemetryGraphPresentation";
import {
  buildEngineeringTerrainHeightfield,
  selectTerrainColumnPositions,
  type EngineeringTerrainHeightfield,
} from "./engineeringTerrainHeightfield";
import {
  getTerrainResponsiveProfile,
  projectEngineeringTerrain,
  projectedTerrainColumn,
  projectTerrainVertex,
  terrainDevicePixelRatio,
  type ProjectedEngineeringTerrain,
  type ProjectedTerrainRow,
  type ProjectedTerrainVertex,
} from "./engineeringTerrainProjection";
import {
  moveTerrainKeyboardPoint,
  resolveTerrainPointer,
  terrainRegionsForPoint,
} from "./engineeringTerrainInteraction";

type EngineeringTerrainRendererProps = {
  chartTitle: string;
  domain?: readonly [number | "auto", number | "auto"];
  points: readonly GraphPoint[];
  regions: readonly GraphRegion[];
  series: GraphSeries;
};

type TerrainSize = {
  height: number;
  viewportWidth: number;
  width: number;
};

const TERRAIN_DISCLOSURE =
  "Visual terrain only. Engineering values are represented by the highlighted ridge.";

function colorWithAlpha(color: string, alpha: number): string {
  const channels = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(color);
  if (!channels) {
    return `rgba(14, 165, 233, ${alpha})`;
  }

  return `rgba(${Number.parseInt(channels[1], 16)}, ${Number.parseInt(channels[2], 16)}, ${Number.parseInt(channels[3], 16)}, ${alpha})`;
}

function drawPath(
  context: CanvasRenderingContext2D,
  vertices: readonly ProjectedTerrainVertex[]
) {
  let segmentOpen = false;
  context.beginPath();
  for (const vertex of vertices) {
    if (vertex.screenY === null) {
      segmentOpen = false;
      continue;
    }

    if (segmentOpen) {
      context.lineTo(vertex.screenX, vertex.screenY);
    } else {
      context.moveTo(vertex.screenX, vertex.screenY);
      segmentOpen = true;
    }
  }
  context.stroke();
}

function drawBackground(
  context: CanvasRenderingContext2D,
  size: TerrainSize,
  horizonY: number,
  color: string
) {
  const background = context.createLinearGradient(0, 0, size.width, 0);
  background.addColorStop(0, "#020617");
  background.addColorStop(0.5, "#020b1a");
  background.addColorStop(1, "#000713");
  context.fillStyle = background;
  context.fillRect(0, 0, size.width, size.height);

  const horizon = context.createRadialGradient(
    size.width / 2,
    horizonY,
    0,
    size.width / 2,
    horizonY,
    size.width * 0.56
  );
  horizon.addColorStop(0, colorWithAlpha(color, 0.18));
  horizon.addColorStop(0.42, colorWithAlpha(color, 0.065));
  horizon.addColorStop(1, "rgba(2, 6, 23, 0)");
  context.fillStyle = horizon;
  context.fillRect(0, 0, size.width, size.height);

  context.save();
  context.strokeStyle = "rgba(14, 165, 233, 0.07)";
  context.lineWidth = 1;
  for (let x = 0; x <= size.width; x += 56) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, size.height);
    context.stroke();
  }
  for (let y = 0; y <= size.height; y += 56) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(size.width, y);
    context.stroke();
  }
  context.strokeStyle = "rgba(14, 165, 233, 0.025)";
  for (let x = 0; x <= size.width; x += 14) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, size.height);
    context.stroke();
  }
  for (let y = 0; y <= size.height; y += 14) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(size.width, y);
    context.stroke();
  }
  context.restore();
}

function drawRegions(
  context: CanvasRenderingContext2D,
  terrain: ProjectedEngineeringTerrain,
  regions: readonly GraphRegion[],
  size: TerrainSize
) {
  const ridge = terrain.rows[terrain.authoritativeRowIndex];
  for (const region of regions) {
    const start = ridge.vertices.find(
      (vertex) =>
        vertex.kind === "authoritative" &&
        vertex.sourcePoint.index === region.startIndex
    );
    const end = ridge.vertices.find(
      (vertex) =>
        vertex.kind === "authoritative" &&
        vertex.sourcePoint.index === region.endIndex
    );
    if (!start || !end) {
      continue;
    }

    const left = Math.min(start.screenX, end.screenX);
    const width = Math.max(1, Math.abs(end.screenX - start.screenX));
    context.fillStyle =
      region.kind === "event"
        ? "rgba(245, 158, 11, 0.035)"
        : "rgba(56, 189, 248, 0.018)";
    context.fillRect(left, terrain.horizonY, width, size.height - terrain.horizonY);
    context.strokeStyle =
      region.kind === "event"
        ? "rgba(245, 158, 11, 0.42)"
        : "rgba(56, 189, 248, 0.32)";
    context.setLineDash(region.kind === "event" ? [4, 3] : [2, 5]);
    context.strokeRect(
      left,
      terrain.horizonY,
      width,
      size.height - terrain.horizonY
    );
  }
  context.setLineDash([]);
}

function drawTerrainRows(
  context: CanvasRenderingContext2D,
  rows: readonly ProjectedTerrainRow[],
  color: string,
  luminosity: number
) {
  for (const row of rows) {
    if (row.isAuthoritative) {
      continue;
    }
    const foregroundStrength = Math.pow(row.depth, 1.4);
    context.strokeStyle = colorWithAlpha(
      color,
      (0.055 + foregroundStrength * 0.385) * luminosity
    );
    context.lineWidth =
      (row.rowIndex % 3 === 0 ? 0.72 : 0.32) + foregroundStrength * 0.78;
    context.shadowBlur = row.rowIndex % 3 === 0 ? foregroundStrength * 4 : 0;
    context.shadowColor = colorWithAlpha(color, 0.42);
    drawPath(context, row.vertices);
  }
  context.shadowBlur = 0;
}

function drawColumns(
  context: CanvasRenderingContext2D,
  terrain: ProjectedEngineeringTerrain,
  positions: readonly number[],
  major: boolean,
  color: string,
  luminosity: number
) {
  const presentationVertexCount = Math.max(
    ...terrain.rows.map((row) => row.vertices.length)
  );
  const presentationRow = terrain.rows.find(
    (row) => row.vertices.length === presentationVertexCount
  );
  for (const [positionIndex, position] of positions.entries()) {
    context.beginPath();
    let segmentOpen = false;
    const normalizedPosition =
      presentationRow?.vertices[position]?.normalizedX ?? 0.5;
    const column = projectedTerrainColumn(terrain, normalizedPosition);
    const vertices = major
      ? column
      : column.slice(Math.floor(column.length * 0.32));
    for (const vertex of vertices) {
      if (!vertex || vertex.screenY === null) {
        segmentOpen = false;
        continue;
      }
      if (segmentOpen) {
        context.lineTo(vertex.screenX, vertex.screenY);
      } else {
        context.moveTo(vertex.screenX, vertex.screenY);
        segmentOpen = true;
      }
    }
    const centerDistance =
      positions.length <= 1
        ? 0
        : Math.abs(positionIndex / (positions.length - 1) - 0.5) * 2;
    const baseAlpha =
      ((major ? 0.2 : 0.055) +
        (1 - centerDistance) * (major ? 0.14 : 0.06)) *
      luminosity;
    const firstVisible = vertices.find((vertex) => vertex.screenY !== null);
    const lastVisible = vertices.findLast((vertex) => vertex.screenY !== null);
    if (firstVisible?.screenY != null && lastVisible?.screenY != null) {
      const gradient = context.createLinearGradient(
        0,
        firstVisible.screenY,
        0,
        lastVisible.screenY
      );
      gradient.addColorStop(0, colorWithAlpha(color, baseAlpha * 0.22));
      gradient.addColorStop(0.48, colorWithAlpha(color, baseAlpha * 0.56));
      gradient.addColorStop(1, colorWithAlpha(color, baseAlpha));
      context.strokeStyle = gradient;
    } else {
      context.strokeStyle = colorWithAlpha(color, baseAlpha);
    }
    context.lineWidth = major ? 0.75 : 0.38;
    context.stroke();
  }
}

function drawHorizontalAxis(
  context: CanvasRenderingContext2D,
  terrain: ProjectedEngineeringTerrain,
  positions: readonly number[],
  size: TerrainSize,
  color: string
) {
  const ridge = terrain.rows[terrain.authoritativeRowIndex];
  const axisY = size.height - 45;

  context.save();
  context.strokeStyle = colorWithAlpha(color, 0.46);
  context.fillStyle = "#a1a1aa";
  context.font = "10px ui-monospace, SFMono-Regular, Menlo, monospace";
  context.textAlign = "center";
  context.textBaseline = "top";
  context.beginPath();
  const candidates = positions.flatMap((position) => {
    const vertex = ridge.vertices[position];
    return vertex ? [vertex] : [];
  });
  const visibleTicks: ProjectedTerrainVertex[] = [];
  for (const vertex of candidates) {
    const previous = visibleTicks.at(-1);
    if (!previous || vertex.screenX - previous.screenX >= 56) {
      visibleTicks.push(vertex);
    }
  }
  const finalCandidate = candidates.at(-1);
  if (finalCandidate && visibleTicks.at(-1) !== finalCandidate) {
    if (finalCandidate.screenX - (visibleTicks.at(-1)?.screenX ?? 0) < 56) {
      visibleTicks.pop();
    }
    visibleTicks.push(finalCandidate);
  }

  for (const vertex of visibleTicks) {
    if (vertex.kind !== "authoritative") {
      continue;
    }
    context.moveTo(vertex.screenX, axisY - 5);
    context.lineTo(vertex.screenX, axisY);
    context.fillText(
      (vertex.sourcePoint.index + 1).toLocaleString(),
      vertex.screenX,
      axisY + 3
    );
  }
  context.stroke();
  context.restore();
}

function formatTerrainAxisValue(value: number): string {
  if (Math.abs(value) >= 1000) {
    return Math.round(value).toLocaleString();
  }
  if (Number.isInteger(value)) {
    return value.toString();
  }
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function drawValueAxis(
  context: CanvasRenderingContext2D,
  heightfield: EngineeringTerrainHeightfield,
  size: TerrainSize,
  color: string
) {
  const ridge = heightfield.rows[heightfield.authoritativeRowIndex];
  const anchor = ridge.vertices[0];
  const range = heightfield.domain.yMaximum - heightfield.domain.yMinimum;
  if (!anchor || range <= 0) {
    return;
  }

  context.save();
  context.fillStyle = "#a1a1aa";
  context.strokeStyle = colorWithAlpha(color, 0.4);
  context.font = "10px ui-monospace, SFMono-Regular, Menlo, monospace";
  context.textAlign = "right";
  context.textBaseline = "middle";
  for (const value of heightfield.majorValueTicks) {
    const projected = projectTerrainVertex(
      {
        ...anchor,
        height: (value - heightfield.domain.yMinimum) / range,
      },
      heightfield.authoritativeRowIndex,
      heightfield.rows.length,
      heightfield.authoritativeRowIndex,
      size
    );
    if (projected.screenY === null || projected.screenY < 10 || projected.screenY > size.height - 54) {
      continue;
    }
    context.fillText(formatTerrainAxisValue(value), 38, projected.screenY);
    context.beginPath();
    context.moveTo(42, projected.screenY);
    context.lineTo(49, projected.screenY);
    context.stroke();
  }
  context.restore();
}

function drawZeroReference(
  context: CanvasRenderingContext2D,
  heightfield: EngineeringTerrainHeightfield,
  size: TerrainSize
) {
  if (heightfield.domain.zeroPosition === null) {
    return;
  }
  const ridge = heightfield.rows[heightfield.authoritativeRowIndex];
  const first = ridge.vertices[0];
  const last = ridge.vertices.at(-1);
  if (!first || !last) {
    return;
  }
  const zeroFirst = projectTerrainVertex(
    { ...first, height: heightfield.domain.zeroPosition },
    heightfield.authoritativeRowIndex,
    heightfield.rows.length,
    heightfield.authoritativeRowIndex,
    size
  );
  const zeroLast = projectTerrainVertex(
    { ...last, height: heightfield.domain.zeroPosition },
    heightfield.authoritativeRowIndex,
    heightfield.rows.length,
    heightfield.authoritativeRowIndex,
    size
  );
  if (zeroFirst.screenY === null || zeroLast.screenY === null) {
    return;
  }
  context.save();
  context.setLineDash([4, 5]);
  context.strokeStyle = "rgba(251, 191, 36, 0.42)";
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(zeroFirst.screenX, zeroFirst.screenY);
  context.lineTo(zeroLast.screenX, zeroLast.screenY);
  context.stroke();
  context.restore();
}

function drawAuthoritativeRidge(
  context: CanvasRenderingContext2D,
  terrain: ProjectedEngineeringTerrain,
  heightfield: EngineeringTerrainHeightfield,
  color: string,
  activePoint: GraphPoint | null
) {
  const ridge = terrain.rows[terrain.authoritativeRowIndex];
  context.save();
  context.strokeStyle = color;
  context.lineWidth = 1.35;
  context.shadowBlur = 4;
  context.shadowColor = color;
  drawPath(context, ridge.vertices);

  for (const position of heightfield.majorColumnPositions) {
    const vertex = ridge.vertices[position];
    if (!vertex || vertex.screenY === null) {
      continue;
    }
    context.beginPath();
    context.fillStyle = color;
    context.arc(vertex.screenX, vertex.screenY, 1.1, 0, Math.PI * 2);
    context.fill();
  }

  const activeVertex = ridge.vertices.find(
    (vertex) =>
      vertex.kind === "authoritative" && vertex.sourcePoint === activePoint
  );
  if (activeVertex?.screenY !== null && activeVertex?.screenY !== undefined) {
    context.beginPath();
    context.fillStyle = "#020617";
    context.strokeStyle = "#f8fafc";
    context.lineWidth = 2;
    context.arc(activeVertex.screenX, activeVertex.screenY, 5, 0, Math.PI * 2);
    context.fill();
    context.stroke();
  }
  context.restore();
}

function TerrainTooltip({
  point,
  regions,
  series,
  vertex,
}: {
  point: GraphPoint;
  regions: readonly GraphRegion[];
  series: GraphSeries;
  vertex: ProjectedTerrainVertex | null;
}) {
  const value = point[series.id];
  const activeRegions = terrainRegionsForPoint(point, regions);
  const pull = activeRegions.find((region) => region.kind === "pull");

  return (
    <div
      aria-live="polite"
      className="pointer-events-none absolute z-10 min-w-60 border border-sky-950 bg-zinc-950/95 p-3 text-xs shadow-2xl shadow-sky-950/40 backdrop-blur-sm"
      style={{
        left: vertex ? `${Math.min(vertex.screenX + 14, 520)}px` : "1rem",
        top: vertex?.screenY ? `${Math.max(12, vertex.screenY - 82)}px` : "1rem",
      }}
    >
      <p className="font-mono font-semibold text-sky-300">
        Sample Sequence {(point.index + 1).toLocaleString()}
      </p>
      <p className="mt-1 font-mono text-[10px] text-zinc-500">
        Source sample {(point.index + 1).toLocaleString()}
        {point.rpm !== null
          ? ` · ${Math.round(point.rpm).toLocaleString()} recorded RPM`
          : ""}
      </p>
      {pull && (
        <p className="mt-1 text-[10px] uppercase tracking-wider text-sky-500">
          {pull.label}
        </p>
      )}
      <div className="mt-2 flex items-center justify-between gap-5 border-t border-zinc-800 pt-2">
        <span style={{ color: series.color }}>{series.label}</span>
        <span className="font-mono font-medium text-zinc-100">
          {typeof value === "number"
            ? formatGraphValue(value, series.unit)
            : "N/A"}
        </span>
      </div>
      {activeRegions
        .filter((region) => region.kind === "event")
        .map((region) => (
          <p key={region.id} className="mt-1 text-zinc-300">
            Event: {region.label}
          </p>
        ))}
    </div>
  );
}

export default function EngineeringTerrainRenderer({
  chartTitle,
  domain,
  points,
  regions,
  series,
}: EngineeringTerrainRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<TerrainSize>({
    height: 360,
    viewportWidth: 1024,
    width: 0,
  });
  const [pointerPoint, setPointerPoint] = useState<GraphPoint | null>(null);
  const [keyboardPoint, setKeyboardPoint] = useState<GraphPoint | null>(null);
  const [rendererError, setRendererError] = useState<string | null>(null);
  const activePoint = pointerPoint ?? keyboardPoint;
  const meshLuminosity = series.id === "afr" ? 0.72 : 1;
  const profile = useMemo(
    () => getTerrainResponsiveProfile(size.viewportWidth),
    [size.viewportWidth]
  );
  const heightfield = useMemo(
    () =>
      buildEngineeringTerrainHeightfield(points, series.id, {
        depthRowCount: profile.depthRowCount,
        majorColumnCount: profile.majorColumnCount,
        maximumPresentationVertexCount:
          profile.maximumPresentationVertexCount,
        minorColumnCount: profile.minorColumnCount,
        valueDomain: domain,
      }),
    [domain, points, profile, series.id]
  );
  const axisPositions = useMemo(
    () =>
      selectTerrainColumnPositions(
        points.length,
        profile.profile === "desktop" ? 6 : profile.profile === "tablet" ? 5 : 4
      ),
    [points.length, profile.profile]
  );
  const projectedTerrain = useMemo(
    () =>
      heightfield && size.width > 0
        ? projectEngineeringTerrain(heightfield, size)
        : null,
    [heightfield, size]
  );
  const authoritativeVertices =
    projectedTerrain?.rows[
      projectedTerrain.authoritativeRowIndex
    ].vertices.filter((vertex) => vertex.kind === "authoritative") ?? [];
  const activeVertex =
    authoritativeVertices.find(
      (vertex) => vertex.sourcePoint === activePoint
    ) ?? null;
  const finiteValues = points.flatMap((point) => {
    const value = point[series.id];
    return typeof value === "number" && Number.isFinite(value) ? [value] : [];
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const updateSize = () => {
      const width = Math.max(0, Math.round(container.clientWidth));
      const availableHeight = Math.max(0, Math.round(container.clientHeight));
      const viewportWidth = window.innerWidth;
      const responsiveProfile = getTerrainResponsiveProfile(viewportWidth);
      setSize({
        height: Math.max(
          220,
          Math.min(responsiveProfile.canvasHeight, availableHeight - 48)
        ),
        viewportWidth,
        width,
      });
    };
    updateSize();
    window.addEventListener("resize", updateSize);

    if (typeof ResizeObserver === "undefined") {
      return () => window.removeEventListener("resize", updateSize);
    }

    const observer = new ResizeObserver(updateSize);
    observer.observe(container);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateSize);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !heightfield || !projectedTerrain || size.width <= 0) {
      return;
    }

    try {
      const context = canvas.getContext("2d");
      if (!context) {
        queueMicrotask(() =>
          setRendererError("Canvas 2D is unavailable in this browser.")
        );
        return;
      }
      const ratio = terrainDevicePixelRatio(window.devicePixelRatio);
      canvas.width = Math.round(size.width * ratio);
      canvas.height = Math.round(size.height * ratio);
      canvas.style.height = `${size.height}px`;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, size.width, size.height);
      drawBackground(context, size, projectedTerrain.horizonY, series.color);
      drawTerrainRows(
        context,
        projectedTerrain.rows,
        series.color,
        meshLuminosity
      );
      drawColumns(
        context,
        projectedTerrain,
        heightfield.minorColumnPositions,
        false,
        series.color,
        meshLuminosity
      );
      drawColumns(
        context,
        projectedTerrain,
        heightfield.majorColumnPositions,
        true,
        series.color,
        meshLuminosity
      );
      drawRegions(context, projectedTerrain, regions, size);
      drawZeroReference(context, heightfield, size);
      drawValueAxis(context, heightfield, size, series.color);
      drawAuthoritativeRidge(
        context,
        projectedTerrain,
        heightfield,
        series.color,
        activePoint
      );
      drawHorizontalAxis(
        context,
        projectedTerrain,
        axisPositions,
        size,
        series.color
      );
      queueMicrotask(() => setRendererError(null));
    } catch {
      queueMicrotask(() =>
        setRendererError("The Terrain renderer could not draw this telemetry.")
      );
    }
  }, [activePoint, axisPositions, heightfield, meshLuminosity, projectedTerrain, regions, series.color, size]);

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!projectedTerrain) {
      return;
    }
    const bounds = event.currentTarget.getBoundingClientRect();
    setPointerPoint(
      resolveTerrainPointer(authoritativeVertices, {
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      })
    );
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const movement =
      event.key === "ArrowLeft"
        ? "previous"
        : event.key === "ArrowRight"
          ? "next"
          : event.key === "Home"
            ? "home"
            : event.key === "End"
              ? "end"
              : null;

    if (movement) {
      event.preventDefault();
      setKeyboardPoint((current) =>
        moveTerrainKeyboardPoint(points, current, movement)
      );
    } else if (event.key === "Escape") {
      setKeyboardPoint(null);
    }
  }

  const minimum = finiteValues.length > 0 ? Math.min(...finiteValues) : null;
  const maximum = finiteValues.length > 0 ? Math.max(...finiteValues) : null;

  return (
    <div className="min-h-0 min-w-0 overflow-hidden bg-black/80 p-2" ref={containerRef}>
      <div
        aria-label={`${chartTitle} Engineering Terrain`}
        aria-describedby={`${series.id}-terrain-summary`}
        className="relative overflow-hidden border border-sky-950/90 bg-[#020617] shadow-[inset_0_0_42px_rgba(2,132,199,0.13),0_0_0_1px_rgba(14,165,233,0.05)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
        onKeyDown={handleKeyDown}
        onPointerLeave={() => setPointerPoint(null)}
        onPointerMove={handlePointerMove}
        role="group"
        tabIndex={0}
      >
        {heightfield && !rendererError ? (
          <canvas aria-hidden="true" className="block w-full" ref={canvasRef} />
        ) : (
          <div
            className="flex min-h-72 items-center justify-center px-6 text-center text-sm text-zinc-400"
            style={{ height: `${profile.canvasHeight}px` }}
          >
            {rendererError ?? "No valid telemetry values are available for Terrain view."}
            <span className="ml-1 text-zinc-500">Use Line view for conventional inspection.</span>
          </div>
        )}

        {activePoint && (
          <TerrainTooltip
            point={activePoint}
            regions={regions}
            series={series}
            vertex={activeVertex}
          />
        )}

        <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center text-[11px] font-semibold text-sky-100">
          Sample Sequence
        </div>
        <div className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 -rotate-90 text-[10px] font-semibold text-sky-100">
          {series.unit}
        </div>
      </div>

      <div
        className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-zinc-500"
        id={`${series.id}-terrain-summary`}
      >
        <span>{points.length.toLocaleString()} unchanged samples</span>
        <span>Terrain horizontal position preserves source sample sequence.</span>
        {points.some((point) => point.rpm !== null) && (
          <span>Exact recorded RPM is available in the inspection tooltip.</span>
        )}
        <span>
          {minimum === null || maximum === null
            ? "Selected values unavailable"
            : `${formatGraphValue(minimum, series.unit)}–${formatGraphValue(maximum, series.unit)}`}
        </span>
        <span>{TERRAIN_DISCLOSURE}</span>
      </div>
    </div>
  );
}

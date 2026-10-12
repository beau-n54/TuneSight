export type WorkshopViewMode = "grid" | "2d" | "3d";
export type CalibrationVisualState = "reference" | "current";
export type SliceDirection = "row" | "column";

export type WorkshopViewCapabilities = Readonly<{
  grid: boolean;
  twoDimensional: boolean;
  threeDimensional: boolean;
  reason2d: string | null;
  reason3d: string | null;
}>;

export type CalibrationPlotPoint = Readonly<{
  cellIndex: number;
  row: number;
  column: number;
  axisValue: number | string;
  referenceValue: number | null;
  currentValue: number;
  changed: boolean;
}>;

export type CalibrationSurfacePoint = Readonly<{
  cellIndex: number;
  row: number;
  column: number;
  x: number | string;
  y: number | string;
  referenceValue: number | null;
  currentValue: number;
  changed: boolean;
}>;

export type CalibrationVisualizationModel = Readonly<{
  capabilities: WorkshopViewCapabilities;
  columnAxis: Readonly<{ id: string; units: string | null; values: readonly (number | string)[] }>;
  rowAxis: Readonly<{ id: string; units: string | null; values: readonly (number | string)[] }>;
  valueUnits: string | null;
  surface: readonly CalibrationSurfacePoint[];
}>;

export type CalibrationSurfaceTriangle = Readonly<{
  id: string;
  cellIndices: readonly [number, number, number];
  points: readonly [CalibrationSurfacePoint, CalibrationSurfacePoint, CalibrationSurfacePoint];
}>;

export type CalibrationSurfaceMesh = Readonly<{
  available: boolean;
  triangles: readonly CalibrationSurfaceTriangle[];
  reason: string | null;
}>;

export function buildCalibrationSlice(
  model: CalibrationVisualizationModel,
  direction: SliceDirection,
  sliceIndex: number,
): readonly CalibrationPlotPoint[] {
  const bounded = direction === "row"
    ? Math.max(0, Math.min(sliceIndex, Math.max(1, model.rowAxis.values.length) - 1))
    : Math.max(0, Math.min(sliceIndex, Math.max(1, model.columnAxis.values.length) - 1));
  return Object.freeze(model.surface
    .filter((point) => direction === "row" ? point.row === bounded : point.column === bounded)
    .sort((a, b) => direction === "row" ? a.column - b.column : a.row - b.row)
    .map((point) => Object.freeze({
      cellIndex: point.cellIndex,
      row: point.row,
      column: point.column,
      axisValue: direction === "row" ? point.x : point.y,
      referenceValue: point.referenceValue,
      currentValue: point.currentValue,
      changed: point.changed,
    })));
}

export function moveSelectedCell(detail: Readonly<{ rows: number; columns: number; cells: readonly Readonly<{ index: number; row: number; column: number }>[] }>, current: number, deltaRow: number, deltaColumn: number): number {
  if (!detail.cells.length) return 0;
  const cell = detail.cells[current] ?? detail.cells[0]!;
  const row = Math.max(0, Math.min(detail.rows - 1, cell.row + deltaRow));
  const column = Math.max(0, Math.min(detail.columns - 1, cell.column + deltaColumn));
  return row * detail.columns + column;
}

export function buildCalibrationSurfaceMesh(model: CalibrationVisualizationModel): CalibrationSurfaceMesh {
  const rows = model.rowAxis.values.length;
  const columns = model.columnAxis.values.length;
  if (!model.capabilities.threeDimensional || rows < 2 || columns < 2) {
    return Object.freeze({ available: false, triangles: Object.freeze([]), reason: "Qualified two-axis surface geometry is unavailable." });
  }
  const byCoordinate = new Map(model.surface.map((point) => [`${point.row}:${point.column}`, point]));
  const triangles: CalibrationSurfaceTriangle[] = [];
  for (let row = 0; row < rows - 1; row += 1) {
    for (let column = 0; column < columns - 1; column += 1) {
      const topLeft = byCoordinate.get(`${row}:${column}`);
      const topRight = byCoordinate.get(`${row}:${column + 1}`);
      const bottomLeft = byCoordinate.get(`${row + 1}:${column}`);
      const bottomRight = byCoordinate.get(`${row + 1}:${column + 1}`);
      if (!topLeft || !topRight || !bottomLeft || !bottomRight) {
        return Object.freeze({ available: false, triangles: Object.freeze([]), reason: "Surface cells do not form a complete qualified rectangular mesh." });
      }
      triangles.push(
        Object.freeze({ id: `${row}:${column}:a`, cellIndices: Object.freeze([topLeft.cellIndex, bottomLeft.cellIndex, topRight.cellIndex] as const), points: Object.freeze([topLeft, bottomLeft, topRight] as const) }),
        Object.freeze({ id: `${row}:${column}:b`, cellIndices: Object.freeze([topRight.cellIndex, bottomLeft.cellIndex, bottomRight.cellIndex] as const), points: Object.freeze([topRight, bottomLeft, bottomRight] as const) }),
      );
    }
  }
  return Object.freeze({ available: true, triangles: Object.freeze(triangles), reason: null });
}

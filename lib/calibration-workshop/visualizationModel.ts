import type { WorkshopDefinitionDetail } from "./viewModel.ts";

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
  referenceValue: number;
  currentValue: number;
  changed: boolean;
}>;

export type CalibrationSurfacePoint = Readonly<{
  cellIndex: number;
  row: number;
  column: number;
  x: number | string;
  y: number | string;
  referenceValue: number;
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

export function capabilitiesForDefinition(detail: WorkshopDefinitionDetail): WorkshopViewCapabilities {
  if (!detail.summary.available || detail.cells.length === 0) {
    return Object.freeze({ grid: false, twoDimensional: false, threeDimensional: false, reason2d: "Qualified engineering values are unavailable.", reason3d: "Qualified engineering values are unavailable." });
  }
  if (detail.summary.shape === "scalar") {
    return Object.freeze({ grid: true, twoDimensional: false, threeDimensional: false, reason2d: "A scalar has no qualified line axis.", reason3d: "A scalar has no two-axis surface geometry." });
  }
  if (detail.summary.shape === "1D") {
    return Object.freeze({ grid: true, twoDimensional: true, threeDimensional: false, reason2d: null, reason3d: "A 1D Definition has no qualified second surface axis." });
  }
  return Object.freeze({ grid: true, twoDimensional: true, threeDimensional: true, reason2d: null, reason3d: null });
}

function axisForLength(detail: WorkshopDefinitionDetail, length: number, excludedId?: string) {
  return detail.axes.find((axis) => axis.values.length === length && axis.id !== excludedId);
}

export function buildCalibrationVisualizationModel(detail: WorkshopDefinitionDetail): CalibrationVisualizationModel {
  const columnEvidence = axisForLength(detail, detail.columns);
  const rowEvidence = axisForLength(detail, detail.rows, columnEvidence?.id);
  const columnAxis = Object.freeze({
    id: columnEvidence?.id ?? "Column index",
    units: columnEvidence?.units ?? null,
    values: Object.freeze(Array.from({ length: detail.columns }, (_, index) => columnEvidence?.values[index] ?? index)),
  });
  const rowAxis = Object.freeze({
    id: rowEvidence?.id ?? "Row index",
    units: rowEvidence?.units ?? null,
    values: Object.freeze(Array.from({ length: detail.rows }, (_, index) => rowEvidence?.values[index] ?? index)),
  });
  const surface = detail.cells.map((cell) => Object.freeze({
    cellIndex: cell.index,
    row: cell.row,
    column: cell.column,
    x: columnAxis.values[cell.column]!,
    y: rowAxis.values[cell.row]!,
    referenceValue: cell.referenceValue,
    currentValue: cell.currentValue,
    changed: cell.changed,
  }));
  return Object.freeze({ capabilities: capabilitiesForDefinition(detail), columnAxis, rowAxis, valueUnits: detail.summary.units, surface: Object.freeze(surface) });
}

export function buildCalibrationSlice(
  model: CalibrationVisualizationModel,
  direction: SliceDirection,
  sliceIndex: number,
): readonly CalibrationPlotPoint[] {
  const bounded = direction === "row"
    ? Math.max(0, Math.min(sliceIndex, model.rowAxis.values.length - 1))
    : Math.max(0, Math.min(sliceIndex, model.columnAxis.values.length - 1));
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

export function moveSelectedCell(detail: WorkshopDefinitionDetail, current: number, deltaRow: number, deltaColumn: number): number {
  if (!detail.cells.length) return 0;
  const cell = detail.cells[current] ?? detail.cells[0]!;
  const row = Math.max(0, Math.min(detail.rows - 1, cell.row + deltaRow));
  const column = Math.max(0, Math.min(detail.columns - 1, cell.column + deltaColumn));
  return row * detail.columns + column;
}

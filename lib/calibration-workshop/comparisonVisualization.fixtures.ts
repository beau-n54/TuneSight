/** Historical comparison adapter used only by provider/visualization parity tests.
 * Retained as their pre-U2 regression oracle until those reference tests retire.
 * Production geometry comes exclusively from the shared U0 projection. */
import type { WorkshopDefinitionDetail } from "./viewModel.ts";
import type { WorkshopViewCapabilities, CalibrationVisualizationModel } from "./visualizationModel.ts";

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

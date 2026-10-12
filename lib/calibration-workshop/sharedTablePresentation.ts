import type { WorkspaceTableProjection } from "./sharedWorkspaceAdapter.ts";
import { bindDefinitionKnowledge } from "./definitionKnowledgeBinding.ts";
import { buildCalibrationTerminology, type CalibrationTerminologyMode } from "./calibrationTerminology.ts";
import { workingCellValue, type WorkingCalibration } from "./workingCalibration.ts";
import type { CalibrationVisualizationModel } from "./visualizationModel.ts";

export type TableDisplayLayer = "reference" | "current" | "working";
export const exactNumber = (value: number | null | undefined) => value == null ? "Unavailable" : Object.is(value, -0) ? "-0" : String(value);
export function workingMatchesProjection(projection: WorkspaceTableProjection, working: WorkingCalibration | null) {
  const dataset = projection.slots.current.dataset;
  return Boolean(working && dataset && working.ownerScope === projection.context.ownerId && working.vehicleId === projection.context.vehicleId &&
    working.currentDatasetId === dataset.datasetId && working.currentDatasetRevision === dataset.datasetRevision &&
    working.romLayoutId === dataset.romLayoutId && working.relationshipRevision === dataset.relationshipRevision &&
    working.definitionSetRevision === dataset.definitionSetRevision);
}

/** One read-only presentation of the selected U0 projection. No provider, title matching or qualification. */
export function buildSharedTablePresentation(projection: WorkspaceTableProjection, working: WorkingCalibration | null,
  display: TableDisplayLayer, mode: CalibrationTerminologyMode) {
  const current = projection.slots.current, reference = projection.slots.reference;
  const selectedLayer = display === "reference" ? reference : current;
  const workingBound = workingMatchesProjection(projection, working);
  const available = selectedLayer.state === "available" && (display !== "working" || workingBound);
  const semantic = projection.semantic ?? bindDefinitionKnowledge({ definitionRevision: projection.selection.definitionRevision, definitionIdentity: null }, []);
  const dimensions = selectedLayer.definition?.dimensions;
  const rows = dimensions?.rows ?? 0, columns = dimensions?.columns ?? 0;
  const shape = !dimensions ? "unavailable" : dimensions.kind === "scalar" ? "scalar" : dimensions.kind === "array_1d" ? "1D" : "2D";
  const axes = selectedLayer.axes.filter(axis => axis.available).map(axis => ({ id: axis.id, values: axis.values, units: axis.units }));
  const axesMatch = JSON.stringify(current.axes) === JSON.stringify(reference.axes);
  const comparison = projection.comparison.state === "supplied" && current.state === "available" && reference.state === "available" && axesMatch;
  const comparisonReason = comparison ? null : reference.state !== "available" ? `Reference ${reference.state}; comparison unavailable.`
    : !axesMatch ? "Reference axes differ; overlay and deltas are unavailable. Inspect Reference separately."
    : "The owner has not supplied a compatible comparison.";
  const baseTerminology = buildCalibrationTerminology({ mode, sourceTitle: selectedLayer.definition?.title ?? current.definition?.title ?? "Unresolved Table",
    shape, rows, columns, axes, referenceAxes: reference.state === "available" ? reference.axes : undefined, semantic,
    outputUnits: selectedLayer.definition?.displayUnits ?? null });
  const terminology = { ...baseTerminology, grid: { ...baseTerminology.grid, displayedAxisState: display === "reference" ? "reference" as const : "current" as const } };
  const currentCells = new Map(current.state === "available" ? current.cells.map(cell => [cell.index, cell]) : []);
  const referenceCells = new Map(reference.state === "available" ? reference.cells.map(cell => [cell.index, cell]) : []);
  const at = (index: Map<number, typeof current.cells[number]>, cell: typeof current.cells[number]) => {
    const found = index.get(cell.index);
    return found?.row === cell.row && found.column === cell.column ? found : null;
  };
  const cells = available ? selectedLayer.cells.map(cell => {
    const immutable = at(currentCells, cell), ref = at(referenceCells, cell);
    const address = { ...projection.selection, ...cell };
    const workingValue = workingBound && immutable ? workingCellValue(working!, address, immutable.value) : null;
    const value = display === "working" ? workingValue : cell.value;
    const workingDelta = workingValue !== null && immutable ? workingValue - immutable.value : null;
    const referenceDelta = comparison && immutable && ref ? immutable.value - ref.value : null;
    return { ...cell, value, current: immutable, reference: ref, workingValue, workingDelta, referenceDelta,
      percentageDelta: workingDelta === null || !immutable || immutable.value === 0 ? null : workingDelta / immutable.value * 100,
      changed: display === "working" ? workingDelta !== null && workingDelta !== 0 : display === "current" && referenceDelta !== null && referenceDelta !== 0 };
  }) : [];
  const axis = (orientation: "X" | "Y") => {
    const matches = selectedLayer.axes.filter(item => item.orientation === orientation && item.available);
    return matches.length === 1 ? { id: matches[0].id, units: matches[0].units, values: matches[0].values } : { id: `${orientation} unavailable`, units: null, values: [] };
  };
  const columnAxis = axis("X"), rowAxis = axis("Y");
  const geometry = selectedLayer.geometry;
  const capabilities = { grid: available && geometry.grid, twoDimensional: available && geometry.line.supported,
    threeDimensional: available && geometry.surface.supported,
    reason2d: available ? geometry.line.reason : "Selected layer is unavailable.", reason3d: available ? geometry.surface.reason : "Selected layer is unavailable." };
  const visual: CalibrationVisualizationModel = { capabilities, columnAxis, rowAxis, valueUnits: terminology.output.units,
    surface: cells.flatMap(cell => cell.value === null ? [] : [{ cellIndex: cell.index, row: cell.row, column: cell.column,
      x: columnAxis.values[cell.column] ?? "Unavailable", y: rowAxis.values[cell.row] ?? "Unavailable",
      currentValue: cell.value, referenceValue: display !== "reference" && comparison ? cell.reference?.value ?? null : null, changed: cell.changed }]) };
  return { projection, display, available, workingBound, semantic, rows, columns, shape, cells, terminology, visual, comparison,
    comparisonReason, selectedLayer, views: { grid: capabilities.grid, line: capabilities.twoDimensional, surface: capabilities.threeDimensional,
      reason2d: capabilities.reason2d, reason3d: capabilities.reason3d } };
}
export type SharedTablePresentation = ReturnType<typeof buildSharedTablePresentation>;

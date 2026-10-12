import type { WorkingCellAddress, WorkingEditOperation, WorkingValidationState } from "./workingCalibration.ts";

export type WorkingEditSource = "direct" | "toolbar";

/** Presentation only: never reorder mutation targets or their parallel value/byte arrays. */
export function workingHistoryRange(targets: readonly WorkingCellAddress[]): string {
  const first = targets[0];
  if (!first) return "Coordinate range unavailable";
  let top = Infinity, left = Infinity, bottom = -Infinity, right = -Infinity;
  const coordinates = new Set<string>();
  for (const target of targets) {
    if (target.definitionRevision !== first.definitionRevision || target.occurrence !== first.occurrence ||
      ![target.row, target.column].every(value => Number.isSafeInteger(value) && value >= 0))
      return "Coordinate range unavailable";
    const coordinate = `${target.row}:${target.column}`;
    if (coordinates.has(coordinate)) return "Coordinate range unavailable";
    coordinates.add(coordinate);
    top = Math.min(top, target.row); bottom = Math.max(bottom, target.row);
    left = Math.min(left, target.column); right = Math.max(right, target.column);
  }
  if (targets.length === 1) return `R${top} C${left}`;
  const bounds = `R${top} C${left} → R${bottom} C${right}`;
  return (bottom - top + 1) * (right - left + 1) === coordinates.size
    ? bounds : `Sparse selection within ${bounds}`;
}

export function workingOperationLabel(operation: WorkingEditOperation, source: WorkingEditSource = "toolbar"): string {
  if (source === "direct") return "Direct value edit";
  if (operation === "assign") return "Set value";
  if (operation === "raw") return "Set raw integer";
  if (operation === "delta") return "Add/Subtract";
  if (operation === "multiply") return "Multiply";
  if (operation === "matrix") return "Matrix paste";
  if (operation === "revert") return "Revert to exact Current";
  if (operation === "interpolate-horizontal") return "Interpolate structural columns";
  if (operation === "interpolate-vertical") return "Interpolate structural rows";
  return "Percentage change";
}

export function validationExplanation(state: WorkingValidationState, findings: readonly string[]): string {
  if (state === "VALID") return "This edit can be applied exactly to the Working Calibration.";
  if (state === "WARNING") return "This change can be represented by the calibration, but TuneSight does not yet have a qualified engineering safety range for this Table.";
  if (findings.some((finding) => /not representable|raw integer conversion/i.test(finding))) return "This value cannot be represented exactly by this calibration Table.";
  return "This edit cannot be applied because it does not satisfy the Table's governed editing requirements.";
}

export function adjacentEditableCellIndex(current: number, cellCount: number, backwards = false): number {
  if (!Number.isInteger(current) || !Number.isInteger(cellCount) || cellCount <= 0 || current < 0 || current >= cellCount) return 0;
  return Math.max(0, Math.min(cellCount - 1, current + (backwards ? -1 : 1)));
}

export function engineeringToRawRepresentation(engineeringValue: number, inverse: Readonly<{ scale: number; offset: number; rawMinimum: number; rawMaximum: number }> | null): number | null {
  if (!inverse || !Number.isFinite(engineeringValue) || inverse.scale === 0) return null;
  const raw = (engineeringValue - inverse.offset) / inverse.scale;
  return Number.isFinite(raw) && raw >= inverse.rawMinimum && raw <= inverse.rawMaximum && Math.abs(raw - Math.round(raw)) <= 1e-7 ? Math.round(raw) : null;
}

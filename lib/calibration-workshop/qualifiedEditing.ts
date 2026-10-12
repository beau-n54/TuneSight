import type { WorkingCellAddress, WorkingDefinitionSeed, WorkingEditOperation, WorkingEditInput } from "./workingCalibration.ts";

export const MAX_EDIT_CELLS = 4096;
export const MAX_MATRIX_CHARACTERS = 131072;
/** Decimal point only. Scientific notation is explicit and bounded; no locale,
 * hexadecimal, coercion of blank strings, separators, NaN or infinities. */
export function parseWorkingNumber(text: string): number {
  if (text.length > 64 || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d{1,3})?$/.test(text.trim()))
    throw Error("Enter a finite decimal number using a dot, without grouping separators.");
  const value = Number(text.trim());
  if (!Number.isFinite(value) || value === 0 && /[1-9]/.test(text.trim().split(/[eE]/)[0])) throw Error("Value is outside the supported numeric range.");
  return value;
}
export function parseWorkingMatrix(text: string): readonly (readonly number[])[] {
  if (!text || text.length > MAX_MATRIX_CHARACTERS) throw Error("Matrix is empty or exceeds 128 KiB.");
  const rows = text.replace(/\r\n/g, "\n").replace(/\n$/, "").split("\n").map(row => row.split("\t"));
  if (!rows[0].length || rows.length * rows[0].length > MAX_EDIT_CELLS || rows.some(row => row.length !== rows[0].length))
    throw Error("Paste a rectangular tab-separated matrix of at most 4096 cells.");
  return rows.map(row => row.map(parseWorkingNumber));
}
export function selectedRectangle(targets: readonly WorkingCellAddress[]) {
  if (!targets.length || targets.length > MAX_EDIT_CELLS) throw Error("Select between 1 and 4096 cells.");
  const first = targets[0];
  if (targets.some(t => t.definitionRevision !== first.definitionRevision || t.occurrence !== first.occurrence)) throw Error("A matrix must stay within one exact Table occurrence.");
  const top = Math.min(...targets.map(t => t.row)), left = Math.min(...targets.map(t => t.column));
  const rows = Math.max(...targets.map(t => t.row)) - top + 1, columns = Math.max(...targets.map(t => t.column)) - left + 1;
  if (rows * columns !== targets.length || new Set(targets.map(t => `${t.row}:${t.column}`)).size !== targets.length) throw Error("Select one complete rectangle.");
  return { top, left, rows, columns, ordered: [...targets].sort((a,b) => a.row - b.row || a.column - b.column) };
}
export function matrixEditTargets(definition: WorkingDefinitionSeed, selected: readonly WorkingCellAddress[], matrix: readonly (readonly number[])[]) {
  const rectangle = selectedRectangle(selected), rows = matrix.length, columns = matrix[0]?.length ?? 0;
  if (!rows || !columns || rows * columns > MAX_EDIT_CELLS || matrix.some(row => row.length !== columns || row.some(v => !Number.isFinite(v)))) throw Error("Invalid matrix.");
  if (selected.length !== 1 && (rectangle.rows !== rows || rectangle.columns !== columns)) throw Error("Matrix dimensions must match the selected rectangle, or select a single starting cell.");
  if (rectangle.top + rows > definition.rows || rectangle.left + columns > definition.columns) throw Error("Matrix exceeds the Table; no cells were changed.");
  const targets = matrix.flatMap((row,r) => row.map((_,c) => ({ definitionRevision: definition.definitionRevision, occurrence: definition.occurrence,
    row: rectangle.top+r, column: rectangle.left+c, index: (rectangle.top+r)*definition.columns+rectangle.left+c })));
  return { targets, values: matrix.flat() };
}
export type WorkingStorageLayout = Readonly<{ widthBits: 8 | 16 | 32; signed: boolean; endianness: "little" | "big" }>;
export function planWorkingToolbar(operation: WorkingEditOperation, text: string, targets: readonly WorkingCellAddress[], definition: WorkingDefinitionSeed): WorkingEditInput {
  const matrix = operation === "matrix" ? matrixEditTargets(definition, targets, parseWorkingMatrix(text)) : null;
  const operand = operation === "matrix" || operation === "revert" || operation.startsWith("interpolate-") ? 0 : parseWorkingNumber(text);
  return { operation, operand, targets, definitions: [definition], recordExactRaw: true, ...(matrix ?? {}) };
}
export type ExactRawChange = Readonly<{ offset: number; widthBits: number; signed: boolean; endianness: "little" | "big";
  before: number; after: number; beforeBytes: readonly number[]; afterBytes: readonly number[]; rounding: "nearest-integer-within-1e-7-otherwise-reject" }>;
export function integerBytes(value: number, storage: WorkingStorageLayout): number[] {
  const { widthBits: bits, signed, endianness } = storage;
  if (![8,16,32].includes(bits) || typeof signed !== "boolean" || !["little", "big"].includes(endianness) || !Number.isSafeInteger(value) ||
    value < (signed ? -(2 ** (bits-1)) : 0) || value > (signed ? 2 ** (bits-1)-1 : 2 ** bits-1)) throw Error("Raw integer is outside its exact storage representation.");
  const unsigned = value < 0 ? value + 2 ** bits : value;
  const bytes = Array.from({ length: bits / 8 }, (_, i) => Math.floor(unsigned / 2 ** (8*i)) % 256);
  return endianness === "little" ? bytes : bytes.reverse();
}
export function exactWorkingValue(definition: WorkingDefinitionSeed, value: number) {
  const inverse = definition.capability.inverse;
  if (!inverse || !Number.isFinite(inverse.scale) || inverse.scale === 0 || !Number.isFinite(inverse.offset) || !Number.isFinite(value)) throw Error("Conversion is not reversibly qualified.");
  const candidate = (value-inverse.offset)/inverse.scale, raw = Math.round(candidate);
  if (!Number.isSafeInteger(raw) || candidate < inverse.rawMinimum || candidate > inverse.rawMaximum || Math.abs(candidate-raw) > 1e-7) throw Error("Value is not representable by the qualified raw integer conversion.");
  return { raw, engineering: raw*inverse.scale+inverse.offset };
}
/** Byte evidence for the sparse edit only. No source binary is copied or written. */
export function exactRawChange(definition: WorkingDefinitionSeed, target: WorkingCellAddress, prior: number, next: number): ExactRawChange {
  const cell = definition.cells.find(c => c.index === target.index), storage = definition.storage;
  if (!storage || !cell || !Number.isSafeInteger(cell.currentRawOffset) || cell.currentRawOffset! < 0 || !Number.isSafeInteger(cell.currentRawValue))
    throw Error("Exact raw cell location and storage qualification are required.");
  const baseline = exactWorkingValue(definition, cell.currentValue);
  if (baseline.raw !== cell.currentRawValue) throw Error("Current engineering and raw evidence disagree.");
  const before = exactWorkingValue(definition, prior).raw, after = exactWorkingValue(definition, next).raw;
  return { offset: cell.currentRawOffset!, ...storage, before, after, beforeBytes: integerBytes(before, storage), afterBytes: integerBytes(after, storage), rounding: "nearest-integer-within-1e-7-otherwise-reject" };
}

import type { WorkshopSemanticBinding } from "./definitionKnowledgeBinding.ts";

export type GridAxisEvidence = Readonly<{ id: string; units: string | null; values: readonly (number | string)[] }>;
export type GridAxis = Readonly<{ orientation: "X" | "Y"; engineeringName: string | null; sourceName: string; units: string | null; values: readonly (number | string)[]; usedStructuralFallback: boolean }>;
export type GridAxisPresentation = Readonly<{ shape: "scalar" | "1D" | "2D" | "unavailable"; x: GridAxis | null; y: GridAxis | null; output: Readonly<{ name: string; units: string | null }>; displayedAxisState: "current"; referenceAxesDiffer: boolean }>;

const freeze = <T>(value: T): T => { if (Array.isArray(value)) return Object.freeze(value.map(freeze)) as T; if (value && typeof value === "object") return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, item]) => [key, freeze(item)]))) as T; return value; };
const normal = (value: string) => value.trim().toLocaleLowerCase();
const exactAxis = (axes: readonly GridAxisEvidence[], id: string) => axes.find(axis => normal(axis.id) === id);
const byLength = (axes: readonly GridAxisEvidence[], length: number, excluded?: GridAxisEvidence) => axes.find(axis => axis !== excluded && axis.values.length === length);

function axis(input: Readonly<{ orientation: "X" | "Y"; length: number; evidence?: GridAxisEvidence; semantic: WorkshopSemanticBinding }>): GridAxis {
  const meaning = input.semantic.outcome === "exact" ? input.semantic.axisMeanings.find(field => normal(field.value.axisId) === normal(input.evidence?.id ?? input.orientation)) : undefined;
  return freeze({ orientation: input.orientation, engineeringName: meaning?.value.meaning ?? null, sourceName: input.evidence?.id.trim() || `${input.orientation.toLowerCase()} axis`, units: input.evidence?.units?.trim() || null, values: Array.from({ length: input.length }, (_, index) => input.evidence?.values[index] ?? index), usedStructuralFallback: !input.evidence || input.evidence.values.length !== input.length });
}

export function buildGridAxisPresentation(input: Readonly<{ shape: GridAxisPresentation["shape"]; rows: number; columns: number; axes: readonly GridAxisEvidence[]; referenceAxes?: readonly GridAxisEvidence[]; semantic: WorkshopSemanticBinding; outputUnits: string | null }>): GridAxisPresentation {
  if (input.shape === "scalar" || input.shape === "unavailable") return freeze({ shape: input.shape, x: null, y: null, output: { name: "Output", units: input.outputUnits }, displayedAxisState: "current", referenceAxesDiffer: false });
  const xEvidence = exactAxis(input.axes, "x") ?? byLength(input.axes, input.columns);
  const yEvidence = input.shape === "2D" ? exactAxis(input.axes, "y") ?? byLength(input.axes, input.rows, xEvidence) : undefined;
  const x = axis({ orientation: "X", length: input.columns, evidence: xEvidence, semantic: input.semantic });
  const y = input.shape === "2D" ? axis({ orientation: "Y", length: input.rows, evidence: yEvidence, semantic: input.semantic }) : null;
  const referenceAxesDiffer = input.referenceAxes ? JSON.stringify(input.referenceAxes) !== JSON.stringify(input.axes) : false;
  return freeze({ shape: input.shape, x, y, output: { name: "Output", units: input.outputUnits }, displayedAxisState: "current", referenceAxesDiffer });
}

export function gridAxisLabel(axis: GridAxis): string { return `${axis.orientation} · ${axis.engineeringName ?? "Source Axis"}${axis.units ? ` [${axis.units}]` : ""}`; }
export function gridAxisCoordinate(presentation: GridAxisPresentation, row: number, column: number) { return freeze({ x: presentation.x ? { value: presentation.x.values[column] ?? column, units: presentation.x.units } : null, y: presentation.y ? { value: presentation.y.values[row] ?? row, units: presentation.y.units } : null }); }

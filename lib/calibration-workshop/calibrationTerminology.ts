import { buildGridAxisPresentation, type GridAxisEvidence, type GridAxisPresentation } from "./gridAxisPresentation.ts";
import type { WorkshopSemanticBinding } from "./definitionKnowledgeBinding.ts";

export type CalibrationTerminologyMode = "standard" | "engineer";
export type CalibrationTerm = Readonly<{ label: string; units: string | null; sourceLabel: string; sourceUnits: string | null; qualified: boolean }>;
export type CalibrationTerminology = Readonly<{ mode: CalibrationTerminologyMode; tableName: string; sourceTitle: string; sourceSymbol: string | null; x: CalibrationTerm | null; y: CalibrationTerm | null; output: CalibrationTerm; controls: string | null; whyItMatters: string | null; limitations: readonly string[]; grid: GridAxisPresentation }>;

const freeze = <T>(value: T): T => { if (Array.isArray(value)) return Object.freeze(value.map(freeze)) as T; if (value && typeof value === "object") return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, item]) => [key, freeze(item)]))) as T; return value; };
const outputUnitUnqualified = (units: string | null, semantic: WorkshopSemanticBinding) => Boolean(units && semantic.limitations.some(item => item.toLocaleLowerCase().includes(units.toLocaleLowerCase()) && /(?:not qualified|unqualified|metadata only|not physical)/i.test(item)));

export function buildCalibrationTerminology(input: Readonly<{ mode: CalibrationTerminologyMode; sourceTitle: string; shape: GridAxisPresentation["shape"]; rows: number; columns: number; axes: readonly GridAxisEvidence[]; referenceAxes?: readonly GridAxisEvidence[]; semantic: WorkshopSemanticBinding; outputUnits: string | null }>): CalibrationTerminology {
  const grid = buildGridAxisPresentation(input);
  const exact = input.semantic.outcome === "exact";
  const term = (axis: GridAxisPresentation["x"]): CalibrationTerm | null => axis ? freeze({ label: input.mode === "standard" ? axis.engineeringName ?? "Axis meaning not yet qualified" : "Source Axis", units: axis.units, sourceLabel: axis.sourceName, sourceUnits: axis.units, qualified: exact && Boolean(axis.engineeringName) }) : null;
  const role = exact ? input.semantic.outputMeaning?.value ?? input.semantic.calibrationRole?.value ?? null : null;
  const unitQualified = !outputUnitUnqualified(input.outputUnits, input.semantic);
  return freeze({
    mode: input.mode,
    tableName: exact ? input.semantic.aliases[0] ?? input.sourceTitle : input.sourceTitle,
    sourceTitle: input.sourceTitle,
    sourceSymbol: input.semantic.sourceSymbol,
    x: term(grid.x),
    y: term(grid.y),
    output: { label: input.mode === "standard" ? role ?? "Output meaning not yet qualified" : "Source Output", units: input.mode === "standard" && !unitQualified ? null : input.outputUnits, sourceLabel: "Output", sourceUnits: input.outputUnits, qualified: exact && Boolean(role) && unitQualified },
    controls: exact ? input.semantic.controls[0]?.value ?? null : null,
    whyItMatters: exact ? input.semantic.whyItMatters[0]?.value ?? null : null,
    limitations: input.semantic.limitations,
    grid,
  });
}

export const calibrationTermLabel = (orientation: "X" | "Y", term: CalibrationTerm) => `${orientation} · ${term.label}${term.units ? ` [${term.units}]` : ""}`;

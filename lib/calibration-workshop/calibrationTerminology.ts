import { buildGridAxisPresentation, type GridAxisEvidence, type GridAxisPresentation } from "./gridAxisPresentation.ts";
import type { WorkshopSemanticBinding } from "./definitionKnowledgeBinding.ts";

export type CalibrationTerminologyMode = "standard" | "engineer";
export type CalibrationTerm = Readonly<{ label: string; units: string | null; sourceLabel: string; sourceUnits: string | null; qualified: boolean }>;
export type CalibrationTerminology = Readonly<{ mode: CalibrationTerminologyMode; tableName: string; sourceTitle: string; sourceSymbol: string | null; x: CalibrationTerm | null; y: CalibrationTerm | null; output: CalibrationTerm; controls: string | null; whyItMatters: string | null; limitations: readonly string[]; grid: GridAxisPresentation }>;

const freeze = <T>(value: T): T => { if (Array.isArray(value)) return Object.freeze(value.map(freeze)) as T; if (value && typeof value === "object") return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, item]) => [key, freeze(item)]))) as T; return value; };
const outputUnitUnqualified = (units: string | null, semantic: WorkshopSemanticBinding) => Boolean(units && semantic.limitations.some(item => item.toLocaleLowerCase().includes(units.toLocaleLowerCase()) && /(?:not qualified|unqualified|metadata only|not physical)/i.test(item)));
const STANDARD_CONCEPT_LABELS: Readonly<Record<string, string>> = Object.freeze({
  "Engine Speed": "RPM", "Intake Air Temperature": "IAT", "Charge Air Temperature": "Charge Temp", "Engine Coolant Temperature": "Coolant Temp", "Coolant Temperature": "Coolant Temp", "Oil Temperature": "Oil Temp", "Ethanol Content": "Ethanol %", "Wastegate Duty Cycle": "WGDC", "Ignition Timing": "Timing", "Ignition Timing Correction": "Timing Correction", "Requested Load": "Load Target", "Torque Request": "Torque Target", "Fuel Rail Pressure": "Rail Pressure", "Relative Boost-pressure Ceiling": "Boost Limit", "Base Fuel Pressure": "Fuel Pressure", "Fuel-scalar Blend Percentage": "Fuel Scalar Blend", "Timing-table Blend Percentage": "Timing Blend", "Load-and-boost Blend Percentage": "Load/Boost Blend", "Fuel-table Blend Percentage": "Fuel Blend", "Engine-speed Limit": "RPM Limit", "Alert Enable Delay": "Alert Delay",
});
const STANDARD_TABLE_LABELS: Readonly<Record<string, string>> = Object.freeze({
  "Boost Ceiling — Relative Pressure by Gear and RPM": "Boost Limit", "Wastegate Duty D-Factor Correction — Custom": "WGDC D Correction", "Minimum Load for WGDC P/D Corrections": "WGDC P/D Min Load", "Fuel Scalar Blend — Ethanol": "Fuel Scalar Blend", "Ignition Timing Blend — Ethanol": "Timing Blend", "Load and Boost Blend — Ethanol": "Load/Boost Blend", "Low Oil-pressure Limp-mode RPM Limit": "Oil-pressure Limp RPM Limit", "Low-pressure Fuel-system Base Pressure": "Fuel Pressure", "Oil-pressure Alert Enable Delay — Oil Temperature": "Oil-pressure Alert Delay", "Fuel-table Blend — Ethanol": "Fuel Blend", "Wastegate Base Position — Feed-forward": "WGDC Base Position", "Wastegate P-control Factor": "WGDC P Factor", "Wastegate D-control Factor": "WGDC D Factor", "Ignition Timing Correction Factor — Engine Temp × IAT": "Temp Timing Correction", "Load-limit Multiplier for Rich-mixture Component Protection": "Component Protection Load Limit",
});
const STANDARD_UNITS: Readonly<Record<string, string>> = Object.freeze({ C: "°C", "Temp (F)": "°F", "Air Temp TB (F)": "°F", "Ignition Adv (Deg)": "°" });

export const conciseCalibrationConcept = (qualifiedConcept: string) => STANDARD_CONCEPT_LABELS[qualifiedConcept] ?? qualifiedConcept;
export const conciseCalibrationUnit = (qualifiedUnit: string | null) => qualifiedUnit ? STANDARD_UNITS[qualifiedUnit] ?? qualifiedUnit : null;
export function calibrationTableLabel(mode: CalibrationTerminologyMode, sourceTitle: string, semantic: WorkshopSemanticBinding): string {
  if (mode === "engineer" || semantic.outcome !== "exact") return sourceTitle;
  const accepted = semantic.aliases[0] ?? sourceTitle;
  return STANDARD_TABLE_LABELS[accepted] ?? accepted;
}

export function buildCalibrationTerminology(input: Readonly<{ mode: CalibrationTerminologyMode; sourceTitle: string; shape: GridAxisPresentation["shape"]; rows: number; columns: number; axes: readonly GridAxisEvidence[]; referenceAxes?: readonly GridAxisEvidence[]; semantic: WorkshopSemanticBinding; outputUnits: string | null }>): CalibrationTerminology {
  const grid = buildGridAxisPresentation(input);
  const exact = input.semantic.outcome === "exact";
  const term = (axis: GridAxisPresentation["x"]): CalibrationTerm | null => axis ? freeze({ label: input.mode === "standard" ? axis.engineeringName ? conciseCalibrationConcept(axis.engineeringName) : "Not yet identified" : `Source ${axis.orientation} Axis`, units: input.mode === "standard" ? conciseCalibrationUnit(axis.units) : axis.units, sourceLabel: axis.sourceName, sourceUnits: axis.units, qualified: exact && Boolean(axis.engineeringName) }) : null;
  const role = exact ? input.semantic.outputMeaning?.value ?? input.semantic.calibrationRole?.value ?? null : null;
  const unitQualified = !outputUnitUnqualified(input.outputUnits, input.semantic);
  return freeze({
    mode: input.mode,
    tableName: calibrationTableLabel(input.mode, input.sourceTitle, input.semantic),
    sourceTitle: input.sourceTitle,
    sourceSymbol: input.semantic.sourceSymbol,
    x: term(grid.x),
    y: term(grid.y),
    output: { label: input.mode === "standard" ? role ? conciseCalibrationConcept(role) : "Not yet identified" : "Source Output", units: input.mode === "standard" ? unitQualified ? conciseCalibrationUnit(input.outputUnits) : null : input.outputUnits, sourceLabel: "Output", sourceUnits: input.outputUnits, qualified: exact && Boolean(role) && unitQualified },
    controls: exact ? input.semantic.controls[0]?.value ?? null : null,
    whyItMatters: exact ? input.semantic.whyItMatters[0]?.value ?? null : null,
    limitations: input.semantic.limitations,
    grid,
  });
}

export const calibrationTermLabel = (orientation: "X" | "Y", term: CalibrationTerm) => `${orientation} · ${term.label}${term.units ? ` [${term.units}]` : ""}`;

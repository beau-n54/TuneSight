import type { AvailableCalibrationDatasetDefinition, CalibrationDatasetDefinition } from "../xdf/qualifiedCalibrationDataset.ts";
import { deriveReversibleAffineEquation } from "../xdf/engineeringValueConversion.ts";
import type { WorkingEditCapability } from "./workingCalibration.ts";
import type { XdfDefinitionRevision } from "../xdf/canonicalXdfDefinition.ts";
import { parseXdfEquation } from "../xdf/engineeringValueConversion.ts";

export type TechnicalEditCapability = Readonly<{ state: "technically_reversible" | "blocked"; inverse: WorkingEditCapability["inverse"]; blockers: readonly string[] }>;
export function assessTechnicalEditCapability(definition: CalibrationDatasetDefinition): TechnicalEditCapability {
  if (!definition.engineeringEvidence) return Object.freeze({ state: "blocked", inverse: null, blockers: Object.freeze([`Definition is unavailable at ${definition.unavailableStage}.`]) });
  const available = definition as AvailableCalibrationDatasetDefinition, parsed = available.engineeringEvidence.valueEquation;
  if (!parsed || !("ast" in parsed)) return Object.freeze({ state: "blocked", inverse: null, blockers: Object.freeze(["Canonical conversion structure is unavailable."]) });
  const equation = deriveReversibleAffineEquation(parsed), bits = available.rawEvidence.widthBits, signed = available.rawEvidence.signed;
  if (equation.outcome !== "reversible_affine") return Object.freeze({ state: "blocked", inverse: null, blockers: Object.freeze([equation.finding]) });
  if ((bits !== 8 && bits !== 16 && bits !== 32) || signed === null) return Object.freeze({ state: "blocked", inverse: null, blockers: Object.freeze(["Raw integer representation is unresolved."]) });
  const rawMinimum = signed ? -(2 ** (bits - 1)) : 0, rawMaximum = signed ? 2 ** (bits - 1) - 1 : 2 ** bits - 1;
  return Object.freeze({ state: "technically_reversible", inverse: Object.freeze({ scale: equation.scale, offset: equation.offset, rawMinimum, rawMaximum }), blockers: Object.freeze([]) });
}
export function deriveWorkingEditCapability(definition: CalibrationDatasetDefinition, authority: Readonly<{ state: "EDIT_QUALIFIED" | "VIEW_ONLY"; revision: string | null; warnings?: readonly string[] }>): WorkingEditCapability {
  const technical = assessTechnicalEditCapability(definition), blockers = [...technical.blockers]; if (authority.state !== "EDIT_QUALIFIED") blockers.push("VIEW qualification does not grant EDIT authority.");
  return Object.freeze({ state: technical.state === "technically_reversible" && authority.state === "EDIT_QUALIFIED" ? "EDIT_QUALIFIED" : "VIEW_ONLY", revision: authority.state === "EDIT_QUALIFIED" ? authority.revision : null, inverse: technical.inverse, engineeringMinimum: null, engineeringMaximum: null, warnings: Object.freeze([...(authority.warnings ?? [])]), blockers: Object.freeze(blockers) });
}
export function assessXdfDefinitionTechnicalEditCapability(definition: XdfDefinitionRevision): TechnicalEditCapability {
  const axis = definition.axes.find((item) => item.axisId.toLowerCase() === "z") ?? definition.axes.at(-1), equation = axis?.equationSource ? parseXdfEquation(axis.equationSource) : null, bits = axis?.embeddedData.elementSizeBits ?? definition.defaultDataLayout.elementSizeBits, signed = definition.defaultDataLayout.signed;
  if (!axis || !equation || equation.outcome === "unsupported_expression" || equation.outcome === "malformed_equation") return Object.freeze({ state: "blocked", inverse: null, blockers: Object.freeze(["A supported value conversion equation is required."]) });
  const affine = deriveReversibleAffineEquation(equation); if (affine.outcome !== "reversible_affine") return Object.freeze({ state: "blocked", inverse: null, blockers: Object.freeze([affine.finding]) });
  if ((bits !== 8 && bits !== 16 && bits !== 32) || signed === null) return Object.freeze({ state: "blocked", inverse: null, blockers: Object.freeze(["Raw integer representation is unresolved."]) });
  return Object.freeze({ state: "technically_reversible", inverse: Object.freeze({ scale: affine.scale, offset: affine.offset, rawMinimum: signed ? -(2 ** (bits - 1)) : 0, rawMaximum: signed ? 2 ** (bits - 1) - 1 : 2 ** bits - 1 }), blockers: Object.freeze([]) });
}

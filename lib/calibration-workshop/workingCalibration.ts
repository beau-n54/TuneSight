export const WORKING_CALIBRATION_CONTRACT = "tunesight.working-calibration.v1" as const;

export type WorkingValidationState = "VALID" | "WARNING" | "BLOCKED";
export type WorkingEditOperation = "assign" | "delta" | "percentage";
export type WorkingCellAddress = Readonly<{ definitionRevision: string; occurrence: number; index: number; row: number; column: number }>;
export type WorkingCellSeed = WorkingCellAddress & Readonly<{ currentValue: number; units: string | null }>;
export type WorkingEditCapability = Readonly<{
  state: "EDIT_QUALIFIED" | "VIEW_ONLY";
  revision: string | null;
  inverse: Readonly<{ scale: number; offset: number; rawMinimum: number; rawMaximum: number }> | null;
  engineeringMinimum: number | null;
  engineeringMaximum: number | null;
  warnings: readonly string[];
  blockers: readonly string[];
}>;
export type WorkingDefinitionSeed = Readonly<{
  definitionRevision: string;
  occurrence: number;
  rows: number;
  columns: number;
  availability: "available" | "unavailable" | "quarantined";
  capability: WorkingEditCapability;
  cells: readonly WorkingCellSeed[];
}>;
export type WorkingMutation = Readonly<{
  sequence: number;
  operation: WorkingEditOperation;
  operand: number;
  targets: readonly WorkingCellAddress[];
  before: readonly number[];
  after: readonly number[];
  validation: WorkingValidationState;
  findings: readonly string[];
}>;
export type WorkingCalibration = Readonly<{
  contractVersion: typeof WORKING_CALIBRATION_CONTRACT;
  workingCalibrationId: string;
  workingCalibrationRevision: string;
  ownerScope: string;
  vehicleId: string;
  currentDatasetId: string;
  currentDatasetRevision: string;
  romLayoutId: string;
  relationshipRevision: string;
  definitionSetRevision: string;
  createdAt: string;
  updatedAt: string;
  definitions: readonly WorkingDefinitionSeed[];
  mutations: readonly WorkingMutation[];
  cursor: number;
  state: "unchanged" | "dirty";
  validation: WorkingValidationState;
}>;
export type WorkingEditResult = Readonly<{ status: "applied"; calibration: WorkingCalibration }> | Readonly<{ status: "blocked"; calibration: WorkingCalibration; findings: readonly string[] }>;
export type WorkingEditPreview = Readonly<{ validation: WorkingValidationState; findings: readonly string[]; before: readonly number[]; after: readonly number[] }>;

const freeze = <T>(value: T): T => { if (Array.isArray(value)) return Object.freeze(value.map(freeze)) as T; if (value && typeof value === "object") return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, item]) => [key, freeze(item)]))) as T; return value; };
const canonical = (value: unknown): string => { if (value === null || typeof value === "boolean" || typeof value === "string") return JSON.stringify(value); if (typeof value === "number") { if (!Number.isFinite(value)) throw new Error("Working Calibration identity requires finite numbers."); return JSON.stringify(Object.is(value, -0) ? 0 : value); } if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`; if (!value || typeof value !== "object") throw new Error("Working Calibration identity contains unsupported material."); const record = value as Record<string, unknown>; return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`).join(",")}}`; };
function hash(value: unknown): string { const bytes = new TextEncoder().encode(canonical(value)); let first = 0x811c9dc5, second = 0x9e3779b9; for (const character of bytes) { first = Math.imul(first ^ character, 0x01000193) >>> 0; second = Math.imul(second ^ character, 0x85ebca6b) >>> 0; } return first.toString(16).padStart(8, "0") + second.toString(16).padStart(8, "0"); }
const addressKey = (address: WorkingCellAddress) => `${address.definitionRevision}:${address.occurrence}:${address.index}`;
const severity = (values: readonly WorkingValidationState[]): WorkingValidationState => values.includes("BLOCKED") ? "BLOCKED" : values.includes("WARNING") ? "WARNING" : "VALID";

function identity(input: Pick<WorkingCalibration, "ownerScope" | "vehicleId" | "currentDatasetId" | "currentDatasetRevision" | "romLayoutId" | "relationshipRevision" | "definitionSetRevision">) {
  return { ownerScope: input.ownerScope, vehicleId: input.vehicleId, currentDatasetId: input.currentDatasetId, currentDatasetRevision: input.currentDatasetRevision, romLayoutId: input.romLayoutId, relationshipRevision: input.relationshipRevision, definitionSetRevision: input.definitionSetRevision };
}
function revise(calibration: Omit<WorkingCalibration, "workingCalibrationRevision" | "state" | "validation">): WorkingCalibration {
  const applied = calibration.mutations.slice(0, calibration.cursor), material = { identity: identity(calibration), mutations: applied.map(({ sequence, operation, operand, targets, before, after, validation, findings }) => ({ sequence, operation, operand, targets, before, after, validation, findings })), cursor: calibration.cursor };
  return freeze({ ...calibration, workingCalibrationRevision: `working-calibration-revision:${hash(material)}`, state: applied.length ? "dirty" : "unchanged", validation: severity(applied.map((item) => item.validation)) });
}

export function createWorkingCalibration(input: Readonly<Omit<WorkingCalibration, "contractVersion" | "workingCalibrationId" | "workingCalibrationRevision" | "mutations" | "cursor" | "state" | "validation" | "updatedAt">>): WorkingCalibration {
  if (![input.ownerScope, input.vehicleId, input.currentDatasetId, input.currentDatasetRevision, input.romLayoutId, input.relationshipRevision, input.definitionSetRevision].every((value) => value.trim())) throw new Error("Working Calibration requires exact owner, vehicle, Current Dataset, layout and Definition Set bindings.");
  if (!Number.isFinite(Date.parse(input.createdAt))) throw new Error("Working Calibration creation time is invalid.");
  const keys = input.definitions.flatMap((definition) => definition.cells.map(addressKey)); if (new Set(keys).size !== keys.length) throw new Error("Working Calibration cell addresses must be unique.");
  const base = { ...input, definitions: input.definitions, contractVersion: WORKING_CALIBRATION_CONTRACT, workingCalibrationId: `working-calibration:${hash(identity(input))}`, mutations: [] as readonly WorkingMutation[], cursor: 0, updatedAt: input.createdAt };
  return revise(base);
}

function valuesAt(calibration: WorkingCalibration, cursor = calibration.cursor): Map<string, number> {
  const values = new Map(calibration.definitions.flatMap((definition) => definition.cells.map((cell) => [addressKey(cell), cell.currentValue] as const)));
  for (const mutation of calibration.mutations.slice(0, cursor)) mutation.targets.forEach((target, index) => values.set(addressKey(target), mutation.after[index]!));
  return values;
}
export function workingCellValue(calibration: WorkingCalibration, address: WorkingCellAddress): number | null { return valuesAt(calibration).get(addressKey(address)) ?? null; }
export function workingCellDelta(calibration: WorkingCalibration, address: WorkingCellAddress) { const definition = calibration.definitions.find((item) => item.definitionRevision === address.definitionRevision && item.occurrence === address.occurrence), cell = definition?.cells.find((item) => item.index === address.index), working = workingCellValue(calibration, address); if (!cell || working === null) return null; return freeze({ current: cell.currentValue, working, delta: working - cell.currentValue, percentageDelta: cell.currentValue === 0 ? null : ((working - cell.currentValue) / cell.currentValue) * 100 }); }

function validate(definition: WorkingDefinitionSeed | undefined, value: number): Readonly<{ state: WorkingValidationState; findings: readonly string[] }> {
  const findings: string[] = [];
  if (!definition) findings.push("Cell is outside the bound Working Calibration.");
  else if (definition.availability !== "available") findings.push(definition.availability === "quarantined" ? "Table is quarantined and mutation-prohibited." : "Table is unavailable and mutation-prohibited.");
  else if (definition.capability.state !== "EDIT_QUALIFIED") findings.push(...(definition.capability.blockers.length ? definition.capability.blockers : ["VIEW qualification does not grant EDIT authority."]));
  else if (!definition.capability.inverse) findings.push("Engineering conversion is not reversibly qualified.");
  if (!Number.isFinite(value)) findings.push("Working value must be finite.");
  const engineeringMinimum = definition?.capability.engineeringMinimum, engineeringMaximum = definition?.capability.engineeringMaximum;
  if (engineeringMinimum !== null && engineeringMinimum !== undefined && value < engineeringMinimum) findings.push("Working value is below the qualified engineering minimum.");
  if (engineeringMaximum !== null && engineeringMaximum !== undefined && value > engineeringMaximum) findings.push("Working value is above the qualified engineering maximum.");
  const inverse = definition?.capability.inverse; if (inverse && Number.isFinite(value)) { const raw = (value - inverse.offset) / inverse.scale; if (!Number.isFinite(raw) || raw < inverse.rawMinimum || raw > inverse.rawMaximum || Math.abs(raw - Math.round(raw)) > 1e-7) findings.push("Working value is not representable by the qualified raw integer conversion."); }
  return freeze({ state: findings.length ? "BLOCKED" : definition?.capability.warnings.length ? "WARNING" : "VALID", findings: findings.length ? findings : [...(definition?.capability.warnings ?? [])] });
}

export function applyWorkingEdit(calibration: WorkingCalibration, input: Readonly<{ operation: WorkingEditOperation; operand: number; targets: readonly WorkingCellAddress[]; updatedAt: string }>): WorkingEditResult {
  if (!input.targets.length) return freeze({ status: "blocked", calibration, findings: ["At least one cell must be selected."] });
  if (!Number.isFinite(input.operand) || !Number.isFinite(Date.parse(input.updatedAt))) return freeze({ status: "blocked", calibration, findings: ["Edit operand and timestamp must be valid."] });
  const unique = [...new Map(input.targets.map((item) => [addressKey(item), item])).values()].sort((a, b) => addressKey(a).localeCompare(addressKey(b))), values = valuesAt(calibration), before: number[] = [], after: number[] = [], findings: string[] = [], states: WorkingValidationState[] = [];
  for (const target of unique) { const prior = values.get(addressKey(target)), definition = calibration.definitions.find((item) => item.definitionRevision === target.definitionRevision && item.occurrence === target.occurrence); if (prior === undefined || !definition || target.index < 0 || target.index >= definition.rows * definition.columns || target.row !== Math.floor(target.index / definition.columns) || target.column !== target.index % definition.columns) { findings.push("Cell coordinates are outside the bound Table dimensions."); continue; } const next = input.operation === "assign" ? input.operand : input.operation === "delta" ? prior + input.operand : prior * (1 + input.operand / 100); const result = validate(definition, next); before.push(prior); after.push(next); states.push(result.state); findings.push(...result.findings); }
  if (findings.length && (states.includes("BLOCKED") || before.length !== unique.length)) return freeze({ status: "blocked", calibration, findings: [...new Set(findings)] });
  const history = calibration.mutations.slice(0, calibration.cursor), mutation = freeze({ sequence: history.length + 1, operation: input.operation, operand: input.operand, targets: unique, before, after, validation: severity(states), findings: [...new Set(findings)] });
  return freeze({ status: "applied", calibration: revise({ ...calibration, mutations: [...history, mutation], cursor: history.length + 1, updatedAt: input.updatedAt }) });
}
export function previewWorkingEdit(calibration: WorkingCalibration, input: Readonly<{ operation: WorkingEditOperation; operand: number; targets: readonly WorkingCellAddress[] }>): WorkingEditPreview {
  const result = applyWorkingEdit(calibration, { ...input, updatedAt: calibration.updatedAt });
  if (result.status === "blocked") return freeze({ validation: "BLOCKED", findings: result.findings, before: [], after: [] });
  const mutation = result.calibration.mutations[result.calibration.cursor - 1]!;
  return freeze({ validation: mutation.validation, findings: mutation.findings, before: mutation.before, after: mutation.after });
}
export function undoWorkingEdit(calibration: WorkingCalibration, updatedAt: string): WorkingCalibration { return calibration.cursor === 0 ? calibration : revise({ ...calibration, cursor: calibration.cursor - 1, updatedAt }); }
export function redoWorkingEdit(calibration: WorkingCalibration, updatedAt: string): WorkingCalibration { return calibration.cursor >= calibration.mutations.length ? calibration : revise({ ...calibration, cursor: calibration.cursor + 1, updatedAt }); }
export function listWorkingChanges(calibration: WorkingCalibration) { const values = valuesAt(calibration); return freeze(calibration.definitions.flatMap((definition) => definition.cells.map((cell) => ({ ...workingCellDelta(calibration, cell), address: cell, working: values.get(addressKey(cell))! })).filter((item) => item.delta !== 0))); }
export function workingDefinitionHasChanges(calibration: WorkingCalibration, definitionRevision: string, occurrence: number): boolean { return listWorkingChanges(calibration).some((item) => item.address.definitionRevision === definitionRevision && item.address.occurrence === occurrence); }
export function workingChangedDefinitionKeys(calibration: WorkingCalibration): readonly string[] { return freeze([...new Set(listWorkingChanges(calibration).map((item) => `${item.address.definitionRevision}:${item.address.occurrence}`))].sort()); }

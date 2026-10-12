import { exactRawChange, exactWorkingValue, MAX_EDIT_CELLS, selectedRectangle, type ExactRawChange, type WorkingStorageLayout } from "./qualifiedEditing.ts";
export const WORKING_CALIBRATION_CONTRACT = "tunesight.working-calibration.v1" as const;

export type WorkingValidationState = "VALID" | "WARNING" | "BLOCKED";
export type WorkingEditOperation = "assign" | "raw" | "delta" | "percentage" | "multiply" | "matrix" | "revert" | "interpolate-horizontal" | "interpolate-vertical";
export type WorkingEditSource = "direct" | "toolbar";
export type WorkingCellAddress = Readonly<{ definitionRevision: string; occurrence: number; index: number; row: number; column: number }>;
export type WorkingCellSeed = WorkingCellAddress & Readonly<{ currentValue: number; units: string | null; currentRawValue?: number; currentRawOffset?: number }>;
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
  storage?: WorkingStorageLayout;
}>;
export type WorkingMutation = Readonly<{
  sequence: number;
  operation: WorkingEditOperation;
  source?: WorkingEditSource;
  operand: number;
  targets: readonly WorkingCellAddress[];
  before: readonly number[];
  after: readonly number[];
  validation: WorkingValidationState;
  findings: readonly string[];
  values?: readonly number[];
  exactRaw?: readonly ExactRawChange[];
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
  mutations: readonly WorkingMutation[];
  cursor: number;
  state: "unchanged" | "dirty";
  validation: WorkingValidationState;
}>;
export type WorkingEditResult = Readonly<{ status: "applied"; calibration: WorkingCalibration }> | Readonly<{ status: "blocked"; calibration: WorkingCalibration; findings: readonly string[] }>;
export type WorkingEditPreview = Readonly<{ validation: WorkingValidationState; findings: readonly string[]; before: readonly number[]; after: readonly number[] }>;

const freeze = <T>(value: T): T => { if (Array.isArray(value)) return Object.freeze(value.map(freeze)) as T; if (value && typeof value === "object") return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, item]) => [key, freeze(item)]))) as T; return value; };
const definitionSeeds = new WeakMap<object, readonly WorkingDefinitionSeed[]>();
const canonical = (value: unknown): string => { if (value === null || typeof value === "boolean" || typeof value === "string") return JSON.stringify(value); if (typeof value === "number") { if (!Number.isFinite(value)) throw new Error("Working Calibration identity requires finite numbers."); return JSON.stringify(Object.is(value, -0) ? 0 : value); } if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`; if (!value || typeof value !== "object") throw new Error("Working Calibration identity contains unsupported material."); const record = value as Record<string, unknown>; return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`).join(",")}}`; };
function hash(value: unknown): string { const bytes = new TextEncoder().encode(canonical(value)); let first = 0x811c9dc5, second = 0x9e3779b9; for (const character of bytes) { first = Math.imul(first ^ character, 0x01000193) >>> 0; second = Math.imul(second ^ character, 0x85ebca6b) >>> 0; } return first.toString(16).padStart(8, "0") + second.toString(16).padStart(8, "0"); }
const addressKey = (address: WorkingCellAddress) => `${address.definitionRevision}:${address.occurrence}:${address.index}`;
const severity = (values: readonly WorkingValidationState[]): WorkingValidationState => values.includes("BLOCKED") ? "BLOCKED" : values.includes("WARNING") ? "WARNING" : "VALID";

function identity(input: Pick<WorkingCalibration, "ownerScope" | "vehicleId" | "currentDatasetId" | "currentDatasetRevision" | "romLayoutId" | "relationshipRevision" | "definitionSetRevision">) {
  return { ownerScope: input.ownerScope, vehicleId: input.vehicleId, currentDatasetId: input.currentDatasetId, currentDatasetRevision: input.currentDatasetRevision, romLayoutId: input.romLayoutId, relationshipRevision: input.relationshipRevision, definitionSetRevision: input.definitionSetRevision };
}
function revise(calibration: Omit<WorkingCalibration, "workingCalibrationRevision" | "state" | "validation">, definitions = definitionSeeds.get(calibration as object)): WorkingCalibration {
  const applied = calibration.mutations.slice(0, calibration.cursor), material = { identity: identity(calibration), mutations: applied.map(({ sequence, operation, operand, targets, before, after, validation, findings, values, exactRaw }) => ({ sequence, operation, operand, targets, before, after, validation, findings, ...(values ? { values } : {}), ...(exactRaw ? { exactRaw } : {}) })), cursor: calibration.cursor };
  const revised: WorkingCalibration = freeze({ ...calibration, workingCalibrationRevision: `working-calibration-revision:${hash(material)}`, state: applied.length ? "dirty" as const : "unchanged" as const, validation: severity(applied.map((item) => item.validation)) });
  if (definitions) definitionSeeds.set(revised, definitions);
  return revised;
}

export function createWorkingCalibration(input: Readonly<Omit<WorkingCalibration, "contractVersion" | "workingCalibrationId" | "workingCalibrationRevision" | "mutations" | "cursor" | "state" | "validation" | "updatedAt"> & { definitions?: readonly WorkingDefinitionSeed[] }>): WorkingCalibration {
  if (![input.ownerScope, input.vehicleId, input.currentDatasetId, input.currentDatasetRevision, input.romLayoutId, input.relationshipRevision, input.definitionSetRevision].every((value) => value.trim())) throw new Error("Working Calibration requires exact owner, vehicle, Current Dataset, layout and Definition Set bindings.");
  if (!Number.isFinite(Date.parse(input.createdAt))) throw new Error("Working Calibration creation time is invalid.");
  const { definitions, ...bindings } = input;
  const base = { ...bindings, contractVersion: WORKING_CALIBRATION_CONTRACT, workingCalibrationId: `working-calibration:${hash(identity(bindings))}`, mutations: [] as readonly WorkingMutation[], cursor: 0, updatedAt: input.createdAt };
  return revise(base, definitions);
}
export function workingDefinitionSeed(calibration: WorkingCalibration, definitionRevision: string, occurrence: number): WorkingDefinitionSeed | undefined { return definitionSeeds.get(calibration)?.find((item) => item.definitionRevision === definitionRevision && item.occurrence === occurrence); }

function currentCell(definitions: readonly WorkingDefinitionSeed[], address: WorkingCellAddress): WorkingCellSeed | undefined {
  return definitions.find((item) => item.definitionRevision === address.definitionRevision && item.occurrence === address.occurrence)?.cells.find((item) => item.index === address.index);
}
export function workingCellValue(calibration: WorkingCalibration, address: WorkingCellAddress, currentValue?: number): number | null {
  const key = addressKey(address);
  for (let mutationIndex = calibration.cursor - 1; mutationIndex >= 0; mutationIndex--) { const mutation = calibration.mutations[mutationIndex]!; const targetIndex = mutation.targets.findIndex((target) => addressKey(target) === key); if (targetIndex >= 0) return mutation.after[targetIndex]!; }
  return currentValue ?? currentCell(definitionSeeds.get(calibration) ?? [], address)?.currentValue ?? null;
}
export function workingCellDelta(calibration: WorkingCalibration, address: WorkingCellAddress, currentValue?: number) { const key = addressKey(address), first = calibration.mutations.slice(0, calibration.cursor).find((mutation) => mutation.targets.some((target) => addressKey(target) === key)), firstIndex = first?.targets.findIndex((target) => addressKey(target) === key) ?? -1, baseline = currentValue ?? (first && firstIndex >= 0 ? first.before[firstIndex] : undefined); if (baseline === undefined) return null; const working = workingCellValue(calibration, address, baseline)!; return freeze({ current: baseline, working, delta: working - baseline, percentageDelta: baseline === 0 ? null : ((working - baseline) / baseline) * 100 }); }

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

export type WorkingEditInput = Readonly<{ operation: WorkingEditOperation; source?: WorkingEditSource; operand: number;
  targets: readonly WorkingCellAddress[]; definitions?: readonly WorkingDefinitionSeed[]; values?: readonly number[]; recordExactRaw?: boolean }>;
export function applyWorkingEdit(calibration: WorkingCalibration, input: WorkingEditInput & { updatedAt: string }): WorkingEditResult {
  const blocked = (finding: string): WorkingEditResult => Object.freeze({ status: "blocked", calibration, findings: [finding] });
  if (!["assign", "raw", "delta", "percentage", "multiply", "matrix", "revert", "interpolate-horizontal", "interpolate-vertical"].includes(input.operation)) return blocked("Unsupported edit operation.");
  if (!input.targets.length || input.targets.length > (input.recordExactRaw ? MAX_EDIT_CELLS : 16384)) return blocked("Select between 1 and 4096 cells for a new edit.");
  if (!Number.isFinite(input.operand) || !Number.isFinite(Date.parse(input.updatedAt))) return blocked("Edit operand and timestamp must be valid.");
  if (calibration.cursor >= 4096 || calibration.mutations.slice(0,calibration.cursor).reduce((n,m) => n+m.targets.length,0)+input.targets.length > 16384)
    return blocked("Working history reached its bounded mutation limit. Save or restore an earlier durable revision; history was preserved.");
  const definitions = input.definitions ?? definitionSeeds.get(calibration) ?? [];
  const unique = [...new Map(input.targets.map(item => [addressKey(item),item])).values()].sort((a,b) => addressKey(a).localeCompare(addressKey(b)));
  if (unique.length !== input.targets.length) return blocked("Repeated cell addresses are not permitted.");
  const requested = new Map(input.targets.map((t,i) => [addressKey(t),input.values?.[i]]));
  if (input.operation === "matrix" && (!input.values || input.values.length !== input.targets.length || input.values.some(v => !Number.isFinite(v)))) return blocked("Matrix values must exactly match the selected cells.");
  const before: number[] = [], after: number[] = [], raw: ExactRawChange[] = [], findings: string[] = [], states: WorkingValidationState[] = [];
  let rectangle: ReturnType<typeof selectedRectangle> | null = null;
  if (input.operation.startsWith("interpolate-")) {
    try { rectangle = selectedRectangle(input.targets); } catch (error) { return blocked((error as Error).message); }
    if (input.operation === "interpolate-horizontal" ? rectangle.columns < 2 : rectangle.rows < 2) return blocked("Interpolation needs two endpoints on the selected structural direction.");
  }
  for (const target of unique) {
    const definition = definitions.find(item => item.definitionRevision === target.definitionRevision && item.occurrence === target.occurrence), cell = currentCell(definitions,target);
    if (!cell || !definition || !Number.isSafeInteger(target.index) || target.index < 0 || target.index >= definition.rows*definition.columns ||
      target.row !== Math.floor(target.index/definition.columns) || target.column !== target.index%definition.columns) return blocked("Cell coordinates are outside the bound Table dimensions.");
    const prior = workingCellValue(calibration,target,cell.currentValue)!;
    let next: number;
    switch(input.operation) {
      case "assign": next=input.operand; break;
      case "raw": { const inverse=definition.capability.inverse; if(!inverse || !Number.isSafeInteger(input.operand)) return blocked("Raw entry requires an exact integer and qualified conversion."); next=input.operand*inverse.scale+inverse.offset; break; }
      case "delta": next=prior+input.operand; break;
      case "percentage": next=prior*(1+input.operand/100); break;
      case "multiply": next=prior*input.operand; break;
      case "matrix": next=requested.get(addressKey(target))!; break;
      case "revert": next=cell.currentValue; break;
      default: {
        const horizontal=input.operation === "interpolate-horizontal", r=rectangle!;
        const endpoints=[0,(horizontal ? r.columns : r.rows)-1].map(step => {
          const row=horizontal ? target.row : r.top+step, column=horizontal ? r.left+step : target.column;
          const address={...target,row,column,index:row*definition.columns+column}, current=currentCell(definitions,address);
          return current ? workingCellValue(calibration,address,current.currentValue) : null;
        });
        if (endpoints.some(v => v === null)) return blocked("Interpolation endpoints are unavailable.");
        const fraction=(horizontal ? target.column-r.left : target.row-r.top)/((horizontal ? r.columns : r.rows)-1);
        next=endpoints[0]!+(endpoints[1]!-endpoints[0]!)*fraction;
      }
    }
    const result=validate(definition,next);
    if(result.state === "BLOCKED") return blocked(result.findings.join(" "));
    if(input.recordExactRaw) {
      try { raw.push(exactRawChange(definition,target,prior,next)); next=exactWorkingValue(definition,next).engineering; }
      catch(error) { return blocked((error as Error).message); }
    }
    before.push(prior); after.push(next); states.push(result.state); findings.push(...result.findings);
  }
  // A sparse edit cannot write two incompatible representations of a shared byte.
  if (input.recordExactRaw) {
    const locations=new Set<number>();
    const previous=new Map<number,string>();
    for(const m of calibration.mutations.slice(0,calibration.cursor)) m.exactRaw?.forEach((change,i)=> {
      for(let b=0;b<change.afterBytes.length;b++) previous.set(change.offset+b,addressKey(m.targets[i]));
    });
    for(const [index,change] of raw.entries()) for(let i=0;i<change.afterBytes.length;i++) {
      if(previous.has(change.offset+i) && previous.get(change.offset+i)!==addressKey(unique[index])) return blocked("Raw bytes overlap another edited Definition occurrence; no alias merge is qualified.");
      if(locations.has(change.offset+i)) return blocked("Overlapping raw cells are mutation-prohibited."); locations.add(change.offset+i);
    }
  }
  const history=calibration.mutations.slice(0,calibration.cursor);
  const mutation=freeze({ sequence:history.length+1,operation:input.operation,source:input.source ?? "toolbar",operand:input.operand,
    targets:unique,before,after,validation:severity(states),findings:[...new Set(findings)],
    ...(input.operation === "matrix" ? {values:unique.map(t => requested.get(addressKey(t))!)} : {}), ...(input.recordExactRaw ? {exactRaw:raw} : {}) });
  const revised=revise({...calibration,mutations:[...history,mutation],cursor:history.length+1,updatedAt:input.updatedAt},definitions);
  if(input.recordExactRaw && new TextEncoder().encode(JSON.stringify(revised)).byteLength > 2*1024*1024)
    return blocked("Working revision exceeds 2 MiB. No cells changed; existing history is preserved.");
  return Object.freeze({status:"applied",calibration:revised});
}
export function previewWorkingEdit(calibration: WorkingCalibration, input: WorkingEditInput): WorkingEditPreview {
  const result = applyWorkingEdit(calibration, { ...input, updatedAt: calibration.updatedAt });
  if (result.status === "blocked") return freeze({ validation: "BLOCKED", findings: result.findings, before: [], after: [] });
  const mutation = result.calibration.mutations[result.calibration.cursor - 1]!;
  return freeze({ validation: mutation.validation, findings: mutation.findings, before: mutation.before, after: mutation.after });
}
export function undoWorkingEdit(calibration: WorkingCalibration, updatedAt: string): WorkingCalibration { return calibration.cursor === 0 ? calibration : revise({ ...calibration, cursor: calibration.cursor - 1, updatedAt }, definitionSeeds.get(calibration)); }
export function redoWorkingEdit(calibration: WorkingCalibration, updatedAt: string): WorkingCalibration { return calibration.cursor >= calibration.mutations.length ? calibration : revise({ ...calibration, cursor: calibration.cursor + 1, updatedAt }, definitionSeeds.get(calibration)); }
export function listWorkingChanges(calibration: WorkingCalibration, definitions: readonly WorkingDefinitionSeed[] = definitionSeeds.get(calibration) ?? []) { const addresses = [...new Map(calibration.mutations.slice(0, calibration.cursor).flatMap((mutation) => mutation.targets).map((address) => [addressKey(address), address])).values()]; return freeze(addresses.flatMap((address) => { const cell = currentCell(definitions, address); if (!cell) return []; const delta = workingCellDelta(calibration, address, cell.currentValue)!; return delta.delta === 0 ? [] : [{ ...delta, address }]; })); }
export function workingDefinitionHasChanges(calibration: WorkingCalibration, definitionRevision: string, occurrence: number): boolean {
  return workingChangedDefinitionKeys(calibration).includes(`${definitionRevision}:${occurrence}`);
}
export function workingChangedDefinitionKeys(calibration: WorkingCalibration): readonly string[] {
  const values=new Map<string,{definition:string;current:number;working:number}>();
  for(const mutation of calibration.mutations.slice(0,calibration.cursor)) mutation.targets.forEach((target,i)=> {
    const key=addressKey(target), prior=values.get(key);
    values.set(key,{definition: `${target.definitionRevision}:${target.occurrence}`,current:prior?.current ?? mutation.before[i],working:mutation.after[i]});
  });
  return freeze([...new Set([...values.values()].filter(v=>v.current!==v.working).map(v=>v.definition))].sort());
}

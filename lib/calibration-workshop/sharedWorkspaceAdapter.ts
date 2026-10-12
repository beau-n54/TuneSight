import type { SubscriberCalibrationResult } from "./subscriberCalibrationProvider.ts";
import { calibrationSourceIdentity } from "../identity/calibrationIdentity.ts";
import type { CalibrationSourceIdentity } from "../identity/identityOwners.ts";
import type { CurrentOnlyDefinition, CurrentOnlyWorkshopViewModel } from "./currentOnlyViewModel.ts";
import type { WorkshopViewModel } from "./viewModel.ts";
import { projectSharedTable, type ProjectionContext, type SharedTableProjection, type WorkingProjectionIdentity } from "./sharedTableProjection.ts";
import type { WorkingDefinitionSeed } from "./workingCalibration.ts";

type Ready = Extract<SubscriberCalibrationResult, { status: "workshop_ready" }>;
export type SharedWorkspaceWorkshop = WorkshopViewModel | CurrentOnlyWorkshopViewModel;
export type WorkspaceCatalogue = Readonly<{
  source: Pick<SharedWorkspaceWorkshop["source"], "currentDatasetId" | "currentDatasetRevision" | "romLayoutId" | "relationshipRevision" | "definitionSetRevision" | "referenceDatasetId" | "comparisonId">;
  selectedDefinitionKey: string;
  definitions: readonly (Pick<CurrentOnlyDefinition, "key" | "title" | "definitionRevision" | "occurrence" | "semantic" | "shape" | "units" | "editCapability" | "rows" | "columns"> & { readonly available: boolean; readonly changedCellCount: number })[];
  provenance: readonly string[]; limitations: readonly string[];
}>;
type WorkspaceSelectionSource = SharedWorkspaceWorkshop | WorkspaceCatalogue;
/** Metadata only. All numeric cell and axis evidence belongs to one selected projection. */
export function workspaceCatalogue(workshop: SharedWorkspaceWorkshop): WorkspaceCatalogue {
  const { currentDatasetId, currentDatasetRevision, romLayoutId, relationshipRevision, definitionSetRevision, referenceDatasetId, comparisonId } = workshop.source;
  const materials = new Map("tableMaterials" in workshop ? workshop.tableMaterials.map(item => [item.key, item]) : []);
  return { source: { currentDatasetId, currentDatasetRevision, romLayoutId, relationshipRevision, definitionSetRevision, referenceDatasetId, comparisonId },
    selectedDefinitionKey: "mode" in workshop ? workshop.selectedDefinition.key : workshop.selectedDefinition.summary.key,
    definitions: workshop.definitions.map(item => ({ key: item.key, title: item.title, definitionRevision: item.definitionRevision,
      occurrence: item.occurrence, semantic: item.semantic, shape: item.shape, units: item.units,
      editCapability: item.editCapability ?? { state: "VIEW_ONLY", revision: null, inverse: null, engineeringMinimum: null, engineeringMaximum: null, warnings: [], blockers: ["EDIT authority unavailable."] },
      rows: "rows" in item ? item.rows : materials.get(item.key)?.rows ?? 0, columns: "columns" in item ? item.columns : materials.get(item.key)?.columns ?? 0,
      available: "available" in item ? item.available : item.availability === "current_available", changedCellCount: "changedCellCount" in item ? item.changedCellCount : 0 })),
    provenance: workshop.provenance, limitations: workshop.limitations };
}
/** Only owner outputs cross this adapter; no source lease or source binary is copied. */
export type SharedWorkspaceEvidence = Pick<Ready, "material" | "quarantines" | "editCapabilities" | "identity" | "container" | "byteLength">;
type ProjectedLayer = Omit<SharedTableProjection["slots"]["current"], "rawEvidence" | "sourceAxes" | "axes" | "quarantine"> & {
  readonly rawRepresentation?: Pick<NonNullable<SharedTableProjection["slots"]["current"]["rawEvidence"]>, "datatype" | "widthBits" | "signed" | "endianness" | "evidenceId" | "evidenceRevision" | "inertEquationSources"> | null;
  readonly axes: readonly Omit<SharedTableProjection["slots"]["current"]["axes"][number], "evidence">[];
  readonly quarantine: (Pick<NonNullable<SharedTableProjection["slots"]["current"]["quarantine"]>, "quarantineId" | "quarantineRevision" | "failureClass" | "state"> & {
    readonly failureEvidence: { readonly finding: string };
  }) | null;
};
export type WorkspaceTableProjection = Omit<SharedTableProjection, "slots" | "comparison"> & {
  readonly slots: Omit<SharedTableProjection["slots"], "current" | "reference"> & { readonly current: ProjectedLayer; readonly reference: ProjectedLayer };
  readonly comparison: Omit<Extract<SharedTableProjection["comparison"], { state: "supplied" }>, "definition"> |
    Extract<SharedTableProjection["comparison"], { state: "unavailable" }>;
};
/** Preserve identity, semantic/capability state and visible provenance, without repeating raw owner arrays. */
export function compactWorkspaceProjection(projection: SharedTableProjection): WorkspaceTableProjection {
  const compact = ({ rawEvidence: _raw, sourceAxes: _source, axes, quarantine, ...layer }: SharedTableProjection["slots"]["current"]): ProjectedLayer => {
    void _raw; void _source;
    return { ...layer, rawRepresentation: _raw ? { datatype: _raw.datatype, widthBits: _raw.widthBits, signed: _raw.signed,
      endianness: _raw.endianness, evidenceId: _raw.evidenceId, evidenceRevision: _raw.evidenceRevision, inertEquationSources: _raw.inertEquationSources } : null,
      quarantine: quarantine ? { quarantineId: quarantine.quarantineId, quarantineRevision: quarantine.quarantineRevision,
      failureClass: quarantine.failureClass, state: quarantine.state, failureEvidence: { finding: quarantine.failureEvidence.finding } } : null,
      axes: axes.map(({ evidence: _evidence, ...axis }) => { void _evidence; return axis; }) };
  };
  const comparison = projection.comparison.state === "supplied"
    ? { state: "supplied" as const, comparisonId: projection.comparison.comparisonId, comparisonRevision: projection.comparison.comparisonRevision }
    : projection.comparison;
  return { ...projection, comparison: projection.slots.current.state === "available" && projection.slots.reference.state === "available"
    ? comparison : { state: "unavailable", findings: [...projection.slots.current.findings, ...projection.slots.reference.findings] },
    slots: { ...projection.slots, current: compact(projection.slots.current), reference: compact(projection.slots.reference) } };
}
export type SharedWorkspacePayload = Pick<Ready, "identity" | "container" | "byteLength"> & {
  readonly sourceIdentity?: CalibrationSourceIdentity;
  readonly referenceAvailable: boolean;
  readonly projection: WorkspaceTableProjection | null;
  readonly finding: string | null;
};
export function sharedWorkspaceEvidence(result: Ready): SharedWorkspaceEvidence {
  return { material: result.material, quarantines: result.quarantines, editCapabilities: result.editCapabilities,
    identity: result.identity, container: result.container, byteLength: result.byteLength };
}
/** Only the exact initially selected Table crosses the server boundary. No catalogue duplication. */
export function buildSharedWorkspacePayload(workshop: SharedWorkspaceWorkshop, result: Ready, context: ProjectionContext,
  requestedKey?: string): SharedWorkspacePayload {
  const selected = exactWorkspaceDefinition(workshop, requestedKey);
  return { identity: result.identity, container: result.container, byteLength: result.byteLength, sourceIdentity: calibrationSourceIdentity(result),
    referenceAvailable: result.material.reference !== null,
    projection: selected ? compactWorkspaceProjection(projectWorkspaceTable(workshop, sharedWorkspaceEvidence(result), context, selected.key)) : null,
    finding: selected ? null : "The exact requested Table is unresolved; no fallback was selected." };
}
export function isCurrentOnly(workshop: SharedWorkspaceWorkshop): workshop is CurrentOnlyWorkshopViewModel {
  return "mode" in workshop && workshop.mode === "current_only";
}
export function sharedWorkspaceContextKey(context: ProjectionContext, workshop: Pick<WorkspaceCatalogue, "source">): string {
  const source = workshop.source;
  return JSON.stringify([context.ownerId, context.vehicleId, context.sessionId, context.sourceMode,
    source.currentDatasetId, source.currentDatasetRevision, source.romLayoutId, source.relationshipRevision, source.definitionSetRevision, source.referenceDatasetId, source.comparisonId]);
}
export function exactWorkspaceDefinition(workshop: WorkspaceSelectionSource, requestedKey?: string) {
  const key = requestedKey === undefined
    ? "selectedDefinitionKey" in workshop ? workshop.selectedDefinitionKey : isCurrentOnly(workshop) ? workshop.selectedDefinition.key : workshop.selectedDefinition.summary.key
    : requestedKey;
  const matches = workshop.definitions.filter(item => item.key === key);
  return matches.length === 1 ? matches[0] : null;
}
export function projectWorkspaceTable(workshop: SharedWorkspaceWorkshop, evidence: SharedWorkspaceEvidence,
  context: ProjectionContext, key: string, working: WorkingProjectionIdentity | null = null): SharedTableProjection {
  const selected = exactWorkspaceDefinition(workshop, key);
  if (!selected) throw new Error("Exact native Table key is unresolved; no fallback is permitted.");
  const { definitionRevision, occurrence } = selected;
  const comparison = evidence.material.comparison;
  const definition = comparison?.definitions.filter(item => item.definitionRevisionId === definitionRevision)[occurrence];
  const referenceReason = workshop.states.find(item => item.id === "reference")?.message ?? "Reference evidence is unavailable.";
  return projectSharedTable({ context, selection: { key, definitionRevision, occurrence },
    current: { state: "available", dataset: evidence.material.current },
    reference: evidence.material.reference ? { state: "available", dataset: evidence.material.reference }
      : { state: "missing", findings: [referenceReason] },
    quarantines: evidence.quarantines, semantic: selected.semantic,
    edit: evidence.editCapabilities.find(item => item.definitionRevision === definitionRevision && item.occurrence === occurrence) ?? null,
    exportCapability: null, working,
    comparison: comparison && definition ? { state: "supplied", comparisonId: comparison.comparisonId,
      comparisonRevision: comparison.comparisonRevision, definition }
      : { state: "unavailable", findings: [referenceReason] },
  });
}

/** Adapts qualified Current projection cells to the existing Working engine seed shape. */
export function currentRendererDefinition(workshop: WorkspaceSelectionSource, projection: WorkspaceTableProjection): CurrentOnlyDefinition {
  const selected = exactWorkspaceDefinition(workshop, projection.selection.key);
  if (!selected) throw new Error("Renderer selection is unresolved.");
  const layer = projection.slots.current;
  const available = layer.state === "available";
  return { key: selected.key, title: selected.title, definitionRevision: selected.definitionRevision,
    occurrence: selected.occurrence, semantic: selected.semantic,
    shape: !layer.definition?.dimensions ? "unavailable" : layer.definition.dimensions.kind === "array_1d" ? "1D" : layer.definition.dimensions.kind === "table_2d" ? "2D" : "scalar",
    units: layer.definition?.displayUnits ?? selected.units,
    availability: layer.state === "quarantined" ? "unavailable_quarantined" : available ? "current_available" : "unavailable",
    editCapability: selected.editCapability ?? { state: "VIEW_ONLY", revision: null, inverse: null,
      engineeringMinimum: null, engineeringMaximum: null, warnings: [], blockers: ["EDIT authority is unavailable."] },
    rows: layer.definition?.dimensions?.rows ?? 0, columns: layer.definition?.dimensions?.columns ?? 0,
    axes: available ? layer.axes.map(axis => ({ id: axis.id, units: axis.units, values: axis.values })) : [],
    cells: available ? layer.cells.map(cell => ({ index: cell.index, row: cell.row, column: cell.column,
      currentValue: cell.value, currentRawValue: cell.rawValue, currentRawOffset: cell.rawOffset, units: cell.units })) : [],
    findings: [...layer.findings, ...(layer.quarantine ? [layer.quarantine.failureEvidence.finding] : [])],
    provenance: workshop.provenance, limitations: layer.limitations };
}

/** Reuse the existing owner seed shapes and mutation engine. Evidence gates also apply during restoration. */
export function resolveSharedWorkingDefinition(workshop: SharedWorkspaceWorkshop, evidence: SharedWorkspaceEvidence,
  context: ProjectionContext, definitionRevision: string, occurrence: number): WorkingDefinitionSeed | undefined {
  const selected = workshop.definitions.find(item => item.definitionRevision === definitionRevision && item.occurrence === occurrence);
  if (!selected) return undefined;
  const projection = projectWorkspaceTable(workshop, evidence, context, selected.key);
  return resolveProjectedWorkingDefinition(workshop, projection);
}
export function resolveProjectedWorkingDefinition(workshop: WorkspaceSelectionSource, projection: WorkspaceTableProjection): WorkingDefinitionSeed {
  const { definitionRevision, occurrence } = projection.selection;
  const detail = currentRendererDefinition(workshop, projection);
  const layer = projection.slots.current;
  const raw = layer.rawRepresentation ?? ("rawEvidence" in layer ? layer.rawEvidence as SharedTableProjection["slots"]["current"]["rawEvidence"] : null);
  const storage = raw?.datatype === "integer" && raw.widthBits && raw.signed !== null && raw.endianness
    ? { widthBits: raw.widthBits, signed: raw.signed, endianness: raw.endianness } : undefined;
  return { definitionRevision, occurrence, rows: detail.rows, columns: detail.columns,
    ...(storage ? { storage } : {}),
    availability: detail.availability === "current_available" ? "available" : detail.availability === "unavailable_quarantined" ? "quarantined" : "unavailable",
    capability: detail.editCapability, cells: detail.cells.map(cell => ({ ...cell, definitionRevision, occurrence })) };
}

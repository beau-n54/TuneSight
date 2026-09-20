import type { SubscriberCalibrationResult } from "./subscriberCalibrationProvider.ts";
import type { CurrentOnlyDefinition, CurrentOnlyWorkshopViewModel } from "./currentOnlyViewModel.ts";
import { materializeWorkshopDefinition, workingDefinitionFromWorkshop, type WorkshopViewModel } from "./viewModel.ts";
import { projectSharedTable, type ProjectionContext, type SharedTableProjection, type WorkingProjectionIdentity } from "./sharedTableProjection.ts";
import type { WorkingDefinitionSeed } from "./workingCalibration.ts";

type Ready = Extract<SubscriberCalibrationResult, { status: "workshop_ready" }>;
export type SharedWorkspaceWorkshop = WorkshopViewModel | CurrentOnlyWorkshopViewModel;
/** Only owner outputs cross this adapter; no source lease or source binary is copied. */
export type SharedWorkspaceEvidence = Pick<Ready, "material" | "quarantines" | "editCapabilities" | "identity" | "container" | "byteLength">;
type ProjectedLayer = Omit<SharedTableProjection["slots"]["current"], "rawEvidence" | "sourceAxes" | "axes" | "quarantine"> & {
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
    return { ...layer, quarantine: quarantine ? { quarantineId: quarantine.quarantineId, quarantineRevision: quarantine.quarantineRevision,
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
  return { identity: result.identity, container: result.container, byteLength: result.byteLength,
    referenceAvailable: result.material.reference !== null,
    projection: selected ? compactWorkspaceProjection(projectWorkspaceTable(workshop, sharedWorkspaceEvidence(result), context, selected.key)) : null,
    finding: selected ? null : "The exact requested Table is unresolved; no fallback was selected." };
}
export function isCurrentOnly(workshop: SharedWorkspaceWorkshop): workshop is CurrentOnlyWorkshopViewModel {
  return "mode" in workshop && workshop.mode === "current_only";
}
export function sharedWorkspaceContextKey(context: ProjectionContext, workshop: SharedWorkspaceWorkshop): string {
  const source = workshop.source;
  return JSON.stringify([context.ownerId, context.vehicleId, context.sessionId, context.sourceMode,
    source.currentDatasetId, source.currentDatasetRevision, source.romLayoutId, source.relationshipRevision, source.definitionSetRevision, source.referenceDatasetId, source.comparisonId]);
}
export function exactWorkspaceDefinition(workshop: SharedWorkspaceWorkshop, requestedKey?: string) {
  const key = requestedKey === undefined
    ? isCurrentOnly(workshop) ? workshop.selectedDefinition.key : workshop.selectedDefinition.summary.key
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

/** Adapts qualified Current cells to the accepted Current-only renderer, including optional Reference cases. */
export function currentRendererDefinition(workshop: SharedWorkspaceWorkshop, projection: WorkspaceTableProjection): CurrentOnlyDefinition {
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

export function comparisonRendererDefinition(workshop: SharedWorkspaceWorkshop, projection: WorkspaceTableProjection) {
  if (isCurrentOnly(workshop) || projection.slots.current.state !== "available" || projection.slots.reference.state !== "available") return null;
  const detail = materializeWorkshopDefinition(workshop, projection.selection.key);
  return detail.summary.available && detail.cells.length > 0 ? detail : null;
}

/** Reuse the existing owner seed shapes and mutation engine. Evidence gates also apply during restoration. */
export function resolveSharedWorkingDefinition(workshop: SharedWorkspaceWorkshop, evidence: SharedWorkspaceEvidence,
  context: ProjectionContext, definitionRevision: string, occurrence: number): WorkingDefinitionSeed | undefined {
  const selected = workshop.definitions.find(item => item.definitionRevision === definitionRevision && item.occurrence === occurrence);
  if (!selected) return undefined;
  const projection = projectWorkspaceTable(workshop, evidence, context, selected.key);
  return resolveProjectedWorkingDefinition(workshop, projection);
}
export function resolveProjectedWorkingDefinition(workshop: SharedWorkspaceWorkshop, projection: WorkspaceTableProjection): WorkingDefinitionSeed {
  const { definitionRevision, occurrence } = projection.selection;
  if (!isCurrentOnly(workshop) && comparisonRendererDefinition(workshop, projection)) return workingDefinitionFromWorkshop(workshop, definitionRevision, occurrence)!;
  const detail = currentRendererDefinition(workshop, projection);
  return { definitionRevision, occurrence, rows: detail.rows, columns: detail.columns,
    availability: detail.availability === "current_available" ? "available" : detail.availability === "unavailable_quarantined" ? "quarantined" : "unavailable",
    capability: detail.editCapability, cells: detail.cells.map(cell => ({ ...cell, definitionRevision, occurrence })) };
}

/** Restoration uses the already admitted, server-masked retained model; it never prefetches closed tables. */
export function resolveRetainedWorkingDefinition(workshop: SharedWorkspaceWorkshop, revision: string, occurrence: number): WorkingDefinitionSeed | undefined {
  if (!isCurrentOnly(workshop)) return workingDefinitionFromWorkshop(workshop, revision, occurrence);
  const detail = workshop.definitions.find(item => item.definitionRevision === revision && item.occurrence === occurrence);
  if (!detail) return undefined;
  return { definitionRevision: revision, occurrence, rows: detail.rows, columns: detail.columns,
    availability: detail.availability === "current_available" ? "available" : detail.availability === "unavailable_quarantined" ? "quarantined" : "unavailable",
    capability: detail.editCapability, cells: detail.cells.map(cell => ({ ...cell, definitionRevision: revision, occurrence })) };
}

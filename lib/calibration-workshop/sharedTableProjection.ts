import type { CalibrationDatasetDefinition, QualifiedCalibrationDataset } from "../xdf/qualifiedCalibrationDataset.ts";
import type { EngineeringAxisEvidence } from "../xdf/engineeringValueConversion.ts";
import type { DefinitionComparisonEvidence } from "../xdf/qualifiedCalibrationComparison.ts";
import type { TableQuarantineRecord } from "../xdf/tableQuarantine.ts";
import type { CalibrationEditCapability } from "./editAuthority.ts";
import type { ExportCapability } from "./calibrationReconstruction.ts";
import type { WorkshopSemanticBinding } from "./definitionKnowledgeBinding.ts";
import type { WorkingCalibration } from "./workingCalibration.ts";

/** U0 only: an unused, read-only consumer of already authorised owner outputs.
 * This module performs no qualification, conversion, mutation, loading or storage.
 * Geometry describes presentation support, never VIEW/EDIT/Export authority.
 */
export const SHARED_TABLE_PROJECTION_CONTRACT = "tunesight.shared-table-projection.v1" as const;
export type ProjectionContext = Readonly<{
  ownerId: string;
  vehicleId: string;
  sessionId: string | null;
  sourceMode: "subscriber" | "development_fixture";
}>;
export type ExactTableSelection = Readonly<{
  key: string;
  definitionRevision: string;
  occurrence: number;
}>;
export type DatasetSlot = Readonly<{ state: "available"; dataset: QualifiedCalibrationDataset }> |
  Readonly<{ state: "missing" | "unresolved" | "read_failure"; findings: readonly string[] }>;
export type WorkingProjectionIdentity = Pick<WorkingCalibration,
  "workingCalibrationId" | "workingCalibrationRevision" | "ownerScope" | "vehicleId" |
  "currentDatasetId" | "currentDatasetRevision" | "romLayoutId" | "relationshipRevision" |
  "definitionSetRevision" | "cursor" | "state" | "validation">;
export type SharedTableProjectionInput = Readonly<{
  context: ProjectionContext;
  selection: ExactTableSelection;
  current: DatasetSlot;
  reference: DatasetSlot;
  quarantines: readonly TableQuarantineRecord[];
  semantic: WorkshopSemanticBinding | null;
  edit: CalibrationEditCapability | null;
  exportCapability: ExportCapability | null;
  working: WorkingProjectionIdentity | null;
  comparison: Readonly<{
    state: "supplied";
    comparisonId: string;
    comparisonRevision: string;
    definition: DefinitionComparisonEvidence;
  }> | Readonly<{ state: "unavailable"; findings: readonly string[] }>;
}>;

// Tuple encoding is unambiguous even when owner identifiers contain separators.
const identity = (...parts: readonly unknown[]) => JSON.stringify(parts);
type ReadonlyProjection<T> = T extends object ? { readonly [Key in keyof T]: ReadonlyProjection<T[Key]> } : T;
function snapshot<T>(value: T): ReadonlyProjection<T> {
  if (Array.isArray(value)) return Object.freeze(value.map(snapshot)) as ReadonlyProjection<T>;
  if (value !== null && typeof value === "object") {
    return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, item]) => [key, snapshot(item)]))) as ReadonlyProjection<T>;
  }
  return value as ReadonlyProjection<T>;
}
function requireBinding(condition: boolean, finding: string): asserts condition {
  if (!condition) throw new Error(`Shared Table owner-contract disagreement: ${finding}`);
}
function datasetBinding(dataset: QualifiedCalibrationDataset) {
  return {
    datasetId: dataset.datasetId, datasetRevision: dataset.datasetRevision,
    exactBinaryIdentity: dataset.exactBinaryIdentity, romLayoutId: dataset.romLayoutId,
    relationshipId: dataset.relationshipId, relationshipRevision: dataset.relationshipRevision,
    definitionSetId: dataset.definitionSetId, definitionSetRevision: dataset.definitionSetRevisionId,
    sourceArtifactId: dataset.sourceArtifactId, sourceArtifactDigest: dataset.sourceArtifactDigest,
    sourceRole: dataset.sourceRole,
  };
}

function projectAxis(axis: EngineeringAxisEvidence) {
  // X/Y are explicit source-axis identifiers, not a length or title heuristic.
  const orientation = axis.axisId.toLowerCase() === "x" ? "X" as const :
    axis.axisId.toLowerCase() === "y" ? "Y" as const : null;
  const available = ["converted", "identity", "static_literal"].includes(axis.outcome);
  return {
    id: axis.axisId, orientation, outcome: axis.outcome, units: axis.units,
    values: available ? axis.outcome === "static_literal" ? axis.literalValues : axis.engineeringValues : [],
    available, evidence: axis,
  };
}
type ProjectedAxis = ReturnType<typeof projectAxis>;
type Cell = Readonly<{ identity: string; index: number; row: number; column: number;
  value: number; rawValue: number; rawOffset: number; units: string | null }>;
const unsupported = (reason: string) => ({ supported: false, reason });
const supported = () => ({ supported: true, reason: null });

function geometry(dimensions: CalibrationDatasetDefinition["dimensions"], axes: readonly ProjectedAxis[], cells: readonly Cell[]) {
  const grid = cells.length > 0;
  const unavailable = (reason: string) => ({ grid, line: unsupported(reason), surface: unsupported(reason) });
  if (!dimensions || !grid) return unavailable("Qualified cell evidence is unavailable.");
  if (dimensions.kind === "scalar") return unavailable("Scalar Tables have no line axis or surface topology.");
  const x = axes.filter(axis => axis.orientation === "X");
  const y = axes.filter(axis => axis.orientation === "Y");
  const validAxis = (candidates: readonly ProjectedAxis[], count: number) =>
    candidates.length === 1 && candidates[0].available && candidates[0].values.length === count;
  const bound = dimensions.kind === "array_1d"
    ? dimensions.rows === 1 && dimensions.columns > 1 ? validAxis(x, dimensions.columns)
      : dimensions.columns === 1 && dimensions.rows > 1 && validAxis(y, dimensions.rows)
    : validAxis(x, dimensions.columns) && validAxis(y, dimensions.rows);
  if (!bound) return unavailable("Genuine source X/Y orientation or coordinates are unavailable or ambiguous.");
  const complete = cells.length === dimensions.rows * dimensions.columns &&
    new Set(cells.map(cell => `${cell.row}:${cell.column}`)).size === cells.length;
  if (!complete) return unavailable("Incomplete qualified topology; no interpolation is permitted.");
  if (dimensions.kind === "array_1d") return { grid, line: supported(), surface: unsupported("A 1D Table has no second axis.") };
  const numericMonotonic = (axis: ProjectedAxis) => {
    const values = axis.values;
    if (values.length < 2 || !values.every(value => typeof value === "number" && Number.isFinite(value))) return false;
    return values.every((value, index) => index === 0 || value > values[index - 1]) ||
      values.every((value, index) => index === 0 || value < values[index - 1]);
  };
  return { grid, line: supported(), surface: numericMonotonic(x[0]) && numericMonotonic(y[0])
    ? supported() : unsupported("Numeric nondegenerate ordered coordinates are required; source order is retained.") };
}

function projectLayer(slot: DatasetSlot, selection: ExactTableSelection, context: ProjectionContext,
  quarantines: readonly TableQuarantineRecord[]) {
  if (slot.state !== "available") return {
    state: slot.state, dataset: null, definition: null, identity: null, quarantine: null,
    cells: [], axes: [], sourceAxes: [], rawEvidence: null,
    geometry: geometry(null, [], []), findings: slot.findings, provenance: [], limitations: [],
  };
  const dataset = slot.dataset;
  const definition = dataset.definitions.filter(item => item.definitionRevisionId === selection.definitionRevision)[selection.occurrence];
  const binding = datasetBinding(dataset);
  const layerIdentity = identity(SHARED_TABLE_PROJECTION_CONTRACT, context.ownerId, context.vehicleId,
    context.sessionId, context.sourceMode, dataset.datasetId, dataset.datasetRevision,
    dataset.exactBinaryIdentity.identityId, dataset.exactBinaryIdentity.digest, dataset.romLayoutId,
    dataset.relationshipRevision, dataset.definitionSetRevisionId, selection.definitionRevision, selection.occurrence);
  if (!definition) return {
    state: "unresolved" as const, dataset: binding, definition: null, identity: layerIdentity,
    quarantine: null, cells: [], axes: [], sourceAxes: [], rawEvidence: null,
    geometry: geometry(null, [], []), findings: ["Exact Definition revision/occurrence is absent from this Dataset."],
    provenance: dataset.provenance, limitations: dataset.limitations,
  };
  const matches = quarantines.filter(record => record.affectedBinary.digest === dataset.exactBinaryIdentity.digest &&
    record.relationship.definitionSetRevision === dataset.definitionSetRevisionId &&
    record.occurrence.definitionRevisionId === selection.definitionRevision && record.occurrence.occurrence === selection.occurrence);
  requireBinding(matches.length <= 1, "multiple quarantines for one exact occurrence");
  const quarantine = matches[0] ?? null;
  const evidence = quarantine ? null : definition.engineeringEvidence;
  if (evidence) {
    requireBinding(evidence.definitionRevisionId === selection.definitionRevision &&
      evidence.definitionSetRevisionId === dataset.definitionSetRevisionId &&
      evidence.exactBinaryDigest === dataset.exactBinaryIdentity.digest && evidence.romLayoutId === dataset.romLayoutId,
    "engineering evidence is not bound to the selected Dataset/Definition");
    requireBinding(evidence.dimensions.kind === definition.dimensions?.kind &&
      evidence.dimensions.rows === definition.dimensions.rows && evidence.dimensions.columns === definition.dimensions.columns &&
      evidence.units === definition.units, "Dataset and engineering representation differ");
    requireBinding(evidence.cellTrace.length === evidence.engineeringValues.length, "cell trace/value counts differ");
  }
  const cells: Cell[] = evidence ? evidence.cellTrace.map((trace, index) => {
    requireBinding(trace.index === index && Object.is(trace.engineeringValue, evidence.engineeringValues[index]) &&
      Number.isFinite(trace.engineeringValue) && Number.isSafeInteger(trace.row) && Number.isSafeInteger(trace.column) &&
      trace.row >= 0 && trace.row < evidence.dimensions.rows && trace.column >= 0 && trace.column < evidence.dimensions.columns,
    "cell coordinates or values disagree with engineering evidence");
    return { identity: identity(layerIdentity, trace.index, trace.row, trace.column), index: trace.index,
      row: trace.row, column: trace.column, value: trace.engineeringValue,
      rawValue: trace.rawValue, rawOffset: trace.rawOffset, units: evidence.units };
  }) : [];
  const sourceAxes = evidence?.axes ?? [];
  const axes = definition.dimensions?.kind === "scalar" ? [] : sourceAxes.map(projectAxis);
  return {
    state: quarantine ? "quarantined" as const : evidence ? "available" as const : "unavailable" as const,
    dataset: binding, identity: layerIdentity,
    definition: { identity: definition.definitionIdentity, revision: definition.definitionRevisionId,
      occurrence: selection.occurrence, title: definition.title, dimensions: definition.dimensions,
      state: definition.state, unavailableStage: definition.unavailableStage,
      sourceBindingDigest: definition.sourceBindingDigest, sourceArtifactDigest: definition.sourceArtifactDigest,
      sourceUnits: definition.units, displayUnits: evidence?.units ?? null },
    quarantine, cells, axes, sourceAxes, rawEvidence: definition.rawEvidence,
    geometry: geometry(definition.dimensions, axes, cells),
    findings: definition.findings, provenance: { dataset: dataset.provenance, definition: definition.provenance,
      engineering: evidence?.provenance ?? [] }, limitations: dataset.limitations,
  };
}

export function projectSharedTable(input: SharedTableProjectionInput) {
  requireBinding(Boolean(input.context.ownerId && input.context.vehicleId && input.selection.key &&
    input.selection.definitionRevision) && Number.isSafeInteger(input.selection.occurrence) && input.selection.occurrence >= 0,
  "exact authorised context and occurrence are required");
  // Selection identity survives changes or absence in every evidence slot.
  const tableIdentity = identity(SHARED_TABLE_PROJECTION_CONTRACT, "selected-table", input.context.ownerId,
    input.context.vehicleId, input.context.sessionId, input.context.sourceMode,
    input.selection.key, input.selection.definitionRevision, input.selection.occurrence);
  const current = projectLayer(input.current, input.selection, input.context, input.quarantines);
  const reference = projectLayer(input.reference, input.selection, input.context, input.quarantines);
  if (input.edit) requireBinding(current.dataset !== null &&
    input.edit.definitionRevision === input.selection.definitionRevision && input.edit.occurrence === input.selection.occurrence &&
    input.edit.relationshipRevision === current.dataset.relationshipRevision &&
    input.edit.definitionSetRevision === current.dataset.definitionSetRevision, "EDIT scope differs");
  if (input.working) {
    const working = input.working, dataset = current.dataset;
    requireBinding(dataset !== null && working.ownerScope === input.context.ownerId && working.vehicleId === input.context.vehicleId &&
      working.currentDatasetId === dataset.datasetId && working.currentDatasetRevision === dataset.datasetRevision &&
      working.romLayoutId === dataset.romLayoutId && working.relationshipRevision === dataset.relationshipRevision &&
      working.definitionSetRevision === dataset.definitionSetRevision, "Working identity differs");
  }
  if (input.comparison.state === "supplied") {
    requireBinding(input.comparison.definition.definitionRevisionId === input.selection.definitionRevision,
      "comparison Definition revision differs");
    for (const [evidence, layer] of [
      [input.comparison.definition.modifiedEngineeringEvidence, current],
      [input.comparison.definition.referenceEngineeringEvidence, reference],
    ] as const) {
      if (evidence) requireBinding(layer.dataset !== null &&
        evidence.exactBinaryDigest === layer.dataset.exactBinaryIdentity.digest &&
        evidence.definitionSetRevisionId === layer.dataset.definitionSetRevision &&
        evidence.romLayoutId === layer.dataset.romLayoutId, "comparison layer binding differs");
    }
  }
  const native = input.exportCapability;
  return snapshot({
    contractVersion: SHARED_TABLE_PROJECTION_CONTRACT,
    tableIdentity,
    identity: identity(SHARED_TABLE_PROJECTION_CONTRACT, input.context.ownerId, input.context.vehicleId,
      input.context.sessionId, input.context.sourceMode, input.selection.key, input.selection.definitionRevision,
      input.selection.occurrence, current.identity, reference.identity,
      input.working?.workingCalibrationId ?? null, input.working?.workingCalibrationRevision ?? null),
    context: input.context, selection: input.selection,
    slots: { current, reference, working: input.working,
      suggested: { state: "unavailable" as const, reason: "Suggested generation has no authority in U0." } },
    semantic: input.semantic, comparison: input.comparison,
    capabilities: {
      view: { current: current.state, reference: reference.state },
      edit: input.edit,
      reconstruct: native?.reconstruct ?? null, export: native?.export ?? null, flash: native?.flash ?? null,
      exportEvidence: native,
    },
  });
}
export type SharedTableProjection = ReturnType<typeof projectSharedTable>;

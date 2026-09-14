import type { QualifiedCalibrationDataset } from "../xdf/qualifiedCalibrationDataset.ts";
import type {
  DefinitionComparisonEvidence,
  QualifiedCalibrationComparisonEvidence,
} from "../xdf/qualifiedCalibrationComparison.ts";
import { bindDefinitionKnowledge, type WorkshopKnowledgeRecord, type WorkshopSemanticBinding } from "./definitionKnowledgeBinding.ts";
import type { CalibrationEditCapability } from "./editAuthority.ts";
import type { WorkingEditCapability } from "./workingCalibration.ts";
import type { WorkingDefinitionSeed } from "./workingCalibration.ts";

export type WorkshopFilter =
  | "all"
  | "changed"
  | "unchanged"
  | "unavailable"
  | "axis_changed"
  | "value_and_axis_changed"
  | "conflict";

export type WorkshopStateSlot = Readonly<{
  id: "reference" | "current" | "suggested" | "working";
  label: string;
  availability: "available" | "unavailable";
  sourceRole: string | null;
  datasetId: string | null;
  message: string;
}>;

export type WorkshopDefinitionSummary = Readonly<{
  key: string;
  occurrence: number;
  definitionIdentity: string | null;
  definitionRevision: string;
  title: string;
  description: string | null;
  shape: "scalar" | "1D" | "2D" | "unavailable";
  units: string | null;
  outcome: DefinitionComparisonEvidence["outcome"];
  changedCellCount: number;
  available: boolean;
  semantic: WorkshopSemanticBinding;
  editCapability?: WorkingEditCapability;
}>;

export type WorkshopAxis = Readonly<{
  id: string;
  units: string | null;
  values: readonly (number | string)[];
}>;

export type WorkshopCell = Readonly<{
  index: number;
  row: number;
  column: number;
  referenceValue: number;
  currentValue: number;
  changed: boolean;
  signedDelta: number;
  percentageDelta: number | null;
  percentageState: string;
  units: string | null;
  referenceRawValue: number;
  currentRawValue: number;
  referenceRawOffset: number;
  currentRawOffset: number;
  equationRevision: string;
}>;

export type WorkshopDefinitionDetail = Readonly<{
  summary: WorkshopDefinitionSummary;
  rows: number;
  columns: number;
  axes: readonly WorkshopAxis[];
  cells: readonly WorkshopCell[];
  unavailableStage: string | null;
  findings: readonly string[];
  equationRevision: string | null;
  sourceArtifactDigest: string;
  information: Readonly<{
    workshopInstanceIdentity: string;
    definitionIdentity: string | null;
    definitionRevision: string;
    definitionSetRevision: string;
    shape: WorkshopDefinitionSummary["shape"];
    dimensions: Readonly<{ rows: number; columns: number }>;
    units: string | null;
    axes: readonly WorkshopAxis[];
    sourceDescription: string | null;
    sourceCategory: string | null;
    availability: boolean;
    comparisonOutcome: DefinitionComparisonEvidence["outcome"];
    changedCellCount: number;
    axisChangeState: "unchanged" | "changed" | "unavailable";
    referenceRole: string;
    currentRole: string;
    romLayoutId: string;
    referenceDatasetId: string;
    currentDatasetId: string;
    datasetProvenance: readonly string[];
    sourceArtifactDigest: string;
    equationRevision: string | null;
    limitations: readonly string[];
  }>;
}>;

export type WorkshopViewModel = Readonly<{
  source: Readonly<{
    kind: "development_fixture" | "subscriber_upload";
    label: string;
    fixtureIdentity: string;
    romLayoutId: string;
    referenceDatasetId: string;
    currentDatasetId: string;
    currentDatasetRevision: string;
    relationshipRevision: string;
    definitionSetRevision: string;
    comparisonId: string;
  }>;
  states: readonly WorkshopStateSlot[];
  comparison: Readonly<{
    totalDefinitions: number;
    changed: number;
    unchanged: number;
    axisChanged: number;
    valueAndAxisChanged: number;
    unavailable: number;
    conflicts: number;
    changedCells: number;
  }>;
  definitions: readonly WorkshopDefinitionSummary[];
  selectedDefinition: WorkshopDefinitionDetail;
  workingDefinitions: readonly WorkingDefinitionSeed[];
  provenance: readonly string[];
  limitations: readonly string[];
  capabilities: Readonly<{
    readOnly: boolean;
    mutation: boolean;
    semanticKnowledge: boolean;
    suggestedCalibration: false;
    workingCalibration: boolean;
    workingCalibrationFoundation: true;
    editAuthority: boolean;
  }>;
}>;

function deepFreeze<T>(value: T): T {
  if (Array.isArray(value)) {
    value.forEach(deepFreeze);
  } else if (value && typeof value === "object") {
    Object.values(value as Record<string, unknown>).forEach(deepFreeze);
  }
  return Object.freeze(value);
}

function shapeOf(
  dimensions: DefinitionComparisonEvidence["dimensions"],
): WorkshopDefinitionSummary["shape"] {
  if (!dimensions) return "unavailable";
  if (dimensions.kind === "array_1d") return "1D";
  if (dimensions.kind === "table_2d") return "2D";
  return "scalar";
}

function sourceRoleLabel(role: QualifiedCalibrationDataset["sourceRole"]): string {
  if (role === "stock_candidate") return "Stock Candidate";
  if (role === "mapswitch") return "MapSwitch";
  return role;
}

export function buildWorkshopDefinitionSummaries(
  comparison: QualifiedCalibrationComparisonEvidence,
  identityContext: Readonly<{
    datasetRevision: string;
    definitionSetRevision: string;
  }>,
  knowledgeRecords: readonly WorkshopKnowledgeRecord[] = [],
  editCapabilities: readonly CalibrationEditCapability[] = [],
): readonly WorkshopDefinitionSummary[] {
  const occurrences = new Map<string, number>();
  return deepFreeze(
    comparison.definitions.map((definition) => {
      const occurrence = occurrences.get(definition.definitionRevisionId) ?? 0;
      occurrences.set(definition.definitionRevisionId, occurrence + 1);
      return summarizeDefinition(definition, identityContext, occurrence, knowledgeRecords, editCapabilities);
    }),
  );
}

function summarizeDefinition(
  definition: DefinitionComparisonEvidence,
  identityContext: Readonly<{
    datasetRevision: string;
    definitionSetRevision: string;
  }>,
  occurrence: number,
  knowledgeRecords: readonly WorkshopKnowledgeRecord[] = [],
  editCapabilities: readonly CalibrationEditCapability[] = [],
): WorkshopDefinitionSummary {
  const identity = {
    key: [
      "workshop-definition-instance",
      identityContext.datasetRevision,
      identityContext.definitionSetRevision,
      definition.definitionRevisionId,
      `occurrence-${occurrence}`,
    ].join(":"),
    occurrence,
    definitionIdentity: definition.definitionIdentity,
    definitionRevision: definition.definitionRevisionId,
    title: definition.title?.trim() || "Untitled Definition",
    description: definition.description?.trim() || null,
    shape: shapeOf(definition.dimensions),
    units: definition.units,
    outcome: definition.outcome,
    changedCellCount: definition.changedCellCount,
    available:
      definition.referenceEngineeringEvidence !== null &&
      definition.modifiedEngineeringEvidence !== null,
  };
  const authority = editCapabilities.find((item) => item.definitionRevision === definition.definitionRevisionId && item.occurrence === occurrence), editCapability: WorkingEditCapability = authority ? { state: authority.state === "EDIT_QUALIFIED" ? "EDIT_QUALIFIED" : "VIEW_ONLY", revision: authority.state === "EDIT_QUALIFIED" ? authority.capabilityRevision : null, inverse: authority.inverse, engineeringMinimum: authority.engineeringMinimum, engineeringMaximum: authority.engineeringMaximum, warnings: authority.validation === "WARNING" ? authority.findings : [], blockers: authority.validation === "BLOCKED" ? authority.findings : [] } : { state: "VIEW_ONLY", revision: null, inverse: null, engineeringMinimum: null, engineeringMaximum: null, warnings: [], blockers: ["EDIT authority is unavailable."] };
  return { ...identity, semantic: bindDefinitionKnowledge(identity, knowledgeRecords), editCapability };
}

export function filterWorkshopDefinitions(
  definitions: readonly WorkshopDefinitionSummary[],
  search: string,
  filter: WorkshopFilter,
): readonly WorkshopDefinitionSummary[] {
  const query = search.trim().toLocaleLowerCase();
  return definitions.filter((definition) => {
    const literalMatch =
      !query ||
      [
        definition.title,
        definition.description,
        definition.definitionIdentity,
        definition.definitionRevision,
        definition.units,
      ].some((value) => value?.toLocaleLowerCase().includes(query));
    if (!literalMatch) return false;
    if (filter === "all") return true;
    if (filter === "unavailable") return !definition.available;
    if (filter === "conflict") return definition.outcome === "representation_conflict";
    return definition.outcome === filter;
  });
}

export function selectWorkshopDefinitionKey(
  definitions: readonly WorkshopDefinitionSummary[],
  requestedKey?: string | null,
): string {
  if (requestedKey && definitions.some((item) => item.key === requestedKey)) {
    return requestedKey;
  }
  return (
    definitions.find((item) => item.available && item.changedCellCount > 0) ??
    definitions.find((item) => item.available) ??
    definitions[0]
  )?.key ?? "";
}

function axisValues(
  definition: DefinitionComparisonEvidence,
): readonly WorkshopAxis[] {
  const axes = definition.referenceEngineeringEvidence?.axes ?? [];
  return axes.map((axis) => ({
    id: axis.axisId,
    units: axis.units,
    values:
      axis.outcome === "static_literal"
        ? axis.literalValues
        : axis.engineeringValues,
  }));
}

export function buildWorkshopDefinitionDetail(
  definition: DefinitionComparisonEvidence,
  reference: QualifiedCalibrationDataset,
  summary: WorkshopDefinitionSummary,
  context?: Readonly<{
    definitionSetRevision: string;
    romLayoutId: string;
    referenceDatasetId: string;
    currentDatasetId: string;
    referenceRole: string;
    currentRole: string;
    datasetProvenance: readonly string[];
    limitations: readonly string[];
  }>,
): WorkshopDefinitionDetail {
  const referenceEvidence = definition.referenceEngineeringEvidence;
  const currentEvidence = definition.modifiedEngineeringEvidence;
  const changes = new Map(definition.changedCells.map((cell) => [cell.index, cell]));
  const datasetRecord = reference.definitions.filter(
    (item) => item.definitionRevisionId === definition.definitionRevisionId,
  )[summary.occurrence];
  const cells = referenceEvidence && currentEvidence
    ? referenceEvidence.engineeringValues.map((referenceValue, index) => {
        const currentValue = currentEvidence.engineeringValues[index]!;
        const change = changes.get(index);
        const traceA = referenceEvidence.cellTrace[index]!;
        const traceB = currentEvidence.cellTrace[index]!;
        return {
          index,
          row: traceA.row,
          column: traceA.column,
          referenceValue,
          currentValue,
          changed: Boolean(change),
          signedDelta: change?.signedDelta ?? 0,
          percentageDelta:
            change?.percentageDelta.outcome === "available"
              ? change.percentageDelta.value
              : change
                ? null
                : 0,
          percentageState: change?.percentageDelta.outcome ?? "available",
          units: definition.units,
          referenceRawValue: traceA.rawValue,
          currentRawValue: traceB.rawValue,
          referenceRawOffset: traceA.rawOffset,
          currentRawOffset: traceB.rawOffset,
          equationRevision: referenceEvidence.valueEquation.equationRevision,
        };
      })
    : [];
  return deepFreeze({
    summary,
    rows: definition.dimensions?.rows ?? 0,
    columns: definition.dimensions?.columns ?? 0,
    axes: axisValues(definition),
    cells,
    unavailableStage: datasetRecord?.unavailableStage ?? null,
    findings: [...new Set([...(datasetRecord?.findings ?? []), ...definition.findings])],
    equationRevision: definition.equationRevision,
    sourceArtifactDigest: definition.sourceArtifactDigest,
    information: {
      workshopInstanceIdentity: summary.key,
      definitionIdentity: summary.definitionIdentity,
      definitionRevision: summary.definitionRevision,
      definitionSetRevision: context?.definitionSetRevision ?? reference.definitionSetRevisionId,
      shape: summary.shape,
      dimensions: { rows: definition.dimensions?.rows ?? 0, columns: definition.dimensions?.columns ?? 0 },
      units: summary.units,
      axes: axisValues(definition),
      sourceDescription: summary.description,
      sourceCategory: null,
      availability: summary.available,
      comparisonOutcome: summary.outcome,
      changedCellCount: summary.changedCellCount,
      axisChangeState: definition.axisComparisons.some((axis) => axis.outcome === "changed") ? "changed" : definition.axisComparisons.some((axis) => axis.outcome === "comparison_unavailable") ? "unavailable" : "unchanged",
      referenceRole: context?.referenceRole ?? "Reference",
      currentRole: context?.currentRole ?? "Current",
      romLayoutId: context?.romLayoutId ?? reference.romLayoutId,
      referenceDatasetId: context?.referenceDatasetId ?? reference.datasetId,
      currentDatasetId: context?.currentDatasetId ?? "Unavailable",
      datasetProvenance: context?.datasetProvenance ?? reference.provenance,
      sourceArtifactDigest: definition.sourceArtifactDigest,
      equationRevision: definition.equationRevision,
      limitations: context?.limitations ?? [],
    },
  });
}

export function buildWorkshopViewModel(input: {
  reference: QualifiedCalibrationDataset;
  current: QualifiedCalibrationDataset;
  comparison: QualifiedCalibrationComparisonEvidence;
  source: Readonly<{
    label: string;
    fixtureIdentity: string;
    kind?: "development_fixture" | "subscriber_upload";
  }>;
  selectedKey?: string | null;
  knowledgeRecords?: readonly WorkshopKnowledgeRecord[];
  editCapabilities?: readonly CalibrationEditCapability[];
}): WorkshopViewModel {
  const { reference, current, comparison } = input;
  const identityContext = {
    datasetRevision: reference.datasetRevision,
    definitionSetRevision: reference.definitionSetRevisionId,
  };
  const definitions = buildWorkshopDefinitionSummaries(comparison, identityContext, input.knowledgeRecords ?? [], input.editCapabilities ?? []);
  const editAuthority = definitions.some((item) => item.editCapability?.state === "EDIT_QUALIFIED");
  const selectedKey = selectWorkshopDefinitionKey(definitions, input.selectedKey);
  const selectedIndex = definitions.findIndex((definition) => definition.key === selectedKey);
  const selected = comparison.definitions[selectedIndex];
  const selectedSummary = definitions[selectedIndex];
  if (!selected || !selectedSummary) throw new Error("Qualified comparison contains no selectable Definition.");
  const occurrences = new Map<string, number>(), workingDefinitions = current.definitions.map((definition): WorkingDefinitionSeed => { const occurrence = occurrences.get(definition.definitionRevisionId) ?? 0; occurrences.set(definition.definitionRevisionId, occurrence + 1); const editCapability = definitions.find((item) => item.definitionRevision === definition.definitionRevisionId && item.occurrence === occurrence)?.editCapability ?? { state: "VIEW_ONLY" as const, revision: null, inverse: null, engineeringMinimum: null, engineeringMaximum: null, warnings: [], blockers: ["EDIT authority is unavailable."] }; return deepFreeze({ definitionRevision: definition.definitionRevisionId, occurrence, rows: definition.dimensions?.rows ?? 0, columns: definition.dimensions?.columns ?? 0, availability: definition.engineeringEvidence ? "available" as const : "unavailable" as const, capability: editCapability, cells: definition.engineeringEvidence ? definition.engineeringEvidence.engineeringValues.map((currentValue, index) => { const trace = definition.engineeringEvidence!.cellTrace[index]!; return { definitionRevision: definition.definitionRevisionId, occurrence, index, row: trace.row, column: trace.column, currentValue, units: definition.units }; }) : [] }); });

  return deepFreeze({
    source: {
      kind: input.source.kind ?? "development_fixture",
      label: input.source.label,
      fixtureIdentity: input.source.fixtureIdentity,
      romLayoutId: reference.romLayoutId,
      referenceDatasetId: reference.datasetId,
      currentDatasetId: current.datasetId,
      currentDatasetRevision: current.datasetRevision,
      relationshipRevision: current.relationshipRevision,
      definitionSetRevision: current.definitionSetRevisionId,
      comparisonId: comparison.comparisonId,
    },
    states: [
      { id: "reference", label: "Reference", availability: "available", sourceRole: sourceRoleLabel(reference.sourceRole), datasetId: reference.datasetId, message: "Qualified reference Dataset" },
      { id: "current", label: "Current Calibration", availability: "available", sourceRole: sourceRoleLabel(current.sourceRole), datasetId: current.datasetId, message: input.source.kind === "subscriber_upload" ? "Qualified subscriber-supplied Current Dataset" : "Qualified current Dataset" },
      { id: "suggested", label: "TuneSight Suggested", availability: "unavailable", sourceRole: null, datasetId: null, message: "Not available in this Workshop stage" },
      { id: "working", label: "Working Calibration", availability: editAuthority ? "available" : "unavailable", sourceRole: null, datasetId: null, message: editAuthority ? "Governed Working Calibration is available for EDIT-qualified Tables" : "Exact EDIT authority is unavailable" },
    ],
    comparison: {
      totalDefinitions: comparison.totalDefinitionsConsidered,
      changed: comparison.changedDefinitions,
      unchanged: comparison.unchangedDefinitions,
      axisChanged: comparison.axisChangedDefinitions,
      valueAndAxisChanged: comparison.valueAndAxisChangedDefinitions,
      unavailable: comparison.unavailableDefinitions,
      conflicts: comparison.conflictedDefinitions,
      changedCells: comparison.totalChangedCells,
    },
    definitions,
    selectedDefinition: buildWorkshopDefinitionDetail(selected, reference, selectedSummary, {
      definitionSetRevision: reference.definitionSetRevisionId,
      romLayoutId: reference.romLayoutId,
      referenceDatasetId: reference.datasetId,
      currentDatasetId: current.datasetId,
      referenceRole: comparison.reference.role,
      currentRole: comparison.modified.role,
      datasetProvenance: [...new Set([...reference.provenance, ...current.provenance])],
      limitations: [...new Set([...reference.limitations, ...current.limitations])],
    }),
    workingDefinitions,
    provenance: [...new Set([...reference.provenance, ...current.provenance])],
    limitations: [...new Set([...reference.limitations, ...current.limitations, ...(input.source.kind === "subscriber_upload" ? ["Uploaded bytes are session-scoped and were not persisted."] : ["This controlled fixture is not derived from the selected vehicle."]), "Engineering semantic interpretation is not yet bound."])],
    capabilities: {
      readOnly: !editAuthority,
      mutation: editAuthority,
      semanticKnowledge: definitions.some((definition) => definition.semantic.outcome === "exact" || definition.semantic.outcome === "partial"),
      suggestedCalibration: false,
      workingCalibration: editAuthority,
      workingCalibrationFoundation: true,
      editAuthority,
    },
  });
}

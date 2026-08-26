import type { QualifiedCalibrationDataset } from "../xdf/qualifiedCalibrationDataset.ts";
import type {
  DefinitionComparisonEvidence,
  QualifiedCalibrationComparisonEvidence,
} from "../xdf/qualifiedCalibrationComparison.ts";

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
  definitionIdentity: string | null;
  definitionRevision: string;
  title: string;
  description: string | null;
  shape: "scalar" | "1D" | "2D" | "unavailable";
  units: string | null;
  outcome: DefinitionComparisonEvidence["outcome"];
  changedCellCount: number;
  available: boolean;
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
}>;

export type WorkshopViewModel = Readonly<{
  source: Readonly<{
    kind: "development_fixture";
    label: string;
    fixtureIdentity: string;
    romLayoutId: string;
    referenceDatasetId: string;
    currentDatasetId: string;
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
  provenance: readonly string[];
  limitations: readonly string[];
  capabilities: Readonly<{
    readOnly: true;
    mutation: false;
    semanticKnowledge: false;
    suggestedCalibration: false;
    workingCalibration: false;
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

export function buildWorkshopDefinitionSummaries(
  comparison: QualifiedCalibrationComparisonEvidence,
): readonly WorkshopDefinitionSummary[] {
  return deepFreeze(
    comparison.definitions.map(summarizeDefinition),
  );
}

function summarizeDefinition(
  definition: DefinitionComparisonEvidence,
): WorkshopDefinitionSummary {
  return {
    key: definition.definitionRevisionId,
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
): WorkshopDefinitionDetail {
  const summary = summarizeDefinition(definition);
  const referenceEvidence = definition.referenceEngineeringEvidence;
  const currentEvidence = definition.modifiedEngineeringEvidence;
  const changes = new Map(definition.changedCells.map((cell) => [cell.index, cell]));
  const datasetRecord = reference.definitions.find(
    (item) => item.definitionRevisionId === definition.definitionRevisionId,
  );
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
  });
}

export function buildWorkshopViewModel(input: {
  reference: QualifiedCalibrationDataset;
  current: QualifiedCalibrationDataset;
  comparison: QualifiedCalibrationComparisonEvidence;
  selectedKey?: string | null;
}): WorkshopViewModel {
  const { reference, current, comparison } = input;
  const definitions = buildWorkshopDefinitionSummaries(comparison);
  const selectedKey = selectWorkshopDefinitionKey(definitions, input.selectedKey);
  const selected = comparison.definitions.find(
    (definition) => definition.definitionRevisionId === selectedKey,
  );
  if (!selected) throw new Error("Qualified comparison contains no selectable Definition.");

  return deepFreeze({
    source: {
      kind: "development_fixture",
      label: "IJE0S Original → IJE0S MapSwitch",
      fixtureIdentity: "n54-ije0s-original-mapswitch-v1",
      romLayoutId: reference.romLayoutId,
      referenceDatasetId: reference.datasetId,
      currentDatasetId: current.datasetId,
      comparisonId: comparison.comparisonId,
    },
    states: [
      { id: "reference", label: "Reference", availability: "available", sourceRole: "Stock Candidate", datasetId: reference.datasetId, message: "Qualified reference Dataset" },
      { id: "current", label: "Current Modified", availability: "available", sourceRole: "MapSwitch", datasetId: current.datasetId, message: "Qualified current Dataset" },
      { id: "suggested", label: "TuneSight Suggested", availability: "unavailable", sourceRole: null, datasetId: null, message: "Not available in this Workshop stage" },
      { id: "working", label: "Working Calibration", availability: "unavailable", sourceRole: null, datasetId: null, message: "Not available in this Workshop stage" },
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
    selectedDefinition: buildWorkshopDefinitionDetail(selected, reference),
    provenance: [...new Set([...reference.provenance, ...current.provenance])],
    limitations: [...new Set([...reference.limitations, ...current.limitations, "This controlled fixture is not derived from the selected vehicle.", "Engineering semantic interpretation is not yet bound."])],
    capabilities: {
      readOnly: true,
      mutation: false,
      semanticKnowledge: false,
      suggestedCalibration: false,
      workingCalibration: false,
    },
  });
}

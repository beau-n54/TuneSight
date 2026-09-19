/** Test-only fixtures. Synthetic labels/revisions prove contract invariance, not
 * real vehicle, ROM, Definition, engineering or production qualification. */
import { createHash } from "node:crypto";
import type { AvailableCalibrationDatasetDefinition, QualifiedCalibrationDataset } from "../xdf/qualifiedCalibrationDataset.ts";
import type { EngineeringAxisEvidence } from "../xdf/engineeringValueConversion.ts";
import type { SubscriberCalibrationSuccess } from "./subscriberCalibrationProvider.ts";
import type { ExactTableSelection, SharedTableProjectionInput } from "./sharedTableProjection.ts";

export const U0_FIXTURE_REVISION = "u0-synthetic-owner-output:2026-09-20:v1";
export const U0_FIXTURE_LIMITATION = "Synthetic owner-output fixture: no genuine vehicle, ROM or Definition qualification is asserted.";

export function subscriberProjectionInput(result: SubscriberCalibrationSuccess, selection: ExactTableSelection): SharedTableProjectionInput {
  const native = result.workshop.definitions.find(item => item.key === selection.key);
  if (!native) throw new Error("Anchor must use an existing exact Workshop key.");
  if (native.definitionRevision !== selection.definitionRevision || native.occurrence !== selection.occurrence) {
    throw new Error("Anchor native Workshop key does not match the selected Definition revision and occurrence.");
  }
  const comparison = result.material.comparison;
  const detail = comparison?.definitions.filter(item => item.definitionRevisionId === selection.definitionRevision)[selection.occurrence];
  return {
    context: { ownerId: "u0-controlled-owner", vehicleId: `u0-anchor:${result.identity}`, sessionId: `u0-session:${result.digest}`, sourceMode: "subscriber" },
    selection, current: { state: "available", dataset: result.material.current },
    reference: result.material.reference ? { state: "available", dataset: result.material.reference }
      : { state: "missing", findings: ["Authoritative Reference is not established; comparison is unavailable."] },
    quarantines: result.quarantines, semantic: native.semantic,
    edit: result.editCapabilities.find(item => item.definitionRevision === selection.definitionRevision && item.occurrence === selection.occurrence) ?? null,
    exportCapability: null, working: null,
    comparison: comparison && detail ? { state: "supplied", comparisonId: comparison.comparisonId,
      comparisonRevision: comparison.comparisonRevision, definition: detail }
      : { state: "unavailable", findings: ["Reference comparison is unavailable."] },
  };
}

export function fixtureAxis(id: string, values: readonly (number | string)[], units: string | null = null): EngineeringAxisEvidence {
  const numeric = values.every(value => typeof value === "number");
  return { axisId: id, outcome: numeric ? "identity" : "static_literal", equation: null, equationSource: null,
    units, rawValues: [], engineeringValues: numeric ? values as readonly number[] : [],
    literalValues: numeric ? [] : values as readonly string[], offsets: [], finding: null };
}

/** Reuse the complete type shape of an owner output; replace identity, values and
 * disclosures with explicitly synthetic data. Never publish this to a registry. */
export function controlledProjectionFixture(template: QualifiedCalibrationDataset, input: Readonly<{
  shape: "scalar" | "array_1d" | "table_2d";
  rows: number; columns: number; axes?: readonly EngineeringAxisEvidence[];
  units?: string | null; platform?: string; title?: string;
  container?: "bin" | "dtf"; dme?: string;
}>): SharedTableProjectionInput {
  const original = template.definitions.find((item): item is AvailableCalibrationDatasetDefinition => item.engineeringEvidence !== null);
  if (!original) throw new Error("Fixture template requires complete owner output.");
  const rev = U0_FIXTURE_REVISION, platform = input.platform ?? "unqualified-future-platform";
  const dimensions = { kind: input.shape, rows: input.rows, columns: input.columns };
  const units = input.units === undefined ? "synthetic source unit" : input.units;
  const values = Array.from({ length: input.rows * input.columns }, (_, index) => index === 0 ? -0 : index * 0.125);
  const fixtureDigest = createHash("sha256").update(JSON.stringify([rev, platform, input.dme ?? null, input.container ?? "bin",
    dimensions, input.axes ?? [], units, input.title ?? null])).digest("hex");
  const exact = `${rev}:${fixtureDigest}`;
  const digest = `${exact}:synthetic-binary`;
  const definitionRevision = `${exact}:definition`;
  const authorityChain = { ...original.engineeringEvidence.authorityChain,
    registrySnapshotId: `${exact}:registry`, relationshipId: `${exact}:relationship`, relationshipRevision: `${exact}:relationship:v1`,
    romLayoutId: `${exact}:layout`, definitionSetId: `${exact}:set`, definitionSetRevisionId: `${exact}:set:v1`,
    sourceArtifactId: `${exact}:source`, sourceArtifactDigest: `${exact}:source-digest`,
    decisionId: `${exact}:decision`, decisionRevision: `${exact}:decision:v1`, instructionId: `${exact}:instruction`, instructionRevision: `${exact}:instruction:v1`,
    authorityProvenance: [U0_FIXTURE_LIMITATION], sourceProvenanceDisclosure: [U0_FIXTURE_LIMITATION], provenanceLimitations: [U0_FIXTURE_LIMITATION] };
  const engineering = { ...original.engineeringEvidence, evidenceId: `${exact}:engineering`, evidenceRevision: `${exact}:engineering:v1`,
    sourceRawEvidenceId: `${exact}:raw`, sourceRawEvidenceRevision: `${exact}:raw:v1`,
    exactBinaryDigest: digest, romLayoutId: authorityChain.romLayoutId, definitionSetRevisionId: authorityChain.definitionSetRevisionId,
    definitionRevisionId: definitionRevision, definitionIdentity: `${rev}:definition-id`, dimensions, units,
    authorityChain, engineeringValues: values, rawValues: values.map((_, index) => index),
    cellTrace: values.map((value, index) => ({ index, row: Math.floor(index / input.columns), column: index % input.columns,
      rawValue: index, rawOffset: index * 2, engineeringValue: value })),
    axes: input.axes ?? [], conversionFindings: [U0_FIXTURE_LIMITATION], provenance: [U0_FIXTURE_LIMITATION] };
  const definition: AvailableCalibrationDatasetDefinition = { ...original, definitionIdentity: engineering.definitionIdentity,
    definitionRevisionId: definitionRevision, title: input.title ?? "RPM Boost Load (unqualified title)", dimensions, units,
    sourceArtifactDigest: authorityChain.sourceArtifactDigest, sourceBindingDigest: `${exact}:source-binding`,
    engineeringEvidence: engineering, state: "qualified_engineering_value", unavailableStage: null,
    rawEvidence: { ...original.rawEvidence, exactBinaryDigest: digest, romLayoutId: authorityChain.romLayoutId,
      evidenceId: engineering.sourceRawEvidenceId, evidenceRevision: engineering.sourceRawEvidenceRevision,
      exactBinaryIdentityId: `${exact}:binary`, definitionSourceBindingDigest: `${exact}:source-binding`, definitionSetId: authorityChain.definitionSetId,
      definitionSetRevisionId: authorityChain.definitionSetRevisionId, definitionRevisionId: definitionRevision,
      definitionIdentity: engineering.definitionIdentity, dimensions, authorityChain, rawValues: engineering.rawValues,
      exactRawOffsets: engineering.cellTrace.map(cell => cell.rawOffset), rawAxes: [], provenance: [U0_FIXTURE_LIMITATION] },
    findings: [U0_FIXTURE_LIMITATION], provenance: [U0_FIXTURE_LIMITATION] };
  const dataset: QualifiedCalibrationDataset = { ...template, datasetId: `${rev}:${platform}:dataset`, datasetRevision: `${digest}:dataset-revision`,
    exactBinaryIdentity: { ...template.exactBinaryIdentity, identityId: `${exact}:binary`, digest,
      containerType: input.container ?? "bin", romFamily: platform, softwareIdentity: `${rev}:${input.dme ?? "unknown-dme"}`,
      calibrationIdentity: rev, internalRomIdentifiers: [rev], identityProvenance: [U0_FIXTURE_LIMITATION] },
    romLayoutId: authorityChain.romLayoutId, relationshipRevision: authorityChain.relationshipRevision,
    relationshipId: authorityChain.relationshipId, definitionSetId: authorityChain.definitionSetId,
    sourceArtifactId: authorityChain.sourceArtifactId, sourceArtifactDigest: authorityChain.sourceArtifactDigest,
    discoveryResultId: `${exact}:discovery`, discoveryResultRevision: `${exact}:discovery:v1`,
    discoveryRegistrySnapshotId: `${exact}:discovery-registry`, applicabilityRegistrySnapshotId: authorityChain.registrySnapshotId,
    membershipId: `${exact}:membership`, membershipRevision: `${exact}:membership:v1`,
    definitionSetRevisionId: authorityChain.definitionSetRevisionId, definitions: [definition],
    summary: { ...template.summary, totalDefinitions: 1, availableQualifiedDefinitions: 1, identityConversions: 0,
      unavailableDefinitions: 0, conflictedDefinitions: 0, scalars: input.shape === "scalar" ? 1 : 0,
      oneDimensionalTables: input.shape === "array_1d" ? 1 : 0, twoDimensionalTables: input.shape === "table_2d" ? 1 : 0,
      axesAvailable: input.axes?.length ?? 0, unitsRepresented: units === null ? [] : [units], findings: [U0_FIXTURE_LIMITATION] },
    provenance: [U0_FIXTURE_LIMITATION], limitations: [U0_FIXTURE_LIMITATION] };
  return { context: { ownerId: `${rev}:owner`, vehicleId: `${rev}:${platform}:vehicle`, sessionId: `${rev}:session`, sourceMode: "development_fixture" },
    selection: { key: `${rev}:native-key`, definitionRevision, occurrence: 0 }, current: { state: "available", dataset },
    reference: { state: "missing", findings: ["Controlled absence of Reference."] }, quarantines: [], semantic: null,
    edit: null, exportCapability: null, working: null,
    comparison: { state: "unavailable", findings: ["Controlled Reference absence; comparison not supplied."] } };
}

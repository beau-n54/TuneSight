import { createHash } from "node:crypto";
import { collectInternalIdentityObservations } from "../xdf/applicabilityEvidenceProposal.ts";
import { identifyEngineeringBinary } from "../xdf/definitionRomApplicability.ts";
import type { DefinitionCoverageResolution } from "../xdf/definitionCoverageDiscovery.ts";
import { defineEcuIdentityObservation } from "../vehicle-interface/nativeVehicleData.ts";
import { compareQualifiedCalibrationDatasets, constructQualifiedCalibrationDatasetComparisonRequest, type QualifiedCalibrationComparisonEvidence } from "../xdf/qualifiedCalibrationComparison.ts";
import { constructQualifiedCalibrationDatasetRequest, materializeQualifiedCalibrationDataset, type QualifiedCalibrationDataset } from "../xdf/qualifiedCalibrationDataset.ts";
import { resolveBinaryContainer } from "../tunes/binaryContainer.ts";
import { buildWorkshopViewModel, type WorkshopViewModel } from "./viewModel.ts";
import { resolveGovernedRomIdentity, type GovernedRomMarkerProfile } from "../xdf/governedRomIdentityResolution.ts";
import { buildCurrentOnlyWorkshopViewModel, type CurrentOnlyWorkshopViewModel } from "./currentOnlyViewModel.ts";
import { deriveWorkshopCapabilities, resolveMasterCalibration } from "./masterCalibrationResolver.ts";
import { findRepositoryIdentity, RepositoryDefinitionCatalog } from "./repositoryDefinitionCatalog.ts";
import type { TableQuarantineRecord } from "../xdf/tableQuarantine.ts";
import { classifyEntryEditCapabilities, type CalibrationEditCapability } from "./editAuthority.ts";
import type { SourceBinaryLeaseReceipt } from "./sourceBinaryReconstructionLease.ts";
import { calibrationKnowledgeForRelationship } from "../knowledge/publishedCalibrationSemantics.ts";

export const SUBSCRIBER_CALIBRATION_MAX_UPLOAD_BYTES = 32 * 1024 * 1024;
export type SubscriberCalibrationFailure = Readonly<{ status: "coverage_unavailable" | "invalid_upload"; title: string; message: string; identity: string | null; digest: string | null; container: string | null; byteLength: number | null; coverage: DefinitionCoverageResolution | null; timings: Readonly<Record<string, number>> }>;
type SubscriberWorkshopMaterial = Readonly<{ reference: QualifiedCalibrationDataset; current: QualifiedCalibrationDataset; comparison: QualifiedCalibrationComparisonEvidence }>;
type SubscriberCurrentOnlyMaterial = Readonly<{ reference: null; current: QualifiedCalibrationDataset; comparison: null }>;
export type SubscriberCalibrationSuccess = Readonly<{ status: "workshop_ready"; workshop: WorkshopViewModel | CurrentOnlyWorkshopViewModel; material: SubscriberWorkshopMaterial | SubscriberCurrentOnlyMaterial; identity: string; digest: string; container: string; byteLength: number; coverage: DefinitionCoverageResolution; quarantines: readonly TableQuarantineRecord[]; editCapabilities: readonly CalibrationEditCapability[]; timings: Readonly<Record<string, number>>; sourceLease?: SourceBinaryLeaseReceipt }>;
export type SubscriberCalibrationResult = SubscriberCalibrationFailure | SubscriberCalibrationSuccess;

const sha = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

export async function loadSubscriberCalibration(input: Readonly<{ bytes: Uint8Array; fileName: string; mimeType: string | null; selectedDefinition?: string | null; observedAt?: string }>): Promise<SubscriberCalibrationResult> {
  const timings: Record<string, number> = {}; let mark = performance.now(); const record = (name: string) => { const now = performance.now(); timings[name] = Math.round(now - mark); mark = now; };
  if (!input.bytes.byteLength || input.bytes.byteLength > SUBSCRIBER_CALIBRATION_MAX_UPLOAD_BYTES) return Object.freeze({ status: "invalid_upload", title: "Calibration file invalid", message: `Calibration payload must be between 1 byte and ${SUBSCRIBER_CALIBRATION_MAX_UPLOAD_BYTES} bytes.`, identity: null, digest: null, container: null, byteLength: input.bytes.byteLength, coverage: null, timings: Object.freeze(timings) });
  const resolved = resolveBinaryContainer({ bytes: input.bytes, fileName: input.fileName, mimeType: input.mimeType }); record("containerResolutionMs");
  if (resolved.status !== "resolved") return Object.freeze({ status: "invalid_upload", title: "Calibration file unsupported", message: resolved.message, identity: null, digest: null, container: resolved.containerType, byteLength: input.bytes.byteLength, coverage: null, timings: Object.freeze(timings) });
  const binary = resolved.engineeringBinary;
  const catalogIdentities = RepositoryDefinitionCatalog.listIdentities();
  const observations = collectInternalIdentityObservations({ binaryBytes: binary.bytes, credibleIdentifiers: catalogIdentities.map((item) => ({ identifier: item.romSoftwareIdentity, kind: "calibration_identifier" as const, confidence: "known_identity" as const, reason: "Governed repository Definition catalog identity vocabulary", encodings: item.encodings })) });
  const markerProfiles = catalogIdentities.map((item) => item.markerProfile).filter((item): item is GovernedRomMarkerProfile => item !== null);
  const digest = sha(binary.bytes), identityResolution = resolveGovernedRomIdentity({ observations, markerProfiles }), identity = identityResolution.identity, observedIdentity = identity ?? (identityResolution.outcome === "conflict" ? observations[0]?.normalizedForm ?? null : null), identityDescriptor = findRepositoryIdentity(identity); record("romIdentityMs");
  const observedAt = input.observedAt ?? new Date().toISOString(), observation = defineEcuIdentityObservation({ sessionId: `subscriber-upload:${digest}`, endpointId: "subscriber-file", protocol: "file-upload", observedDmeFamily: identityDescriptor?.family ?? null, softwareIdentity: observedIdentity, calibrationIdentity: observedIdentity, vin: null, observedAt, capabilityObservations: observations.map((item) => item.observationId), qualification: "observed_unqualified", provenance: "Subscriber-supplied calibration file; exact bytes were not persisted." });
  const connectedRom = { observation, trust: "qualified_supplied_evidence" as const, ecuFamily: identityDescriptor?.ecuDmeFamily ?? null, binary: { digest, byteLength: binary.byteLength, container: binary.source.containerType, markers: observations.map((item) => ({ marker: item.normalizedForm, offsets: item.offsets })) }, provenance: ["Bounded server-side upload resolution", ...identityResolution.findings], limitations: ["Subscriber-supplied identity Evidence does not create applicability authority.", "Ancillary marker observations do not replace the governed primary ROM marker profile."] };
  const resolution = resolveMasterCalibration({ current: { engineeringBinary: binary, sourceKind: "manual_upload", ownerScope: "authenticated_subscriber", vehicleScope: "authorized_vehicle", provenance: connectedRom.provenance }, connectedRom, catalog: RepositoryDefinitionCatalog, conflicts: identityResolution.outcome === "conflict" ? identityResolution.findings : [] });
  const coverage = resolution.coverage, entry = resolution.catalogEntry; record("definitionCoverageMs");
  if (resolution.outcome !== "EXACT_QUALIFIED_MATCH" || !identity || !entry) return Object.freeze({ status: "coverage_unavailable", title: coverage.outcome === "CONFLICT" ? "Calibration coverage conflict" : "Calibration coverage unavailable", message: coverage.workshopMessage, identity, digest, container: binary.source.containerType, byteLength: binary.byteLength, coverage, timings: Object.freeze(timings) });
  const binaryIdentity = identifyEngineeringBinary({ engineeringBinary: binary, romFamily: entry.identity.family, softwareIdentity: identity, calibrationIdentity: identity, internalRomIdentifiers: [identity], identityProvenance: [observation.observationId] });
  const currentResult = materializeQualifiedCalibrationDataset(constructQualifiedCalibrationDatasetRequest({ engineeringBinary: binary, binaryIdentity, observations, discoveryRegistry: entry.discoveryRegistry, applicabilityRegistry: entry.applicabilityRegistry, membershipAuthorities: [entry.authority], sourceRole: "user_modified", sourceProvenance: ["Subscriber-qualified vehicle Current Calibration", observation.observationId, coverage.resolutionRevision], independentlyQualifiedEcuFamily: null })); record("currentDatasetMs");
  if (!currentResult.dataset) return Object.freeze({ status: "coverage_unavailable", title: "Calibration coverage unavailable", message: currentResult.finding, identity, digest, container: binary.source.containerType, byteLength: binary.byteLength, coverage, timings: Object.freeze(timings) });
  const quarantines = entry.quarantines.filter((item) => item.affectedBinary.digest === digest);
  const editCapabilities = classifyEntryEditCapabilities(entry);
  const capabilities = deriveWorkshopCapabilities(entry);
  if (capabilities.mode === "current_only" || entry.referenceCapability.state === "reference_unavailable") {
    const material: SubscriberCurrentOnlyMaterial = Object.freeze({ reference: null, current: currentResult.dataset, comparison: null });
    const successBase = { status: "workshop_ready" as const, material, identity, digest, container: binary.source.containerType, byteLength: binary.byteLength, coverage, quarantines, editCapabilities };
    const workshop = buildSubscriberWorkshop(successBase, input.selectedDefinition); record("viewModelMs");
    return Object.freeze({ ...successBase, workshop, timings: Object.freeze(timings) });
  }
  const reference = entry.referenceCapability.datasetInput;
  const referenceResult = materializeQualifiedCalibrationDataset(constructQualifiedCalibrationDatasetRequest({ engineeringBinary: reference.engineeringBinary, binaryIdentity: reference.binaryIdentity, observations: reference.observations, discoveryRegistry: entry.discoveryRegistry, applicabilityRegistry: entry.applicabilityRegistry, membershipAuthorities: [entry.authority], sourceRole: reference.sourceRole, sourceProvenance: reference.sourceProvenance, independentlyQualifiedEcuFamily: null })); record("referenceResolutionMs");
  if (!referenceResult.dataset) throw new Error("Governed Reference Dataset could not be materialized.");
  const compared = compareQualifiedCalibrationDatasets(constructQualifiedCalibrationDatasetComparisonRequest({ reference: referenceResult.dataset, modified: currentResult.dataset })); record("comparisonMs"); if (compared.status === "rejected") throw new Error(compared.finding);
  const material = Object.freeze({ reference: referenceResult.dataset, current: currentResult.dataset, comparison: compared.evidence });
  const successBase = { status: "workshop_ready" as const, material, identity, digest, container: binary.source.containerType, byteLength: binary.byteLength, coverage, quarantines, editCapabilities };
  const workshop = buildSubscriberWorkshop(successBase, input.selectedDefinition); record("viewModelMs");
  return Object.freeze({ ...successBase, workshop, timings: Object.freeze(timings) });
}

export function buildSubscriberWorkshop(result: Pick<SubscriberCalibrationSuccess, "material" | "identity" | "digest" | "quarantines" | "editCapabilities">, selectedDefinition?: string | null): WorkshopViewModel | CurrentOnlyWorkshopViewModel {
  const knowledgeRecords = calibrationKnowledgeForRelationship(result.material.current.relationshipRevision);
  if (result.material.reference === null || result.material.comparison === null) return buildCurrentOnlyWorkshopViewModel({ current: result.material.current, quarantines: result.quarantines, editCapabilities: result.editCapabilities, knowledgeRecords, selectedKey: selectedDefinition });
  return buildWorkshopViewModel({ reference: result.material.reference, current: result.material.current, comparison: result.material.comparison, editCapabilities: result.editCapabilities, knowledgeRecords, source: { kind: "subscriber_upload", label: `${result.identity} governed Reference → subscriber Current`, fixtureIdentity: `subscriber-upload:${result.digest}` }, selectedKey: selectedDefinition });
}

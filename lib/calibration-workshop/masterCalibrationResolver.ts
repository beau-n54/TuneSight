import { createHash } from "node:crypto";
import type { InternalIdentityObservation } from "../xdf/applicabilityEvidenceProposal.ts";
import { resolveDefinitionCoverage, type ConnectedRomObservation, type DefinitionCoverageCandidate, type DefinitionCoverageResolution } from "../xdf/definitionCoverageDiscovery.ts";
import type { EngineeringBinaryIdentity } from "../xdf/definitionRomApplicability.ts";
import type { GovernedRomMarkerProfile } from "../xdf/governedRomIdentityResolution.ts";
import type { RomLayoutMembershipAuthority } from "../xdf/romLayoutDiscovery.ts";
import type { QualifiedRomLayoutDiscoveryRegistry } from "../xdf/romLayoutDiscovery.ts";
import type { RomLayoutApplicabilityRegistrySnapshot } from "../xdf/romLayoutApplicabilityPublication.ts";
import type { TableQuarantineRecord } from "../xdf/tableQuarantine.ts";
import type { EngineeringBinary } from "../tunes/binaryContainer.ts";

export const MASTER_CALIBRATION_RESOLVER_CONTRACT = "tunesight.master-calibration-resolver.v1" as const;

export type CurrentCalibrationBinary = Readonly<{
  engineeringBinary: EngineeringBinary;
  sourceKind: "manual_upload" | "dme_read";
  ownerScope: string;
  vehicleScope: string;
  provenance: readonly string[];
}>;

export type DefinitionCatalogIdentity = Readonly<{
  romSoftwareIdentity: string;
  family: string;
  ecuDmeFamily: string | null;
  encodings: readonly ("ascii" | "hex_encoded")[];
  markerProfile: GovernedRomMarkerProfile | null;
}>;

export type ReferenceCalibrationCapability = Readonly<{
  state: "authoritative_reference_available";
  datasetInput: Readonly<{
    engineeringBinary: EngineeringBinary;
    binaryIdentity: EngineeringBinaryIdentity;
    observations: readonly InternalIdentityObservation[];
    sourceRole: "stock_candidate";
    sourceProvenance: readonly string[];
  }>;
}> | Readonly<{ state: "reference_unavailable" }>;

export type DefinitionCatalogEntry = Readonly<{
  catalogEntryId: string;
  sourceKind: "repository" | "acquired";
  lifecycleState: "active" | "inactive" | "superseded";
  sourceAuthorityState: "qualified" | "candidate" | "unresolved";
  applicabilityState: "published" | "candidate" | "unpublished";
  identity: DefinitionCatalogIdentity;
  coverageCandidate: DefinitionCoverageCandidate;
  authority: RomLayoutMembershipAuthority;
  discoveryRegistry: QualifiedRomLayoutDiscoveryRegistry;
  applicabilityRegistry: RomLayoutApplicabilityRegistrySnapshot;
  quarantines: readonly TableQuarantineRecord[];
  referenceCapability: ReferenceCalibrationCapability;
}>;

export interface DefinitionCatalog {
  readonly catalogId: string;
  listIdentities(): readonly DefinitionCatalogIdentity[];
  listEntries(): readonly DefinitionCatalogEntry[];
}

export type MasterCalibrationResolutionOutcome =
  | "EXACT_QUALIFIED_MATCH"
  | "MATCH_REQUIRES_QUALIFICATION"
  | "AMBIGUOUS_MATCH"
  | "ROM_RECOGNIZED_DEFINITION_MISSING"
  | "ROM_UNKNOWN"
  | "DEFINITION_CONFLICT"
  | "INVALID_BINARY";

export type MasterCalibrationResolution = Readonly<{
  contractVersion: typeof MASTER_CALIBRATION_RESOLVER_CONTRACT;
  outcome: MasterCalibrationResolutionOutcome;
  coverage: DefinitionCoverageResolution;
  catalogEntry: DefinitionCatalogEntry | null;
  findings: readonly string[];
}>;

const outcome = (coverage: DefinitionCoverageResolution): MasterCalibrationResolutionOutcome => {
  if (coverage.outcome === "EXACT_DEFINITION_COVERAGE") return "EXACT_QUALIFIED_MATCH";
  if (coverage.outcome === "CANDIDATE_DEFINITION_COVERAGE") return "MATCH_REQUIRES_QUALIFICATION";
  if (coverage.outcome === "ROM_RECOGNIZED_DEFINITIONS_UNAVAILABLE") return "ROM_RECOGNIZED_DEFINITION_MISSING";
  if (coverage.outcome === "NEW_ROM_DISCOVERED") return "ROM_UNKNOWN";
  if (coverage.outcome === "INVALID") return "INVALID_BINARY";
  return coverage.candidateIds.length > 1 ? "AMBIGUOUS_MATCH" : "DEFINITION_CONFLICT";
};

export function resolveMasterCalibration(input: Readonly<{
  current: CurrentCalibrationBinary;
  connectedRom: ConnectedRomObservation;
  catalog: DefinitionCatalog;
  conflicts?: readonly string[];
}>): MasterCalibrationResolution {
  const connectedBinary = input.connectedRom.binary;
  const currentBinary = input.current.engineeringBinary;
  if (
    !connectedBinary
    || connectedBinary.digest !== createHash("sha256").update(currentBinary.bytes).digest("hex")
    || connectedBinary.byteLength !== currentBinary.byteLength
    || connectedBinary.container.toLowerCase() !== currentBinary.source.containerType.toLowerCase()
  ) {
    const coverage = resolveDefinitionCoverage({ connectedRom: input.connectedRom, recognizedRomIdentities: [], candidates: [], conflicts: ["Current Calibration binary does not match the connected ROM observation."] });
    return Object.freeze({ contractVersion: MASTER_CALIBRATION_RESOLVER_CONTRACT, outcome: "INVALID_BINARY", coverage, catalogEntry: null, findings: Object.freeze([...coverage.findings]) });
  }
  const identities = input.catalog.listIdentities();
  const catalogEntries = input.catalog.listEntries();
  const entries = catalogEntries.filter((entry) => entry.lifecycleState === "active" && entry.sourceAuthorityState === "qualified" && entry.applicabilityState === "published" && entry.coverageCandidate.coverageState === "exact_qualified");
  const qualificationCandidates = catalogEntries.filter((entry) => entry.lifecycleState !== "superseded" && entry.coverageCandidate.coverageState === "candidate_only");
  const coverage = resolveDefinitionCoverage({
    connectedRom: input.connectedRom,
    recognizedRomIdentities: identities.map((item) => item.romSoftwareIdentity),
    candidates: [...entries, ...qualificationCandidates].map((item) => item.coverageCandidate),
    conflicts: input.conflicts,
  });
  const connectedIdentity = input.connectedRom.observation.softwareIdentity?.toUpperCase() ?? null;
  const matches = coverage.outcome === "EXACT_DEFINITION_COVERAGE"
    ? entries.filter((entry) => entry.coverageCandidate.definitionSetRevision === coverage.exactDefinitionSetRevision && entry.identity.romSoftwareIdentity.toUpperCase() === connectedIdentity)
    : [];
  const selected = matches.length === 1 ? matches[0]! : null;
  const resolvedOutcome = selected ? "EXACT_QUALIFIED_MATCH" : outcome(coverage);
  return Object.freeze({
    contractVersion: MASTER_CALIBRATION_RESOLVER_CONTRACT,
    outcome: resolvedOutcome,
    coverage,
    catalogEntry: selected,
    findings: Object.freeze([...coverage.findings]),
  });
}

export type ResolvedWorkshopCapabilities = Readonly<{
  current: "qualified";
  reference: "available" | "unavailable";
  comparison: "available" | "unavailable";
  mode: "reference_comparison" | "current_only";
}>;

export function deriveWorkshopCapabilities(entry: DefinitionCatalogEntry): ResolvedWorkshopCapabilities {
  const reference = entry.referenceCapability.state === "authoritative_reference_available" ? "available" : "unavailable";
  return Object.freeze({ current: "qualified", reference, comparison: reference, mode: reference === "available" ? "reference_comparison" : "current_only" });
}

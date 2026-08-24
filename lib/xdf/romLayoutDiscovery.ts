import { createHash } from "node:crypto";
import type { EngineeringBinary } from "../tunes/binaryContainer.ts";
import type { InternalIdentityObservation } from "./applicabilityEvidenceProposal.ts";
import {
  assessBinaryRomLayoutMembership,
  type BinaryLayoutMembershipResult,
} from "./binaryRomLayoutMembership.ts";
import type { XdfDefinitionRevision } from "./canonicalXdfDefinition.ts";
import type { DefinitionSetRevision, EngineeringBinaryIdentity } from "./definitionRomApplicability.ts";
import type { RomLayoutIdentity, RomLayoutMarker } from "./romLayoutApplicability.ts";
import type {
  QualifiedRomLayoutApplicabilityRelationship,
  RomLayoutApplicabilityRegistrySnapshot,
} from "./romLayoutApplicabilityPublication.ts";

export const ROM_LAYOUT_DISCOVERY_CONTRACT = "tunesight.rom-layout-discovery.v1" as const;
export const ROM_LAYOUT_DISCOVERY_LIMITS = Object.freeze({ maximumBinaryBytes: 32 * 1024 * 1024, maximumQualifiedLayouts: 10_000, maximumObservations: 2_048 });

export type QualifiedRomLayoutDescriptor = Readonly<{
  descriptorId: string;
  descriptorRevision: string;
  contractVersion: "tunesight.qualified-rom-layout-discovery-descriptor.v1";
  registrySnapshotId: string;
  romLayoutId: string;
  relationshipId: string;
  relationshipRevision: string;
  definitionSetId: string;
  definitionSetRevisionId: string;
  romSoftwareIdentifiers: readonly string[];
  calibrationSoftwareIdentifiers: readonly string[];
  ecuDmeFamily: string;
  containerTypes: readonly string[];
  binaryByteLength: number;
  internalMarkers: readonly RomLayoutMarker[];
  authorityProvenance: readonly string[];
  sourceProvenanceDisclosure: readonly string[];
  provenanceLimitations: readonly string[];
}>;

export type QualifiedRomLayoutDiscoveryRegistry = Readonly<{
  snapshotId: string;
  contractVersion: "tunesight.qualified-rom-layout-discovery-registry.v1";
  authoritySnapshotId: string;
  descriptors: readonly QualifiedRomLayoutDescriptor[];
}>;

export type CandidateEvidenceState = "strong_candidate" | "possible_candidate" | "contradicted" | "incompatible" | "insufficient_evidence";
export type RomLayoutDiscoveryOutcome = "exact_candidate" | "ambiguous" | "unknown" | "conflict" | "invalid";

export type RomLayoutCandidateAssessment = Readonly<{
  assessmentId: string;
  romLayoutId: string;
  descriptorRevision: string;
  evidenceState: CandidateEvidenceState;
  matchingObservations: readonly string[];
  exactMarkerCorrespondence: readonly string[];
  missingEvidence: readonly string[];
  contradictions: readonly string[];
  incompatibilities: readonly string[];
  familyEvidenceUsedAsFilterOnly: true;
  containerAndLengthUsedAsFilterOnly: true;
}>;

export type RomLayoutDiscoveryRequest = Readonly<{
  requestId: string;
  requestRevision: string;
  contractVersion: typeof ROM_LAYOUT_DISCOVERY_CONTRACT;
  engineeringBinary: EngineeringBinary;
  binaryIdentity: EngineeringBinaryIdentity;
  observations: readonly InternalIdentityObservation[];
  qualifiedRegistry: QualifiedRomLayoutDiscoveryRegistry;
  independentlyQualifiedEcuFamily: string | null;
  provenance: readonly string[];
}>;

export type RomLayoutDiscoveryResult = Readonly<{
  resultId: string;
  resultRevision: string;
  contractVersion: "tunesight.rom-layout-discovery-result.v1";
  requestId: string;
  requestRevision: string;
  exactBinaryIdentity: EngineeringBinaryIdentity;
  registrySnapshotId: string;
  candidateAssessments: readonly RomLayoutCandidateAssessment[];
  selectedRomLayoutId: string | null;
  ambiguitySet: readonly string[];
  contradictedRomLayoutIds: readonly string[];
  missingEvidence: readonly string[];
  outcome: RomLayoutDiscoveryOutcome;
  provenance: readonly string[];
  limitations: readonly string[];
  bestMatchHeuristicUsed: false;
  membershipQualified: false;
}>;

export type RomLayoutMembershipAuthority = Readonly<{
  layout: RomLayoutIdentity;
  relationship: QualifiedRomLayoutApplicabilityRelationship;
  definitionSet: DefinitionSetRevision;
  definitions: readonly XdfDefinitionRevision[];
}>;

export type DiscoverAndQualifyResult = Readonly<{
  discovery: RomLayoutDiscoveryResult;
  membership: BinaryLayoutMembershipResult | null;
}>;

function canonical(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value) || !Number.isSafeInteger(value)) throw new Error("Discovery identity contains an unsafe number.");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (!value || typeof value !== "object") throw new Error("Discovery identity contains unsupported material.");
  const record = value as Readonly<Record<string, unknown>>;
  return `{${Object.keys(record).filter((key) => record[key] !== undefined).sort().map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`).join(",")}}`;
}
function digest(domain: string, value: unknown): string { return createHash("sha256").update(domain).update(Buffer.from([0])).update(canonical(value)).digest("hex"); }
function freeze<T>(value: T): T { if (ArrayBuffer.isView(value)) return value; if (Array.isArray(value)) return Object.freeze(value.map(freeze)) as T; if (value && typeof value === "object") { const clone: Record<PropertyKey, unknown> = {}; for (const key of Reflect.ownKeys(value)) clone[key] = freeze((value as Record<PropertyKey, unknown>)[key]); return Object.freeze(clone) as T; } return value; }
function unique(values: readonly string[]): readonly string[] { return [...new Set(values.map((value) => value.trim().toUpperCase()).filter(Boolean))].sort(); }
function sameNumbers(first: readonly number[], second: readonly number[]): boolean { return canonical([...first].sort((a, b) => a - b)) === canonical([...second].sort((a, b) => a - b)); }
function offsets(bytes: Uint8Array, needle: Uint8Array): readonly number[] { const result: number[]=[]; if (!needle.length) return result; outer: for (let at=0;at<=bytes.length-needle.length;at++){for(let inner=0;inner<needle.length;inner++)if(bytes[at+inner]!==needle[inner])continue outer;result.push(at);}return result; }
function markerBytes(marker: Pick<RomLayoutMarker, "normalizedForm" | "detector">): Uint8Array { return marker.detector === "bounded_hex_encoded_exact" ? Buffer.from(marker.normalizedForm,"hex") : Buffer.from(marker.normalizedForm,"ascii"); }
function validObservation(bytes: Uint8Array, observation: InternalIdentityObservation): boolean { const needle=observation.detector==="bounded_hex_encoded_exact"?Buffer.from(observation.rawForm,"hex"):Buffer.from(observation.rawForm,"ascii"), actual=offsets(bytes,needle);return needle.length>0&&actual.length===observation.occurrenceCount&&sameNumbers(actual,observation.offsets); }

export function defineQualifiedRomLayoutDescriptor(input: {
  layout: RomLayoutIdentity;
  relationship: QualifiedRomLayoutApplicabilityRelationship;
  registrySnapshotId: string;
}): QualifiedRomLayoutDescriptor {
  const { layout, relationship } = input;
  if (relationship.lifecycleState !== "active" || relationship.romLayoutId !== layout.layoutId) throw new Error("Discovery descriptors require one active qualified relationship for the exact ROM Layout Identity.");
  if (!input.registrySnapshotId.trim()) throw new Error("Discovery descriptor requires its qualified registry Snapshot identity.");
  const material = {
    registrySnapshotId: input.registrySnapshotId,
    romLayoutId: layout.layoutId,
    relationshipId: relationship.relationshipId,
    relationshipRevision: relationship.relationshipRevision,
    definitionSetId: relationship.definitionSetId,
    definitionSetRevisionId: relationship.definitionSetRevisionId,
    romSoftwareIdentifiers: unique(layout.romSoftwareIdentifiers),
    calibrationSoftwareIdentifiers: unique(layout.calibrationSoftwareIdentifiers),
    ecuDmeFamily: layout.ecuDmeFamily.trim().toUpperCase(),
    containerTypes: unique(layout.containerTypes),
    binaryByteLength: layout.binaryByteLength,
    internalMarkers: layout.internalMarkers,
    authorityProvenance: [...new Set(relationship.authorityProvenance)].sort(),
    sourceProvenanceDisclosure: [...new Set(relationship.sourceProvenanceDisclosure)].sort(),
    provenanceLimitations: [...new Set(relationship.provenanceLimitations)].sort(),
    contractVersion: "tunesight.qualified-rom-layout-discovery-descriptor.v1" as const,
  };
  const descriptorId = `qualified-rom-layout-descriptor:${digest("tunesight.qualified-rom-layout-discovery-descriptor-identity.v1", { registrySnapshotId: input.registrySnapshotId, romLayoutId: layout.layoutId, relationshipRevision: relationship.relationshipRevision })}`;
  return freeze({ descriptorId, descriptorRevision: `qualified-rom-layout-descriptor-revision:${digest("tunesight.qualified-rom-layout-discovery-descriptor-revision.v1", material)}`, ...material });
}

export function constructQualifiedRomLayoutDiscoveryRegistry(input: {
  authoritySnapshot: RomLayoutApplicabilityRegistrySnapshot;
  layouts: readonly RomLayoutIdentity[];
}): QualifiedRomLayoutDiscoveryRegistry {
  if (input.layouts.length > ROM_LAYOUT_DISCOVERY_LIMITS.maximumQualifiedLayouts) throw new Error("Qualified layout discovery registry exceeds its bounded limit.");
  const byId = new Map(input.layouts.map((layout) => [layout.layoutId, layout]));
  const descriptors = input.authoritySnapshot.relationships.filter((relationship) => relationship.lifecycleState === "active").map((relationship) => {
    const layout = byId.get(relationship.romLayoutId);
    if (!layout) throw new Error("Every active qualified relationship requires its exact ROM Layout Identity descriptor source.");
    return defineQualifiedRomLayoutDescriptor({ layout, relationship, registrySnapshotId: input.authoritySnapshot.snapshotId });
  }).sort((a, b) => a.romLayoutId.localeCompare(b.romLayoutId));
  if (descriptors.length !== input.layouts.length || new Set(descriptors.map((value) => value.romLayoutId)).size !== descriptors.length) throw new Error("Discovery registry may contain only and all uniquely active qualified layouts.");
  const material = { authoritySnapshotId: input.authoritySnapshot.snapshotId, descriptors: descriptors.map((value) => value.descriptorRevision), contractVersion: "tunesight.qualified-rom-layout-discovery-registry.v1" as const };
  return freeze({ snapshotId: `qualified-rom-layout-discovery-registry:${digest("tunesight.qualified-rom-layout-discovery-registry.v1", material)}`, ...material, descriptors });
}

export function constructRomLayoutDiscoveryRequest(input: Omit<RomLayoutDiscoveryRequest, "requestId" | "requestRevision" | "contractVersion">): RomLayoutDiscoveryRequest {
  if (!input.engineeringBinary.byteLength || input.engineeringBinary.byteLength > ROM_LAYOUT_DISCOVERY_LIMITS.maximumBinaryBytes || input.observations.length > ROM_LAYOUT_DISCOVERY_LIMITS.maximumObservations) throw new Error("ROM-layout discovery request is outside bounded input limits.");
  const provenance = [...new Set(input.provenance.map((value) => value.trim()).filter(Boolean))].sort();
  const observationIds = [...input.observations].map((value) => value.observationId).sort();
  const identity = { binaryIdentityId: input.binaryIdentity.identityId, binaryDigest: input.binaryIdentity.digest, registrySnapshotId: input.qualifiedRegistry.snapshotId, contractVersion: ROM_LAYOUT_DISCOVERY_CONTRACT };
  const material = { ...identity, observationIds, independentlyQualifiedEcuFamily: input.independentlyQualifiedEcuFamily?.trim().toUpperCase() ?? null, provenance };
  return freeze({ requestId: `rom-layout-discovery-request:${digest("tunesight.rom-layout-discovery-request-identity.v1", identity)}`, requestRevision: `rom-layout-discovery-request-revision:${digest("tunesight.rom-layout-discovery-request-revision.v1", material)}`, contractVersion: ROM_LAYOUT_DISCOVERY_CONTRACT, ...input, independentlyQualifiedEcuFamily: material.independentlyQualifiedEcuFamily, provenance });
}

function assessCandidate(request: RomLayoutDiscoveryRequest, descriptor: QualifiedRomLayoutDescriptor, registryVocabulary: ReadonlySet<string>): RomLayoutCandidateAssessment {
  const matching: string[] = [], exactMarkers: string[] = [], missing: string[] = [], contradictions: string[] = [], incompatibilities: string[] = [];
  if (!descriptor.containerTypes.includes(request.binaryIdentity.containerType.toUpperCase())) incompatibilities.push("Binary container contradicts the qualified layout descriptor.");
  if (descriptor.binaryByteLength !== request.engineeringBinary.byteLength) incompatibilities.push("Binary byte length contradicts the qualified layout descriptor.");
  if (request.independentlyQualifiedEcuFamily && request.independentlyQualifiedEcuFamily !== descriptor.ecuDmeFamily) incompatibilities.push("Independently qualified ECU/DME family Evidence contradicts the descriptor.");
  const expectedIdentifiers = new Set([...descriptor.romSoftwareIdentifiers, ...descriptor.calibrationSoftwareIdentifiers]);
  for (const observation of request.observations) {
    if (expectedIdentifiers.has(observation.normalizedForm)) matching.push(observation.observationId);
    else if (registryVocabulary.has(observation.normalizedForm) && observation.confidence !== "pattern_valid") contradictions.push(`Credible qualified-registry identity ${observation.normalizedForm} points to another layout.`);
  }
  for (const marker of descriptor.internalMarkers) {
    const actual = offsets(request.engineeringBinary.bytes,markerBytes(marker));
    const observed = request.observations.filter((value) => value.normalizedForm === marker.normalizedForm && value.detector === marker.detector);
    if (!observed.length && !actual.length) { missing.push(`Expected marker ${marker.normalizedForm} was not observed.`); continue; }
    if (actual.length===marker.offsets.length&&sameNumbers(actual,marker.offsets)) exactMarkers.push(marker.normalizedForm);
    else contradictions.push(`Marker ${marker.normalizedForm} has contradictory multiplicity or offsets.`);
  }
  let evidenceState: CandidateEvidenceState;
  if (incompatibilities.length) evidenceState = "incompatible";
  else if (contradictions.length) evidenceState = "contradicted";
  else if (matching.length && exactMarkers.length === descriptor.internalMarkers.length && !missing.length) evidenceState = "strong_candidate";
  else if (matching.length || exactMarkers.length) evidenceState = "possible_candidate";
  else evidenceState = "insufficient_evidence";
  const material = { romLayoutId: descriptor.romLayoutId, descriptorRevision: descriptor.descriptorRevision, evidenceState, matchingObservations: matching.sort(), exactMarkerCorrespondence: [...new Set(exactMarkers)].sort(), missingEvidence: missing.sort(), contradictions: contradictions.sort(), incompatibilities: incompatibilities.sort(), familyEvidenceUsedAsFilterOnly: true as const, containerAndLengthUsedAsFilterOnly: true as const };
  return freeze({ assessmentId: `rom-layout-candidate-assessment:${digest("tunesight.rom-layout-candidate-assessment.v1", { requestRevision: request.requestRevision, ...material })}`, ...material });
}

export function discoverQualifiedRomLayout(request: RomLayoutDiscoveryRequest): RomLayoutDiscoveryResult {
  const bytesDigest = createHash("sha256").update(request.engineeringBinary.bytes).digest("hex");
  const identityValid = bytesDigest === request.binaryIdentity.digest && request.binaryIdentity.identityId === `engineering-binary:${bytesDigest}` && request.binaryIdentity.byteLength === request.engineeringBinary.byteLength && request.observations.every((value) => value.binaryDigest === bytesDigest && validObservation(request.engineeringBinary.bytes,value));
  const vocabulary = new Set(request.qualifiedRegistry.descriptors.flatMap((value) => [...value.romSoftwareIdentifiers, ...value.calibrationSoftwareIdentifiers, ...value.internalMarkers.map((marker) => marker.normalizedForm)]));
  const candidateAssessments = request.qualifiedRegistry.descriptors.map((descriptor) => assessCandidate(request, descriptor, vocabulary)).sort((a, b) => a.romLayoutId.localeCompare(b.romLayoutId));
  const strong = candidateAssessments.filter((value) => value.evidenceState === "strong_candidate");
  const possible = candidateAssessments.filter((value) => value.evidenceState === "possible_candidate");
  let outcome: RomLayoutDiscoveryOutcome;
  if (!identityValid || !request.engineeringBinary.byteLength || !request.qualifiedRegistry.descriptors.length) outcome = "invalid";
  else if (strong.length === 1 && possible.length === 0) outcome = "exact_candidate";
  else if (strong.length + possible.length > 1) outcome = "ambiguous";
  else if (strong.length === 0 && possible.length === 1) outcome = "ambiguous";
  else if (candidateAssessments.some((value) => value.evidenceState === "contradicted") && candidateAssessments.every((value) => value.evidenceState === "contradicted" || value.evidenceState === "incompatible")) outcome = "conflict";
  else outcome = "unknown";
  const selectedRomLayoutId = outcome === "exact_candidate" ? strong[0]!.romLayoutId : null;
  const ambiguitySet = outcome === "ambiguous" ? [...strong, ...possible].map((value) => value.romLayoutId).sort() : [];
  const missingEvidence = [...new Set(candidateAssessments.flatMap((value) => value.missingEvidence))].sort();
  const provenance = [...new Set([...request.provenance, `Qualified discovery registry ${request.qualifiedRegistry.snapshotId}`])].sort();
  const limitations = ["Discovery nominates qualified ROM-layout candidates; it does not qualify binary membership.", "Stock Variant, Vehicle Identity, calibration meaning, safety and recommendations are not assessed.", "Container, byte length and ECU family Evidence are rejection filters only.", "Only active qualified layout descriptors participate; no XDF search or byte-similarity authority is permitted."];
  const material = { requestId: request.requestId, requestRevision: request.requestRevision, exactBinaryIdentity: request.binaryIdentity, registrySnapshotId: request.qualifiedRegistry.snapshotId, candidateAssessments, selectedRomLayoutId, ambiguitySet, contradictedRomLayoutIds: candidateAssessments.filter((value) => value.evidenceState === "contradicted").map((value) => value.romLayoutId), missingEvidence, outcome, provenance, limitations, bestMatchHeuristicUsed: false as const, membershipQualified: false as const, contractVersion: "tunesight.rom-layout-discovery-result.v1" as const };
  return freeze({ resultId: `rom-layout-discovery-result:${digest("tunesight.rom-layout-discovery-result-identity.v1", { binaryDigest: request.binaryIdentity.digest, registrySnapshotId: request.qualifiedRegistry.snapshotId, discoveryContract: ROM_LAYOUT_DISCOVERY_CONTRACT })}`, resultRevision: `rom-layout-discovery-result-revision:${digest("tunesight.rom-layout-discovery-result-revision.v1", material)}`, ...material });
}

export function discoverAndQualifyBinaryRomLayout(input: {
  request: RomLayoutDiscoveryRequest;
  membershipAuthorities: readonly RomLayoutMembershipAuthority[];
  credibleRomIdentifiers: readonly string[];
  sourceRole: string;
  sourceProvenance: readonly string[];
  qualifiedAt?: string | null;
}): DiscoverAndQualifyResult {
  const discovery = discoverQualifiedRomLayout(input.request);
  if (discovery.outcome !== "exact_candidate" || !discovery.selectedRomLayoutId) return freeze({ discovery, membership: null });
  const authority = input.membershipAuthorities.find((value) => value.layout.layoutId === discovery.selectedRomLayoutId);
  if (!authority || input.membershipAuthorities.filter((value) => value.layout.layoutId === discovery.selectedRomLayoutId).length !== 1) return freeze({ discovery, membership: null });
  const membership = assessBinaryRomLayoutMembership({ engineeringBinary: input.request.engineeringBinary, binaryIdentity: input.request.binaryIdentity, targetLayout: authority.layout, relationship: authority.relationship, definitionSet: authority.definitionSet, definitions: authority.definitions, credibleRomIdentifiers: input.credibleRomIdentifiers, sourceRole: input.sourceRole, sourceProvenance: [...input.sourceProvenance, discovery.resultRevision], qualifiedAt: input.qualifiedAt });
  return freeze({ discovery, membership });
}

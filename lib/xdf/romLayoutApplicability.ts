import { createHash } from "node:crypto";
import type { EngineeringBinaryIdentity, DefinitionSetRevision } from "./definitionRomApplicability.ts";
import type { XdfSourceArtifact } from "./canonicalXdfDefinition.ts";
import type { InternalIdentityObservation, CandidateBinaryRole } from "./applicabilityEvidenceProposal.ts";

export type RomLayoutAuthorityPathway = "external_source_authority" | "tunesight_governed_engineering_evidence";
export type SourceAuthorityDisposition = "authoritative" | "disclosed_non_authoritative";
export type GovernedReviewOutcome = "evidence_sufficient_for_governed_review" | "more_evidence_required" | "technical_conflict" | "invalid";

export type RomLayoutMarker = Readonly<{
  kind: InternalIdentityObservation["kind"];
  normalizedForm: string;
  offsets: readonly number[];
  detector: InternalIdentityObservation["detector"];
}>;

export type RomLayoutIdentity = Readonly<{
  layoutId: string;
  contractVersion: "tunesight.rom-layout-identity.v1";
  romSoftwareIdentifiers: readonly string[];
  calibrationSoftwareIdentifiers: readonly string[];
  ecuDmeFamily: string;
  binaryByteLength: number;
  containerTypes: readonly string[];
  internalMarkers: readonly RomLayoutMarker[];
  calibrationAddressSpace: readonly Readonly<{ startAddress: number; size: number }>[];
  definitionCompatibleAddressRange: Readonly<{ minimum: number; maximum: number }>;
  xdfSideIdentities: readonly string[];
  evidenceProvenance: readonly string[];
}>;

export type ExactBinaryLayoutEvidence = Readonly<{
  binaryIdentity: EngineeringBinaryIdentity;
  sourceRole: CandidateBinaryRole;
  internalMarkers: readonly RomLayoutMarker[];
  evidenceProvenance: readonly string[];
}>;

export type LayoutEquivalenceAssessment = Readonly<{
  assessmentId: string;
  contractVersion: "tunesight.rom-layout-equivalence.v1";
  outcome: "same_layout" | "more_evidence_required" | "technical_conflict" | "invalid";
  layoutId: string | null;
  firstBinaryDigest: string | null;
  secondBinaryDigest: string | null;
  satisfiedSignals: readonly string[];
  unresolvedConditions: readonly string[];
  conflictFindings: readonly string[];
}>;

export type WrongLayoutNegativeControl = Readonly<{
  controlId: string;
  expectedLayoutId: string;
  expectedRomSoftwareIdentifiers: readonly string[];
  challengedBinaryDigest: string;
  challengedBinaryIdentifiers: readonly string[];
  outcome: "wrong_layout_rejected" | "failed_to_reject" | "invalid";
  findings: readonly string[];
}>;

export type ExtractionValidationSummary = Readonly<{
  definitionsAssessed: number;
  extractionCapableDefinitions: number;
  successfulExtractions: number;
  failedExtractions: number;
  unsupportedDefinitions: number;
  unresolvedDefinitions: number;
}>;

export type GovernedRomLayoutReviewPackage = Readonly<{
  packageId: string;
  packageRevision: string;
  contractVersion: "tunesight.governed-rom-layout-review-package.v1";
  authorityPathway: RomLayoutAuthorityPathway;
  sourceAuthorityDisposition: SourceAuthorityDisposition;
  sourceArtifact: XdfSourceArtifact;
  definitionSet: DefinitionSetRevision;
  explicitXdfRomIdentities: readonly string[];
  romLayoutIdentity: RomLayoutIdentity;
  binaryEvidence: readonly ExactBinaryLayoutEvidence[];
  layoutEquivalenceAssessments: readonly LayoutEquivalenceAssessment[];
  negativeControls: readonly WrongLayoutNegativeControl[];
  structurallyReadable: boolean;
  extractionValidation: ExtractionValidationSummary;
  representationConflictCount: number;
  stockVariantDisclosures: readonly Readonly<{ binaryDigest: string; status: string; sourceRole: CandidateBinaryRole }>[];
  currentLegacyClassification: "current" | "legacy";
  provenanceDisclosure: readonly string[];
  limitations: readonly string[];
  assessment: Readonly<{
    outcome: GovernedReviewOutcome;
    reviewEligible: boolean;
    exactAcceptanceEligible: boolean;
    explicitAuthorisedReviewerRequired: true;
    decisionState: "pending_explicit_authorised_reviewer";
    satisfiedRequirements: readonly string[];
    unresolvedConditions: readonly string[];
    conflictFindings: readonly string[];
  }>;
}>;

function canonical(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number") { if (!Number.isFinite(value) || !Number.isSafeInteger(value)) throw new Error("ROM-layout identity contains an unsafe number."); return JSON.stringify(value); }
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (!value || typeof value !== "object") throw new Error("ROM-layout identity contains an unsupported value.");
  const record = value as Readonly<Record<string, unknown>>;
  return `{${Object.keys(record).filter((key) => record[key] !== undefined).sort().map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`).join(",")}}`;
}
function digest(domain: string, value: unknown): string { return createHash("sha256").update(domain).update(Buffer.from([0])).update(canonical(value)).digest("hex"); }
function freeze<T>(value: T): T { if (Array.isArray(value)) return Object.freeze(value.map(freeze)) as T; if (value && typeof value === "object") { const clone: Record<PropertyKey, unknown> = {}; for (const key of Reflect.ownKeys(value)) clone[key] = freeze((value as Record<PropertyKey, unknown>)[key]); return Object.freeze(clone) as T; } return value; }
function unique(values: readonly string[]): readonly string[] { return [...new Set(values.map((value) => value.trim().toUpperCase()).filter(Boolean))].sort(); }
function markerKey(marker: RomLayoutMarker): string { return canonical({ kind: marker.kind, normalizedForm: marker.normalizedForm.toUpperCase(), offsets: [...marker.offsets].sort((a, b) => a - b), detector: marker.detector }); }
function markers(values: readonly RomLayoutMarker[]): readonly RomLayoutMarker[] { return [...values].map((value) => ({ ...value, normalizedForm: value.normalizedForm.trim().toUpperCase(), offsets: [...new Set(value.offsets)].sort((a, b) => a - b) })).sort((a, b) => markerKey(a).localeCompare(markerKey(b))); }

export function defineRomLayoutIdentity(input: Omit<RomLayoutIdentity, "layoutId" | "contractVersion">): RomLayoutIdentity {
  const material = {
    romSoftwareIdentifiers: unique(input.romSoftwareIdentifiers), calibrationSoftwareIdentifiers: unique(input.calibrationSoftwareIdentifiers), ecuDmeFamily: input.ecuDmeFamily.trim().toUpperCase(), binaryByteLength: input.binaryByteLength,
    containerTypes: unique(input.containerTypes), internalMarkers: markers(input.internalMarkers), calibrationAddressSpace: [...input.calibrationAddressSpace].sort((a, b) => a.startAddress - b.startAddress || a.size - b.size),
    definitionCompatibleAddressRange: input.definitionCompatibleAddressRange, xdfSideIdentities: unique(input.xdfSideIdentities), evidenceProvenance: [...new Set(input.evidenceProvenance.map((value) => value.trim()).filter(Boolean))].sort(),
  };
  if (!material.romSoftwareIdentifiers.length || !material.ecuDmeFamily || material.binaryByteLength <= 0 || !material.containerTypes.length || !material.internalMarkers.length || !material.xdfSideIdentities.length || !material.evidenceProvenance.length) throw new Error("ROM Layout Identity requires bounded software, ECU, binary, marker, XDF and provenance Evidence.");
  if (material.definitionCompatibleAddressRange.minimum < 0 || material.definitionCompatibleAddressRange.maximum < material.definitionCompatibleAddressRange.minimum || material.definitionCompatibleAddressRange.maximum >= material.binaryByteLength) throw new Error("ROM Layout Identity address range is outside its binary layout.");
  const engineeringIdentity = { ...material, evidenceProvenance: undefined };
  return freeze({ layoutId: `rom-layout:${digest("tunesight.rom-layout-identity.v1", engineeringIdentity)}`, contractVersion: "tunesight.rom-layout-identity.v1", ...material });
}

export function exactBinaryLayoutEvidence(input: ExactBinaryLayoutEvidence): ExactBinaryLayoutEvidence {
  if (!/^[a-f0-9]{64}$/.test(input.binaryIdentity.digest) || !input.evidenceProvenance.length || !input.internalMarkers.length) throw new Error("Exact Binary Layout Evidence requires an exact digest, markers and provenance.");
  return freeze({ ...input, internalMarkers: markers(input.internalMarkers), evidenceProvenance: [...new Set(input.evidenceProvenance.map((value) => value.trim()).filter(Boolean))].sort() });
}

export function assessLayoutEquivalence(input: { layout: RomLayoutIdentity | null; first: ExactBinaryLayoutEvidence | null; second: ExactBinaryLayoutEvidence | null }): LayoutEquivalenceAssessment {
  const layout = input.layout, first = input.first, second = input.second; const satisfied: string[] = [], unresolved: string[] = [], conflicts: string[] = [];
  if (!layout || !first || !second) return freeze({ assessmentId:`rom-layout-equivalence:${digest("tunesight.rom-layout-equivalence.v1", {layout:layout?.layoutId ?? null, first:first?.binaryIdentity.digest ?? null, second:second?.binaryIdentity.digest ?? null})}`, contractVersion:"tunesight.rom-layout-equivalence.v1", outcome:"invalid", layoutId:layout?.layoutId ?? null, firstBinaryDigest:first?.binaryIdentity.digest ?? null, secondBinaryDigest:second?.binaryIdentity.digest ?? null, satisfiedSignals:[], unresolvedConditions:["Layout and two exact Binary Evidence records are required."], conflictFindings:[] });
  if (first.binaryIdentity.digest === second.binaryIdentity.digest) unresolved.push("A second distinct exact binary instance is required to prove multi-instance layout equivalence."); else satisfied.push("Exact binary instance digests remain distinct.");
  if (first.binaryIdentity.byteLength === layout.binaryByteLength && second.binaryIdentity.byteLength === layout.binaryByteLength) satisfied.push("Both binaries satisfy the layout byte length."); else conflicts.push("A binary byte length contradicts the ROM Layout Identity.");
  if (layout.containerTypes.includes(first.binaryIdentity.containerType.toUpperCase()) && layout.containerTypes.includes(second.binaryIdentity.containerType.toUpperCase())) satisfied.push("Both binary containers satisfy the layout constraints."); else conflicts.push("A binary container contradicts the ROM Layout Identity.");
  const expectedMarkers = new Set(layout.internalMarkers.map(markerKey)); const firstMarkers = new Set(first.internalMarkers.map(markerKey)); const secondMarkers = new Set(second.internalMarkers.map(markerKey));
  if ([...expectedMarkers].every((value) => firstMarkers.has(value) && secondMarkers.has(value))) satisfied.push("Both binaries preserve the expected internal marker identities and offsets."); else conflicts.push("Internal marker identity or offsets contradict the ROM Layout Identity.");
  const expectedIds = new Set(layout.romSoftwareIdentifiers); const hasExpected = (item: ExactBinaryLayoutEvidence) => item.binaryIdentity.internalRomIdentifiers.some((value) => expectedIds.has(value));
  if (hasExpected(first) && hasExpected(second)) satisfied.push("Both exact instances preserve a compatible ROM/software identity."); else conflicts.push("A binary lacks a compatible ROM/software identity.");
  const outcome = conflicts.length ? "technical_conflict" : unresolved.length ? "more_evidence_required" : "same_layout";
  const material = { layoutId:layout.layoutId, firstBinaryDigest:first.binaryIdentity.digest, secondBinaryDigest:second.binaryIdentity.digest, satisfiedSignals:satisfied.sort(), unresolvedConditions:unresolved.sort(), conflictFindings:conflicts.sort() };
  return freeze({ assessmentId:`rom-layout-equivalence:${digest("tunesight.rom-layout-equivalence.v1", material)}`, contractVersion:"tunesight.rom-layout-equivalence.v1", outcome, ...material });
}

export function assessWrongLayoutNegativeControl(input: { expectedLayout: RomLayoutIdentity; challengedBinary: EngineeringBinaryIdentity }): WrongLayoutNegativeControl {
  const expected = new Set(input.expectedLayout.romSoftwareIdentifiers); const challenged = input.challengedBinary.internalRomIdentifiers;
  const valid = /^[a-f0-9]{64}$/.test(input.challengedBinary.digest) && challenged.length > 0;
  const overlap = challenged.some((value) => expected.has(value)); const outcome: WrongLayoutNegativeControl["outcome"] = !valid ? "invalid" : overlap ? "failed_to_reject" : "wrong_layout_rejected";
  const findings = !valid ? ["The challenged exact binary identity is invalid or lacks an internal ROM identifier."] : overlap ? ["The challenged binary shares an expected ROM/software identifier and is not a wrong-layout negative."] : [`Challenged identifiers ${challenged.join(", ")} contradict expected identifiers ${[...expected].join(", ")}.`];
  const material = { expectedLayoutId:input.expectedLayout.layoutId, expectedRomSoftwareIdentifiers:[...expected].sort(), challengedBinaryDigest:input.challengedBinary.digest, challengedBinaryIdentifiers:[...challenged].sort(), outcome, findings };
  return freeze({ controlId:`wrong-layout-control:${digest("tunesight.wrong-layout-negative-control.v1", material)}`, ...material });
}

export function constructGovernedRomLayoutReviewPackage(input: Omit<GovernedRomLayoutReviewPackage, "packageId" | "packageRevision" | "contractVersion" | "assessment">): GovernedRomLayoutReviewPackage {
  const unresolved: string[] = [], conflicts: string[] = [], satisfied: string[] = [];
  const validBinding = input.definitionSet.sourceArtifactId === input.sourceArtifact.artifactId && input.definitionSet.sourceArtifactDigest === input.sourceArtifact.sourceDigest;
  if (validBinding) satisfied.push("Exact XDF Source Artifact and Definition Set Revision are bound."); else conflicts.push("Definition Set does not bind the supplied exact XDF Source Artifact.");
  if (input.explicitXdfRomIdentities.some((value) => input.romLayoutIdentity.romSoftwareIdentifiers.includes(value.trim().toUpperCase()))) satisfied.push("Explicit XDF identity corresponds to the ROM Layout Identity."); else conflicts.push("Explicit XDF identity contradicts the ROM Layout Identity.");
  if (input.structurallyReadable) satisfied.push("Definition source is deterministically structurally readable."); else unresolved.push("Deterministic structural readability is required.");
  if (input.extractionValidation.extractionCapableDefinitions > 0 && input.extractionValidation.successfulExtractions === input.extractionValidation.extractionCapableDefinitions && input.extractionValidation.failedExtractions === 0) satisfied.push("Every extraction-capable Definition succeeded against the exact binary evidence."); else unresolved.push("At least one extraction-capable Definition and zero failed deterministic extractions are required.");
  if (input.representationConflictCount === 0) satisfied.push("No contained Definition representation conflict blocks the first governed cohort."); else unresolved.push(`${input.representationConflictCount} contained representation conflicts require exceptional review and remain unresolved.`);
  if (input.binaryEvidence.length >= 2 && input.layoutEquivalenceAssessments.length > 0 && input.layoutEquivalenceAssessments.every((item) => item.outcome === "same_layout")) satisfied.push("Multiple distinct exact binaries deterministically share the ROM Layout Identity."); else unresolved.push("A successful multi-instance layout-equivalence assessment is required.");
  if (input.negativeControls.length > 0 && input.negativeControls.every((item) => item.outcome === "wrong_layout_rejected")) satisfied.push("Wrong-layout negative controls reject incorrect ROM relationships."); else conflicts.push("A wrong-layout negative control is missing, invalid, or failed to reject.");
  if (!input.provenanceDisclosure.length) unresolved.push("Provenance disclosure is required."); else satisfied.push("Source provenance and limitations are disclosed.");
  if (input.authorityPathway === "external_source_authority" && input.sourceAuthorityDisposition !== "authoritative") conflicts.push("External/source authority pathway requires authoritative source provenance.");
  if (input.authorityPathway === "tunesight_governed_engineering_evidence" && input.sourceAuthorityDisposition === "disclosed_non_authoritative") satisfied.push("Non-authoritative source provenance is truthfully disclosed under the governed engineering pathway.");
  const invalid = !input.definitionSet.revisionId || !input.romLayoutIdentity.layoutId || input.binaryEvidence.length === 0;
  const outcome: GovernedReviewOutcome = invalid ? "invalid" : conflicts.length ? "technical_conflict" : unresolved.length ? "more_evidence_required" : "evidence_sufficient_for_governed_review";
  const assessment = { outcome, reviewEligible:outcome === "evidence_sufficient_for_governed_review", exactAcceptanceEligible:outcome === "evidence_sufficient_for_governed_review", explicitAuthorisedReviewerRequired:true as const, decisionState:"pending_explicit_authorised_reviewer" as const, satisfiedRequirements:satisfied.sort(), unresolvedConditions:unresolved.sort(), conflictFindings:conflicts.sort() };
  const contractVersion = "tunesight.governed-rom-layout-review-package.v1" as const;
  const relationship = { definitionSetRevisionId:input.definitionSet.revisionId, layoutId:input.romLayoutIdentity.layoutId, authorityPathway:input.authorityPathway };
  const packageId = `governed-rom-layout-review:${digest("tunesight.governed-rom-layout-review-identity.v1", relationship)}`;
  const material = { authorityPathway:input.authorityPathway, sourceAuthorityDisposition:input.sourceAuthorityDisposition, sourceArtifact:input.sourceArtifact, definitionSet:input.definitionSet, explicitXdfRomIdentities:unique(input.explicitXdfRomIdentities), romLayoutIdentity:input.romLayoutIdentity, binaryEvidence:[...input.binaryEvidence], layoutEquivalenceAssessments:[...input.layoutEquivalenceAssessments], negativeControls:[...input.negativeControls], structurallyReadable:input.structurallyReadable, extractionValidation:input.extractionValidation, representationConflictCount:input.representationConflictCount, stockVariantDisclosures:[...input.stockVariantDisclosures], currentLegacyClassification:input.currentLegacyClassification, provenanceDisclosure:[...new Set(input.provenanceDisclosure)].sort(), limitations:[...new Set(input.limitations)].sort(), assessment, contractVersion };
  return freeze({ packageId, packageRevision:`governed-rom-layout-review-revision:${digest("tunesight.governed-rom-layout-review-revision.v1", material)}`, ...material });
}

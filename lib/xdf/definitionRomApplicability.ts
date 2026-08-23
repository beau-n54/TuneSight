import { createHash } from "node:crypto";
import type { RuntimeStockVariantKnowledgeResponse } from "../knowledge/runtimeStockVariantKnowledge.ts";
import type { EngineeringBinary } from "../tunes/binaryContainer.ts";
import type { XdfDefinitionRevision, XdfSourceArtifact } from "./canonicalXdfDefinition.ts";

export type DefinitionSetRevision = Readonly<{
  definitionSetId: string;
  revisionId: string;
  sourceArtifactId: string;
  sourceArtifactDigest: string;
  sourceByteLength: number;
  definitionRevisionIds: readonly string[];
  definitionSourceBindingDigests: readonly string[];
  definitionCount: number;
}>;

export type EngineeringBinaryIdentity = Readonly<{
  identityId: string;
  digest: string;
  byteLength: number;
  containerType: EngineeringBinary["source"]["containerType"];
  containerByteLength: number;
  resolutionMethod: EngineeringBinary["source"]["resolutionMethod"];
  romFamily: string | null;
  softwareIdentity: string | null;
  calibrationIdentity: string | null;
  internalRomIdentifiers: readonly string[];
  identityProvenance: readonly string[];
}>;

export type DefinitionRomApplicabilityOutcome =
  | "exactly_applicable"
  | "qualified_candidate"
  | "family_compatible"
  | "conflicting"
  | "unknown"
  | "inapplicable"
  | "invalid";

export type ApplicabilityEvidenceStrength = "authoritative" | "qualified" | "provisional" | "observed";
export type ApplicabilityEvidenceSignal =
  | "exact_digest_pair"
  | "internal_rom_identifier"
  | "software_identity"
  | "calibration_identity"
  | "rom_family"
  | "source_association"
  | "size_compatibility"
  | "explicit_applicability"
  | "explicit_exclusion";

export type DefinitionRomApplicabilityEvidence = Readonly<{
  evidenceId: string;
  signal: ApplicabilityEvidenceSignal;
  strength: ApplicabilityEvidenceStrength;
  relationship: "supports" | "contradicts";
  definitionSetRevisionId: string | null;
  binaryDigest: string | null;
  assertedValue: string | null;
  provenance: string;
  explanation: string;
}>;

export type DefinitionRomApplicabilityResult = Readonly<{
  qualificationId: string;
  contractVersion: "tunesight.definition-rom-applicability.v1";
  outcome: DefinitionRomApplicabilityOutcome;
  definitionSetRevisionId: string | null;
  binaryIdentityId: string | null;
  binaryDigest: string | null;
  evidence: readonly DefinitionRomApplicabilityEvidence[];
  stockVariantKnowledge: RuntimeStockVariantKnowledgeResponse | null;
  reasons: readonly string[];
  unresolvedConditions: readonly string[];
}>;

export type DefinitionApplicabilityInheritance = Readonly<{
  status: "inherited_exact" | "not_exactly_applicable" | "definition_conflicting" | "definition_invalid";
  definitionRevisionId: string;
  definitionSetRevisionId: string;
  qualificationId: string;
  reason: string;
}>;

export type MasterLibraryApplicabilityReport = Readonly<{
  definitionSetsDiscovered: number;
  exactRelationships: number;
  candidateRelationships: number;
  familyCompatibleRelationships: number;
  conflictingRelationships: number;
  unresolvedRelationships: number;
  inapplicableRelationships: number;
  invalidRelationships: number;
  sourceAssociationsDiscovered: number;
  familiesRepresented: readonly string[];
}>;

export const DEFINITION_ROM_APPLICABILITY_LIMITS = Object.freeze({
  maximumDefinitionsPerSet: 10_000,
  maximumEvidenceItems: 256,
  maximumInternalRomIdentifiers: 128,
  maximumIdentityProvenanceItems: 128,
  maximumReportRelationships: 100_000,
});

function canonical(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value) || (Number.isInteger(value) && !Number.isSafeInteger(value))) throw new Error("Applicability identity contains an unsafe number.");
    return JSON.stringify(Object.is(value, -0) ? 0 : value);
  }
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (typeof value !== "object" || value === undefined) throw new Error("Applicability identity contains an unsupported value.");
  const record = value as Readonly<Record<string, unknown>>;
  return `{${Object.keys(record).filter((key) => record[key] !== undefined).sort().map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`).join(",")}}`;
}

function hash(domain: string, value: unknown): string {
  return createHash("sha256").update(domain).update(Buffer.from([0])).update(canonical(value)).digest("hex");
}

function freezeEvidence(value: DefinitionRomApplicabilityEvidence): DefinitionRomApplicabilityEvidence {
  return Object.freeze({ ...value });
}

function normal(value: string | null | undefined): string | null {
  const result = value?.trim().toUpperCase() ?? "";
  return result || null;
}

function validDigest(value: string): boolean {
  return /^[a-f0-9]{64}$/i.test(value);
}

export function defineDefinitionSetRevision(input: {
  sourceArtifact: XdfSourceArtifact;
  definitions: readonly XdfDefinitionRevision[];
}): DefinitionSetRevision {
  if (!input.sourceArtifact.sourceDigest || input.definitions.length === 0) throw new Error("Definition Set requires one exact source artifact and at least one Definition Revision.");
  if (input.definitions.length > DEFINITION_ROM_APPLICABILITY_LIMITS.maximumDefinitionsPerSet) throw new Error("Definition Set exceeds the bounded Definition limit.");
  if (input.definitions.some((definition) => definition.sourceArtifactDigest !== input.sourceArtifact.sourceDigest)) throw new Error("Every Definition Revision must belong to the exact Definition Set Source Artifact.");
  const revisionIds = [...input.definitions.map((definition) => definition.revisionId)].sort();
  const bindings = [...input.definitions.map((definition) => definition.sourceBindingDigest)].sort();
  const definitionSetId = `xdf-definition-set:${hash("tunesight.xdf.definition-set.v1", { sourceArtifactDigest: input.sourceArtifact.sourceDigest })}`;
  const revisionId = `xdf-definition-set-revision:${hash("tunesight.xdf.definition-set-revision.v1", { definitionSetId, bindings })}`;
  return Object.freeze({
    definitionSetId,
    revisionId,
    sourceArtifactId: input.sourceArtifact.artifactId,
    sourceArtifactDigest: input.sourceArtifact.sourceDigest,
    sourceByteLength: input.sourceArtifact.byteLength,
    definitionRevisionIds: Object.freeze(revisionIds),
    definitionSourceBindingDigests: Object.freeze(bindings),
    definitionCount: input.definitions.length,
  });
}

export function identifyEngineeringBinary(input: {
  engineeringBinary: EngineeringBinary;
  romFamily?: string | null;
  softwareIdentity?: string | null;
  calibrationIdentity?: string | null;
  internalRomIdentifiers?: readonly string[];
  identityProvenance?: readonly string[];
}): EngineeringBinaryIdentity {
  const binary = input.engineeringBinary;
  if (binary.byteLength <= 0 || binary.byteLength !== binary.bytes.byteLength) throw new Error("Engineering Binary byte identity is invalid.");
  const digest = createHash("sha256").update(binary.bytes).digest("hex");
  const identifiers = [...new Set((input.internalRomIdentifiers ?? []).map(normal).filter((value): value is string => value !== null))].sort();
  const provenance = [...new Set((input.identityProvenance ?? []).map((value) => value.trim()).filter(Boolean))].sort();
  if (identifiers.length > DEFINITION_ROM_APPLICABILITY_LIMITS.maximumInternalRomIdentifiers || provenance.length > DEFINITION_ROM_APPLICABILITY_LIMITS.maximumIdentityProvenanceItems) throw new Error("Engineering Binary identity Evidence exceeds its bounded limit.");
  return Object.freeze({
    identityId: `engineering-binary:${digest}`,
    digest,
    byteLength: binary.byteLength,
    containerType: binary.source.containerType,
    containerByteLength: binary.source.containerByteLength,
    resolutionMethod: binary.source.resolutionMethod,
    romFamily: normal(input.romFamily),
    softwareIdentity: normal(input.softwareIdentity),
    calibrationIdentity: normal(input.calibrationIdentity),
    internalRomIdentifiers: Object.freeze(identifiers),
    identityProvenance: Object.freeze(provenance),
  });
}

function scopedEvidence(evidence: readonly DefinitionRomApplicabilityEvidence[], set: DefinitionSetRevision, binary: EngineeringBinaryIdentity): DefinitionRomApplicabilityEvidence[] {
  if (evidence.length > DEFINITION_ROM_APPLICABILITY_LIMITS.maximumEvidenceItems) throw new Error("Applicability Evidence exceeds its bounded limit.");
  return evidence.map((item) => {
    if (!item.evidenceId.trim() || !item.provenance.trim() || !item.explanation.trim()) throw new Error("Applicability Evidence requires identity, provenance and explanation.");
    return freezeEvidence(item);
  }).filter((item) => (item.definitionSetRevisionId === null || item.definitionSetRevisionId === set.revisionId) && (item.binaryDigest === null || item.binaryDigest.toLowerCase() === binary.digest));
}

function result(input: Omit<DefinitionRomApplicabilityResult, "qualificationId" | "contractVersion">): DefinitionRomApplicabilityResult {
  const evidence = Object.freeze(input.evidence.map(freezeEvidence));
  const reasons = Object.freeze([...input.reasons]);
  const unresolvedConditions = Object.freeze([...input.unresolvedConditions]);
  const qualificationId = `definition-rom-qualification:${hash("tunesight.definition-rom-applicability-result.v1", { ...input, evidence, reasons, unresolvedConditions })}`;
  return Object.freeze({ ...input, qualificationId, contractVersion: "tunesight.definition-rom-applicability.v1", evidence, reasons, unresolvedConditions });
}

export function qualifyDefinitionSetApplicability(input: {
  definitionSet: DefinitionSetRevision | null;
  binaryIdentity: EngineeringBinaryIdentity | null;
  evidence?: readonly DefinitionRomApplicabilityEvidence[];
  stockVariantKnowledge?: RuntimeStockVariantKnowledgeResponse | null;
  expectedRomFamily?: string | null;
  expectedSoftwareIdentity?: string | null;
  expectedCalibrationIdentity?: string | null;
  expectedInternalRomIdentifiers?: readonly string[];
}): DefinitionRomApplicabilityResult {
  const set = input.definitionSet;
  const binary = input.binaryIdentity;
  if (!set || !binary || !validDigest(binary.digest) || set.definitionCount < 1) return result({ outcome: "invalid", definitionSetRevisionId: set?.revisionId ?? null, binaryIdentityId: binary?.identityId ?? null, binaryDigest: binary?.digest ?? null, evidence: [], stockVariantKnowledge: input.stockVariantKnowledge ?? null, reasons: ["Required Definition Set or Engineering Binary identity is invalid."], unresolvedConditions: [] });
  const evidence = scopedEvidence(input.evidence ?? [], set, binary);
  const expectedFamily = normal(input.expectedRomFamily);
  const expectedSoftware = normal(input.expectedSoftwareIdentity);
  const expectedCalibration = normal(input.expectedCalibrationIdentity);
  const expectedInternal = new Set((input.expectedInternalRomIdentifiers ?? []).map(normal).filter((value): value is string => value !== null));
  const reasons: string[] = [];
  const unresolved: string[] = [];
  const strong = (item: DefinitionRomApplicabilityEvidence) => item.strength === "authoritative" || item.strength === "qualified";
  const exactPair = evidence.find((item) => item.signal === "exact_digest_pair" && item.relationship === "supports" && strong(item) && item.definitionSetRevisionId === set.revisionId && item.binaryDigest === binary.digest);
  const provisionalPair = evidence.find((item) => (item.signal === "exact_digest_pair" || item.signal === "source_association") && item.relationship === "supports");
  const strongExclusion = evidence.find((item) => item.signal === "explicit_exclusion" && item.relationship === "supports" && strong(item));
  const strongApplicability = evidence.find((item) => item.signal === "explicit_applicability" && item.relationship === "supports" && strong(item) && item.definitionSetRevisionId === set.revisionId && item.binaryDigest === binary.digest);
  const contradictory = evidence.filter((item) => item.relationship === "contradicts" && strong(item));
  const identityMismatches = [
    expectedFamily && binary.romFamily && expectedFamily !== binary.romFamily ? `ROM Family ${binary.romFamily} conflicts with expected ${expectedFamily}.` : null,
    expectedSoftware && binary.softwareIdentity && expectedSoftware !== binary.softwareIdentity ? `Software identity ${binary.softwareIdentity} conflicts with expected ${expectedSoftware}.` : null,
    expectedCalibration && binary.calibrationIdentity && expectedCalibration !== binary.calibrationIdentity ? `Calibration identity ${binary.calibrationIdentity} conflicts with expected ${expectedCalibration}.` : null,
    expectedInternal.size > 0 && binary.internalRomIdentifiers.length > 0 && !binary.internalRomIdentifiers.some((value) => expectedInternal.has(value)) ? `Internal ROM identifiers ${binary.internalRomIdentifiers.join(", ")} conflict with the expected identifier set.` : null,
  ].filter((value): value is string => value !== null);
  const internalMatch = expectedInternal.size > 0 && binary.internalRomIdentifiers.some((value) => expectedInternal.has(value));
  const familyMatch = expectedFamily !== null && binary.romFamily === expectedFamily;
  const stock = input.stockVariantKnowledge ?? null;
  const stockResult = stock?.availability === "available" ? stock.result : null;
  const stockXdfMatch = stockResult?.variant?.xdfRelationships?.some((relationship) => [set.sourceArtifactId, set.sourceArtifactDigest, set.revisionId].includes(relationship)) ?? false;
  const stockExact = stockResult?.exactMatchEvidence.sha256Matched === true && stockResult.exactMatchEvidence.binarySizeMatched === true;

  if ((exactPair || strongApplicability || (stockResult?.status === "exact_verified" && stockExact && stockXdfMatch)) && (contradictory.length > 0 || identityMismatches.length > 0 || strongExclusion)) {
    return result({ outcome: "conflicting", definitionSetRevisionId: set.revisionId, binaryIdentityId: binary.identityId, binaryDigest: binary.digest, evidence, stockVariantKnowledge: stock, reasons: [...identityMismatches, ...contradictory.map((item) => item.explanation), ...(strongExclusion ? [strongExclusion.explanation] : [])], unresolvedConditions: ["Material positive and negative applicability Evidence disagree."] });
  }
  if (strongExclusion || (identityMismatches.length > 0 && !exactPair && !strongApplicability)) return result({ outcome: "inapplicable", definitionSetRevisionId: set.revisionId, binaryIdentityId: binary.identityId, binaryDigest: binary.digest, evidence, stockVariantKnowledge: stock, reasons: strongExclusion ? [strongExclusion.explanation, ...identityMismatches] : identityMismatches, unresolvedConditions: [] });
  if (stockResult?.status === "conflict") return result({ outcome: "conflicting", definitionSetRevisionId: set.revisionId, binaryIdentityId: binary.identityId, binaryDigest: binary.digest, evidence, stockVariantKnowledge: stock, reasons: [stockResult.explanation], unresolvedConditions: [stockResult.unresolvedReason ?? "Stock Variant Knowledge conflicts."] });
  if (exactPair || strongApplicability || (stockResult?.status === "exact_verified" && stockExact && stockXdfMatch)) {
    if (exactPair) reasons.push(exactPair.explanation);
    if (strongApplicability) reasons.push(strongApplicability.explanation);
    if (stockResult?.status === "exact_verified" && stockXdfMatch) reasons.push("Authoritative Stock Variant Knowledge binds the exact binary identity to this Definition Set source.");
    if (internalMatch) reasons.push("An exact internal ROM identifier corroborates the qualified applicability relationship.");
    return result({ outcome: "exactly_applicable", definitionSetRevisionId: set.revisionId, binaryIdentityId: binary.identityId, binaryDigest: binary.digest, evidence, stockVariantKnowledge: stock, reasons, unresolvedConditions: [] });
  }
  if (stockResult?.status === "exact_candidate" && stockExact && stockXdfMatch) reasons.push("Provisional Stock Variant Knowledge binds the exact binary identity to this Definition Set source without authoritative verification.");
  if (provisionalPair) reasons.push(provisionalPair.explanation);
  if ((stockResult?.status === "exact_candidate" && stockXdfMatch) || provisionalPair) return result({ outcome: "qualified_candidate", definitionSetRevisionId: set.revisionId, binaryIdentityId: binary.identityId, binaryDigest: binary.digest, evidence, stockVariantKnowledge: stock, reasons, unresolvedConditions: ["Exact applicability authority is incomplete."] });
  if (familyMatch || stockResult?.status === "family_only") return result({ outcome: "family_compatible", definitionSetRevisionId: set.revisionId, binaryIdentityId: binary.identityId, binaryDigest: binary.digest, evidence, stockVariantKnowledge: stock, reasons: [familyMatch ? `ROM Family ${binary.romFamily} matches the Definition Set family context.` : stockResult!.explanation], unresolvedConditions: ["Family compatibility does not prove exact software or calibration applicability."] });
  if (stock?.availability === "unavailable") unresolved.push(stock.unavailableReason);
  unresolved.push("No qualified exact, candidate or family applicability relationship is established.");
  return result({ outcome: "unknown", definitionSetRevisionId: set.revisionId, binaryIdentityId: binary.identityId, binaryDigest: binary.digest, evidence, stockVariantKnowledge: stock, reasons: ["Available Evidence is insufficient to qualify Definition Set applicability."], unresolvedConditions: unresolved });
}

export function inheritDefinitionApplicability(input: { definition: XdfDefinitionRevision; definitionSet: DefinitionSetRevision; qualification: DefinitionRomApplicabilityResult }): DefinitionApplicabilityInheritance {
  const belongs = input.definition.sourceArtifactDigest === input.definitionSet.sourceArtifactDigest && input.definitionSet.definitionSourceBindingDigests.includes(input.definition.sourceBindingDigest);
  let status: DefinitionApplicabilityInheritance["status"] = "not_exactly_applicable";
  let reason = "The Definition Set is not exactly applicable to the Engineering Binary.";
  if (!belongs) { status = "definition_invalid"; reason = "The Definition Revision does not belong to the exact qualified Definition Set revision."; }
  else if (input.definition.identity.status === "conflicting") { status = "definition_conflicting"; reason = "The Definition Revision preserves an unresolved representation conflict and cannot inherit exact applicability."; }
  else if (input.definition.identity.status !== "derived" || input.definition.qualificationState === "applicability_unresolved" && input.qualification.outcome !== "exactly_applicable") { status = "definition_invalid"; reason = "The Definition Revision identity is unresolved or invalid for inheritance."; }
  else if (input.qualification.outcome === "exactly_applicable" && input.qualification.definitionSetRevisionId === input.definitionSet.revisionId) { status = "inherited_exact"; reason = "The valid non-conflicting Definition Revision belongs to the exactly qualified Definition Set revision."; }
  return Object.freeze({ status, definitionRevisionId: input.definition.revisionId, definitionSetRevisionId: input.definitionSet.revisionId, qualificationId: input.qualification.qualificationId, reason });
}

export function assessCalibratedIntentGate(input: { qualification: DefinitionRomApplicabilityResult; inheritance: DefinitionApplicabilityInheritance; extractionSucceeded: boolean }): Readonly<{ authorised: boolean; reasons: readonly string[] }> {
  const reasons: string[] = [];
  if (input.qualification.outcome !== "exactly_applicable") reasons.push("Definition Set applicability is not exact.");
  if (input.inheritance.status !== "inherited_exact") reasons.push("Definition Revision did not inherit exact applicability.");
  if (!input.extractionSucceeded) reasons.push("Deterministic raw extraction did not succeed.");
  return Object.freeze({ authorised: reasons.length === 0, reasons: Object.freeze(reasons) });
}

export function buildMasterLibraryApplicabilityReport(input: readonly Readonly<{ outcome: DefinitionRomApplicabilityOutcome; sourceAssociationDiscovered: boolean; family: string | null }>[] ): MasterLibraryApplicabilityReport {
  if (input.length > DEFINITION_ROM_APPLICABILITY_LIMITS.maximumReportRelationships) throw new Error("Applicability report exceeds its bounded relationship limit.");
  const count = (outcome: DefinitionRomApplicabilityOutcome) => input.filter((item) => item.outcome === outcome).length;
  return Object.freeze({
    definitionSetsDiscovered: input.length,
    exactRelationships: count("exactly_applicable"), candidateRelationships: count("qualified_candidate"), familyCompatibleRelationships: count("family_compatible"), conflictingRelationships: count("conflicting"), unresolvedRelationships: count("unknown"), inapplicableRelationships: count("inapplicable"), invalidRelationships: count("invalid"),
    sourceAssociationsDiscovered: input.filter((item) => item.sourceAssociationDiscovered).length,
    familiesRepresented: Object.freeze([...new Set(input.map((item) => item.family).filter((value): value is string => Boolean(value)))].sort()),
  });
}

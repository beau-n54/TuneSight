import { createHash } from "node:crypto";
import type { CompleteBinaryValidation } from "./bmwMasterFullValidation.ts";
import type { SourceAuthorityRecord } from "./sourceAuthorityScope.ts";
import type { TableQuarantineRecord, TableQuarantineSafetyAssessment } from "./tableQuarantine.ts";

export const QUARANTINE_AWARE_APPLICABILITY_CANDIDATE_CONTRACT = "tunesight.quarantine-aware-applicability-candidate.v1" as const;

export type AcceptedQuarantineBinding = Readonly<{ quarantine: TableQuarantineRecord; safetyAssessment: TableQuarantineSafetyAssessment }>;
export type QuarantineAwareApplicabilityCandidate = Readonly<{
  candidateId: string;
  candidateRevision: string;
  contractVersion: typeof QUARANTINE_AWARE_APPLICABILITY_CANDIDATE_CONTRACT;
  romSoftwareIdentity: string;
  sourceAuthorityId: string;
  sourceAuthorityRevision: string;
  definitionSetId: string;
  definitionSetRevision: string;
  validationRevisions: readonly string[];
  quarantineRevisions: readonly string[];
  quarantineSafetyAssessmentRevisions: readonly string[];
  totalDefinitions: number;
  qualifiedDefinitions: number;
  quarantinedDefinitions: number;
  unresolvedDefinitions: number;
  representationConflicts: number;
  coverageClass: "fully_valid" | "valid_with_accepted_quarantine" | "invalid_relationship_wide";
  relationshipEligibility: "eligible_for_founder_review" | "ineligible";
  limitations: readonly string[];
  decisionState: "candidate_only_pending_founder_review";
  publicationState: "not_authorized";
  publicationSideEffects: readonly [];
}>;

type Input = Readonly<{
  sourceAuthority: SourceAuthorityRecord;
  romSoftwareIdentity: string;
  definitionSetId: string;
  definitionSetRevision: string;
  totalDefinitions: number;
  validations: readonly CompleteBinaryValidation[];
  quarantineBindings: readonly AcceptedQuarantineBinding[];
  limitations: readonly string[];
}>;

function canonical(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number") { if (!Number.isSafeInteger(value)) throw new Error("Applicability candidate contains an unsafe number."); return JSON.stringify(value); }
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (!value || typeof value !== "object") throw new Error("Applicability candidate contains unsupported material.");
  const record = value as Readonly<Record<string, unknown>>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`).join(",")}}`;
}
const digest = (domain: string, value: unknown) => createHash("sha256").update(domain).update(Buffer.from([0])).update(canonical(value)).digest("hex");
function freeze<T>(value: T): T { if (Array.isArray(value)) return Object.freeze(value.map(freeze)) as T; if (value && typeof value === "object") return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, item]) => [key, freeze(item)]))) as T; return value; }

export function constructQuarantineAwareApplicabilityCandidate(input: Input): QuarantineAwareApplicabilityCandidate {
  if (!input.romSoftwareIdentity.trim() || !Number.isSafeInteger(input.totalDefinitions) || input.totalDefinitions <= 0 || !input.validations.length) throw new Error("Applicability candidate requires an exact ROM identity, Definition count and validation Evidence.");
  const scope = input.sourceAuthority.scope.filter((item) => item.definitionSetId === input.definitionSetId && item.definitionSetRevision === input.definitionSetRevision);
  const exactScope = scope.length === 1 ? scope[0]! : null;
  const scopeValid = Boolean(exactScope);
  const validationByDigest = new Map(input.validations.map((item) => [item.binaryDigest, item]));
  const uniqueQuarantinedDefinitions = new Set<string>();
  const coveredFailures = new Map<string, number>();
  let quarantineBindingsValid = true;

  for (const binding of input.quarantineBindings) {
    const { quarantine, safetyAssessment } = binding;
    const validation = validationByDigest.get(quarantine.affectedBinary.digest);
    const exactRelationship = quarantine.relationship.romSoftwareIdentity === input.romSoftwareIdentity && quarantine.relationship.sourceArtifactId === exactScope?.sourceArtifactId && quarantine.relationship.definitionSetRevision === input.definitionSetRevision;
    const exactValidation = validation?.validationRevision === quarantine.affectedBinary.validationRevision;
    const requiredSafetyGates = new Set(["exact_occurrence", "failure_preserved", "axis_independence", "conversion_independence", "storage_non_overlap", "representation_unambiguous", "dataset_coherence"]);
    const exactSafety = safetyAssessment.outcome === "dependency_safe_for_quarantine" && safetyAssessment.assessmentRevision === quarantine.safetyAssessmentRevision && safetyAssessment.definitionRevisionId === quarantine.occurrence.definitionRevisionId && safetyAssessment.binaryDigest === quarantine.affectedBinary.digest && safetyAssessment.gates.every((gate) => gate.passed) && safetyAssessment.gates.length === requiredSafetyGates.size && safetyAssessment.gates.every((gate) => requiredSafetyGates.has(gate.gate));
    const denied = quarantine.state === "unavailable_quarantined" && !quarantine.permissions.engineeringValueValid && !quarantine.permissions.editable && !quarantine.permissions.suggestedCalibrationEligible && !quarantine.permissions.reconstructionMutationEligible && !quarantine.permissions.flashingEligible;
    const occurrenceKey = `${quarantine.affectedBinary.digest}:${quarantine.occurrence.definitionRevisionId}:${quarantine.occurrence.occurrence}`;
    const prior = coveredFailures.get(occurrenceKey) ?? 0;
    coveredFailures.set(occurrenceKey, prior + 1);
    if (!exactRelationship || !exactValidation || !exactSafety || !denied || prior > 0) quarantineBindingsValid = false;
    uniqueQuarantinedDefinitions.add(`${quarantine.occurrence.definitionRevisionId}:${quarantine.occurrence.occurrence}`);
  }

  const representationConflicts = input.validations.reduce((sum, item) => sum + item.representationConflicts, 0);
  let unresolvedDefinitions = 0;
  for (const validation of input.validations) {
    const covered = input.quarantineBindings.filter((item) => item.quarantine.affectedBinary.digest === validation.binaryDigest).length;
    const extractionValid = validation.definitions === input.totalDefinitions && validation.extractionAttempts === input.totalDefinitions && validation.extractionSuccess === input.totalDefinitions && validation.blocked === 0 && validation.outOfBounds === 0 && validation.unsupported === 0;
    const conversionAccounted = validation.converted + validation.identityNoOp + validation.invalidNumeric === input.totalDefinitions;
    if (!extractionValid || !conversionAccounted) unresolvedDefinitions += Math.max(1, input.totalDefinitions - Math.min(validation.extractionSuccess, validation.converted + validation.identityNoOp + validation.invalidNumeric));
    unresolvedDefinitions += Math.max(0, validation.invalidNumeric - covered) + validation.malformed + validation.unavailable + validation.other;
    if (covered > validation.invalidNumeric) quarantineBindingsValid = false;
  }
  if (!scopeValid || !quarantineBindingsValid) unresolvedDefinitions = Math.max(1, unresolvedDefinitions);
  const quarantinedDefinitions = uniqueQuarantinedDefinitions.size;
  const qualifiedDefinitions = Math.max(0, input.totalDefinitions - quarantinedDefinitions - unresolvedDefinitions);
  const eligible = unresolvedDefinitions === 0 && representationConflicts === 0;
  const coverageClass = !eligible ? "invalid_relationship_wide" as const : quarantinedDefinitions ? "valid_with_accepted_quarantine" as const : "fully_valid" as const;
  const identity = { romSoftwareIdentity: input.romSoftwareIdentity, sourceAuthorityId: input.sourceAuthority.authorityId, definitionSetId: input.definitionSetId };
  const material = { ...identity, sourceAuthorityRevision: input.sourceAuthority.authorityRevision, definitionSetRevision: input.definitionSetRevision, validationRevisions: input.validations.map((item) => item.validationRevision).sort(), quarantineRevisions: input.quarantineBindings.map((item) => item.quarantine.quarantineRevision).sort(), quarantineSafetyAssessmentRevisions: input.quarantineBindings.map((item) => item.safetyAssessment.assessmentRevision).sort(), totalDefinitions: input.totalDefinitions, qualifiedDefinitions, quarantinedDefinitions, unresolvedDefinitions, representationConflicts, coverageClass, relationshipEligibility: eligible ? "eligible_for_founder_review" as const : "ineligible" as const, limitations: [...new Set(input.limitations.map((item) => item.trim()).filter(Boolean))].sort(), decisionState: "candidate_only_pending_founder_review" as const, publicationState: "not_authorized" as const, publicationSideEffects: [] as const, contractVersion: QUARANTINE_AWARE_APPLICABILITY_CANDIDATE_CONTRACT };
  return freeze({ candidateId: `quarantine-aware-applicability-candidate:${digest("tunesight.quarantine-aware-applicability-candidate-identity.v1", identity)}`, candidateRevision: `quarantine-aware-applicability-candidate-revision:${digest("tunesight.quarantine-aware-applicability-candidate-revision.v1", material)}`, ...material, publicationSideEffects: Object.freeze([]) as readonly [] });
}

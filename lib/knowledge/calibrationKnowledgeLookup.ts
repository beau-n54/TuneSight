import {
  defineCalibrationKnowledgeObject,
  validateQualifiedAssertion,
  type CalibrationApplicability,
  type CalibrationKnowledgeObject,
  type GovernedVocabularyReference,
  type KnowledgeProvenanceReference,
  type QualifiedAssertion,
} from "./calibrationKnowledge.ts";
import {
  isAuthoritativeStockVariantStatus,
} from "./stockVariants.ts";

export type CalibrationKnowledgeCanonicalIdentitySelectorValue = Readonly<{
  kind: "canonical_identity";
  stableId: string;
}>;

export type CalibrationKnowledgeAliasSelectorValue = Readonly<{
  kind: "qualified_alias";
  alias: string;
}>;

export type CalibrationKnowledgeSourceReferenceSelectorValue = Readonly<{
  kind: "source_reference";
  sourceReferenceId: string;
  sourceType: GovernedVocabularyReference;
}>;

export type CalibrationKnowledgeQuerySelectorValue =
  | CalibrationKnowledgeCanonicalIdentitySelectorValue
  | CalibrationKnowledgeAliasSelectorValue
  | CalibrationKnowledgeSourceReferenceSelectorValue;

export type CalibrationKnowledgeQuerySelector =
  QualifiedAssertion<CalibrationKnowledgeQuerySelectorValue>;

export type CalibrationKnowledgeLookupContextValue = Readonly<{
  dimension: GovernedVocabularyReference;
  values: readonly string[];
}>;

export type CalibrationKnowledgeLookupContext = Readonly<{
  assertions: readonly QualifiedAssertion<CalibrationKnowledgeLookupContextValue>[];
}>;

export type CalibrationKnowledgeQuery = Readonly<{
  queryId: string;
  selectors: readonly CalibrationKnowledgeQuerySelector[];
  context: CalibrationKnowledgeLookupContext;
  contractVersion: string;
}>;

export type CalibrationKnowledgeQueryInput = Readonly<{
  queryId: string | null;
  selectors: readonly CalibrationKnowledgeQuerySelector[] | null;
  context: Readonly<{
    assertions:
      | readonly QualifiedAssertion<CalibrationKnowledgeLookupContextValue>[]
      | null;
  }> | null;
  contractVersion: string | null;
}>;

export type CalibrationKnowledgeLookupOutcome =
  | "exact_verified"
  | "exact_candidate"
  | "contextual_match"
  | "multiple_candidates"
  | "conflict"
  | "unknown"
  | "invalid"
  | "runtime_unavailable";

export type CalibrationKnowledgeMatchBasisValue = Readonly<{
  kind: GovernedVocabularyReference;
  matchScope: "exact" | "contextual";
  selectorIds: readonly string[];
  description: string;
}>;

export type CalibrationKnowledgeMatchBasis =
  QualifiedAssertion<CalibrationKnowledgeMatchBasisValue>;

export type CalibrationKnowledgeCandidate = Readonly<{
  candidateId: string;
  knowledge: CalibrationKnowledgeObject;
  matchBasis: CalibrationKnowledgeMatchBasis;
  applicabilityAssessment: QualifiedAssertion<CalibrationApplicability>;
  provenance: readonly KnowledgeProvenanceReference[];
  limitations: readonly string[];
}>;

export type CalibrationKnowledgeConflict = Readonly<{
  conflictId: string;
  summary: string;
  candidateIds: readonly string[];
  contradictoryAssertionIds: readonly string[];
  provenance: readonly KnowledgeProvenanceReference[];
  unresolvedReason: string;
}>;

type CalibrationKnowledgeLookupResultMetadata = Readonly<{
  provenance: readonly KnowledgeProvenanceReference[];
  missingContext: readonly string[];
  limitations: readonly string[];
  contractVersion: string;
}>;

type CalibrationKnowledgeLookupResultBase =
  CalibrationKnowledgeLookupResultMetadata &
    Readonly<{
      query: CalibrationKnowledgeQuery;
      candidates: readonly CalibrationKnowledgeCandidate[];
    }>;

export type CalibrationKnowledgeExactVerifiedResult =
  CalibrationKnowledgeLookupResultBase &
    Readonly<{
      outcome: "exact_verified";
      match: CalibrationKnowledgeCandidate;
      unresolvedReason: null;
    }>;

export type CalibrationKnowledgeExactCandidateResult =
  CalibrationKnowledgeLookupResultBase &
    Readonly<{
      outcome: "exact_candidate";
      match: CalibrationKnowledgeCandidate;
      unresolvedReason: string;
    }>;

export type CalibrationKnowledgeContextualMatchResult =
  CalibrationKnowledgeLookupResultBase &
    Readonly<{
      outcome: "contextual_match";
      match: CalibrationKnowledgeCandidate;
      unresolvedReason: string;
    }>;

export type CalibrationKnowledgeMultipleCandidatesResult =
  CalibrationKnowledgeLookupResultBase &
    Readonly<{
      outcome: "multiple_candidates";
      unresolvedReason: string;
    }>;

export type CalibrationKnowledgeConflictResult =
  CalibrationKnowledgeLookupResultBase &
    Readonly<{
      outcome: "conflict";
      conflicts: readonly CalibrationKnowledgeConflict[];
      unresolvedReason: string;
    }>;

export type CalibrationKnowledgeUnknownResult =
  CalibrationKnowledgeLookupResultBase &
    Readonly<{
      outcome: "unknown";
      candidates: readonly [];
      unresolvedReason: string;
    }>;

export type CalibrationKnowledgeInvalidResult =
  CalibrationKnowledgeLookupResultMetadata &
    Readonly<{
      outcome: "invalid";
      queryInput: CalibrationKnowledgeQueryInput;
      candidates: readonly [];
      validationIssues: readonly string[];
      unresolvedReason: string;
    }>;

export type CalibrationKnowledgeRuntimeUnavailableResult =
  CalibrationKnowledgeLookupResultBase &
    Readonly<{
      outcome: "runtime_unavailable";
      candidates: readonly [];
      unavailableReason: string;
      unresolvedReason: null;
    }>;

export type CalibrationKnowledgeLookupResult =
  | CalibrationKnowledgeExactVerifiedResult
  | CalibrationKnowledgeExactCandidateResult
  | CalibrationKnowledgeContextualMatchResult
  | CalibrationKnowledgeMultipleCandidatesResult
  | CalibrationKnowledgeConflictResult
  | CalibrationKnowledgeUnknownResult
  | CalibrationKnowledgeInvalidResult
  | CalibrationKnowledgeRuntimeUnavailableResult;

export type CalibrationKnowledgeReader = Readonly<{
  lookup: (
    query: CalibrationKnowledgeQuery
  ) => Promise<CalibrationKnowledgeLookupResult>;
}>;

function requireNonBlank(value: string, field: string): void {
  if (!value.trim()) throw new Error(`${field} is required.`);
}

function validateStringList(values: readonly string[], field: string): void {
  values.forEach((value) => requireNonBlank(value, field));
}

function validateProvenance(
  provenance: readonly KnowledgeProvenanceReference[],
  field: string
): void {
  provenance.forEach((item) => {
    requireNonBlank(item.sourceType, `${field} provenance source type`);
    requireNonBlank(
      item.sourceIdentifier,
      `${field} provenance source identifier`
    );
  });
}

function validateQuery(query: CalibrationKnowledgeQuery): void {
  requireNonBlank(query.queryId, "Calibration Knowledge query identity");
  requireNonBlank(query.contractVersion, "Calibration Knowledge query version");

  if (query.selectors.length === 0) {
    throw new Error("Calibration Knowledge query requires a usable selector.");
  }

  const selectorIds = new Set<string>();
  query.selectors.forEach((selector) => {
    validateQualifiedAssertion(selector, "Query selector");
    if (selectorIds.has(selector.assertionId)) {
      throw new Error(`Query selector identity ${selector.assertionId} is duplicated.`);
    }
    selectorIds.add(selector.assertionId);

    if (!selector.value) {
      throw new Error("Calibration Knowledge query requires a usable selector.");
    }

    switch (selector.value.kind) {
      case "canonical_identity":
        requireNonBlank(selector.value.stableId, "Canonical calibration identity");
        break;
      case "qualified_alias":
        requireNonBlank(selector.value.alias, "Qualified alias");
        break;
      case "source_reference":
        requireNonBlank(
          selector.value.sourceReferenceId,
          "Source reference identity"
        );
        validateQualifiedAssertion(selector, "Source-reference selector", [
          selector.value.sourceType,
        ]);
        break;
      default: {
        const exhaustiveSelector: never = selector.value;
        throw new Error(`Unsupported query selector: ${exhaustiveSelector}`);
      }
    }
  });

  const contextIds = new Set<string>();
  query.context.assertions.forEach((context) => {
    if (!context.value) {
      throw new Error("Lookup context requires a qualified context value.");
    }
    validateQualifiedAssertion(context, "Lookup context", [
      context.value.dimension,
    ]);
    if (contextIds.has(context.assertionId)) {
      throw new Error(`Lookup context identity ${context.assertionId} is duplicated.`);
    }
    contextIds.add(context.assertionId);
    if (context.value.values.length === 0) {
      throw new Error("Lookup context requires at least one dimension value.");
    }
    validateStringList(context.value.values, "Lookup context value");
  });
}

function validateCandidate(
  candidate: CalibrationKnowledgeCandidate,
  selectorIds: ReadonlySet<string>
): void {
  requireNonBlank(candidate.candidateId, "Candidate identity");
  defineCalibrationKnowledgeObject(candidate.knowledge);
  requireNonBlank(
    candidate.knowledge.identity.value?.stableId ?? "",
    "Candidate canonical identity"
  );
  validateProvenance(candidate.provenance, "Candidate");
  validateStringList(candidate.limitations, "Candidate limitation");

  const basis = candidate.matchBasis.value;
  if (!basis) throw new Error("Candidate requires a qualified match basis.");
  validateQualifiedAssertion(candidate.matchBasis, "Match basis", [basis.kind]);
  const applicability = candidate.applicabilityAssessment.value;
  if (!applicability) {
    throw new Error("Candidate requires a qualified applicability assessment.");
  }
  validateQualifiedAssertion(
    candidate.applicabilityAssessment,
    "Applicability assessment",
    [applicability.scope]
  );
  requireNonBlank(basis.description, "Match-basis description");
  if (basis.selectorIds.length === 0) {
    throw new Error("Match basis requires at least one query selector identity.");
  }
  basis.selectorIds.forEach((selectorId) => {
    requireNonBlank(selectorId, "Match-basis selector identity");
    if (!selectorIds.has(selectorId)) {
      throw new Error(
        `Match-basis selector ${selectorId} is not present in the query.`
      );
    }
  });
}

function validateCommonResult(result: CalibrationKnowledgeLookupResult): void {
  requireNonBlank(result.contractVersion, "Calibration Knowledge result version");
  validateProvenance(result.provenance, "Lookup result");
  validateStringList(result.missingContext, "Missing context");
  validateStringList(result.limitations, "Result limitation");

  if (result.outcome === "invalid") {
    if (result.candidates.length !== 0) {
      throw new Error("invalid cannot preserve candidate data.");
    }
    return;
  }

  validateQuery(result.query);

  const selectorIds = new Set(
    result.query.selectors.map((selector) => selector.assertionId)
  );
  const candidateIds = new Set<string>();
  result.candidates.forEach((candidate) => {
    validateCandidate(candidate, selectorIds);
    if (candidateIds.has(candidate.candidateId)) {
      throw new Error(`Candidate identity ${candidate.candidateId} is duplicated.`);
    }
    candidateIds.add(candidate.candidateId);
  });
}

function candidatesMateriallyMatch(
  left: CalibrationKnowledgeCandidate,
  right: CalibrationKnowledgeCandidate
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function validateExactVerified(
  result: CalibrationKnowledgeExactVerifiedResult
): void {
  if (
    result.candidates.length !== 1 ||
    !candidatesMateriallyMatch(result.candidates[0], result.match)
  ) {
    throw new Error("exact_verified requires one preserved canonical match.");
  }

  if (result.match.matchBasis.value?.matchScope !== "exact") {
    throw new Error("exact_verified requires an exact qualified match basis.");
  }

  const statuses = [
    result.match.knowledge.identity.verificationStatus,
    result.match.matchBasis.verificationStatus,
    result.match.applicabilityAssessment.verificationStatus,
  ];

  if (!statuses.every(isAuthoritativeStockVariantStatus)) {
    throw new Error(
      "exact_verified requires authoritative candidate, identity, match-basis, and applicability verification."
    );
  }
}

function validateSingleQualifiedMatch(
  result:
    | CalibrationKnowledgeExactCandidateResult
    | CalibrationKnowledgeContextualMatchResult
): void {
  if (
    result.candidates.length !== 1 ||
    !candidatesMateriallyMatch(result.candidates[0], result.match)
  ) {
    throw new Error(`${result.outcome} requires one preserved candidate match.`);
  }
  requireNonBlank(result.unresolvedReason, `${result.outcome} unresolved reason`);

  const requiredScope =
    result.outcome === "contextual_match" ? "contextual" : "exact";
  if (result.match.matchBasis.value?.matchScope !== requiredScope) {
    throw new Error(
      `${result.outcome} requires a ${requiredScope} qualified match basis.`
    );
  }

  if (
    result.outcome === "exact_candidate" &&
    [
      result.match.knowledge.identity.verificationStatus,
      result.match.matchBasis.verificationStatus,
      result.match.applicabilityAssessment.verificationStatus,
    ].every(isAuthoritativeStockVariantStatus)
  ) {
    throw new Error(
      "exact_candidate cannot contain a fully authoritative exact match."
    );
  }
}

function validateOutcome(result: CalibrationKnowledgeLookupResult): void {
  switch (result.outcome) {
    case "exact_verified":
      validateExactVerified(result);
      break;
    case "exact_candidate":
    case "contextual_match":
      validateSingleQualifiedMatch(result);
      break;
    case "multiple_candidates":
      if (result.candidates.length < 2) {
        throw new Error("multiple_candidates requires at least two candidates.");
      }
      requireNonBlank(result.unresolvedReason, "Multiple-candidate unresolved reason");
      break;
    case "conflict": {
      if (result.candidates.length < 2 || result.conflicts.length === 0) {
        throw new Error(
          "conflict requires contradictory candidates and conflict details."
        );
      }
      const candidateIds = new Set(
        result.candidates.map((candidate) => candidate.candidateId)
      );
      result.conflicts.forEach((conflict) => {
        requireNonBlank(conflict.conflictId, "Conflict identity");
        requireNonBlank(conflict.summary, "Conflict summary");
        requireNonBlank(conflict.unresolvedReason, "Conflict unresolved reason");
        validateProvenance(conflict.provenance, "Conflict");
        if (conflict.candidateIds.length < 2) {
          throw new Error("Conflict must preserve contradictory candidate identities.");
        }
        if (new Set(conflict.candidateIds).size !== conflict.candidateIds.length) {
          throw new Error("Conflict candidate identities must be unique.");
        }
        conflict.candidateIds.forEach((candidateId) => {
          if (!candidateIds.has(candidateId)) {
            throw new Error(
              `Conflict candidate ${candidateId} is not preserved by the result.`
            );
          }
        });
        if (conflict.contradictoryAssertionIds.length === 0) {
          throw new Error(
            "Conflict requires at least one contradictory assertion identity."
          );
        }
        if (
          new Set(conflict.contradictoryAssertionIds).size !==
          conflict.contradictoryAssertionIds.length
        ) {
          throw new Error("Contradictory assertion identities must be unique.");
        }
        validateStringList(
          conflict.contradictoryAssertionIds,
          "Contradictory assertion identity"
        );
      });
      requireNonBlank(result.unresolvedReason, "Conflict unresolved reason");
      break;
    }
    case "unknown":
      if (result.candidates.length !== 0) {
        throw new Error("unknown cannot preserve candidate data.");
      }
      requireNonBlank(result.unresolvedReason, "Unknown-result reason");
      break;
    case "invalid":
      if (result.candidates.length !== 0) {
        throw new Error("invalid cannot preserve candidate data.");
      }
      if (result.validationIssues.length === 0) {
        throw new Error("invalid requires at least one validation issue.");
      }
      validateStringList(result.validationIssues, "Validation issue");
      requireNonBlank(result.unresolvedReason, "Invalid-result reason");
      break;
    case "runtime_unavailable":
      if (result.candidates.length !== 0) {
        throw new Error("runtime_unavailable cannot preserve candidate data.");
      }
      requireNonBlank(result.unavailableReason, "Runtime-unavailable reason");
      break;
    default: {
      const exhaustiveOutcome: never = result;
      throw new Error(`Unsupported lookup result: ${exhaustiveOutcome}`);
    }
  }
}

function cloneAndFreeze<T>(value: T): T {
  if (Array.isArray(value)) {
    return Object.freeze(value.map((item) => cloneAndFreeze(item))) as T;
  }
  if (value !== null && typeof value === "object") {
    const clone: Record<PropertyKey, unknown> = {};
    for (const key of Reflect.ownKeys(value)) {
      clone[key] = cloneAndFreeze(
        (value as Record<PropertyKey, unknown>)[key]
      );
    }
    return Object.freeze(clone) as T;
  }
  return value;
}

export function defineCalibrationKnowledgeQuery(
  input: CalibrationKnowledgeQuery
): CalibrationKnowledgeQuery {
  validateQuery(input);
  return cloneAndFreeze(input);
}

export function defineCalibrationKnowledgeLookupResult<
  TResult extends CalibrationKnowledgeLookupResult,
>(input: TResult): TResult {
  validateCommonResult(input);
  validateOutcome(input);
  return cloneAndFreeze(input);
}

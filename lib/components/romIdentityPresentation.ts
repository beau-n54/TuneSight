const KNOWLEDGE_OUTCOME_PREFIX =
  "Qualified Stock Variant Knowledge outcome: ";

const KNOWLEDGE_OUTCOME_LABELS = {
  exact_verified: "Stock",
  exact_candidate: "Stock Candidate",
  family_only: "Family Match",
  conflict: "Conflict",
  unknown: "Unknown",
  invalid: "Invalid",
  runtime_unavailable: "Runtime Unavailable",
} as const;

const LEGACY_VERIFIED_STOCK_EVIDENCE =
  "Uploaded binary exactly matches a verified stock library reference.";

const EXACT_CANDIDATE_WARNING =
  "Exact binary knowledge exists but is not authoritatively verified.";

type KnowledgeOutcome =
  keyof typeof KNOWLEDGE_OUTCOME_LABELS;

function extractKnowledgeOutcome(
  evidence: readonly string[]
): KnowledgeOutcome | null {
  for (const item of evidence) {
    if (!item.startsWith(KNOWLEDGE_OUTCOME_PREFIX)) {
      continue;
    }

    const outcome = item
      .slice(KNOWLEDGE_OUTCOME_PREFIX.length)
      .replace(/\.$/, "");

    if (outcome in KNOWLEDGE_OUTCOME_LABELS) {
      return outcome as KnowledgeOutcome;
    }
  }

  return null;
}

export function formatPresentedBinaryType(input: {
  binaryType: string | null;
  evidence: readonly string[];
}): string | null {
  const knowledgeOutcome =
    extractKnowledgeOutcome(input.evidence);

  if (knowledgeOutcome) {
    return KNOWLEDGE_OUTCOME_LABELS[
      knowledgeOutcome
    ];
  }

  switch (input.binaryType) {
    case "stock":
      return "Stock Reference";

    case "mapswitch":
      return "Map-Switch Binary";

    case "modified":
      return "Modified Binary";

    default:
      return input.binaryType;
  }
}

export function formatPresentedEvidence(
  evidence: readonly string[]
): string[] {
  const knowledgeOutcome =
    extractKnowledgeOutcome(evidence);

  if (knowledgeOutcome !== "exact_candidate") {
    return [...evidence];
  }

  return evidence.map((item) =>
    item === LEGACY_VERIFIED_STOCK_EVIDENCE
      ? "Uploaded binary exactly matches a provisional stock library reference."
      : item
  );
}

export function formatPresentedWarnings(input: {
  evidence: readonly string[];
  warnings: readonly string[];
}): string[] {
  const knowledgeOutcome =
    extractKnowledgeOutcome(input.evidence);

  if (knowledgeOutcome !== "exact_candidate") {
    return [...input.warnings];
  }

  return input.warnings.map((warning) =>
    warning === EXACT_CANDIDATE_WARNING
      ? "This binary exactly matches a known Stock Variant but has not yet completed authoritative verification."
      : warning
  );
}

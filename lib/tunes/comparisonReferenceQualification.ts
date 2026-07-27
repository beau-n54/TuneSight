import type {
  RuntimeStockVariantKnowledgeResponse,
} from "../knowledge/runtimeStockVariantKnowledge";
import type {
  StockVariantLookupStatus,
} from "../knowledge/stockVariants";
import type {
  BinaryClassification,
} from "./binaryClassification";

export type ComparisonReferenceKnowledgeOutcome =
  | StockVariantLookupStatus
  | "runtime_unavailable";

export type ComparisonReferenceQualification =
  Readonly<{
    outcome:
      ComparisonReferenceKnowledgeOutcome;
    referenceClassification:
      BinaryClassification;
    knowledge:
      RuntimeStockVariantKnowledgeResponse;
    explanation: string;
  }>;

export function qualifyComparisonReference(
  knowledge:
    RuntimeStockVariantKnowledgeResponse
): ComparisonReferenceQualification {
  if (knowledge.availability === "unavailable") {
    return Object.freeze({
      outcome: "runtime_unavailable",
      referenceClassification: "unknown",
      knowledge,
      explanation:
        knowledge.unavailableReason,
    });
  }

  const { result } = knowledge;

  return Object.freeze({
    outcome: result.status,
    referenceClassification:
      result.status === "exact_verified"
        ? "stock"
        : "unknown",
    knowledge,
    explanation:
      result.explanation,
  });
}

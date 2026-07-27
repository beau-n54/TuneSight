import type {
  StockVariantLookupInput,
  StockVariantLookupResult,
  StockVariantRegistry,
} from "./stockVariants";

export type RuntimeStockVariantKnowledgeResponse =
  | Readonly<{
      availability: "available";
      result: StockVariantLookupResult;
      unavailableReason: null;
    }>
  | Readonly<{
      availability: "unavailable";
      result: null;
      unavailableReason: string;
    }>;

export function requestRuntimeStockVariantKnowledge(input: {
  registry: StockVariantRegistry | null;
  lookup: StockVariantLookupInput;
}): RuntimeStockVariantKnowledgeResponse {
  if (!input.registry) {
    return Object.freeze({
      availability: "unavailable",
      result: null,
      unavailableReason:
        "The runtime Stock Variant Knowledge snapshot is unavailable.",
    });
  }

  return Object.freeze({
    availability: "available",
    result: input.registry.lookup(input.lookup),
    unavailableReason: null,
  });
}

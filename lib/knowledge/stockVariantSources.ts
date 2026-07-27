import {
  createStockVariantRegistry,
  isAuthoritativeStockVariantStatus,
} from "./stockVariants.ts";
import type {
  StockVariantKnowledge,
  StockVariantRegistry,
} from "./stockVariants.ts";

export function buildStockVariantKnowledgeRegistry(input: {
  authoritativeVariants:
    readonly StockVariantKnowledge[];
  provisionalVariants:
    readonly StockVariantKnowledge[];
}): StockVariantRegistry {
  for (const variant of input.authoritativeVariants) {
    if (
      !isAuthoritativeStockVariantStatus(
        variant.verificationStatus
      )
    ) {
      throw new Error(
        `Authoritative Stock Variant source contains non-authoritative record ${variant.id}.`
      );
    }
  }

  for (const variant of input.provisionalVariants) {
    if (
      isAuthoritativeStockVariantStatus(
        variant.verificationStatus
      )
    ) {
      throw new Error(
        `Provisional Stock Variant source contains authoritative record ${variant.id}.`
      );
    }
  }

  return createStockVariantRegistry([
    ...input.authoritativeVariants,
    ...input.provisionalVariants,
  ]);
}

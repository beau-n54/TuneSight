import {
  createStockVariantRegistry,
  isAuthoritativeStockVariantStatus,
} from "./stockVariants.ts";
import type { StockVariantKnowledge } from "./stockVariants.ts";

/**
 * Admits a source-controlled set of approved authoritative records.
 *
 * Registry construction performs the complete Stock Variant contract
 * validation and returns deeply frozen records. Source-role validation
 * prevents workflow candidates from entering the authoritative source.
 */
export function defineAuthoritativeStockVariants(
  records: readonly StockVariantKnowledge[]
): readonly StockVariantKnowledge[] {
  for (const record of records) {
    if (
      !isAuthoritativeStockVariantStatus(
        record.verificationStatus
      )
    ) {
      throw new Error(
        `Authoritative Stock Variant source contains non-authoritative record ${record.id}.`
      );
    }
  }

  return createStockVariantRegistry(
    records
  ).variants;
}

/**
 * Canonical production source for authoritatively verified Stock Variants.
 *
 * The repository currently contains no exact Stock binary record with
 * sufficient verified provenance for authoritative registration.
 * Records shall be added only through a separately authorised evidence
 * review; legacy catalogue entries remain provisional.
 */
export const AUTHORITATIVE_STOCK_VARIANTS:
  readonly StockVariantKnowledge[] =
  defineAuthoritativeStockVariants([]);

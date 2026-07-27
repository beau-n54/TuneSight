import { scanLibrary } from "./libraryScanner.ts";
import { buildRomLibrary } from "./libraryBuilder.ts";
import { summariseRomLibrary } from "./librarySummary.ts";
import { buildLegacyStockVariantRegistry } from "../knowledge/legacyRomLibraryAdapter.ts";
import { AUTHORITATIVE_STOCK_VARIANTS } from "../knowledge/authoritativeStockVariants.ts";
import { buildStockVariantKnowledgeRegistry } from "../knowledge/stockVariantSources.ts";

export function loadRomLibrary(root: string) {
  const files = scanLibrary(root);
  const library = buildRomLibrary(files);
  const summary = summariseRomLibrary(library);
  const provisionalStockVariantRegistry = buildLegacyStockVariantRegistry({
    files,
    library,
    libraryRoot: root,
  });
  const stockVariantRegistry = buildStockVariantKnowledgeRegistry({
    authoritativeVariants: AUTHORITATIVE_STOCK_VARIANTS,
    provisionalVariants: provisionalStockVariantRegistry.variants,
  });

  return {
    files,
    library,
    summary,
    stockVariantRegistry,
  };
}

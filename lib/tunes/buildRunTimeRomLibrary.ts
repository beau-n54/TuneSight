import { setRuntimeRomKnowledgeSnapshot } from "./libraryCache";
import { loadRomLibrary } from "./loadRomLibrary";

export function buildRuntimeRomLibrary(root: string) {
  const snapshot = loadRomLibrary(root);

  setRuntimeRomKnowledgeSnapshot({
    library: snapshot.library,
    stockVariantRegistry: snapshot.stockVariantRegistry,
  });

  return {
    ...snapshot.summary,
    stockVariantKnowledge: {
      totalVariants: snapshot.stockVariantRegistry.variants.length,
    },
  };
}

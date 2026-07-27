import { RomLibraryEntry } from "./romLibrary";
import type {
  StockVariantLookupInput,
  StockVariantRegistry,
} from "../knowledge/stockVariants";
import {
  requestRuntimeStockVariantKnowledge,
  type RuntimeStockVariantKnowledgeResponse,
} from "../knowledge/runtimeStockVariantKnowledge";

let library: RomLibraryEntry[] = [];
let stockVariantRegistry: StockVariantRegistry | null = null;
let loaded = false;

export function setLibrary(entries: RomLibraryEntry[]) {
  library = entries;
  stockVariantRegistry = null;
  loaded = true;
}

export function setRuntimeRomKnowledgeSnapshot(input: {
  library: RomLibraryEntry[];
  stockVariantRegistry: StockVariantRegistry;
}) {
  library = input.library;
  stockVariantRegistry = input.stockVariantRegistry;
  loaded = true;
}

export function getLibrary(): RomLibraryEntry[] {
  return library;
}

export function getStockVariantKnowledgeSnapshot(): StockVariantRegistry | null {
  return stockVariantRegistry;
}

export function lookupRuntimeStockVariantKnowledge(
  input: StockVariantLookupInput
): RuntimeStockVariantKnowledgeResponse {
  return requestRuntimeStockVariantKnowledge({
    registry: stockVariantRegistry,
    lookup: input,
  });
}

export function hasLibrary(): boolean {
  return loaded;
}

export function clearLibrary() {
  library = [];
  stockVariantRegistry = null;
  loaded = false;
}

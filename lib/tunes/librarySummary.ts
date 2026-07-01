import { RomLibraryEntry } from "./romLibrary";

export type RomLibrarySummary = {
  totalEntries: number;
  platforms: string[];
  ecus: string[];
  romFamilies: string[];
  entriesWithXdf: number;
  entriesWithStockBin: number;
  entriesWithMapSwitchBin: number;
};

export function summariseRomLibrary(
  library: RomLibraryEntry[]
): RomLibrarySummary {
  return {
    totalEntries: library.length,
    platforms: [...new Set(library.map((entry) => entry.platform))].sort(),
    ecus: [...new Set(library.map((entry) => entry.ecu))].sort(),
    romFamilies: [...new Set(library.map((entry) => entry.romFamily))].sort(),
    entriesWithXdf: library.filter((entry) => entry.xdfSuggested).length,
    entriesWithStockBin: library.filter((entry) => entry.stockBinSuggested).length,
    entriesWithMapSwitchBin: library.filter((entry) => entry.mapSwitchBinSuggested)
      .length,
  };
}
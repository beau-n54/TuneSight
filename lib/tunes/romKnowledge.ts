import { RomLibraryEntry } from "./romLibrary";

export type RomKnowledge = {
  generatedAt: string;
  totalRomFamilies: number;
  totalPlatforms: number;
  totalEcus: number;
  library: RomLibraryEntry[];
};

export function buildKnowledge(
  library: RomLibraryEntry[]
): RomKnowledge {
  return {
    generatedAt: new Date().toISOString(),
    totalRomFamilies: new Set(
      library.map((r) => r.romFamily)
    ).size,
    totalPlatforms: new Set(
      library.map((r) => r.platform)
    ).size,
    totalEcus: new Set(
      library.map((r) => r.ecu)
    ).size,
    library,
  };
}
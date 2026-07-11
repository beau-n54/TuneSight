import path from "path";
import { LibraryFile } from "./libraryScanner";
import { RomLibraryEntry } from "./romLibrary";

type WorkingEntry = RomLibraryEntry & {
  score: number;
};

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function detectPlatformsFromText(text: string): string[] {
  const upper = text.toUpperCase();
  const platforms: string[] = [];

  if (upper.includes("B58GEN2") || upper.includes("B58 GEN2") || upper.includes("B58 GEN 2") || upper.includes("B58TU")) {
    platforms.push("B58 Gen2");
  } else if (upper.includes("B58GEN1") || upper.includes("B58 GEN1") || upper.includes("B58 GEN 1") || upper.includes("B58")) {
    platforms.push("B58 Gen1");
  }

  if (upper.includes("N20")) platforms.push("N20");
  if (upper.includes("N13")) platforms.push("N13");
  if (upper.includes("S55")) platforms.push("S55");
  if (upper.includes("S58")) platforms.push("S58");
  if (upper.includes("S63")) platforms.push("S63");
  if (upper.includes("N55")) platforms.push("N55");
  if (upper.includes("N54")) platforms.push("N54");

  return unique(platforms);
}

function inferPlatforms(file: LibraryFile): string[] {
  const filePlatforms = detectPlatformsFromText(file.fileName);

  if (filePlatforms.length > 0) return filePlatforms;

  const pathPlatforms = detectPlatformsFromText(file.fullPath);

  return pathPlatforms.length > 0 ? pathPlatforms : ["Unknown"];
}

function inferEngineFamily(platform: string): string {
  if (platform === "B58 Gen2") return "B58TU";
  if (platform === "B58 Gen1") return "B58";
  return platform === "Unknown" ? "Unknown" : platform;
}

function inferEcuFromText(text: string): string {
  const haystack = text.toUpperCase();

  if (haystack.includes("MG1CS201")) return "MG1CS201";
  if (haystack.includes("MG1CS003")) return "MG1CS003";
  if (haystack.includes("MG1CS024")) return "MG1CS024";
  if (haystack.includes("MG1CS011")) return "MG1CS011";
  if (haystack.includes("MG1CS002")) return "MG1CS002";
  if (haystack.includes("MG1CS")) return "MG1CS";

  if (haystack.includes("MG1")) return "MG1";
  if (haystack.includes("MD1")) return "MD1";

  if (haystack.includes("MSD87")) return "MSD87";
  if (haystack.includes("MSD85")) return "MSD85";
  if (haystack.includes("MSD81")) return "MSD81";
  if (haystack.includes("MSD80")) return "MSD80";

  if (haystack.includes("MEVD172G")) return "MEVD17.2.G";
  if (haystack.includes("MEVD1726")) return "MEVD17.2.6";
  if (haystack.includes("MEVD172")) return "MEVD17.2";
  if (haystack.includes("MEVD17")) return "MEVD17";

  if (haystack.includes("DME_86T0")) return "MG1CS201";
  if (haystack.includes("86T0")) return "MG1CS201";
  if (haystack.includes("86T1")) return "MG1CS201";
  if (haystack.includes("98G0B")) return "MG1CS201";

  return "Unknown";
}

function inferDefaultEcuFromPlatform(platform: string): string {
  if (platform === "N54") return "MSD80/MSD81";
  if (platform === "N55") return "MEVD17.2";
  if (platform === "N20") return "MEVD17.2";
  if (platform === "N13") return "MEVD17.2";
  if (platform === "B58 Gen1") return "MG1";
  if (platform === "B58 Gen2") return "MG1CS201";
  if (platform === "S55") return "MEVD17.2.G";
  if (platform === "S58") return "MG1CS201";
  if (platform === "S63") return "MEVD17/MG1";

  return "Unknown";
}

function normaliseRomFamily(fileName: string): string {
  return path
    .basename(fileName, path.extname(fileName))
    .replace(/[\s_-]*(stock|original|ori|mapswitch|map switch|map_switch)[\s_-]*/gi, "")
    .trim();
}

function makeKey(platform: string, romFamily: string): string {
  return `${platform}::${romFamily.toUpperCase()}`;
}

export function buildRomLibrary(files: LibraryFile[]): RomLibraryEntry[] {
  const entries = new Map<string, WorkingEntry>();

  for (const file of files) {
    if (
      file.category !== "xdf" &&
      file.category !== "stockBin" &&
      file.category !== "mapSwitch" &&
      file.category !== "bin"
    ) {
      continue;
    }

    const romFamily = normaliseRomFamily(file.fileName);
    if (!romFamily) continue;

    const platforms = inferPlatforms(file);

    for (const platform of platforms) {
      const key = makeKey(platform, romFamily);
      const engineFamily = inferEngineFamily(platform);

      const detectedEcu = inferEcuFromText(`${file.fullPath} ${file.fileName}`);
      const ecu =
        detectedEcu !== "Unknown"
          ? detectedEcu
          : inferDefaultEcuFromPlatform(platform);

      const existing = entries.get(key);

      const entry: WorkingEntry =
        existing ?? {
          platform,
          ecu,
          romFamily,
          engineFamily,
          xdfSuggested: null,
          stockBinSuggested: null,
          mapSwitchBinSuggested: null,
          markers: [],
          score: 0,
        };

      if (entry.ecu === "Unknown" && ecu !== "Unknown") {
        entry.ecu = ecu;
      }

      if (file.category === "xdf") {
        entry.xdfSuggested = entry.xdfSuggested ?? file.fileName;
        entry.score += 3;
      }

      if (file.category === "stockBin") {
        entry.stockBinSuggested = entry.stockBinSuggested ?? file.fileName;
        entry.score += 2;
      }

      if (file.category === "bin") {
        entry.stockBinSuggested = entry.stockBinSuggested ?? file.fileName;
        entry.score += 1;
      }

      if (file.category === "mapSwitch") {
        entry.mapSwitchBinSuggested = entry.mapSwitchBinSuggested ?? file.fileName;
        entry.score += 2;
      }

      entry.markers = unique([
        ...entry.markers,
        romFamily,
        platform,
        engineFamily,
        entry.ecu,
      ]).filter((value) => value !== "Unknown");

      entries.set(key, entry);
    }
  }

 return [...entries.values()]
  .sort((a, b) => {
    if (a.platform !== b.platform) {
      return a.platform.localeCompare(b.platform);
    }

    return a.romFamily.localeCompare(b.romFamily);
  })
  .map(({ score, ...entry }) => ({
    ...entry,
    hasXdf: !!entry.xdfSuggested,
    hasStockBin: !!entry.stockBinSuggested,
    hasMapSwitchBin: !!entry.mapSwitchBinSuggested,
    libraryEvidenceScore: score,
    stockBinaryHash: null,
    stockBinarySizeBytes: null,
  }));
}
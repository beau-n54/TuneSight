import { ROM_LIBRARY, RomLibraryEntry } from "./romLibrary";

export type RomFingerprintResult = {
  platform: string | null;
  ecu: string | null;
  romFamily: string | null;
  binaryType: "stock" | "mapswitch" | "modified" | "unknown";
  xdfSuggested: string | null;
  stockBinSuggested: string | null;
  mapSwitchBinSuggested: string | null;
  confidence: number;
  evidence: string[];
  warnings: string[];
};

export function fingerprintRom(input: {
  fileName?: string | null;
  binarySizeBytes?: number | null;
  printableStrings?: string[] | null;
  library?: RomLibraryEntry[];
}): RomFingerprintResult {
  const library = input.library ?? ROM_LIBRARY;

  const fileName = input.fileName ?? "";
  const binarySizeBytes = input.binarySizeBytes ?? null;
  const printableStrings = input.printableStrings ?? [];

  const haystack = [fileName, ...printableStrings].join(" ").toUpperCase();

  const evidence: string[] = [];
  const warnings: string[] = [];

  let bestMatch: RomLibraryEntry | null = null;
  let bestScore = 0;

  for (const pattern of library) {
    let score = 0;

    for (const marker of pattern.markers) {
      if (haystack.includes(marker.toUpperCase())) {
        score += 1;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = pattern;
    }
  }

  let binaryType: RomFingerprintResult["binaryType"] = "unknown";
  const upperFileName = fileName.toUpperCase();

  if (upperFileName.includes("ORIGINAL") || upperFileName.includes("STOCK")) {
    binaryType = "stock";
    evidence.push("Filename suggests stock/original binary.");
  } else if (
    upperFileName.includes("MAPSWITCH") ||
    upperFileName.includes("MAP_SWITCH") ||
    upperFileName.includes("MAP SWITCH")
  ) {
    binaryType = "mapswitch";
    evidence.push("Filename suggests map-switch base binary.");
  } else if (upperFileName.endsWith(".BIN")) {
    binaryType = "modified";
    evidence.push("Filename suggests raw ECU binary.");
  }

  if (binarySizeBytes !== null) {
    evidence.push(`Binary size: ${binarySizeBytes} bytes.`);

    if (binarySizeBytes === 2097152) {
      evidence.push("Binary size matches common 2MB MSD8x full binary size.");
    }
  }

  if (!bestMatch) {
    warnings.push("No strong ROM marker match found.");
  } else {
    evidence.push(
      `Matched ${bestMatch.romFamily} using ${bestScore} marker(s).`
    );
  }

  const confidence = bestMatch
    ? Math.min(0.95, 0.45 + bestScore * 0.2)
    : 0.2;

  return {
    platform: bestMatch?.platform ?? null,
    ecu: bestMatch?.ecu ?? null,
    romFamily: bestMatch?.romFamily ?? null,
    binaryType,
    xdfSuggested: bestMatch?.xdfSuggested ?? null,
    confidence,
    evidence,
    warnings,
    stockBinSuggested: bestMatch?.stockBinSuggested ?? null,
    mapSwitchBinSuggested: bestMatch?.mapSwitchBinSuggested ?? null,
  };
}
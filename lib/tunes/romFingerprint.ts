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

type ScoredMatch = {
  entry: RomLibraryEntry;
  score: number;
  matchedMarkers: string[];
};

function normalise(value: string): string {
  return value.trim().toUpperCase();
}

function markerWeight(
  marker: string,
  entry: RomLibraryEntry
): number {
  const normalisedMarker = normalise(marker);

  if (normalisedMarker === normalise(entry.romFamily)) {
    return 6;
  }

  if (normalisedMarker === normalise(entry.ecu)) {
    return 3;
  }

  if (normalisedMarker === normalise(entry.platform)) {
    return 2;
  }

  if (normalisedMarker === normalise(entry.engineFamily)) {
    return 2;
  }

  return 1;
}

function calculateConfidence(
  match: ScoredMatch | null
): number {
  if (!match) {
    return 0.2;
  }

  const { entry, matchedMarkers } = match;

  const matchedValues = matchedMarkers.map(normalise);

  const romFamilyMatched = matchedValues.includes(
    normalise(entry.romFamily)
  );

  const ecuMatched = matchedValues.includes(
    normalise(entry.ecu)
  );

  const platformMatched =
    matchedValues.includes(normalise(entry.platform)) ||
    matchedValues.includes(normalise(entry.engineFamily));

  let confidence = 0.45;

  if (romFamilyMatched) {
    confidence += 0.35;
  }

  if (ecuMatched) {
    confidence += 0.08;
  }

  if (platformMatched) {
    confidence += 0.04;
  }

  if (entry.hasXdf) {
    confidence += 0.03;
  }

  if (entry.hasStockBin) {
    confidence += 0.02;
  }

  if (entry.hasMapSwitchBin) {
    confidence += 0.01;
  }

  if (!romFamilyMatched) {
    confidence = Math.min(confidence, 0.75);
  }

  return Math.min(0.98, confidence);
}

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

  const haystack = normalise(
    [fileName, ...printableStrings].join(" ")
  );

  const evidence: string[] = [];
  const warnings: string[] = [];

  const scoredMatches: ScoredMatch[] = [];

  for (const entry of library) {
    const matchedMarkers = entry.markers.filter((marker) =>
      haystack.includes(normalise(marker))
    );

    const score = matchedMarkers.reduce(
      (total, marker) =>
        total + markerWeight(marker, entry),
      0
    );

    if (score > 0) {
      scoredMatches.push({
        entry,
        score,
        matchedMarkers,
      });
    }
  }

  scoredMatches.sort((a, b) => b.score - a.score);

  const bestMatch = scoredMatches[0] ?? null;
  const secondMatch = scoredMatches[1] ?? null;

  if (
    bestMatch &&
    secondMatch &&
    bestMatch.score === secondMatch.score
  ) {
    warnings.push(
      `Multiple ROM entries produced the same match score: ${bestMatch.entry.romFamily} and ${secondMatch.entry.romFamily}.`
    );
  }

  let binaryType: RomFingerprintResult["binaryType"] =
    "unknown";

  const upperFileName = normalise(fileName);

  if (
    upperFileName.includes("ORIGINAL") ||
    upperFileName.includes("STOCK") ||
    upperFileName.includes("ORI")
  ) {
    binaryType = "stock";
    evidence.push(
      "Filename identifies the binary as a stock or original reference."
    );
  } else if (
    upperFileName.includes("MAPSWITCH") ||
    upperFileName.includes("MAP_SWITCH") ||
    upperFileName.includes("MAP SWITCH")
  ) {
    binaryType = "mapswitch";
    evidence.push(
      "Filename identifies a map-switch binary."
    );
  } else if (upperFileName.endsWith(".BIN")) {
    binaryType = "modified";
    evidence.push(
      "File extension identifies a raw ECU binary."
    );
  }

  if (binarySizeBytes !== null) {
    evidence.push(
      `Binary size detected: ${binarySizeBytes} bytes.`
    );

    if (binarySizeBytes === 2097152) {
      evidence.push(
        "Binary size matches the common 2 MB MSD8x full-binary format."
      );
    }
  }

  if (!bestMatch) {
    warnings.push(
      "No recognised ROM signature was found in the filename or printable binary strings."
    );
  } else {
    const entry = bestMatch.entry;
    const matchedValues =
      bestMatch.matchedMarkers.map(normalise);

    const romFamilyMatched = matchedValues.includes(
      normalise(entry.romFamily)
    );

    const ecuMatched = matchedValues.includes(
      normalise(entry.ecu)
    );

    const platformMatched =
      matchedValues.includes(normalise(entry.platform)) ||
      matchedValues.includes(
        normalise(entry.engineFamily)
      );

    if (romFamilyMatched) {
      evidence.push(
        `Confirmed ROM signature: ${entry.romFamily}.`
      );
    } else {
      evidence.push(
        `ROM library candidate identified: ${entry.romFamily}.`
      );
    }

    if (ecuMatched) {
      evidence.push(`Detected ECU family: ${entry.ecu}.`);
    }

    if (platformMatched) {
      evidence.push(
        `Detected platform: ${entry.platform}.`
      );
    }

    if (entry.hasXdf && entry.xdfSuggested) {
      evidence.push(
        `Matching XDF located: ${entry.xdfSuggested}.`
      );
    }

    if (
      entry.hasStockBin &&
      entry.stockBinSuggested
    ) {
      evidence.push(
        `Stock reference located: ${entry.stockBinSuggested}.`
      );
    }

    if (
      entry.hasMapSwitchBin &&
      entry.mapSwitchBinSuggested
    ) {
      evidence.push(
        `Map-switch reference located: ${entry.mapSwitchBinSuggested}.`
      );
    }

    if (
      typeof entry.libraryEvidenceScore === "number"
    ) {
      evidence.push(
        `ROM library evidence score: ${entry.libraryEvidenceScore}.`
      );
    }

    evidence.push(
      `Matched ${bestMatch.matchedMarkers.length} ROM marker(s) with a weighted score of ${bestMatch.score}.`
    );
  }

  const confidence = calculateConfidence(bestMatch);

  return {
    platform: bestMatch?.entry.platform ?? null,
    ecu: bestMatch?.entry.ecu ?? null,
    romFamily: bestMatch?.entry.romFamily ?? null,
    binaryType,
    xdfSuggested:
      bestMatch?.entry.xdfSuggested ?? null,
    stockBinSuggested:
      bestMatch?.entry.stockBinSuggested ?? null,
    mapSwitchBinSuggested:
      bestMatch?.entry.mapSwitchBinSuggested ?? null,
    confidence,
    evidence,
    warnings,
  };
}
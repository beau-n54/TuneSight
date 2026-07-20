import {
  classifyBinary,
  BinaryComparisonEvidence,
} from "./binaryClassification";
import {
  ROM_LIBRARY,
  RomLibraryEntry,
} from "./romLibrary";

export type RomFingerprintResult = {
  platform: string | null;
  ecu: string | null;
  romFamily: string | null;
  binaryType:
    | "stock"
    | "mapswitch"
    | "modified"
    | "unknown";
  binaryClassificationConfidence: number;
  exactBinaryMatch: boolean;
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

  if (
    normalisedMarker ===
    normalise(entry.romFamily)
  ) {
    return 6;
  }

  if (
    normalisedMarker ===
    normalise(entry.ecu)
  ) {
    return 3;
  }

  if (
    normalisedMarker ===
    normalise(entry.platform)
  ) {
    return 2;
  }

  if (
    normalisedMarker ===
    normalise(entry.engineFamily)
  ) {
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

  const matchedValues =
    matchedMarkers.map(normalise);

  const romFamilyMatched =
    matchedValues.includes(
      normalise(entry.romFamily)
    );

  const ecuMatched =
    matchedValues.includes(
      normalise(entry.ecu)
    );

  const platformMatched =
    matchedValues.includes(
      normalise(entry.platform)
    ) ||
    matchedValues.includes(
      normalise(entry.engineFamily)
    );

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
    confidence = Math.min(
      confidence,
      0.75
    );
  }

  return Math.min(
    0.98,
    confidence
  );
}

export function fingerprintRom(input: {
  fileName?: string | null;
  binarySizeBytes?: number | null;
  binaryHash?: string | null;
  printableStrings?: string[] | null;
  comparison?: BinaryComparisonEvidence | null;
  library?: RomLibraryEntry[];
}): RomFingerprintResult {
  const library =
    input.library ?? ROM_LIBRARY;

  const fileName =
    input.fileName ?? "";

  const binarySizeBytes =
    input.binarySizeBytes ?? null;

  const binaryHash =
    input.binaryHash ?? null;

  const printableStrings =
    input.printableStrings ?? [];

  const haystack = normalise(
    [
      fileName,
      ...printableStrings,
    ].join(" ")
  );

  const evidence: string[] = [];
  const warnings: string[] = [];
  const scoredMatches: ScoredMatch[] = [];

  for (const entry of library) {
    const matchedMarkers =
      entry.markers.filter((marker) =>
        haystack.includes(
          normalise(marker)
        )
      );

    const score =
      matchedMarkers.reduce(
        (total, marker) =>
          total +
          markerWeight(
            marker,
            entry
          ),
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

  scoredMatches.sort(
    (a, b) => b.score - a.score
  );

  const bestMatch =
    scoredMatches[0] ?? null;

  const secondMatch =
    scoredMatches[1] ?? null;

  if (
    bestMatch &&
    secondMatch &&
    bestMatch.score ===
      secondMatch.score
  ) {
    warnings.push(
      `Multiple ROM entries produced the same match score: ${bestMatch.entry.romFamily} and ${secondMatch.entry.romFamily}.`
    );
  }

  if (!bestMatch) {
    warnings.push(
      "No recognised ROM signature was found in the filename or printable binary strings."
    );
  } else {
    const entry = bestMatch.entry;

    const matchedValues =
      bestMatch.matchedMarkers.map(
        normalise
      );

    const romFamilyMatched =
      matchedValues.includes(
        normalise(entry.romFamily)
      );

    const ecuMatched =
      matchedValues.includes(
        normalise(entry.ecu)
      );

    const platformMatched =
      matchedValues.includes(
        normalise(entry.platform)
      ) ||
      matchedValues.includes(
        normalise(
          entry.engineFamily
        )
      );

    /*
     * Detection evidence follows TuneSight's
     * investigative presentation order.
     */

    if (platformMatched) {
      evidence.push(
        `Detected platform: ${entry.platform}.`
      );
    }

    if (ecuMatched) {
      evidence.push(
        `Detected ECU family: ${entry.ecu}.`
      );
    }

    if (romFamilyMatched) {
      evidence.push(
        `Confirmed ROM signature: ${entry.romFamily}.`
      );
    } else {
      evidence.push(
        `ROM library candidate identified: ${entry.romFamily}.`
      );
    }

    if (
      entry.hasXdf &&
      entry.xdfSuggested
    ) {
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
  }

  if (binarySizeBytes !== null) {
    evidence.push(
      `Binary size detected: ${binarySizeBytes} bytes.`
    );

    if (
      binarySizeBytes === 2097152
    ) {
      evidence.push(
        "Binary size matches the common 2 MB MSD8x full-binary format."
      );
    }
  }

  if (
    bestMatch &&
    typeof bestMatch.entry
      .libraryEvidenceScore ===
      "number"
  ) {
    evidence.push(
      `ROM library evidence score: ${bestMatch.entry.libraryEvidenceScore}.`
    );

    evidence.push(
      `Matched ${bestMatch.matchedMarkers.length} ROM marker(s) with a weighted score of ${bestMatch.score}.`
    );
  }

  const binaryClassification =
    classifyBinary({
      uploadedHash: binaryHash,
      uploadedSizeBytes:
        binarySizeBytes,

      stockReference: bestMatch
        ? {
            hash:
              bestMatch.entry
                .stockBinaryHash ??
              null,
            sizeBytes:
              bestMatch.entry
                .stockBinarySizeBytes ??
              null,
          }
        : null,

      mapSwitchReference: bestMatch
        ? {
            hash:
              bestMatch.entry
                .mapSwitchBinaryHash ??
              null,
            sizeBytes:
              bestMatch.entry
                .mapSwitchBinarySizeBytes ??
              null,
          }
        : null,

      comparison:
        input.comparison ?? null,
    });

  evidence.push(
    ...binaryClassification.evidence
  );

  warnings.push(
    ...binaryClassification.warnings
  );

  const confidence =
    calculateConfidence(bestMatch);

  return {
    platform:
      bestMatch?.entry.platform ??
      null,

    ecu:
      bestMatch?.entry.ecu ??
      null,

    romFamily:
      bestMatch?.entry.romFamily ??
      null,

    binaryType:
      binaryClassification.classification,

    binaryClassificationConfidence:
      binaryClassification.confidence,

    exactBinaryMatch:
      binaryClassification.exactBinaryMatch,

    xdfSuggested:
      bestMatch?.entry
        .xdfSuggested ?? null,

    stockBinSuggested:
      bestMatch?.entry
        .stockBinSuggested ?? null,

    mapSwitchBinSuggested:
      bestMatch?.entry
        .mapSwitchBinSuggested ??
      null,

    confidence,
    evidence,
    warnings,
  };
}

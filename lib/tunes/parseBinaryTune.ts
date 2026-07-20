import { extractPrintableStringsFromBuffer } from "./extractPrintableStrings";
import { detectRomSignature } from "./detectRomSignature";
import { routePlatformParser } from "./platformRouter";
import { extractTuneMetadata } from "./extractMetadata";
import { detectChecksumFamily } from "./detectChecksumFamily";
import { detectMapRegions } from "./detectMapRegions";
import { analyzeEntropy } from "./analyzeEntropy";
import { calculateBinaryHash } from "./calculateBinaryHash";

import type { ParsedTuneFile } from "./types";

export async function parseBinaryTuneFile(
  file: File
): Promise<ParsedTuneFile> {
  const arrayBuffer =
    await file.arrayBuffer();

  const buffer =
    Buffer.from(arrayBuffer);

  const binaryHash =
    calculateBinaryHash(buffer);

  const printableStrings =
    extractPrintableStringsFromBuffer(
      buffer
    );

  const romDetection =
    detectRomSignature(
      printableStrings
    );

  const parsed: ParsedTuneFile = {
    detectedPlatform:
      romDetection.detectedPlatform,

    detectedRom:
      romDetection.detectedRom,

    binarySignature:
      romDetection.binarySignature,

    confidence:
      romDetection.confidence,

    fileSize:
      buffer.length,

    printableStrings,

    parserNotes:
      romDetection.parserNotes,

    metadata: {
      binaryHash,
    },
  };

  const withMetadata =
    extractTuneMetadata(parsed);

  const withChecksumFamily =
    detectChecksumFamily(
      withMetadata
    );

  const withMapRegions =
    detectMapRegions(
      withChecksumFamily
    );

  const withEntropy =
    analyzeEntropy(
      withMapRegions,
      buffer
    );

  return routePlatformParser(
    withEntropy
  );
}
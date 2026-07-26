import type { LibraryFile } from "../tunes/libraryScanner";
import type { RomLibraryEntry } from "../tunes/romLibrary";
import { createStockVariantRegistry } from "./stockVariants.ts";
import type {
  StockVariantKnowledge,
  StockVariantRegistry,
} from "./stockVariants.ts";

function normaliseLegacyRomFamily(fileName: string): string {
  return fileName
    .replace(/\.[^.]+$/, "")
    .replace(/[\s_-]*(stock|original|ori|map[\s_-]*switch(?:[\s_-]*base)?)[\s_-]*/gi, "")
    .replace(/[\s_-]*b58o1$/i, "")
    .trim();
}

function stableVariantId(input: {
  platform: string;
  romFamily: string;
  hash: string;
  size: number;
}): string {
  return [
    "stock-variant",
    input.platform.trim().toLowerCase(),
    input.romFamily.trim().toLowerCase(),
    input.hash.toLowerCase(),
    String(input.size),
  ].join(":");
}

/** Preserve legacy file knowledge without promoting filename-derived authority. */
export function buildLegacyStockVariantRegistry(input: {
  files: readonly LibraryFile[];
  library: readonly RomLibraryEntry[];
  libraryRoot: string;
}): StockVariantRegistry {
  const variants: StockVariantKnowledge[] = [];

  for (const file of input.files) {
    if (file.category !== "stockBin" || !file.binaryHash || file.binarySizeBytes === null) {
      continue;
    }

    const romFamily = normaliseLegacyRomFamily(file.fileName);
    const relatedEntries = input.library.filter(
      (entry) => entry.romFamily.toUpperCase() === romFamily.toUpperCase()
    );

    for (const entry of relatedEntries) {
      variants.push({
        id: stableVariantId({
          platform: entry.platform,
          romFamily: entry.romFamily,
          hash: file.binaryHash,
          size: file.binarySizeBytes,
        }),
        sha256: file.binaryHash,
        binarySizeBytes: file.binarySizeBytes,
        romFamily: entry.romFamily,
        ecu: entry.ecu !== "Unknown" ? entry.ecu : undefined,
        platform: entry.platform !== "Unknown" ? entry.platform : undefined,
        verificationStatus: "provisional",
        confidence: "unknown",
        provenance: [{
          sourceType: "legacy_rom_library",
          sourceIdentifier: file.fileName,
          sourceLocation: file.fullPath,
          discoveryMethod: "ROM library filesystem scan",
          validationMethod: "Exact SHA-256 and binary size calculated from source file",
          transformationHistory: [
            "Stock designation and ROM Family relationship imported from the legacy filename/path catalogue.",
          ],
          engineeringNotes:
            "Import preserves legacy knowledge but does not promote filename-derived stock designation to authoritative verification.",
        }],
        supportingEvidence: [
          `Repository binary: ${file.fileName}`,
          `Library root: ${input.libraryRoot}`,
        ],
        xdfRelationships: entry.xdfSuggested ? [entry.xdfSuggested] : undefined,
        lifecycleStatus: "active",
        conflictState: "none",
      });
    }
  }

  return createStockVariantRegistry(variants);
}

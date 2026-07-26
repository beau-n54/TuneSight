import fs from "node:fs";
import path from "node:path";

import { createStockVariantRegistry } from "../lib/knowledge/stockVariants.ts";
import type {
  StockVariantKnowledge,
  StockVariantLookupResult,
} from "../lib/knowledge/stockVariants.ts";
import { calculateBinaryHash } from "../lib/tunes/calculateBinaryHash.ts";
import { loadRomLibrary } from "../lib/tunes/loadRomLibrary.ts";

type BinaryIdentity = {
  filePath: string;
  sha256: string;
  binarySizeBytes: number;
};

type ValidationOutput = {
  caseName: string;
  filePathOrFixture: string;
  sha256: string;
  binarySizeBytes: number;
  suppliedRomFamily: string | null;
  lookupStatus: StockVariantLookupResult["status"];
  matchedVariantId: string | null;
  verificationStatus: StockVariantLookupResult["verificationStatus"];
  confidence: StockVariantLookupResult["confidence"];
  provenanceSourceTypes: string[];
  conflictState: StockVariantLookupResult["conflictState"];
  unresolvedReason: string | null;
  result: "PASS" | "FAIL";
  failureReasons: string[];
};

const argumentsByName = new Map<string, string>();

for (let index = 2; index < process.argv.length; index += 2) {
  const name = process.argv[index];
  const value = process.argv[index + 1];

  if (!name?.startsWith("--") || !value) {
    console.error("Arguments must use --name value pairs.");
    process.exit(2);
  }

  argumentsByName.set(name.slice(2), value);
}

function requiredArgument(name: string): string {
  const value = argumentsByName.get(name);

  if (!value) {
    throw new Error(`Missing required --${name} path.`);
  }

  return path.resolve(value);
}

function readBinaryIdentity(filePath: string): BinaryIdentity {
  const bytes = fs.readFileSync(filePath);

  return {
    filePath,
    sha256: calculateBinaryHash(bytes),
    binarySizeBytes: bytes.length,
  };
}

function fixture(input: {
  id: string;
  sha256: string;
  size: number;
  romFamily: string;
  verificationStatus?: StockVariantKnowledge["verificationStatus"];
  confidence?: StockVariantKnowledge["confidence"];
}): StockVariantKnowledge {
  return {
    id: input.id,
    sha256: input.sha256,
    binarySizeBytes: input.size,
    romFamily: input.romFamily,
    verificationStatus: input.verificationStatus ?? "verified",
    confidence: input.confidence ?? "medium",
    provenance: [
      {
        sourceType: "founder_validation_fixture",
        sourceIdentifier: input.id,
        validationMethod: "Controlled in-memory WP-004.1 validation fixture",
      },
    ],
    supportingEvidence: ["WP-004.1 executable Founder Validation harness"],
    lifecycleStatus: "active",
    conflictState: "none",
  };
}

function reportCase(input: {
  caseName: string;
  identity: BinaryIdentity;
  fixtureIdentifier?: string;
  suppliedRomFamily?: string | null;
  lookup: StockVariantLookupResult;
  expectations: Array<{ description: string; passes: boolean }>;
}): boolean {
  const failureReasons = input.expectations
    .filter((expectation) => !expectation.passes)
    .map((expectation) => expectation.description);
  const output: ValidationOutput = {
    caseName: input.caseName,
    filePathOrFixture: input.fixtureIdentifier ?? input.identity.filePath,
    sha256: input.identity.sha256,
    binarySizeBytes: input.identity.binarySizeBytes,
    suppliedRomFamily: input.suppliedRomFamily ?? null,
    lookupStatus: input.lookup.status,
    matchedVariantId: input.lookup.variant?.id ?? null,
    verificationStatus: input.lookup.verificationStatus,
    confidence: input.lookup.confidence,
    provenanceSourceTypes: [
      ...new Set(input.lookup.provenanceSummary.map((item) => item.sourceType)),
    ],
    conflictState: input.lookup.conflictState,
    unresolvedReason: input.lookup.unresolvedReason,
    result: failureReasons.length === 0 ? "PASS" : "FAIL",
    failureReasons,
  };

  console.log(JSON.stringify(output, null, 2));
  return failureReasons.length === 0;
}

function main(): void {
  const libraryRoot = requiredArgument("library-root");
  const beauPath = requiredArgument("beau-f30");
  const christosPath = requiredArgument("christos-supra");
  const loaded = loadRomLibrary(libraryRoot);
  const registry = loaded.stockVariantRegistry;
  const initialVariantCount = registry.variants.length;
  const results: boolean[] = [];

  const legacyVariant = registry.variants.find((variant) => {
    const hasReadableLegacySource = variant.provenance.some(
      (provenance) =>
        provenance.sourceType === "legacy_rom_library" &&
        provenance.sourceLocation &&
        fs.existsSync(provenance.sourceLocation)
    );

    return (
      variant.verificationStatus === "provisional" &&
      hasReadableLegacySource &&
      registry.lookup({
        sha256: variant.sha256,
        binarySizeBytes: variant.binarySizeBytes,
      }).status === "exact_candidate"
    );
  });

  if (!legacyVariant) {
    throw new Error("No readable provisional legacy Stock Variant is available.");
  }

  const legacyPath = legacyVariant.provenance.find(
    (item) => item.sourceLocation && fs.existsSync(item.sourceLocation)
  )?.sourceLocation;

  if (!legacyPath) {
    throw new Error("The selected legacy Stock Variant has no readable source path.");
  }

  const legacyIdentity = readBinaryIdentity(legacyPath);
  const legacyLookup = registry.lookup({
    sha256: legacyIdentity.sha256,
    binarySizeBytes: legacyIdentity.binarySizeBytes,
  });
  results.push(
    reportCase({
      caseName: "Case 1: Known Legacy Stock Reference",
      identity: legacyIdentity,
      lookup: legacyLookup,
      expectations: [
        { description: "Expected exact_candidate.", passes: legacyLookup.status === "exact_candidate" },
        { description: "Expected provisional verification.", passes: legacyLookup.verificationStatus === "provisional" },
        {
          description: "Expected legacy_rom_library provenance.",
          passes: legacyLookup.provenanceSummary.some(
            (item) => item.sourceType === "legacy_rom_library"
          ),
        },
        { description: "Legacy record must not be exact_verified.", passes: legacyLookup.status !== "exact_verified" },
      ],
    })
  );

  const verifiedRecord = fixture({
    id: "founder-validation:verified",
    sha256: "d".repeat(64),
    size: 4_194_304,
    romFamily: "VALIDATION-ROM",
    confidence: "low",
  });
  const verifiedRegistry = createStockVariantRegistry([verifiedRecord]);
  const verifiedLookup = verifiedRegistry.lookup({
    sha256: verifiedRecord.sha256,
    binarySizeBytes: verifiedRecord.binarySizeBytes,
  });
  results.push(
    reportCase({
      caseName: "Case 2: Explicit Verified Fixture",
      identity: {
        filePath: "in-memory",
        sha256: verifiedRecord.sha256,
        binarySizeBytes: verifiedRecord.binarySizeBytes,
      },
      fixtureIdentifier: verifiedRecord.id,
      lookup: verifiedLookup,
      expectations: [
        { description: "Expected exact_verified.", passes: verifiedLookup.status === "exact_verified" },
        { description: "Expected verified status.", passes: verifiedLookup.verificationStatus === "verified" },
        { description: "Confidence must remain independently low.", passes: verifiedLookup.confidence === "low" },
        { description: "Expected fixture provenance.", passes: verifiedLookup.provenanceSummary.length > 0 },
      ],
    })
  );

  const variantA = fixture({
    id: "founder-validation:multi-a",
    sha256: "e".repeat(64),
    size: 8_388_608,
    romFamily: "MULTI-ROM",
  });
  const variantB = fixture({
    id: "founder-validation:multi-b",
    sha256: "f".repeat(64),
    size: 8_388_609,
    romFamily: "MULTI-ROM",
  });
  const multiRegistry = createStockVariantRegistry([variantA]).register(variantB);
  const multiLookupA = multiRegistry.lookup({
    sha256: variantA.sha256,
    binarySizeBytes: variantA.binarySizeBytes,
  });
  const multiLookupB = multiRegistry.lookup({
    sha256: variantB.sha256,
    binarySizeBytes: variantB.binarySizeBytes,
  });
  results.push(
    reportCase({
      caseName: "Case 3A: Multiple Same-ROM Variants",
      identity: { filePath: "in-memory", sha256: variantA.sha256, binarySizeBytes: variantA.binarySizeBytes },
      fixtureIdentifier: variantA.id,
      suppliedRomFamily: variantA.romFamily,
      lookup: multiLookupA,
      expectations: [
        { description: "Expected two coexisting variants.", passes: multiRegistry.variantsForRomFamily("MULTI-ROM").length === 2 },
        { description: "Variant A must resolve independently.", passes: multiLookupA.variant?.id === variantA.id },
        { description: "Variant B must resolve independently.", passes: multiLookupB.variant?.id === variantB.id },
      ],
    })
  );
  results.push(
    reportCase({
      caseName: "Case 3B: Multiple Same-ROM Variants",
      identity: { filePath: "in-memory", sha256: variantB.sha256, binarySizeBytes: variantB.binarySizeBytes },
      fixtureIdentifier: variantB.id,
      suppliedRomFamily: variantB.romFamily,
      lookup: multiLookupB,
      expectations: [
        { description: "Variant B must resolve independently.", passes: multiLookupB.variant?.id === variantB.id },
      ],
    })
  );

  const unmatchedFile = loaded.files.find(
    (file) => file.category === "mapSwitch" && file.binaryHash && file.binarySizeBytes !== null
  );

  if (!unmatchedFile) {
    throw new Error("No repository map-switch fixture is available for unmatched validation.");
  }

  const unmatchedIdentity = readBinaryIdentity(unmatchedFile.fullPath);
  const unmatchedLookup = registry.lookup({
    sha256: unmatchedIdentity.sha256,
    binarySizeBytes: unmatchedIdentity.binarySizeBytes,
  });
  results.push(
    reportCase({
      caseName: "Case 4: Modified or Unmatched Binary",
      identity: unmatchedIdentity,
      lookup: unmatchedLookup,
      expectations: [
        { description: "Unmatched binary must not be exact_verified.", passes: unmatchedLookup.status !== "exact_verified" },
      ],
    })
  );

  const beauIdentity = readBinaryIdentity(beauPath);
  const beauLookup = registry.lookup({
    sha256: beauIdentity.sha256,
    binarySizeBytes: beauIdentity.binarySizeBytes,
  });
  results.push(
    reportCase({
      caseName: "Case 5: Beau F30 Founder Binary",
      identity: beauIdentity,
      lookup: beauLookup,
      expectations: [
        {
          description: "Unexpected Beau F30 SHA-256.",
          passes: beauIdentity.sha256 === "90b8c0f7994dcb0c8f913256590162c0e11b3b9032eaca097ead9f9546cd038e",
        },
        { description: "Founder binary must not be exact_verified.", passes: beauLookup.status !== "exact_verified" },
        { description: "Expected unknown without registered exact knowledge.", passes: beauLookup.status === "unknown" },
      ],
    })
  );

  const christosIdentity = readBinaryIdentity(christosPath);
  const christosLookup = registry.lookup({
    sha256: christosIdentity.sha256,
    binarySizeBytes: christosIdentity.binarySizeBytes,
  });
  results.push(
    reportCase({
      caseName: "Case 6: Christos Supra Founder Binary",
      identity: christosIdentity,
      lookup: christosLookup,
      expectations: [
        {
          description: "Unexpected Christos Supra SHA-256.",
          passes: christosIdentity.sha256 === "e98c31bea631a1964d801e4ebbe4cd97e98c6daec08c348eb94c82d130c35341",
        },
        { description: "Founder binary must not be exact_verified.", passes: christosLookup.status !== "exact_verified" },
        { description: "Expected unknown without registered exact knowledge.", passes: christosLookup.status === "unknown" },
        { description: "No numeric ROM may be assigned.", passes: christosLookup.romFamily === null },
      ],
    })
  );

  const contradictionLookup = registry.lookup({
    sha256: legacyIdentity.sha256,
    binarySizeBytes: legacyIdentity.binarySizeBytes,
    romFamily: "INCOMPATIBLE-ROM-FAMILY",
  });
  results.push(
    reportCase({
      caseName: "Case 7: Contradictory ROM Family",
      identity: legacyIdentity,
      suppliedRomFamily: "INCOMPATIBLE-ROM-FAMILY",
      lookup: contradictionLookup,
      expectations: [
        { description: "Expected conflict.", passes: contradictionLookup.status === "conflict" },
        { description: "No authoritative variant may be selected.", passes: contradictionLookup.variant === null },
        { description: "Expected unresolved conflict state.", passes: contradictionLookup.conflictState === "unresolved" },
      ],
    })
  );

  results.push(initialVariantCount === registry.variants.length);
  console.log(
    JSON.stringify(
      {
        summary: results.every(Boolean) ? "PASS" : "FAIL",
        casesPassed: results.filter(Boolean).length,
        totalChecks: results.length,
        productionRegistryVariantCountBefore: initialVariantCount,
        productionRegistryVariantCountAfter: registry.variants.length,
      },
      null,
      2
    )
  );

  if (!results.every(Boolean)) {
    process.exitCode = 1;
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : "Unknown validation failure.");
  process.exitCode = 1;
}

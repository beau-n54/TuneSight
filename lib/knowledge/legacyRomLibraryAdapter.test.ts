import assert from "node:assert/strict";
import test from "node:test";

import { buildLegacyStockVariantRegistry } from "./legacyRomLibraryAdapter.ts";
import type { LibraryFile } from "../tunes/libraryScanner";
import type { RomLibraryEntry } from "../tunes/romLibrary";

const files: LibraryFile[] = [
  {
    fileName: "IJE0S_original.bin",
    fullPath: "library/N54/IJE0S_original.bin",
    extension: ".bin",
    category: "stockBin",
    binaryHash: "a".repeat(64),
    binarySizeBytes: 2_097_152,
  },
  {
    fileName: "IJE0S_stock.bin",
    fullPath: "library/N54/IJE0S_stock.bin",
    extension: ".bin",
    category: "stockBin",
    binaryHash: "b".repeat(64),
    binarySizeBytes: 2_097_152,
  },
  {
    fileName: "IJE0S_MapSwitchBase.bin",
    fullPath: "library/N54/IJE0S_MapSwitchBase.bin",
    extension: ".bin",
    category: "mapSwitch",
    binaryHash: "c".repeat(64),
    binarySizeBytes: 2_097_152,
  },
];

const library: RomLibraryEntry[] = [
  {
    platform: "N54",
    ecu: "MSD81",
    romFamily: "IJE0S",
    engineFamily: "N54",
    xdfSuggested: "IJE0S.xdf",
    stockBinSuggested: "IJE0S_original.bin",
    mapSwitchBinSuggested: "IJE0S_MapSwitchBase.bin",
    markers: ["IJE0S"],
  },
];

test("legacy adapter preserves multiple exact variants without promoting authority", () => {
  const registry = buildLegacyStockVariantRegistry({
    files,
    library,
    libraryRoot: "library",
  });

  assert.equal(registry.variants.length, 2);
  assert.deepEqual(
    registry.variants.map((item) => item.sha256),
    ["a".repeat(64), "b".repeat(64)]
  );
  assert.ok(registry.variants.every((item) => item.verificationStatus === "provisional"));
  assert.ok(registry.variants.every((item) => item.xdfRelationships?.includes("IJE0S.xdf")));
  assert.equal(
    registry.lookup({ sha256: "a".repeat(64), binarySizeBytes: 2_097_152 }).status,
    "exact_candidate"
  );
});

test("map-switch and generic files are not imported as Stock Variants", () => {
  const registry = buildLegacyStockVariantRegistry({
    files,
    library,
    libraryRoot: "library",
  });

  assert.equal(
    registry.variants.some((item) => item.sha256 === "c".repeat(64)),
    false
  );
});

test("legacy catalogue conflicts remain distinct instead of colliding by stable ID", () => {
  const conflictingLibrary: RomLibraryEntry[] = [
    library[0],
    { ...library[0], platform: "B58 Gen2", ecu: "MG1CS024" },
  ];
  const registry = buildLegacyStockVariantRegistry({
    files: [files[0]],
    library: conflictingLibrary,
    libraryRoot: "library",
  });

  assert.equal(registry.variants.length, 2);
  assert.equal(
    registry.lookup({
      sha256: files[0].binaryHash,
      binarySizeBytes: files[0].binarySizeBytes,
    }).status,
    "conflict"
  );
});

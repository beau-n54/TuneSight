import assert from "node:assert/strict";
import test from "node:test";

import type {
  RomLibraryEntry,
} from "./romLibrary.ts";
import {
  fingerprintRom,
} from "./romFingerprint.ts";

function entry(
  romFamily: string
): RomLibraryEntry {
  return {
    platform: "B58 Gen1",
    engineFamily: "B58",
    ecu: "MG1",
    romFamily,
    markers: [
      romFamily,
      "MG1",
      "B58",
    ],
    xdfSuggested: `${romFamily}.xdf`,
    stockBinSuggested: null,
    mapSwitchBinSuggested: null,
    hasXdf: true,
    hasStockBin: false,
    hasMapSwitchBin: false,
  };
}

test("exact binary-encoded ROM-family evidence selects the matching catalogue entry", () => {
  const target =
    "00003076501103";
  const result = fingerprintRom({
    binaryBytes: Buffer.concat([
      Buffer.from([0xff, 0xff]),
      Buffer.from(target, "hex"),
      Buffer.from([0xff]),
    ]),
    binarySizeBytes: 10,
    binaryHash: "a".repeat(64),
    printableStrings: ["MG1"],
    library: [
      entry(target),
      entry("00003076501D02"),
    ],
  });

  assert.equal(result.platform, "B58 Gen1");
  assert.equal(result.ecu, "MG1");
  assert.equal(result.romFamily, target);
  assert.ok(
    result.evidence.includes(
      `Exact binary-encoded ROM-family marker matched: ${target}.`
    )
  );
});

test("no binary-encoded marker does not fabricate ROM-family evidence", () => {
  const result = fingerprintRom({
    binaryBytes: Buffer.from([
      0xff, 0xfe, 0xfd,
    ]),
    binarySizeBytes: 3,
    binaryHash: "a".repeat(64),
    printableStrings: [],
    library: [
      entry("00003076501103"),
    ],
  });

  assert.equal(result.romFamily, null);
  assert.equal(
    result.evidence.some((item) =>
      item.includes(
        "binary-encoded ROM-family marker"
      )
    ),
    false
  );
});

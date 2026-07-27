import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveBinaryContainer,
} from "./binaryContainer.ts";
import {
  detectBinaryDifferences,
} from "./detectBinaryDifferences.ts";
import {
  calculateBinaryHash,
} from "./calculateBinaryHash.ts";
import {
  createStockVariantRegistry,
} from "../knowledge/stockVariants.ts";
import {
  requestRuntimeStockVariantKnowledge,
} from "../knowledge/runtimeStockVariantKnowledge.ts";
import {
  interpretRuntimeStockVariantKnowledge,
} from "./vehicleIdentityKnowledgeInterpretation.ts";
import type {
  RomFingerprintResult,
} from "./romFingerprint.ts";

function bin(
  bytes: readonly number[],
  fileName = "test.bin"
) {
  return resolveBinaryContainer({
    bytes: Uint8Array.from(bytes),
    fileName,
    mimeType:
      "application/octet-stream",
  });
}

function rawMg1Dtf() {
  const bytes = Buffer.alloc(
    0x800000,
    0xff
  );
  const markers = [
    [
      0x2001a,
      "#DME_8XT0#C2#HWE#Hardware_DME8XT1_35UP",
    ],
    [
      0x2020a,
      "#DME_86Tx#C2#HWA#DME8.6.T_B58TUE_V1",
    ],
    [
      0x5fe1e,
      "#DME_86T0#C2#BTL#MDG1G_35up",
    ],
    [
      0x6a0540,
      "56/1/MG1CS201/11/MG1CS201_BX8TUE",
    ],
    [
      0x7ffe36,
      "#DME_86T0__________#C2#DST",
    ],
  ] as const;

  for (const [offset, value] of markers) {
    bytes.write(value, offset, "ascii");
  }

  return bytes;
}

test("BIN resolves losslessly as Engineering Binary and preserves upload metadata", () => {
  const result = bin([1, 2, 3, 4]);

  assert.equal(result.status, "resolved");

  if (result.status !== "resolved") {
    return;
  }

  assert.deepEqual(
    [...result.engineeringBinary.bytes],
    [1, 2, 3, 4]
  );
  assert.equal(
    result.engineeringBinary.byteLength,
    4
  );
  assert.equal(
    result.engineeringBinary.source
      .containerType,
    "bin"
  );
  assert.equal(
    result.engineeringBinary.source.fileName,
    "test.bin"
  );
  assert.equal(
    result.engineeringBinary.source.mimeType,
    "application/octet-stream"
  );
});

test("Engineering Binary evidence cannot be mutated through byte aliases", () => {
  const upload = Uint8Array.from([
    1, 2, 3, 4,
  ]);
  const result =
    resolveBinaryContainer({
      bytes: upload,
      fileName: "immutable.bin",
    });

  assert.equal(result.status, "resolved");

  if (result.status !== "resolved") {
    return;
  }

  const firstRead =
    result.engineeringBinary.bytes;
  const stableHash =
    calculateBinaryHash(firstRead);
  firstRead[0] = 255;
  upload[1] = 255;

  assert.deepEqual(
    [
      ...result.engineeringBinary
        .bytes,
    ],
    [1, 2, 3, 4]
  );
  assert.notEqual(
    firstRead,
    result.engineeringBinary.bytes
  );
  assert.equal(
    calculateBinaryHash(
      result.engineeringBinary.bytes
    ),
    stableHash
  );
});

test("proven raw MG1 86T0 DTF resolves losslessly with extraction evidence", () => {
  const bytes = rawMg1Dtf();
  const result =
    resolveBinaryContainer({
      bytes,
      fileName: "test.dtf",
      mimeType:
        "application/octet-stream",
    });

  assert.equal(result.status, "resolved");

  if (result.status !== "resolved") {
    return;
  }

  assert.equal(result.containerType, "dtf");
  assert.equal(
    result.engineeringBinary.byteLength,
    0x800000
  );
  assert.equal(
    calculateBinaryHash(
      result.engineeringBinary.bytes
    ),
    calculateBinaryHash(bytes)
  );
  assert.equal(
    result.engineeringBinary.source
      .containerType,
    "dtf"
  );
  assert.equal(
    result.engineeringBinary.source
      .resolutionMethod,
    "dtf_raw_mg1_86t0_full_binary"
  );
  assert.ok(
    result.engineeringBinary.source
      .resolutionEvidence.length >= 3
  );
});

test("DTF outside the proven variant returns truthful bounded extraction failure", () => {
  const result =
    resolveBinaryContainer({
      bytes: Uint8Array.from([
        0x44, 0x54, 0x46, 0x00,
      ]),
      fileName: "test.dtf",
    });

  assert.equal(result.status, "unresolved");
  assert.equal(result.containerType, "dtf");
  assert.equal(
    result.errorCode,
    "dtf_extraction_unavailable"
  );
  assert.equal(result.engineeringBinary, null);
});

test("corrupt DTF bytes are never exposed as Engineering Binary", () => {
  const result =
    resolveBinaryContainer({
      bytes: Uint8Array.from([
        0xff, 0x00, 0x13, 0x37,
      ]),
      fileName: "corrupt.dtf",
    });

  assert.equal(result.status, "unresolved");
  assert.equal(
    result.errorCode,
    "dtf_extraction_unavailable"
  );
  assert.equal(result.engineeringBinary, null);
});

test("DTF with the proven size but incomplete structural evidence remains unsupported", () => {
  const bytes = rawMg1Dtf();
  bytes.fill(
    0,
    0x6a0540,
    0x6a0540 + 40
  );
  const result =
    resolveBinaryContainer({
      bytes,
      fileName:
        "unsupported-variant.dtf",
    });

  assert.equal(result.status, "unresolved");
  assert.equal(
    result.errorCode,
    "dtf_extraction_unavailable"
  );
  assert.equal(result.engineeringBinary, null);
});

test("resolved DTF Engineering Binary remains immutable", () => {
  const upload = rawMg1Dtf();
  const expectedHash =
    calculateBinaryHash(upload);
  const result =
    resolveBinaryContainer({
      bytes: upload,
      fileName: "immutable.dtf",
    });

  assert.equal(result.status, "resolved");

  if (result.status !== "resolved") {
    return;
  }

  const alias =
    result.engineeringBinary.bytes;
  alias[0] ^= 0xff;
  upload[1] ^= 0xff;

  assert.equal(
    calculateBinaryHash(
      result.engineeringBinary.bytes
    ),
    expectedHash
  );
});

test("missing payload remains explicit", () => {
  const result = bin([]);

  assert.equal(result.status, "unresolved");
  assert.equal(
    result.errorCode,
    "missing_payload"
  );
});

test("unknown and legacy unqualified extensions are unsupported", () => {
  for (const fileName of [
    "test.unknown",
    "test.hex",
    "test.rom",
  ]) {
    const result = bin(
      [1],
      fileName
    );

    assert.equal(
      result.status,
      "unresolved"
    );
    assert.equal(
      result.errorCode,
      "unsupported_container"
    );
  }
});

test("missing filename metadata is invalid", () => {
  const result =
    resolveBinaryContainer({
      bytes: Uint8Array.from([1]),
      fileName: " ",
    });

  assert.equal(result.status, "unresolved");
  assert.equal(
    result.errorCode,
    "invalid_container"
  );
});

test("Engineering Binary identity propagates to Knowledge without container inspection", () => {
  const result = bin(
    [0x49, 0x38, 0x41, 0x30, 0x53]
  );

  assert.equal(result.status, "resolved");

  if (result.status !== "resolved") {
    return;
  }

  const hash = calculateBinaryHash(
    result.engineeringBinary.bytes
  );
  const registry =
    createStockVariantRegistry();
  const knowledge = registry.lookup({
    sha256: hash,
    binarySizeBytes:
      result.engineeringBinary
        .byteLength,
  });

  assert.equal(hash.length, 64);
  assert.equal(knowledge.status, "unknown");
});

test("Engineering Binary identity remains compatible with Vehicle Identity interpretation", () => {
  const result = bin([1, 2, 3]);

  assert.equal(result.status, "resolved");

  if (result.status !== "resolved") {
    return;
  }

  const legacyFingerprint:
    RomFingerprintResult = {
      platform: null,
      ecu: null,
      romFamily: null,
      binaryType: "unknown",
      binaryClassificationConfidence: 0.2,
      exactBinaryMatch: false,
      xdfSuggested: null,
      stockBinSuggested: null,
      mapSwitchBinSuggested: null,
      confidence: 0.2,
      evidence: [
        `Binary size detected: ${result.engineeringBinary.byteLength} bytes.`,
      ],
      warnings: [],
    };
  const knowledge =
    requestRuntimeStockVariantKnowledge({
      registry:
        createStockVariantRegistry(),
      lookup: {
        sha256:
          calculateBinaryHash(
            result.engineeringBinary
              .bytes
          ),
        binarySizeBytes:
          result.engineeringBinary
            .byteLength,
      },
    });
  const interpretation =
    interpretRuntimeStockVariantKnowledge({
      knowledge,
      legacyFingerprint,
    });

  assert.equal(
    interpretation.binaryType,
    "unknown"
  );
  assert.ok(
    interpretation.evidence.some(
      (item) =>
        item.includes(
          "Binary size detected"
        )
    )
  );
});

test("comparison consumes Engineering Binary bytes rather than containers", () => {
  const modified = bin([1, 2, 4]);
  const reference = bin(
    [1, 2, 3],
    "reference.bin"
  );

  assert.equal(modified.status, "resolved");
  assert.equal(reference.status, "resolved");

  if (
    modified.status !== "resolved" ||
    reference.status !== "resolved"
  ) {
    return;
  }

  const mutableAlias =
    modified.engineeringBinary.bytes;
  mutableAlias[2] = 3;

  const diff = detectBinaryDifferences(
    modified.engineeringBinary,
    reference.engineeringBinary
  );

  assert.equal(diff.totalChangedBytes, 1);
});

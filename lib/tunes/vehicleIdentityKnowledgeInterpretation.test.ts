import assert from "node:assert/strict";
import test from "node:test";

import { createStockVariantRegistry } from "../knowledge/stockVariants.ts";
import type {
  StockVariantKnowledge,
  StockVariantRegistry,
} from "../knowledge/stockVariants.ts";
import { requestRuntimeStockVariantKnowledge } from "../knowledge/runtimeStockVariantKnowledge.ts";
import type { RomFingerprintResult } from "./romFingerprint.ts";
import { interpretRuntimeStockVariantKnowledge } from "./vehicleIdentityKnowledgeInterpretation.ts";

const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);

const legacyStockFingerprint: RomFingerprintResult = {
  platform: "B58 Gen1",
  ecu: "MG1",
  romFamily: "00003076501103",
  binaryType: "stock",
  binaryClassificationConfidence: 0.99,
  exactBinaryMatch: true,
  xdfSuggested: "00003076501103.xdf",
  stockBinSuggested: "00003076501103_stock.bin",
  mapSwitchBinSuggested: null,
  confidence: 0.9,
  evidence: ["Legacy fingerprint evidence."],
  warnings: [],
};

function variant(input: {
  id: string;
  hash: string;
  verificationStatus:
    | "verified"
    | "provisional";
  romFamily?: string;
}): StockVariantKnowledge {
  return {
    id: input.id,
    sha256: input.hash,
    binarySizeBytes: 2_097_152,
    romFamily:
      input.romFamily ??
      "00003076501103",
    verificationStatus:
      input.verificationStatus,
    confidence:
      input.verificationStatus === "verified"
        ? "high"
        : "unknown",
    provenance: [
      {
        sourceType: "test",
        sourceIdentifier: input.id,
        validationMethod:
          "Exact interpretation fixture validation",
        validationAuthority:
          "WP-004.2.2 test authority",
        validationDate: "2026-07-26",
      },
    ],
    supportingEvidence: ["Test evidence."],
    lifecycleStatus: "active",
    conflictState: "none",
  };
}

function interpret(input: {
  registry: StockVariantRegistry | null;
  hash?: string | null;
  size?: number | null;
  romFamily?: string | null;
  fingerprint?: RomFingerprintResult;
}) {
  const knowledge =
    requestRuntimeStockVariantKnowledge({
      registry: input.registry,
      lookup: {
        sha256: input.hash,
        binarySizeBytes: input.size,
        romFamily: input.romFamily,
      },
    });

  return interpretRuntimeStockVariantKnowledge({
    knowledge,
    legacyFingerprint:
      input.fingerprint ??
      legacyStockFingerprint,
  });
}

test("exact_verified establishes verified Stock interpretation", () => {
  const registry = createStockVariantRegistry([
    variant({
      id: "verified",
      hash: HASH_A,
      verificationStatus: "verified",
    }),
  ]);
  const result = interpret({
    registry,
    hash: HASH_A,
    size: 2_097_152,
    romFamily: "00003076501103",
  });

  assert.equal(result.outcome, "exact_verified");
  assert.equal(result.binaryType, "stock");
  assert.equal(result.exactBinaryMatch, true);
  assert.equal(
    result.knowledge.availability,
    "available"
  );
  assert.equal(
    result.knowledge.result?.verificationStatus,
    "verified"
  );
});

test("exact_candidate remains qualified and cannot preserve legacy Stock authority", () => {
  const registry = createStockVariantRegistry([
    variant({
      id: "candidate",
      hash: HASH_A,
      verificationStatus: "provisional",
    }),
  ]);
  const result = interpret({
    registry,
    hash: HASH_A,
    size: 2_097_152,
    romFamily: "00003076501103",
  });

  assert.equal(result.outcome, "exact_candidate");
  assert.equal(result.binaryType, "unknown");
  assert.equal(result.exactBinaryMatch, false);
  assert.equal(
    result.knowledge.result?.verificationStatus,
    "provisional"
  );
});

test("family_only preserves Unknown and candidate provenance", () => {
  const registry = createStockVariantRegistry([
    variant({
      id: "family",
      hash: HASH_A,
      verificationStatus: "verified",
    }),
  ]);
  const result = interpret({
    registry,
    hash: HASH_B,
    size: 2_097_152,
    romFamily: "00003076501103",
  });

  assert.equal(result.outcome, "family_only");
  assert.equal(result.binaryType, "unknown");
  assert.equal(
    result.knowledge.result?.candidateVariants.length,
    1
  );
});

test("conflict remains visible and cannot preserve legacy Stock authority", () => {
  const registry = createStockVariantRegistry([
    variant({
      id: "conflict-a",
      hash: HASH_A,
      verificationStatus: "verified",
    }),
    variant({
      id: "conflict-b",
      hash: HASH_A,
      verificationStatus: "verified",
      romFamily: "OTHER",
    }),
  ]);
  const result = interpret({
    registry,
    hash: HASH_A,
    size: 2_097_152,
  });

  assert.equal(result.outcome, "conflict");
  assert.equal(result.binaryType, "unknown");
  assert.equal(
    result.knowledge.result?.conflictState,
    "unresolved"
  );
  assert.ok(result.warnings.length > 0);
});

test("unknown remains Unknown", () => {
  const result = interpret({
    registry: createStockVariantRegistry(),
    hash: HASH_A,
    size: 2_097_152,
  });

  assert.equal(result.outcome, "unknown");
  assert.equal(result.binaryType, "unknown");
});

test("invalid remains invalid", () => {
  const result = interpret({
    registry: createStockVariantRegistry(),
    hash: "invalid",
    size: 2_097_152,
  });

  assert.equal(result.outcome, "invalid");
  assert.equal(result.binaryType, "unknown");
});

test("runtime unavailable remains explicit and preserves the legacy path", () => {
  const result = interpret({
    registry: null,
    hash: HASH_A,
    size: 2_097_152,
  });

  assert.equal(result.outcome, "runtime_unavailable");
  assert.equal(result.knowledge.availability, "unavailable");
  assert.equal(result.binaryType, "stock");
  assert.equal(result.exactBinaryMatch, true);
});

test("non-Stock legacy classifications remain available as supporting conclusions", () => {
  const modifiedFingerprint: RomFingerprintResult = {
    ...legacyStockFingerprint,
    binaryType: "modified",
    exactBinaryMatch: false,
  };
  const result = interpret({
    registry: createStockVariantRegistry(),
    hash: HASH_A,
    size: 2_097_152,
    fingerprint: modifiedFingerprint,
  });

  assert.equal(result.outcome, "unknown");
  assert.equal(result.binaryType, "modified");
  assert.equal(result.exactBinaryMatch, false);
});

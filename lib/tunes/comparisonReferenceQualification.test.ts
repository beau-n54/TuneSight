import assert from "node:assert/strict";
import test from "node:test";

import {
  createStockVariantRegistry,
} from "../knowledge/stockVariants.ts";
import type {
  StockVariantKnowledge,
} from "../knowledge/stockVariants.ts";
import {
  requestRuntimeStockVariantKnowledge,
} from "../knowledge/runtimeStockVariantKnowledge.ts";
import {
  qualifyComparisonReference,
} from "./comparisonReferenceQualification.ts";
import {
  classifyBinary,
} from "./binaryClassification.ts";

const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);
const SIZE = 2_097_152;

function variant(input: {
  id: string;
  hash?: string;
  romFamily?: string;
  verificationStatus?:
    | "verified"
    | "provisional";
}): StockVariantKnowledge {
  const verificationStatus =
    input.verificationStatus ?? "verified";

  return {
    id: input.id,
    sha256: input.hash ?? HASH_A,
    binarySizeBytes: SIZE,
    romFamily:
      input.romFamily ?? "TEST-ROM",
    verificationStatus,
    confidence:
      verificationStatus === "verified"
        ? "high"
        : "unknown",
    provenance: [
      {
        sourceType: "test",
        sourceIdentifier: input.id,
        validationMethod:
          verificationStatus === "verified"
            ? "Exact fixture verification"
            : undefined,
        validationAuthority:
          verificationStatus === "verified"
            ? "WP-004.2.4 test authority"
            : undefined,
        validationDate:
          verificationStatus === "verified"
            ? "2026-07-26"
            : undefined,
      },
    ],
    supportingEvidence: [
      "Controlled comparison fixture.",
    ],
    lifecycleStatus: "active",
    conflictState: "none",
  };
}

function qualification(input: {
  variants?: StockVariantKnowledge[];
  hash?: string | null;
  size?: number | null;
  romFamily?: string | null;
  unavailable?: boolean;
}) {
  return qualifyComparisonReference(
    requestRuntimeStockVariantKnowledge({
      registry: input.unavailable
        ? null
        : createStockVariantRegistry(
            input.variants ?? []
          ),
      lookup: {
        sha256: input.hash,
        binarySizeBytes: input.size,
        romFamily: input.romFamily,
      },
    })
  );
}

function comparisonClassification(
  reference:
    ReturnType<typeof qualification>
) {
  return classifyBinary({
    uploadedHash: HASH_B,
    uploadedSizeBytes: SIZE,
    comparison: {
      referenceClassification:
        reference.referenceClassification,
      referenceQualification: reference,
      totalChangedBytes: 12,
      uploadedSizeBytes: SIZE,
      referenceSizeBytes: SIZE,
    },
  });
}

test("exact_verified permits authoritative Stock comparison evidence", () => {
  const result = qualification({
    variants: [variant({ id: "verified" })],
    hash: HASH_A,
    size: SIZE,
    romFamily: "TEST-ROM",
  });

  assert.equal(result.outcome, "exact_verified");
  assert.equal(
    result.referenceClassification,
    "stock"
  );
  assert.equal(
    result.knowledge.availability,
    "available"
  );
  assert.equal(
    result.knowledge.result.provenanceSummary
      .length,
    1
  );
  assert.equal(
    comparisonClassification(result)
      .classification,
    "modified"
  );
});

test("exact_candidate cannot establish verified Stock or Modified", () => {
  const result = qualification({
    variants: [
      variant({
        id: "candidate",
        verificationStatus: "provisional",
      }),
    ],
    hash: HASH_A,
    size: SIZE,
    romFamily: "TEST-ROM",
  });
  const classified =
    comparisonClassification(result);

  assert.equal(result.outcome, "exact_candidate");
  assert.equal(
    result.referenceClassification,
    "unknown"
  );
  assert.equal(classified.classification, "unknown");
  assert.match(
    classified.warnings.join(" "),
    /exact_candidate/
  );
});

test("family_only remains unresolved", () => {
  const result = qualification({
    variants: [variant({ id: "family" })],
    hash: HASH_B,
    size: SIZE,
    romFamily: "TEST-ROM",
  });

  assert.equal(result.outcome, "family_only");
  assert.equal(
    result.referenceClassification,
    "unknown"
  );
});

test("conflict remains visible", () => {
  const result = qualification({
    variants: [
      variant({ id: "first" }),
      variant({
        id: "second",
        romFamily: "OTHER",
      }),
    ],
    hash: HASH_A,
    size: SIZE,
  });

  assert.equal(result.outcome, "conflict");
  assert.equal(
    result.knowledge.availability,
    "available"
  );
  assert.equal(
    result.knowledge.result.conflictState,
    "unresolved"
  );
});

test("unknown remains Unknown", () => {
  const result = qualification({
    hash: HASH_A,
    size: SIZE,
  });

  assert.equal(result.outcome, "unknown");
  assert.equal(
    result.referenceClassification,
    "unknown"
  );
});

test("invalid remains explicit", () => {
  const result = qualification({
    hash: "invalid",
    size: SIZE,
  });

  assert.equal(result.outcome, "invalid");
  assert.equal(
    result.referenceClassification,
    "unknown"
  );
});

test("runtime unavailable never falls back to workflow Stock authority", () => {
  const result = qualification({
    unavailable: true,
    hash: HASH_A,
    size: SIZE,
  });
  const classified =
    comparisonClassification(result);

  assert.equal(
    result.outcome,
    "runtime_unavailable"
  );
  assert.equal(
    result.referenceClassification,
    "unknown"
  );
  assert.equal(classified.classification, "unknown");
  assert.match(
    classified.warnings.join(" "),
    /runtime_unavailable/
  );
});

test("a user-designated reference alone cannot establish verified Stock", () => {
  const result = qualification({
    hash: HASH_A,
    size: SIZE,
  });

  assert.equal(
    result.referenceClassification,
    "unknown"
  );
  assert.equal(
    comparisonClassification(result)
      .classification,
    "unknown"
  );
});

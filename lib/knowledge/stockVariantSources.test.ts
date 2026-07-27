import assert from "node:assert/strict";
import test from "node:test";

import type { StockVariantKnowledge } from "./stockVariants.ts";
import { buildStockVariantKnowledgeRegistry } from "./stockVariantSources.ts";

const HASH = "a".repeat(64);

function record(input: {
  id: string;
  verificationStatus:
    | "verified"
    | "provisional";
}): StockVariantKnowledge {
  return {
    id: input.id,
    sha256: HASH,
    binarySizeBytes: 2_097_152,
    romFamily: "IJE0S",
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
          input.verificationStatus === "verified"
            ? "Exact source qualification"
            : undefined,
        validationAuthority:
          input.verificationStatus === "verified"
            ? "WP-004 source test authority"
            : undefined,
        validationDate:
          input.verificationStatus === "verified"
            ? "2026-07-26"
            : undefined,
      },
    ],
    supportingEvidence: [
      `Source evidence for ${input.id}.`,
    ],
    lifecycleStatus: "active",
    conflictState: "none",
  };
}

test("source composition preserves authoritative and provisional records", () => {
  const registry =
    buildStockVariantKnowledgeRegistry({
      authoritativeVariants: [
        record({
          id: "authoritative",
          verificationStatus: "verified",
        }),
      ],
      provisionalVariants: [
        record({
          id: "provisional",
          verificationStatus: "provisional",
        }),
      ],
    });

  const result = registry.lookup({
    sha256: HASH,
    binarySizeBytes: 2_097_152,
    romFamily: "IJE0S",
  });

  assert.equal(registry.variants.length, 2);
  assert.equal(result.status, "exact_verified");
  assert.equal(
    result.candidateVariants[0]?.id,
    "provisional"
  );
});

test("source roles cannot silently promote or weaken qualification", () => {
  assert.throws(
    () =>
      buildStockVariantKnowledgeRegistry({
        authoritativeVariants: [
          record({
            id: "candidate-in-authority",
            verificationStatus:
              "provisional",
          }),
        ],
        provisionalVariants: [],
      }),
    /contains non-authoritative record/
  );

  assert.throws(
    () =>
      buildStockVariantKnowledgeRegistry({
        authoritativeVariants: [],
        provisionalVariants: [
          record({
            id: "authority-in-candidates",
            verificationStatus:
              "verified",
          }),
        ],
      }),
    /contains authoritative record/
  );
});

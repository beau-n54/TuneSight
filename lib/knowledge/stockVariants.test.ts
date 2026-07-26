import assert from "node:assert/strict";
import test from "node:test";

import {
  createStockVariantRegistry,
} from "./stockVariants.ts";
import type { StockVariantKnowledge } from "./stockVariants.ts";

const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);
const HASH_C = "c".repeat(64);

function variant(input: Partial<StockVariantKnowledge> & Pick<StockVariantKnowledge, "id" | "sha256">): StockVariantKnowledge {
  return {
    binarySizeBytes: 2_097_152,
    romFamily: "IJE0S",
    verificationStatus: "verified",
    confidence: "high",
    provenance: [{ sourceType: "test", sourceIdentifier: input.id }],
    supportingEvidence: [`Evidence for ${input.id}`],
    lifecycleStatus: "active",
    discoveredAt: "2026-07-22T00:00:00.000Z",
    conflictState: "none",
    ...input,
  };
}

test("one ROM Family retains multiple independently qualified Stock Variants", () => {
  const first = variant({ id: "ije0s-a", sha256: HASH_A });
  const second = variant({
    id: "ije0s-b",
    sha256: HASH_B,
    binarySizeBytes: 2_097_153,
    verificationStatus: "provisional",
    confidence: "medium",
  });

  const initial = createStockVariantRegistry([first]);
  const expanded = initial.register(second);

  assert.equal(initial.variants.length, 1);
  assert.equal(expanded.variants.length, 2);
  assert.deepEqual(
    expanded.variantsForRomFamily("ije0s").map((item) => item.id),
    ["ije0s-a", "ije0s-b"]
  );
  assert.equal(expanded.variants[0].provenance[0].sourceIdentifier, "ije0s-a");
  assert.equal(expanded.variants[1].verificationStatus, "provisional");
});

test("exact SHA-256 and size returns the correct verified variant", () => {
  const registry = createStockVariantRegistry([
    variant({ id: "a", sha256: HASH_A }),
    variant({ id: "b", sha256: HASH_B }),
  ]);

  const result = registry.lookup({ sha256: HASH_B, binarySizeBytes: 2_097_152 });

  assert.equal(result.status, "exact_verified");
  assert.equal(result.variant?.id, "b");
  assert.deepEqual(result.exactMatchEvidence, {
    sha256Matched: true,
    binarySizeMatched: true,
  });
});

test("candidate exact knowledge cannot masquerade as authoritative", () => {
  const registry = createStockVariantRegistry([
    variant({
      id: "candidate",
      sha256: HASH_A,
      verificationStatus: "candidate",
      confidence: "high",
    }),
  ]);

  const result = registry.lookup({ sha256: HASH_A, binarySizeBytes: 2_097_152 });

  assert.equal(result.status, "exact_candidate");
  assert.equal(result.confidence, "high");
  assert.equal(result.verificationStatus, "candidate");
  assert.match(result.unresolvedReason ?? "", /not authoritatively verified/i);
});

test("wrong hash, wrong size, same size, and family-only evidence never return exact Stock", () => {
  const registry = createStockVariantRegistry([
    variant({ id: "known", sha256: HASH_A }),
  ]);

  assert.equal(
    registry.lookup({ sha256: HASH_B, binarySizeBytes: 2_097_152 }).status,
    "unknown"
  );
  assert.equal(
    registry.lookup({ sha256: HASH_A, binarySizeBytes: 2_097_153 }).status,
    "unknown"
  );
  assert.equal(
    registry.lookup({ sha256: HASH_B, binarySizeBytes: 2_097_152, romFamily: "IJE0S" }).status,
    "family_only"
  );
  assert.equal(registry.lookup({ romFamily: "IJE0S" }).status, "family_only");
});

test("filename-shaped family input alone remains family-only", () => {
  const registry = createStockVariantRegistry([
    variant({ id: "known", sha256: HASH_A }),
  ]);

  const result = registry.lookup({ romFamily: "IJE0S" });

  assert.equal(result.status, "family_only");
  assert.equal(result.variant, null);
});

test("conflicting exact Knowledge Objects remain visible", () => {
  const registry = createStockVariantRegistry([
    variant({ id: "claim-a", sha256: HASH_C }),
    variant({ id: "claim-b", sha256: HASH_C, romFamily: "OTHER" }),
  ]);

  const result = registry.lookup({ sha256: HASH_C, binarySizeBytes: 2_097_152 });

  assert.equal(result.status, "conflict");
  assert.equal(result.conflictState, "unresolved");
  assert.equal(result.candidateVariants.length, 2);
  assert.equal(result.variant, null);
});

test("contradictory ROM Family evidence prevents authoritative exact selection", () => {
  const registry = createStockVariantRegistry([
    variant({ id: "known", sha256: HASH_A }),
  ]);

  const result = registry.lookup({
    sha256: HASH_A,
    binarySizeBytes: 2_097_152,
    romFamily: "OTHER",
  });

  assert.equal(result.status, "conflict");
  assert.equal(result.variant, null);
  assert.match(result.unresolvedReason ?? "", /conflicts with the supplied ROM Family/i);
});

test("invalid and unsupported input remains explicit", () => {
  const registry = createStockVariantRegistry();

  assert.equal(
    registry.lookup({ sha256: "not-a-hash", binarySizeBytes: 1 }).status,
    "invalid"
  );
  assert.equal(
    registry.lookup({ sha256: HASH_A, binarySizeBytes: 2_097_152 }).status,
    "unknown"
  );
});

test("registry rejects destructive reuse of a stable identity", () => {
  const registry = createStockVariantRegistry([
    variant({ id: "stable", sha256: HASH_A }),
  ]);

  assert.throws(
    () => registry.register(variant({ id: "stable", sha256: HASH_B })),
    /already registered with different knowledge/
  );
});

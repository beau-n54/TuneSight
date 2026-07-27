import assert from "node:assert/strict";
import test from "node:test";

import {
  formatPresentedBinaryType,
  formatPresentedEvidence,
  formatPresentedWarnings,
} from "./romIdentityPresentation.ts";

const mappings = [
  ["exact_verified", "Stock"],
  ["exact_candidate", "Stock Candidate"],
  ["family_only", "Family Match"],
  ["conflict", "Conflict"],
  ["unknown", "Unknown"],
  ["invalid", "Invalid"],
  ["runtime_unavailable", "Runtime Unavailable"],
] as const;

for (const [outcome, expected] of mappings) {
  test(`presents ${outcome} as ${expected}`, () => {
    assert.equal(
      formatPresentedBinaryType({
        binaryType: "unknown",
        evidence: [
          `Qualified Stock Variant Knowledge outcome: ${outcome}.`,
        ],
      }),
      expected
    );
  });
}

test("preserves legacy presentation without qualified outcome evidence", () => {
  assert.equal(
    formatPresentedBinaryType({
      binaryType: "modified",
      evidence: [],
    }),
    "Modified Binary"
  );
});

test("does not upgrade exact_candidate verification wording", () => {
  assert.notEqual(
    formatPresentedBinaryType({
      binaryType: "unknown",
      evidence: [
        "Qualified Stock Variant Knowledge outcome: exact_candidate.",
        "Knowledge verification status: provisional.",
      ],
    }),
    "Stock"
  );
});

test("presents exact_candidate stock evidence as provisional", () => {
  const persistedEvidence = [
    "Uploaded binary exactly matches a verified stock library reference.",
    "Qualified Stock Variant Knowledge outcome: exact_candidate.",
    "Knowledge verification status: provisional.",
  ];

  assert.deepEqual(
    formatPresentedEvidence(persistedEvidence),
    [
      "Uploaded binary exactly matches a provisional stock library reference.",
      "Qualified Stock Variant Knowledge outcome: exact_candidate.",
      "Knowledge verification status: provisional.",
    ]
  );

  assert.equal(
    persistedEvidence[0],
    "Uploaded binary exactly matches a verified stock library reference."
  );
});

test("presents the exact_candidate warning without implying verified Stock", () => {
  const persistedWarnings = [
    "Exact binary knowledge exists but is not authoritatively verified.",
  ];

  assert.deepEqual(
    formatPresentedWarnings({
      evidence: [
        "Qualified Stock Variant Knowledge outcome: exact_candidate.",
      ],
      warnings: persistedWarnings,
    }),
    [
      "This binary exactly matches a known Stock Variant but has not yet completed authoritative verification.",
    ]
  );

  assert.equal(
    persistedWarnings[0],
    "Exact binary knowledge exists but is not authoritatively verified."
  );
});

test("preserves warnings for outcomes other than exact_candidate", () => {
  assert.deepEqual(
    formatPresentedWarnings({
      evidence: [
        "Qualified Stock Variant Knowledge outcome: family_only.",
      ],
      warnings: ["Family evidence only."],
    }),
    ["Family evidence only."]
  );
});

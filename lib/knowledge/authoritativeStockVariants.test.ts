import assert from "node:assert/strict";
import test from "node:test";

import {
  defineAuthoritativeStockVariants,
} from "./authoritativeStockVariants.ts";
import type {
  StockVariantKnowledge,
} from "./stockVariants.ts";

const HASH = "a".repeat(64);

function approvedRecord(
  overrides: Partial<StockVariantKnowledge> = {}
): StockVariantKnowledge {
  return {
    id: "approved-stock-variant",
    sha256: HASH,
    binarySizeBytes: 2_097_152,
    romFamily: "TEST-ROM",
    platform: "Test Platform",
    ecu: "Test ECU",
    verificationStatus:
      "authoritatively_verified",
    confidence: "high",
    provenance: [
      {
        sourceType:
          "founder-approved-evidence-package",
        sourceIdentifier:
          "TS-EVIDENCE-TEST-001",
        sourceLocation:
          "source-controlled test fixture",
        discoveryMethod:
          "Exact binary evidence review",
        validationMethod:
          "Independent SHA-256 and byte-length verification",
        validationAuthority:
          "Controlled test authority",
        validationDate: "2026-07-26",
        transformationHistory: [
          "No binary transformation.",
          "Record transcribed into the controlled Knowledge source.",
        ],
      },
    ],
    supportingEvidence: [
      "Controlled evidence fixture.",
    ],
    lifecycleStatus: "active",
    verifiedAt: "2026-07-26T00:00:00.000Z",
    conflictState: "none",
    ...overrides,
  };
}

test("complete approved authoritative record is admitted and frozen", () => {
  const source =
    defineAuthoritativeStockVariants([
      approvedRecord(),
    ]);

  assert.equal(source.length, 1);
  assert.equal(
    source[0].verificationStatus,
    "authoritatively_verified"
  );
  assert.equal(Object.isFrozen(source), true);
  assert.equal(
    Object.isFrozen(source[0].provenance),
    true
  );
});

test("incomplete authoritative records are rejected", () => {
  assert.throws(
    () =>
      defineAuthoritativeStockVariants([
        approvedRecord({ id: " " }),
      ]),
    /identity is required/
  );
  assert.throws(
    () =>
      defineAuthoritativeStockVariants([
        approvedRecord({ romFamily: " " }),
      ]),
    /requires a ROM Family/
  );
});

test("malformed hash and invalid byte length are rejected", () => {
  assert.throws(
    () =>
      defineAuthoritativeStockVariants([
        approvedRecord({
          sha256: "not-a-sha-256",
        }),
      ]),
    /invalid SHA-256/
  );
  assert.throws(
    () =>
      defineAuthoritativeStockVariants([
        approvedRecord({
          binarySizeBytes: 0,
        }),
      ]),
    /invalid binary size/
  );
});

test("validation authority, method, and date are mandatory", () => {
  const provenance =
    approvedRecord().provenance[0];

  for (const invalid of [
    { ...provenance, validationAuthority: " " },
    { ...provenance, validationMethod: " " },
    { ...provenance, validationDate: " " },
  ]) {
    assert.throws(
      () =>
        defineAuthoritativeStockVariants([
          approvedRecord({
            provenance: [invalid],
          }),
        ]),
      /requires verified provenance/
    );
  }

  assert.throws(
    () =>
      defineAuthoritativeStockVariants([
        approvedRecord({
          provenance: [
            {
              ...provenance,
              validationDate:
                "2026-02-30",
            },
          ],
        }),
      ]),
    /invalid validation date/
  );
});

test("supporting evidence is mandatory", () => {
  assert.throws(
    () =>
      defineAuthoritativeStockVariants([
        approvedRecord({
          supportingEvidence: [" "],
        }),
      ]),
    /requires supporting evidence/
  );
});

test("provisional records cannot enter the authoritative source", () => {
  assert.throws(
    () =>
      defineAuthoritativeStockVariants([
        approvedRecord({
          verificationStatus:
            "provisional",
        }),
      ]),
    /contains non-authoritative record/
  );
});

test("duplicate admission is deterministic", () => {
  const first = approvedRecord();
  const source =
    defineAuthoritativeStockVariants([
      first,
      approvedRecord(),
    ]);

  assert.equal(source.length, 1);

  assert.throws(
    () =>
      defineAuthoritativeStockVariants([
        first,
        approvedRecord({
          sha256: "b".repeat(64),
        }),
      ]),
    /already registered with different knowledge/
  );
});

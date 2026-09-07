import assert from "node:assert/strict";
import test from "node:test";
import { collectInternalIdentityObservations } from "./applicabilityEvidenceProposal.ts";
import { resolveGovernedRomIdentity } from "./governedRomIdentityResolution.ts";

const main = "00005D553C8C05";
const ancillary = "00005D553C7805";
const identifiers = [main, ancillary].map((identifier) => ({ identifier, kind: "calibration_identifier" as const, confidence: "known_identity" as const, reason: "Controlled BMW identity vocabulary", encodings: ["hex_encoded" as const] }));
const profile = [{ identity: main, detector: "bounded_hex_encoded_exact" as const, requiredOffsets: [524613, 7339265, 8388111] }];

test("a governed repeated primary marker resolves while a distinct ancillary marker remains disclosed", () => {
  const bytes = new Uint8Array(8 * 1024 * 1024);
  const primaryBytes = Buffer.from(main, "hex"), ancillaryBytes = Buffer.from(ancillary, "hex");
  for (const offset of profile[0]!.requiredOffsets) bytes.set(primaryBytes, offset);
  bytes.set(ancillaryBytes, 131371);
  const observations = collectInternalIdentityObservations({ binaryBytes: bytes, credibleIdentifiers: identifiers });
  const result = resolveGovernedRomIdentity({ observations, markerProfiles: profile });
  assert.equal(result.outcome, "resolved");
  assert.equal(result.identity, main);
  assert.deepEqual(result.primaryObservation?.offsets, profile[0]!.requiredOffsets);
  assert.deepEqual(result.ancillaryObservations.map((item) => item.normalizedForm), [ancillary]);
});

test("competing primary profiles remain a conflict and an unprofiled singleton remains deterministic", () => {
  const first = { observationId: "first", kind: "calibration_identifier", detector: "bounded_hex_encoded_exact", rawForm: main, normalizedForm: main, offsets: [1, 2, 3], occurrenceCount: 3, confidence: "known_identity", credibilityReason: "controlled", ambiguity: "multiple_credible_identities", binaryDigest: "a".repeat(64) } as const;
  const second = { ...first, observationId: "second", rawForm: ancillary, normalizedForm: ancillary, offsets: [4, 5, 6] } as const;
  const conflict = resolveGovernedRomIdentity({ observations: [first, second], markerProfiles: [{ identity: main, detector: first.detector, requiredOffsets: first.offsets }, { identity: ancillary, detector: second.detector, requiredOffsets: second.offsets }] });
  assert.equal(conflict.outcome, "conflict");
  assert.equal(conflict.identity, null);
  const singleton = resolveGovernedRomIdentity({ observations: [first], markerProfiles: [] });
  assert.equal(singleton.outcome, "resolved");
  assert.equal(singleton.identity, main);
});

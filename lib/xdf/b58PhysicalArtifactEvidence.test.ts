import assert from "node:assert/strict";
import test from "node:test";
import { B58_PHYSICAL_ARTIFACT_EVIDENCE, B58_PHYSICAL_INJECTOR_SCALAR_EVIDENCE } from "./b58PhysicalArtifactEvidence.ts";

test("physical B58 evidence preserves independent exact digests, marker topology and complete validation", () => {
  assert.equal(B58_PHYSICAL_ARTIFACT_EVIDENCE.length, 4);
  assert.equal(new Set(B58_PHYSICAL_ARTIFACT_EVIDENCE.map((item) => item.digest)).size, 4);
  assert.ok(B58_PHYSICAL_ARTIFACT_EVIDENCE.every((item) => /^[a-f0-9]{64}$/.test(item.digest) && item.primaryMarker.multiplicity === 3 && item.validation.extractionSuccess === item.validation.definitions && !item.repositoryDigestMatch));
  const founder = B58_PHYSICAL_ARTIFACT_EVIDENCE.slice(0, 2), thirdParty = B58_PHYSICAL_ARTIFACT_EVIDENCE.slice(2);
  assert.ok(founder.every((item) => item.identity === "00003076501103" && item.family === "B58gen1"));
  assert.ok(thirdParty.every((item) => item.identity === "00005D553C8C05" && item.family === "B58gen2"));
  assert.notEqual(founder[0]!.digest, founder[1]!.digest);
  assert.notEqual(thirdParty[0]!.digest, thirdParty[1]!.digest);
});

test("physical MapSwitch Injector Scalar remains an exact unmodified invalid conversion", () => {
  assert.deepEqual(B58_PHYSICAL_INJECTOR_SCALAR_EVIDENCE.stock.bytes, [195, 195]);
  assert.equal(B58_PHYSICAL_INJECTOR_SCALAR_EVIDENCE.stock.rawValue, 50_115);
  assert.equal(B58_PHYSICAL_INJECTOR_SCALAR_EVIDENCE.mapSwitch.rawValue, 0);
  assert.equal(B58_PHYSICAL_INJECTOR_SCALAR_EVIDENCE.mapSwitch.convertedValue, null);
  assert.equal(B58_PHYSICAL_INJECTOR_SCALAR_EVIDENCE.mapSwitch.finding, "Division by zero.");
});

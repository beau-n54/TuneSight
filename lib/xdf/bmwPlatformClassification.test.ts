import assert from "node:assert/strict";
import test from "node:test";
import { THIRD_PARTY_00005D553C8C05_PLATFORM_CLASSIFICATION } from "./bmwPlatformClassification.ts";

test("vehicle generation, ECU generation, ROM identity and historical source family remain separate non-transferable facts", () => {
  const value = THIRD_PARTY_00005D553C8C05_PLATFORM_CLASSIFICATION;
  assert.equal(value.vehicleEngineGeneration.value, "B58 Gen1");
  assert.equal(value.romSoftwareIdentity.value, "00005D553C8C05");
  assert.equal(value.definitionSourceFamily.value, "B58gen2");
  assert.equal(value.definitionSourceFamily.engineGenerationAssertion, false);
  assert.equal(value.subscriberPresentation.familyLabel, null);
  assert.ok(Object.isFrozen(value));
});

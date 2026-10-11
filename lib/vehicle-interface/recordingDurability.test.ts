import assert from "node:assert/strict";
import test from "node:test";
import { RECORDING_LIMITS, validateRecordingChunk } from "./offlineRecordingQueue.ts";
const sample = { channelKey: "engine.speed", channelRevisionId: "observed-rpm-v1", sequence: 1, acquiredAt: "2026-10-11T00:00:00.000Z", receivedAt: "2026-10-11T00:00:00.010Z", latencyMs: 10, droppedSincePrevious: 0, value: 0, unit: "rpm", provenance: "Synthetic boundary fixture" };
test("recording batches preserve measured zero and exact sequence without mutating prior metadata", () => {
  const prior = Object.freeze({ "engine.speed": 0 });
  assert.deepEqual(validateRecordingChunk([sample], prior), { "engine.speed": 1 });
  assert.equal(prior["engine.speed"], 0);
});
test("recording rejects regression, duplicates, non-finite observations and invalid acquisition times", () => {
  for (const change of [{ sequence: 0 }, { sequence: 1 }, { value: NaN }, { acquiredAt: "unknown" }, { droppedSincePrevious: -1 }]) assert.throws(() => validateRecordingChunk([{ ...sample, ...change }], { "engine.speed": 1 }));
});
test("recording chunks and payload strings have explicit finite resource bounds", () => {
  assert.throws(() => validateRecordingChunk(Array.from({ length: RECORDING_LIMITS.chunk + 1 }, (_, i) => ({ ...sample, sequence: i })), {}));
  assert.throws(() => validateRecordingChunk([{ ...sample, provenance: "x".repeat(1025) }], {}));
  assert.ok(RECORDING_LIMITS.samples > RECORDING_LIMITS.chunk);
  assert.ok(RECORDING_LIMITS.buffered <= 2 * RECORDING_LIMITS.chunk);
});

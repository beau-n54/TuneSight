import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { ENET_DME_ADDRESS, ENET_OBD_CHANNELS, ENET_TESTER_ADDRESS, decodeHsfzFrames, deriveBoostActualKpa, encodeDmeRequest, encodeHsfzFrame, parseObdResponse, resolveExactRomSoftwareIdentity, supportedPids } from "./enetObd.ts";
import { createCanonicalLiveRecording } from "./liveRecording.ts";

test("HSFZ framing is deterministic and preserves incomplete input", () => {
  const frame = encodeHsfzFrame(1, Uint8Array.from([1, 2, 3]));
  assert.deepEqual([...decodeHsfzFrames(frame).frames[0]!.payload], [1, 2, 3]);
  assert.equal(decodeHsfzFrames(frame.subarray(0, 7)).frames.length, 0);
  assert.deepEqual([...encodeDmeRequest(0x01, [0x0c]).subarray(6)], [ENET_TESTER_ADDRESS, ENET_DME_ADDRESS, 0x01, 0x0c]);
  const malformed = Buffer.alloc(6); malformed.writeUInt32BE(65_537); assert.throws(() => decodeHsfzFrames(malformed), /malformed/);
});

test("advertised Mode 01 support and qualified conversions are exact", () => {
  const response = Uint8Array.from([ENET_DME_ADDRESS, ENET_TESTER_ADDRESS, 0x41, 0x00, 0x00, 0x18, 0x00, 0x00]);
  assert.deepEqual(supportedPids(0, response), [0x0c, 0x0d]);
  const rpm = ENET_OBD_CHANNELS.find((item) => item.channel.channelKey === "engine.speed")!;
  assert.equal(parseObdResponse({ pid: rpm, payload: Uint8Array.from([ENET_DME_ADDRESS, ENET_TESTER_ADDRESS, 0x41, 0x0c, 0x1f, 0x40]) }), 2000);
  assert.throws(() => parseObdResponse({ pid: rpm, payload: Uint8Array.from([0, 0, 0, 0]) }), /unexpected/);
  assert.equal(deriveBoostActualKpa({ manifoldAbsoluteKpa: 145, ambientAbsoluteKpa: 100 }), 45);
  assert.equal(resolveExactRomSoftwareIdentity("expected", ["other", "expected"]), "expected"); assert.equal(resolveExactRomSoftwareIdentity("expected", ["different", null]), null);
});

test("recording contract preserves the same per-channel samples and rejects regression", () => {
  const sample = (channelKey: string, sequence: number) => ({ channelKey, channelRevisionId: `revision:${channelKey}`, sequence, acquiredAt: "2026-09-07T00:00:00.000Z", receivedAt: "2026-09-07T00:00:00.010Z", latencyMs: 10, droppedSincePrevious: 0, value: 1, unit: "unit", provenance: "controlled fixture" });
  const input = { recordingId: "recording", vehicleId: "vehicle", sessionId: "session", transport: "enet", dmeIdentity: null, romSoftwareIdentity: null, startedAt: "2026-09-07T00:00:00.000Z", stoppedAt: "2026-09-07T00:00:01.000Z" };
  assert.equal(createCanonicalLiveRecording({ ...input, samples: [sample("rpm", 1), sample("map", 0), sample("rpm", 2)] }).samples.length, 3);
  assert.throws(() => createCanonicalLiveRecording({ ...input, samples: [sample("rpm", 2), sample("rpm", 1)] }), /regressed/);
});

test("executable bridge has only the bounded read-only HTTP surface", () => {
  const source = readFileSync(new URL("../../scripts/tunesightVehicleBridge.ts", import.meta.url), "utf8");
  assert.deepEqual([...source.matchAll(/req\.url === "([^"]+)"/g)].map((match) => match[1]), ["/v1/status", "/v1/connect", "/v1/sample", "/v1/disconnect"]);
  assert.match(source, /127\.0\.0\.1/); assert.match(source, /Bearer/); assert.doesNotMatch(source, /req\.url === "\/v1\/(?:write|flash|code|clear|actuate|proxy)/);
});

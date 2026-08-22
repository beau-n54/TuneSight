import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { defineChannelDefinition, defineChannelObservation, definePhysicalAdapter, defineVehicleInterfaceSession, READ_ONLY_OPERATIONS } from "./nativeVehicleData.ts";
import { SyntheticReadOnlyVehicleTransport, type SyntheticTransportFixture } from "./syntheticReadOnlyVehicleTransport.ts";
import { runSyntheticRpmMilestone } from "./liveTelemetryCore.ts";

const rpm = () => defineChannelDefinition({ channelKey: "engine.speed", sourceEndpointId: "dme-primary", protocol: "synthetic-bmw-diagnostic-v1", serviceId: "read_data_by_identifier", requestId: "engine-speed", rawDataType: "uint16", decoding: { kind: "linear", scale: 1, offset: 0, qualification: "qualified" }, unit: "rpm", applicability: { state: "qualified", dmeFamilies: ["synthetic-b58", "synthetic-n54"] }, expectedRateHz: { minimum: 5, maximum: 50 }, provenance: "synthetic RPM definition revision 1" });
const fixture = (change: Partial<SyntheticTransportFixture> = {}): SyntheticTransportFixture => ({ endpointId: "dme-primary", protocol: "synthetic-bmw-diagnostic-v1", dmeFamily: "synthetic-b58", softwareIdentity: "SW-SYNTHETIC-1", calibrationIdentity: "CAL-SYNTHETIC-1", vin: "SYNTHETICVIN00001", rawValuesByChannelKey: { "engine.speed": [800, 1200, 1800] }, unsupportedChannelKeys: ["boost.unknown"], failAtSequence: null, ...change });
const times = [0, 1, 2].map((sequence) => ({ sequence, acquiredAt: `2026-08-22T00:00:0${sequence + 2}.000Z` }));

test("adapter capabilities are immutable and structurally read-only", () => {
  const adapter = definePhysicalAdapter({ adapterId: "adapter", adapterRevision: "1", manufacturer: "Test", model: "Read only", transportKinds: ["local_companion"], provenance: "fixture" });
  assert.deepEqual(adapter.readOnlyOperations, READ_ONLY_OPERATIONS);
  assert.ok(Object.isFrozen(adapter)); assert.ok(Object.isFrozen(adapter.readOnlyOperations));
  for (const forbidden of ["write", "clear_dtc", "flash", "program", "actuate", "reset"]) assert.ok(!adapter.readOnlyOperations.includes(forbidden as never));
});

test("session identity persists across immutable lifecycle revisions", () => {
  const base = { sessionReference: "session-1", adapterId: "adapter", adapterRevision: "1", transportKind: "synthetic" as const, startedAt: "2026-08-22T00:00:00.000Z", failureCode: null, provenance: "fixture" };
  const open = defineVehicleInterfaceSession({ ...base, state: "open", endedAt: null, disconnectReason: null });
  const closed = defineVehicleInterfaceSession({ ...base, state: "disconnected", endedAt: "2026-08-22T00:01:00.000Z", disconnectReason: "complete" });
  assert.equal(open.sessionId, closed.sessionId); assert.notEqual(open.sessionRevision, closed.sessionRevision); assert.ok(Object.isFrozen(closed));
  assert.throws(() => defineVehicleInterfaceSession({ ...base, state: "failed", endedAt: null, disconnectReason: null }), /Terminal session/);
});

test("session failure remains an explicit immutable terminal outcome", () => {
  const failed = defineVehicleInterfaceSession({ sessionReference: "failed-session", adapterId: "adapter", adapterRevision: "1", transportKind: "synthetic", state: "failed", startedAt: "2026-08-22T00:00:00.000Z", endedAt: "2026-08-22T00:00:03.000Z", disconnectReason: null, failureCode: "transport_unavailable", provenance: "deterministic failure fixture" });
  assert.equal(failed.state, "failed"); assert.equal(failed.failureCode, "transport_unavailable"); assert.ok(Object.isFrozen(failed));
});

test("channel stable identity is separate from decoding revision and applicability", () => {
  const first = rpm(); const revised = defineChannelDefinition({ ...first, decoding: { ...first.decoding, scale: 0.5 }, provenance: "requalified scale" });
  assert.equal(first.channelId, revised.channelId); assert.notEqual(first.revisionId, revised.revisionId); assert.ok(Object.isFrozen(first.applicability.dmeFamilies));
});

test("raw and qualified converted observations preserve exact revision, timing and sequence", () => {
  const channel = rpm(); const result = defineChannelObservation({ sessionId: "session", channel, sequence: 4, acquiredAt: "2026-08-22T00:00:04.000Z", sourceTimestamp: 3.5, rawValue: 2500, validity: "valid", finding: null, provenance: "fixture" });
  assert.equal(result.channelRevisionId, channel.revisionId); assert.equal(result.convertedValue, 2500); assert.equal(result.unit, "rpm"); assert.equal(result.sequence, 4);
});

test("unqualified decoding never manufactures a converted observation", () => {
  const channel = defineChannelDefinition({ ...rpm(), decoding: { kind: "linear", scale: 2, offset: 1, qualification: "unqualified" }, provenance: "unqualified fixture" });
  const result = defineChannelObservation({ sessionId: "session", channel, sequence: 0, acquiredAt: "2026-08-22T00:00:00.000Z", sourceTimestamp: null, rawValue: 10, validity: "valid", finding: null, provenance: "fixture" });
  assert.equal(result.convertedValue, null); assert.throws(() => defineChannelObservation({ sessionId: "session", channel, sequence: 0, acquiredAt: "2026-08-22T00:00:00.000Z", sourceTimestamp: null, rawValue: Number.NaN, validity: "valid", finding: null, provenance: "fixture" }), /finite/);
});

test("synthetic transport reports unsupported channels and enforces ordered streams", async () => {
  const transport = new SyntheticReadOnlyVehicleTransport(fixture()); await transport.open({ sessionReference: "unsupported", startedAt: "2026-08-22T00:00:00.000Z" }); await transport.connect();
  const channel = defineChannelDefinition({ ...rpm(), channelKey: "boost.unknown", requestId: "unknown", applicability: { state: "unsupported", dmeFamilies: [] }, provenance: "unsupported fixture" });
  const result = await transport.read(channel, times[0]); assert.equal(result.validity, "unsupported"); assert.equal(result.convertedValue, null);
  await assert.rejects(() => transport.stream(rpm(), [times[1], times[0]]), /increase strictly/);
});

test("synthetic transport exposes deterministic failure without fabricating observations", async () => {
  const transport = new SyntheticReadOnlyVehicleTransport(fixture({ failAtSequence: 1 })); await transport.open({ sessionReference: "failure", startedAt: "2026-08-22T00:00:00.000Z" }); await transport.connect();
  await assert.rejects(() => transport.stream(rpm(), times), /synthetic_transport_failure/);
});

test("synthetic RPM milestone connects identifies streams and disconnects cleanly", async () => {
  const result = await runSyntheticRpmMilestone({ transport: new SyntheticReadOnlyVehicleTransport(fixture()), channel: rpm(), sessionReference: "rpm-proof", startedAt: "2026-08-22T00:00:00.000Z", identifiedAt: "2026-08-22T00:00:01.000Z", samples: times, endedAt: "2026-08-22T00:00:05.000Z" });
  assert.equal(result.validation, "synthetic_not_physical"); assert.equal(result.ecuIdentityObservation.qualification, "synthetic"); assert.deepEqual(result.observations.map((value) => value.convertedValue), [800, 1200, 1800]); assert.equal(result.disconnectedSession.state, "disconnected"); assert.equal(result.connectedSession.sessionId, result.disconnectedSession.sessionId); assert.ok(Object.isFrozen(result));
});

test("repeated synthetic runs are deterministic", async () => {
  const run = () => runSyntheticRpmMilestone({ transport: new SyntheticReadOnlyVehicleTransport(fixture()), channel: rpm(), sessionReference: "repeat", startedAt: "2026-08-22T00:00:00.000Z", identifiedAt: "2026-08-22T00:00:01.000Z", samples: times, endedAt: "2026-08-22T00:00:05.000Z" });
  assert.deepEqual(await run(), await run());
});

test("transport interface contains no write programming or diagnostic mutation surface", () => {
  const source = readFileSync(new URL("./nativeVehicleData.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /\b(write|flash|program|clearDtc|actuate|resetEcu)\s*\(/i);
});

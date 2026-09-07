import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { MHD_ORANGE_PROFILE, THOR_WIFI_PROFILE } from "./adapterProfiles.ts";
import { validateBridgeRequest, type BridgePolicy } from "./localVehicleBridge.ts";
import { runSyntheticMultiChannelMilestone } from "./liveTelemetryCore.ts";
import { defineChannelDefinition } from "./nativeVehicleData.ts";
import { convertPressure, defineSyntheticPressureChannel } from "./pressureTelemetry.ts";
import { SyntheticReadOnlyVehicleTransport, type SyntheticTransportFixture } from "./syntheticReadOnlyVehicleTransport.ts";

const rpm = () => defineChannelDefinition({ channelKey: "engine.speed", sourceEndpointId: "dme-primary", protocol: "synthetic-bmw-diagnostic-v1", serviceId: "qualified_synthetic_read", requestId: "engine-speed", rawDataType: "uint16", decoding: { kind: "identity", scale: 1, offset: 0, qualification: "qualified" }, unit: "rpm", applicability: { state: "qualified", dmeFamilies: ["synthetic-n54"] }, expectedRateHz: { minimum: 5, maximum: 50 }, provenance: "synthetic-only RPM; no BMW request authority" });
const actual = () => defineSyntheticPressureChannel({ semantic: "charge_pressure_actual_absolute", channelKey: "charge-pressure.actual.absolute", requestId: "synthetic-charge-pressure-actual", dmeFamilies: ["synthetic-n54"], supported: true });
const target = (supported = true) => defineSyntheticPressureChannel({ semantic: "charge_pressure_target_absolute", channelKey: "charge-pressure.target.absolute", requestId: "synthetic-charge-pressure-target", dmeFamilies: ["synthetic-n54"], supported });
const fixture = (): SyntheticTransportFixture => ({ endpointId: "dme-primary", protocol: "synthetic-bmw-diagnostic-v1", dmeFamily: "synthetic-n54", softwareIdentity: "SYNTHETIC-SW", calibrationIdentity: "SYNTHETIC-CAL", vin: "SYNTHETICVIN00001", rawValuesByChannelKey: { "engine.speed": [800, 1800, 3000], "charge-pressure.actual.absolute": [1000, 1350, 1800], "charge-pressure.target.absolute": [1000, 1450, 1900] }, unsupportedChannelKeys: ["charge-pressure.unsupported"], failAtSequence: null });
const samples = [0, 1, 2].map((sequence) => ({ sequence, acquiredAt: `2026-08-22T01:00:0${sequence + 2}.000Z` }));

test("adapter profiles have stable non-colour identities and pending physical qualification", () => {
  assert.match(THOR_WIFI_PROFILE.profileId, /^vehicle-adapter-profile:/); assert.match(MHD_ORANGE_PROFILE.profileId, /^vehicle-adapter-profile:/); assert.notEqual(THOR_WIFI_PROFILE.profileId, MHD_ORANGE_PROFILE.profileId);
  assert.equal(THOR_WIFI_PROFILE.qualification, "externally_documented_physical_verification_pending"); assert.equal(MHD_ORANGE_PROFILE.qualification, "externally_documented_physical_verification_pending");
  assert.ok(!THOR_WIFI_PROFILE.profileId.includes("pink") && !MHD_ORANGE_PROFILE.profileId.includes("orange")); assert.ok(Object.isFrozen(THOR_WIFI_PROFILE));
});

test("shared WiFi serial boundary preserves profile-specific endpoint truth", () => {
  assert.equal(THOR_WIFI_PROFILE.transport, "wifi_serial_bridge"); assert.equal(MHD_ORANGE_PROFILE.transport, "wifi_serial_bridge");
  assert.deepEqual(THOR_WIFI_PROFILE.endpoints.map(({ host, port }) => ({ host, port })), [{ host: "192.168.4.1", port: 23 }]); assert.equal(MHD_ORANGE_PROFILE.endpoints.length, 0); assert.ok(MHD_ORANGE_PROFILE.unknownProperties.some((value) => value.includes("IP address")));
});

test("bridge is authenticated, vehicle-session scoped and accepts only profile endpoints and qualified channels", () => {
  const channel = rpm(); const token = "a".repeat(32); const policy: BridgePolicy = { bindAddress: "127.0.0.1", sessionAuthenticationToken: token, sessionAssociation: "web-session-1", maximumPayloadBytes: 4096, maximumChannelsPerRequest: 4, maximumSamplesPerRequest: 100, allowedChannelRevisionIds: [channel.revisionId] };
  const connected = validateBridgeRequest({ request: { kind: "connect", sessionAssociation: "web-session-1", profileRevision: THOR_WIFI_PROFILE.profileRevision, endpoint: { host: "192.168.4.1", port: 23, protocol: "tcp" } }, profile: THOR_WIFI_PROFILE, policy, encodedPayloadBytes: 128, authenticationToken: token }); assert.ok(Object.isFrozen(connected));
  assert.throws(() => validateBridgeRequest({ request: { kind: "connect", sessionAssociation: "web-session-1", profileRevision: THOR_WIFI_PROFILE.profileRevision, endpoint: { host: "8.8.8.8", port: 53, protocol: "udp" } }, profile: THOR_WIFI_PROFILE, policy, encodedPayloadBytes: 128, authenticationToken: token }), /not allowlisted/);
  assert.throws(() => validateBridgeRequest({ request: { kind: "read_channels", sessionAssociation: "web-session-1", profileRevision: THOR_WIFI_PROFILE.profileRevision, channelRevisionIds: ["arbitrary"], maximumSamples: 1 }, profile: THOR_WIFI_PROFILE, policy, encodedPayloadBytes: 128, authenticationToken: token }), /not allowlisted/);
  assert.throws(() => validateBridgeRequest({ request: { kind: "identify", sessionAssociation: "other", profileRevision: THOR_WIFI_PROFILE.profileRevision }, profile: THOR_WIFI_PROFILE, policy, encodedPayloadBytes: 64, authenticationToken: token }), /outside/);
  assert.throws(() => validateBridgeRequest({ request: { kind: "identify", sessionAssociation: "web-session-1", profileRevision: THOR_WIFI_PROFILE.profileRevision }, profile: THOR_WIFI_PROFILE, policy, encodedPayloadBytes: 64, authenticationToken: "wrong" }), /authentication/);
});

test("pressure conversions preserve canonical kPa deterministically", () => {
  assert.equal(convertPressure(100, "kPa", "bar"), 1); assert.equal(convertPressure(1, "bar", "kPa"), 100); assert.equal(convertPressure(convertPressure(100, "kPa", "psi"), "psi", "kPa"), 100); assert.equal(convertPressure(14.503773773, "psi", "bar").toFixed(9), "1.000000000");
});

test("actual and target pressure definitions remain semantically and identically separate", () => {
  const a = actual(); const t = target(); assert.equal(a.semantic, "charge_pressure_actual_absolute"); assert.equal(t.semantic, "charge_pressure_target_absolute"); assert.notEqual(a.channel.channelId, t.channel.channelId); assert.equal(a.canonicalUnit, "kPa"); assert.equal(t.channel.unit, "kPa"); assert.match(a.channel.provenance, /synthetic-only/); assert.match(t.channel.provenance, /no BMW request authority/);
});

test("unsupported target pressure remains explicit", () => {
  const unsupported = target(false); assert.equal(unsupported.channel.applicability.state, "unsupported"); assert.deepEqual(unsupported.channel.applicability.dmeFamilies, []);
});

test("multi-channel telemetry preserves simultaneous RPM actual and target observations", async () => {
  const channels = [rpm(), actual().channel, target().channel]; const run = () => runSyntheticMultiChannelMilestone({ transport: new SyntheticReadOnlyVehicleTransport(fixture()), channels, sessionReference: "multi", startedAt: "2026-08-22T01:00:00.000Z", identifiedAt: "2026-08-22T01:00:01.000Z", samples, endedAt: "2026-08-22T01:00:06.000Z" });
  const first = await run(); assert.equal(first.observations.length, 9); assert.equal(new Set(first.observations.map((value) => value.channelRevisionId)).size, 3); assert.deepEqual(first.observations.filter((value) => value.channelRevisionId === actual().channel.revisionId).map((value) => value.convertedValue), [100, 135, 180]); assert.equal(first.disconnectedSession.state, "disconnected"); assert.deepEqual(first, await run()); assert.ok(Object.isFrozen(first.observations));
});

test("multi-channel transport timeout creates no inferred channel result", async () => {
  const failed = { ...fixture(), failAtSequence: 1, failureCode: "synthetic_transport_timeout" as const }; await assert.rejects(() => runSyntheticMultiChannelMilestone({ transport: new SyntheticReadOnlyVehicleTransport(failed), channels: [rpm(), actual().channel], sessionReference: "failure", startedAt: "2026-08-22T01:00:00.000Z", identifiedAt: "2026-08-22T01:00:01.000Z", samples, endedAt: "2026-08-22T01:00:06.000Z" }), /synthetic_transport_timeout/);
});

test("bridge and adapter contracts expose no write or generic proxy operation", () => {
  for (const profile of [THOR_WIFI_PROFILE, MHD_ORANGE_PROFILE]) for (const forbidden of ["write", "flash", "program", "clear_dtc", "actuate", "reset", "proxy"]) assert.ok(!profile.readOnlyOperations.includes(forbidden as never));
  const source = ["adapterProfiles.ts", "localVehicleBridge.ts"].map((name) => readFileSync(new URL(name, import.meta.url), "utf8")).join("\n"); assert.doesNotMatch(source, /kind:\s*["'](?:write|flash|program|proxy|raw_payload)/i);
});

import assert from "node:assert/strict";
import test from "node:test";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { EnetReadOnlyConnection, createVehicleBridge } from "../../scripts/tunesightVehicleBridge.ts";
import { mockEnetVehicle } from "./enetBridge.fixtures.ts";
import { createCanonicalLiveRecording } from "./liveRecording.ts";
import { trustedBridgeOrigins } from "./bridgeSecurity.ts";
import { createTelemetryScheduler } from "./liveTelemetryScheduler.ts";
import { appendTrace, displayRange, isObservedSample, observedCadence, timeDomain, type ObservedSample } from "./liveTelemetryPresentation.ts";

const token = "test-only-session-token-32-characters-long", origin = "https://trusted.example";
for (const invalid of ["*", "https://*.example", "https://trusted.example/path", "http://public.example", "null", "", "https://user:pass@trusted.example", "https://trusted.example/"])
  test(`Bridge rejects non-exact/untrusted configuration: ${invalid}`, () => assert.throws(() => trustedBridgeOrigins(invalid)));
test("Hosted HTTPS exact origin and loopback development origins are permitted by explicit configuration", () => {
  assert.equal(trustedBridgeOrigins(origin).has(origin), true); assert.ok(trustedBridgeOrigins(undefined).has("http://localhost:3000"));
});
test("Real HTTP bridge enforces token, exact origin, Host, preflight and one transaction owner", async () => {
  const mock = await mockEnetVehicle({ delayMs: 8, injectUnrelated: true });
  const connection = new EnetReadOnlyConnection("127.0.0.1", mock.port), server = createVehicleBridge({ connection, token, origins: trustedBridgeOrigins(origin) });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const request = (path: string, init: RequestInit = {}) => fetch(url + path, { ...init, headers: { Origin: origin, Authorization: `Bearer ${token}`, ...init.headers } });
  try {
    assert.equal((await request("/v1/status", { headers: { Origin: "https://evil.example" } })).status, 403);
    const hostStatus = await new Promise<number | undefined>((resolve, reject) => { http.get(url + "/v1/status", { headers: { Host: "evil.example", Origin: origin, Authorization: `Bearer ${token}` } }, res => { res.resume(); resolve(res.statusCode); }).on("error", reject); });
    assert.equal(hostStatus, 403);
    assert.equal((await request("/v1/status", { headers: { Authorization: "Bearer wrong" } })).status, 401);
    const denied = await request("/v1/sample", { method: "OPTIONS", headers: { Origin: "https://evil.example", "Access-Control-Request-Method": "POST" } });
    assert.equal(denied.status, 403); assert.equal(denied.headers.get("Access-Control-Allow-Origin"), null);
    const allowed = await request("/v1/sample", { method: "OPTIONS", headers: { "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "authorization,content-type", "Access-Control-Request-Private-Network": "true", Authorization: "" } });
    assert.equal(allowed.status, 204); assert.equal(allowed.headers.get("Access-Control-Allow-Origin"), origin); assert.equal(allowed.headers.get("Access-Control-Allow-Private-Network"), "true");
    assert.equal((await request("/v1/sample", { method: "OPTIONS", headers: { "Access-Control-Request-Method": "DELETE" } })).status, 403);
    const connecting = request("/v1/connect", { method: "POST" });
    await new Promise(resolve => setTimeout(resolve, 10));
    assert.equal((await request("/v1/connect", { method: "POST" })).status, 409);
    const connected = await (await connecting).json();
    assert.equal(connected.session.identity.romSoftwareIdentity, null); assert.equal(connected.session.identityReads.applicationSoftwareVersion, "negative_response_0x31");
    assert.equal((await request("/v1/sample", { method: "POST", body: JSON.stringify({ channels: ["raw.arbitrary"] }) })).status, 400);
    const result = await (await request("/v1/sample", { method: "POST", body: JSON.stringify({ channels: ["engine.speed", "vehicle.speed"] }) })).json();
    assert.equal(result.samples[0].value, 2000); assert.equal(result.samples[1].value, 100);
    assert.ok(Date.parse(result.samples[1].acquiredAt) > Date.parse(result.samples[0].acquiredAt));
    assert.equal(result.samples[0].acquiredAt, result.samples[0].timing.responseReceivedAt);
    assert.ok(result.samples[0].timing.batchWaitMs >= 5); assert.ok(result.samples[1].timing.batchWaitMs < result.samples[0].timing.batchWaitMs);
    assert.equal((await request("/v1/flash", { method: "POST" })).status, 404);
    assert.ok(mock.requests.every(r => [0x01, 0x22].includes(r.service)));
  } finally { connection.disconnect(); server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); await mock.close(); }
});
test("Identity timeout closes the ambiguous socket, reconnects read-only, retains unknown ROM and live PID support", async () => {
  const mock = await mockEnetVehicle({ identity: "timeout" }), connection = new EnetReadOnlyConnection("127.0.0.1", mock.port, 40);
  try { const s = await connection.connect(); assert.equal(s?.identity.romSoftwareIdentity, null); assert.equal(s?.identityReads.vin, "vehicle_response_timeout"); assert.equal(s?.identityReads.applicationSoftwareVersion, "not_attempted_after_transport_timeout"); assert.equal((await connection.sample(["engine.speed"]))[0].value, 2000); }
  finally { connection.disconnect(); await mock.close(); }
});
test("A DID matching expected offline text alone is still not exact ROM authority", async () => {
  const mock = await mockEnetVehicle({ identity: "positive" }), connection = new EnetReadOnlyConnection("127.0.0.1", mock.port);
  try { const s = await connection.connect(); assert.equal(s?.identity.applicationSoftwareVersion, "00003076501103"); assert.equal(s?.identity.romSoftwareIdentity, null); }
  finally { connection.disconnect(); await mock.close(); }
});
test("Priority cadence admits slow channels without concurrent reads or invented samples", () => {
  const scheduler = createTelemetryScheduler(), selected = ["engine.speed", "vehicle.speed", "coolant.temperature", "oil.temperature", "charge.temperature", "control-module.voltage", "airflow.mass", "throttle.position", "boost.actual"];
  const seen = new Map<string, number[]>(); let now = 0;
  while (now < 10_000) { const next = scheduler.next(selected, now); if (!next.channels.length) { now += next.waitMs; continue; } for (const key of next.channels) seen.set(key, [...(seen.get(key) ?? []), now]); now += next.channels.length * 30; }
  assert.ok(seen.get("engine.speed")!.length >= 65); assert.ok(seen.get("oil.temperature")!.length >= 7);
  for (const key of selected.filter(k => k !== "boost.actual")) assert.ok(seen.get(key)!.length >= 7, key);
  assert.deepEqual(seen.get("map.absolute"), seen.get("ambient.pressure"));
  assert.deepEqual(scheduler.next([], now).channels, []);
});
test("Graphs retain irregular acquisition times, bounded history, observed rate and non-clamped display values", () => {
  const sample = (ms: number, value: number): ObservedSample => ({ key: "engine.speed", state: "valid", value, unit: "rpm", channelRevisionId: "test", sequence: ms, acquiredAt: new Date(ms).toISOString(), receivedAt: new Date(ms).toISOString(), latencyMs: 30 });
  let trace = appendTrace([], sample(1000, 1000)); trace = appendTrace(trace, sample(1100, 1500)); trace = appendTrace(trace, sample(1500, 9000));
  assert.deepEqual(trace.map(p => p.at), [1000, 1100, 1500]); assert.equal(observedCadence(trace)?.hz, 4); assert.equal(displayRange("engine.speed", trace)[1], 9000);
  assert.deepEqual(timeDomain(trace, 1000), [0, 1]); assert.equal(appendTrace(trace, sample(900, 1)), trace);
  assert.equal(appendTrace(trace, sample(63000, 2000)).length, 1); assert.equal(isObservedSample({ ...sample(1, 1), value: Number.NaN }), false);
});

test("Canonical recording JSON preserves measured stage timing without changing observed values or inventing ROM", () => {
  const at = "2026-09-25T00:00:00.000Z";
  const sample = { channelKey: "engine.speed", channelRevisionId: "observed-revision", sequence: 2, acquiredAt: at, receivedAt: at,
    latencyMs: 30, droppedSincePrevious: 0, value: 2000, unit: "rpm", provenance: "Controlled test observation",
    timing: { requestStartedAt: at, responseReceivedAt: at, responseReadyAt: at, transactionMs: 30, batchWaitMs: 0, httpRoundTripMs: 32 },
    presentationTiming: { commitAt: at, frameOpportunityAt: at, browserToCommitMs: 1, browserToFrameMs: 8, requestToFrameMs: 40 } };
  const recording = createCanonicalLiveRecording({ recordingId: "test", vehicleId: "fixture", sessionId: "fixture", transport: "fixture", dmeIdentity: "0x12", romSoftwareIdentity: null, startedAt: at, stoppedAt: at, samples: [sample] });
  const exported = JSON.parse(JSON.stringify(recording)); assert.deepEqual(exported.samples, [sample]); assert.equal(exported.romSoftwareIdentity, null); assert.equal(exported.contractVersion, "tunesight.live-recording.v1");
});

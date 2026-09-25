import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createLocalBridgeClient, bridgeFailureMessage, LocalBridgeError } from "./localBridgeClient.ts";
import { BRIDGE_PAIRING_CONTRACT, BRIDGE_TOKEN_LIFETIME_MS, BRIDGE_URL } from "./bridgePairingContract.ts";

const token = "controlled-browser-token-at-least-32-characters";
const reply = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
const paired = () => reply({ contract: BRIDGE_PAIRING_CONTRACT, token, expiresAt: Date.now() + BRIDGE_TOKEN_LIFETIME_MS });
test("Concurrent page probes and Connect serialize into one pairing followed by one authenticated connection", async () => {
  const requests: { path: string; init?: RequestInit }[] = []; let active = 0, maximum = 0;
  const client = createLocalBridgeClient({ networkDenied: async () => false, fetch: async (input, init) => {
    active++; maximum = Math.max(maximum, active); requests.push({ path: String(input), init });
    await new Promise(resolve => setTimeout(resolve, 10)); active--;
    return String(input).endsWith("/pair") ? paired() : reply({ connected: true });
  } });
  const [probe1, probe2, connection] = await Promise.all([client.pair(), client.pair(), client.call("/v1/connect")]);
  assert.equal(probe1, undefined); assert.equal(probe2, undefined); assert.deepEqual(connection, { connected: true });
  assert.equal(maximum, 1); assert.deepEqual(requests.map(r => r.path), [BRIDGE_URL + "/v1/pair", BRIDGE_URL + "/v1/connect"]);
  assert.equal(new Headers(requests[0].init?.headers).get("Authorization"), null);
  assert.equal(new Headers(requests[0].init?.headers).get("Content-Type"), "application/json");
  assert.equal(new Headers(requests[1].init?.headers).get("Authorization"), `Bearer ${token}`);
  for (const r of requests) { assert.equal(r.init?.cache, "no-store"); assert.equal(r.init?.credentials, "omit"); assert.equal(r.init?.redirect, "error"); assert.ok(!r.path.includes(token)); }
});
for (const status of [401, 404, 405, 426]) test(`Old bridge HTTP ${status} gives Update TuneSight Bridge without a generic connection failure`, async () => {
  const client = createLocalBridgeClient({ networkDenied: async () => false, fetch: async () => reply({ error: "authentication_failed" }, status) });
  await assert.rejects(client.pair(), (error: unknown) => error instanceof LocalBridgeError && error.code === "update_required" && error.message.startsWith("Update TuneSight Bridge"));
});
test("Unsupported pairing contract or missing/invalid expiry never admits an unqualified token", async () => {
  for (const payload of [{ contract: "old", token, expiresAt: Date.now() + 1000 }, { contract: BRIDGE_PAIRING_CONTRACT, token }, { contract: BRIDGE_PAIRING_CONTRACT, token, expiresAt: 1 }, { contract: BRIDGE_PAIRING_CONTRACT, token: "short", expiresAt: Date.now() + 1000 }]) {
    const client = createLocalBridgeClient({ networkDenied: async () => false, fetch: async () => reply(payload) });
    await assert.rejects(client.pair(), /Update TuneSight Bridge/);
  }
});
test("Confirmed LNA denial is distinguished from unavailable/CORS-opaque transport", async () => {
  let sent = 0;
  const denied = createLocalBridgeClient({ networkDenied: async () => true, fetch: async () => { sent++; return paired(); } });
  await assert.rejects(denied.pair(), /Local Network Access denied/); assert.equal(sent, 0);
  for (const permissionDenied of [false, true]) {
    let checks = 0;
    const failed = createLocalBridgeClient({ networkDenied: async () => ++checks > 1 && permissionDenied, fetch: async () => { throw new TypeError("Failed to fetch " + token); } });
    await assert.rejects(failed.pair(), (error: unknown) => {
      const message = bridgeFailureMessage(error); assert.ok(!message.includes(token));
      return message.includes(permissionDenied ? "Local Network Access denied" : "browser cannot distinguish");
    });
  }
});
test("Readable origin rejection and DME discovery failure produce actionable distinct messages", async () => {
  const rejected = createLocalBridgeClient({ networkDenied: async () => false, fetch: async () => reply({}, 403) });
  await assert.rejects(rejected.pair(), /Untrusted hosted origin/);
  const noVehicle = createLocalBridgeClient({ networkDenied: async () => false, fetch: async input => String(input).endsWith("/pair") ? paired() : reply({ error: "vehicle_discovery_timeout" }, 503) });
  await assert.rejects(noVehicle.call("/v1/connect"), /ENET cable\/DME not found/);
});
test("Manual fallback follows an old-bridge probe, bypasses automatic pairing, and still authenticates all reads", async () => {
  const paths: string[] = [];
  const client = createLocalBridgeClient({ networkDenied: async () => false, fetch: async (input, init) => {
    paths.push(String(input));
    if (String(input).endsWith("/pair")) return reply({}, 401);
    assert.equal(new Headers(init?.headers).get("Authorization"), `Bearer ${token}`); return reply({ ok: true });
  } });
  await assert.rejects(client.pair(), /Update TuneSight Bridge/);
  await client.setManualToken(token);
  for (const path of ["/v1/connect", "/v1/sample", "/v1/disconnect"] as const) await client.call(path);
  assert.equal(paths.filter(p => p.endsWith("/pair")).length, 1);
  await client.setManualToken(""); await assert.rejects(client.pair(), /Update TuneSight Bridge/);
});
test("Expired tokens renew; a bridge restart retries only a 401 once without exposing secret error text", async () => {
  let time = Date.now(), pairs = 0, connections = 0;
  const client = createLocalBridgeClient({ now: () => time, networkDenied: async () => false, fetch: async input => {
    if (String(input).endsWith("/pair")) { pairs++; return reply({ contract: BRIDGE_PAIRING_CONTRACT, token, expiresAt: time + BRIDGE_TOKEN_LIFETIME_MS }); }
    connections++; return connections === 1 ? reply({ error: token }, 401) : reply({ ok: true });
  } });
  await client.pair(); await client.call("/v1/connect"); assert.equal(pairs, 2); assert.equal(connections, 2);
  time += BRIDGE_TOKEN_LIFETIME_MS; await client.call("/v1/sample"); assert.equal(pairs, 3);
  const alwaysRejected = createLocalBridgeClient({ networkDenied: async () => false, fetch: async input => String(input).endsWith("/pair") ? paired() : reply({ error: token }, 401) });
  await assert.rejects(alwaysRejected.call("/v1/connect"), (error: unknown) => !bridgeFailureMessage(error).includes(token) && bridgeFailureMessage(error).includes("token rejected"));
});
test("Pairing errors are sanitized and automatic tokens have no browser persistence/logging sink", async () => {
  assert.ok(!bridgeFailureMessage(new Error(token)).includes(token));
  const client = createLocalBridgeClient({ networkDenied: async () => false, fetch: async input => String(input).endsWith("/pair") ? paired() : reply({ error: token }, 503) });
  await assert.rejects(client.call("/v1/connect"), (error: unknown) => !bridgeFailureMessage(error).includes(token));
  const source = readFileSync(new URL("./localBridgeClient.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /localStorage|sessionStorage|indexedDB|document\.cookie|console\./);
});

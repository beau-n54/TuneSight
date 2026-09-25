import assert from "node:assert/strict";
import test from "node:test";
import dgram from "node:dgram";
import type { AddressInfo } from "node:net";
import { readFileSync } from "node:fs";
import { discoverEnet, discoverOnInterfaces, supportedEnetInterface } from "./enetDiscovery.ts";
import { encodeHsfzFrame } from "./enetObd.ts";
import { DESKTOP_BRIDGE_COMPATIBILITY, compatibleBridgeVersion } from "./bridgeVersion.ts";
import { publicBridgeRelease } from "./bridgeRelease.ts";
import { createLocalBridgeClient } from "./localBridgeClient.ts";
import { BRIDGE_PAIRING_CONTRACT } from "./bridgePairingContract.ts";
import { createVehicleBridge, EnetReadOnlyConnection } from "../../scripts/tunesightVehicleBridge.ts";
import { trustedBridgeOrigins } from "./bridgeSecurity.ts";
import { mockEnetVehicle } from "./enetBridge.fixtures.ts";

test("Direct ENET admits only automatic link-local /16 candidates; Wi-Fi/private/loopback/manual networks fail closed", async () => {
  assert.ok(supportedEnetInterface({ address: "169.254.12.40", netmask: "255.255.0.0" }));
  for (const address of ["192.168.1.3", "127.0.0.1", "169.254.0.2", "169.254.255.2", "::1", "invalid", "169.254.1.999"]) assert.ok(!supportedEnetInterface({ address, netmask: "255.255.0.0" }));
  assert.ok(!supportedEnetInterface({ address: "169.254.12.40", netmask: "255.255.255.0" }));
  await assert.rejects(discoverEnet([]), /unsupported_network/);
});

test("Discovery binds the selected interface, ignores malformed UDP, and retains the matching local address", async () => {
  const responder = dgram.createSocket("udp4");
  await new Promise<void>(resolve => responder.bind(0, "127.0.0.2", resolve));
  const port = (responder.address() as AddressInfo).port;
  const requests: string[] = [];
  responder.on("message", (message, remote) => {
    requests.push(remote.address); assert.deepEqual(message, encodeHsfzFrame(0x11, new Uint8Array()));
    responder.send(Buffer.from("untrusted data"), remote.port, remote.address);
    responder.send(encodeHsfzFrame(0x01, new Uint8Array([1])), remote.port, remote.address);
    responder.send(encodeHsfzFrame(0x11, new Uint8Array([1])), remote.port, remote.address);
  });
  try {
    assert.deepEqual(await discoverOnInterfaces([{ address: "127.0.0.1", netmask: "255.0.0.0" }], { port, destination: "127.0.0.2", timeoutMs: 500 }), { host: "127.0.0.2", localAddress: "127.0.0.1" });
    assert.deepEqual(requests, ["127.0.0.1"]);
  } finally { responder.close(); }
});

test("No DME discovery response times out without inventing an endpoint", async () => {
  await assert.rejects(discoverOnInterfaces([{ address: "127.0.0.1", netmask: "255.0.0.0" }], { port: 9, destination: "127.0.0.2", timeoutMs: 30 }), /vehicle_discovery_timeout/);
});

test("Desktop reuses the read-only connection, bound TCP, observed support, versioned pairing and safe status callbacks", async () => {
  const vehicle = await mockEnetVehicle();
  const states: string[] = [];
  const connection = new EnetReadOnlyConnection(undefined, vehicle.port, 2500, async () => ({ host: "127.0.0.1", localAddress: "127.0.0.1" }));
  const server = createVehicleBridge({ connection, origins: trustedBridgeOrigins(undefined), version: DESKTOP_BRIDGE_COMPATIBILITY, onState: state => states.push(state) });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const headers = { Origin: "https://tunesight-beta.vercel.app", "Content-Type": "application/json" };
  try {
    const paired = await (await fetch(base + "/v1/pair", { headers })).json();
    assert.deepEqual(paired.version, DESKTOP_BRIDGE_COMPATIBILITY);
    assert.equal(vehicle.requests.length, 0);
    const auth = { ...headers, Authorization: `Bearer ${paired.token}` };
    assert.equal((await fetch(base + "/v1/connect", { method: "POST", headers: auth })).status, 200);
    const sample = await (await fetch(base + "/v1/sample", { method: "POST", headers: auth, body: JSON.stringify({ channels: ["engine.speed"] }) })).json();
    assert.equal(sample.samples[0].state, "valid"); assert.ok(sample.samples[0].acquiredAt);
    assert.equal((await fetch(base + "/v1/disconnect", { method: "POST", headers: auth })).status, 200);
    assert.deepEqual(states, ["connected", "disconnected"]);
    assert.ok(!JSON.stringify(states).includes(paired.token));
  } finally { connection.disconnect(); server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); await vehicle.close(); }
});

test("Compatibility rejects future protocol or newer hosted requirements; legacy pairing remains truthful", async () => {
  assert.ok(compatibleBridgeVersion(DESKTOP_BRIDGE_COMPATIBILITY));
  for (const version of [{ ...DESKTOP_BRIDGE_COMPATIBILITY, protocolVersion: 2 }, { ...DESKTOP_BRIDGE_COMPATIBILITY, minimumHostedVersion: 2 }, { ...DESKTOP_BRIDGE_COMPATIBILITY, minimumHostedVersion: 0 }, { ...DESKTOP_BRIDGE_COMPATIBILITY, desktopVersion: "<secret>" }]) {
    assert.ok(!compatibleBridgeVersion(version));
    const client = createLocalBridgeClient({ networkDenied: async () => false, fetch: async () => Response.json({ contract: BRIDGE_PAIRING_CONTRACT, token: "a".repeat(32), expiresAt: Date.now() + 60000, version }) });
    await assert.rejects(client.pair(), /Update TuneSight Bridge/); assert.equal(client.version(), null);
  }
  for (const version of [undefined, DESKTOP_BRIDGE_COMPATIBILITY]) {
    const client = createLocalBridgeClient({ networkDenied: async () => false, fetch: async () => Response.json({ contract: BRIDGE_PAIRING_CONTRACT, token: "b".repeat(32), expiresAt: Date.now() + 60000, ...(version ? { version } : {}) }) });
    await client.pair(); assert.deepEqual(client.version(), version ?? null); assert.ok(!JSON.stringify(client.version()).includes("b".repeat(32)));
  }
});

test("Desktop network failure categories are specific and contain no private transport details", async () => {
  for (const code of ["unsupported_network", "enet_cable_missing"]) {
    const client = createLocalBridgeClient({ networkDenied: async () => false, fetch: async url => String(url).endsWith("/pair") ? Response.json({ contract: BRIDGE_PAIRING_CONTRACT, token: "c".repeat(32), expiresAt: Date.now() + 60000 }) : Response.json({ error: code }, { status: 503 }) });
    await assert.rejects(client.call("/v1/connect"), error => error instanceof Error && "code" in error && error.code === code && !error.message.includes("c".repeat(32)));
  }
});

test("Public download stays absent for drafts, unsigned or unvalidated releases and untrusted URLs", () => {
  const version = "0.1.0-beta.1";
  const latest = { version, sha256: "a".repeat(64), bytes: 100, signed: true, physicalValidation: "passed", url: `https://github.com/beau-n54/TuneSight/releases/download/bridge-v${version}/TuneSight-Bridge-${version}-windows-x64-setup.exe` };
  assert.ok(publicBridgeRelease({ schema: 1, latest }));
  for (const value of [null, { schema: 1, latest: null }, { schema: 2, latest }, ...[{ signed: false }, { physicalValidation: "pending" }, { sha256: "invalid" }, { bytes: 0 }, { url: "https://evil.example/installer.exe" }].map(overrides => ({ schema: 1, latest: { ...latest, ...overrides } }))]) assert.equal(publicBridgeRelease(value), null);
  assert.equal(publicBridgeRelease(JSON.parse(readFileSync("public/bridge/releases.json", "utf8"))), null);
});


test("Download status performs a fresh authenticated read even while pairing is cached, and strips unknown metadata", async () => {
  let alive = true, pairs = 0, statuses = 0;
  const client = createLocalBridgeClient({ networkDenied: async () => false, fetch: async (url, init) => {
    if (!alive) throw new TypeError("offline");
    if (String(url).endsWith("/pair")) { pairs++; return Response.json({ contract: BRIDGE_PAIRING_CONTRACT, token: "d".repeat(32), expiresAt: Date.now() + 60000, version: { ...DESKTOP_BRIDGE_COMPATIBILITY, arbitrarySecret: "not-public-metadata" } }); }
    assert.equal(init?.method, "GET"); assert.equal(new Headers(init?.headers).get("Authorization"), `Bearer ${"d".repeat(32)}`);
    statuses++; return Response.json({ state: "ready", authenticatedSession: false });
  } });
  await client.call("/v1/status"); await client.call("/v1/status");
  assert.equal(pairs, 1); assert.equal(statuses, 2); assert.deepEqual(client.version(), DESKTOP_BRIDGE_COMPATIBILITY);
  alive = false; await assert.rejects(client.call("/v1/status"), /Local bridge unavailable/);
});

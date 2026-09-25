import assert from "node:assert/strict";
import test from "node:test";
import http from "node:http";
import { readFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { createVehicleBridge, EnetReadOnlyConnection } from "../../scripts/tunesightVehicleBridge.ts";
import { mockEnetVehicle } from "./enetBridge.fixtures.ts";
import { trustedBridgeOrigins } from "./bridgeSecurity.ts";
import { BRIDGE_PAIRING_CONTRACT, BRIDGE_TOKEN_LIFETIME_MS, DEFAULT_BRIDGE_ORIGINS } from "./bridgePairingContract.ts";

const token = "test-only-pairing-token-at-least-32-characters", origin = DEFAULT_BRIDGE_ORIGINS[0];
async function fixture(run: (f: { server: http.Server; url: string; requests: unknown[]; advance: () => void }) => Promise<void>) {
  const vehicle = await mockEnetVehicle(), connection = new EnetReadOnlyConnection("127.0.0.1", vehicle.port);
  let time = Date.now();
  const server = createVehicleBridge({ token, connection, origins: trustedBridgeOrigins(undefined), now: () => time });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  try { await run({ server, url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, requests: vehicle.requests, advance: () => { time += BRIDGE_TOKEN_LIFETIME_MS; } }); }
  finally { connection.disconnect(); server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); await vehicle.close(); }
}
const headers = { Origin: origin, "Content-Type": "application/json" };
test("Hosted and both development origins pair without a bearer, only on loopback, with no-store and no vehicle access", () => fixture(async ({ url, requests }) => {
  for (const allowed of DEFAULT_BRIDGE_ORIGINS) {
    const response = await fetch(url + "/v1/pair", { headers: { ...headers, Origin: allowed } });
    assert.equal(response.status, 200); assert.equal(response.headers.get("Access-Control-Allow-Origin"), allowed);
    assert.equal(response.headers.get("Cache-Control"), "no-store"); assert.equal(response.headers.get("Set-Cookie"), null);
    const paired = await response.json(); assert.equal(paired.contract, BRIDGE_PAIRING_CONTRACT); assert.equal(paired.token, token);
    assert.ok(paired.expiresAt > Date.now()); assert.ok(paired.expiresAt <= Date.now() + BRIDGE_TOKEN_LIFETIME_MS);
    assert.deepEqual(Object.keys(paired).sort(), ["contract", "expiresAt", "token", "version"]);
    assert.deepEqual(paired.version, { desktopVersion: null, protocolVersion: 1, minimumHostedVersion: 1 });
  }
  assert.equal(requests.length, 0);
}));
test("Pairing rejects missing, wildcard, malformed and spoofed origins without exposing token or CORS grant", () => fixture(async ({ url }) => {
  for (const denied of [undefined, "null", "*", "https://evil.example", origin + ".evil.example", origin + "/", origin + " https://evil.example", "https://user@tunesight-beta.vercel.app"]) {
    const response = await fetch(url + "/v1/pair", { headers: { "Content-Type": "application/json", ...(denied ? { Origin: denied } : {}) } });
    assert.equal(response.status, 403); assert.equal(response.headers.get("Access-Control-Allow-Origin"), null);
    assert.ok(!(await response.text()).includes(token));
  }
  const duplicate = await new Promise<{ status?: number; body: string }>((resolve, reject) => {
    http.get(url + "/v1/pair", { headers: ["Origin", origin, "Origin", "https://evil.example", "Host", new URL(url).host, "Content-Type", "application/json"] }, res => {
      let body = ""; res.on("data", chunk => { body += chunk; }); res.on("end", () => resolve({ status: res.statusCode, body }));
    }).on("error", reject);
  });
  assert.equal(duplicate.status, 403); assert.ok(!duplicate.body.includes(token));
}));
test("Invalid Host and non-loopback listener metadata fail closed even with an approved Origin", () => fixture(async ({ url, server }) => {
  const invalidHost = await new Promise<number | undefined>((resolve, reject) => {
    http.get(url + "/v1/pair", { headers: { ...headers, Host: "evil.example" } }, res => { res.resume(); resolve(res.statusCode); }).on("error", reject);
  });
  assert.equal(invalidHost, 403);
  // Keep the test listener physically on loopback; simulate accidental wildcard binding metadata.
  const address = server.address.bind(server), actual = address() as AddressInfo;
  server.address = () => ({ ...actual, address: "0.0.0.0" });
  try { const response = await fetch(url + "/v1/pair", { headers }); assert.equal(response.status, 403); assert.ok(!(await response.text()).includes(token)); }
  finally { server.address = address; }
}));
test("CORS preflight permits approved JSON pairing and LNA/PNA headers, rejects other methods/headers", () => fixture(async ({ url }) => {
  const preflight = { Origin: origin, "Access-Control-Request-Method": "GET", "Access-Control-Request-Headers": "content-type", "Access-Control-Request-Private-Network": "true" };
  const response = await fetch(url + "/v1/pair", { method: "OPTIONS", headers: preflight });
  assert.equal(response.status, 204); assert.equal(response.headers.get("Access-Control-Allow-Private-Network"), "true");
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), origin); assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.equal(await response.text(), "");
  for (const override of [{ "Access-Control-Request-Method": "DELETE" }, { "Access-Control-Request-Headers": "x-evil" }, { "Access-Control-Request-Private-Network": "false" }, { Origin: "https://evil.example" }]) {
    const rejected = await fetch(url + "/v1/pair", { method: "OPTIONS", headers: { ...preflight, ...override } });
    assert.equal(rejected.status, 403); assert.ok(!(await rejected.text()).includes(token));
  }
  assert.equal((await fetch(url + "/v1/pair", { headers: { Origin: origin } })).status, 400);
}));
test("Connect, sample and disconnect still require the correct non-expired bearer after pairing", () => fixture(async ({ url, requests, advance }) => {
  await fetch(url + "/v1/pair", { headers });
  for (const route of ["connect", "sample", "disconnect"]) for (const authentication of [undefined, "Bearer incorrect"]) {
    const response = await fetch(url + "/v1/" + route, { method: "POST", headers: { ...headers, ...(authentication ? { Authorization: authentication } : {}) }, body: "{}" });
    assert.equal(response.status, 401); assert.ok(!(await response.text()).includes(token));
  }
  assert.equal(requests.length, 0);
  const authenticated = { ...headers, Authorization: `Bearer ${token}` };
  assert.equal((await fetch(url + "/v1/connect", { method: "POST", headers: authenticated })).status, 200);
  assert.equal((await fetch(url + "/v1/sample", { method: "POST", headers: authenticated, body: JSON.stringify({ channels: ["engine.speed"] }) })).status, 200);
  assert.equal((await fetch(url + "/v1/disconnect", { method: "POST", headers: authenticated })).status, 200);
  advance();
  assert.equal((await fetch(url + "/v1/connect", { method: "POST", headers: authenticated })).status, 401);
  const renewed = await (await fetch(url + "/v1/pair", { headers })).json(); assert.notEqual(renewed.token, token);
  assert.equal((await fetch(url + "/v1/connect", { method: "POST", headers: { ...headers, Authorization: `Bearer ${renewed.token}` } })).status, 200);
}));
test("Parser exceptions, unknown routes and startup logging do not disclose a token", () => fixture(async ({ url }) => {
  const authenticated = { ...headers, Authorization: `Bearer ${token}` };
  const malformed = await fetch(url + "/v1/sample", { method: "POST", headers: authenticated, body: token });
  assert.equal(malformed.status, 503); assert.deepEqual(await malformed.json(), { error: "bridge_failure" });
  for (const route of ["flash", "code", "clear", "actuate", "proxy", "pair?token=not-a-token"]) {
    const response = await fetch(url + "/v1/" + route, { method: "POST", headers: authenticated }); assert.equal(response.status, 404); assert.ok(!(await response.text()).includes(token));
  }
  const source = readFileSync(new URL("../../scripts/tunesightVehicleBridge.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /console\.(?:log|error|warn)\([^;]*\$\{token\}/);
  assert.doesNotMatch(source, /process\.env\.TUNESIGHT_BRIDGE_TOKEN/);
}));

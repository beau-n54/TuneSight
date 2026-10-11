import test from "node:test";
import assert from "node:assert/strict";
import { betaAccessDecision, hasAdministratorAuthority, isSameOriginMutation, isSubscriberPath, safeReturnPath, type BetaProfile } from "./accessPolicy.ts";
import { boundedRequest } from "./requestBounds.ts";
import { fetchWithTimeout } from "./networkTimeout.ts";

const approved: BetaProfile = { legal_accepted: true, beta_access: true, beta_status: "approved", beta_expires_at: null, role: "user" };
test("controlled beta requires affirmative server profile authority including suspension and expiry", () => {
  assert.equal(betaAccessDecision(approved), "allowed");
  for (const profile of [null, { ...approved, beta_access: false }, { ...approved, beta_status: null }, { ...approved, beta_status: "awaiting" }, { ...approved, legal_accepted: false }, { ...approved, beta_expires_at: "invalid" }, { ...approved, beta_expires_at: "2000-01-01" }, { ...approved, beta_status: "suspended", role: "admin" }]) assert.notEqual(betaAccessDecision(profile), "allowed");
  assert.equal(betaAccessDecision({ ...approved, beta_expires_at: "2030-01-01" }, Date.parse("2026-01-01")), "allowed");
  assert.equal(hasAdministratorAuthority(approved), false);
  assert.equal(hasAdministratorAuthority({ ...approved, role: "admin" }), true);
  assert.equal(hasAdministratorAuthority({ ...approved, role: "ADMIN" }), false);
});
test("all subscriber roots and nested paths protected without matching unrelated prefixes", () => {
  for (const root of ["dashboard", "garage", "account", "vehicle", "mods", "logs", "checkout"]) {
    assert.equal(isSubscriberPath(`/${root}`), true);
    assert.equal(isSubscriberPath(`/${root}/a/b`), true);
    assert.equal(isSubscriberPath(`/${root}-public`), false);
  }
});
test("return paths allow nested navigation/reset and reject URL/encoding ambiguity", () => {
  for (const path of ["/dashboard", "/reset-password", "/dashboard/vehicles/123/calibration?definition=abc"]) assert.equal(safeReturnPath(path), path);
  for (const path of ["https://evil.test", "//evil.test", "/\\evil.test", "/%2fevil.test", "/%5cevil.test", "%2f%2fevil.test", "/%252fevil.test", "/%00x", "/%0ax", "/%zz"]) assert.equal(safeReturnPath(path), "/dashboard");
});
test("mutation requires an exact same origin; no missing/spoofed/cross-site origin", () => {
  for (const origin of [null, "null", "https://evil.test", "https://tunesight-beta.vercel.app.evil.test", "https://tunesight-beta.vercel.app/"]) {
    assert.equal(isSameOriginMutation(new Request("https://tunesight-beta.vercel.app/api/x", { headers: origin ? { origin } : {} })), false);
  }
  assert.equal(isSameOriginMutation(new Request("https://tunesight-beta.vercel.app/api/x", { headers: { origin: "https://tunesight-beta.vercel.app" } })), true);
  assert.equal(isSameOriginMutation(new Request("http://localhost:3000/api/x", { headers: { origin: "http://localhost:3000" } })), true);
});
test("bounded reader enforces declared and actual body limits including chunked uploads", async () => {
  await assert.rejects(boundedRequest(new Request("https://local.test", { method: "POST", body: "small", headers: { "content-length": "100" } }), 10), /too large/);
  await assert.rejects(boundedRequest(new Request("https://local.test", { method: "POST", body: "123456" }), 5), /too large/);
  const accepted = await boundedRequest(new Request("https://local.test", { method: "POST", body: "12345" }), 5);
  assert.equal(await accepted.text(), "12345");
});
test("network deadline remains active after response headers and honours caller cancellation", async () => {
  const originalFetch = globalThis.fetch;
  const keepAlive = setTimeout(() => undefined, 1000);
  try {
    globalThis.fetch = async (_input, init) => new Response(new ReadableStream({
      start(controller) {
        const signal = init!.signal!;
        if (signal.aborted) controller.error(signal.reason);
        else signal.addEventListener("abort", () => controller.error(signal.reason), { once: true });
      },
    }));
    const response = await fetchWithTimeout("https://synthetic.invalid", {}, 20);
    await assert.rejects(response.text(), { name: "TimeoutError" });
    const controller = new AbortController();
    const cancelled = await fetchWithTimeout("https://synthetic.invalid", { signal: controller.signal }, 1000);
    controller.abort();
    await assert.rejects(cancelled.text(), { name: "AbortError" });
  } finally { globalThis.fetch = originalFetch; clearTimeout(keepAlive); }
});

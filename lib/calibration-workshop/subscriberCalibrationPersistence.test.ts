import assert from "node:assert/strict";
import test from "node:test";
import { decodeSubscriberSession, encodeSubscriberSession, expiredObjectPaths, issueUploadLease, resolveUploadLease } from "./subscriberCalibrationPersistence.ts";
import { decodeSubscriberUploadResponse, MAX_SUBSCRIBER_RESPONSE_BYTES } from "./subscriberUploadContract.ts";

const failure = Object.freeze({ status: "coverage_unavailable" as const, title: "Unavailable", message: "Governed coverage unavailable", identity: null, digest: null, container: "raw_binary", byteLength: 8 * 1024 * 1024, coverage: null, timings: Object.freeze({}) });

test("an upload above the Function payload limit is represented by a small owner-and-vehicle scoped lease", () => {
  const id = "A".repeat(32), secret = "test-only-secret", now = 1_800_000_000_000, expiresAt = now + 20_000, lease = issueUploadLease(id, expiresAt, "bin", "owner-a", "vehicle-a", secret);
  assert.ok(Buffer.byteLength(JSON.stringify({ action: "process", vehicleId: "vehicle-a", lease })) < 1024);
  assert.deepEqual(resolveUploadLease(lease, "owner-a", "vehicle-a", secret, now), { id, extension: "bin" });
  assert.equal(resolveUploadLease(lease, "owner-b", "vehicle-a", secret, now), null);
  assert.equal(resolveUploadLease(lease, "owner-a", "vehicle-b", secret, now), null);
  assert.equal(resolveUploadLease(lease, "owner-a", "vehicle-a", secret, expiresAt), null);
});

test("abandoned raw objects are selected for bounded TTL cleanup", () => {
  const paths = expiredObjectPaths([{ name: "old", created_at: "2026-01-01T00:00:00Z" }, { name: "new", created_at: "2026-01-01T03:00:00Z" }], Date.parse("2026-01-01T03:30:00Z"), 2 * 60 * 60 * 1000, "raw");
  assert.deepEqual(paths, ["raw/old"]);
});

test("derived Workshop evidence survives invocation boundaries and remains isolated", () => {
  const bytes = encodeSubscriberSession("owner-a", "vehicle-a", 20_000, failure);
  assert.equal(decodeSubscriberSession(Uint8Array.from(bytes), "owner-a", "vehicle-a", 10_000)?.status, "coverage_unavailable");
  assert.equal(decodeSubscriberSession(bytes, "owner-b", "vehicle-a", 10_000), null);
  assert.equal(decodeSubscriberSession(bytes, "owner-a", "vehicle-b", 10_000), null);
  assert.equal(decodeSubscriberSession(bytes, "owner-a", "vehicle-a", 20_000), null);
});

test("client rejects empty, HTML, invalid and oversized infrastructure responses before JSON use", async () => {
  await assert.rejects(() => decodeSubscriberUploadResponse(new Response("", { status: 504, headers: { "content-type": "application/json" } })), /empty response/);
  await assert.rejects(() => decodeSubscriberUploadResponse(new Response("Request Entity Too Large", { status: 413, headers: { "content-type": "text/plain" } })), /non-JSON response/);
  await assert.rejects(() => decodeSubscriberUploadResponse(new Response("<html>", { status: 500, headers: { "content-type": "application/json" } })), /invalid JSON/);
  await assert.rejects(() => decodeSubscriberUploadResponse(new Response("x", { status: 500, headers: { "content-type": "application/json", "content-length": String(MAX_SUBSCRIBER_RESPONSE_BYTES + 1) } })), /oversized response/);
});

test("structured success and governed-unavailable responses remain decodable", async () => {
  const ready = await decodeSubscriberUploadResponse(Response.json({ outcome: "workshop_ready", session: "A".repeat(32), status: "workshop_ready" }));
  const unavailable = await decodeSubscriberUploadResponse(Response.json({ outcome: "coverage_unavailable", session: "B".repeat(32), status: "coverage_unavailable" }));
  assert.equal(ready.outcome, "workshop_ready");
  assert.equal(unavailable.outcome, "coverage_unavailable");
});

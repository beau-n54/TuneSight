import assert from "node:assert/strict";
import test from "node:test";
import { encodeSubscriberSession } from "./subscriberCalibrationPersistence.ts";
import { createSubscriberSessionCache, type SessionObjectInfo } from "./subscriberSessionCache.ts";

const scope = { ownerId: "owner", vehicleId: "vehicle", sessionId: "a".repeat(32) };
const result = { status: "coverage_unavailable" as const, title: "Unavailable", message: "No governed coverage", identity: null,
  digest: null, container: "raw_binary", byteLength: 8, coverage: null, timings: {} };
function fixture(expires = 10_000) {
  let time = 100, downloads = 0, checks = 0;
  let bytes: Uint8Array | null = encodeSubscriberSession(scope.ownerId, scope.vehicleId, expires, result);
  let info: SessionObjectInfo | null = { id: "object", version: "1", etag: "etag-1", lastModified: "2026-10-12T00:00:00Z", size: bytes.length };
  const reader = { info: async () => { checks++; return info; }, download: async () => { downloads++; return bytes; } };
  return { reader, now: () => time, advance: (n: number) => { time += n; }, stats: () => ({ downloads, checks }),
    bytes: () => bytes!, setBytes: (next: Uint8Array | null) => { bytes = next; }, setInfo: (next: SessionObjectInfo | null) => { info = next; }, info: () => info! };
}

test("R03: warm reads revalidate metadata and decode isolated values without another body transfer", async () => {
  const f = fixture(), cache = createSubscriberSessionCache({ now: f.now });
  const first = await cache.read(scope, f.reader), second = await cache.read(scope, f.reader);
  assert.deepEqual(first, second); assert.notEqual(first, second);
  assert.deepEqual(f.stats(), { downloads: 1, checks: 3 });
  (first as { title: string }).title = "caller mutation";
  assert.equal((await cache.read(scope, f.reader))?.status, "coverage_unavailable");
  assert.deepEqual(await cache.read(scope, f.reader), result);
  f.bytes().fill(0); // The download buffer belongs to the reader, not the cache.
  assert.deepEqual(await cache.read(scope, f.reader), result);
});

test("R03: simultaneous exact-scope reads deduplicate the body but not fresh access checks", async () => {
  const f = fixture(), cache = createSubscriberSessionCache({ now: f.now });
  let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; });
  const reader = { ...f.reader, download: async () => { await gate; return f.reader.download(); } };
  const one = cache.read(scope, reader), two = cache.read(scope, reader); release();
  const values = await Promise.all([one, two]); assert.deepEqual(values, [result, result]); assert.notEqual(values[0], values[1]);
  assert.deepEqual(f.stats(), { downloads: 1, checks: 3 });
});

test("R03: deserialized typed-array views cannot mutate another caller or the retained bytes", async () => {
  const f = fixture(), cache = createSubscriberSessionCache({ now: f.now });
  const stored = { ...result, retainedExtension: new Uint8Array([11, 22]) };
  f.setBytes(encodeSubscriberSession(scope.ownerId, scope.vehicleId, 10_000, stored));
  f.setInfo({ ...f.info(), size: f.bytes().length });
  const first = await cache.read(scope, f.reader) as typeof stored;
  const second = await cache.read(scope, f.reader) as typeof stored;
  first.retainedExtension[0] = 99;
  assert.equal(second.retainedExtension[0], 11);
  assert.equal((await cache.read(scope, f.reader) as typeof stored).retainedExtension[0], 11);
  assert.equal(f.stats().downloads, 1);
});

for (const field of ["ownerId", "vehicleId", "sessionId"] as const) test(`R03: byte cache separates ${field}`, async () => {
  const f = fixture(), cache = createSubscriberSessionCache({ now: f.now });
  await cache.read(scope, f.reader);
  const other = { ...scope, [field]: field === "sessionId" ? "b".repeat(32) : "other" };
  const value = await cache.read(other, f.reader);
  assert.equal(f.stats().downloads, 2);
  if (field !== "sessionId") assert.equal(value, null);
});

for (const field of ["version", "etag", "id", "lastModified"] as const) test(`R03: changed storage ${field} forces a fresh scoped decode`, async () => {
  const f = fixture(), cache = createSubscriberSessionCache({ now: f.now });
  await cache.read(scope, f.reader); f.setInfo({ ...f.info(), [field]: "changed" });
  assert.deepEqual(await cache.read(scope, f.reader), result); assert.equal(f.stats().downloads, 2);
});

for (const state of ["missing", "deleted", "archived", "error"] as const) test(`R03: ${state} storage never returns cached bytes`, async () => {
  const f = fixture(), cache = createSubscriberSessionCache({ now: f.now });
  await cache.read(scope, f.reader);
  if (state === "error") {
    await assert.rejects(cache.read(scope, { ...f.reader, info: async () => { throw Error("private/path secret-token"); } }),
      error => error instanceof Error && error.message === "SUBSCRIBER_SESSION_TEMPORARILY_UNAVAILABLE");
  } else {
    f.setInfo(state === "missing" ? null : { ...f.info(), ...(state === "deleted" ? { isDeleteMarker: true } : { archivedAt: "archived" }) });
    assert.equal(await cache.read(scope, f.reader), null);
  }
  assert.equal(f.stats().downloads, 1);
});

test("R03: incomplete metadata is read through every time, never treated as an immutable version", async () => {
  const f = fixture(), cache = createSubscriberSessionCache({ now: f.now }); f.setInfo({ size: f.bytes().length });
  assert.deepEqual(await cache.read(scope, f.reader), result); assert.deepEqual(await cache.read(scope, f.reader), result);
  assert.equal(f.stats().downloads, 2);
});

test("R03: a replacement or size mismatch during transfer cannot seed stale evidence", async () => {
  for (const change of ["version", "size"] as const) {
    const f = fixture(), cache = createSubscriberSessionCache({ now: f.now });
    const reader = { ...f.reader, download: async () => { f.setInfo({ ...f.info(), [change]: change === "size" ? 1 : "new" }); return f.reader.download(); } };
    assert.equal(await cache.read(scope, reader), null);
  }
});

test("R03: corrupt, expired and wrong-owner sessions remain fail-closed on warm reads", async () => {
  const f = fixture(200), cache = createSubscriberSessionCache({ now: f.now });
  assert.deepEqual(await cache.read(scope, f.reader), result); f.advance(100);
  assert.equal(await cache.read(scope, f.reader), null); assert.equal(f.stats().downloads, 1);
  const bad = fixture(); bad.setBytes(new Uint8Array(bad.bytes().length));
  assert.equal(await cache.read(scope, bad.reader), null);
});

test("R03: bounded lifetime is not renewed by hits", async () => {
  const f = fixture(), cache = createSubscriberSessionCache({ now: f.now, lifetimeMs: 50 });
  await cache.read(scope, f.reader); f.advance(30); await cache.read(scope, f.reader); f.advance(20); await cache.read(scope, f.reader);
  assert.equal(f.stats().downloads, 2);
});

test("R03: entry and byte budgets evict the least recently read session", async () => {
  for (const options of [{ maxEntries: 2 }, { maxBytes: fixture().bytes().length * 2 }]) {
    const f = fixture(), cache = createSubscriberSessionCache({ ...options, now: f.now });
    const b = { ...scope, sessionId: "b".repeat(32) }, c = { ...scope, sessionId: "c".repeat(32) };
    await cache.read(scope, f.reader); await cache.read(b, f.reader); await cache.read(scope, f.reader);
    await cache.read(c, f.reader); await cache.read(scope, f.reader); assert.equal(f.stats().downloads, 3);
    await cache.read(b, f.reader); assert.equal(f.stats().downloads, 4);
  }
});

test("R03: oversized sessions remain readable without being retained", async () => {
  const f = fixture(), cache = createSubscriberSessionCache({ now: f.now, maxBytes: 1 });
  assert.deepEqual(await cache.read(scope, f.reader), result); assert.deepEqual(await cache.read(scope, f.reader), result);
  assert.equal(f.stats().downloads, 2);
});

test("R03: a rejected transfer is removed from pending work and can be retried", async () => {
  const f = fixture(), cache = createSubscriberSessionCache({ now: f.now });
  await assert.rejects(cache.read(scope, { ...f.reader, download: async () => { throw Error("private location"); } }), /TEMPORARILY_UNAVAILABLE/);
  assert.deepEqual(await cache.read(scope, f.reader), result);
});

test("R03: malformed session identity does not reach storage", async () => {
  const f = fixture(), cache = createSubscriberSessionCache({ now: f.now });
  assert.equal(await cache.read({ ...scope, sessionId: "../other" }, f.reader), null);
  assert.deepEqual(f.stats(), { checks: 0, downloads: 0 });
});

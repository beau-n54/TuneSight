import assert from "node:assert/strict";
import test from "node:test";
import { discoverSubscriberSession } from "./subscriberSessionDiscovery.ts";
const first = "a".repeat(32), second = "b".repeat(32);
const deferred = <T>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; };

test("R03 discovery overlaps one candidate read but waits for the fresh authoritative pointer", async () => {
  const pointer = deferred<string | null>(), body = deferred<string | null>();
  const calls: string[] = [];
  let published = false;
  const pending = discoverSubscriberSession(() => { calls.push("pointer"); return pointer.promise; }, id => { calls.push(id); return body.promise; }, first)
    .then(value => { published = true; return value; });
  assert.deepEqual(calls, ["pointer", first]);
  body.resolve("exact admitted result"); await Promise.resolve(); await Promise.resolve();
  assert.equal(published, false);
  pointer.resolve(first);
  assert.deepEqual(await pending, { sessionId: first, result: "exact admitted result" });
  assert.deepEqual(calls, ["pointer", first]);
});
test("R03 a changed pointer discards the candidate and reads the actual session exactly once", async () => {
  const calls: string[] = [];
  const result = await discoverSubscriberSession(async () => second, async id => { calls.push(id); return id; }, first);
  assert.deepEqual(calls, [first, second]); assert.deepEqual(result, { sessionId: second, result: second });
});
test("R03 missing or failed discovery never falls back to a candidate", async () => {
  assert.equal(await discoverSubscriberSession(async () => null, async () => "old", first), null);
  await assert.rejects(discoverSubscriberSession(async () => { throw Error("pointer unavailable"); }, async () => "old", first), /pointer unavailable/);
});
test("R03 invalid hints do not start speculative reads and candidate failures cannot replace a new session", async () => {
  const calls: string[] = [];
  assert.deepEqual(await discoverSubscriberSession(async () => second, async id => { calls.push(id); return id; }, "invalid"), { sessionId: second, result: second });
  assert.deepEqual(calls, [second]);
  assert.deepEqual(await discoverSubscriberSession(async () => second, async id => { if (id === first) throw Error("old unavailable"); return id; }, first), { sessionId: second, result: second });
  await assert.rejects(discoverSubscriberSession(async () => first, async () => { throw Error("current unavailable"); }, first), /current unavailable/);
  assert.equal(await discoverSubscriberSession(async () => first, async () => null, first), null);
});

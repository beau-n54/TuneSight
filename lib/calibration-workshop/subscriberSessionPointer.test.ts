import assert from "node:assert/strict";
import test from "node:test";
import { activeSubscriberSessionObjectPath } from "./subscriberSessionPointer.ts";

test("latest subscriber session pointers are deterministic, opaque, and owner-and-vehicle isolated", () => {
  const first = activeSubscriberSessionObjectPath("owner-a", "vehicle-a", "controlled-secret");
  assert.equal(first, activeSubscriberSessionObjectPath("owner-a", "vehicle-a", "controlled-secret"));
  assert.notEqual(first, activeSubscriberSessionObjectPath("owner-b", "vehicle-a", "controlled-secret"));
  assert.notEqual(first, activeSubscriberSessionObjectPath("owner-a", "vehicle-b", "controlled-secret"));
  assert.doesNotMatch(first, /owner|vehicle/);
  assert.match(first, /^session-active\/[A-Za-z0-9_-]{43}$/);
});

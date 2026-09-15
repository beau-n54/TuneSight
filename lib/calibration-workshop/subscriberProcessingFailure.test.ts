import assert from "node:assert/strict";
import test from "node:test";
import { classifySubscriberProcessingFailure } from "./subscriberProcessingFailure.ts";

test("private processing failures retain safe operation attribution", () => {
  const cases = [
    ["PRIVATE_UPLOAD_LEASE_INVALID", "UPLOAD_LEASE_INVALID"],
    ["PRIVATE_UPLOAD_READ_FAILED", "TRANSIENT_OBJECT_RETRIEVAL"],
    ["SOURCE_BINARY_BINDING_MISMATCH", "SOURCE_BINDING"],
    ["SOURCE_BINARY_WRITE_FAILED", "SOURCE_OBJECT_WRITE"],
    ["SOURCE_BINARY_LEASE_WRITE_FAILED", "SOURCE_LEASE_WRITE"],
    ["SOURCE_BINARY_POINTER_WRITE_FAILED", "SOURCE_POINTER_WRITE"],
    ["SOURCE_BINARY_DELETE_FAILED", "SOURCE_REPLACEMENT_CLEANUP"],
  ] as const;
  for (const [internal, code] of cases) {
    const result = classifySubscriberProcessingFailure(new Error(internal));
    assert.equal(result.code, code);
    assert.doesNotMatch(JSON.stringify(result), /owner|vehicle|digest|object key|filename|token/i);
  }
});

test("unknown provider errors remain fail-closed without exposing exception text", () => {
  const result = classifySubscriberProcessingFailure(new Error("private path and digest"));
  assert.equal(result.code, "PROVIDER_REJECTION");
  assert.doesNotMatch(JSON.stringify(result), /private path and digest/);
});

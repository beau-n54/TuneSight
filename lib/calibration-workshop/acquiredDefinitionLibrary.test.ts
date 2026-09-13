import assert from "node:assert/strict";
import test from "node:test";
import { persistAcquiredXdfContribution, transitionAcquiredXdfLifecycle, type AcquiredXdfContributionReceipt, type AcquiredXdfMetadataStore, type AcquiredXdfSourceRecord } from "./acquiredDefinitionLibrary.ts";

const valid = (title = "A") => new TextEncoder().encode(`<XDFFORMAT version="1.70"><XDFHEADER><DEFAULTS datasizeinbits="8" signed="0" float="0"/></XDFHEADER><XDFTABLE><TITLE>${title}</TITLE><XDFAXIS id="z"><EMBEDDEDDATA mmedaddress="1" mmedelementsizebits="8" mmedrowcount="1" mmedcolcount="1"/></XDFAXIS></XDFTABLE></XDFFORMAT>`);
function stores() {
  const sources: AcquiredXdfSourceRecord[] = [], receipts: AcquiredXdfContributionReceipt[] = [], objects = new Map<string, Uint8Array>();
  const metadataStore: AcquiredXdfMetadataStore = { findSourceByDigest: async (value) => sources.find((item) => item.sourceDigest === value) ?? null, insertSource: async (value) => { sources.push(value); }, insertReceipt: async (value) => { receipts.push(value); } };
  return { sources, receipts, objects, metadataStore, objectStore: { putPrivate: async (key: string, bytes: Uint8Array) => { objects.set(key, bytes); } } };
}

test("exact source bytes persist once while duplicate owners receive separate receipts", async () => {
  const state = stores(); let id = 0; const opaqueId = () => `opaque_identifier_${++id}`;
  const first = await persistAcquiredXdfContribution({ bytes: valid(), ownerId: "owner-a", contributedAt: "2026-09-14T00:00:00Z", ...state, opaqueId });
  const duplicate = await persistAcquiredXdfContribution({ bytes: valid(), ownerId: "owner-b", contributedAt: "2026-09-14T00:01:00Z", ...state, opaqueId });
  assert.equal(first.source.lifecycle, "STRUCTURALLY_PARSED"); assert.ok(first.source.definitionSetRevision); assert.equal(duplicate.duplicate, true);
  assert.equal(state.sources.length, 1); assert.equal(state.objects.size, 1); assert.equal(state.receipts.length, 2); assert.notEqual(first.receipt.receiptId, duplicate.receipt.receiptId);
  assert.equal([...state.objects.keys()][0], "acquired-xdf/raw/opaque_identifier_1"); assert.doesNotMatch([...state.objects.keys()][0]!, /owner|\.xdf/i);
});

test("changed bytes create immutable new Source Artifact and Definition Set revisions", async () => {
  const state = stores(); let id = 0; const opaqueId = () => `opaque_identifier_${++id}`;
  const one = await persistAcquiredXdfContribution({ bytes: valid("A"), ownerId: "owner", contributedAt: "2026-09-14T00:00:00Z", ...state, opaqueId });
  const two = await persistAcquiredXdfContribution({ bytes: valid("B"), ownerId: "owner", contributedAt: "2026-09-14T00:01:00Z", ...state, opaqueId });
  assert.notEqual(one.source.sourceDigest, two.source.sourceDigest); assert.notEqual(one.source.sourceArtifactId, two.source.sourceArtifactId); assert.notEqual(one.source.definitionSetRevision, two.source.definitionSetRevision); assert.equal(state.sources.length, 2);
});

test("invalid UTF-8, malformed XML and unsafe entity declarations are retained but rejected", async () => {
  const fixtures = [new Uint8Array([0xff, 0xfe]), new TextEncoder().encode("<broken>"), new TextEncoder().encode('<!DOCTYPE x [<!ENTITY leak SYSTEM "file:///etc/passwd">]><XDFFORMAT version="1.70"></XDFFORMAT>')];
  for (const [index, bytes] of fixtures.entries()) { const state = stores(); const result = await persistAcquiredXdfContribution({ bytes, ownerId: "owner", contributedAt: "2026-09-14T00:00:00Z", ...state, opaqueId: () => `opaque_identifier_${index}` }); assert.equal(result.source.lifecycle, "INVALID"); assert.equal(result.source.admissionState, "not_admitted"); assert.ok(result.source.safeFindingCodes.length); }
});

test("governed lifecycle advances explicitly and cannot skip admission or reactivate superseded evidence", () => {
  const route = ["STRUCTURALLY_PARSED", "VALIDATED_CANDIDATE", "SOURCE_AUTHORITY_REVIEW", "APPLICABILITY_REVIEW", "QUALIFIED_ADMITTED", "ACTIVE", "SUPERSEDED"] as const;
  let state: Parameters<typeof transitionAcquiredXdfLifecycle>[0] = "CONTRIBUTED_UNTRUSTED";
  for (const next of route) state = transitionAcquiredXdfLifecycle(state, next);
  assert.equal(state, "SUPERSEDED");
  assert.throws(() => transitionAcquiredXdfLifecycle("STRUCTURALLY_PARSED", "ACTIVE"), /TRANSITION_REJECTED/);
  assert.throws(() => transitionAcquiredXdfLifecycle("SUPERSEDED", "ACTIVE"), /TRANSITION_REJECTED/);
});

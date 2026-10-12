import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as nodeModule from "node:module";
import { createHash } from "node:crypto";
import { createWorkingCalibration } from "./workingCalibration.ts";
import { canonicalWorkingJson, durableWorkingScope, workingSha256 } from "./durableWorking.ts";

// Run the actual server boundary with substituted external services only.
const globals = globalThis as unknown as Record<string, unknown>;
const source = (code: string) => `data:text/javascript,${encodeURIComponent(code)}`;
type Resolution = { url: string };
type Context = { parentURL?: string };
const { registerHooks } = nodeModule as typeof nodeModule & { registerHooks(hooks: {
  resolve(specifier: string, context: Context, next: (specifier: string, context: Context) => Resolution): Resolution;
}): unknown };
registerHooks({ resolve(specifier, context, next) {
  if (specifier === "server-only") return next(source("export {}"), context);
  if (specifier.endsWith("/supabase/trustedServer")) return next(source("export const createTrustedServerClient=()=>globalThis.__r04Trusted"), context);
  if (specifier.endsWith("/subscriberWorkshopSession.server")) return next(source("export const readSubscriberWorkshopSession=(...args)=>globalThis.__r04Session(...args)"), context);
  if (specifier.endsWith("/sharedWorkspaceAdapter")) return next(source("export const sharedWorkspaceEvidence=r=>r;export const resolveSharedWorkingDefinition=()=>undefined"), context);
  if (specifier.startsWith(".") && context.parentURL?.startsWith("file:")) {
    const file = fileURLToPath(new URL(specifier, context.parentURL));
    if (fs.existsSync(file + ".ts")) return next(pathToFileURL(file + ".ts").href, context);
  }
  return next(specifier, context);
} });
const { durableWorkingRequest } = await import("./durableWorking.server.ts");
const owner = "11111111-1111-4111-8111-111111111111", vehicle = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", session = "a".repeat(32);
const dataset = { datasetId: "dataset", datasetRevision: "revision", romLayoutId: "layout", relationshipRevision: "relationship", definitionSetRevisionId: "definitions",
  sourceArtifactId: "artifact", sourceArtifactDigest: "xdf", exactBinaryIdentity: { digest: "binary", byteLength: 100, containerByteLength: 100, containerType: "bin", resolutionMethod: "bin_identity", romFamily: "synthetic" } };
const admitted = { status: "workshop_ready", material: { current: dataset }, identity: "synthetic", container: "bin", byteLength: 100, coverage: { outcome: "EXACT_DEFINITION_COVERAGE" }, workshop: {} };
const scope = durableWorkingScope({ ownerId: owner, vehicleId: vehicle, sessionId: session, currentDatasetId: "dataset", currentDatasetRevision: "revision", romLayoutId: "layout",
  relationshipRevision: "relationship", definitionSetRevision: "definitions", sourceDigest: "binary", containerDigest: "binary", containerType: "bin", sourceBytes: 100,
  definitionSourceId: "artifact", definitionSourceDigest: "xdf" });
const working = createWorkingCalibration({ ownerScope: createHash("sha256").update(owner).digest("hex").slice(0, 24), vehicleId: vehicle,
  currentDatasetId: "dataset", currentDatasetRevision: "revision", romLayoutId: "layout", relationshipRevision: "relationship", definitionSetRevision: "definitions", createdAt: "2026-10-12T00:00:00.000Z" });
const body = { action: "read", vehicleId: vehicle, sessionId: session, datasetId: "dataset", datasetRevision: "revision" };
const chain = (result: unknown) => ({ select() { return this; }, eq() { return this; }, maybeSingle: async () => result });
const authority = { user: { id: owner }, supabase: { from: () => chain({ data: { id: vehicle }, error: null }) } } as unknown as Parameters<typeof durableWorkingRequest>[1];
function setup() {
  globals.__r04Session = async () => admitted;
  globals.__r04Trusted = { rpc: async () => ({ error: null, data: [] }) };
}
test("actual server restores absence only after ownership and fresh exact session admission", async () => {
  setup(); assert.deepEqual(await durableWorkingRequest(body, authority), { head: null, working: null, history: [] });
});
test("actual server rejects cross-owner vehicle, missing session, changed Dataset and malformed requests", async () => {
  setup(); const denied = { ...authority, supabase: { from: () => chain({ data: null, error: null }) } } as unknown as typeof authority;
  await assert.rejects(durableWorkingRequest(body, denied), /SCOPE_UNAVAILABLE/);
  for (const field of ["datasetId", "datasetRevision"]) await assert.rejects(durableWorkingRequest({ ...body, [field]: "other" }, authority), /SCOPE_MISMATCH/);
  globals.__r04Session = async () => null; await assert.rejects(durableWorkingRequest(body, authority), /SESSION_UNAVAILABLE/);
  for (const input of [null, {}, { ...body, action: "delete" }, { ...body, vehicleId: "bad" }]) await assert.rejects(durableWorkingRequest(input, authority));
});
test("actual server rejects cross-session/source identities and tampered durable records", async () => {
  setup(); const payload = canonicalWorkingJson(working);
  const row = { id: "revision-id", sequence: 1, payload_text: payload, content_hash: workingSha256(payload), contract_version: "tunesight.durable-working.v1", capability_state: "EDIT_ONLY_OUTPUT_LOCKED" };
  const candidate = { scope_id: scope.scopeId, identity_text: scope.identityText, head: row, history: [] };
  globals.__r04Trusted = { rpc: async () => ({ data: [candidate] }) };
  assert.deepEqual((await durableWorkingRequest(body, authority)).working, working);
  for (const corrupt of [{ ...candidate, scope_id: "other-session" }, { ...candidate, identity_text: "other-source" },
    { ...candidate, head: { ...row, content_hash: "wrong" } }, { ...candidate, head: { ...row, capability_state: "EXPORT_QUALIFIED" } }]) {
    globals.__r04Trusted = { rpc: async () => ({ data: [corrupt] }) }; await assert.rejects(durableWorkingRequest(body, authority), /INCOMPATIBLE/);
  }
});
test("actual server database/storage failures never report empty or saved", async () => {
  setup(); globals.__r04Trusted = { rpc: async () => ({ error: { message: "database down" }, data: null }) };
  await assert.rejects(durableWorkingRequest(body, authority), /STORE_UNAVAILABLE/);
  globals.__r04Session = async () => { throw Error("Storage version lookup unavailable"); };
  await assert.rejects(durableWorkingRequest(body, authority), /Storage/);
});
test("actual save validates the proposal and verifies the exact committed head for both RPC response shapes", async () => {
  setup(); const id = "33333333-3333-4333-8333-333333333333", payload = canonicalWorkingJson(working);
  const row = { id, sequence: 1, scope_id: scope.scopeId, payload_text: payload, content_hash: workingSha256(payload),
    contract_version: "tunesight.durable-working.v1", capability_state: "EDIT_ONLY_OUTPUT_LOCKED" };
  for (const receipt of [row, [row]]) {
    globals.__r04Trusted = { rpc: async (_name: string, args: Record<string, unknown>) => {
      assert.equal(args.p_payload, payload); assert.equal(args.p_identity, scope.identityText); return { data: receipt };
    }, from: () => ({ select() { return this; }, eq() { return this; }, order() { return this; },
      single: async () => ({ data: row }), maybeSingle: async () => ({ data: { head_id: id } }), limit: async () => ({ data: [row] }) }) };
    const request = { ...body, action: "save", expectedHead: null, key: id, working };
    assert.equal((await durableWorkingRequest(request, authority)).head?.id, id);
    await assert.rejects(durableWorkingRequest({ ...request, working: { ...working, ownerScope: "forged" } }, authority));
  }
});
test("no privileged runtime is pulled into the browser client by the durable contract", () => {
  const client = fs.readFileSync(path.resolve("lib/calibration-workshop/durableWorkingClient.ts"), "utf8");
  assert.match(client, /import type.*DurableWorkingSnapshot/); assert.doesNotMatch(client, /localStorage|service_role|createTrustedServerClient/);
});

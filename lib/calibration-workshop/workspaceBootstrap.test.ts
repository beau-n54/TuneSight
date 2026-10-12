import assert from "node:assert/strict";
import test from "node:test";
import { parseWorkspaceBootstrapRequest, readWorkspaceSelectionHints, type WorkspaceManifest } from "./workspaceBootstrapContract.ts";
import { WORKSPACE_UI_VERSION } from "./workspaceRestoration.ts";

const manifest = { ownerScope: "owner", vehicleId: "vehicle" };
const scope = WORKSPACE_UI_VERSION + ':adaptive:["owner","vehicle","session","subscriber","dataset","revision"]';
const tab = { id: "tab", definitionKey: "exact-key", definitionRevision: "definition", occurrence: 2, datasetRevision: "revision" };
const raw = JSON.stringify({ version: WORKSPACE_UI_VERSION, scope, workspace: { activeId: "tab", tabs: [tab] }, unrelatedValue: "MUST_NOT_TRANSMIT" });
const storage = (entries: Record<string, string>) => ({ length: Object.keys(entries).length, key: (i: number) => Object.keys(entries)[i], getItem: (key: string) => entries[key] ?? null });
test("R03 bootstrap hints contain only exact selection identifiers and exact UI scope", () => {
  const hints = readWorkspaceSelectionHints(storage({ [scope]: raw }), manifest);
  assert.deepEqual(hints, [{ scope, selection: { key: "exact-key", definitionRevision: "definition", occurrence: 2 } }]);
  assert.ok(!JSON.stringify(hints).includes("MUST_NOT_TRANSMIT"));
  assert.deepEqual(readWorkspaceSelectionHints(storage({ [scope]: raw }), { ...manifest, requestedKey: "explicit" }), []);
});
for (const [label, request] of [
  ["owner", { ...manifest, ownerScope: "other" }], ["vehicle", { ...manifest, vehicleId: "other" }],
  ["session", { ...manifest, requestedSession: "other" }], ["ambiguous session", { ...manifest, requestedSession: ["session"] }],
] satisfies [string, WorkspaceManifest][]) test(`R03 bootstrap browser hint cannot cross ${label}`, () => assert.deepEqual(readWorkspaceSelectionHints(storage({ [scope]: raw }), request), []));
test("R03 corrupt, oversized and inaccessible UI storage does not become authority or get changed", () => {
  for (const value of ["{broken", " ".repeat(96001), raw.replace('"occurrence":2', '"occurrence":-1'), raw.replace('"datasetRevision":"revision"', '"datasetRevision":"old"')]) {
    assert.deepEqual(readWorkspaceSelectionHints(storage({ [scope]: value }), manifest), []);
  }
  assert.deepEqual(readWorkspaceSelectionHints({ length: 1, key: () => { throw Error("denied"); }, getItem: () => assert.fail() }, manifest), []);
});
test("R03 bootstrap parser bounds hints, rejects malformed scope/occurrence and drops unknown fields", () => {
  const request = { ...manifest, kind: "workspace", hints: readWorkspaceSelectionHints(storage({ [scope]: raw }), manifest) };
  assert.ok(parseWorkspaceBootstrapRequest(request));
  assert.equal(parseWorkspaceBootstrapRequest({ ...request, hints: Array(9).fill(request.hints[0]) }), null);
  assert.equal(parseWorkspaceBootstrapRequest({ ...request, hints: [{ scope: "x", selection: { key: "k", definitionRevision: "r", occurrence: 0.5 } }] }), null);
  assert.equal(parseWorkspaceBootstrapRequest({ ...request, vehicleId: "" }), null);
  assert.ok(!JSON.stringify(parseWorkspaceBootstrapRequest({ ...request, cells: [123] })).includes("cells"));
});

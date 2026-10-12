import test from "node:test";
import assert from "node:assert/strict";
import { canonicalWorkingJson, durableWorkingScope, replayDurableWorking, workingSha256, type DurableWorkingIdentity } from "./durableWorking.ts";
import { applyWorkingEdit, createWorkingCalibration, undoWorkingEdit, type WorkingDefinitionSeed } from "./workingCalibration.ts";
import { createDurableWorkingClient } from "./durableWorkingClient.ts";
import { hasUnsavedDurableWorking } from "./workingSave.ts";

const stamp = "2026-10-12T00:00:00.000Z";
const address = { definitionRevision: "def", occurrence: 1, index: 0, row: 0, column: 0 };
const definition: WorkingDefinitionSeed = { definitionRevision: "def", occurrence: 1, rows: 1, columns: 1, availability: "available",
  capability: { state: "EDIT_QUALIFIED", revision: "edit", inverse: { scale: 1, offset: 0, rawMinimum: 0, rawMaximum: 255 },
    engineeringMinimum: null, engineeringMaximum: null, blockers: [], warnings: ["No safety envelope"] }, cells: [{ ...address, currentValue: 10, units: "u" }] };
const seed = createWorkingCalibration({ ownerScope: "owner", vehicleId: "vehicle", currentDatasetId: "dataset", currentDatasetRevision: "dataset-rev",
  romLayoutId: "layout", relationshipRevision: "relationship", definitionSetRevision: "set", createdAt: stamp });
const identity: DurableWorkingIdentity = { ownerId: "owner", vehicleId: "vehicle", sessionId: "session", currentDatasetId: "dataset",
  currentDatasetRevision: "dataset-rev", romLayoutId: "layout", relationshipRevision: "relationship", definitionSetRevision: "set",
  sourceDigest: "source", containerDigest: "container", containerType: "bin", sourceBytes: 100, definitionSourceId: "artifact", definitionSourceDigest: "xdf" };
const resolve = (revision: string, occurrence: number) => revision === "def" && occurrence === 1 ? definition : undefined;
function edited() { const r = applyWorkingEdit(seed, { operation: "assign", operand: 21, targets: [address], definitions: [definition], updatedAt: stamp });
  assert.equal(r.status, "applied"); if (r.status !== "applied") throw Error("fixture"); return r.calibration; }

test("zero-change Working remains created, exact and distinct from absence", () => {
  assert.deepEqual(replayDurableWorking(seed, seed, resolve), seed);
  assert.notEqual(workingSha256(canonicalWorkingJson(seed)), workingSha256("null"));
});
test("server replay preserves exact history, undo cursor and caller objects", () => {
  const value = undoWorkingEdit(edited(), stamp), before = JSON.stringify(value);
  assert.deepEqual(replayDurableWorking(value, seed, resolve), value);
  assert.equal(JSON.stringify(value), before); assert.equal(definition.cells[0].currentValue, 10);
});
test("undo to zero remains unsaved when its redo history differs from the saved zero-change revision", () => {
  const undone = undoWorkingEdit(edited(), stamp);
  assert.equal(undone.workingCalibrationRevision, seed.workingCalibrationRevision);
  assert.equal(hasUnsavedDurableWorking(undone, seed), true);
  assert.equal(hasUnsavedDurableWorking(seed, seed), false);
});
for (const field of Object.keys(identity) as (keyof DurableWorkingIdentity)[]) test(`durable scope cannot cross ${field}`, () => {
  const changed = { ...identity, [field]: typeof identity[field] === "number" ? 101 : identity[field] + "-other" };
  assert.notEqual(durableWorkingScope(identity).scopeId, durableWorkingScope(changed).scopeId);
});
for (const field of ["ownerScope", "vehicleId", "currentDatasetId", "currentDatasetRevision", "romLayoutId", "relationshipRevision", "definitionSetRevision"] as const)
  test(`server rejects forged Working ${field}`, () => assert.throws(() => replayDurableWorking({ ...edited(), [field]: "other" }, seed, resolve)));
test("forged values, warnings, inactive redo tail, occurrence and revision are rejected", () => {
  type MutableProposal = { mutations: { after: number[]; findings: string[]; targets: { occurrence: number }[] }[] };
  for (const change of [(v: MutableProposal) => { v.mutations[0].after[0] = 99; },
    (v: MutableProposal) => { v.mutations[0].findings.length = 0; },
    (v: MutableProposal) => { v.mutations[0].targets[0].occurrence = 0; }]) {
    const value = JSON.parse(JSON.stringify(edited())); change(value);
    assert.throws(() => replayDurableWorking(value, seed, resolve));
    value.cursor = 0; value.workingCalibrationRevision = seed.workingCalibrationRevision;
    assert.throws(() => replayDurableWorking(value, seed, resolve));
  }
});
test("missing, quarantined, incompatible and oversized input cannot persist", () => {
  assert.throws(() => replayDurableWorking(edited(), seed, () => undefined));
  assert.throws(() => replayDurableWorking(edited(), seed, () => ({ ...definition, availability: "quarantined" })));
  for (const value of [null, {}, { ...seed, contractVersion: "future" }, { ...seed, cursor: 0.5 }, { ...seed, extra: "x".repeat(2097152) }])
    assert.throws(() => replayDurableWorking(value, seed, resolve));
});
test("page client preserves exact idempotency body after uncertain acknowledgement", async () => {
  const bodies: string[] = []; let fail = true;
  const client = createDurableWorkingClient({ vehicleId: "vehicle", sessionId: "session", datasetId: "dataset", datasetRevision: "revision" },
    (async (_url, options) => { bodies.push(String(options?.body)); if (fail) { fail = false; throw Error("Connection lost after commit"); }
      return Response.json({ status: "ready", head: null, working: seed, history: [] }); }) as typeof fetch, () => "fixed-idempotency-key");
  const command = { action: "save" as const, working: seed, expectedHead: null };
  await assert.rejects(client.request(command));
  await assert.rejects(client.request({ ...command, working: edited() }), /Retry/);
  await client.request(command);
  assert.equal(bodies.length, 2); assert.equal(bodies[0], bodies[1]); assert.equal(client.uncertain, false);
});
test("overlapping device requests do not race; backend conflicts retain page proposal", async () => {
  let release!: () => void;
  const client = createDurableWorkingClient({ vehicleId: "v", sessionId: "s", datasetId: "d", datasetRevision: "r" },
    (async () => { await new Promise<void>(r => { release = r; }); return Response.json({ status: "unavailable", finding: "Conflict" }, { status: 409 }); }) as typeof fetch, () => "key");
  const first = client.request({ action: "save", working: seed, expectedHead: null });
  await assert.rejects(client.request({ action: "read" }), /already running/);
  release(); await assert.rejects(first, /Conflict/); assert.equal(client.uncertain, true);
});

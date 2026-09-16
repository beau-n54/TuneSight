import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { performance } from "node:perf_hooks";
import { serialize } from "node:v8";
import { createSourceBinaryLeaseRecord, resolveSourceBinaryLease, verifyExactSourceBinary } from "./sourceBinaryReconstructionLease.ts";
import { decodeSubscriberSession, encodeSubscriberSession } from "./subscriberCalibrationPersistence.ts";
import { loadSubscriberCalibration } from "./subscriberCalibrationProvider.ts";
import { applyWorkingEdit, createWorkingCalibration, redoWorkingEdit, undoWorkingEdit } from "./workingCalibration.ts";
import { createBrowserWorkingCalibrationStore } from "./workingCalibrationPersistence.ts";

test("production-shaped 7.86 MB B58 processing binds source lease and durable session", { timeout: 60_000 }, async () => {
  const ownerId = "controlled-owner", vehicleId = "controlled-vehicle";
  const bytes = fs.readFileSync("BMW-XDFs-master/B58gen1/00003076501103_MapSwitchBase.bin");
  assert.equal(bytes.byteLength, 7_864_320);
  const result = await loadSubscriberCalibration({ bytes, fileName: "subscriber.bin", mimeType: "application/octet-stream", observedAt: "2026-09-15T00:00:00.000Z" });
  assert.equal(result.status, "workshop_ready");
  if (result.status !== "workshop_ready") return;
  const current = result.material.current;
  const binding = Object.freeze({ currentCalibrationId: current.exactBinaryIdentity.identityId, currentCalibrationRevision: current.datasetRevision, currentDatasetId: current.datasetId, currentDatasetRevision: current.datasetRevision, romLayoutId: current.romLayoutId, relationshipRevision: current.relationshipRevision, exactBinaryDigest: result.digest, byteLength: result.byteLength, containerType: result.container as "bin" | "dtf" });
  assert.equal(verifyExactSourceBinary(bytes, binding), true);
  const stored = createSourceBinaryLeaseRecord({ ownerId, vehicleId, objectId: "opaque_source", leaseId: "opaque_lease", binding, createdAt: "2026-09-15T00:00:00.000Z" });
  assert.equal(resolveSourceBinaryLease(stored, { ownerId, vehicleId, expected: binding, now: Date.parse("2026-09-15T00:01:00.000Z") }).status, "resolved");
  assert.equal(resolveSourceBinaryLease(stored, { ownerId: "other-owner", vehicleId, expected: binding, now: 0 }).status, "unauthorized");
  assert.equal(resolveSourceBinaryLease(stored, { ownerId, vehicleId: "other-vehicle", expected: binding, now: 0 }).status, "unauthorized");
  const sessionResult = Object.freeze({ ...result, sourceLease: stored.receipt });
  const session = encodeSubscriberSession(ownerId, vehicleId, Date.parse("2026-09-15T00:30:00.000Z"), sessionResult);
  const recovered = decodeSubscriberSession(session, ownerId, vehicleId, Date.parse("2026-09-15T00:01:00.000Z"));
  assert.equal(recovered?.status, "workshop_ready");
  if (recovered?.status === "workshop_ready") assert.equal(recovered.sourceLease?.leaseRevision, stored.receipt.leaseRevision);
  assert.equal(decodeSubscriberSession(session, "other-owner", vehicleId, Date.parse("2026-09-15T00:01:00.000Z")), null);

  assert.equal("mode" in result.workshop ? result.workshop.mode : null, "current_only");
  if (!("mode" in result.workshop) || result.workshop.mode !== "current_only") return;
  assert.equal(result.workshop.definitions.length, 1_175);
  const eagerStarted = performance.now(), eagerClone = JSON.parse(JSON.stringify(result.workshop.definitions)) as unknown[], eagerElapsedMs = performance.now() - eagerStarted;
  const sparseStarted = performance.now(), sparse = createWorkingCalibration({ ownerScope: ownerId, vehicleId, currentDatasetId: current.datasetId, currentDatasetRevision: current.datasetRevision, romLayoutId: current.romLayoutId, relationshipRevision: current.relationshipRevision, definitionSetRevision: current.definitionSetRevisionId, createdAt: "2026-09-15T00:00:00.000Z" }), sparseElapsedMs = performance.now() - sparseStarted;
  const memory = new Map<string, string>(), store = createBrowserWorkingCalibrationStore({ getItem: (key) => memory.get(key) ?? null, setItem: (key, value) => { memory.set(key, value); }, removeItem: (key) => { memory.delete(key); } });
  store.save(sparse);
  const sparseBytes = Buffer.byteLength([...memory.values()][0]!), eagerBytes = Buffer.byteLength(JSON.stringify(eagerClone));
  assert.ok(eagerBytes > sparseBytes * 100, `${eagerBytes} eager bytes versus ${sparseBytes} sparse bytes`);
  assert.ok(sparseElapsedMs < Math.max(50, eagerElapsedMs), `${sparseElapsedMs} ms sparse creation versus ${eagerElapsedMs} ms eager clone`);
  assert.equal("definitions" in sparse, false);
  const selected = result.workshop.definitions.find((definition) => definition.availability === "current_available" && definition.editCapability.state === "EDIT_QUALIFIED" && definition.cells.length > 0)!;
  const workingDefinition = { definitionRevision: selected.definitionRevision, occurrence: selected.occurrence, rows: selected.rows, columns: selected.columns, availability: "available" as const, capability: selected.editCapability, cells: selected.cells.map((cell) => ({ definitionRevision: selected.definitionRevision, occurrence: selected.occurrence, index: cell.index, row: cell.row, column: cell.column, currentValue: cell.currentValue, units: cell.units })) }, cell = workingDefinition.cells[0]!, address = { definitionRevision: cell.definitionRevision, occurrence: cell.occurrence, index: cell.index, row: cell.row, column: cell.column };
  const edited = applyWorkingEdit(sparse, { operation: "assign", operand: cell.currentValue, targets: [address], definitions: [workingDefinition], updatedAt: "2026-09-15T00:00:01.000Z" });
  assert.equal(edited.status, "applied");
  if (edited.status === "applied") assert.equal(redoWorkingEdit(undoWorkingEdit(edited.calibration, "2026-09-15T00:00:02.000Z"), "2026-09-15T00:00:03.000Z").cursor, 1);
  console.info("B58_WORKING_PROFILE", { definitions: result.workshop.definitions.length, eagerBytes, sparseBytes, eagerElapsedMs: Number(eagerElapsedMs.toFixed(2)), sparseElapsedMs: Number(sparseElapsedMs.toFixed(2)) });
});

test("N54 comparison sessions omit rebuildable Workshop presentation before private storage", { timeout: 60_000 }, async () => {
  const result = await loadSubscriberCalibration({ bytes: fs.readFileSync("BMW-XDFs-master/N54/IJE0S_MapSwitchBase.bin"), fileName: "subscriber.bin", mimeType: "application/octet-stream", observedAt: "2026-09-15T00:00:00.000Z" });
  assert.equal(result.status, "workshop_ready");
  if (result.status !== "workshop_ready") return;
  const fullBytes = serialize({ version: 1, ownerId: "owner", vehicleId: "vehicle", expiresAt: Date.now() + 1_800_000, result }).byteLength;
  const compact = encodeSubscriberSession("owner", "vehicle", Date.now() + 1_800_000, result), recovered = decodeSubscriberSession(compact, "owner", "vehicle");
  assert.ok(fullBytes > compact.byteLength + 2_000_000, `durable compaction must still remove rebuildable Workshop presentation: full ${fullBytes}, compact ${compact.byteLength}`);
  assert.ok(compact.byteLength < 28_000_000, `compact N54 session must retain safe headroom below the 32 MiB bucket ceiling: ${compact.byteLength}`);
  assert.equal(recovered?.status, "workshop_ready");
  if (recovered?.status === "workshop_ready") { assert.equal("mode" in recovered.workshop, false); assert.equal(recovered.workshop.definitions.length, result.workshop.definitions.length); }
  console.info("N54_SESSION_STORAGE_PROFILE", { fullBytes, compactBytes: compact.byteLength, removedBytes: fullBytes - compact.byteLength });
});

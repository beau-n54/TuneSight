import assert from "node:assert/strict";
import test from "node:test";
import { createWorkingCalibration } from "./workingCalibration.ts";
import { createBrowserWorkingCalibrationStore } from "./workingCalibrationPersistence.ts";
import { hasUnpersistedWorking, persistWorkingRevision } from "./workingSave.ts";

const seed = () => createWorkingCalibration({ ownerScope: "owner", vehicleId: "vehicle", currentDatasetId: "current", currentDatasetRevision: "revision", romLayoutId: "layout", relationshipRevision: "relationship", definitionSetRevision: "definitions", createdAt: "2026-10-11T00:00:00.000Z" });
test("quota/exception failure never marks a revision saved and successful retry confirms exact reload", () => {
  const memory = new Map<string,string>(); let fail = true;
  const store = createBrowserWorkingCalibrationStore({ getItem: key => memory.get(key) ?? null, setItem: (key,value) => { if (fail) throw new Error("QuotaExceededError"); memory.set(key,value); }, removeItem: key => { memory.delete(key); } }, true);
  const working = seed();
  assert.deepEqual(persistWorkingRevision(working, store.save), { status: "failed", revision: null });
  assert.equal(hasUnpersistedWorking(working, null), true);
  fail = false;
  const saved = persistWorkingRevision(working, store.save);
  assert.equal(saved.status, "saved");
  assert.equal(hasUnpersistedWorking(working, saved.revision), false);
  assert.equal(store.load(working, working)?.workingCalibrationRevision, working.workingCalibrationRevision);
});
test("unreadable or corrupt local history cannot masquerade as an empty store", () => {
  for (const getItem of [() => { throw new Error("SecurityError"); }, () => "corrupt", () => "null", () => "{}"]) {
    const store = createBrowserWorkingCalibrationStore({ getItem, setItem: () => assert.fail("must not overwrite"), removeItem: () => assert.fail("must not delete") }, true);
    assert.throws(() => store.load(seed(), seed()));
  }
});
test("a genuinely absent history allows a new Working Calibration", () => {
  const store = createBrowserWorkingCalibrationStore({ getItem: () => null, setItem: () => undefined, removeItem: () => undefined }, true);
  assert.equal(store.load(seed(),seed()),null);
});
test("silent storage write loss fails readback and Current remains immutable", () => {
  const current = seed(), before = JSON.stringify(current);
  const store = createBrowserWorkingCalibrationStore({ getItem: () => null, setItem: () => undefined, removeItem: () => undefined }, true);
  assert.equal(persistWorkingRevision(current, store.save).status, "failed");
  assert.equal(JSON.stringify(current), before);
});

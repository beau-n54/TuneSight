import test from "node:test";
import assert from "node:assert/strict";
import { workingHistoryRange } from "./manualEditorUx.ts";
import { applyWorkingEdit, createWorkingCalibration, undoWorkingEdit, redoWorkingEdit, type WorkingCellAddress, type WorkingDefinitionSeed } from "./workingCalibration.ts";
import { canonicalWorkingJson, replayDurableWorking } from "./durableWorking.ts";
import { createBrowserWorkingCalibrationStore } from "./workingCalibrationPersistence.ts";

const stamp = "2026-10-12T00:00:00.000Z";
const address = (row: number, column: number): WorkingCellAddress => ({ definitionRevision: "definition", occurrence: 0, row, column, index: row * 16 + column });
const rectangle = (top: number, left: number, bottom: number, right: number) =>
  Array.from({ length: bottom - top + 1 }, (_, r) => Array.from({ length: right - left + 1 }, (_, c) => address(top + r, left + c))).flat();

for (const [name, targets, expected] of [
  ["scalar", [address(0, 0)], "R0 C0"],
  ["single cell", [address(10, 12)], "R10 C12"],
  ["horizontal 1D", rectangle(0, 2, 0, 10), "R0 C2 → R0 C10"],
  ["vertical 1D", rectangle(2, 0, 10, 0), "R2 C0 → R10 C0"],
  ["3x3", rectangle(0, 0, 2, 2), "R0 C0 → R2 C2"],
  ["multi-digit rectangle", rectangle(2, 2, 10, 12), "R2 C2 → R10 C12"],
  ["sparse", [address(2, 10), address(10, 2)], "Sparse selection within R2 C2 → R10 C10"],
] as const) test(`history bounds: ${name}, reversed and non-row-major order`, () => {
  const before = JSON.stringify(targets);
  for (const ordered of [targets, [...targets].reverse(), [...targets].sort((a, b) => String(a.index).localeCompare(String(b.index)))])
    assert.equal(workingHistoryRange(ordered), expected);
  assert.equal(JSON.stringify(targets), before);
});

test("malformed, duplicate and mixed-scope coordinates never claim a rectangle", () => {
  for (const targets of [[], [address(-1, 0)], [address(0.5, 0)], [address(NaN, 0)], [address(0, Infinity)],
    [address(Number.MAX_SAFE_INTEGER + 1, 0)], [address(0, 0), address(0, 0)],
    [address(0, 0), { ...address(0, 1), occurrence: 1 }],
    [address(0, 0), { ...address(0, 1), definitionRevision: "other" }]])
    assert.equal(workingHistoryRange(targets), "Coordinate range unavailable");
});

function fixture() {
  const definition: WorkingDefinitionSeed = {
    definitionRevision: "definition", occurrence: 0, rows: 3, columns: 6, availability: "available",
    storage: { widthBits: 16, signed: false, endianness: "big" },
    capability: { state: "EDIT_QUALIFIED", revision: "edit", inverse: { scale: 1, offset: 0, rawMinimum: 0, rawMaximum: 65535 }, engineeringMinimum: null, engineeringMaximum: null, warnings: [], blockers: [] },
    cells: Array.from({ length: 18 }, (_, index) => ({ definitionRevision: "definition", occurrence: 0, index,
      row: Math.floor(index / 6), column: index % 6, currentValue: 0, currentRawValue: 0, currentRawOffset: 100 + index * 2, units: "u" })),
  };
  const seed = createWorkingCalibration({ ownerScope: "owner", vehicleId: "synthetic", currentDatasetId: "dataset", currentDatasetRevision: "revision", romLayoutId: "layout", relationshipRevision: "relationship", definitionSetRevision: "set", createdAt: stamp, definitions: [definition] });
  const targets = definition.cells.filter(cell => cell.column < 3).map(({ definitionRevision, occurrence, index, row, column }) => ({ definitionRevision, occurrence, index, row, column }));
  const result = applyWorkingEdit(seed, { operation: "matrix", operand: 0, values: [1, 2, 3, 4, 5, 6, 7, 8, 9], targets, definitions: [definition], recordExactRaw: true, updatedAt: stamp });
  assert.equal(result.status, "applied");
  if (result.status !== "applied") throw Error("fixture blocked");
  return { seed, definition, targets, working: result.calibration };
}

test("exact production 3x3 preserves all nine canonical targets, values and bytes", () => {
  const { working } = fixture(), mutation = working.mutations[0], before = canonicalWorkingJson(working);
  assert.deepEqual(mutation.targets.map(t => t.index), [0, 1, 12, 13, 14, 2, 6, 7, 8]);
  assert.equal(workingHistoryRange(mutation.targets), "R0 C0 → R2 C2");
  assert.equal(mutation.targets.length, 9);
  assert.deepEqual(mutation.after, [1, 2, 7, 8, 9, 3, 4, 5, 6]);
  assert.deepEqual(mutation.before, Array(9).fill(0));
  assert.deepEqual(mutation.exactRaw?.map(r => [r.offset, r.beforeBytes, r.afterBytes]),
    [[100, [0, 0], [0, 1]], [102, [0, 0], [0, 2]], [124, [0, 0], [0, 7]],
      [126, [0, 0], [0, 8]], [128, [0, 0], [0, 9]], [104, [0, 0], [0, 3]],
      [112, [0, 0], [0, 4]], [114, [0, 0], [0, 5]], [116, [0, 0], [0, 6]]]);
  assert.equal(canonicalWorkingJson(working), before);
});

test("existing serialized targets render accurately after save, reload, durable replay and undo/redo without migration", () => {
  const { seed, definition, working } = fixture();
  const memory = new Map<string, string>();
  const store = createBrowserWorkingCalibrationStore({ getItem: key => memory.get(key) ?? null, setItem: (key, value) => { memory.set(key, value); }, removeItem: key => { memory.delete(key); } }, true);
  store.save(working);
  const loaded = store.load(working, seed, () => definition);
  assert.ok(loaded);
  const replayed = replayDurableWorking(JSON.parse(canonicalWorkingJson(working)), seed, () => definition);
  for (const value of [loaded, replayed, redoWorkingEdit(undoWorkingEdit(working, stamp), stamp)]) {
    assert.deepEqual(value, working);
    assert.equal(workingHistoryRange(value.mutations[0].targets), "R0 C0 → R2 C2");
  }
});

for (const operation of ["assign", "multiply", "interpolate-horizontal", "interpolate-vertical", "revert"] as const)
  test(`history bounds are independent of ${operation} semantics`, () => {
    const { working, seed, definition, targets } = fixture();
    const result = applyWorkingEdit(working, { operation, operand: 2, source: "toolbar", targets: [...targets].reverse(), definitions: [definition], recordExactRaw: true, updatedAt: stamp });
    assert.equal(result.status, "applied");
    if (result.status !== "applied") return;
    assert.equal(workingHistoryRange(result.calibration.mutations[1].targets), "R0 C0 → R2 C2");
    assert.deepEqual(replayDurableWorking(result.calibration, seed, () => definition), result.calibration);
  });

test("tampered coordinate evidence fails closed in edit and durable replay", () => {
  const { seed, definition, targets, working } = fixture();
  for (const row of [-1, 0.5, 10, NaN]) {
    const result = applyWorkingEdit(seed, { operation: "assign", operand: 1, targets: [{ ...targets[0], row }], definitions: [definition], recordExactRaw: true, updatedAt: stamp });
    assert.equal(result.status, "blocked");
    const forged = JSON.parse(JSON.stringify(working)); forged.mutations[0].targets[0].row = row;
    assert.throws(() => replayDurableWorking(forged, seed, () => definition));
  }
});

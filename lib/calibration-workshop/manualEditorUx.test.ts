import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { adjacentEditableCellIndex, engineeringToRawRepresentation, validationExplanation, workingOperationLabel } from "./manualEditorUx.ts";
import { applyWorkingEdit, createWorkingCalibration, redoWorkingEdit, undoWorkingEdit, workingCellValue, type WorkingCellAddress, type WorkingDefinitionSeed } from "./workingCalibration.ts";
import { createBrowserWorkingCalibrationStore } from "./workingCalibrationPersistence.ts";

const address = (index: number): WorkingCellAddress => ({ definitionRevision: "definition", occurrence: 0, index, row: 0, column: index });
const definition = (warnings: readonly string[] = []): WorkingDefinitionSeed => ({ definitionRevision: "definition", occurrence: 0, rows: 1, columns: 3, availability: "available", capability: { state: "EDIT_QUALIFIED", revision: "edit", inverse: { scale: 0.5, offset: -10, rawMinimum: 0, rawMaximum: 255 }, engineeringMinimum: null, engineeringMaximum: null, warnings, blockers: [] }, cells: [10, 20, 30].map((currentValue, index) => ({ ...address(index), currentValue, units: "unit" })) });
const calibration = (seed = definition()) => createWorkingCalibration({ ownerScope: "owner", vehicleId: "vehicle", currentDatasetId: "dataset", currentDatasetRevision: "dataset-revision", romLayoutId: "layout", relationshipRevision: "relationship", definitionSetRevision: "set", createdAt: "2026-09-16T00:00:00.000Z", definitions: [seed] });

test("direct edits use the governed mutation engine and share mixed toolbar undo and redo history", () => {
  const seed = definition(), start = calibration(seed), direct = applyWorkingEdit(start, { operation: "assign", source: "direct", operand: 15, targets: [address(0)], definitions: [seed], updatedAt: "2026-09-16T00:00:01.000Z" });
  assert.equal(direct.status, "applied"); if (direct.status !== "applied") return;
  const region = applyWorkingEdit(direct.calibration, { operation: "percentage", source: "toolbar", operand: 10, targets: [address(1)], definitions: [seed], updatedAt: "2026-09-16T00:00:02.000Z" });
  assert.equal(region.status, "applied"); if (region.status !== "applied") return;
  const last = applyWorkingEdit(region.calibration, { operation: "assign", source: "direct", operand: 35, targets: [address(2)], definitions: [seed], updatedAt: "2026-09-16T00:00:03.000Z" });
  assert.equal(last.status, "applied"); if (last.status !== "applied") return;
  assert.deepEqual(last.calibration.mutations.map(item => item.source), ["direct", "toolbar", "direct"]);
  const twiceUndone = undoWorkingEdit(undoWorkingEdit(last.calibration, "2026-09-16T00:00:04.000Z"), "2026-09-16T00:00:05.000Z");
  assert.deepEqual([0, 1, 2].map(index => workingCellValue(twiceUndone, address(index))), [15, 20, 30]);
  assert.equal(workingCellValue(redoWorkingEdit(twiceUndone, "2026-09-16T00:00:06.000Z"), address(1)), 22);
});

test("direct VALID, WARNING and BLOCKED results preserve exact engineering truth", () => {
  const validSeed = definition(), valid = applyWorkingEdit(calibration(validSeed), { operation: "assign", source: "direct", operand: 15, targets: [address(0)], definitions: [validSeed], updatedAt: "2026-09-16T00:00:01.000Z" });
  assert.equal(valid.status === "applied" ? valid.calibration.mutations[0]!.validation : "BLOCKED", "VALID");
  const warningSeed = definition(["Qualified engineering range is unavailable."]), warning = applyWorkingEdit(calibration(warningSeed), { operation: "assign", source: "direct", operand: 15, targets: [address(0)], definitions: [warningSeed], updatedAt: "2026-09-16T00:00:01.000Z" });
  assert.equal(warning.status === "applied" ? warning.calibration.mutations[0]!.validation : "BLOCKED", "WARNING");
  const start = calibration(validSeed), blocked = applyWorkingEdit(start, { operation: "assign", source: "direct", operand: 10.25, targets: [address(0)], definitions: [validSeed], updatedAt: "2026-09-16T00:00:01.000Z" });
  assert.equal(blocked.status, "blocked"); assert.deepEqual(blocked.calibration, start); assert.equal(blocked.calibration.cursor, 0); assert.equal(start.cursor, 0);
  assert.match(validationExplanation("WARNING", ["detail"]), /qualified engineering safety range/);
  assert.match(validationExplanation("BLOCKED", ["not representable by the qualified raw integer conversion"]), /cannot be represented exactly/);
});

test("keyboard navigation stays bounded and raw representation follows the active engineering value", () => {
  assert.equal(adjacentEditableCellIndex(0, 3, true), 0); assert.equal(adjacentEditableCellIndex(2, 3), 2); assert.equal(adjacentEditableCellIndex(1, 3), 2); assert.equal(adjacentEditableCellIndex(1, 3, true), 0);
  assert.equal(engineeringToRawRepresentation(15, definition().capability.inverse), 50); assert.equal(engineeringToRawRepresentation(15.25, definition().capability.inverse), null);
  assert.equal(workingOperationLabel("assign", "direct"), "Direct value edit"); assert.equal(workingOperationLabel("percentage"), "Percentage change");
});

test("direct edit history persists and reloads without changing governed Working identity", () => {
  const seed = definition(), start = calibration(seed), result = applyWorkingEdit(start, { operation: "assign", source: "direct", operand: 15, targets: [address(0)], definitions: [seed], updatedAt: "2026-09-16T00:00:01.000Z" });
  assert.equal(result.status, "applied"); if (result.status !== "applied") return;
  const memory = new Map<string, string>(), storage = { getItem: (key: string) => memory.get(key) ?? null, setItem: (key: string, value: string) => { memory.set(key, value); }, removeItem: (key: string) => { memory.delete(key); } }, store = createBrowserWorkingCalibrationStore(storage), scope = { ownerScope: "owner", vehicleId: "vehicle", currentDatasetId: "dataset" };
  store.save(result.calibration); const loaded = store.load(scope, start, () => seed);
  assert.equal(loaded?.workingCalibrationRevision, result.calibration.workingCalibrationRevision); assert.equal(loaded?.mutations[0]?.source, "direct"); assert.equal(loaded ? workingCellValue(loaded, address(0)) : null, 15);
});

test("Grid interaction remains WORKING-only, deliberate and selection-keyed", () => {
  const root = path.join(process.cwd(), "app", "dashboard", "vehicles", "[id]", "calibration"), cell = fs.readFileSync(path.join(root, "direct-grid-cell.tsx"), "utf8"), currentOnly = fs.readFileSync(path.join(root, "current-only-workshop-client.tsx"), "utf8"), comparison = fs.readFileSync(path.join(root, "workshop-client.tsx"), "utf8"), panel = fs.readFileSync(path.join(root, "working-calibration-panel.tsx"), "utf8");
  for (const source of [currentOnly, comparison]) { assert.match(source, /displayMode\s*===?\s*"working"/); assert.match(source, /source:\s*"direct"/); assert.match(source, /EDIT_QUALIFIED/); assert.match(source, /data-selection=/); }
  for (const gesture of ["onDoubleClick", 'event.key === "Enter"', 'event.key === "Escape"', 'event.key === "Tab"', "event.shiftKey", "ArrowUp", "ArrowDown"]) assert.match(cell, new RegExp(gesture.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(cell, /draft\.trim\(\)/); assert.match(cell, /validationExplanation/); assert.match(panel, /Engineering Detail/); assert.doesNotMatch(panel, /placeholder=\{operation === "assign" \? "18\.5"/);
});

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const source = fs.readFileSync(path.join(process.cwd(), "app", "dashboard", "vehicles", "[id]", "calibration", "current-only-workshop-client.tsx"), "utf8");

test("Current-only Workshop exposes generic Working controls and Working-aware Grid/2D/3D values", () => {
  for (const label of ["Create Working Calibration", "Set value", "Add delta", "Change %", "Undo", "Redo", "Shift-click selects a rectangular region"]) assert.match(source, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(source, /working \? "Working" : "Current"/);
  assert.match(source, /3D Table visualization/);
  assert.match(source, /2D Table visualization/);
  assert.match(source, /workingCellValue/);
  assert.match(source, /workingCellDelta/);
  assert.match(source, /detail\.editCapability\.state !== "EDIT_QUALIFIED"/);
  assert.doesNotMatch(source, /if\s*\([^)]*(?:N54|B58|S58|I8A0S|00003076501103)/);
});

test("browser persistence stores derived mutation evidence rather than Current Dataset values", () => {
  const persistence = fs.readFileSync(path.join(process.cwd(), "lib", "calibration-workshop", "workingCalibrationPersistence.ts"), "utf8");
  assert.match(persistence, /mutations/);
  assert.match(persistence, /currentDatasetRevision/);
  assert.match(persistence, /ownerScope/);
  assert.match(persistence, /vehicleId/);
  assert.match(persistence, /definitions: _definitions/);
});

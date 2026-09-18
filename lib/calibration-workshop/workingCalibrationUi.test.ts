import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const source = fs.readFileSync(path.join(process.cwd(), "app", "dashboard", "vehicles", "[id]", "calibration", "current-only-workshop-client.tsx"), "utf8");
const comparisonSource = fs.readFileSync(path.join(process.cwd(), "app", "dashboard", "vehicles", "[id]", "calibration", "workshop-client.tsx"), "utf8");
const panelSource = fs.readFileSync(path.join(process.cwd(), "app", "dashboard", "vehicles", "[id]", "calibration", "working-calibration-panel.tsx"), "utf8");

test("Current-only Workshop exposes generic Working controls and Working-aware Grid/2D/3D values", () => {
  const experience = source + panelSource;
  for (const label of ["Create Working Calibration", "Set value", "Add / subtract", "Percentage change", "Undo", "Redo", "Shift-click selects a rectangular region"]) assert.match(experience, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(source, /displayMode === "working"/);
  assert.match(source, /3D Table visualization/);
  assert.match(source, /2D Table visualization/);
  assert.match(source, /workingCellValue/);
  assert.match(source, /workingCellDelta/);
  assert.match(source, /editQualified=\{detail\.editCapability\.state === "EDIT_QUALIFIED"\}/);
  assert.doesNotMatch(source, /if\s*\([^)]*(?:N54|B58|S58|I8A0S|00003076501103)/);
});

test("comparison Workshop exposes the same governed Working mutation path only for subscriber sessions", () => {
  const experience = comparisonSource + panelSource;
  for (const label of ["Create Working Calibration", "Set value", "Add / subtract", "Percentage change", "Undo", "Redo", "Apply"]) {
    assert.match(experience, new RegExp(label));
  }
  assert.match(comparisonSource, /subscriberSession\s*&&/);
  assert.match(comparisonSource, /editQualified=\{\s*detail\.summary\.editCapability\?\.state\s*===\s*"EDIT_QUALIFIED"\s*\}/);
  assert.match(comparisonSource, /workingCellValue/);
  assert.match(comparisonSource, /workingCellDelta/);
  assert.doesNotMatch(comparisonSource, /if\s*\([^)]*(?:N54|B58|S58|I8A0S|00003076501103)/);
});

test("subscriber editor presents explicit state, validation, history and truthful Build/Export boundaries", () => {
  for (const label of ["CURRENT", "WORKING", "Create Working Calibration", "Set value", "Add / subtract", "Percentage change", "VALID", "WARNING", "BLOCKED", "Change history", "Build Calibration", "Export BIN · LOCKED", "Checksum/integrity qualification required"]) assert.match(panelSource, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(panelSource, /preview\?\.validation === "BLOCKED"/);
  assert.match(panelSource, /working\?\.mutations\.slice\(0, working\.cursor\)/);
  assert.match(source, /Drag or Shift-click selects a rectangular region/);
  assert.match(comparisonSource, /Drag or Shift-click selects a rectangular region/);
  assert.match(source, /Percentage delta/);
  assert.match(comparisonSource, /Percentage delta/);
  assert.match(source, /workingChangedDefinitionKeys/);
  assert.match(comparisonSource, /workingChangedDefinitionKeys/);
  assert.match(panelSource, /No downloadable or flashable BIN is produced/);
  assert.doesNotMatch(panelSource, /<a[^>]+download/);
});

test("browser persistence stores derived mutation evidence rather than Current Dataset values", () => {
  const persistence = fs.readFileSync(path.join(process.cwd(), "lib", "calibration-workshop", "workingCalibrationPersistence.ts"), "utf8");
  assert.match(persistence, /mutations/);
  assert.match(persistence, /currentDatasetRevision/);
  assert.match(persistence, /ownerScope/);
  assert.match(persistence, /vehicleId/);
  assert.match(persistence, /StoredWorkingCalibration/);
  assert.doesNotMatch(persistence, /currentValue/);
  assert.match(source, /resolveWorkingDefinition/);
});

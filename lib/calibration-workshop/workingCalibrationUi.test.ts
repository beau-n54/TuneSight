import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const read = (name: string) => fs.readFileSync("app/dashboard/vehicles/[id]/calibration/" + name, "utf8");
const controller = read("shared-workspace-client.tsx"), renderer = read("workshop-client.tsx"), panel = read("working-calibration-panel.tsx");
test("history panel uses complete numeric bounds rather than first/last canonical target order", () => {
  assert.match(panel, /workingHistoryRange\(mutation\.targets\)/);
  assert.doesNotMatch(panel, /mutation\.targets\.at\(-1\)/);
});
test("one shared workspace exposes governed Working controls for both evidence states", () => {
  for (const label of ["Create Working Calibration", "Set engineering value", "Set raw integer", "Add / subtract", "Percentage increase / decrease",
    "Multiply by factor", "Paste matrix", "Revert selected to Current", "Interpolate columns (structural)", "Interpolate rows (structural)", "Undo", "Redo"]) assert.ok(panel.includes(label), label);
  for (const label of ["Save durable revision", "Reload durable head", "Restore revision"]) assert.ok(controller.includes(label), label);
  assert.match(controller, /displayMode !== "working"/); assert.match(controller, /applyWorkingEdit/); assert.match(controller, /EDIT_QUALIFIED/);
  assert.doesNotMatch(controller, /if\s*\([^)]*(?:N54|B58|S58|I8A0S|00003076501103)/);
});
test("Working values are projected independently and bound to the exact owner and Current revision", () => {
  const model = fs.readFileSync("lib/calibration-workshop/sharedTablePresentation.ts", "utf8");
  assert.match(model, /workingCellValue/); assert.match(model, /workingMatchesProjection/); assert.match(model, /workingDelta/);
  assert.match(controller, /resolveProjectedWorkingDefinition/); assert.match(controller, /canMutate/);
  assert.match(renderer, /model.workingBound/); assert.match(renderer, /data-selection=/);
});
test("shared editor preserves history, validation and locked output boundaries", () => {
  for (const label of ["CURRENT", "WORKING", "VALID", "WARNING", "BLOCKED", "Change history", "Build Calibration", "Export BIN · LOCKED", "Checksum/integrity qualification required", "No downloadable or flashable BIN is produced"]) assert.ok(panel.includes(label), label);
  assert.match(panel, /preview\?\.validation === "BLOCKED"/); assert.match(panel, /working\?\.mutations\.slice\(0, working\.cursor\)/);
  assert.match(renderer, /Drag or Shift-click selects a rectangular region/); assert.match(renderer, /percentage delta/);
  assert.match(controller, /workingChangedDefinitionKeys/); assert.doesNotMatch(panel, /<a[^>]+download/);
});
test("browser Working persistence retains its schema, replay and conflict guard", () => {
  const persistence = fs.readFileSync("lib/calibration-workshop/workingCalibrationPersistence.ts", "utf8");
  for (const token of ["mutations", "currentDatasetRevision", "ownerScope", "vehicleId", "StoredWorkingCalibration", "expectedRevision"]) assert.ok(persistence.includes(token));
  assert.doesNotMatch(persistence, /currentValue/); assert.match(controller, /workingRestoreDefinitions/);
});

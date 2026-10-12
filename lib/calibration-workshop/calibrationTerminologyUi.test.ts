import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
const read = (name: string) => fs.readFileSync("app/dashboard/vehicles/[id]/calibration/" + name, "utf8");
const control = read("calibration-terminology-control.tsx"), controller = read("shared-workspace-client.tsx"), renderer = read("workshop-client.tsx");
test("Standard defaults and owner-scoped browser preference never reload evidence", () => {
  assert.match(control, /useState<CalibrationTerminologyMode>\("standard"\)/); assert.match(control, /ownerScope/);
  assert.match(control, /window\.localStorage/); assert.doesNotMatch(control, /fetch\(|router\.|subscriberSession|createWorkingCalibration|materializeWorkshopDefinition/);
});
test("comparison and Current-only share the same terminology controller", () => {
  assert.match(controller, /CalibrationTerminologyControl/); assert.match(controller, /useCalibrationTerminologyMode\(context.ownerId\)/);
  assert.doesNotMatch(controller, /CurrentOnlyWorkshopClient|CurrentInspector|CurrentGrid/);
});
test("Grid, Inspector, 2D and 3D consume one selected projection model", () => {
  assert.match(controller, /buildSharedTablePresentation\(projection, working, displayMode, mode\)/);
  for (const tag of ["Grid", "Inspector"]) assert.match(controller, new RegExp("<" + tag + "[\\s\\S]*?model=\\{tableModel\\}"));
  assert.match(controller, /CalibrationPlot2D/); assert.match(controller, /CalibrationSurface3D/);
});
test("Explorer, tabs and renderers retain literal source identity and shared terminology", () => {
  assert.match(controller, /CalibrationTerminologyScope/); assert.match(controller, /WorkspaceTabs/); assert.match(controller, /definition.title/);
  assert.match(renderer, /model.terminology.sourceTitle/);
  for (const file of ["CalibrationPlot2D.tsx", "CalibrationSurface3D.tsx"]) assert.match(read(file), /labels.output.label/);
});
test("shared disclosures consume qualified purpose and axis terms without title inference", () => {
  assert.match(renderer, /What this Table does/); assert.match(renderer, /Why it matters/); assert.match(renderer, /tableGuidanceInput/);
  assert.match(read("calibration-axis-grid.tsx"), /Cells ·/); assert.match(read("calibration-axis-grid.tsx"), /calibrationTermLabel/);
});

import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const control=fs.readFileSync("app/dashboard/vehicles/[id]/calibration/calibration-terminology-control.tsx","utf8");
const current=fs.readFileSync("app/dashboard/vehicles/[id]/calibration/current-only-workshop-client.tsx","utf8");
const comparison=fs.readFileSync("app/dashboard/vehicles/[id]/calibration/workshop-client.tsx","utf8");

test("Standard is the default and preference remains browser-local",()=>{assert.match(control,/useState<CalibrationTerminologyMode>\("standard"\)/);assert.match(control,/window\.localStorage/);assert.doesNotMatch(control,/fetch\(|router\.|subscriberSession/)});
test("both Workshop variants switch terminology without recreating evidence or Working state",()=>{for(const source of [current,comparison]){assert.match(source,/CalibrationTerminologyControl/);assert.match(source,/useCalibrationTerminologyMode/);assert.doesNotMatch(control,/createWorkingCalibration|materializeWorkshopDefinition|loadSubscriberCalibration/)}});
test("Grid, 2D and 3D consume selected-Table terminology in Current-only Workshop",()=>{assert.match(current,/terminology=\{terminology\}/);assert.match(current,/CurrentPlot detail=\{detail\} terminologyMode=\{terminologyMode\}/);assert.match(current,/CurrentInspector detail=\{detail\} terminologyMode=\{terminologyMode\}/)});
test("both Workshop variants present qualified Standard purpose and consistent cell terminology",()=>{for(const source of [current,comparison]){assert.match(source,/What it controls/);assert.match(source,/Why it matters/);assert.match(source,/Cells ·/);assert.match(source,/calibrationTermLabel/)}});

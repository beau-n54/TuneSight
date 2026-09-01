import assert from "node:assert/strict";
import test from "node:test";
import { getCalibrationCompletionProgramme } from "./completionProgramme.ts";

test("two-month Calibration programme is deterministic, subscriber-first and complete in scope", () => {
  const first = getCalibrationCompletionProgramme(), second = getCalibrationCompletionProgramme();
  assert.deepEqual(first, second);
  assert.equal(first.capabilities.length, 20);
  for (const name of ["BMW Coverage", "Real Calibration Loading", "Connected DME Resolution", "Calibration Explorer", "Table Information & Education", "Grid", "2D", "3D", "Working Calibration", "Manual Editor", "Change Management", "Validation", "Suggested Calibration", "Analysis ↔ Calibration", "Telemetry Relationships", "Live Vehicle Gauges", "Map/Tune Output", "DME Read", "Flashing Prerequisites", "Flashing"]) assert.ok(first.capabilities.some((item) => item.capability === name), name);
  assert.equal(first.primaryProgramme, true); assert.equal(first.subscriberPriority, true); assert.ok(Object.isFrozen(first));
});

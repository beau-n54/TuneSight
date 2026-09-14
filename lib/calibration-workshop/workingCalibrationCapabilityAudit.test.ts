import test from "node:test";
import assert from "node:assert/strict";
import { auditRepositoryWorkingCalibrationCapabilities } from "./workingCalibrationCapabilityAudit.ts";

test("all 65 active VIEW relationships receive a deterministic governed EDIT assessment", { timeout: 180_000 }, (context) => {
  const audit = auditRepositoryWorkingCalibrationCapabilities();
  assert.equal(audit.relationships, 65);
  assert.ok(audit.tables > 0);
  assert.equal(audit.technicallyReversible + audit.inverseBlocked + audit.quarantined, audit.tables);
  assert.equal(audit.editQualified, 70_686);
  assert.equal(audit.viewOnly, 52);
  assert.ok(audit.quarantined >= 1);
  context.diagnostic(`BMW_WORKING_CALIBRATION_CAPABILITY_AUDIT ${JSON.stringify(audit)}`);
});

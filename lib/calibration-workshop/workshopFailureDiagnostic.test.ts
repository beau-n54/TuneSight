import assert from "node:assert/strict";
import test from "node:test";
import { publicWorkshopFailureDiagnostic, WorkshopDiagnosticTrace } from "./workshopFailureDiagnostic.ts";

test("production diagnostics classify resource failure without exposing sensitive exception material", () => {
  const trace = new WorkshopDiagnosticTrace();
  let caught: unknown;
  try { trace.run("RESOURCE_RESOLUTION", () => { const error = Object.assign(new Error("private absolute path and filename"), { code: "ENOENT" }); throw error; }); } catch (error) { caught = error; }
  const diagnostic = publicWorkshopFailureDiagnostic(caught), serialized = JSON.stringify(diagnostic);
  assert.equal(diagnostic.errorId, "CW-RESOURCE_RESOLUTION-RESOURCE_MISSING");
  assert.equal(diagnostic.stage, "RESOURCE_RESOLUTION");
  assert.doesNotMatch(serialized, /private|absolute|filename|ENOENT/i);
});

test("unknown exceptions remain fail-closed and expose only a stable safe classification", () => {
  const diagnostic = publicWorkshopFailureDiagnostic(new Error("secret material"));
  assert.deepEqual(diagnostic, { errorId: "CW-UNKNOWN-STAGE_FAILURE", stage: "UNKNOWN", classification: "STAGE_FAILURE", elapsedMs: 0, completedStageTimings: {} });
});

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

test("pre-Dataset governance rejections retain their explicit safe stages", () => {
  for (const stage of ["RELATIONSHIP_MEMBERSHIP", "DEFINITION_SET_BINDING"] as const) {
    const trace = new WorkshopDiagnosticTrace();
    let caught: unknown;
    try { trace.run(stage, () => { throw new Error("private governed fixture detail"); }); } catch (error) { caught = error; }
    const diagnostic = publicWorkshopFailureDiagnostic(caught), serialized = JSON.stringify(diagnostic);
    assert.equal(diagnostic.errorId, `CW-${stage}-GOVERNANCE_REJECTION`);
    assert.equal(diagnostic.stage, stage);
    assert.doesNotMatch(serialized, /private|fixture detail/i);
  }
});

test("binary identity rejection distinguishes reference and current roles without identity material", () => {
  for (const safeFailureCode of ["REFERENCE_REJECTION", "CURRENT_REJECTION"] as const) {
    const trace = new WorkshopDiagnosticTrace();
    let caught: unknown;
    try { trace.run("BINARY_IDENTITY", () => { throw new Error("private governed authority value"); }, safeFailureCode); } catch (error) { caught = error; }
    const diagnostic = publicWorkshopFailureDiagnostic(caught), serialized = JSON.stringify(diagnostic);
    assert.equal(diagnostic.errorId, `CW-BINARY_IDENTITY-${safeFailureCode}`);
    assert.equal(diagnostic.stage, "BINARY_IDENTITY");
    assert.equal(diagnostic.classification, "GOVERNANCE_REJECTION");
    assert.doesNotMatch(serialized, /private|governed authority value/i);
  }
});

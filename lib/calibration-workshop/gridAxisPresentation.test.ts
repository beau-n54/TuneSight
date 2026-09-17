import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { bindDefinitionKnowledge, type QualifiedSemanticField, type WorkshopKnowledgeRecord } from "./definitionKnowledgeBinding.ts";
import { buildGridAxisPresentation, gridAxisCoordinate, gridAxisLabel } from "./gridAxisPresentation.ts";

const field = <T>(value: T, id: string): QualifiedSemanticField<T> => ({ value, assertionId: id, assertionRevision: "1", authority: "founder", provenance: ["review"], limitations: [] });
const semantic = (qualified = false) => bindDefinitionKnowledge({ definitionIdentity: "definition", definitionRevision: "revision" }, qualified ? [{ knowledgeId: "knowledge", knowledgeRevision: "1", lifecycle: "active", verification: "founder_verified", conflict: false, exactWorkshopInstanceIdentities: [], exactDefinitionIdentities: ["definition"], exactDefinitionRevisions: ["revision"], applicability: [], aliases: [], engineeringSystem: null, controls: [], whyItMatters: [], howToRead: [], directionalEffects: [], operatingContexts: [], engineeringConsiderations: [], axisMeanings: [field({ axisId: "x", meaning: "Engine Speed" }, "axis:x"), field({ axisId: "y", meaning: "Load" }, "axis:y")], relatedCalibrations: [], telemetryRelationships: [], limitations: [] } satisfies WorkshopKnowledgeRecord] : []);

test("2D Grid preserves governed X/Y values, units, source terms and qualified names", () => {
  const model = buildGridAxisPresentation({ shape: "2D", rows: 2, columns: 3, axes: [{ id: "x", units: "RPM", values: [1500, 2000, 2500] }, { id: "y", units: "%", values: [40, 60] }], semantic: semantic(true), outputUnits: "psi" });
  assert.deepEqual(model.x?.values, [1500, 2000, 2500]);
  assert.deepEqual(model.y?.values, [40, 60]);
  assert.equal(gridAxisLabel(model.x!), "X · Engine Speed [RPM]");
  assert.equal(gridAxisLabel(model.y!), "Y · Load [%]");
  assert.equal(model.x?.sourceName, "x");
  assert.deepEqual(gridAxisCoordinate(model, 1, 2), { x: { value: 2500, units: "RPM" }, y: { value: 60, units: "%" } });
  assert.deepEqual(model.output, { name: "Output", units: "psi" });
});

test("unknown semantics remain Source Axis while structural evidence remains visible", () => {
  const model = buildGridAxisPresentation({ shape: "2D", rows: 2, columns: 2, axes: [{ id: "BMW source X", units: "hPa", values: [1000, 1200] }, { id: "BMW source Y", units: null, values: [1, 2] }], semantic: semantic(), outputUnits: null });
  assert.equal(gridAxisLabel(model.x!), "X · Source Axis [hPa]");
  assert.equal(model.x?.sourceName, "BMW source X");
  assert.equal(gridAxisLabel(model.y!), "Y · Source Axis");
  assert.equal(model.y?.sourceName, "BMW source Y");
});

test("1D and scalar presentations do not fabricate a Y axis", () => {
  const one = buildGridAxisPresentation({ shape: "1D", rows: 1, columns: 4, axes: [{ id: "x", units: "°C", values: [0, 20, 40, 60] }], semantic: semantic(), outputUnits: "%" });
  assert.deepEqual(one.x?.values, [0, 20, 40, 60]);
  assert.equal(one.y, null);
  const scalar = buildGridAxisPresentation({ shape: "scalar", rows: 1, columns: 1, axes: [], semantic: semantic(), outputUnits: "Nm" });
  assert.equal(scalar.x, null);
  assert.equal(scalar.y, null);
  assert.deepEqual(gridAxisCoordinate(scalar, 0, 0), { x: null, y: null });
});

test("Current axes are explicit and changed Reference axes remain disclosed without replacement", () => {
  const model = buildGridAxisPresentation({ shape: "2D", rows: 2, columns: 2, axes: [{ id: "x", units: "RPM", values: [2000, 3000] }, { id: "y", units: "%", values: [50, 70] }], referenceAxes: [{ id: "x", units: "RPM", values: [1000, 2000] }, { id: "y", units: "%", values: [40, 60] }], semantic: semantic(), outputUnits: null });
  assert.equal(model.displayedAxisState, "current");
  assert.equal(model.referenceAxesDiffer, true);
  assert.deepEqual(model.x?.values, [2000, 3000]);
  assert.deepEqual(model.y?.values, [50, 70]);
});

test("axis presentation is selected-Table local, deterministic and bounded", () => {
  const first = { shape: "2D" as const, rows: 16, columns: 16, axes: [{ id: "x", units: "RPM", values: Array.from({ length: 16 }, (_, index) => index * 500) }, { id: "y", units: "%", values: Array.from({ length: 16 }, (_, index) => index * 5) }], semantic: semantic(), outputUnits: "%" };
  const second = { ...first, axes: [{ id: "x", units: "°C", values: Array.from({ length: 16 }, (_, index) => index * 10) }, { id: "y", units: "hPa", values: Array.from({ length: 16 }, (_, index) => 900 + index * 10) }] };
  const started = performance.now();
  for (let index = 0; index < 10_000; index += 1) buildGridAxisPresentation(index % 2 ? first : second);
  const elapsed = performance.now() - started;
  assert.deepEqual(buildGridAxisPresentation(first).x?.values, first.axes[0]!.values);
  assert.deepEqual(buildGridAxisPresentation(second).x?.values, second.axes[0]!.values);
  assert.ok(elapsed < 500, `10,000 selected-Table axis models exceeded 500 ms: ${elapsed} ms`);
});

test("shared Grid source provides sticky headers, frozen Y context and responsive overflow without replacing editor controls", () => {
  const grid = fs.readFileSync("app/dashboard/vehicles/[id]/calibration/calibration-axis-grid.tsx", "utf8");
  assert.match(grid, /sticky top-0/);
  assert.match(grid, /sticky left-0/);
  assert.match(grid, /overflow-auto/);
  assert.match(grid, /Y ↓ \/ X →/);
  for (const client of ["workshop-client.tsx", "current-only-workshop-client.tsx"]) {
    const source = fs.readFileSync(`app/dashboard/vehicles/[id]/calibration/${client}`, "utf8");
    assert.match(source, /CalibrationAxisGrid/);
    assert.match(source, /DirectGridCell/);
    assert.match(source, /gridAxisCoordinate/);
  }
});
